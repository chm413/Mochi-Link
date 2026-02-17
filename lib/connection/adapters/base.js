"use strict";
/**
 * Base Connection Adapter
 *
 * Abstract base class for all connection adapters, providing common
 * functionality and interface implementation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseConnectionAdapter = void 0;
const events_1 = require("events");
const types_1 = require("../types");
// ============================================================================
// Base Connection Adapter
// ============================================================================
class BaseConnectionAdapter extends events_1.EventEmitter {
    constructor(serverId, mode) {
        super();
        this.capabilities = [];
        this._isConnected = false;
        this.serverId = serverId;
        this.mode = mode;
        this._stats = {
            messagesReceived: 0,
            messagesSent: 0,
            commandsExecuted: 0,
            errors: 0,
            uptime: 0,
            latency: undefined
        };
    }
    // ============================================================================
    // Connection Interface Implementation
    // ============================================================================
    get isConnected() {
        return this._isConnected;
    }
    async connect(config) {
        if (this._isConnected) {
            throw new types_1.ConnectionModeError(`Adapter for ${this.serverId} is already connected`, this.mode, this.serverId);
        }
        this._config = config;
        try {
            await this.doConnect(config);
            this._isConnected = true;
            this._connectedAt = new Date();
            this._lastActivity = new Date();
            this.emit('connected');
        }
        catch (error) {
            this._stats.errors++;
            this.emit('error', error);
            throw error;
        }
    }
    async disconnect() {
        if (!this._isConnected) {
            return;
        }
        try {
            await this.doDisconnect();
        }
        catch (error) {
            this._stats.errors++;
            this.emit('error', error);
        }
        finally {
            this._isConnected = false;
            this._connectedAt = undefined;
            this.emit('disconnected');
        }
    }
    async reconnect() {
        if (!this._config) {
            throw new types_1.ConnectionModeError(`No configuration available for reconnection`, this.mode, this.serverId);
        }
        await this.disconnect();
        await this.connect(this._config);
    }
    async sendMessage(message) {
        if (!this._isConnected) {
            throw new types_1.ConnectionModeError(`Cannot send message: adapter for ${this.serverId} is not connected`, this.mode, this.serverId);
        }
        try {
            await this.doSendMessage(message);
            this._stats.messagesSent++;
            this._lastActivity = new Date();
        }
        catch (error) {
            this._stats.errors++;
            throw error;
        }
    }
    async sendCommand(command) {
        if (!this._isConnected) {
            throw new types_1.ConnectionModeError(`Cannot send command: adapter for ${this.serverId} is not connected`, this.mode, this.serverId);
        }
        try {
            const startTime = Date.now();
            const result = await this.doSendCommand(command);
            const executionTime = Date.now() - startTime;
            this._stats.commandsExecuted++;
            this._lastActivity = new Date();
            return {
                ...result,
                executionTime
            };
        }
        catch (error) {
            this._stats.errors++;
            throw error;
        }
    }
    getConnectionInfo() {
        return {
            serverId: this.serverId,
            mode: this.mode,
            isConnected: this._isConnected,
            connectedAt: this._connectedAt,
            lastActivity: this._lastActivity,
            capabilities: [...this.capabilities],
            stats: { ...this._stats },
            config: this._config || {}
        };
    }
    isHealthy() {
        return this._isConnected && this.doHealthCheck();
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    updateStats() {
        if (this._connectedAt) {
            this._stats.uptime = Date.now() - this._connectedAt.getTime();
        }
    }
    recordMessage() {
        this._stats.messagesReceived++;
        this._lastActivity = new Date();
    }
    recordError() {
        this._stats.errors++;
    }
}
exports.BaseConnectionAdapter = BaseConnectionAdapter;
