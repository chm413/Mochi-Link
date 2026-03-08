"use strict";
/**
 * Plugin Integration Service
 *
 * Service that manages plugin integrations for each server bridge,
 * providing a unified interface for accessing plugin functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginIntegrationService = void 0;
const events_1 = require("events");
const integrations_1 = require("../plugins/integrations");
const registry_1 = require("../plugins/registry");
class PluginIntegrationService extends events_1.EventEmitter {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.pluginManagers = new Map();
        this.initialized = false;
        this.logger = ctx.logger('mochi-link:plugin-integration');
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
     * NOTE: Plugin integration is not yet implemented in basic mode
     */
    async createPluginManager(bridge) {
        const serverId = bridge.getServerId();
        // Plugin manager is not yet implemented
        throw new Error('Plugin integration is not yet available in basic mode');
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
     * 修复 TODO: 实现事件转发机制
     */
    setupEventForwarding(manager, serverId) {
        // 如果 manager 支持事件监听，设置事件转发
        if (manager && typeof manager.on === 'function') {
            // 监听插件事件并转发到服务
            manager.on('pluginEvent', (event) => {
                this.logger.debug(`Plugin event from ${serverId}:`, event);
                // 可以在这里添加事件处理逻辑
                // 例如：转发到 EventService 或触发相应的处理器
            });
            manager.on('pluginError', (error) => {
                this.logger.error(`Plugin error from ${serverId}:`, error);
            });
            this.logger.info(`Event forwarding setup for server ${serverId}`);
        }
        else {
            this.logger.debug(`Plugin manager for ${serverId} does not support event forwarding`);
        }
    }
}
exports.PluginIntegrationService = PluginIntegrationService;
// Note: PluginIntegrationService instances should be created with a Context parameter
// export const pluginIntegrationService = new PluginIntegrationService(ctx);
