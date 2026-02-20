"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MochiLinkConnectionManager = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
        this.messageQueue = [];
        this.pendingMessages = new Map();
        this.config = config;
        this.logger = logger;
        this.maxReconnectAttempts = config.getRetryAttempts();
        this.reconnectDelay = config.getRetryDelay();
    }
    /**
     * Connect to Mochi-Link management system
     */
    async connect() {
        if (this.isConnected || this.isConnecting) {
            return;
        }
        this._isConnecting = true;
        try {
            const host = this.config.getMochiLinkHost();
            const port = this.config.getMochiLinkPort();
            const path = this.config.getMochiLinkPath();
            const serverId = this.config.getServerId();
            const wsUrl = `ws://${host}:${port}${path}?serverId=${encodeURIComponent(serverId)}`;
            this.logger.info(`Connecting to Mochi-Link at ${wsUrl}...`);
            this.ws = new ws_1.default(wsUrl, {
                headers: {
                    'X-Server-Id': serverId,
                    'X-Server-Type': 'LLBDS',
                    'X-Protocol-Version': '2.0',
                    'Authorization': `Bearer ${this.config.getAuthToken()}`
                },
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
        this.reconnectAttempts = 0;
        this.emit('disconnect');
    }
    /**
     * Send message to Mochi-Link
     */
    async send(message) {
        if (!this.isConnected || !this.ws) {
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
            if (message.id && message.type !== 'response') {
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
        this.reconnectAttempts = 0;
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
            if (message.type === 'response' && message.id) {
                const pending = this.pendingMessages.get(message.id);
                if (pending) {
                    this.pendingMessages.delete(message.id);
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
            // Send handshake response
            const response = {
                type: 'system',
                id: message.id,
                op: 'handshake_response',
                data: {
                    serverId: this.config.getServerId(),
                    serverName: this.config.getServerName(),
                    serverType: 'LLBDS',
                    protocolVersion: '2.0',
                    capabilities: [
                        'player_management',
                        'command_execution',
                        'performance_monitoring',
                        'event_streaming',
                        'whitelist_management',
                        'ban_management'
                    ],
                    authentication: {
                        token: this.config.getAuthToken()
                    }
                },
                timestamp: Date.now(),
                version: '2.0',
                systemOp: 'handshake_response'
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
                id: message.id,
                op: 'pong',
                data: {
                    timestamp: Date.now(),
                    serverId: this.config.getServerId()
                },
                timestamp: Date.now(),
                version: '2.0',
                systemOp: 'pong'
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
    handleDisconnectRequest(message) {
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
        // Attempt reconnection if not a normal closure
        if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
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
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        this.logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.connect().catch(error => {
                    this.logger.error('Reconnection attempt failed:', error);
                });
            }
        }, delay);
    }
    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.clearHeartbeat();
        this.heartbeatInterval = setInterval(async () => {
            if (this.isConnected) {
                try {
                    const heartbeat = {
                        type: 'heartbeat',
                        timestamp: Date.now(),
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
        if (this.isConnected) {
            return 'connected';
        }
        else if (this.isConnecting) {
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
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            queuedMessages: this.messageQueue.length,
            pendingMessages: this.pendingMessages.size,
            lastConnectTime: this.isConnected ? Date.now() : null
        };
    }
    /**
     * Reset connection state
     */
    reset() {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.messageQueue = [];
        this.pendingMessages.clear();
    }
}
exports.MochiLinkConnectionManager = MochiLinkConnectionManager;
//# sourceMappingURL=MochiLinkConnectionManager.js.map