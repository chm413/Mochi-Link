"use strict";
/**
 * WebSocket Connection Manager
 *
 * Central manager for WebSocket connections, handling both server and client
 * modes, connection lifecycle, authentication, and heartbeat management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketConnectionManager = void 0;
const events_1 = require("events");
const server_1 = require("./server");
const client_1 = require("./client");
const auth_1 = require("./auth");
const heartbeat_1 = require("./heartbeat");
const handler_1 = require("../protocol/handler");
const connection_security_1 = require("../services/connection-security");
const types_1 = require("../types");
// ============================================================================
// WebSocket Connection Manager
// ============================================================================
class WebSocketConnectionManager extends events_1.EventEmitter {
    constructor(tokenManager, config = {}, auditService // Add audit service parameter
    ) {
        super();
        // Connection registry
        this.connections = new Map();
        this.clients = new Map();
        // State
        this.isRunning = false;
        this.config = {
            server: config.server,
            maxConnections: 100,
            connectionTimeout: 30000,
            autoReconnect: true,
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            authenticationRequired: true,
            encryptionEnabled: false,
            heartbeat: {},
            connectionSecurity: {},
            ...config
        };
        // Initialize managers
        this.authManager = new auth_1.AuthenticationManager(tokenManager);
        this.heartbeatManager = new heartbeat_1.HeartbeatManager(this.config.heartbeat);
        this.protocolHandler = config.protocolHandler || new handler_1.ProtocolHandler();
        // Initialize connection security manager if audit service is provided
        if (auditService) {
            this.connectionSecurityManager = new connection_security_1.ConnectionSecurityManager({}, // Context will be provided by the calling service
            auditService, this.config.connectionSecurity);
            this.setupConnectionSecurityHandlers();
        }
        this.setupManagerHandlers();
    }
    // ============================================================================
    // Lifecycle Management
    // ============================================================================
    /**
     * Start the connection manager
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Connection manager is already running');
        }
        try {
            // Start server if configured
            if (this.config.server) {
                this.server = new server_1.MochiWebSocketServer(this.authManager, this.config.server);
                this.setupServerHandlers();
                await this.server.start();
            }
            this.isRunning = true;
            this.emit('started');
        }
        catch (error) {
            throw new types_1.ConnectionError(`Failed to start connection manager: ${error instanceof Error ? error.message : String(error)}`, 'manager');
        }
    }
    /**
     * Stop the connection manager
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        try {
            // Disconnect all clients
            const disconnectPromises = Array.from(this.clients.values()).map(client => client.disconnect('Manager shutting down'));
            await Promise.allSettled(disconnectPromises);
            // Stop server
            if (this.server) {
                await this.server.stop();
            }
            // Shutdown managers
            this.heartbeatManager.shutdown();
            this.authManager.shutdown();
            if (this.connectionSecurityManager) {
                this.connectionSecurityManager.shutdown();
            }
            // Clear state
            this.connections.clear();
            this.clients.clear();
            this.isRunning = false;
            this.emit('stopped');
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    /**
     * Check if manager is running
     */
    isActive() {
        return this.isRunning;
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    /**
     * Connect to a server (forward connection mode)
     */
    async connectToServer(serverConfig) {
        if (!this.isRunning) {
            throw new types_1.ConnectionError('Connection manager is not running', serverConfig.id);
        }
        // Check if already connected
        if (this.connections.has(serverConfig.id)) {
            throw new types_1.ConnectionError('Server already connected', serverConfig.id);
        }
        // Check connection security limits if enabled
        if (this.connectionSecurityManager) {
            const securityCheck = this.connectionSecurityManager.checkConnectionAllowed(serverConfig.id, 'localhost', // For client connections, we use localhost
            'MochiLink-Client');
            if (!securityCheck.allowed) {
                throw new types_1.ConnectionError(securityCheck.reason || 'Connection not allowed by security policy', serverConfig.id);
            }
        }
        // Check connection limits
        if (this.connections.size >= (this.config.maxConnections || 100)) {
            throw new types_1.ConnectionError('Maximum connections reached', serverConfig.id);
        }
        try {
            // Create client configuration
            const clientConfig = {
                url: this.buildWebSocketURL(serverConfig),
                serverId: serverConfig.id,
                authToken: await this.getAuthToken(serverConfig.id),
                autoReconnect: this.config.autoReconnect,
                reconnectInterval: this.config.reconnectInterval,
                maxReconnectAttempts: this.config.maxReconnectAttempts,
                connectionTimeout: this.config.connectionTimeout
            };
            // Create and configure client
            const client = new client_1.MochiWebSocketClient(this.authManager, clientConfig);
            this.setupClientHandlers(client, serverConfig);
            // Store client
            this.clients.set(serverConfig.id, client);
            // Connect
            await client.connect();
            const connection = client.getConnection();
            if (!connection) {
                throw new types_1.ConnectionError('Failed to establish connection', serverConfig.id);
            }
            // Register connection
            this.registerConnection(connection, 'client', serverConfig);
            return connection;
        }
        catch (error) {
            // Clean up on failure
            this.clients.delete(serverConfig.id);
            throw error;
        }
    }
    /**
     * Disconnect from a server
     */
    async disconnectFromServer(serverId, reason = 'Manual disconnect') {
        const client = this.clients.get(serverId);
        if (client) {
            await client.disconnect(reason);
            this.clients.delete(serverId);
        }
        this.unregisterConnection(serverId);
    }
    /**
     * Get connection by server ID
     */
    getConnection(serverId) {
        return this.connections.get(serverId)?.connection;
    }
    /**
     * Get all active connections
     */
    getConnections() {
        return Array.from(this.connections.values()).map(entry => entry.connection);
    }
    /**
     * Get connections by filter
     */
    getConnectionsByFilter(filter) {
        return Array.from(this.connections.values())
            .filter(filter)
            .map(entry => entry.connection);
    }
    // ============================================================================
    // Message Handling
    // ============================================================================
    /**
     * Send message to specific server
     */
    async sendMessage(serverId, message) {
        const connection = this.getConnection(serverId);
        if (!connection) {
            throw new types_1.ConnectionError('Server not connected', serverId);
        }
        await this.protocolHandler.sendMessage(connection, message);
    }
    /**
     * Broadcast message to all connected servers
     */
    async broadcastMessage(message, filter) {
        const connections = this.getConnections().filter(conn => !filter || filter(conn));
        const promises = connections.map(connection => this.protocolHandler.sendMessage(connection, message).catch(error => {
            this.emit('broadcastError', error, connection.serverId);
        }));
        await Promise.allSettled(promises);
    }
    /**
     * Send request and wait for response
     */
    async sendRequest(serverId, operation, data = {}, options = {}) {
        const connection = this.getConnection(serverId);
        if (!connection) {
            throw new types_1.ConnectionError('Server not connected', serverId);
        }
        return await this.protocolHandler.sendRequest(connection, operation, data, {
            ...options,
            serverId
        });
    }
    // ============================================================================
    // Statistics and Monitoring
    // ============================================================================
    /**
     * Get connection statistics
     */
    getStats() {
        const entries = Array.from(this.connections.values());
        const serverConnections = entries.filter(e => e.mode === 'server').length;
        const clientConnections = entries.filter(e => e.mode === 'client').length;
        const authenticatedConnections = entries.filter(e => e.authenticated).length;
        return {
            isRunning: this.isRunning,
            totalConnections: this.connections.size,
            serverConnections,
            clientConnections,
            authenticatedConnections,
            serverStats: this.server?.getStats(),
            heartbeatStats: this.heartbeatManager.getOverallStats(),
            protocolStats: this.protocolHandler.getStats(),
            connectionSecurityStats: this.connectionSecurityManager?.getStats()
        };
    }
    /**
     * Get connection info for debugging
     */
    getConnectionInfo(serverId) {
        const entry = this.connections.get(serverId);
        if (!entry) {
            return null;
        }
        return {
            serverId,
            mode: entry.mode,
            connectedAt: entry.connectedAt,
            lastActivity: entry.lastActivity,
            authenticated: entry.authenticated,
            capabilities: entry.capabilities,
            connectionStats: entry.connection.getStats(),
            heartbeatStats: this.heartbeatManager.getStats(serverId)
        };
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    setupManagerHandlers() {
        // Heartbeat manager events
        this.heartbeatManager.on('heartbeatFailure', (serverId) => {
            this.emit('connectionLost', serverId, 'Heartbeat failure');
        });
        this.heartbeatManager.on('reconnectRequired', (serverId, reason) => {
            this.handleReconnectionRequired(serverId, reason);
        });
        // Authentication manager events
        this.authManager.on('authenticationSuccess', (serverId, token) => {
            this.emit('authenticated', serverId, token);
            // Record authentication success in security manager
            if (this.connectionSecurityManager) {
                this.connectionSecurityManager.recordAuthenticationSuccess(serverId, serverId, 'localhost' // For now, we'll use localhost
                );
                this.connectionSecurityManager.markConnectionAuthenticated(serverId);
            }
        });
        this.authManager.on('authenticationError', (serverId, error) => {
            this.emit('authenticationFailed', serverId, error);
            // Record authentication failure in security manager
            if (this.connectionSecurityManager) {
                this.connectionSecurityManager.recordAuthenticationFailure(serverId, serverId, 'localhost', // For now, we'll use localhost
                error instanceof Error ? error.message : String(error));
            }
        });
    }
    setupConnectionSecurityHandlers() {
        if (!this.connectionSecurityManager) {
            return;
        }
        this.connectionSecurityManager.on('securityAlert', (alert) => {
            this.emit('securityAlert', alert);
        });
        this.connectionSecurityManager.on('connectionRegistered', (connectionInfo) => {
            this.emit('connectionSecurityRegistered', connectionInfo);
        });
        this.connectionSecurityManager.on('connectionUnregistered', (connectionInfo) => {
            this.emit('connectionSecurityUnregistered', connectionInfo);
        });
        this.connectionSecurityManager.on('authenticationFailure', (event) => {
            this.emit('authenticationSecurityFailure', event);
        });
        this.connectionSecurityManager.on('authenticationSuccess', (event) => {
            this.emit('authenticationSecuritySuccess', event);
        });
    }
    setupServerHandlers() {
        if (!this.server)
            return;
        this.server.on('connection', (connection) => {
            this.registerConnection(connection, 'server');
        });
        this.server.on('disconnection', (connection) => {
            this.unregisterConnection(connection.serverId);
        });
        this.server.on('message', (message, connection) => {
            this.handleIncomingMessage(message, connection);
        });
        this.server.on('authenticated', (connection) => {
            const entry = this.connections.get(connection.serverId);
            if (entry) {
                entry.authenticated = true;
            }
        });
        this.server.on('error', (error) => {
            this.emit('error', error);
        });
    }
    setupClientHandlers(client, serverConfig) {
        client.on('connected', (connection) => {
            this.registerConnection(connection, 'client', serverConfig);
        });
        client.on('disconnected', () => {
            this.unregisterConnection(serverConfig.id);
        });
        client.on('message', (message) => {
            const connection = this.getConnection(serverConfig.id);
            if (connection) {
                this.handleIncomingMessage(message, connection);
            }
        });
        client.on('authenticated', () => {
            const entry = this.connections.get(serverConfig.id);
            if (entry) {
                entry.authenticated = true;
            }
        });
        client.on('error', (error) => {
            this.emit('connectionError', error, serverConfig.id);
        });
        client.on('reconnecting', (attempt, interval) => {
            this.emit('reconnecting', serverConfig.id, attempt, interval);
        });
    }
    registerConnection(connection, mode, config) {
        const entry = {
            connection,
            mode,
            config: config || {
                id: connection.serverId,
                name: connection.serverId,
                coreType: 'Java',
                coreName: 'Unknown',
                coreVersion: 'Unknown',
                connectionMode: connection.mode,
                connectionConfig: {},
                status: 'online',
                ownerId: 'unknown',
                tags: [],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            connectedAt: new Date(),
            lastActivity: new Date(),
            authenticated: false,
            capabilities: []
        };
        this.connections.set(connection.serverId, entry);
        // Register with connection security manager if available
        if (this.connectionSecurityManager) {
            this.connectionSecurityManager.registerConnection(connection.serverId, connection.serverId, 'localhost', // For now, we'll use localhost for all connections
            'MochiLink-Connection');
        }
        // Start heartbeat
        this.heartbeatManager.startHeartbeat(connection);
        // Set up connection handlers
        connection.on('message', () => {
            entry.lastActivity = new Date();
            // Update connection activity in security manager
            if (this.connectionSecurityManager) {
                this.connectionSecurityManager.updateConnectionActivity(connection.serverId);
            }
        });
        connection.on('capabilitiesUpdated', (capabilities) => {
            entry.capabilities = capabilities;
        });
        this.emit('connectionRegistered', connection.serverId, mode);
    }
    unregisterConnection(serverId) {
        const entry = this.connections.get(serverId);
        if (!entry) {
            return;
        }
        // Stop heartbeat
        this.heartbeatManager.stopHeartbeat(serverId);
        // Unregister from connection security manager if available
        if (this.connectionSecurityManager) {
            this.connectionSecurityManager.unregisterConnection(serverId);
        }
        // Remove from registry
        this.connections.delete(serverId);
        this.emit('connectionUnregistered', serverId, entry.mode);
    }
    async handleIncomingMessage(message, connection) {
        try {
            // Update last activity
            const entry = this.connections.get(connection.serverId);
            if (entry) {
                entry.lastActivity = new Date();
            }
            // Handle through protocol handler
            await this.protocolHandler.handleMessage(connection, JSON.stringify(message));
            this.emit('message', message, connection.serverId);
        }
        catch (error) {
            this.emit('messageError', error, connection.serverId);
        }
    }
    async handleReconnectionRequired(serverId, reason) {
        const client = this.clients.get(serverId);
        if (client && this.config.autoReconnect) {
            try {
                await client.reconnect();
            }
            catch (error) {
                this.emit('reconnectionFailed', serverId, error);
            }
        }
    }
    buildWebSocketURL(serverConfig) {
        const config = serverConfig.connectionConfig.plugin;
        if (!config) {
            throw new types_1.ConnectionError('Plugin connection config not found', serverConfig.id);
        }
        const protocol = config.ssl ? 'wss' : 'ws';
        const path = config.path || '/ws';
        return `${protocol}://${config.host}:${config.port}${path}?serverId=${serverConfig.id}`;
    }
    async getAuthToken(serverId) {
        // This would typically fetch the token from the database
        // For now, we'll emit an event to request the token
        return new Promise((resolve) => {
            this.emit('tokenRequested', serverId, resolve);
        });
    }
}
exports.WebSocketConnectionManager = WebSocketConnectionManager;
