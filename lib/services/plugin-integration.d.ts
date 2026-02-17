/**
 * Plugin Integration Service
 *
 * Service that manages plugin integrations for each server bridge,
 * providing a unified interface for accessing plugin functionality.
 */
import { EventEmitter } from 'events';
import { BaseConnectorBridge } from '../bridge/base';
import { PluginManager, PluginType, PlaceholderAPIIntegration, PlanIntegration, LuckPermsIntegration, VaultIntegration } from '../plugins';
export declare class PluginIntegrationService extends EventEmitter {
    private pluginManagers;
    private initialized;
    constructor();
    /**
     * Initialize the plugin integration service
     */
    initialize(): Promise<void>;
    /**
     * Create and initialize plugin manager for a server bridge
     */
    createPluginManager(bridge: BaseConnectorBridge): Promise<PluginManager>;
    /**
     * Get plugin manager for a server
     */
    getPluginManager(serverId: string): PluginManager | null;
    /**
     * Get all plugin managers
     */
    getAllPluginManagers(): Map<string, PluginManager>;
    /**
     * Remove plugin manager for a server
     */
    removePluginManager(serverId: string): Promise<void>;
    /**
     * Get PlaceholderAPI integration for a server
     */
    getPlaceholderAPI(serverId: string): PlaceholderAPIIntegration | null;
    /**
     * Get Plan integration for a server
     */
    getPlan(serverId: string): PlanIntegration | null;
    /**
     * Get LuckPerms integration for a server
     */
    getLuckPerms(serverId: string): LuckPermsIntegration | null;
    /**
     * Get Vault integration for a server
     */
    getVault(serverId: string): VaultIntegration | null;
    /**
     * Check if a plugin is available for a server
     */
    isPluginAvailable(serverId: string, pluginType: PluginType): boolean;
    /**
     * Get plugin status summary for all servers
     */
    getGlobalPluginStatus(): Record<string, Record<PluginType, boolean>>;
    /**
     * Refresh plugin availability for all servers
     */
    refreshAllPluginAvailability(): Promise<void>;
    /**
     * Cleanup all plugin managers
     */
    cleanup(): Promise<void>;
    /**
     * Register plugin integration factories
     */
    private registerPluginFactories;
    /**
     * Set up event forwarding from plugin manager
     */
    private setupEventForwarding;
}
export declare const pluginIntegrationService: PluginIntegrationService;
