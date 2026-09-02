/**
 * WebSocket Server Implementation
 * 
 * Implements WebSocket server for forward connection mode (Connector perspective) where
 * Connector_Bridge actively connects to Koishi plugin as WebSocket clients.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import { readFileSync } from 'fs';
import { WebSocketConnection } from './connection';
import { AuthenticationManager } from './auth';
import { normalizeConnectorCapabilities } from '../protocol/capabilities';
import { isCompatibleUWBPVersion } from '../protocol/messages';
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
  private httpServer?: HttpsServer;
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

    // Terminate TLS in-process when a certificate/key pair is configured so
    // WSS actually takes effect (previously the ssl block was accepted but
    // ignored, leaving a plaintext `ws://` listener).
    const wsOptions: WebSocket.ServerOptions = {
      path: this.config.path,
      maxPayload: this.config.maxMessageSize,
      perMessageDeflate: true,
      clientTracking: true
    };

    if (this.config.ssl?.cert && this.config.ssl?.key) {
      this.httpServer = createHttpsServer({
        cert: readFileSync(this.config.ssl.cert),
        key: readFileSync(this.config.ssl.key),
        ...(this.config.ssl.ca ? { ca: readFileSync(this.config.ssl.ca) } : {})
      });
      this.server = new WebSocketServer({ ...wsOptions, server: this.httpServer });
    } else {
      this.server = new WebSocketServer({
        ...wsOptions,
        port: this.config.port,
        host: this.config.host
      });
    }

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
      const onListening = () => {
        this.isRunning = true;
        this.emit('started', {
          port: this.config.port,
          host: this.config.host,
          path: this.config.path
        });
        resolve();
      };

      const onError = (error: Error) => {
        reject(new ConnectionError(
          `Failed to start WebSocket server: ${error.message}`,
          'server'
        ));
      };

      if (this.httpServer) {
        this.httpServer.once('listening', onListening);
        this.httpServer.once('error', onError);
        this.httpServer.listen(this.config.port, this.config.host);
      } else {
        this.server.once('listening', onListening);
        this.server.once('error', onError);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    this.authManager.shutdown();

    if (!this.isRunning) {
      this.connections.clear();
      return;
    }

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(info =>
      info.connection.close(1001, 'Server shutting down')
    );

    await Promise.allSettled(closePromises);

    // Close server
    return new Promise((resolve) => {
      const finalize = () => {
        this.isRunning = false;
        this.connections.clear();
        this.emit('stopped');
        resolve();
      };

      if (this.httpServer) {
        // Close the HTTPS listener once the WebSocket server has released its
        // upgrade handler and clients.
        this.server.close(() => {
          this.httpServer?.close(() => finalize());
        });
      } else {
        this.server.close(finalize);
      }
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
                    request.headers['x-server-id'] as string;
    if (!serverId) {
      ws.close(1008, 'Missing serverId');
      return;
    }
    const protocolVersionHeader = request.headers['x-protocol-version'];
    const protocolVersion = Array.isArray(protocolVersionHeader)
      ? protocolVersionHeader[0]
      : protocolVersionHeader;
    if (protocolVersion && !isCompatibleUWBPVersion(protocolVersion)) {
      ws.close(1002, 'Unsupported U-WBP version');
      return;
    }
    const authorization = request.headers.authorization as string | undefined;
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const urlToken = url.searchParams.get('token');
    const token = urlToken ||
                 request.headers['x-auth-token'] as string ||
                 bearerToken;
    const declaredCapabilities = normalizeConnectorCapabilities(
      request.headers['x-capabilities']
    );

    // Token-in-URL is legacy-compatible only: query strings leak into proxy
    // and access logs. Surface a warning so operators can migrate clients.
    if (urlToken) {
      this.emit('securityWarning',
        `Server ${serverId} authenticated with a token in the URL query string. ` +
        'Credentials may leak into access logs; use the X-Auth-Token or Authorization header instead.');
    }

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
      // Accepted sockets are already open; their `open` event can precede the
      // wrapper, so explicitly mark the wrapper ready before authentication.
      connection.markConnected();

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
            connection.updateCapabilities(declaredCapabilities);
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
        connection.updateCapabilities(declaredCapabilities);
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

      const operation = message?.systemOp || message?.op;
      if (!info.authenticated && !(message?.type === 'system' && operation === 'handshake')) {
        this.emit('connectionError', new AuthenticationError(
          'Only the authentication handshake is allowed before authentication',
          connection.serverId
        ), connection.serverId);
        void connection.close(1008, 'Authentication required');
        return;
      }

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
      // Send authentication challenge using MessageFactory
      const { MessageFactory } = await import('../protocol/messages');
      const { UWBP_VERSION } = await import('../protocol/messages');
      
      const challenge = await this.authManager.generateChallengeData(connection.serverId);
      const challengeMessage = MessageFactory.createSystemMessage('handshake', {
        protocolVersion: UWBP_VERSION,
        serverType: 'koishi',
        authenticationRequired: true,
        challenge: challenge.challenge,
        challengeTimestamp: challenge.timestamp,
        challengeExpiresAt: challenge.expiresAt
      }, {
        serverId: connection.serverId
      });

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
