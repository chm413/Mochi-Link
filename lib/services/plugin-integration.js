"use strict";
/**
 * Plugin Integration Service
 *
 * Service that manages plugin integrations for each server bridge,
 * providing a unified interface for accessing plugin functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginIntegrationService = exports.PluginIntegrationService = void 0;
const events_1 = require("events");
const integrations_1 = require("../plugins/integrations");
const registry_1 = require("../plugins/registry");
class PluginIntegrationService extends events_1.EventEmitter {
    constructor() {
        super();
        this.pluginManagers = new Map();
        this.initialized = false;
        this.registerPluginFactories();
    }
    /**
     * Initialize the plugin integration service
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.emit('initialized');
    }
    /**
     * Create and initialize plugin manager for a server bridge
     */
    async createPluginManager(bridge) {
        const serverId = bridge.getServerId();
        // Check if manager already exists
        if (this.pluginManagers.has(serverId)) {
            return this.pluginManagers.get(serverId);
        }
        // Create plugin configuration
        const config = {
            serverId,
            bridge,
            settings: {
                // Add any plugin-specific settings here
                planWebPort: 8804, // Default Plan web port
            }
        };
        // Create and initialize plugin manager
        const manager = new plugins_1.PluginManager(config);
        await manager.initialize();
        // Store the manager
        this.pluginManagers.set(serverId, manager);
        // Set up event forwarding
        this.setupEventForwarding(manager, serverId);
        return manager;
    }
    /**
     * Get plugin manager for a server
     */
    getPluginManager(serverId) {
        return this.pluginManagers.get(serverId) || null;
    }
    /**
     * Get all plugin managers
     */
    getAllPluginManagers() {
        return new Map(this.pluginManagers);
    }
    /**
     * Remove plugin manager for a server
     */
    async removePluginManager(serverId) {
        const manager = this.pluginManagers.get(serverId);
        if (manager) {
            await manager.cleanup();
            this.pluginManagers.delete(serverId);
            this.emit('managerRemoved', { serverId });
        }
    }
    /**
     * Get PlaceholderAPI integration for a server
     */
    getPlaceholderAPI(serverId) {
        const manager = this.getPluginManager(serverId);
        return manager ? manager.getIntegration('placeholderapi') : null;
    }
    /**
     * Get Plan integration for a server
     */
    getPlan(serverId) {
        const manager = this.getPluginManager(serverId);
        return manager ? manager.getIntegration('plan') : null;
    }
    /**
     * Get LuckPerms integration for a server
     */
    getLuckPerms(serverId) {
        const manager = this.getPluginManager(serverId);
        return manager ? manager.getIntegration('luckperms') : null;
    }
    /**
     * Get Vault integration for a server
     */
    getVault(serverId) {
        const manager = this.getPluginManager(serverId);
        return manager ? manager.getIntegration('vault') : null;
    }
    /**
     * Check if a plugin is available for a server
     */
    isPluginAvailable(serverId, pluginType) {
        const manager = this.getPluginManager(serverId);
        return manager ? manager.isAvailable(pluginType) : false;
    }
    /**
     * Get plugin status summary for all servers
     */
    getGlobalPluginStatus() {
        const status = {};
        for (const [serverId, manager] of this.pluginManagers) {
            status[serverId] = {
                placeholderapi: manager.isAvailable('placeholderapi'),
                plan: manager.isAvailable('plan'),
                luckperms: manager.isAvailable('luckperms'),
                vault: manager.isAvailable('vault')
            };
        }
        return status;
    }
    /**
     * Refresh plugin availability for all servers
     */
    async refreshAllPluginAvailability() {
        const refreshPromises = Array.from(this.pluginManagers.values()).map(manager => manager.refreshAvailability());
        await Promise.allSettled(refreshPromises);
    }
    /**
     * Cleanup all plugin managers
     */
    async cleanup() {
        const cleanupPromises = Array.from(this.pluginManagers.values()).map(manager => manager.cleanup());
        await Promise.allSettled(cleanupPromises);
        this.pluginManagers.clear();
        this.initialized = false;
        this.emit('cleanup');
    }
    /**
     * Register plugin integration factories
     */
    registerPluginFactories() {
        registry_1.pluginRegistry.register('placeholderapi', new integrations_1.PlaceholderAPIFactory());
        registry_1.pluginRegistry.register('plan', new integrations_1.PlanFactory());
        registry_1.pluginRegistry.register('luckperms', new integrations_1.LuckPermsFactory());
        registry_1.pluginRegistry.register('vault', new integrations_1.VaultFactory());
    }
    /**
     * Set up event forwarding from plugin manager
     */
    setupEventForwarding(manager, serverId) {
        manager.on('initialized', () => {
            this.emit('pluginManagerInitialized', { serverId });
        });
        manager.on('integrationInitialized', (data) => {
            this.emit('pluginIntegrationInitialized', { serverId, ...data });
        });
        manager.on('integrationError', (data) => {
            this.emit('pluginIntegrationError', { serverId, ...data });
        });
        manager.on('availabilityChanged', (data) => {
            this.emit('pluginAvailabilityChanged', { serverId, ...data });
        });
        manager.on('cleanup', () => {
            this.emit('pluginManagerCleanup', { serverId });
        });
    }
}
exports.PluginIntegrationService = PluginIntegrationService;
// Global plugin integration service instance
exports.pluginIntegrationService = new PluginIntegrationService();
