"use strict";
/**
 * Base Connector Bridge
 *
 * Abstract base class that defines the unified interface for server operations
 * across different Minecraft server implementations (Java/Bedrock).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseConnectorBridge = void 0;
const events_1 = require("events");
const types_1 = require("./types");
// ============================================================================
// Base Connector Bridge Class
// ============================================================================
class BaseConnectorBridge extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.isConnected = false;
        this.lastUpdate = new Date();
        this.capabilities = new Set();
        this.config = config;
        this.initializeCapabilities();
    }
    // ============================================================================
    // Public Interface Methods
    // ============================================================================
    /**
     * Get bridge information
     */
    getBridgeInfo() {
        return {
            serverId: this.config.serverId,
            coreType: this.config.coreType,
            coreName: this.config.coreName,
            coreVersion: this.config.coreVersion,
            capabilities: Array.from(this.capabilities),
            protocolVersion: '2.0',
            isOnline: this.isConnected,
            lastUpdate: this.lastUpdate
        };
    }
    /**
     * Check if a specific capability is supported
     */
    hasCapability(capability) {
        return this.capabilities.has(capability);
    }
    /**
     * Get all supported capabilities
     */
    getCapabilities() {
        return Array.from(this.capabilities);
    }
    /**
     * Check if the bridge is connected
     */
    isConnectedToBridge() {
        return this.isConnected;
    }
    /**
     * Get the server ID
     */
    getServerId() {
        return this.config.serverId;
    }
    /**
     * Get the core type
     */
    getCoreType() {
        return this.config.coreType;
    }
    // ============================================================================
    // Command Execution Methods
    // ============================================================================
    /**
     * Execute a console command on the server
     */
    async executeCommand(command, timeout) {
        this.requireCapability('command_execution');
        try {
            const result = await this.doExecuteCommand(command, timeout);
            this.updateLastUpdate();
            return result;
        }
        catch (error) {
            throw new Error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // ============================================================================
    // Player Management Methods
    // ============================================================================
    /**
     * Perform an action on a player
     */
    async performPlayerAction(action) {
        this.requireCapability('player_management');
        try {
            const result = await this.doPlayerAction(action);
            this.emit('playerAction', result);
            return result;
        }
        catch (error) {
            const result = {
                success: false,
                action,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
            this.emit('playerActionError', result);
            return result;
        }
    }
    // ============================================================================
    // Command Execution Methods
    // ============================================================================
    /**
     * Get whitelist entries
     */
    async getWhitelist() {
        this.requireCapability('whitelist_management');
        return this.doGetWhitelist();
    }
    /**
     * Add player to whitelist
     */
    async addToWhitelist(playerId, playerName, reason) {
        this.requireCapability('whitelist_management');
        return this.doAddToWhitelist(playerId, playerName, reason);
    }
    /**
     * Remove player from whitelist
     */
    async removeFromWhitelist(playerId) {
        this.requireCapability('whitelist_management');
        return this.doRemoveFromWhitelist(playerId);
    }
    /**
     * Get ban list
     */
    async getBanList() {
        this.requireCapability('ban_management');
        return this.doGetBanList();
    }
    /**
     * Ban a player
     */
    async banPlayer(playerId, reason, duration) {
        this.requireCapability('ban_management');
        return this.doBanPlayer(playerId, reason, duration);
    }
    /**
     * Unban a player
     */
    async unbanPlayer(playerId) {
        this.requireCapability('ban_management');
        return this.doUnbanPlayer(playerId);
    }
    // ============================================================================
    // World Management Methods
    // ============================================================================
    /**
     * Perform a world operation
     */
    async performWorldOperation(operation) {
        this.requireCapability('world_management');
        try {
            const result = await this.doWorldOperation(operation);
            this.emit('worldOperation', result);
            return result;
        }
        catch (error) {
            const result = {
                success: false,
                operation,
                timestamp: new Date(),
                duration: 0,
                error: error instanceof Error ? error.message : String(error)
            };
            this.emit('worldOperationError', result);
            return result;
        }
    }
    /**
     * Get world settings
     */
    async getWorldSettings(worldName) {
        this.requireCapability('world_management');
        return this.doGetWorldSettings(worldName);
    }
    /**
     * Update world settings
     */
    async updateWorldSettings(settings, worldName) {
        this.requireCapability('world_management');
        return this.doUpdateWorldSettings(settings, worldName);
    }
    // ============================================================================
    // Server Control Methods
    // ============================================================================
    /**
     * Perform a server operation
     */
    async performServerOperation(operation) {
        this.requireCapability('server_control');
        try {
            const result = await this.doServerOperation(operation);
            this.emit('serverOperation', result);
            return result;
        }
        catch (error) {
            const result = {
                success: false,
                operation,
                timestamp: new Date(),
                duration: 0,
                error: error instanceof Error ? error.message : String(error)
            };
            this.emit('serverOperationError', result);
            return result;
        }
    }
    // ============================================================================
    // Plugin Integration Methods
    // ============================================================================
    /**
     * Get list of plugins
     */
    async getPlugins() {
        this.requireCapability('plugin_integration');
        return this.doGetPlugins();
    }
    /**
     * Perform a plugin operation
     */
    async performPluginOperation(operation) {
        this.requireCapability('plugin_integration');
        try {
            const result = await this.doPluginOperation(operation);
            this.emit('pluginOperation', result);
            return result;
        }
        catch (error) {
            const result = {
                success: false,
                operation,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
            this.emit('pluginOperationError', result);
            return result;
        }
    }
    // ============================================================================
    // Protected Methods - To be implemented by subclasses
    // ============================================================================
    async doExecuteCommand(_command, _timeout) {
        throw new types_1.UnsupportedOperationError('executeCommand', this.config.serverId, this.config.coreType);
    }
    async doPlayerAction(_action) {
        throw new types_1.UnsupportedOperationError('playerAction', this.config.serverId, this.config.coreType);
    }
    async doGetWhitelist() {
        throw new types_1.UnsupportedOperationError('getWhitelist', this.config.serverId, this.config.coreType);
    }
    async doAddToWhitelist(_playerId, _playerName, _reason) {
        throw new types_1.UnsupportedOperationError('addToWhitelist', this.config.serverId, this.config.coreType);
    }
    async doRemoveFromWhitelist(_playerId) {
        throw new types_1.UnsupportedOperationError('removeFromWhitelist', this.config.serverId, this.config.coreType);
    }
    async doGetBanList() {
        throw new types_1.UnsupportedOperationError('getBanList', this.config.serverId, this.config.coreType);
    }
    async doBanPlayer(_playerId, _reason, _duration) {
        throw new types_1.UnsupportedOperationError('banPlayer', this.config.serverId, this.config.coreType);
    }
    async doUnbanPlayer(_playerId) {
        throw new types_1.UnsupportedOperationError('unbanPlayer', this.config.serverId, this.config.coreType);
    }
    async doWorldOperation(_operation) {
        throw new types_1.UnsupportedOperationError('worldOperation', this.config.serverId, this.config.coreType);
    }
    async doGetWorldSettings(_worldName) {
        throw new types_1.UnsupportedOperationError('getWorldSettings', this.config.serverId, this.config.coreType);
    }
    async doUpdateWorldSettings(_settings, _worldName) {
        throw new types_1.UnsupportedOperationError('updateWorldSettings', this.config.serverId, this.config.coreType);
    }
    async doServerOperation(_operation) {
        throw new types_1.UnsupportedOperationError('serverOperation', this.config.serverId, this.config.coreType);
    }
    async doGetPlugins() {
        throw new types_1.UnsupportedOperationError('getPlugins', this.config.serverId, this.config.coreType);
    }
    async doPluginOperation(_operation) {
        throw new types_1.UnsupportedOperationError('pluginOperation', this.config.serverId, this.config.coreType);
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Require a specific capability or throw an error
     */
    requireCapability(capability) {
        if (!this.hasCapability(capability)) {
            throw new types_1.UnsupportedOperationError(capability, this.config.serverId, this.config.coreType);
        }
    }
    /**
     * Update the last update timestamp
     */
    updateLastUpdate() {
        this.lastUpdate = new Date();
    }
    /**
     * Set connection status
     */
    setConnected(connected) {
        const wasConnected = this.isConnected;
        this.isConnected = connected;
        if (wasConnected !== connected) {
            this.emit(connected ? 'connected' : 'disconnected');
        }
        this.updateLastUpdate();
    }
    /**
     * Add a capability
     */
    addCapability(capability) {
        this.capabilities.add(capability);
    }
    /**
     * Remove a capability
     */
    removeCapability(capability) {
        this.capabilities.delete(capability);
    }
    /**
     * Emit a bridge event
     */
    emitBridgeEvent(event) {
        this.emit('bridgeEvent', event);
        this.emit(`bridgeEvent:${event.type}`, event);
    }
    /**
     * Create a bridge event
     */
    createBridgeEvent(type, data, source = 'bridge') {
        return {
            type,
            serverId: this.config.serverId,
            timestamp: new Date(),
            data,
            source
        };
    }
}
exports.BaseConnectorBridge = BaseConnectorBridge;
