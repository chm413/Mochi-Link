/**
 * Plugin Integration Service
 * 
 * Service that manages plugin integrations for each server bridge,
 * providing a unified interface for accessing plugin functionality.
 */

import { EventEmitter } from 'events';
import { BaseConnectorBridge } from '../bridge/base';
import { 
  PluginManager, 
  PluginType, 
  PluginIntegration,
  PlaceholderAPIIntegration,
  PlanIntegration,
  LuckPermsIntegration,
  VaultIntegration,
  PluginConfig
} from '../plugins';
import { 
  PlaceholderAPIFactory,
  PlanFactory,
  LuckPermsFactory,
  VaultFactory
} from '../plugins/integrations';
import { pluginRegistry } from '../plugins/registry';

export class PluginIntegrationService extends EventEmitter {
  private pluginManagers = new Map<string, PluginManager>();
  private initialized = false;
  private logger: any;

  constructor(private ctx: any) {
    super();
    this.logger = ctx.logger('mochi-link:plugin-integration');
    this.registerPluginFactories();
  }

  /**
   * Initialize the plugin integration service
   */
  async initialize(): Promise<void> {
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
  async createPluginManager(bridge: BaseConnectorBridge): Promise<any> {
    const serverId = bridge.getServerId();
    
    // Plugin manager is not yet implemented
    throw new Error('Plugin integration is not yet available in basic mode');
  }

  /**
   * Get plugin manager for a server
   */
  getPluginManager(serverId: string): any | null {
    return this.pluginManagers.get(serverId) || null;
  }

  /**
   * Get all plugin managers
   */
  getAllPluginManagers(): Map<string, any> {
    return new Map(this.pluginManagers);
  }

  /**
   * Remove plugin manager for a server
   */
  async removePluginManager(serverId: string): Promise<void> {
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
  getPlaceholderAPI(serverId: string): PlaceholderAPIIntegration | null {
    const manager = this.getPluginManager(serverId);
    return manager ? (manager as any).getIntegration('placeholderapi') : null;
  }

  /**
   * Get Plan integration for a server
   */
  getPlan(serverId: string): PlanIntegration | null {
    const manager = this.getPluginManager(serverId);
    return manager ? (manager as any).getIntegration('plan') : null;
  }

  /**
   * Get LuckPerms integration for a server
   */
  getLuckPerms(serverId: string): LuckPermsIntegration | null {
    const manager = this.getPluginManager(serverId);
    return manager ? (manager as any).getIntegration('luckperms') : null;
  }

  /**
   * Get Vault integration for a server
   */
  getVault(serverId: string): VaultIntegration | null {
    const manager = this.getPluginManager(serverId);
    return manager ? (manager as any).getIntegration('vault') : null;
  }

  /**
   * Check if a plugin is available for a server
   */
  isPluginAvailable(serverId: string, pluginType: PluginType): boolean {
    const manager = this.getPluginManager(serverId);
    return manager ? manager.isAvailable(pluginType) : false;
  }

  /**
   * Get plugin status summary for all servers
   */
  getGlobalPluginStatus(): Record<string, Record<PluginType, boolean>> {
    const status: Record<string, Record<PluginType, boolean>> = {};

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
  async refreshAllPluginAvailability(): Promise<void> {
    const refreshPromises = Array.from(this.pluginManagers.values()).map(manager => 
      manager.refreshAvailability()
    );

    await Promise.allSettled(refreshPromises);
  }

  /**
   * Cleanup all plugin managers
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.pluginManagers.values()).map(manager => 
      manager.cleanup()
    );

    await Promise.allSettled(cleanupPromises);
    this.pluginManagers.clear();
    this.initialized = false;
    this.emit('cleanup');
  }

  /**
   * Register plugin integration factories
   */
  private registerPluginFactories(): void {
    pluginRegistry.register('placeholderapi', new PlaceholderAPIFactory());
    pluginRegistry.register('plan', new PlanFactory());
    pluginRegistry.register('luckperms', new LuckPermsFactory());
    pluginRegistry.register('vault', new VaultFactory());
  }

  /**
   * Set up event forwarding from plugin manager
   * 修复 TODO: 实现事件转发机制
   */
  private setupEventForwarding(manager: any, serverId: string): void {
    // 如果 manager 支持事件监听，设置事件转发
    if (manager && typeof manager.on === 'function') {
      // 监听插件事件并转发到服务
      manager.on('pluginEvent', (event: any) => {
        this.logger.debug(`Plugin event from ${serverId}:`, event);
        // 可以在这里添加事件处理逻辑
        // 例如：转发到 EventService 或触发相应的处理器
      });
      
      manager.on('pluginError', (error: any) => {
        this.logger.error(`Plugin error from ${serverId}:`, error);
      });
      
      this.logger.info(`Event forwarding setup for server ${serverId}`);
    } else {
      this.logger.debug(`Plugin manager for ${serverId} does not support event forwarding`);
    }
  }
}

// Note: PluginIntegrationService instances should be created with a Context parameter
// export const pluginIntegrationService = new PluginIntegrationService(ctx);