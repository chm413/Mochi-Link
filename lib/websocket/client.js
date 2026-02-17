"use strict";
/**
 * WebSocket Client Implementation
 *
 * Implements WebSocket client for forward connection mode where
 * Koishi plugin connects to Connector_Bridge as WebSocket client.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MochiWebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const connection_1 = require("./connection");
const types_1 = require("../types");
// ============================================================================
// WebSocket Client Implementation
// ============================================================================
class MochiWebSocketClient extends events_1.EventEmitter {
    constructor(authManager, config) {
        super();
        this.isConnecting = false;
        this.isShuttingDown = false;
        this.authManager = authManager;
        this.config = {
            authMethod: 'token',
            authToken: '',
            connectionTimeout: 30000,
            authenticationTimeout: 10000,
            autoReconnect: true,
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            reconnectBackoffMultiplier: 1.5,
            maxReconnectInterval: 60000,
            heartbeatInterval: 30000,
            heartbeatTimeout: 5000,
            protocolVersion: '2.0',
            capabilities: [],
            headers: {},
            ssl: {
                rejectUnauthorized: true
            },
            ...config
        };
        this.reconnectionState = {
            attempts: 0,
            nextInterval: this.config.reconnectInterval || 5000,
            isReconnecting: false
        };
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    /**
     * Connect to WebSocket server
     */
    async connect() {
        if (this.isConnecting) {
            throw new types_1.ConnectionError('Connection already in progress', this.config.serverId);
        }
        if (this.connection && this.connection.isAlive()) {
            throw new types_1.ConnectionError('Already connected', this.config.serverId);
        }
        this.isConnecting = true;
        this.isShuttingDown = false;
        try {
            await this.establishConnection();
            this.resetReconnectionState();
            this.emit('connected', this.connection);
        }
        catch (error) {
            this.isConnecting = false;
            if (this.config.autoReconnect && !this.isShuttingDown) {
                this.scheduleReconnection(error);
            }
            throw error;
        }
        finally {
            this.isConnecting = false;
        }
    }
    /**
     * Disconnect from WebSocket server
     */
    async disconnect(reason = 'Client disconnect') {
        this.isShuttingDown = true;
        this.cancelReconnection();
        if (this.connection) {
            await this.connection.close(1000, reason);
            this.connection = undefined;
        }
        this.emit('disconnected', reason);
    }
    /**
     * Check if client is connected
     */
    isConnected() {
        return !!(this.connection && this.connection.isReady());
    }
    /**
     * Get current connection
     */
    getConnection() {
        return this.connection;
    }
    // ============================================================================
    // Message Sending
    // ============================================================================
    /**
     * Send message through connection
     */
    async send(message) {
        if (!this.connection || !this.connection.isReady()) {
            throw new types_1.ConnectionError('Not connected', this.config.serverId);
        }
        await this.connection.send(message);
    }
    // ============================================================================
    // Reconnection Management
    // ============================================================================
    /**
     * Enable/disable auto-reconnection
     */
    setAutoReconnect(enabled) {
        this.config.autoReconnect = enabled;
        if (!enabled) {
            this.cancelReconnection();
        }
    }
    /**
     * Manually trigger reconnection
     */
    async reconnect() {
        if (this.connection) {
            await this.disconnect('Manual reconnect');
        }
        this.resetReconnectionState();
        await this.connect();
    }
    /**
     * Get reconnection status
     */
    getReconnectionStatus() {
        return {
            isReconnecting: this.reconnectionState.isReconnecting,
            attempts: this.reconnectionState.attempts,
            nextAttemptIn: this.reconnectionState.timer ?
                this.reconnectionState.nextInterval : undefined,
            lastError: this.reconnectionState.lastError?.message
        };
    }
    // ============================================================================
    // Statistics and Info
    // ============================================================================
    /**
     * Get client statistics
     */
    getStats() {
        return {
            isConnected: this.isConnected(),
            serverId: this.config.serverId,
            connectionStats: this.connection?.getStats(),
            reconnectionStats: {
                attempts: this.reconnectionState.attempts,
                isReconnecting: this.reconnectionState.isReconnecting,
                autoReconnectEnabled: this.config.autoReconnect || false
            }
        };
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    async establishConnection() {
        return new Promise((resolve, reject) => {
            const connectionTimeout = setTimeout(() => {
                reject(new types_1.ConnectionError('Connection timeout', this.config.serverId, this.config.reconnectInterval));
            }, this.config.connectionTimeout);
            try {
                // Prepare WebSocket options
                const wsOptions = {
                    headers: {
                        'X-Server-ID': this.config.serverId,
                        'X-Protocol-Version': this.config.protocolVersion || '2.0',
                        ...this.config.headers
                    },
                    handshakeTimeout: this.config.connectionTimeout,
                    ...this.config.ssl
                };
                // Add authentication header if token provided
                if (this.config.authToken) {
                    wsOptions.headers['Authorization'] = `Bearer ${this.config.authToken}`;
                }
                // Create WebSocket connection
                const ws = new ws_1.default(this.config.url, wsOptions);
                // Create connection wrapper
                this.connection = new connection_1.WebSocketConnection(ws, this.config.serverId, 'plugin', {
                    authToken: this.config.authToken,
                    encryptionEnabled: false // Will be set during handshake
                });
                // Set up connection handlers
                this.setupConnectionHandlers(resolve, reject, connectionTimeout);
            }
            catch (error) {
                clearTimeout(connectionTimeout);
                reject(new types_1.ConnectionError(`Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`, this.config.serverId));
            }
        });
    }
    setupConnectionHandlers(resolve, reject, connectionTimeout) {
        if (!this.connection)
            return;
        const connection = this.connection;
        // Connection established
        connection.once('connected', async () => {
            try {
                // Perform handshake and authentication
                await this.performHandshake(connection);
                clearTimeout(connectionTimeout);
                resolve();
            }
            catch (error) {
                clearTimeout(connectionTimeout);
                reject(error);
            }
        });
        // Connection error
        connection.once('error', (error) => {
            clearTimeout(connectionTimeout);
            reject(error);
        });
        // Set up ongoing event handlers
        this.setupOngoingHandlers(connection);
    }
    setupOngoingHandlers(connection) {
        // Message received
        connection.on('message', (message) => {
            this.emit('message', message);
        });
        // Connection lost
        connection.on('disconnected', (code, reason) => {
            this.connection = undefined;
            if (!this.isShuttingDown && this.config.autoReconnect) {
                const error = new types_1.ConnectionError(`Connection lost: ${reason} (code: ${code})`, this.config.serverId);
                this.scheduleReconnection(error);
            }
            this.emit('disconnected', code, reason);
        });
        // Connection error
        connection.on('error', (error) => {
            this.emit('error', error);
            if (!this.isShuttingDown && this.config.autoReconnect) {
                this.scheduleReconnection(error);
            }
        });
        // Authentication events
        connection.on('authenticated', () => {
            this.emit('authenticated');
        });
    }
    async performHandshake(connection) {
        // Send handshake message
        const handshakeMessage = {
            type: 'system',
            id: `handshake-${Date.now()}`,
            op: 'handshake',
            data: {
                protocolVersion: this.config.protocolVersion,
                serverType: 'connector',
                serverId: this.config.serverId,
                capabilities: this.config.capabilities,
                authentication: this.config.authToken ? {
                    token: this.config.authToken,
                    method: this.config.authMethod
                } : undefined
            },
            timestamp: Date.now(),
            serverId: this.config.serverId,
            version: this.config.protocolVersion,
            systemOp: 'handshake'
        };
        await connection.send(handshakeMessage);
        // Wait for authentication confirmation
        return new Promise((resolve, reject) => {
            const authTimeout = setTimeout(() => {
                reject(new types_1.AuthenticationError('Authentication timeout', this.config.serverId));
            }, this.config.authenticationTimeout);
            const handleAuth = () => {
                clearTimeout(authTimeout);
                connection.removeListener('error', handleError);
                resolve();
            };
            const handleError = (error) => {
                clearTimeout(authTimeout);
                connection.removeListener('authenticated', handleAuth);
                reject(error);
            };
            connection.once('authenticated', handleAuth);
            connection.once('error', handleError);
        });
    }
    scheduleReconnection(error) {
        if (this.reconnectionState.isReconnecting) {
            return;
        }
        if (this.reconnectionState.attempts >= (this.config.maxReconnectAttempts || 10)) {
            this.emit('reconnectionFailed', error, this.reconnectionState.attempts);
            return;
        }
        this.reconnectionState.isReconnecting = true;
        this.reconnectionState.lastError = error;
        this.reconnectionState.attempts++;
        this.emit('reconnecting', this.reconnectionState.attempts, this.reconnectionState.nextInterval);
        this.reconnectionState.timer = setTimeout(async () => {
            this.reconnectionState.isReconnecting = false;
            try {
                await this.connect();
            }
            catch (reconnectError) {
                // Update interval for next attempt
                this.reconnectionState.nextInterval = Math.min(this.reconnectionState.nextInterval * (this.config.reconnectBackoffMultiplier || 1.5), this.config.maxReconnectInterval || 60000);
            }
        }, this.reconnectionState.nextInterval);
    }
    cancelReconnection() {
        if (this.reconnectionState.timer) {
            clearTimeout(this.reconnectionState.timer);
            this.reconnectionState.timer = undefined;
        }
        this.reconnectionState.isReconnecting = false;
    }
    resetReconnectionState() {
        this.cancelReconnection();
        this.reconnectionState.attempts = 0;
        this.reconnectionState.nextInterval = this.config.reconnectInterval || 5000;
        this.reconnectionState.lastError = undefined;
    }
}
exports.MochiWebSocketClient = MochiWebSocketClient;
