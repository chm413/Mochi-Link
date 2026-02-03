/**
 * WebSocket Connection Manager
 * 
 * Central manager for WebSocket connections, handling both server and client
 * modes, connection lifecycle, authentication, and heartbeat management.
 */

import { EventEmitter } from 'events';
import { MochiWebSocketServer, WebSocketServerConfig } from './server';
import { MochiWebSocketClient, WebSocketClientConfig } from './client';
import { WebSocketConnection } from './connection';
import { AuthenticationManager, TokenManager } from './auth';
import { HeartbeatManager, HeartbeatConfig } from './heartbeat';
import { ProtocolHandler } from '../protocol/handler';
import { ConnectionSecurityManager, ConnectionSecurityConfig } from '../services/connection-security';
import { 
  Connection, 
  ConnectionMode, 
  ConnectionError,
  AuthenticationError,
  UWBPMessage,
  ServerConfig
} from '../types';

// ============================================================================
// Manager Configuration
// ============================================================================

export interface ConnectionManagerConfig {
  // Server mode configuration
  server?: WebSocketServerConfig;
  
  // Heartbeat configuration
  heartbeat?: Partial<HeartbeatConfig>;
  
  // Connection limits and timeouts
  maxConnections?: number;
  connectionTimeout?: number;
  
  // Reconnection settings
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  
  // Protocol settings
  protocolHandler?: ProtocolHandler;
  
  // Security settings
  authenticationRequired?: boolean;
  encryptionEnabled?: boolean;
  
  // Connection security configuration
  connectionSecurity?: Partial<ConnectionSecurityConfig>;
}

// ============================================================================
// Connection Registry
// ============================================================================

interface ConnectionEntry {
  connection: WebSocketConnection;
  mode: 'server' | 'client';
  config: ServerConfig;
  client?: MochiWebSocketClient;
  connectedAt: Date;
  lastActivity: Date;
  authenticated: boolean;
  capabilities: string[];
}

// ============================================================================
// WebSocket Connection Manager
// ============================================================================

export class WebSocketConnectionManager extends EventEmitter {
  private config: ConnectionManagerConfig;
  private server?: MochiWebSocketServer;
  private authManager: AuthenticationManager;
  private heartbeatManager: HeartbeatManager;
  private protocolHandler: ProtocolHandler;
  private connectionSecurityManager: ConnectionSecurityManager;
  
  // Connection registry
  private connections = new Map<string, ConnectionEntry>();
  private clients = new Map<string, MochiWebSocketClient>();
  
  // State
  private isRunning = false;

  constructor(
    tokenManager: TokenManager,
    config: ConnectionManagerConfig = {},
    auditService?: any // Add audit service parameter
  ) {
    super();
    
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
    this.authManager = new AuthenticationManager(tokenManager);
    this.heartbeatManager = new HeartbeatManager(this.config.heartbeat);
    this.protocolHandler = config.protocolHandler || new ProtocolHandler();
    
    // Initialize connection security manager if audit service is provided
    if (auditService) {
      this.connectionSecurityManager = new ConnectionSecurityManager(
        {} as any, // Context will be provided by the calling service
        auditService,
        this.config.connectionSecurity
      );
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
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Connection manager is already running');
    }

    try {
      // Start server if configured
      if (this.config.server) {
        this.server = new MochiWebSocketServer(this.authManager, this.config.server);
        this.setupServerHandlers();
        await this.server.start();
      }

      this.isRunning = true;
      this.emit('started');

    } catch (error) {
      throw new ConnectionError(
        `Failed to start connection manager: ${error instanceof Error ? error.message : String(error)}`,
        'manager'
      );
    }
  }

  /**
   * Stop the connection manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Disconnect all clients
      const disconnectPromises = Array.from(this.clients.values()).map(client =>
        client.disconnect('Manager shutting down')
      );
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

    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Check if manager is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to a server (forward connection mode)
   */
  async connectToServer(serverConfig: ServerConfig): Promise<WebSocketConnection> {
    if (!this.isRunning) {
      throw new ConnectionError('Connection manager is not running', serverConfig.id);
    }

    // Check if already connected
    if (this.connections.has(serverConfig.id)) {
      throw new ConnectionError('Server already connected', serverConfig.id);
    }

    // Check connection security limits if enabled
    if (this.connectionSecurityManager) {
      const securityCheck = this.connectionSecurityManager.checkConnectionAllowed(
        serverConfig.id,
        'localhost', // For client connections, we use localhost
        'MochiLink-Client'
      );

      if (!securityCheck.allowed) {
        throw new ConnectionError(
          securityCheck.reason || 'Connection not allowed by security policy',
          serverConfig.id
        );
      }
    }

    // Check connection limits
    if (this.connections.size >= (this.config.maxConnections || 100)) {
      throw new ConnectionError('Maximum connections reached', serverConfig.id);
    }

    try {
      // Create client configuration
      const clientConfig: WebSocketClientConfig = {
        url: this.buildWebSocketURL(serverConfig),
        serverId: serverConfig.id,
        authToken: await this.getAuthToken(serverConfig.id),
        autoReconnect: this.config.autoReconnect,
        reconnectInterval: this.config.reconnectInterval,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        connectionTimeout: this.config.connectionTimeout
      };

      // Create and configure client
      const client = new MochiWebSocketClient(this.authManager, clientConfig);
      this.setupClientHandlers(client, serverConfig);

      // Store client
      this.clients.set(serverConfig.id, client);

      // Connect
      await client.connect();
      
      const connection = client.getConnection();
      if (!connection) {
        throw new ConnectionError('Failed to establish connection', serverConfig.id);
      }

      // Register connection
      this.registerConnection(connection, 'client', serverConfig);

      return connection;

    } catch (error) {
      // Clean up on failure
      this.clients.delete(serverConfig.id);
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnectFromServer(serverId: string, reason = 'Manual disconnect'): Promise<void> {
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
  getConnection(serverId: string): WebSocketConnection | undefined {
    return this.connections.get(serverId)?.connection;
  }

  /**
   * Get all active connections
   */
  getConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values()).map(entry => entry.connection);
  }

  /**
   * Get connections by filter
   */
  getConnectionsByFilter(filter: (entry: ConnectionEntry) => boolean): WebSocketConnection[] {
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
  async sendMessage(serverId: string, message: UWBPMessage): Promise<void> {
    const connection = this.getConnection(serverId);
    if (!connection) {
      throw new ConnectionError('Server not connected', serverId);
    }

    await this.protocolHandler.sendMessage(connection, message);
  }

  /**
   * Broadcast message to all connected servers
   */
  async broadcastMessage(
    message: UWBPMessage,
    filter?: (connection: WebSocketConnection) => boolean
  ): Promise<void> {
    const connections = this.getConnections().filter(conn => !filter || filter(conn));
    
    const promises = connections.map(connection =>
      this.protocolHandler.sendMessage(connection, message).catch(error => {
        this.emit('broadcastError', error, connection.serverId);
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Send request and wait for response
   */
  async sendRequest(
    serverId: string,
    operation: string,
    data: any = {},
    options: { timeout?: number } = {}
  ): Promise<any> {
    const connection = this.getConnection(serverId);
    if (!connection) {
      throw new ConnectionError('Server not connected', serverId);
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
  getStats(): {
    isRunning: boolean;
    totalConnections: number;
    serverConnections: number;
    clientConnections: number;
    authenticatedConnections: number;
    serverStats?: any;
    heartbeatStats: any;
    protocolStats: any;
    connectionSecurityStats?: any;
  } {
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
  getConnectionInfo(serverId: string): any {
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

  private setupManagerHandlers(): void {
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
        this.connectionSecurityManager.recordAuthenticationSuccess(
          serverId,
          serverId,
          'localhost' // For now, we'll use localhost
        );
        this.connectionSecurityManager.markConnectionAuthenticated(serverId);
      }
    });

    this.authManager.on('authenticationError', (serverId, error) => {
      this.emit('authenticationFailed', serverId, error);
      
      // Record authentication failure in security manager
      if (this.connectionSecurityManager) {
        this.connectionSecurityManager.recordAuthenticationFailure(
          serverId,
          serverId,
          'localhost', // For now, we'll use localhost
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }

  private setupConnectionSecurityHandlers(): void {
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

  private setupServerHandlers(): void {
    if (!this.server) return;

    this.server.on('connection', (connection: WebSocketConnection) => {
      this.registerConnection(connection, 'server');
    });

    this.server.on('disconnection', (connection: WebSocketConnection) => {
      this.unregisterConnection(connection.serverId);
    });

    this.server.on('message', (message: UWBPMessage, connection: WebSocketConnection) => {
      this.handleIncomingMessage(message, connection);
    });

    this.server.on('authenticated', (connection: WebSocketConnection) => {
      const entry = this.connections.get(connection.serverId);
      if (entry) {
        entry.authenticated = true;
      }
    });

    this.server.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private setupClientHandlers(client: MochiWebSocketClient, serverConfig: ServerConfig): void {
    client.on('connected', (connection: WebSocketConnection) => {
      this.registerConnection(connection, 'client', serverConfig);
    });

    client.on('disconnected', () => {
      this.unregisterConnection(serverConfig.id);
    });

    client.on('message', (message: UWBPMessage) => {
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

  private registerConnection(
    connection: WebSocketConnection,
    mode: 'server' | 'client',
    config?: ServerConfig
  ): void {
    const entry: ConnectionEntry = {
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
      this.connectionSecurityManager.registerConnection(
        connection.serverId,
        connection.serverId,
        'localhost', // For now, we'll use localhost for all connections
        'MochiLink-Connection'
      );
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

  private unregisterConnection(serverId: string): void {
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

  private async handleIncomingMessage(message: UWBPMessage, connection: WebSocketConnection): Promise<void> {
    try {
      // Update last activity
      const entry = this.connections.get(connection.serverId);
      if (entry) {
        entry.lastActivity = new Date();
      }

      // Handle through protocol handler
      await this.protocolHandler.handleMessage(connection, JSON.stringify(message));

      this.emit('message', message, connection.serverId);

    } catch (error) {
      this.emit('messageError', error, connection.serverId);
    }
  }

  private async handleReconnectionRequired(serverId: string, reason: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client && this.config.autoReconnect) {
      try {
        await client.reconnect();
      } catch (error) {
        this.emit('reconnectionFailed', serverId, error);
      }
    }
  }

  private buildWebSocketURL(serverConfig: ServerConfig): string {
    const config = serverConfig.connectionConfig.plugin;
    if (!config) {
      throw new ConnectionError('Plugin connection config not found', serverConfig.id);
    }

    const protocol = config.ssl ? 'wss' : 'ws';
    const path = config.path || '/ws';
    
    return `${protocol}://${config.host}:${config.port}${path}?serverId=${serverConfig.id}`;
  }

  private async getAuthToken(serverId: string): Promise<string | undefined> {
    // This would typically fetch the token from the database
    // For now, we'll emit an event to request the token
    return new Promise((resolve) => {
      this.emit('tokenRequested', serverId, resolve);
    });
  }
}