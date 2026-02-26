/**
 * PlaceholderAPI Integration
 *
 * Integration with PlaceholderAPI (PAPI) to provide dynamic placeholder resolution
 * for server information, player data, and custom placeholders.
 */
import { PlaceholderAPIIntegration, PluginInfo, PlaceholderInfo, PlaceholderHandler, PluginConfig, PluginIntegrationFactory, PluginCapability } from '../types';
export declare class PlaceholderAPIPlugin implements PlaceholderAPIIntegration {
    readonly name = "PlaceholderAPI";
    readonly type: "placeholderapi";
    readonly version: string;
    readonly capabilities: PluginCapability[];
    private bridge;
    private serverId;
    private _isAvailable;
    private placeholderHandlers;
    constructor(config: PluginConfig);
    get isAvailable(): boolean;
    /**
     * Initialize the PlaceholderAPI integration
     */
    initialize(): Promise<void>;
    /**
     * Check if PlaceholderAPI is available and functional
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Get plugin information
     */
    getPluginInfo(): Promise<PluginInfo>;
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
    /**
     * Cleanup resources when shutting down
     */
    cleanup(): Promise<void>;
    /**
     * Register built-in placeholders for Mochi-Link
     */
    private registerBuiltInPlaceholders;
    /**
     * Get built-in placeholder information
     */
    private getBuiltInPlaceholders;
    /**
     * Find a local placeholder handler
     */
    private findLocalHandler;
    /**
     * Extract parameters from a placeholder
     */
    private extractPlaceholderParams;
}
/**
 * Factory for creating PlaceholderAPI integration instances
 */
export declare class PlaceholderAPIFactory implements PluginIntegrationFactory {
    create(config: PluginConfig): PlaceholderAPIPlugin;
}
