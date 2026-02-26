"use strict";
/**
 * Plugin Integration Registry
 *
 * Registry for plugin integration factories that allows dynamic creation
 * of plugin integrations based on server configuration and availability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRegistry = exports.PluginRegistry = void 0;
class PluginRegistry {
    constructor() {
        this.factories = new Map();
    }
    /**
     * Register a plugin integration factory
     */
    register(type, factory) {
        this.factories.set(type, factory);
    }
    /**
     * Create a plugin integration instance
     */
    create(type, config) {
        const factory = this.factories.get(type);
        if (!factory) {
            return null;
        }
        try {
            return factory.create(config);
        }
        catch (error) {
            console.error(`Failed to create plugin integration for ${type}:`, error);
            return null;
        }
    }
    /**
     * Get all registered plugin types
     */
    getRegisteredTypes() {
        return Array.from(this.factories.keys());
    }
    /**
     * Check if a plugin type is registered
     */
    isRegistered(type) {
        return this.factories.has(type);
    }
    /**
     * Unregister a plugin integration factory
     */
    unregister(type) {
        return this.factories.delete(type);
    }
    /**
     * Clear all registered factories
     */
    clear() {
        this.factories.clear();
    }
}
exports.PluginRegistry = PluginRegistry;
// Global registry instance
exports.pluginRegistry = new PluginRegistry();
