/**
 * WebSocket Server Implementation
 * 
 * Implements WebSocket server for reverse connection mode where
 * Connector_Bridge connects to Koishi plugin as WebSocket clients.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { WebSocketConnection } from './connection';
import { AuthenticationManager } from './auth';
import { 
  ConnectionError, 
  AuthenticationError,
  ProtocolError,
  ConnectionMode 
} from '../types';

// ============================================================================
// Server Configuration
// ============================================================================

export interface WebSocketServerConfig {
  port: number;
  host?: string;
  path?: string;
  
  // SSL/TLS configuration
  ssl?: {
    cert: string;
    key: string;
    ca?: string;
  };
  
  // Connection limits
  maxConnections?: number;
  connectionTimeout?: number;
  
  // Authentication
  authenticationRequired?: boolean;
  authenticationTimeout?: number;
  
  // Heartbeat settings
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  
  // Message limits
  maxMessageSize?: number;
  messageRateLimit?: {
    windowMs: number;
    maxMessages: number;
  };
}

// ============================================================================
// Connection Tracking
// ============================================================================

interface ConnectionInfo {
  connection: WebSocketConnection;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  authenticated: boolean;
}

// ============================================================================
// WebSocket Server Implementation
// ============================================================================

export class MochiWebSocketServer extends EventEmitter {
  private server: WebSocketServer;
  private config: WebSocketServerConfig;
  private connections = new Map<string, ConnectionInfo>();
  private authManager: AuthenticationManager;
  private isRunning = false;

  constructor(
    authManager: AuthenticationManager,
    config: WebSocketServerConfig
  ) {
    super();
    
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

    this.server = new WebSocketServer({
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
  async start(): Promise<void> {
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
        reject(new ConnectionError(
          `Failed to start WebSocket server: ${error.message}`,
          'server'
        ));
      });
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(info =>
      info.connection.close(1001, 'Server shutting down')
    );

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
  isListening(): boolean {
    return this.isRunning;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Get all active connections
   */
  getConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values()).map(info => info.connection);
  }

  /**
   * Get connection by server ID
   */
  getConnection(serverId: string): WebSocketConnection | undefined {
    return this.connections.get(serverId)?.connection;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get server statistics
   */
  getStats(): {
    isRunning: boolean;
    connectionCount: number;
    totalConnections: number;
    authenticatedConnections: number;
    config: WebSocketServerConfig;
  } {
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
  async broadcast(message: any, filter?: (connection: WebSocketConnection) => boolean): Promise<void> {
    const connections = Array.from(this.connections.values())
      .filter(info => info.authenticated)
      .map(info => info.connection)
      .filter(conn => !filter || filter(conn));

    const promises = connections.map(connection =>
      connection.send(message).catch(error => {
        this.emit('broadcastError', error, connection.serverId);
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Broadcast to specific server IDs
   */
  async broadcastToServers(message: any, serverIds: string[]): Promise<void> {
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

  private setupServerHandlers(): void {
    this.server.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleNewConnection(ws, request);
    });

    this.server.on('error', (error: Error) => {
      this.emit('error', new ConnectionError(
        `WebSocket server error: ${error.message}`,
        'server'
      ));
    });

    this.server.on('close', () => {
      this.isRunning = false;
      this.emit('stopped');
    });
  }

  private async handleNewConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    // Check connection limits
    if (this.connections.size >= (this.config.maxConnections || 100)) {
      ws.close(1013, 'Server at capacity');
      return;
    }

    // Extract server ID and token from query parameters or headers
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const serverId = url.searchParams.get('serverId') || 
                    request.headers['x-server-id'] as string ||
                    `unknown-${Date.now()}`;
    const token = url.searchParams.get('token') || 
                 request.headers['x-auth-token'] as string;

    // Check if server is already connected
    if (this.connections.has(serverId)) {
      ws.close(1008, 'Server already connected');
      return;
    }

    try {
      // Create connection wrapper
      const connection = new WebSocketConnection(ws, serverId, 'plugin');
      
      // Set up connection info
      const connectionInfo: ConnectionInfo = {
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
          const result = await this.authManager.authenticateWithToken(
            serverId,
            token,
            request.socket.remoteAddress
          );
          
          if (result.success) {
            connectionInfo.authenticated = true;
            connection.setAuthenticated(true);
            this.emit('authenticated', connection);
          } else {
            ws.close(1008, result.error || 'Authentication failed');
            this.connections.delete(serverId);
            return;
          }
        } else {
          // No token provided, initiate challenge-response authentication
          await this.initiateAuthentication(connection);
        }
      } else {
        connectionInfo.authenticated = true;
        connection.setAuthenticated(true);
      }

      this.emit('connection', connection);

    } catch (error) {
      ws.close(1011, 'Connection setup failed');
      this.connections.delete(serverId);
      this.emit('connectionError', error, serverId);
    }
  }

  private setupConnectionHandlers(connection: WebSocketConnection, info: ConnectionInfo): void {
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

  private async initiateAuthentication(connection: WebSocketConnection): Promise<void> {
    try {
      // Send authentication challenge
      const challengeMessage = {
        type: 'system' as const,
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
        systemOp: 'handshake' as const
      };

      await connection.send(challengeMessage);

    } catch (error) {
      throw new AuthenticationError(
        `Failed to initiate authentication: ${error instanceof Error ? error.message : String(error)}`,
        connection.serverId
      );
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get connection info for debugging
   */
  getConnectionInfo(serverId: string): ConnectionInfo | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Force disconnect a connection
   */
  async disconnectServer(serverId: string, reason = 'Forced disconnect'): Promise<void> {
    const info = this.connections.get(serverId);
    if (info) {
      await info.connection.close(1000, reason);
    }
  }

  /**
   * Get server address info
   */
  getAddressInfo(): { port: number; host: string; path: string } | null {
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