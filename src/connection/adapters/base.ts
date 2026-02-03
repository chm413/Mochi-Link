/**
 * Base Connection Adapter
 * 
 * Abstract base class for all connection adapters, providing common
 * functionality and interface implementation.
 */

import { EventEmitter } from 'events';
import { 
  ConnectionAdapter, 
  ConnectionInfo, 
  ConnectionStats, 
  ConnectionModeError 
} from '../types';
import { 
  ConnectionConfig, 
  ConnectionMode, 
  UWBPMessage, 
  CommandResult,
  ConnectionError
} from '../../types';

// ============================================================================
// Base Connection Adapter
// ============================================================================

export abstract class BaseConnectionAdapter extends EventEmitter implements ConnectionAdapter {
  public readonly serverId: string;
  public readonly mode: ConnectionMode;
  public capabilities: string[] = [];
  
  protected _isConnected = false;
  protected _connectedAt?: Date;
  protected _lastActivity?: Date;
  protected _config?: ConnectionConfig;
  protected _stats: ConnectionStats;

  constructor(serverId: string, mode: ConnectionMode) {
    super();
    this.serverId = serverId;
    this.mode = mode;
    this._stats = {
      messagesReceived: 0,
      messagesSent: 0,
      commandsExecuted: 0,
      errors: 0,
      uptime: 0,
      latency: undefined
    };
  }

  // ============================================================================
  // Connection Interface Implementation
  // ============================================================================

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(config: ConnectionConfig): Promise<void> {
    if (this._isConnected) {
      throw new ConnectionModeError(
        `Adapter for ${this.serverId} is already connected`,
        this.mode,
        this.serverId
      );
    }

    this._config = config;
    
    try {
      await this.doConnect(config);
      this._isConnected = true;
      this._connectedAt = new Date();
      this._lastActivity = new Date();
      
      this.emit('connected');
    } catch (error) {
      this._stats.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._isConnected) {
      return;
    }

    try {
      await this.doDisconnect();
    } catch (error) {
      this._stats.errors++;
      this.emit('error', error);
    } finally {
      this._isConnected = false;
      this._connectedAt = undefined;
      this.emit('disconnected');
    }
  }
  async reconnect(): Promise<void> {
    if (!this._config) {
      throw new ConnectionModeError(
        `No configuration available for reconnection`,
        this.mode,
        this.serverId
      );
    }

    await this.disconnect();
    await this.connect(this._config);
  }

  async sendMessage(message: UWBPMessage): Promise<void> {
    if (!this._isConnected) {
      throw new ConnectionModeError(
        `Cannot send message: adapter for ${this.serverId} is not connected`,
        this.mode,
        this.serverId
      );
    }

    try {
      await this.doSendMessage(message);
      this._stats.messagesSent++;
      this._lastActivity = new Date();
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }

  async sendCommand(command: string): Promise<CommandResult> {
    if (!this._isConnected) {
      throw new ConnectionModeError(
        `Cannot send command: adapter for ${this.serverId} is not connected`,
        this.mode,
        this.serverId
      );
    }

    try {
      const startTime = Date.now();
      const result = await this.doSendCommand(command);
      const executionTime = Date.now() - startTime;
      
      this._stats.commandsExecuted++;
      this._lastActivity = new Date();
      
      return {
        ...result,
        executionTime
      };
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      serverId: this.serverId,
      mode: this.mode,
      isConnected: this._isConnected,
      connectedAt: this._connectedAt,
      lastActivity: this._lastActivity,
      capabilities: [...this.capabilities],
      stats: { ...this._stats },
      config: this._config || {}
    };
  }

  isHealthy(): boolean {
    return this._isConnected && this.doHealthCheck();
  }

  // ============================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ============================================================================

  protected abstract doConnect(config: ConnectionConfig): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;
  protected abstract doSendMessage(message: UWBPMessage): Promise<void>;
  protected abstract doSendCommand(command: string): Promise<CommandResult>;
  protected abstract doHealthCheck(): boolean;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  protected updateStats(): void {
    if (this._connectedAt) {
      this._stats.uptime = Date.now() - this._connectedAt.getTime();
    }
  }

  protected recordMessage(): void {
    this._stats.messagesReceived++;
    this._lastActivity = new Date();
  }

  protected recordError(): void {
    this._stats.errors++;
  }
}