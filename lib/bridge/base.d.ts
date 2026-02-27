/**
 * Base Connector Bridge
 *
 * Abstract base class that defines the unified interface for server operations
 * across different Minecraft server implementations (Java/Bedrock).
 */
import { EventEmitter } from 'events';
import { Player, PlayerDetail, CommandResult, ServerInfo, PerformanceMetrics, CoreType } from '../types/index';
import { BridgeCapability, BridgeInfo, BridgeConfig, PlayerAction, PlayerActionResult, WhitelistEntry, BanEntry, WorldOperation, WorldOperationResult, WorldSettings, ServerOperation, ServerOperationResult, PluginInfo, PluginOperation, PluginOperationResult, BridgeEvent } from './types';
export declare abstract class BaseConnectorBridge extends EventEmitter {
    protected config: BridgeConfig;
    protected isConnected: boolean;
    protected lastUpdate: Date;
    protected capabilities: Set<BridgeCapability>;
    constructor(config: BridgeConfig);
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
    /**
     * Get bridge information
     */
    getBridgeInfo(): BridgeInfo;
    /**
     * Check if a specific capability is supported
     */
    hasCapability(capability: BridgeCapability): boolean;
    /**
     * Get all supported capabilities
     */
    getCapabilities(): BridgeCapability[];
    /**
     * Check if the bridge is connected
     */
    isConnectedToBridge(): boolean;
    /**
     * Get the server ID
     */
    getServerId(): string;
    /**
     * Get the core type
     */
    getCoreType(): CoreType;
    /**
     * Execute a console command on the server
     */
    executeCommand(command: string, timeout?: number): Promise<CommandResult>;
    /**
     * Perform an action on a player
     */
    performPlayerAction(action: PlayerAction): Promise<PlayerActionResult>;
    /**
     * Get whitelist entries
     */
    getWhitelist(): Promise<WhitelistEntry[]>;
    /**
     * Add player to whitelist
     */
    addToWhitelist(playerId: string, playerName: string, reason?: string): Promise<boolean>;
    /**
     * Remove player from whitelist
     */
    removeFromWhitelist(playerId: string): Promise<boolean>;
    /**
     * Get ban list
     */
    getBanList(): Promise<BanEntry[]>;
    /**
     * Ban a player
     */
    banPlayer(playerId: string, reason: string, duration?: number): Promise<boolean>;
    /**
     * Unban a player
     */
    unbanPlayer(playerId: string): Promise<boolean>;
    /**
     * Perform a world operation
     */
    performWorldOperation(operation: WorldOperation): Promise<WorldOperationResult>;
    /**
     * Get world settings
     */
    getWorldSettings(worldName?: string): Promise<WorldSettings>;
    /**
     * Update world settings
     */
    updateWorldSettings(settings: Partial<WorldSettings>, worldName?: string): Promise<boolean>;
    /**
     * Perform a server operation
     */
    performServerOperation(operation: ServerOperation): Promise<ServerOperationResult>;
    /**
     * Get list of plugins
     */
    getPlugins(): Promise<PluginInfo[]>;
    /**
     * Perform a plugin operation
     */
    performPluginOperation(operation: PluginOperation): Promise<PluginOperationResult>;
    protected doExecuteCommand(_command: string, _timeout?: number): Promise<CommandResult>;
    protected doPlayerAction(_action: PlayerAction): Promise<PlayerActionResult>;
    protected doGetWhitelist(): Promise<WhitelistEntry[]>;
    protected doAddToWhitelist(_playerId: string, _playerName: string, _reason?: string): Promise<boolean>;
    protected doRemoveFromWhitelist(_playerId: string): Promise<boolean>;
    protected doGetBanList(): Promise<BanEntry[]>;
    protected doBanPlayer(_playerId: string, _reason: string, _duration?: number): Promise<boolean>;
    protected doUnbanPlayer(_playerId: string): Promise<boolean>;
    protected doWorldOperation(_operation: WorldOperation): Promise<WorldOperationResult>;
    protected doGetWorldSettings(_worldName?: string): Promise<WorldSettings>;
    protected doUpdateWorldSettings(_settings: Partial<WorldSettings>, _worldName?: string): Promise<boolean>;
    protected doServerOperation(_operation: ServerOperation): Promise<ServerOperationResult>;
    protected doGetPlugins(): Promise<PluginInfo[]>;
    protected doPluginOperation(_operation: PluginOperation): Promise<PluginOperationResult>;
    /**
     * Require a specific capability or throw an error
     */
    protected requireCapability(capability: BridgeCapability): void;
    /**
     * Update the last update timestamp
     */
    protected updateLastUpdate(): void;
    /**
     * Set connection status
     */
    protected setConnected(connected: boolean): void;
    /**
     * Add a capability
     */
    protected addCapability(capability: BridgeCapability): void;
    /**
     * Remove a capability
     */
    protected removeCapability(capability: BridgeCapability): void;
    /**
     * Emit a bridge event
     */
    protected emitBridgeEvent(event: BridgeEvent): void;
    /**
     * Create a bridge event
     */
    protected createBridgeEvent(type: string, data: Record<string, any>, source?: 'server' | 'plugin' | 'bridge'): BridgeEvent;
}
