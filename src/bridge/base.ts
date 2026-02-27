/**
 * Base Connector Bridge
 * 
 * Abstract base class that defines the unified interface for server operations
 * across different Minecraft server implementations (Java/Bedrock).
 */

import { EventEmitter } from 'events';
import { 
  Player, 
  PlayerDetail, 
  CommandResult, 
  ServerInfo, 
  PerformanceMetrics,
  CoreType 
} from '../types/index';
import {
  BridgeCapability,
  BridgeInfo,
  BridgeConfig,
  PlayerAction,
  PlayerActionResult,
  WhitelistEntry,
  BanEntry,
  WorldOperation,
  WorldOperationResult,
  WorldSettings,
  ServerOperation,
  ServerOperationResult,
  PluginInfo,
  PluginOperation,
  PluginOperationResult,
  BridgeEvent,
  UnsupportedOperationError
} from './types';

// ============================================================================
// Base Connector Bridge Class
// ============================================================================

export abstract class BaseConnectorBridge extends EventEmitter {
  protected config: BridgeConfig;
  protected isConnected: boolean = false;
  protected lastUpdate: Date = new Date();
  protected capabilities: Set<BridgeCapability> = new Set();

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
    this.initializeCapabilities();
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================

  /**
   * Initialize the bridge connection
   */
  abstract connect(): Promise<void>;

  /**
   * Close the bridge connection
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if the bridge is healthy and responsive
   */
  abstract isHealthy(): Promise<boolean>;

  /**
   * Get current server information
   */
  abstract getServerInfo(): Promise<ServerInfo>;

  /**
   * Get current performance metrics
   */
  abstract getPerformanceMetrics(): Promise<PerformanceMetrics>;

  /**
   * Get list of online players
   */
  abstract getOnlinePlayers(): Promise<Player[]>;

  /**
   * Get detailed information about a specific player
   */
  abstract getPlayerDetail(playerId: string): Promise<PlayerDetail | null>;

  /**
   * Initialize capabilities based on server type and version
   */
  protected abstract initializeCapabilities(): void;

  // ============================================================================
  // Public Interface Methods
  // ============================================================================

  /**
   * Get bridge information
   */
  getBridgeInfo(): BridgeInfo {
    return {
      serverId: this.config.serverId,
      coreType: this.config.coreType,
      coreName: this.config.coreName,
      coreVersion: this.config.coreVersion,
      capabilities: Array.from(this.capabilities),
      protocolVersion: '2.0',
      isOnline: this.isConnected,
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * Check if a specific capability is supported
   */
  hasCapability(capability: BridgeCapability): boolean {
    return this.capabilities.has(capability);
  }

  /**
   * Get all supported capabilities
   */
  getCapabilities(): BridgeCapability[] {
    return Array.from(this.capabilities);
  }

  /**
   * Check if the bridge is connected
   */
  isConnectedToBridge(): boolean {
    return this.isConnected;
  }

  /**
   * Get the server ID
   */
  getServerId(): string {
    return this.config.serverId;
  }

  /**
   * Get the core type
   */
  getCoreType(): CoreType {
    return this.config.coreType;
  }

  // ============================================================================
  // Command Execution Methods
  // ============================================================================

  /**
   * Execute a console command on the server
   */
  async executeCommand(command: string, timeout?: number): Promise<CommandResult> {
    this.requireCapability('command_execution');
    
    try {
      const result = await this.doExecuteCommand(command, timeout);
      this.updateLastUpdate();
      return result;
    } catch (error) {
      throw new Error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // Player Management Methods
  // ============================================================================

  /**
   * Perform an action on a player
   */
  async performPlayerAction(action: PlayerAction): Promise<PlayerActionResult> {
    this.requireCapability('player_management');
    
    try {
      const result = await this.doPlayerAction(action);
      this.emit('playerAction', result);
      return result;
    } catch (error) {
      const result: PlayerActionResult = {
        success: false,
        action,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
      this.emit('playerActionError', result);
      return result;
    }
  }
  // ============================================================================
  // Command Execution Methods
  // ============================================================================

  /**
   * Get whitelist entries
   */
  async getWhitelist(): Promise<WhitelistEntry[]> {
    this.requireCapability('whitelist_management');
    return this.doGetWhitelist();
  }

  /**
   * Add player to whitelist
   */
  async addToWhitelist(playerId: string, playerName: string, reason?: string): Promise<boolean> {
    this.requireCapability('whitelist_management');
    return this.doAddToWhitelist(playerId, playerName, reason);
  }

  /**
   * Remove player from whitelist
   */
  async removeFromWhitelist(playerId: string): Promise<boolean> {
    this.requireCapability('whitelist_management');
    return this.doRemoveFromWhitelist(playerId);
  }

  /**
   * Get ban list
   */
  async getBanList(): Promise<BanEntry[]> {
    this.requireCapability('ban_management');
    return this.doGetBanList();
  }

  /**
   * Ban a player
   */
  async banPlayer(playerId: string, reason: string, duration?: number): Promise<boolean> {
    this.requireCapability('ban_management');
    return this.doBanPlayer(playerId, reason, duration);
  }

  /**
   * Unban a player
   */
  async unbanPlayer(playerId: string): Promise<boolean> {
    this.requireCapability('ban_management');
    return this.doUnbanPlayer(playerId);
  }

  // ============================================================================
  // World Management Methods
  // ============================================================================

  /**
   * Perform a world operation
   */
  async performWorldOperation(operation: WorldOperation): Promise<WorldOperationResult> {
    this.requireCapability('world_management');
    
    try {
      const result = await this.doWorldOperation(operation);
      this.emit('worldOperation', result);
      return result;
    } catch (error) {
      const result: WorldOperationResult = {
        success: false,
        operation,
        timestamp: new Date(),
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      };
      this.emit('worldOperationError', result);
      return result;
    }
  }

  /**
   * Get world settings
   */
  async getWorldSettings(worldName?: string): Promise<WorldSettings> {
    this.requireCapability('world_management');
    return this.doGetWorldSettings(worldName);
  }

  /**
   * Update world settings
   */
  async updateWorldSettings(settings: Partial<WorldSettings>, worldName?: string): Promise<boolean> {
    this.requireCapability('world_management');
    return this.doUpdateWorldSettings(settings, worldName);
  }

  // ============================================================================
  // Server Control Methods
  // ============================================================================

  /**
   * Perform a server operation
   */
  async performServerOperation(operation: ServerOperation): Promise<ServerOperationResult> {
    this.requireCapability('server_control');
    
    try {
      const result = await this.doServerOperation(operation);
      this.emit('serverOperation', result);
      return result;
    } catch (error) {
      const result: ServerOperationResult = {
        success: false,
        operation,
        timestamp: new Date(),
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      };
      this.emit('serverOperationError', result);
      return result;
    }
  }

  // ============================================================================
  // Plugin Integration Methods
  // ============================================================================

  /**
   * Get list of plugins
   */
  async getPlugins(): Promise<PluginInfo[]> {
    this.requireCapability('plugin_integration');
    return this.doGetPlugins();
  }

  /**
   * Perform a plugin operation
   */
  async performPluginOperation(operation: PluginOperation): Promise<PluginOperationResult> {
    this.requireCapability('plugin_integration');
    
    try {
      const result = await this.doPluginOperation(operation);
      this.emit('pluginOperation', result);
      return result;
    } catch (error) {
      const result: PluginOperationResult = {
        success: false,
        operation,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
      this.emit('pluginOperationError', result);
      return result;
    }
  }

  // ============================================================================
  // Protected Methods - To be implemented by subclasses
  // ============================================================================

  protected async doExecuteCommand(_command: string, _timeout?: number): Promise<CommandResult> {
    throw new UnsupportedOperationError('executeCommand', this.config.serverId, this.config.coreType);
  }

  protected async doPlayerAction(_action: PlayerAction): Promise<PlayerActionResult> {
    throw new UnsupportedOperationError('playerAction', this.config.serverId, this.config.coreType);
  }

  protected async doGetWhitelist(): Promise<WhitelistEntry[]> {
    throw new UnsupportedOperationError('getWhitelist', this.config.serverId, this.config.coreType);
  }

  protected async doAddToWhitelist(_playerId: string, _playerName: string, _reason?: string): Promise<boolean> {
    throw new UnsupportedOperationError('addToWhitelist', this.config.serverId, this.config.coreType);
  }

  protected async doRemoveFromWhitelist(_playerId: string): Promise<boolean> {
    throw new UnsupportedOperationError('removeFromWhitelist', this.config.serverId, this.config.coreType);
  }

  protected async doGetBanList(): Promise<BanEntry[]> {
    throw new UnsupportedOperationError('getBanList', this.config.serverId, this.config.coreType);
  }

  protected async doBanPlayer(_playerId: string, _reason: string, _duration?: number): Promise<boolean> {
    throw new UnsupportedOperationError('banPlayer', this.config.serverId, this.config.coreType);
  }

  protected async doUnbanPlayer(_playerId: string): Promise<boolean> {
    throw new UnsupportedOperationError('unbanPlayer', this.config.serverId, this.config.coreType);
  }

  protected async doWorldOperation(_operation: WorldOperation): Promise<WorldOperationResult> {
    throw new UnsupportedOperationError('worldOperation', this.config.serverId, this.config.coreType);
  }

  protected async doGetWorldSettings(_worldName?: string): Promise<WorldSettings> {
    throw new UnsupportedOperationError('getWorldSettings', this.config.serverId, this.config.coreType);
  }

  protected async doUpdateWorldSettings(_settings: Partial<WorldSettings>, _worldName?: string): Promise<boolean> {
    throw new UnsupportedOperationError('updateWorldSettings', this.config.serverId, this.config.coreType);
  }

  protected async doServerOperation(_operation: ServerOperation): Promise<ServerOperationResult> {
    throw new UnsupportedOperationError('serverOperation', this.config.serverId, this.config.coreType);
  }

  protected async doGetPlugins(): Promise<PluginInfo[]> {
    throw new UnsupportedOperationError('getPlugins', this.config.serverId, this.config.coreType);
  }

  protected async doPluginOperation(_operation: PluginOperation): Promise<PluginOperationResult> {
    throw new UnsupportedOperationError('pluginOperation', this.config.serverId, this.config.coreType);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Require a specific capability or throw an error
   */
  protected requireCapability(capability: BridgeCapability): void {
    if (!this.hasCapability(capability)) {
      throw new UnsupportedOperationError(
        capability,
        this.config.serverId,
        this.config.coreType
      );
    }
  }

  /**
   * Update the last update timestamp
   */
  protected updateLastUpdate(): void {
    this.lastUpdate = new Date();
  }

  /**
   * Set connection status
   */
  protected setConnected(connected: boolean): void {
    const wasConnected = this.isConnected;
    this.isConnected = connected;
    
    if (wasConnected !== connected) {
      this.emit(connected ? 'connected' : 'disconnected');
    }
    
    this.updateLastUpdate();
  }

  /**
   * Add a capability
   */
  protected addCapability(capability: BridgeCapability): void {
    this.capabilities.add(capability);
  }

  /**
   * Remove a capability
   */
  protected removeCapability(capability: BridgeCapability): void {
    this.capabilities.delete(capability);
  }

  /**
   * Emit a bridge event
   */
  protected emitBridgeEvent(event: BridgeEvent): void {
    this.emit('bridgeEvent', event);
    this.emit(`bridgeEvent:${event.type}`, event);
  }

  /**
   * Create a bridge event
   */
  protected createBridgeEvent(type: string, data: Record<string, any>, source: 'server' | 'plugin' | 'bridge' = 'bridge'): BridgeEvent {
    return {
      type,
      serverId: this.config.serverId,
      timestamp: new Date(),
      data,
      source
    };
  }
}