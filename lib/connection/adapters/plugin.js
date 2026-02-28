"use strict";
/**
 * Plugin Connection Adapter
 *
 * Handles WebSocket connections to Minecraft server plugins (Connector Bridge).
 * This is the primary connection mode for servers with plugin support.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginConnectionAdapter = void 0;
const ws_1 = __importDefault(require("ws"));
const base_1 = require("./base");
const types_1 = require("../../types");
const serialization_1 = require("../../protocol/serialization");
// ============================================================================
// Plugin Connection Adapter
// ============================================================================
class PluginConnectionAdapter extends base_1.BaseConnectionAdapter {
    constructor(serverId) {
        super(serverId, 'plugin');
        this.pendingRequests = new Map();
        this.capabilities = [
            'realtime_events',
            'command_execution',
            'player_management',
            'world_management',
            'plugin_integration'
        ];
    }
    // ============================================================================
    // Connection Implementation
    // ============================================================================
    async doConnect(config) {
        const pluginConfig = config.plugin;
        if (!pluginConfig) {
            throw new types_1.ConnectionError('Plugin configuration is required', this.serverId);
        }
        const protocol = pluginConfig.ssl ? 'wss' : 'ws';
        const path = pluginConfig.path || '/ws';
        const url = `${protocol}://${pluginConfig.host}:${pluginConfig.port}${path}`;
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.default(url, {
                    headers: {
                        'X-Server-ID': this.serverId,
                        'X-Connection-Mode': 'plugin'
                    }
                });
                this.ws.on('open', () => {
                    this.setupHeartbeat();
                    resolve();
                });
                this.ws.on('message', (data) => {
                    this.handleMessage(data);
                });
                this.ws.on('close', (code, reason) => {
                    this.handleDisconnection(code, reason.toString());
                });
                this.ws.on('error', (error) => {
                    reject(new types_1.ConnectionError(`WebSocket connection failed: ${error.message}`, this.serverId));
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async doDisconnect() {
        this.clearTimers();
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            // Send disconnect message
            try {
                await this.sendDisconnectMessage();
            }
            catch (error) {
                // Ignore errors when sending disconnect message
            }
            this.ws.close(1000, 'Normal closure');
        }
        this.ws = undefined;
    }
    async doSendMessage(message) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            throw new types_1.ConnectionError('WebSocket is not connected', this.serverId);
        }
        const serialized = serialization_1.MessageSerializer.serialize(message, { validate: true });
        if (!serialized.success) {
            throw new types_1.ProtocolError(`Failed to serialize message: ${serialized.error}`, message.id);
        }
        return new Promise((resolve, reject) => {
            this.ws.send(serialized.data, (error) => {
                if (error) {
                    reject(new types_1.ConnectionError(`Failed to send message: ${error.message}`, this.serverId));
                }
                else {
                    resolve();
                }
            });
        });
    }
    async doSendCommand(command) {
        const requestId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const message = {
            type: 'request',
            id: requestId,
            op: 'server.command',
            data: { command },
            timestamp: new Date().toISOString(),
            serverId: this.serverId,
            version: '2.0'
        };
        // Send command and wait for response
        const response = await this.sendRequestAndWait(message, 30000); // 30 second timeout
        if (!response.success) {
            return {
                success: false,
                output: [],
                executionTime: 0,
                error: response.error || 'Command execution failed'
            };
        }
        return {
            success: true,
            output: response.data?.output || [],
            executionTime: response.data?.executionTime || 0
        };
    }
    doHealthCheck() {
        return this.ws?.readyState === ws_1.default.OPEN;
    }
    // ============================================================================
    // Message Handling
    // ============================================================================
    handleMessage(data) {
        try {
            const messageStr = data.toString();
            const deserialized = serialization_1.MessageSerializer.deserialize(messageStr, { validate: true });
            if (!deserialized.success) {
                this.emit('error', new types_1.ProtocolError(`Failed to deserialize message: ${deserialized.error}`));
                return;
            }
            const message = deserialized.message;
            this.recordMessage();
            // Handle responses to pending requests
            if (message.type === 'response') {
                this.handleResponse(message);
                return;
            }
            // Handle system messages
            if (message.type === 'system') {
                this.handleSystemMessage(message);
                return;
            }
            // Handle events
            if (message.type === 'event') {
                this.emit('event', message);
                return;
            }
            // Emit generic message event
            this.emit('message', message);
        }
        catch (error) {
            this.recordError();
            this.emit('error', error);
        }
    }
    handleResponse(message) {
        const requestId = message.requestId || message.id;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
            pending.resolve(message);
        }
    }
    handleSystemMessage(message) {
        const systemOp = message.systemOp;
        switch (systemOp) {
            case 'ping':
                this.sendPong(message.id);
                break;
            case 'pong':
                // Update latency
                const pingTime = parseInt(message.id.split('-')[1]);
                if (!isNaN(pingTime)) {
                    this._stats.latency = Date.now() - pingTime;
                }
                break;
            case 'capabilities':
                this.capabilities = message.data?.capabilities || [];
                this.emit('capabilitiesUpdated', this.capabilities);
                break;
            case 'disconnect':
                this.emit('remoteDisconnect', message.data?.reason);
                break;
        }
    }
    handleDisconnection(code, reason) {
        this.clearTimers();
        this.rejectPendingRequests(new types_1.ConnectionError(`Connection closed: ${code} ${reason}`, this.serverId));
        this.emit('disconnected', code, reason);
    }
    // ============================================================================
    // Request/Response Handling
    // ============================================================================
    async sendRequestAndWait(message, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(message.id);
                reject(new types_1.ConnectionError(`Request timeout after ${timeout}ms`, this.serverId));
            }, timeout);
            this.pendingRequests.set(message.id, {
                resolve,
                reject,
                timeout: timeoutHandle
            });
            this.doSendMessage(message).catch(reject);
        });
    }
    rejectPendingRequests(error) {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pendingRequests.clear();
    }
    // ============================================================================
    // Heartbeat and System Messages
    // ============================================================================
    setupHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendPing();
        }, 30000); // Ping every 30 seconds
    }
    async sendPing() {
        const pingMessage = {
            type: 'system',
            id: `ping-${Date.now()}`,
            op: 'ping',
            data: {},
            timestamp: new Date().toISOString(),
            serverId: this.serverId,
            version: '2.0',
            systemOp: 'ping'
        };
        try {
            await this.doSendMessage(pingMessage);
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    async sendPong(pingId) {
        const pongMessage = {
            type: 'system',
            id: `pong-${Date.now()}`,
            op: 'pong',
            data: { pingId },
            timestamp: new Date().toISOString(),
            serverId: this.serverId,
            version: '2.0',
            systemOp: 'pong'
        };
        try {
            await this.doSendMessage(pongMessage);
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    async sendDisconnectMessage() {
        const disconnectMessage = {
            type: 'system',
            id: `disconnect-${Date.now()}`,
            op: 'disconnect',
            data: { reason: 'Client disconnect' },
            timestamp: new Date().toISOString(),
            serverId: this.serverId,
            version: '2.0',
            systemOp: 'disconnect'
        };
        await this.doSendMessage(disconnectMessage);
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    clearTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }
}
exports.PluginConnectionAdapter = PluginConnectionAdapter;
