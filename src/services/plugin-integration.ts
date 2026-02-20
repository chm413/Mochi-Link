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

  constructor() {
    super();
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
   * NOTE: Not implemented in basic mode
   */
  private setupEventForwarding(manager: any, serverId: string): void {
    // Event forwarding is not yet implemented
    // TODO: Implement when plugin manager is available
  }
}

// Global plugin integration service instance
export const pluginIntegrationService = new PluginIntegrationService();