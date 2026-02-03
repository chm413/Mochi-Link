/**
 * WebSocket Connection Implementation
 * 
 * Implements the Connection interface for WebSocket connections,
 * providing message sending, connection management, and state tracking.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { 
  Connection, 
  UWBPMessage, 
  ConnectionMode, 
  ConnectionError,
  ProtocolError
} from '../types';
import { MessageSerializer } from '../protocol/serialization';

// ============================================================================
// Connection State Types
// ============================================================================

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'closing';

export interface ConnectionStats {
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  lastActivity: number;
  connectionTime: number;
  errors: number;
}

// ============================================================================
// WebSocket Connection Implementation
// ============================================================================

export class WebSocketConnection extends EventEmitter implements Connection {
  public readonly serverId: string;
  public readonly mode: ConnectionMode;
  public capabilities: string[] = [];
  public lastPing?: number;
  
  private ws: WebSocket;
  private _status: ConnectionState = 'connecting';
  private stats: ConnectionStats;
  private messageQueue: UWBPMessage[] = [];
  private isAuthenticated = false;
  private authToken?: string;
  private encryptionEnabled = false;
  private encryptionKey?: string;

  constructor(
    ws: WebSocket,
    serverId: string,
    mode: ConnectionMode = 'plugin',
    options: {
      authToken?: string;
      encryptionEnabled?: boolean;
      encryptionKey?: string;
    } = {}
  ) {
    super();
    
    this.ws = ws;
    this.serverId = serverId;
    this.mode = mode;
    this.authToken = options.authToken;
    this.encryptionEnabled = options.encryptionEnabled || false;
    this.encryptionKey = options.encryptionKey;
    
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      lastActivity: Date.now(),
      connectionTime: Date.now(),
      errors: 0
    };

    this.setupWebSocketHandlers();
  }

  // ============================================================================
  // Connection Interface Implementation
  // ============================================================================

  get status(): 'connected' | 'disconnected' | 'connecting' | 'error' {
    switch (this._status) {
      case 'connected':
        return 'connected';
      case 'connecting':
        return 'connecting';
      case 'error':
        return 'error';
      default:
        return 'disconnected';
    }
  }

  async send(message: UWBPMessage): Promise<void> {
    if (this._status !== 'connected') {
      if (this._status === 'connecting') {
        // Queue message for later sending
        this.messageQueue.push(message);
        return;
      }
      throw new ConnectionError(
        `Cannot send message: connection is ${this._status}`,
        this.serverId
      );
    }

    try {
      // Serialize message
      const serializeResult = MessageSerializer.serialize(message, {
        validate: true,
        encrypt: this.encryptionEnabled,
        encryptionKey: this.encryptionKey
      });

      if (!serializeResult.success) {
        throw new ProtocolError(
          `Failed to serialize message: ${serializeResult.error}`,
          message.id
        );
      }

      const serializedData = serializeResult.data!;
      const dataString = typeof serializedData === 'string' ? serializedData : serializedData.toString('utf8');
      
      // Send through WebSocket
      await this.sendRaw(dataString);
      
      // Update statistics
      this.stats.messagesSent++;
      this.stats.bytesSent += Buffer.byteLength(dataString, 'utf8');
      this.stats.lastActivity = Date.now();

      this.emit('messageSent', message);

    } catch (error) {
      this.stats.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  async close(code?: number, reason?: string): Promise<void> {
    if (this._status === 'disconnected' || this._status === 'closing') {
      return;
    }

    this._status = 'closing';
    
    try {
      // Send disconnect message if possible
      if (this.ws.readyState === WebSocket.OPEN) {
        const disconnectMessage = {
          type: 'system' as const,
          id: `disconnect-${Date.now()}`,
          op: 'disconnect',
          data: { reason: reason || 'Connection closed by client' },
          timestamp: Date.now(),
          serverId: this.serverId,
          version: '2.0',
          systemOp: 'disconnect' as const
        };
        
        try {
          await this.send(disconnectMessage);
        } catch (error) {
          // Ignore errors when sending disconnect message
        }
      }

      // Close WebSocket
      this.ws.close(code || 1000, reason || 'Normal closure');
      
    } catch (error) {
      this.emit('error', error);
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Check if connection is ready for communication
   */
  isReady(): boolean {
    return this._status === 'connected' && this.isAuthenticated;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Set authentication status
   */
  setAuthenticated(authenticated: boolean, token?: string): void {
    this.isAuthenticated = authenticated;
    if (token) {
      this.authToken = token;
    }
    
    if (authenticated && this._status === 'connected') {
      // Process queued messages
      this.processMessageQueue();
    }
  }

  /**
   * Update capabilities
   */
  updateCapabilities(capabilities: string[]): void {
    this.capabilities = [...capabilities];
    this.emit('capabilitiesUpdated', capabilities);
  }

  /**
   * Enable/disable encryption
   */
  setEncryption(enabled: boolean, key?: string): void {
    this.encryptionEnabled = enabled;
    if (key) {
      this.encryptionKey = key;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupWebSocketHandlers(): void {
    this.ws.on('open', () => {
      this._status = 'connected';
      this.emit('connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleIncomingMessage(data);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this._status = 'disconnected';
      this.emit('disconnected', code, reason.toString());
    });

    this.ws.on('error', (error: Error) => {
      this._status = 'error';
      this.stats.errors++;
      this.emit('error', new ConnectionError(
        `WebSocket error: ${error.message}`,
        this.serverId
      ));
    });

    this.ws.on('ping', (data: Buffer) => {
      this.ws.pong(data);
      this.emit('ping', data);
    });

    this.ws.on('pong', (data: Buffer) => {
      this.emit('pong', data);
    });
  }

  private async handleIncomingMessage(data: WebSocket.Data): Promise<void> {
    try {
      // Convert data to string
      let messageData: string;
      if (Buffer.isBuffer(data)) {
        messageData = data.toString('utf8');
      } else if (Array.isArray(data)) {
        messageData = Buffer.concat(data).toString('utf8');
      } else {
        messageData = data.toString();
      }

      // Update statistics
      this.stats.messagesReceived++;
      this.stats.bytesReceived += Buffer.byteLength(messageData, 'utf8');
      this.stats.lastActivity = Date.now();

      // Deserialize message
      const deserializeResult = MessageSerializer.deserialize(messageData, {
        validate: true,
        decrypt: this.encryptionEnabled,
        decryptionKey: this.encryptionKey
      });

      if (!deserializeResult.success) {
        throw new ProtocolError(
          `Failed to deserialize message: ${deserializeResult.error}`
        );
      }

      const message = deserializeResult.message!;
      this.emit('message', message);

    } catch (error) {
      this.stats.errors++;
      this.emit('error', error);
    }
  }

  private async sendRaw(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        reject(new ConnectionError(
          'WebSocket is not open',
          this.serverId
        ));
        return;
      }

      this.ws.send(data, (error) => {
        if (error) {
          reject(new ConnectionError(
            `Failed to send message: ${error.message}`,
            this.serverId
          ));
        } else {
          resolve();
        }
      });
    });
  }

  private async processMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return;
    }

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        await this.send(message);
      } catch (error) {
        this.emit('error', error);
        // Re-queue failed messages
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get connection info for debugging
   */
  getConnectionInfo(): {
    serverId: string;
    status: ConnectionState;
    mode: ConnectionMode;
    isAuthenticated: boolean;
    capabilities: string[];
    stats: ConnectionStats;
    queuedMessages: number;
  } {
    return {
      serverId: this.serverId,
      status: this._status,
      mode: this.mode,
      isAuthenticated: this.isAuthenticated,
      capabilities: [...this.capabilities],
      stats: this.getStats(),
      queuedMessages: this.messageQueue.length
    };
  }

  /**
   * Ping the connection
   */
  ping(data?: Buffer): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.ping(data);
    }
  }

  /**
   * Check if WebSocket is alive
   */
  isAlive(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }
}