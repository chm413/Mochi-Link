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
   */
  async createPluginManager(bridge: BaseConnectorBridge): Promise<PluginManager> {
    const serverId = bridge.getServerId();
    
    // Check if manager already exists
    if (this.pluginManagers.has(serverId)) {
      return this.pluginManagers.get(serverId)!;
    }

    // Create plugin configuration
    const config: PluginConfig = {
      serverId,
      bridge,
      settings: {
        // Add any plugin-specific settings here
        planWebPort: 8804, // Default Plan web port
      }
    };

    // Create and initialize plugin manager
    const manager = new PluginManager(config);
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
  getPluginManager(serverId: string): PluginManager | null {
    return this.pluginManagers.get(serverId) || null;
  }

  /**
   * Get all plugin managers
   */
  getAllPluginManagers(): Map<string, PluginManager> {
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
    return manager ? manager.getIntegration<PlaceholderAPIIntegration>('placeholderapi') : null;
  }

  /**
   * Get Plan integration for a server
   */
  getPlan(serverId: string): PlanIntegration | null {
    const manager = this.getPluginManager(serverId);
    return manager ? manager.getIntegration<PlanIntegration>('plan') : null;
  }

  /**
   * Get LuckPerms integration for a server
   */
  getLuckPerms(serverId: string): LuckPermsIntegration | null {
    const manager = this.getPluginManager(serverId);
    return manager ? manager.getIntegration<LuckPermsIntegration>('luckperms') : null;
  }

  /**
   * Get Vault integration for a server
   */
  getVault(serverId: string): VaultIntegration | null {
    const manager = this.getPluginManager(serverId);
    return manager ? manager.getIntegration<VaultIntegration>('vault') : null;
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
   */
  private setupEventForwarding(manager: PluginManager, serverId: string): void {
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

// Global plugin integration service instance
export const pluginIntegrationService = new PluginIntegrationService();