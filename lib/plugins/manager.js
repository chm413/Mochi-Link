"use strict";
/**
 * Plugin Integration Manager
 *
 * Manages all plugin integrations, handles initialization, availability checking,
 * and provides a unified interface for accessing plugin functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginManager = void 0;
const events_1 = require("events");
const types_1 = require("./types");
const registry_1 = require("./registry");
class PluginManager extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.integrations = new Map();
        this.initialized = false;
        this.config = config;
    }
    /**
     * Initialize all plugin integrations
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        const registeredTypes = registry_1.pluginRegistry.getRegisteredTypes();
        const initPromises = [];
        for (const type of registeredTypes) {
            const integration = registry_1.pluginRegistry.create(type, this.config);
            if (integration) {
                this.integrations.set(type, integration);
                initPromises.push(this.initializeIntegration(integration));
            }
        }
        await Promise.allSettled(initPromises);
        this.initialized = true;
        this.emit('initialized');
    }
    /**
     * Register a plugin integration
     */
    registerIntegration(integration) {
        this.integrations.set(integration.type, integration);
        if (this.initialized) {
            // Initialize immediately if manager is already initialized
            this.initializeIntegration(integration).catch(error => {
                console.error(`Failed to initialize plugin integration ${integration.type}:`, error);
            });
        }
    }
    /**
     * Get a plugin integration by type
     */
    getIntegration(type) {
        const integration = this.integrations.get(type);
        return integration ? integration : null;
    }
    /**
     * Check if a plugin type is available
     */
    isAvailable(type) {
        const integration = this.integrations.get(type);
        return integration ? integration.isAvailable : false;
    }
    /**
     * Get all available integrations
     */
    getAvailableIntegrations() {
        return Array.from(this.integrations.values()).filter(integration => integration.isAvailable);
    }
    /**
     * Get all integrations (available and unavailable)
     */
    getAllIntegrations() {
        return Array.from(this.integrations.values());
    }
    /**
     * Refresh plugin availability
     */
    async refreshAvailability() {
        const checkPromises = Array.from(this.integrations.values()).map(async (integration) => {
            try {
                const wasAvailable = integration.isAvailable;
                const isAvailable = await integration.checkAvailability();
                if (wasAvailable !== isAvailable) {
                    this.emit('availabilityChanged', {
                        type: integration.type,
                        name: integration.name,
                        isAvailable,
                        wasAvailable
                    });
                }
            }
            catch (error) {
                console.error(`Failed to check availability for ${integration.type}:`, error);
            }
        });
        await Promise.allSettled(checkPromises);
    }
    /**
     * Cleanup all integrations
     */
    async cleanup() {
        const cleanupPromises = Array.from(this.integrations.values()).map(async (integration) => {
            try {
                await integration.cleanup();
            }
            catch (error) {
                console.error(`Failed to cleanup plugin integration ${integration.type}:`, error);
            }
        });
        await Promise.allSettled(cleanupPromises);
        this.integrations.clear();
        this.initialized = false;
        this.emit('cleanup');
    }
    /**
     * Require a plugin integration (throws if not available)
     */
    requireIntegration(type) {
        const integration = this.getIntegration(type);
        if (!integration || !integration.isAvailable) {
            throw new types_1.PluginNotAvailableError(type);
        }
        return integration;
    }
    /**
     * Get plugin capabilities summary
     */
    getCapabilitiesSummary() {
        const summary = {};
        for (const [type, integration] of this.integrations) {
            summary[type] = integration.isAvailable ? integration.capabilities : [];
        }
        return summary;
    }
    /**
     * Get plugin status summary
     */
    getStatusSummary() {
        const summary = {};
        for (const [type, integration] of this.integrations) {
            summary[type] = {
                name: integration.name,
                version: integration.version,
                isAvailable: integration.isAvailable,
                capabilities: integration.capabilities
            };
        }
        return summary;
    }
    /**
     * Initialize a single integration
     */
    async initializeIntegration(integration) {
        try {
            await integration.initialize();
            this.emit('integrationInitialized', {
                type: integration.type,
                name: integration.name,
                isAvailable: integration.isAvailable
            });
        }
        catch (error) {
            console.error(`Failed to initialize plugin integration ${integration.type}:`, error);
            this.emit('integrationError', {
                type: integration.type,
                name: integration.name,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
exports.PluginManager = PluginManager;
