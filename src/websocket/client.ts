/**
 * WebSocket Client Implementation
 * 
 * Implements WebSocket client for forward connection mode where
 * Koishi plugin connects to Connector_Bridge as WebSocket client.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketConnection } from './connection';
import { AuthenticationManager } from './auth';
import { 
  ConnectionError, 
  AuthenticationError,
  ConnectionMode 
} from '../types';

// ============================================================================
// Client Configuration
// ============================================================================

export interface WebSocketClientConfig {
  // Connection settings
  url: string;
  serverId: string;
  
  // Authentication
  authToken?: string;
  authMethod?: 'token' | 'certificate';
  
  // SSL/TLS settings
  ssl?: {
    rejectUnauthorized?: boolean;
    cert?: string;
    key?: string;
    ca?: string;
  };
  
  // Connection behavior
  connectionTimeout?: number;
  authenticationTimeout?: number;
  
  // Reconnection settings
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectInterval?: number;
  
  // Heartbeat settings
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  
  // Protocol settings
  protocolVersion?: string;
  capabilities?: string[];
  
  // Headers
  headers?: Record<string, string>;
}

// ============================================================================
// Reconnection State
// ============================================================================

interface ReconnectionState {
  attempts: number;
  nextInterval: number;
  isReconnecting: boolean;
  timer?: NodeJS.Timeout;
  lastError?: Error;
}

// ============================================================================
// WebSocket Client Implementation
// ============================================================================

export class MochiWebSocketClient extends EventEmitter {
  private config: WebSocketClientConfig;
  private connection?: WebSocketConnection;
  private authManager: AuthenticationManager;
  private reconnectionState: ReconnectionState;
  private isConnecting = false;
  private isShuttingDown = false;

  constructor(
    authManager: AuthenticationManager,
    config: WebSocketClientConfig
  ) {
    super();
    
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
  async connect(): Promise<void> {
    if (this.isConnecting) {
      throw new ConnectionError('Connection already in progress', this.config.serverId);
    }

    if (this.connection && this.connection.isAlive()) {
      throw new ConnectionError('Already connected', this.config.serverId);
    }

    this.isConnecting = true;
    this.isShuttingDown = false;

    try {
      await this.establishConnection();
      this.resetReconnectionState();
      this.emit('connected', this.connection);
    } catch (error) {
      this.isConnecting = false;
      
      if (this.config.autoReconnect && !this.isShuttingDown) {
        this.scheduleReconnection(error as Error);
      }
      
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(reason = 'Client disconnect'): Promise<void> {
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
  isConnected(): boolean {
    return !!(this.connection && this.connection.isReady());
  }

  /**
   * Get current connection
   */
  getConnection(): WebSocketConnection | undefined {
    return this.connection;
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Send message through connection
   */
  async send(message: any): Promise<void> {
    if (!this.connection || !this.connection.isReady()) {
      throw new ConnectionError('Not connected', this.config.serverId);
    }

    await this.connection.send(message);
  }

  // ============================================================================
  // Reconnection Management
  // ============================================================================

  /**
   * Enable/disable auto-reconnection
   */
  setAutoReconnect(enabled: boolean): void {
    this.config.autoReconnect = enabled;
    
    if (!enabled) {
      this.cancelReconnection();
    }
  }

  /**
   * Manually trigger reconnection
   */
  async reconnect(): Promise<void> {
    if (this.connection) {
      await this.disconnect('Manual reconnect');
    }
    
    this.resetReconnectionState();
    await this.connect();
  }

  /**
   * Get reconnection status
   */
  getReconnectionStatus(): {
    isReconnecting: boolean;
    attempts: number;
    nextAttemptIn?: number;
    lastError?: string;
  } {
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
  getStats(): {
    isConnected: boolean;
    serverId: string;
    connectionStats?: any;
    reconnectionStats: {
      attempts: number;
      isReconnecting: boolean;
      autoReconnectEnabled: boolean;
    };
  } {
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

  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        reject(new ConnectionError(
          'Connection timeout',
          this.config.serverId,
          this.config.reconnectInterval
        ));
      }, this.config.connectionTimeout);

      try {
        // Prepare WebSocket options
        const wsOptions: WebSocket.ClientOptions = {
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
          wsOptions.headers!['Authorization'] = `Bearer ${this.config.authToken}`;
        }

        // Create WebSocket connection
        const ws = new WebSocket(this.config.url, wsOptions);
        
        // Create connection wrapper
        this.connection = new WebSocketConnection(
          ws, 
          this.config.serverId, 
          'plugin',
          {
            authToken: this.config.authToken,
            encryptionEnabled: false // Will be set during handshake
          }
        );

        // Set up connection handlers
        this.setupConnectionHandlers(resolve, reject, connectionTimeout);

      } catch (error) {
        clearTimeout(connectionTimeout);
        reject(new ConnectionError(
          `Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`,
          this.config.serverId
        ));
      }
    });
  }

  private setupConnectionHandlers(
    resolve: () => void,
    reject: (error: Error) => void,
    connectionTimeout: NodeJS.Timeout
  ): void {
    if (!this.connection) return;

    const connection = this.connection;

    // Connection established
    connection.once('connected', async () => {
      try {
        // Perform handshake and authentication
        await this.performHandshake(connection);
        clearTimeout(connectionTimeout);
        resolve();
      } catch (error) {
        clearTimeout(connectionTimeout);
        reject(error as Error);
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

  private setupOngoingHandlers(connection: WebSocketConnection): void {
    // Message received
    connection.on('message', (message) => {
      this.emit('message', message);
    });

    // Connection lost
    connection.on('disconnected', (code, reason) => {
      this.connection = undefined;
      
      if (!this.isShuttingDown && this.config.autoReconnect) {
        const error = new ConnectionError(
          `Connection lost: ${reason} (code: ${code})`,
          this.config.serverId
        );
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

  private async performHandshake(connection: WebSocketConnection): Promise<void> {
    // Send handshake message
    const handshakeMessage = {
      type: 'system' as const,
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
      timestamp: new Date().toISOString(),
      serverId: this.config.serverId,
      version: this.config.protocolVersion,
      systemOp: 'handshake' as const
    };

    await connection.send(handshakeMessage);

    // Wait for authentication confirmation
    return new Promise((resolve, reject) => {
      const authTimeout = setTimeout(() => {
        reject(new AuthenticationError(
          'Authentication timeout',
          this.config.serverId
        ));
      }, this.config.authenticationTimeout);

      const handleAuth = () => {
        clearTimeout(authTimeout);
        connection.removeListener('error', handleError);
        resolve();
      };

      const handleError = (error: Error) => {
        clearTimeout(authTimeout);
        connection.removeListener('authenticated', handleAuth);
        reject(error);
      };

      connection.once('authenticated', handleAuth);
      connection.once('error', handleError);
    });
  }

  private scheduleReconnection(error: Error): void {
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
      } catch (reconnectError) {
        // Update interval for next attempt
        this.reconnectionState.nextInterval = Math.min(
          this.reconnectionState.nextInterval * (this.config.reconnectBackoffMultiplier || 1.5),
          this.config.maxReconnectInterval || 60000
        );
      }
    }, this.reconnectionState.nextInterval);
  }

  private cancelReconnection(): void {
    if (this.reconnectionState.timer) {
      clearTimeout(this.reconnectionState.timer);
      this.reconnectionState.timer = undefined;
    }
    this.reconnectionState.isReconnecting = false;
  }

  private resetReconnectionState(): void {
    this.cancelReconnection();
    this.reconnectionState.attempts = 0;
    this.reconnectionState.nextInterval = this.config.reconnectInterval || 5000;
    this.reconnectionState.lastError = undefined;
  }
}