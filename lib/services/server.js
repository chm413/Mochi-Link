"use strict";
/**
 * Mochi-Link (大福连) - Server Configuration Management Service
 *
 * This service handles server registration, configuration management,
 * status tracking, and multi-server concurrent management.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerManager = void 0;
const types_1 = require("../types");
const manager_1 = require("../connection/manager");
// ============================================================================
// Server Manager Service
// ============================================================================
class ServerManager {
    constructor(ctx, db, audit, permission, token, pluginIntegration) {
        this.ctx = ctx;
        this.db = db;
        this.audit = audit;
        this.permission = permission;
        this.token = token;
        this.pluginIntegration = pluginIntegration;
        this.connections = new Map();
        this.bridges = new Map();
        this.statusCache = new Map();
        this.reconnectTimers = new Map();
        this.connectionManager = new manager_1.ConnectionModeManager(ctx, {
            autoSwitchOnFailure: true,
            preferredModeOrder: ['plugin', 'rcon', 'terminal'],
            maxRetryAttempts: 3,
            healthCheckInterval: 30000
        });
        this.setupConnectionManagerHandlers();
    }
    // ============================================================================
    // Server Registration and CRUD Operations
    // ============================================================================
    /**
     * Register a new server
     */
    async registerServer(options, operatorId, ipAddress) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Generate unique server ID
            const serverId = this.generateServerId(options.name, options.coreType);
            // Validate connection configuration
            this.validateConnectionConfig(options.connectionMode, options.connectionConfig);
            // Create server configuration
            const serverConfig = {
                id: serverId,
                name: options.name,
                coreType: options.coreType,
                coreName: options.coreName,
                coreVersion: options.coreVersion,
                connectionMode: options.connectionMode,
                connectionConfig: options.connectionConfig,
                status: 'offline',
                ownerId: options.ownerId,
                tags: options.tags || []
            };
            // Check if server ID already exists
            const existing = await this.db.servers.getServer(serverId);
            if (existing) {
                throw new types_1.MochiLinkError(`Server with ID ${serverId} already exists`, 'SERVER_EXISTS', { serverId });
            }
            // Create server in database
            const created = await this.db.servers.createServer(serverConfig);
            // Generate API token for the server
            await this.token.generateToken({
                serverId,
                expiresIn: 365 * 24 * 60 * 60, // 1 year
                ipWhitelist: this.extractIPFromConnectionConfig(options.connectionConfig)
            }, operatorId);
            // Grant owner permissions
            await this.permission.assignRole(options.ownerId, serverId, 'owner', operatorId);
            // Log the registration
            await this.audit.logger.logSuccess('server.register', {
                serverId,
                serverName: options.name,
                coreType: options.coreType,
                connectionMode: options.connectionMode
            }, { userId: operatorId, ipAddress });
            // Initialize status cache
            this.statusCache.set(serverId, {
                serverId,
                status: 'offline',
                connectionMode: options.connectionMode
            });
            // Auto-connect if requested
            if (options.autoConnect) {
                this.scheduleConnection(serverId, 1000); // Connect after 1 second
            }
            logger.info(`Server ${serverId} registered successfully`);
            return created;
        }
        catch (error) {
            await this.audit.logger.logError('server.register', { serverName: options.name }, error instanceof Error ? error : new Error(String(error)), { userId: operatorId, ipAddress });
            throw error;
        }
    }
    /**
     * Get server configuration by ID
     */
    async getServer(serverId) {
        return await this.db.servers.getServer(serverId);
    }
    /**
     * Get all servers
     */
    async getAllServers() {
        return await this.db.servers.getAllServers();
    }
    /**
     * Get servers by owner
     */
    async getServersByOwner(ownerId) {
        return await this.db.servers.getServersByOwner(ownerId);
    }
    /**
     * Get server summaries (lightweight view)
     */
    async getServerSummaries(userId) {
        let servers;
        if (userId) {
            // Get servers the user has access to
            const userACLs = await this.db.acl.getUserACLs(userId);
            const serverIds = userACLs.map(acl => acl.serverId);
            if (serverIds.length === 0) {
                return [];
            }
            const allServers = await this.getAllServers();
            servers = allServers.filter(server => serverIds.includes(server.id));
        }
        else {
            servers = await this.getAllServers();
        }
        return servers.map(server => {
            const statusInfo = this.statusCache.get(server.id);
            return {
                id: server.id,
                name: server.name,
                coreType: server.coreType,
                coreName: server.coreName,
                status: server.status,
                ownerId: server.ownerId,
                tags: server.tags,
                lastSeen: server.lastSeen,
                playerCount: statusInfo?.playerCount
            };
        });
    }
    /**
     * Update server configuration
     */
    async updateServer(serverId, updates, operatorId, ipAddress) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Check if server exists
            const existing = await this.getServer(serverId);
            if (!existing) {
                throw new types_1.MochiLinkError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND', { serverId });
            }
            // Check permissions
            const hasPermission = await this.permission.checkPermission(operatorId, serverId, 'server.update');
            if (!hasPermission.granted) {
                throw new types_1.MochiLinkError(`User ${operatorId} lacks permission to update server ${serverId}`, 'PERMISSION_DENIED', { userId: operatorId, serverId, operation: 'server.update' });
            }
            // Validate connection configuration if being updated
            if (updates.connectionMode && updates.connectionConfig) {
                this.validateConnectionConfig(updates.connectionMode, updates.connectionConfig);
            }
            // Update server in database
            const updated = await this.db.servers.updateServer(serverId, updates);
            // If connection configuration changed, disconnect and reconnect
            if (updates.connectionMode || updates.connectionConfig) {
                await this.disconnectServer(serverId);
                this.scheduleConnection(serverId, 2000); // Reconnect after 2 seconds
            }
            // Log the update
            await this.audit.logger.logSuccess('server.update', { serverId, ...updates }, { userId: operatorId, ipAddress });
            logger.info(`Server ${serverId} updated successfully`);
            return updated;
        }
        catch (error) {
            await this.audit.logger.logError('server.update', { serverId, ...updates }, error instanceof Error ? error : new Error(String(error)), { userId: operatorId, ipAddress });
            throw error;
        }
    }
    /**
     * Delete server
     */
    async deleteServer(serverId, operatorId, ipAddress) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Check if server exists
            const existing = await this.getServer(serverId);
            if (!existing) {
                throw new types_1.MochiLinkError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND', { serverId });
            }
            // Check permissions (only owner can delete)
            const hasPermission = await this.permission.checkPermission(operatorId, serverId, 'server.delete');
            if (!hasPermission.granted) {
                throw new types_1.MochiLinkError(`User ${operatorId} lacks permission to delete server ${serverId}`, 'PERMISSION_DENIED', { userId: operatorId, serverId, operation: 'server.delete' });
            }
            // Disconnect server if connected
            await this.disconnectServer(serverId);
            // Clean up resources
            this.statusCache.delete(serverId);
            this.clearReconnectTimer(serverId);
            // Delete from database (cascading deletes will handle related records)
            const deleted = await this.db.servers.deleteServer(serverId);
            if (deleted) {
                // Log the deletion
                await this.audit.logger.logSuccess('server.delete', { serverId, serverName: existing.name }, { userId: operatorId, ipAddress });
                logger.info(`Server ${serverId} deleted successfully`);
            }
            return deleted;
        }
        catch (error) {
            await this.audit.logger.logError('server.delete', { serverId }, error instanceof Error ? error : new Error(String(error)), { userId: operatorId, ipAddress });
            throw error;
        }
    }
    // ============================================================================
    // Server Status Tracking and Management
    // ============================================================================
    /**
     * Get server status information
     */
    getServerStatus(serverId) {
        return this.statusCache.get(serverId) || null;
    }
    /**
     * Get all server statuses
     */
    getAllServerStatuses() {
        return new Map(this.statusCache);
    }
    /**
     * Update server status
     */
    async updateServerStatus(serverId, status, additionalInfo) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Update database
            await this.db.servers.updateServerStatus(serverId, status, status === 'online' ? new Date() : undefined);
            // Update cache
            const currentInfo = this.statusCache.get(serverId);
            const updatedInfo = {
                serverId,
                status,
                connectionMode: currentInfo?.connectionMode || 'plugin',
                lastSeen: status === 'online' ? new Date() : currentInfo?.lastSeen,
                ...additionalInfo
            };
            this.statusCache.set(serverId, updatedInfo);
            logger.debug(`Server ${serverId} status updated to ${status}`);
        }
        catch (error) {
            logger.error(`Failed to update server ${serverId} status:`, error);
        }
    }
    /**
     * Check if server is online
     */
    isServerOnline(serverId) {
        const status = this.statusCache.get(serverId);
        return status?.status === 'online';
    }
    /**
     * Get online servers count
     */
    getOnlineServersCount() {
        return Array.from(this.statusCache.values())
            .filter(status => status.status === 'online').length;
    }
    // ============================================================================
    // Multi-Server Concurrent Management
    // ============================================================================
    /**
     * Execute operation on multiple servers concurrently
     */
    async executeOnMultipleServers(serverIds, operation, options = {}) {
        const { maxConcurrency = 5, continueOnError = true, timeout = 30000 } = options;
        const results = new Map();
        const semaphore = new Array(maxConcurrency).fill(null);
        let index = 0;
        const executeWithSemaphore = async () => {
            while (index < serverIds.length) {
                const currentIndex = index++;
                const serverId = serverIds[currentIndex];
                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Operation timeout')), timeout);
                    });
                    const result = await Promise.race([
                        operation(serverId),
                        timeoutPromise
                    ]);
                    results.set(serverId, { success: true, result });
                }
                catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));
                    results.set(serverId, { success: false, error: err });
                    if (!continueOnError) {
                        throw error;
                    }
                }
            }
        };
        // Execute operations with concurrency limit
        await Promise.all(semaphore.map(() => executeWithSemaphore()));
        return results;
    }
    /**
     * Broadcast command to multiple servers
     */
    async broadcastCommand(serverIds, command, operatorId, options = {}) {
        // Check permissions for all servers first
        const permissionChecks = await Promise.all(serverIds.map(async (serverId) => {
            const hasPermission = await this.permission.checkPermission(operatorId, serverId, 'server.command');
            return { serverId, hasPermission: hasPermission.granted };
        }));
        const unauthorizedServers = permissionChecks
            .filter(check => !check.hasPermission)
            .map(check => check.serverId);
        if (unauthorizedServers.length > 0) {
            throw new types_1.MochiLinkError(`User ${operatorId} lacks permission to execute commands on servers: ${unauthorizedServers.join(', ')}`, 'PERMISSION_DENIED', { userId: operatorId, serverIds: unauthorizedServers, operation: 'server.command' });
        }
        // Execute command on all authorized servers
        return await this.executeOnMultipleServers(serverIds, async (serverId) => {
            const result = await this.connectionManager.sendCommand(serverId, command);
            return {
                success: result.success,
                output: result.output
            };
        }, options);
    }
    /**
     * Get health status of all servers
     */
    async getSystemHealth() {
        const allStatuses = Array.from(this.statusCache.values());
        const totalServers = allStatuses.length;
        const onlineServers = allStatuses.filter(s => s.status === 'online').length;
        const offlineServers = allStatuses.filter(s => s.status === 'offline').length;
        const errorServers = allStatuses.filter(s => s.status === 'error').length;
        let overallStatus;
        if (errorServers > totalServers * 0.5) {
            overallStatus = 'unhealthy';
        }
        else if (errorServers > 0 || onlineServers < totalServers * 0.8) {
            overallStatus = 'degraded';
        }
        else {
            overallStatus = 'healthy';
        }
        return {
            status: overallStatus,
            totalServers,
            onlineServers,
            offlineServers,
            errorServers,
            details: allStatuses
        };
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    /**
     * Connect to a server
     */
    async connectServer(serverId) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            const server = await this.getServer(serverId);
            if (!server) {
                throw new types_1.MochiLinkError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND', { serverId });
            }
            // Clear any existing reconnect timer
            this.clearReconnectTimer(serverId);
            // Update status to connecting
            await this.updateServerStatus(serverId, 'offline'); // Will be updated to online when connection succeeds
            // Use connection manager to establish connection
            const adapter = await this.connectionManager.establishConnection(server);
            // Create a Connection wrapper for backward compatibility
            const connection = this.createConnectionWrapper(adapter);
            this.connections.set(serverId, connection);
            // Update status to online
            await this.updateServerStatus(serverId, 'online');
            logger.info(`Successfully connected to server ${serverId} via ${server.connectionMode}`);
        }
        catch (error) {
            logger.error(`Failed to connect to server ${serverId}:`, error);
            await this.updateServerStatus(serverId, 'error');
            throw error;
        }
    }
    /**
     * Disconnect from a server
     */
    async disconnectServer(serverId) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Disconnect via connection manager
            await this.connectionManager.disconnectServer(serverId);
            // Remove from connections map
            this.connections.delete(serverId);
            this.clearReconnectTimer(serverId);
            await this.updateServerStatus(serverId, 'offline');
            logger.info(`Disconnected from server ${serverId}`);
        }
        catch (error) {
            logger.error(`Error disconnecting from server ${serverId}:`, error);
        }
    }
    /**
     * Switch connection mode for a server
     */
    async switchConnectionMode(serverId, newMode, newConfig, operatorId, ipAddress) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Check if server exists
            const existing = await this.getServer(serverId);
            if (!existing) {
                throw new types_1.MochiLinkError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND', { serverId });
            }
            // Check permissions if operator provided
            if (operatorId) {
                const hasPermission = await this.permission.checkPermission(operatorId, serverId, 'server.connection.switch');
                if (!hasPermission.granted) {
                    throw new types_1.MochiLinkError(`User ${operatorId} lacks permission to switch connection mode for server ${serverId}`, 'PERMISSION_DENIED', { userId: operatorId, serverId, operation: 'server.connection.switch' });
                }
            }
            // Validate new configuration if provided
            if (newConfig) {
                this.validateConnectionConfig(newMode, newConfig);
            }
            // Switch connection mode via connection manager
            await this.connectionManager.switchConnectionMode(serverId, newMode, newConfig);
            // Update server configuration in database
            const updates = { connectionMode: newMode };
            if (newConfig) {
                updates.connectionConfig = { ...existing.connectionConfig, ...newConfig };
            }
            await this.db.servers.updateServer(serverId, updates);
            // Update status cache
            const statusInfo = this.statusCache.get(serverId);
            if (statusInfo) {
                statusInfo.connectionMode = newMode;
            }
            // Log the switch
            if (operatorId) {
                await this.audit.logger.logSuccess('server.connection.switch', { serverId, oldMode: existing.connectionMode, newMode }, { userId: operatorId, ipAddress });
            }
            logger.info(`Successfully switched server ${serverId} from ${existing.connectionMode} to ${newMode}`);
        }
        catch (error) {
            if (operatorId) {
                await this.audit.logger.logError('server.connection.switch', { serverId, newMode }, error instanceof Error ? error : new Error(String(error)), { userId: operatorId, ipAddress });
            }
            throw error;
        }
    }
    /**
     * Get connection information for a server
     */
    getConnectionInfo(serverId) {
        return this.connectionManager.getConnectionInfo(serverId);
    }
    /**
     * Get all connection information
     */
    getAllConnectionInfo() {
        return this.connectionManager.getAllConnectionInfo();
    }
    /**
     * Schedule connection attempt
     */
    scheduleConnection(serverId, delay) {
        this.clearReconnectTimer(serverId);
        const timer = setTimeout(async () => {
            try {
                await this.connectServer(serverId);
            }
            catch (error) {
                this.ctx.logger('mochi-link:server').error(`Scheduled connection to ${serverId} failed:`, error);
            }
        }, delay);
        this.reconnectTimers.set(serverId, timer);
    }
    /**
     * Clear reconnect timer for server
     */
    clearReconnectTimer(serverId) {
        const timer = this.reconnectTimers.get(serverId);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(serverId);
        }
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Generate unique server ID
     */
    generateServerId(name, coreType) {
        const sanitizedName = name.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        // Ensure we have a valid name part
        const namePart = sanitizedName || 'server';
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return `${coreType.toLowerCase()}-${namePart}-${timestamp}-${random}`;
    }
    /**
     * Validate connection configuration
     */
    validateConnectionConfig(mode, config) {
        switch (mode) {
            case 'plugin':
                if (!config.plugin) {
                    throw new types_1.MochiLinkError('Plugin connection configuration is required', 'INVALID_CONFIG', { mode, config });
                }
                if (!config.plugin.host || !config.plugin.port) {
                    throw new types_1.MochiLinkError('Plugin connection requires host and port', 'INVALID_CONFIG', { mode, config });
                }
                break;
            case 'rcon':
                if (!config.rcon) {
                    throw new types_1.MochiLinkError('RCON connection configuration is required', 'INVALID_CONFIG', { mode, config });
                }
                if (!config.rcon.host || !config.rcon.port || !config.rcon.password) {
                    throw new types_1.MochiLinkError('RCON connection requires host, port, and password', 'INVALID_CONFIG', { mode, config });
                }
                break;
            case 'terminal':
                if (!config.terminal) {
                    throw new types_1.MochiLinkError('Terminal connection configuration is required', 'INVALID_CONFIG', { mode, config });
                }
                if (!config.terminal.processId || !config.terminal.workingDir) {
                    throw new types_1.MochiLinkError('Terminal connection requires processId and workingDir', 'INVALID_CONFIG', { mode, config });
                }
                break;
            default:
                throw new types_1.MochiLinkError(`Unsupported connection mode: ${mode}`, 'INVALID_CONFIG', { mode });
        }
    }
    /**
     * Extract IP addresses from connection configuration for token whitelist
     */
    extractIPFromConnectionConfig(config) {
        const ips = [];
        if (config.plugin?.host && config.plugin.host !== 'localhost' && config.plugin.host !== '127.0.0.1') {
            ips.push(config.plugin.host);
        }
        if (config.rcon?.host && config.rcon.host !== 'localhost' && config.rcon.host !== '127.0.0.1') {
            ips.push(config.rcon.host);
        }
        return ips.length > 0 ? ips : undefined;
    }
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const dbHealthy = await this.db.healthCheck();
            const systemHealth = await this.getSystemHealth();
            const status = dbHealthy && systemHealth.status !== 'unhealthy'
                ? systemHealth.status
                : 'unhealthy';
            return {
                status,
                details: {
                    database: dbHealthy,
                    servers: systemHealth,
                    connections: this.connections.size,
                    statusCache: this.statusCache.size
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Cleanup connection manager
            await this.connectionManager.cleanup();
            // Clear all timers
            for (const timer of this.reconnectTimers.values()) {
                clearTimeout(timer);
            }
            this.reconnectTimers.clear();
            // Clear caches
            this.statusCache.clear();
            logger.info('Server manager cleanup completed');
        }
        catch (error) {
            logger.error('Server manager cleanup failed:', error);
        }
    }
    // ============================================================================
    // Connection Manager Integration
    // ============================================================================
    /**
     * Get bridge instance for a server
     */
    getBridge(serverId) {
        return this.bridges.get(serverId) || null;
    }
    /**
     * Create a bridge for a WebSocket connection
     */
    async createWebSocketBridge(serverId, connection) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Get server configuration
            const server = await this.getServer(serverId);
            if (!server) {
                throw new Error(`Server ${serverId} not found in database`);
            }
            // Import bridge classes
            const { JavaConnectorBridge } = await Promise.resolve().then(() => __importStar(require('../bridge/java')));
            // Create bridge based on core type
            let bridge;
            const bridgeConfig = {
                serverId: server.id,
                coreName: server.coreName,
                coreVersion: server.coreVersion,
                coreType: server.coreType
            };
            // Create a pending requests map for request-response pattern
            const pendingRequests = new Map();
            // Listen for responses from the server
            connection.on('message', (message) => {
                // Handle response messages (U-WBP v2 protocol)
                if (message.type === 'response' && message.id) {
                    const pending = pendingRequests.get(message.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        pendingRequests.delete(message.id);
                        if (message.data?.success === false || message.data?.error) {
                            pending.reject(new Error(message.data?.error || 'Request failed'));
                        }
                        else {
                            pending.resolve(message);
                        }
                    }
                }
            });
            // Create connection adapter for WebSocket
            const connectionAdapter = {
                sendCommand: async (command, timeout) => {
                    // Send command through WebSocket connection
                    try {
                        const requestId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        const requestTimeout = timeout || 30000;
                        // Create promise for response
                        const responsePromise = new Promise((resolve, reject) => {
                            const timeoutHandle = setTimeout(() => {
                                pendingRequests.delete(requestId);
                                reject(new Error('Command execution timeout'));
                            }, requestTimeout);
                            pendingRequests.set(requestId, {
                                resolve,
                                reject,
                                timeout: timeoutHandle
                            });
                        });
                        // Send command message (following U-WBP v2 protocol specification)
                        await connection.send({
                            type: 'request',
                            id: requestId,
                            op: 'command.execute',
                            data: {
                                command: command,
                                executor: 'console'
                            },
                            timestamp: Date.now(),
                            serverId: server.id,
                            version: '2.0'
                        });
                        // Wait for response
                        const response = await responsePromise;
                        return {
                            success: response.success !== false,
                            output: response.data?.output || [],
                            executionTime: response.data?.executionTime || 0,
                            error: response.error
                        };
                    }
                    catch (error) {
                        return {
                            success: false,
                            output: [],
                            executionTime: 0,
                            error: error instanceof Error ? error.message : String(error)
                        };
                    }
                },
                connect: async () => {
                    // Already connected via WebSocket
                },
                disconnect: async () => {
                    await connection.close();
                }
            };
            // Add isConnected as both property and method for compatibility
            Object.defineProperty(connectionAdapter, 'isConnected', {
                get: () => connection.isReady ? connection.isReady() : false,
                enumerable: true
            });
            // Create Java bridge (works for Folia, Paper, Spigot, etc.)
            bridge = new JavaConnectorBridge(bridgeConfig, connectionAdapter);
            // Mark bridge as connected since WebSocket is already authenticated
            await bridge.connect();
            // Store bridge
            this.bridges.set(serverId, bridge);
            logger.info(`WebSocket bridge created and connected for server ${serverId} (${server.coreType})`);
        }
        catch (error) {
            logger.error(`Failed to create WebSocket bridge for ${serverId}:`, error);
            throw error;
        }
    }
    /**
     * Remove bridge for a server
     */
    async removeBridge(serverId) {
        const logger = this.ctx.logger('mochi-link:server');
        try {
            // Remove bridge
            this.bridges.delete(serverId);
            logger.info(`Bridge removed for server ${serverId}`);
        }
        catch (error) {
            logger.error(`Failed to remove bridge for ${serverId}:`, error);
        }
    }
    /**
     * Set up plugin integration for a server bridge
     */
    async setupPluginIntegration(serverId, bridge) {
        if (!this.pluginIntegration) {
            return;
        }
        try {
            // Create plugin manager for this bridge
            const pluginManager = await this.pluginIntegration.createPluginManager(bridge);
            // Store the bridge for future reference
            this.bridges.set(serverId, bridge);
            const logger = this.ctx.logger('mochi-link:server');
            logger.info(`Plugin integration set up for server ${serverId}`);
            // Log plugin availability
            const availablePlugins = pluginManager.getAvailableIntegrations();
            if (availablePlugins.length > 0) {
                logger.info(`Available plugins for ${serverId}: ${availablePlugins.map((p) => p.name).join(', ')}`);
            }
        }
        catch (error) {
            const logger = this.ctx.logger('mochi-link:server');
            logger.error(`Failed to set up plugin integration for server ${serverId}:`, error);
        }
    }
    /**
     * Clean up plugin integration for a server
     */
    async cleanupPluginIntegration(serverId) {
        if (!this.pluginIntegration) {
            return;
        }
        try {
            await this.pluginIntegration.removePluginManager(serverId);
            this.bridges.delete(serverId);
            const logger = this.ctx.logger('mochi-link:server');
            logger.info(`Plugin integration cleaned up for server ${serverId}`);
        }
        catch (error) {
            const logger = this.ctx.logger('mochi-link:server');
            logger.error(`Failed to clean up plugin integration for server ${serverId}:`, error);
        }
    }
    /**
     * Create a bridge wrapper around a connection for backward compatibility
     */
    createBridgeWrapper(serverId, connection) {
        const server = this.statusCache.get(serverId);
        if (!server) {
            throw new types_1.MochiLinkError(`Server ${serverId} not found in status cache`, 'SERVER_NOT_FOUND', { serverId });
        }
        // Create a minimal bridge wrapper that delegates to the connection
        return {
            isConnectedToBridge: () => connection.status === 'connected',
            getServerId: () => serverId,
            getCoreType: () => 'Java', // Default, should be from server config
            async executeCommand(command, timeout) {
                if (connection.status !== 'connected') {
                    throw new types_1.ServerUnavailableError(`Server ${serverId} is not connected`, serverId);
                }
                try {
                    // Send command via connection
                    const message = {
                        type: 'request',
                        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        op: 'command.execute',
                        data: { command, timeout },
                        serverId,
                        timestamp: new Date().toISOString()
                    };
                    await connection.send(message);
                    // For now, return a mock result
                    // In a real implementation, this would wait for the response
                    return {
                        success: true,
                        output: [`Command executed: ${command}`],
                        executionTime: 100
                    };
                }
                catch (error) {
                    return {
                        success: false,
                        output: [],
                        executionTime: 0,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }
        };
    }
    /**
     * Setup connection manager event handlers
     */
    setupConnectionManagerHandlers() {
        // Connection lifecycle events
        this.connectionManager.on('connectionEstablished', (serverId, mode) => {
            this.updateServerStatus(serverId, 'online');
        });
        this.connectionManager.on('connectionClosed', (serverId) => {
            this.updateServerStatus(serverId, 'offline');
        });
        this.connectionManager.on('connectionFailed', (serverId, error) => {
            this.updateServerStatus(serverId, 'error');
        });
        this.connectionManager.on('connectionRestored', (serverId) => {
            this.updateServerStatus(serverId, 'online');
        });
        // Mode switching events
        this.connectionManager.on('connectionModeSwitched', (serverId, newMode) => {
            const statusInfo = this.statusCache.get(serverId);
            if (statusInfo) {
                statusInfo.connectionMode = newMode;
            }
        });
        // Health monitoring events
        this.connectionManager.on('healthCheckFailed', (serverId, error) => {
            this.ctx.logger('mochi-link:server').warn(`Health check failed for ${serverId}:`, error);
        });
        // Server events from connections
        this.connectionManager.on('serverEvent', (serverId, event) => {
            // Forward server events to other systems
            this.ctx.emit('server-event', serverId, event);
        });
        this.connectionManager.on('logLine', (serverId, logData) => {
            // Forward log lines to monitoring systems
            this.ctx.emit('server-log', serverId, logData);
        });
    }
    /**
     * Create a Connection wrapper for backward compatibility
     */
    createConnectionWrapper(adapter) {
        return {
            serverId: adapter.serverId,
            status: adapter.isConnected ? 'connected' : 'disconnected',
            mode: adapter.mode,
            capabilities: adapter.capabilities,
            async send(message) {
                await adapter.sendMessage(message);
            },
            async close() {
                await adapter.disconnect();
            }
        };
    }
}
exports.ServerManager = ServerManager;
// ============================================================================
// Export Types and Service
// ============================================================================
