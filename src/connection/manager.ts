/**
 * Connection Mode Manager
 * 
 * Central manager for handling different connection modes, dynamic switching,
 * connection state management, and error recovery mechanisms.
 */

import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { 
  ConnectionAdapter,
  ConnectionInfo,
  ConnectionModeError
} from './types';
import { 
  PluginConnectionAdapter,
  RCONConnectionAdapter,
  TerminalConnectionAdapter
} from './adapters';
import { 
  ServerConfig,
  ConnectionMode,
  ConnectionConfig,
  UWBPMessage,
  CommandResult,
  ConnectionError,
  MochiLinkError
} from '../types';

// ============================================================================
// Connection Manager Configuration
// ============================================================================

export interface ConnectionManagerConfig {
  // Retry configuration
  maxRetryAttempts?: number;
  retryInterval?: number;
  exponentialBackoff?: boolean;
  
  // Health check configuration
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  
  // Connection switching
  autoSwitchOnFailure?: boolean;
  preferredModeOrder?: ConnectionMode[];
  
  // Monitoring
  enableMetrics?: boolean;
  metricsInterval?: number;
}

// ============================================================================
// Connection Entry
// ============================================================================

interface ConnectionEntry {
  adapter: ConnectionAdapter;
  config: ServerConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'switching';
  lastConnected?: Date;
  lastError?: Error;
  retryCount: number;
  retryTimer?: NodeJS.Timeout;
  healthCheckTimer?: NodeJS.Timeout;
  switchAttempts: number;
}

// ============================================================================
// Connection Mode Manager
// ============================================================================

export class ConnectionModeManager extends EventEmitter {
  private config: Required<ConnectionManagerConfig>;
  private connections = new Map<string, ConnectionEntry>();
  private ctx: Context;

  constructor(ctx: Context, config: ConnectionManagerConfig = {}) {
    super();
    this.ctx = ctx;
    
    this.config = {
      maxRetryAttempts: 5,
      retryInterval: 5000,
      exponentialBackoff: true,
      healthCheckInterval: 30000,
      healthCheckTimeout: 10000,
      autoSwitchOnFailure: true,
      preferredModeOrder: ['plugin', 'rcon', 'terminal'],
      enableMetrics: true,
      metricsInterval: 60000,
      ...config
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Establish connection to a server
   */
  async establishConnection(serverConfig: ServerConfig): Promise<ConnectionAdapter> {
    const logger = this.ctx.logger('mochi-link:connection');
    
    // Check if connection already exists
    if (this.connections.has(serverConfig.id)) {
      const existingEntry = this.connections.get(serverConfig.id)!;
      
      // If existing connection is healthy, return it
      if (existingEntry.status === 'connected' && existingEntry.adapter.isConnected) {
        logger.info(`Reusing existing connection for ${serverConfig.id}`);
        return existingEntry.adapter;
      }
      
      // If existing connection is dead, remove it first
      logger.info(`Removing stale connection for ${serverConfig.id}`);
      await this.removeConnection(serverConfig.id);
    }

    logger.info(`Establishing ${serverConfig.connectionMode} connection to ${serverConfig.id}`);

    const adapter = this.createAdapter(serverConfig.id, serverConfig.connectionMode);
    const entry: ConnectionEntry = {
      adapter,
      config: serverConfig,
      status: 'connecting',
      retryCount: 0,
      switchAttempts: 0
    };

    this.connections.set(serverConfig.id, entry);
    this.setupAdapterHandlers(adapter, entry);

    try {
      await adapter.connect(serverConfig.connectionConfig);
      entry.status = 'connected';
      entry.lastConnected = new Date();
      entry.retryCount = 0;
      
      this.startHealthCheck(serverConfig.id);
      this.emit('connectionEstablished', serverConfig.id, serverConfig.connectionMode);
      
      logger.info(`Successfully connected to ${serverConfig.id} via ${serverConfig.connectionMode}`);
      return adapter;

    } catch (error) {
      entry.status = 'error';
      entry.lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.error(`Failed to connect to ${serverConfig.id}:`, error);
      
      // Try automatic mode switching if enabled
      if (this.config.autoSwitchOnFailure) {
        await this.attemptModeSwitch(serverConfig.id);
      } else {
        this.scheduleReconnect(serverConfig.id);
      }
      
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnectServer(serverId: string): Promise<void> {
    const entry = this.connections.get(serverId);
    if (!entry) {
      return;
    }

    const logger = this.ctx.logger('mochi-link:connection');
    logger.info(`Disconnecting from server ${serverId}`);

    this.clearTimers(entry);
    
    try {
      await entry.adapter.disconnect();
    } catch (error) {
      logger.error(`Error during disconnect from ${serverId}:`, error);
    }

    entry.status = 'disconnected';
    this.emit('connectionClosed', serverId);
  }

  /**
   * Remove connection completely
   */
  async removeConnection(serverId: string): Promise<void> {
    await this.disconnectServer(serverId);
    this.connections.delete(serverId);
    this.emit('connectionRemoved', serverId);
  }
  /**
   * Switch connection mode for a server
   */
  async switchConnectionMode(
    serverId: string, 
    newMode: ConnectionMode, 
    newConfig?: ConnectionConfig
  ): Promise<void> {
    const entry = this.connections.get(serverId);
    if (!entry) {
      throw new ConnectionModeError(
        `No connection found for server ${serverId}`,
        newMode,
        serverId
      );
    }

    const logger = this.ctx.logger('mochi-link:connection');
    logger.info(`Switching connection mode for ${serverId} from ${entry.adapter.mode} to ${newMode}`);

    entry.status = 'switching';
    this.clearTimers(entry);

    try {
      // Disconnect current adapter
      await entry.adapter.disconnect();
      
      // Create new adapter
      const newAdapter = this.createAdapter(serverId, newMode);
      const configToUse = newConfig || this.extractModeConfig(entry.config.connectionConfig, newMode);
      
      if (!configToUse) {
        throw new ConnectionModeError(
          `No configuration available for mode ${newMode}`,
          newMode,
          serverId
        );
      }

      // Update entry
      entry.adapter = newAdapter;
      entry.config.connectionMode = newMode;
      if (newConfig) {
        entry.config.connectionConfig = { ...entry.config.connectionConfig, ...newConfig };
      }
      
      this.setupAdapterHandlers(newAdapter, entry);

      // Connect with new adapter
      await newAdapter.connect(configToUse);
      
      entry.status = 'connected';
      entry.lastConnected = new Date();
      entry.retryCount = 0;
      entry.switchAttempts = 0;
      
      this.startHealthCheck(serverId);
      this.emit('connectionModeSwitched', serverId, newMode);
      
      logger.info(`Successfully switched ${serverId} to ${newMode} mode`);

    } catch (error) {
      entry.status = 'error';
      entry.lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.error(`Failed to switch connection mode for ${serverId}:`, error);
      this.emit('connectionSwitchFailed', serverId, newMode, error);
      
      throw error;
    }
  }

  /**
   * Get connection adapter for a server
   */
  getConnection(serverId: string): ConnectionAdapter | undefined {
    return this.connections.get(serverId)?.adapter;
  }

  /**
   * Get connection information
   */
  getConnectionInfo(serverId: string): ConnectionInfo | undefined {
    const entry = this.connections.get(serverId);
    if (!entry) {
      return undefined;
    }

    return entry.adapter.getConnectionInfo();
  }

  /**
   * Get all connection information
   */
  getAllConnectionInfo(): Map<string, ConnectionInfo> {
    const info = new Map<string, ConnectionInfo>();
    
    for (const [serverId, entry] of this.connections) {
      info.set(serverId, entry.adapter.getConnectionInfo());
    }
    
    return info;
  }

  /**
   * Check if server is connected
   */
  isConnected(serverId: string): boolean {
    const entry = this.connections.get(serverId);
    return entry?.status === 'connected' && entry.adapter.isConnected;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(serverId: string): string | undefined {
    return this.connections.get(serverId)?.status;
  }

  // ============================================================================
  // Message and Command Handling
  // ============================================================================

  /**
   * Send message to server
   */
  async sendMessage(serverId: string, message: UWBPMessage): Promise<void> {
    const entry = this.connections.get(serverId);
    if (!entry || entry.status !== 'connected') {
      throw new ConnectionModeError(
        `Server ${serverId} is not connected`,
        (entry?.adapter.mode as ConnectionMode) || 'plugin',
        serverId
      );
    }

    await entry.adapter.sendMessage(message);
  }

  /**
   * Send command to server
   */
  async sendCommand(serverId: string, command: string): Promise<CommandResult> {
    const entry = this.connections.get(serverId);
    if (!entry || entry.status !== 'connected') {
      throw new ConnectionModeError(
        `Server ${serverId} is not connected`,
        (entry?.adapter.mode as ConnectionMode) || 'plugin',
        serverId
      );
    }

    return await entry.adapter.sendCommand(command);
  }

  // ============================================================================
  // Connection Recovery and Switching
  // ============================================================================

  private async attemptModeSwitch(serverId: string): Promise<void> {
    const entry = this.connections.get(serverId);
    if (!entry) {
      return;
    }

    const logger = this.ctx.logger('mochi-link:connection');
    const currentMode = entry.adapter.mode;
    const availableModes = this.getAvailableModes(entry.config.connectionConfig);
    const nextModes = this.config.preferredModeOrder.filter(
      mode => mode !== currentMode && availableModes.includes(mode)
    );

    if (nextModes.length === 0 || entry.switchAttempts >= nextModes.length) {
      logger.warn(`No more connection modes to try for ${serverId}, scheduling retry`);
      this.scheduleReconnect(serverId);
      return;
    }

    const nextMode = nextModes[entry.switchAttempts];
    entry.switchAttempts++;

    logger.info(`Attempting to switch ${serverId} from ${currentMode} to ${nextMode}`);

    try {
      await this.switchConnectionMode(serverId, nextMode);
    } catch (error) {
      logger.error(`Mode switch failed for ${serverId}:`, error);
      // Try next mode or retry
      await this.attemptModeSwitch(serverId);
    }
  }
  private scheduleReconnect(serverId: string): void {
    const entry = this.connections.get(serverId);
    if (!entry || entry.retryCount >= this.config.maxRetryAttempts) {
      if (entry) {
        this.emit('connectionFailed', serverId, entry.lastError);
      }
      return;
    }

    const delay = this.config.exponentialBackoff
      ? this.config.retryInterval * Math.pow(2, entry.retryCount)
      : this.config.retryInterval;

    const logger = this.ctx.logger('mochi-link:connection');
    logger.info(`Scheduling reconnect for ${serverId} in ${delay}ms (attempt ${entry.retryCount + 1})`);

    entry.retryTimer = setTimeout(async () => {
      entry.retryCount++;
      entry.status = 'connecting';
      
      try {
        await entry.adapter.connect(entry.config.connectionConfig);
        entry.status = 'connected';
        entry.lastConnected = new Date();
        entry.retryCount = 0;
        entry.switchAttempts = 0;
        
        this.startHealthCheck(serverId);
        this.emit('connectionRestored', serverId);
        
      } catch (error) {
        entry.status = 'error';
        entry.lastError = error instanceof Error ? error : new Error(String(error));
        
        if (this.config.autoSwitchOnFailure) {
          await this.attemptModeSwitch(serverId);
        } else {
          this.scheduleReconnect(serverId);
        }
      }
    }, delay);
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  private startHealthCheck(serverId: string): void {
    const entry = this.connections.get(serverId);
    if (!entry) {
      return;
    }

    entry.healthCheckTimer = setInterval(async () => {
      try {
        const isHealthy = entry.adapter.isHealthy();
        if (!isHealthy) {
          throw new Error('Health check failed');
        }
        
        this.emit('healthCheckPassed', serverId);
        
      } catch (error) {
        const logger = this.ctx.logger('mochi-link:connection');
        logger.warn(`Health check failed for ${serverId}:`, error);
        
        entry.status = 'error';
        entry.lastError = error instanceof Error ? error : new Error(String(error));
        
        this.emit('healthCheckFailed', serverId, error);
        
        // Attempt reconnection or mode switch
        if (this.config.autoSwitchOnFailure) {
          await this.attemptModeSwitch(serverId);
        } else {
          this.scheduleReconnect(serverId);
        }
      }
    }, this.config.healthCheckInterval);
  }

  // ============================================================================
  // Adapter Management
  // ============================================================================

  private createAdapter(serverId: string, mode: ConnectionMode): ConnectionAdapter {
    switch (mode) {
      case 'plugin':
        return new PluginConnectionAdapter(serverId);
      case 'rcon':
        return new RCONConnectionAdapter(serverId);
      case 'terminal':
        return new TerminalConnectionAdapter(serverId);
      default:
        throw new ConnectionModeError(
          `Unsupported connection mode: ${mode}`,
          mode,
          serverId
        );
    }
  }

  private setupAdapterHandlers(adapter: ConnectionAdapter, entry: ConnectionEntry): void {
    // Connection events
    adapter.on('connected', () => {
      this.emit('adapterConnected', adapter.serverId, adapter.mode);
    });

    adapter.on('disconnected', () => {
      this.emit('adapterDisconnected', adapter.serverId, adapter.mode);
    });

    adapter.on('error', (error) => {
      entry.lastError = error;
      this.emit('adapterError', adapter.serverId, adapter.mode, error);
    });

    // Message events
    adapter.on('message', (message) => {
      this.emit('message', adapter.serverId, message);
    });

    adapter.on('event', (event) => {
      this.emit('serverEvent', adapter.serverId, event);
    });

    // Mode-specific events
    if (adapter instanceof PluginConnectionAdapter) {
      adapter.on('capabilitiesUpdated', (capabilities) => {
        this.emit('capabilitiesUpdated', adapter.serverId, capabilities);
      });
    }

    if (adapter instanceof TerminalConnectionAdapter) {
      adapter.on('logLine', (logData) => {
        this.emit('logLine', adapter.serverId, logData);
      });

      adapter.on('serverEvent', (eventData) => {
        this.emit('parsedServerEvent', adapter.serverId, eventData);
      });
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getAvailableModes(config: ConnectionConfig): ConnectionMode[] {
    const modes: ConnectionMode[] = [];
    
    if (config.plugin) modes.push('plugin');
    if (config.rcon) modes.push('rcon');
    if (config.terminal) modes.push('terminal');
    
    return modes;
  }

  private extractModeConfig(config: ConnectionConfig, mode: ConnectionMode): ConnectionConfig | undefined {
    switch (mode) {
      case 'plugin':
        return config.plugin ? { plugin: config.plugin } : undefined;
      case 'rcon':
        return config.rcon ? { rcon: config.rcon } : undefined;
      case 'terminal':
        return config.terminal ? { terminal: config.terminal } : undefined;
      default:
        return undefined;
    }
  }

  private clearTimers(entry: ConnectionEntry): void {
    if (entry.retryTimer) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = undefined;
    }
    
    if (entry.healthCheckTimer) {
      clearInterval(entry.healthCheckTimer);
      entry.healthCheckTimer = undefined;
    }
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    connectedCount: number;
    disconnectedCount: number;
    errorCount: number;
    modeDistribution: Record<ConnectionMode, number>;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const stats = {
      totalConnections: this.connections.size,
      connectedCount: 0,
      disconnectedCount: 0,
      errorCount: 0,
      modeDistribution: { plugin: 0, rcon: 0, terminal: 0 } as Record<ConnectionMode, number>,
      healthStatus: 'healthy' as 'healthy' | 'degraded' | 'unhealthy'
    };

    for (const entry of this.connections.values()) {
      stats.modeDistribution[entry.adapter.mode]++;
      
      switch (entry.status) {
        case 'connected':
          stats.connectedCount++;
          break;
        case 'disconnected':
          stats.disconnectedCount++;
          break;
        case 'error':
          stats.errorCount++;
          break;
      }
    }

    // Determine overall health
    const errorRate = stats.errorCount / stats.totalConnections;
    if (errorRate > 0.5) {
      stats.healthStatus = 'unhealthy';
    } else if (errorRate > 0.2) {
      stats.healthStatus = 'degraded';
    }

    return stats;
  }

  /**
   * Cleanup all connections
   */
  async cleanup(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:connection');
    logger.info('Cleaning up connection manager');

    const disconnectPromises = Array.from(this.connections.keys()).map(serverId =>
      this.removeConnection(serverId)
    );

    await Promise.allSettled(disconnectPromises);
    
    this.connections.clear();
    this.emit('cleanup');
  }
}