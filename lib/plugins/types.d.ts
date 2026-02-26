/**
 * Plugin Integration Types
 *
 * Type definitions for the plugin integration framework that allows
 * Mochi-Link to integrate with popular Minecraft plugins.
 */
export type PluginType = 'placeholderapi' | 'plan' | 'luckperms' | 'vault';
export interface PluginIntegration {
    readonly name: string;
    readonly type: PluginType;
    readonly version: string;
    readonly isAvailable: boolean;
    readonly capabilities: PluginCapability[];
    /**
     * Initialize the plugin integration
     */
    initialize(): Promise<void>;
    /**
     * Check if the plugin is available and functional
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Get plugin information
     */
    getPluginInfo(): Promise<PluginInfo>;
    /**
     * Cleanup resources when shutting down
     */
    cleanup(): Promise<void>;
}
export interface PluginInfo {
    name: string;
    version: string;
    description?: string;
    authors: string[];
    enabled: boolean;
    dependencies: string[];
    softDependencies?: string[];
    apiVersion?: string;
}
export type PluginCapability = 'placeholder_resolution' | 'analytics_data' | 'player_statistics' | 'permission_management' | 'group_management' | 'economy_balance' | 'economy_transactions' | 'vault_permissions' | 'vault_chat';
export interface PlaceholderAPIIntegration extends PluginIntegration {
    type: 'placeholderapi';
    /**
     * Resolve a placeholder for a specific player
     */
    resolvePlaceholder(playerId: string, placeholder: string): Promise<string | null>;
    /**
     * Resolve multiple placeholders for a player
     */
    resolvePlaceholders(playerId: string, placeholders: string[]): Promise<Record<string, string | null>>;
    /**
     * Get all available placeholders
     */
    getAvailablePlaceholders(): Promise<PlaceholderInfo[]>;
    /**
     * Register a custom placeholder
     */
    registerPlaceholder(identifier: string, handler: PlaceholderHandler): Promise<boolean>;
}
export interface PlaceholderInfo {
    identifier: string;
    plugin: string;
    description?: string;
    parameters?: string[];
}
export interface PlaceholderHandler {
    (playerId: string, params: string): Promise<string | null>;
}
export interface PlanIntegration extends PluginIntegration {
    type: 'plan';
    /**
     * Get server analytics data
     */
    getServerAnalytics(timeRange?: TimeRange): Promise<ServerAnalytics>;
    /**
     * Get player analytics data
     */
    getPlayerAnalytics(playerId: string, timeRange?: TimeRange): Promise<PlayerAnalytics>;
    /**
     * Get session data for a player
     */
    getPlayerSessions(playerId: string, limit?: number): Promise<PlayerSession[]>;
    /**
     * Get server performance data
     */
    getPerformanceData(timeRange?: TimeRange): Promise<PerformanceData>;
}
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface ServerAnalytics {
    serverId: string;
    timeRange: TimeRange;
    uniquePlayers: number;
    totalPlaytime: number;
    averagePlaytime: number;
    peakPlayers: number;
    newPlayers: number;
    retentionRate: number;
}
export interface PlayerAnalytics {
    playerId: string;
    playerName: string;
    timeRange: TimeRange;
    totalPlaytime: number;
    sessionCount: number;
    averageSessionLength: number;
    firstJoin: Date;
    lastSeen: Date;
    activityIndex: number;
}
export interface PlayerSession {
    sessionId: string;
    playerId: string;
    startTime: Date;
    endTime?: Date;
    duration: number;
    serverName: string;
    worldName: string;
    afkTime: number;
}
export interface PerformanceData {
    timeRange: TimeRange;
    averageTPS: number;
    minTPS: number;
    maxTPS: number;
    averageRAM: number;
    maxRAM: number;
    playerCounts: PlayerCountData[];
}
export interface PlayerCountData {
    timestamp: Date;
    playerCount: number;
}
export interface LuckPermsIntegration extends PluginIntegration {
    type: 'luckperms';
    /**
     * Get user permissions
     */
    getUserPermissions(playerId: string): Promise<UserPermissions>;
    /**
     * Check if user has a specific permission
     */
    hasPermission(playerId: string, permission: string, context?: PermissionContext): Promise<boolean>;
    /**
     * Get user's groups
     */
    getUserGroups(playerId: string): Promise<Group[]>;
    /**
     * Add user to a group
     */
    addUserToGroup(playerId: string, groupName: string, context?: PermissionContext): Promise<boolean>;
    /**
     * Remove user from a group
     */
    removeUserFromGroup(playerId: string, groupName: string, context?: PermissionContext): Promise<boolean>;
    /**
     * Get all available groups
     */
    getAllGroups(): Promise<Group[]>;
    /**
     * Get group information
     */
    getGroup(groupName: string): Promise<Group | null>;
}
export interface UserPermissions {
    playerId: string;
    playerName: string;
    permissions: Permission[];
    groups: Group[];
    primaryGroup: string;
    prefix?: string;
    suffix?: string;
    metadata: Record<string, string>;
}
export interface Permission {
    permission: string;
    value: boolean;
    context?: PermissionContext;
    expiry?: Date;
    source: 'user' | 'group' | 'default';
}
export interface Group {
    name: string;
    displayName?: string;
    weight: number;
    permissions: Permission[];
    parents: string[];
    prefix?: string;
    suffix?: string;
    metadata: Record<string, string>;
}
export interface PermissionContext {
    server?: string;
    world?: string;
    [key: string]: string | undefined;
}
export interface VaultIntegration extends PluginIntegration {
    type: 'vault';
    /**
     * Get player's balance
     */
    getBalance(playerId: string): Promise<number>;
    /**
     * Check if player has enough money
     */
    has(playerId: string, amount: number): Promise<boolean>;
    /**
     * Withdraw money from player
     */
    withdraw(playerId: string, amount: number, reason?: string): Promise<EconomyResult>;
    /**
     * Deposit money to player
     */
    deposit(playerId: string, amount: number, reason?: string): Promise<EconomyResult>;
    /**
     * Transfer money between players
     */
    transfer(fromPlayerId: string, toPlayerId: string, amount: number, reason?: string): Promise<EconomyResult>;
    /**
     * Get economy information
     */
    getEconomyInfo(): Promise<EconomyInfo>;
    /**
     * Get top balances
     */
    getTopBalances(limit?: number): Promise<BalanceEntry[]>;
}
export interface EconomyResult {
    success: boolean;
    amount: number;
    balance: number;
    error?: string;
    transactionId?: string;
}
export interface EconomyInfo {
    name: string;
    currencyName: string;
    currencySymbol: string;
    fractionalDigits: number;
    supportsBanks: boolean;
}
export interface BalanceEntry {
    playerId: string;
    playerName: string;
    balance: number;
    rank: number;
}
export interface PluginManager {
    /**
     * Initialize all plugin integrations
     */
    initialize(): Promise<void>;
    /**
     * Register a plugin integration
     */
    registerIntegration(integration: PluginIntegration): void;
    /**
     * Get a plugin integration by type
     */
    getIntegration<T extends PluginIntegration>(type: PluginType): T | null;
    /**
     * Check if a plugin type is available
     */
    isAvailable(type: PluginType): boolean;
    /**
     * Get all available integrations
     */
    getAvailableIntegrations(): PluginIntegration[];
    /**
     * Refresh plugin availability
     */
    refreshAvailability(): Promise<void>;
    /**
     * Cleanup all integrations
     */
    cleanup(): Promise<void>;
}
export interface PluginRegistry {
    /**
     * Register a plugin integration factory
     */
    register(type: PluginType, factory: PluginIntegrationFactory): void;
    /**
     * Create a plugin integration instance
     */
    create(type: PluginType, config: PluginConfig): PluginIntegration | null;
    /**
     * Get all registered plugin types
     */
    getRegisteredTypes(): PluginType[];
}
export interface PluginIntegrationFactory {
    create(config: PluginConfig): PluginIntegration;
}
export interface PluginConfig {
    serverId: string;
    bridge: any;
    settings?: Record<string, any>;
}
export declare class PluginIntegrationError extends Error {
    pluginType: PluginType;
    code: string;
    details?: any | undefined;
    constructor(message: string, pluginType: PluginType, code: string, details?: any | undefined);
}
export declare class PluginNotAvailableError extends PluginIntegrationError {
    constructor(pluginType: PluginType);
}
export declare class PluginOperationError extends PluginIntegrationError {
    constructor(pluginType: PluginType, operation: string, error: string);
}
