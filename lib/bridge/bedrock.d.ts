/**
 * Bedrock Edition Connector Bridge
 *
 * Implementation for Bedrock Edition servers (LLBDS, PMMP, etc.)
 * Provides unified interface for server operations.
 */
import { Player, PlayerDetail, CommandResult, ServerInfo, PerformanceMetrics } from '../types/index';
import { BaseConnectorBridge } from './base';
import { BridgeConfig, PlayerAction, PlayerActionResult, WhitelistEntry, BanEntry, WorldOperation, WorldOperationResult, WorldSettings, ServerOperation, ServerOperationResult, PluginInfo, PluginOperation, PluginOperationResult } from './types';
export declare class BedrockConnectorBridge extends BaseConnectorBridge {
    private connectionAdapter;
    private serverCache;
    private lastMetricsUpdate;
    private metricsCache?;
    constructor(config: BridgeConfig, connectionAdapter?: any);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isHealthy(): Promise<boolean>;
    getServerInfo(): Promise<ServerInfo>;
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    executeCommand(command: string, timeout?: number): Promise<CommandResult>;
    getOnlinePlayers(): Promise<Player[]>;
    getPlayerDetail(playerId: string): Promise<PlayerDetail | null>;
    protected initializeCapabilities(): void;
    protected doPlayerAction(action: PlayerAction): Promise<PlayerActionResult>;
    protected doGetWhitelist(): Promise<WhitelistEntry[]>;
    protected doAddToWhitelist(playerId: string, playerName: string, reason?: string): Promise<boolean>;
    protected doRemoveFromWhitelist(playerId: string): Promise<boolean>;
    protected doGetBanList(): Promise<BanEntry[]>;
    protected doBanPlayer(playerId: string, reason: string, duration?: number): Promise<boolean>;
    protected doUnbanPlayer(playerId: string): Promise<boolean>;
    protected doWorldOperation(operation: WorldOperation): Promise<WorldOperationResult>;
    protected doGetWorldSettings(worldName?: string): Promise<WorldSettings>;
    protected doUpdateWorldSettings(settings: Partial<WorldSettings>, worldName?: string): Promise<boolean>;
    protected doServerOperation(operation: ServerOperation): Promise<ServerOperationResult>;
    protected doGetPlugins(): Promise<PluginInfo[]>;
    protected doPluginOperation(operation: PluginOperation): Promise<PluginOperationResult>;
    private requireConnection;
    private initializeServerInfo;
    private setupEventListeners;
    private handleServerEvent;
    private parseVersionInfo;
    private parsePlayerList;
    private parsePlayerNames;
    private parsePerformanceInfo;
    private getWorldInfo;
    private getBasicPlayerInfo;
    private parseWhitelistEntries;
    private parseBanEntries;
    private parsePluginList;
    private parseLLBDSPluginList;
}
