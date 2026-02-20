/**
 * Plugin Integration Service
 *
 * Service that manages plugin integrations for each server bridge,
 * providing a unified interface for accessing plugin functionality.
 */
import { EventEmitter } from 'events';
import { BaseConnectorBridge } from '../bridge/base';
import { PluginType, PlaceholderAPIIntegration, PlanIntegration, LuckPermsIntegration, VaultIntegration } from '../plugins';
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
     * NOTE: Plugin integration is not yet implemented in basic mode
     */
    createPluginManager(bridge: BaseConnectorBridge): Promise<any>;
    /**
     * Get plugin manager for a server
     */
    getPluginManager(serverId: string): any | null;
    /**
     * Get all plugin managers
     */
    getAllPluginManagers(): Map<string, any>;
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
     * NOTE: Not implemented in basic mode
     */
    private setupEventForwarding;
}
export declare const pluginIntegrationService: PluginIntegrationService;
