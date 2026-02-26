/**
 * Plugin Integration Manager
 *
 * Manages all plugin integrations, handles initialization, availability checking,
 * and provides a unified interface for accessing plugin functionality.
 */
import { EventEmitter } from 'events';
import { PluginType, PluginIntegration, PluginManager as IPluginManager, PluginConfig } from './types';
export declare class PluginManager extends EventEmitter implements IPluginManager {
    private integrations;
    private config;
    private initialized;
    constructor(config: PluginConfig);
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
     * Get all integrations (available and unavailable)
     */
    getAllIntegrations(): PluginIntegration[];
    /**
     * Refresh plugin availability
     */
    refreshAvailability(): Promise<void>;
    /**
     * Cleanup all integrations
     */
    cleanup(): Promise<void>;
    /**
     * Require a plugin integration (throws if not available)
     */
    requireIntegration<T extends PluginIntegration>(type: PluginType): T;
    /**
     * Get plugin capabilities summary
     */
    getCapabilitiesSummary(): Record<PluginType, string[]>;
    /**
     * Get plugin status summary
     */
    getStatusSummary(): Record<PluginType, PluginStatus>;
    /**
     * Initialize a single integration
     */
    private initializeIntegration;
}
interface PluginStatus {
    name: string;
    version: string;
    isAvailable: boolean;
    capabilities: string[];
}
export {};
