"use strict";
/**
 * WebSocket Server Implementation
 *
 * Implements WebSocket server for reverse connection mode where
 * Connector_Bridge connects to Koishi plugin as WebSocket clients.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MochiWebSocketServer = void 0;
const ws_1 = require("ws");
const events_1 = require("events");
const connection_1 = require("./connection");
const types_1 = require("../types");
// ============================================================================
// WebSocket Server Implementation
// ============================================================================
class MochiWebSocketServer extends events_1.EventEmitter {
    constructor(authManager, config) {
        super();
        this.connections = new Map();
        this.isRunning = false;
        this.authManager = authManager;
        this.config = {
            host: '0.0.0.0',
            path: '/ws',
            ssl: config.ssl,
            maxConnections: 100,
            connectionTimeout: 30000,
            authenticationRequired: true,
            authenticationTimeout: 10000,
            heartbeatInterval: 30000,
            heartbeatTimeout: 5000,
            maxMessageSize: 1024 * 1024, // 1MB
            messageRateLimit: {
                windowMs: 60000, // 1 minute
                maxMessages: 100
            },
            ...config
        };
        this.server = new ws_1.WebSocketServer({
            port: this.config.port,
            host: this.config.host,
            path: this.config.path,
            maxPayload: this.config.maxMessageSize,
            perMessageDeflate: true,
            clientTracking: true
        });
        this.setupServerHandlers();
    }
    // ============================================================================
    // Server Lifecycle
    // ============================================================================
    /**
     * Start the WebSocket server
     */
    async start() {
        if (this.isRunning) {
            throw new Error('WebSocket server is already running');
        }
        return new Promise((resolve, reject) => {
            this.server.once('listening', () => {
                this.isRunning = true;
                this.emit('started', {
                    port: this.config.port,
                    host: this.config.host,
                    path: this.config.path
                });
                resolve();
            });
            this.server.once('error', (error) => {
                reject(new types_1.ConnectionError(`Failed to start WebSocket server: ${error.message}`, 'server'));
            });
        });
    }
    /**
     * Stop the WebSocket server
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        // Close all connections
        const closePromises = Array.from(this.connections.values()).map(info => info.connection.close(1001, 'Server shutting down'));
        await Promise.allSettled(closePromises);
        // Close server
        return new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                this.connections.clear();
                this.emit('stopped');
                resolve();
            });
        });
    }
    /**
     * Check if server is running
     */
    isListening() {
        return this.isRunning;
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    /**
     * Get all active connections
     */
    getConnections() {
        return Array.from(this.connections.values()).map(info => info.connection);
    }
    /**
     * Get connection by server ID
     */
    getConnection(serverId) {
        return this.connections.get(serverId)?.connection;
    }
    /**
     * Get connection count
     */
    getConnectionCount() {
        return this.connections.size;
    }
    /**
     * Get server statistics
     */
    getStats() {
        const authenticatedCount = Array.from(this.connections.values())
            .filter(info => info.authenticated).length;
        return {
            isRunning: this.isRunning,
            connectionCount: this.connections.size,
            totalConnections: this.connections.size, // Could track historical total
            authenticatedConnections: authenticatedCount,
            config: this.config
        };
    }
    // ============================================================================
    // Broadcasting
    // ============================================================================
    /**
     * Broadcast message to all authenticated connections
     */
    async broadcast(message, filter) {
        const connections = Array.from(this.connections.values())
            .filter(info => info.authenticated)
            .map(info => info.connection)
            .filter(conn => !filter || filter(conn));
        const promises = connections.map(connection => connection.send(message).catch(error => {
            this.emit('broadcastError', error, connection.serverId);
        }));
        await Promise.allSettled(promises);
    }
    /**
     * Broadcast to specific server IDs
     */
    async broadcastToServers(message, serverIds) {
        const promises = serverIds.map(serverId => {
            const info = this.connections.get(serverId);
            if (info && info.authenticated) {
                return info.connection.send(message).catch(error => {
                    this.emit('broadcastError', error, serverId);
                });
            }
            return Promise.resolve();
        });
        await Promise.allSettled(promises);
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    setupServerHandlers() {
        this.server.on('connection', (ws, request) => {
            this.handleNewConnection(ws, request);
        });
        this.server.on('error', (error) => {
            this.emit('error', new types_1.ConnectionError(`WebSocket server error: ${error.message}`, 'server'));
        });
        this.server.on('close', () => {
            this.isRunning = false;
            this.emit('stopped');
        });
    }
    async handleNewConnection(ws, request) {
        // Check connection limits
        if (this.connections.size >= (this.config.maxConnections || 100)) {
            ws.close(1013, 'Server at capacity');
            return;
        }
        // Extract server ID and token from query parameters or headers
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const serverId = url.searchParams.get('serverId') ||
            request.headers['x-server-id'] ||
            `unknown-${Date.now()}`;
        const token = url.searchParams.get('token') ||
            request.headers['x-auth-token'];
        // Check if server is already connected
        if (this.connections.has(serverId)) {
            ws.close(1008, 'Server already connected');
            return;
        }
        try {
            // Create connection wrapper
            const connection = new connection_1.WebSocketConnection(ws, serverId, 'plugin');
            // Set up connection info
            const connectionInfo = {
                connection,
                connectedAt: new Date(),
                lastActivity: new Date(),
                messageCount: 0,
                authenticated: false
            };
            this.connections.set(serverId, connectionInfo);
            // Set up connection event handlers
            this.setupConnectionHandlers(connection, connectionInfo);
            // Start authentication process if required
            if (this.config.authenticationRequired) {
                // If token is provided in connection, validate it immediately
                if (token) {
                    const result = await this.authManager.authenticateWithToken(serverId, token, request.socket.remoteAddress);
                    if (result.success) {
                        connectionInfo.authenticated = true;
                        connection.setAuthenticated(true);
                        this.emit('authenticated', connection);
                    }
                    else {
                        ws.close(1008, result.error || 'Authentication failed');
                        this.connections.delete(serverId);
                        return;
                    }
                }
                else {
                    // No token provided, initiate challenge-response authentication
                    await this.initiateAuthentication(connection);
                }
            }
            else {
                connectionInfo.authenticated = true;
                connection.setAuthenticated(true);
            }
            this.emit('connection', connection);
        }
        catch (error) {
            ws.close(1011, 'Connection setup failed');
            this.connections.delete(serverId);
            this.emit('connectionError', error, serverId);
        }
    }
    setupConnectionHandlers(connection, info) {
        connection.on('message', (message) => {
            info.lastActivity = new Date();
            info.messageCount++;
            this.emit('message', message, connection);
        });
        connection.on('disconnected', (code, reason) => {
            this.connections.delete(connection.serverId);
            this.emit('disconnection', connection, code, reason);
        });
        connection.on('error', (error) => {
            this.emit('connectionError', error, connection.serverId);
        });
        connection.on('authenticated', () => {
            info.authenticated = true;
            this.emit('authenticated', connection);
        });
        // Set up connection timeout
        const timeout = setTimeout(() => {
            if (!info.authenticated) {
                connection.close(1002, 'Authentication timeout');
            }
        }, this.config.authenticationTimeout);
        connection.once('authenticated', () => {
            clearTimeout(timeout);
        });
        connection.once('disconnected', () => {
            clearTimeout(timeout);
        });
    }
    async initiateAuthentication(connection) {
        try {
            // Send authentication challenge
            const challengeMessage = {
                type: 'system',
                id: `auth-challenge-${Date.now()}`,
                op: 'handshake',
                data: {
                    protocolVersion: '2.0',
                    serverType: 'koishi',
                    authenticationRequired: true,
                    challenge: await this.authManager.generateChallenge(connection.serverId)
                },
                timestamp: Date.now(),
                serverId: connection.serverId,
                version: '2.0',
                systemOp: 'handshake'
            };
            await connection.send(challengeMessage);
        }
        catch (error) {
            throw new types_1.AuthenticationError(`Failed to initiate authentication: ${error instanceof Error ? error.message : String(error)}`, connection.serverId);
        }
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Get connection info for debugging
     */
    getConnectionInfo(serverId) {
        return this.connections.get(serverId);
    }
    /**
     * Force disconnect a connection
     */
    async disconnectServer(serverId, reason = 'Forced disconnect') {
        const info = this.connections.get(serverId);
        if (info) {
            await info.connection.close(1000, reason);
        }
    }
    /**
     * Get server address info
     */
    getAddressInfo() {
        if (!this.isRunning) {
            return null;
        }
        return {
            port: this.config.port,
            host: this.config.host || '0.0.0.0',
            path: this.config.path || '/ws'
        };
    }
}
exports.MochiWebSocketServer = MochiWebSocketServer;
