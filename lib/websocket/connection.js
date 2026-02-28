"use strict";
/**
 * WebSocket Connection Implementation
 *
 * Implements the Connection interface for WebSocket connections,
 * providing message sending, connection management, and state tracking.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketConnection = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const types_1 = require("../types");
const serialization_1 = require("../protocol/serialization");
// ============================================================================
// WebSocket Connection Implementation
// ============================================================================
class WebSocketConnection extends events_1.EventEmitter {
    constructor(ws, serverId, mode = 'plugin', options = {}) {
        super();
        this.capabilities = [];
        this._status = 'connecting';
        this.messageQueue = [];
        this.isAuthenticated = false;
        this.encryptionEnabled = false;
        this.ws = ws;
        this.serverId = serverId;
        this.mode = mode;
        this.authToken = options.authToken;
        this.encryptionEnabled = options.encryptionEnabled || false;
        this.encryptionKey = options.encryptionKey;
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            bytesReceived: 0,
            bytesSent: 0,
            lastActivity: Date.now(),
            connectionTime: Date.now(),
            errors: 0
        };
        this.setupWebSocketHandlers();
    }
    // ============================================================================
    // Connection Interface Implementation
    // ============================================================================
    get status() {
        switch (this._status) {
            case 'connected':
                return 'connected';
            case 'connecting':
                return 'connecting';
            case 'error':
                return 'error';
            default:
                return 'disconnected';
        }
    }
    async send(message) {
        if (this._status !== 'connected') {
            if (this._status === 'connecting') {
                // Queue message for later sending
                this.messageQueue.push(message);
                return;
            }
            throw new types_1.ConnectionError(`Cannot send message: connection is ${this._status}`, this.serverId);
        }
        try {
            // Serialize message
            const serializeResult = serialization_1.MessageSerializer.serialize(message, {
                validate: true,
                encrypt: this.encryptionEnabled,
                encryptionKey: this.encryptionKey
            });
            if (!serializeResult.success) {
                throw new types_1.ProtocolError(`Failed to serialize message: ${serializeResult.error}`, message.id);
            }
            const serializedData = serializeResult.data;
            const dataString = typeof serializedData === 'string' ? serializedData : serializedData.toString('utf8');
            // Send through WebSocket
            await this.sendRaw(dataString);
            // Update statistics
            this.stats.messagesSent++;
            this.stats.bytesSent += Buffer.byteLength(dataString, 'utf8');
            this.stats.lastActivity = Date.now();
            this.emit('messageSent', message);
        }
        catch (error) {
            this.stats.errors++;
            this.emit('error', error);
            throw error;
        }
    }
    async close(code, reason) {
        if (this._status === 'disconnected' || this._status === 'closing') {
            return;
        }
        this._status = 'closing';
        try {
            // Send disconnect message if possible using MessageFactory
            if (this.ws.readyState === ws_1.default.OPEN) {
                const { MessageFactory } = await Promise.resolve().then(() => __importStar(require('../protocol/messages')));
                const disconnectMessage = MessageFactory.createSystemMessage('disconnect', {
                    reason: reason || 'Connection closed by client'
                }, {
                    serverId: this.serverId
                });
                try {
                    await this.send(disconnectMessage);
                }
                catch (error) {
                    // Ignore errors when sending disconnect message
                }
            }
            // Close WebSocket
            this.ws.close(code || 1000, reason || 'Normal closure');
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    /**
     * Check if connection is ready for communication
     */
    isReady() {
        return this._status === 'connected' && this.isAuthenticated;
    }
    /**
     * Get connection statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Set authentication status
     */
    setAuthenticated(authenticated, token) {
        this.isAuthenticated = authenticated;
        if (token) {
            this.authToken = token;
        }
        if (authenticated && this._status === 'connected') {
            // Process queued messages
            this.processMessageQueue();
        }
    }
    /**
     * Update capabilities
     */
    updateCapabilities(capabilities) {
        this.capabilities = [...capabilities];
        this.emit('capabilitiesUpdated', capabilities);
    }
    /**
     * Enable/disable encryption
     */
    setEncryption(enabled, key) {
        this.encryptionEnabled = enabled;
        if (key) {
            this.encryptionKey = key;
        }
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    setupWebSocketHandlers() {
        this.ws.on('open', () => {
            this._status = 'connected';
            this.emit('connected');
        });
        this.ws.on('message', (data) => {
            this.handleIncomingMessage(data);
        });
        this.ws.on('close', (code, reason) => {
            this._status = 'disconnected';
            this.emit('disconnected', code, reason.toString());
        });
        this.ws.on('error', (error) => {
            this._status = 'error';
            this.stats.errors++;
            this.emit('error', new types_1.ConnectionError(`WebSocket error: ${error.message}`, this.serverId));
        });
        this.ws.on('ping', (data) => {
            this.ws.pong(data);
            this.emit('ping', data);
        });
        this.ws.on('pong', (data) => {
            this.emit('pong', data);
        });
    }
    async handleIncomingMessage(data) {
        try {
            // Convert data to string
            let messageData;
            if (Buffer.isBuffer(data)) {
                messageData = data.toString('utf8');
            }
            else if (Array.isArray(data)) {
                messageData = Buffer.concat(data).toString('utf8');
            }
            else {
                messageData = data.toString();
            }
            // Update statistics
            this.stats.messagesReceived++;
            this.stats.bytesReceived += Buffer.byteLength(messageData, 'utf8');
            this.stats.lastActivity = Date.now();
            // Deserialize message
            const deserializeResult = serialization_1.MessageSerializer.deserialize(messageData, {
                validate: true,
                decrypt: this.encryptionEnabled,
                decryptionKey: this.encryptionKey
            });
            if (!deserializeResult.success) {
                throw new types_1.ProtocolError(`Failed to deserialize message: ${deserializeResult.error}`);
            }
            const message = deserializeResult.message;
            this.emit('message', message);
        }
        catch (error) {
            this.stats.errors++;
            this.emit('error', error);
        }
    }
    async sendRaw(data) {
        return new Promise((resolve, reject) => {
            if (this.ws.readyState !== ws_1.default.OPEN) {
                reject(new types_1.ConnectionError('WebSocket is not open', this.serverId));
                return;
            }
            this.ws.send(data, (error) => {
                if (error) {
                    reject(new types_1.ConnectionError(`Failed to send message: ${error.message}`, this.serverId));
                }
                else {
                    resolve();
                }
            });
        });
    }
    async processMessageQueue() {
        if (this.messageQueue.length === 0) {
            return;
        }
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        for (const message of messages) {
            try {
                await this.send(message);
            }
            catch (error) {
                this.emit('error', error);
                // Re-queue failed messages
                this.messageQueue.unshift(message);
                break;
            }
        }
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Get connection info for debugging
     */
    getConnectionInfo() {
        return {
            serverId: this.serverId,
            status: this._status,
            mode: this.mode,
            isAuthenticated: this.isAuthenticated,
            capabilities: [...this.capabilities],
            stats: this.getStats(),
            queuedMessages: this.messageQueue.length
        };
    }
    /**
     * Ping the connection
     */
    ping(data) {
        if (this.ws.readyState === ws_1.default.OPEN) {
            this.ws.ping(data);
        }
    }
    /**
     * Check if WebSocket is alive
     */
    isAlive() {
        return this.ws.readyState === ws_1.default.OPEN;
    }
}
exports.WebSocketConnection = WebSocketConnection;
