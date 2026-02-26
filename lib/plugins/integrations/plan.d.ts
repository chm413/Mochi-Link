/**
 * Plan Analytics Integration
 *
 * Integration with Plan analytics plugin to provide advanced server analytics,
 * player statistics, and performance monitoring data.
 */
import { PlanIntegration, PluginInfo, TimeRange, ServerAnalytics, PlayerAnalytics, PlayerSession, PerformanceData, PluginConfig, PluginIntegrationFactory, PluginCapability } from '../types';
export declare class PlanPlugin implements PlanIntegration {
    readonly name = "Plan";
    readonly type: "plan";
    readonly version: string;
    readonly capabilities: PluginCapability[];
    private bridge;
    private serverId;
    private _isAvailable;
    private planWebPort?;
    private planApiUrl?;
    constructor(config: PluginConfig);
    get isAvailable(): boolean;
    /**
     * Initialize the Plan integration
     */
    initialize(): Promise<void>;
    /**
     * Check if Plan is available and functional
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Get plugin information
     */
    getPluginInfo(): Promise<PluginInfo>;
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
    /**
     * Cleanup resources when shutting down
     */
    cleanup(): Promise<void>;
    /**
     * Detect Plan configuration from server
     */
    private detectPlanConfiguration;
    /**
     * Get default time range (last 30 days)
     */
    private getDefaultTimeRange;
    /**
     * Parse unique players count from command output
     */
    private parseUniquePlayersCount;
    /**
     * Parse total playtime from command output
     */
    private parseTotalPlaytime;
    /**
     * Parse session data from command output
     */
    private parseSessionData;
    /**
     * Parse player data from command output
     */
    private parsePlayerData;
    /**
     * Parse player sessions from command output
     */
    private parsePlayerSessions;
    /**
     * Parse player sessions list from command output
     */
    private parsePlayerSessionsList;
    /**
     * Parse performance data from command output
     */
    private parsePerformanceData;
    /**
     * Parse player count data from command output
     */
    private parsePlayerCountData;
    /**
     * Calculate activity index based on session data
     */
    private calculateActivityIndex;
}
/**
 * Factory for creating Plan integration instances
 */
export declare class PlanFactory implements PluginIntegrationFactory {
    create(config: PluginConfig): PlanPlugin;
}
