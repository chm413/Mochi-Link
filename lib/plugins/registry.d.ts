/**
 * Plugin Integration Registry
 *
 * Registry for plugin integration factories that allows dynamic creation
 * of plugin integrations based on server configuration and availability.
 */
import { PluginType, PluginIntegration, PluginIntegrationFactory, PluginRegistry as IPluginRegistry, PluginConfig } from './types';
export declare class PluginRegistry implements IPluginRegistry {
    private factories;
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
    /**
     * Check if a plugin type is registered
     */
    isRegistered(type: PluginType): boolean;
    /**
     * Unregister a plugin integration factory
     */
    unregister(type: PluginType): boolean;
    /**
     * Clear all registered factories
     */
    clear(): void;
}
export declare const pluginRegistry: PluginRegistry;
