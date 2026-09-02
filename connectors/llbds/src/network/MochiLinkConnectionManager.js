"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MochiLinkConnectionManager = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const crypto_1 = require("crypto");
const ReconnectionManager_1 = require("../common/ReconnectionManager");
const DECLARED_CAPABILITIES = [
    'player_management',
    'command_execution',
    'performance_monitoring',
    'event_streaming'
];
/**
 * Mochi-Link Connection Manager
 *
 * Manages WebSocket connection to the Mochi-Link management system
 * from the external Node.js service.
 *
 * @author chm413
 * @version 1.0.0
 */
class MochiLinkConnectionManager extends events_1.EventEmitter {
    constructor(config, logger) {
        super();
        this.ws = null;
        this._isConnected = false;
        this._isConnecting = false;
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
        this.messageQueue = [];
        this.pendingMessages = new Map();
        this.config = config;
        this.logger = logger;
        // 初始化重连管理器
        const reconnectionConfig = {
            baseInterval: config.getRetryDelay(),
            maxAttempts: config.getRetryAttempts(),
            backoffMultiplier: 1.5,
            maxInterval: 60000,
            disableOnMaxAttempts: true
        };
        this.reconnectionManager = new ReconnectionManager_1.ReconnectionManager(logger, reconnectionConfig, {
            attemptReconnect: async () => {
                await this.connect();
                return this.isConnected();
            },
            onReconnecting: (attempts, nextInterval) => {
                this.logger.info(`第 ${attempts} 次重连，${nextInterval}ms 后执行`);
            },
            onMaxAttemptsReached: (totalAttempts) => {
                this.logger.warn(`达到最大重连次数，总尝试: ${totalAttempts}`);
            },
            onReconnectionDisabled: (totalAttempts) => {
                this.logger.warn(`重连已禁用，总尝试: ${totalAttempts}`);
            },
            onReconnectionEnabled: () => {
                this.logger.info('重连已重新启用');
            }
        });
    }
    /**
     * Connect to Mochi-Link management system
     */
    async connect() {
        if (this._isConnected || this._isConnecting) {
            return;
        }
        this._isConnecting = true;
        try {
            const host = this.config.getMochiLinkHost();
            const port = this.config.getMochiLinkPort();
            const path = this.config.getMochiLinkPath();
            const serverId = this.config.getServerId();
            const networkConfig = this.config.getConfig().network || {};
            const scheme = networkConfig.ssl ? 'wss' : 'ws';
            const params = new URLSearchParams({ serverId });
            const token = this.config.getAuthToken();
            const wsUrl = `${scheme}://${host}:${port}${path}?${params.toString()}`;
            this.logger.info(`Connecting to Mochi-Link at ${scheme}://${host}:${port}${path}...`);
            const headers = {
                'X-Server-Id': serverId,
                'X-Server-Type': 'LLBDS',
                'X-Protocol-Version': '2.0',
                'X-Capabilities': DECLARED_CAPABILITIES.join(',')
            };
            if (token) {
                headers['X-Auth-Token'] = token;
                headers.Authorization = `Bearer ${token}`;
            }
            this.ws = new ws_1.default(wsUrl, {
                headers,
                handshakeTimeout: this.config.getTimeout()
            });
            this.setupWebSocketHandlers();
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    this.logger.error('Connection timeout');
                    this.handleConnectionError(new Error('Connection timeout'));
                }
            }, this.config.getTimeout());
        }
        catch (error) {
            this._isConnecting = false;
            this.logger.error('Failed to initiate connection:', error);
            throw error;
        }
    }
    /**
     * Disconnect from Mochi-Link
     */
    async disconnect() {
        this.logger.info('Disconnecting from Mochi-Link...');
        // 取消重连
        this.reconnectionManager.cancel();
        // Clear intervals and timeouts
        this.clearHeartbeat();
        this.clearConnectionTimeout();
        // Close WebSocket connection
        if (this.ws) {
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }
        this._isConnected = false;
        this._isConnecting = false;
        this.emit('disconnect');
    }
    /**
     * Send message to Mochi-Link
     */
    async send(message) {
        if (!this._isConnected || !this.ws) {
            // Queue message for later sending
            this.messageQueue.push(message);
            this.logger.debug('Message queued (not connected):', message.type || 'unknown');
            return;
        }
        try {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            this.logger.debug('Message sent:', message.type || 'unknown');
            // Track pending messages that expect responses
            if (message.id && message.type === 'request') {
                this.pendingMessages.set(message.id, {
                    message,
                    timestamp: Date.now()
                });
                // Clean up pending message after timeout
                setTimeout(() => {
                    this.pendingMessages.delete(message.id);
                }, 30000);
            }
        }
        catch (error) {
            this.logger.error('Failed to send message:', error);
            throw error;
        }
    }
    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        if (!this.ws)
            return;
        this.ws.on('open', () => {
            this.handleConnectionOpen();
        });
        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });
        this.ws.on('close', (code, reason) => {
            this.handleConnectionClose(code, reason);
        });
        this.ws.on('error', (error) => {
            this.handleConnectionError(error);
        });
        this.ws.on('ping', (data) => {
            this.ws?.pong(data);
        });
        this.ws.on('pong', () => {
            this.logger.debug('Received pong from server');
        });
    }
    /**
     * Handle connection open
     */
    handleConnectionOpen() {
        this.logger.info('Connected to Mochi-Link management system!');
        this._isConnected = true;
        this._isConnecting = false;
        // 重置重连状态
        this.reconnectionManager.reset();
        this.clearConnectionTimeout();
        this.startHeartbeat();
        // Send queued messages
        this.sendQueuedMessages();
        this.emit('connect');
    }
    /**
     * Handle incoming message
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            this.logger.debug('Received message:', message.type || 'unknown');
            // Handle system messages
            if (message.type === 'system') {
                this.handleSystemMessage(message);
                return;
            }
            // Handle responses to pending messages
            if (message.type === 'response') {
                const correlationId = message.requestId || message.id;
                const pending = correlationId ? this.pendingMessages.get(correlationId) : undefined;
                if (pending) {
                    this.pendingMessages.delete(correlationId);
                    this.emit('response', message, pending.message);
                    return;
                }
            }
            // Emit message for handling by external service
            this.emit('message', message);
        }
        catch (error) {
            this.logger.error('Failed to parse incoming message:', error);
        }
    }
    /**
     * Handle system messages
     */
    handleSystemMessage(message) {
        switch (message.systemOp || message.op) {
            case 'handshake':
                this.handleHandshake(message);
                break;
            case 'ping':
                this.handlePing(message);
                break;
            case 'disconnect':
                this.handleDisconnectRequest(message);
                break;
            default:
                this.logger.warn('Unknown system message:', message.systemOp || message.op);
        }
    }
    /**
     * Handle handshake message
     */
    async handleHandshake(message) {
        try {
            const serverId = this.config.getServerId();
            const token = this.config.getAuthToken();
            const data = {
                serverId,
                serverName: this.config.getServerName(),
                serverType: 'LLBDS',
                protocolVersion: '2.0',
                capabilities: [...DECLARED_CAPABILITIES],
                authentication: {
                    token,
                    method: 'token'
                }
            };
            // Upgrade headers carry the token. Keep challenge support for
            // deployments that deliberately omit it from the upgrade.
            if (message.data?.challenge && token) {
                const challenge = String(message.data.challenge);
                const challengeTimestamp = Number(message.data.challengeTimestamp ?? message.timestamp ?? Date.now());
                data.authentication.method = 'challenge';
                data.challenge = challenge;
                data.challengeTimestamp = challengeTimestamp;
                data.challengeResponse = (0, crypto_1.createHmac)('sha256', token)
                    .update(`${challenge}:${token}:${challengeTimestamp}`, 'utf8')
                    .digest('hex');
            }
            const response = {
                type: 'system',
                id: this.generateId(),
                requestId: message.id,
                op: 'handshake',
                systemOp: 'handshake',
                data,
                timestamp: Date.now(),
                version: '2.0',
                serverId
            };
            await this.send(response);
            this.logger.info('Handshake completed successfully');
        }
        catch (error) {
            this.logger.error('Failed to handle handshake:', error);
        }
    }
    /**
     * Handle ping message
     */
    async handlePing(message) {
        try {
            const response = {
                type: 'system',
                id: this.generateId(),
                requestId: message.id,
                op: 'pong',
                systemOp: 'pong',
                data: {
                    timestamp: Date.now(),
                    serverId: this.config.getServerId()
                },
                timestamp: Date.now(),
                version: '2.0'
            };
            await this.send(response);
        }
        catch (error) {
            this.logger.error('Failed to handle ping:', error);
        }
    }
    /**
     * Handle disconnect request
     */
    handleDisconnectRequest(_message) {
        this.logger.info('Received disconnect request from server');
        this.disconnect();
    }
    /**
     * Handle connection close
     */
    handleConnectionClose(code, reason) {
        this.logger.warn(`Connection closed: ${code} - ${reason}`);
        this._isConnected = false;
        this._isConnecting = false;
        this.clearHeartbeat();
        this.clearConnectionTimeout();
        this.emit('disconnect', code, reason);
        // Attempt reconnection if not a normal closure (remote disconnect)
        if (code !== 1000) {
            this.reconnectionManager.scheduleReconnect();
        }
    }
    /**
     * Handle connection error
     */
    handleConnectionError(error) {
        this.logger.error('WebSocket connection error:', error);
        this._isConnected = false;
        this._isConnecting = false;
        this.clearHeartbeat();
        this.clearConnectionTimeout();
        this.emit('error', error);
        // Attempt reconnection on connection failure
        this.reconnectionManager.scheduleReconnect();
    }
    /**
     * Get reconnection status
     */
    getReconnectionStatus() {
        return this.reconnectionManager.getStatus();
    }
    /**
     * Enable reconnection
     */
    enableReconnection() {
        this.reconnectionManager.enable();
    }
    /**
     * Disable reconnection
     */
    disableReconnection() {
        this.reconnectionManager.disable();
    }
    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.clearHeartbeat();
        this.heartbeatInterval = setInterval(async () => {
            if (this._isConnected) {
                try {
                    const heartbeat = {
                        type: 'system',
                        id: this.generateId(),
                        op: 'ping',
                        systemOp: 'ping',
                        data: {
                            serverId: this.config.getServerId(),
                            timestamp: Date.now()
                        },
                        timestamp: Date.now(),
                        version: '2.0',
                        serverId: this.config.getServerId()
                    };
                    await this.send(heartbeat);
                }
                catch (error) {
                    this.logger.error('Failed to send heartbeat:', error);
                }
            }
        }, 30000); // 30 seconds
    }
    /**
     * Generate unique message ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Clear heartbeat interval
     */
    clearHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    /**
     * Clear connection timeout
     */
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }
    /**
     * Send queued messages
     */
    async sendQueuedMessages() {
        if (this.messageQueue.length === 0) {
            return;
        }
        this.logger.info(`Sending ${this.messageQueue.length} queued messages`);
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        for (const message of messages) {
            try {
                await this.send(message);
            }
            catch (error) {
                this.logger.error('Failed to send queued message:', error);
                // Re-queue failed message
                this.messageQueue.push(message);
            }
        }
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this._isConnected;
    }
    /**
     * Check if connecting
     */
    isConnecting() {
        return this._isConnecting;
    }
    /**
     * Get connection status
     */
    getConnectionStatus() {
        if (this._isConnected) {
            return 'connected';
        }
        else if (this._isConnecting) {
            return 'connecting';
        }
        else {
            return 'disconnected';
        }
    }
    /**
     * Get connection statistics
     */
    getConnectionStats() {
        const reconnectionStatus = this.reconnectionManager.getStatus();
        return {
            connected: this._isConnected,
            connecting: this._isConnecting,
            reconnectAttempts: reconnectionStatus.currentAttempts,
            totalReconnectAttempts: reconnectionStatus.totalAttempts,
            reconnectionDisabled: reconnectionStatus.disabled,
            queuedMessages: this.messageQueue.length,
            pendingMessages: this.pendingMessages.size,
            lastConnectTime: this._isConnected ? Date.now() : null
        };
    }
    /**
     * Reset connection state
     */
    reset() {
        this.disconnect();
        this.reconnectionManager.reset();
        this.messageQueue = [];
        this.pendingMessages.clear();
    }
}
exports.MochiLinkConnectionManager = MochiLinkConnectionManager;
//# sourceMappingURL=MochiLinkConnectionManager.js.map