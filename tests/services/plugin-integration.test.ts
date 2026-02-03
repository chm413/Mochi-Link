/**
 * Plugin Integration Service Tests
 * 
 * Unit tests for the plugin integration service that manages
 * plugin integrations across multiple servers and provides
 * unified access to plugin functionality.
 */

import { PluginIntegrationService } from '../../src/services/plugin-integration';
import { BaseConnectorBridge } from '../../src/bridge/base';
import { PluginManager } from '../../src/plugins/manager';
import { pluginRegistry } from '../../src/plugins/registry';
import { 
  PluginIntegration, 
  PluginConfig, 
  PluginIntegrationFactory,
  PluginCapability,
  PlaceholderAPIIntegration,
  PlanIntegration,
  LuckPermsIntegration,
  VaultIntegration
} from '../../src/plugins/types';

// Mock bridge for testing
class MockBridge extends BaseConnectorBridge {
  private serverId: string;

  constructor(serverId: string) {
    super({
      serverId,
      coreType: 'Java',
      coreName: 'Paper',
      coreVersion: '1.20.1',
      connection: {
        host: 'localhost',
        port: 25565,
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      features: {
        playerManagement: true,
        worldManagement: true,
        pluginIntegration: true,
        performanceMonitoring: true,
        eventStreaming: true
      },
      coreSpecific: {}
    });
    this.serverId = serverId;
  }

  getServerId(): string {
    return this.serverId;
  }

  async connect(): Promise<void> {
    this.setConnected(true);
  }

  async disconnect(): Promise<void> {
    this.setConnected(false);
  }

  async isHealthy(): Promise<boolean> {
    return this.isConnectedToBridge();
  }

  async getServerInfo() {
    return {
      serverId: this.serverId,
      name: `Test Server ${this.serverId}`,
      version: '1.20.1',
      coreType: 'Java' as const,
      coreName: 'Paper',
      maxPlayers: 20,
      onlinePlayers: 5,
      uptime: 3600000,
      tps: 20.0,
      memoryUsage: { used: 1024, max: 2048, free: 1024, percentage: 50 },
      worldInfo: []
    };
  }

  async getPerformanceMetrics() {
    return {
      serverId: this.serverId,
      timestamp: Date.now(),
      tps: 20.0,
      cpuUsage: 25,
      memoryUsage: { used: 1024, max: 2048, free: 1024, percentage: 50 },
      playerCount: 5,
      ping: 50
    };
  }

  async executeCommand() {
    return {
      success: true,
      output: [],
      executionTime: 10
    };
  }

  async getOnlinePlayers() {
    return [];
  }

  async getPlayerDetail() {
    return null;
  }

  protected initializeCapabilities(): void {
    this.addCapability('plugin_integration');
  }
}

// Mock plugin integrations
class MockPlaceholderAPIIntegration implements PlaceholderAPIIntegration {
  readonly name = 'MockPlaceholderAPI';
  readonly type = 'placeholderapi' as const;
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = ['placeholder_resolution'];
  
  private _isAvailable = true;

  constructor(private config: PluginConfig) {}

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  setAvailable(available: boolean): void {
    this._isAvailable = available;
  }

  async initialize(): Promise<void> {}
  async checkAvailability(): Promise<boolean> { return this._isAvailable; }
  async getPluginInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'Mock PlaceholderAPI',
      authors: ['Test'],
      enabled: true,
      dependencies: []
    };
  }
  async cleanup(): Promise<void> {}
  async resolvePlaceholder(): Promise<string | null> { return 'test'; }
  async resolvePlaceholders(): Promise<Record<string, string | null>> { return {}; }
  async getAvailablePlaceholders() { return []; }
  async registerPlaceholder(): Promise<boolean> { return true; }
}

class MockPlanIntegration implements PlanIntegration {
  readonly name = 'MockPlan';
  readonly type = 'plan' as const;
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = ['analytics_data', 'player_statistics'];
  
  private _isAvailable = true;

  constructor(private config: PluginConfig) {}

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  setAvailable(available: boolean): void {
    this._isAvailable = available;
  }

  async initialize(): Promise<void> {}
  async checkAvailability(): Promise<boolean> { return this._isAvailable; }
  async getPluginInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'Mock Plan',
      authors: ['Test'],
      enabled: true,
      dependencies: []
    };
  }
  async cleanup(): Promise<void> {}
  async getServerAnalytics() {
    return {
      serverId: this.config.serverId,
      timeRange: { start: new Date(), end: new Date() },
      uniquePlayers: 100,
      totalPlaytime: 3600000,
      averagePlaytime: 36000,
      peakPlayers: 20,
      newPlayers: 10,
      retentionRate: 75
    };
  }
  async getPlayerAnalytics() {
    return {
      playerId: 'test',
      playerName: 'Test',
      timeRange: { start: new Date(), end: new Date() },
      totalPlaytime: 3600000,
      sessionCount: 10,
      averageSessionLength: 360000,
      firstJoin: new Date(),
      lastSeen: new Date(),
      activityIndex: 50
    };
  }
  async getPlayerSessions() { return []; }
  async getPerformanceData() {
    return {
      timeRange: { start: new Date(), end: new Date() },
      averageTPS: 20,
      minTPS: 18,
      maxTPS: 20,
      averageRAM: 1024,
      maxRAM: 2048,
      playerCounts: []
    };
  }
}

class MockLuckPermsIntegration implements LuckPermsIntegration {
  readonly name = 'MockLuckPerms';
  readonly type = 'luckperms' as const;
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = ['permission_management', 'group_management'];
  
  private _isAvailable = true;

  constructor(private config: PluginConfig) {}

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  setAvailable(available: boolean): void {
    this._isAvailable = available;
  }

  async initialize(): Promise<void> {}
  async checkAvailability(): Promise<boolean> { return this._isAvailable; }
  async getPluginInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'Mock LuckPerms',
      authors: ['Test'],
      enabled: true,
      dependencies: []
    };
  }
  async cleanup(): Promise<void> {}
  async getUserPermissions() {
    return {
      playerId: 'test',
      playerName: 'Test',
      permissions: [],
      groups: [],
      primaryGroup: 'default',
      metadata: {}
    };
  }
  async hasPermission(): Promise<boolean> { return true; }
  async getUserGroups() { return []; }
  async addUserToGroup(): Promise<boolean> { return true; }
  async removeUserFromGroup(): Promise<boolean> { return true; }
  async getAllGroups() { return []; }
  async getGroup() { return null; }
}

class MockVaultIntegration implements VaultIntegration {
  readonly name = 'MockVault';
  readonly type = 'vault' as const;
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = ['economy_balance', 'economy_transactions'];
  
  private _isAvailable = true;

  constructor(private config: PluginConfig) {}

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  setAvailable(available: boolean): void {
    this._isAvailable = available;
  }

  async initialize(): Promise<void> {}
  async checkAvailability(): Promise<boolean> { return this._isAvailable; }
  async getPluginInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'Mock Vault',
      authors: ['Test'],
      enabled: true,
      dependencies: []
    };
  }
  async cleanup(): Promise<void> {}
  async getBalance(): Promise<number> { return 1000; }
  async has(): Promise<boolean> { return true; }
  async withdraw() {
    return {
      success: true,
      amount: 100,
      balance: 900,
      transactionId: 'test'
    };
  }
  async deposit() {
    return {
      success: true,
      amount: 100,
      balance: 1100,
      transactionId: 'test'
    };
  }
  async transfer() {
    return {
      success: true,
      amount: 100,
      balance: 900,
      transactionId: 'test'
    };
  }
  async getEconomyInfo() {
    return {
      name: 'Test Economy',
      currencyName: 'Dollar',
      currencySymbol: '$',
      fractionalDigits: 2,
      supportsBanks: false
    };
  }
  async getTopBalances() { return []; }
}

// Mock factories
class MockPlaceholderAPIFactory implements PluginIntegrationFactory {
  create(config: PluginConfig): PluginIntegration {
    return new MockPlaceholderAPIIntegration(config);
  }
}

class MockPlanFactory implements PluginIntegrationFactory {
  create(config: PluginConfig): PluginIntegration {
    return new MockPlanIntegration(config);
  }
}

class MockLuckPermsFactory implements PluginIntegrationFactory {
  create(config: PluginConfig): PluginIntegration {
    return new MockLuckPermsIntegration(config);
  }
}

class MockVaultFactory implements PluginIntegrationFactory {
  create(config: PluginConfig): PluginIntegration {
    return new MockVaultIntegration(config);
  }
}

describe('PluginIntegrationService', () => {
  let service: PluginIntegrationService;
  let mockBridge1: MockBridge;
  let mockBridge2: MockBridge;

  beforeEach(async () => {
    // Clear plugin registry
    pluginRegistry.clear();
    
    // Register mock factories
    pluginRegistry.register('placeholderapi', new MockPlaceholderAPIFactory());
    pluginRegistry.register('plan', new MockPlanFactory());
    pluginRegistry.register('luckperms', new MockLuckPermsFactory());
    pluginRegistry.register('vault', new MockVaultFactory());

    // Create service and bridges
    service = new PluginIntegrationService();
    mockBridge1 = new MockBridge('server-1');
    mockBridge2 = new MockBridge('server-2');

    await mockBridge1.connect();
    await mockBridge2.connect();
  });

  afterEach(async () => {
    await service.cleanup();
    await mockBridge1.disconnect();
    await mockBridge2.disconnect();
    pluginRegistry.clear();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event', async () => {
      const initSpy = jest.fn();
      service.on('initialized', initSpy);

      await service.initialize();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      
      // Second initialization should not throw
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('plugin manager creation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should create plugin manager for server bridge', async () => {
      const manager = await service.createPluginManager(mockBridge1);
      
      expect(manager).toBeInstanceOf(PluginManager);
      expect(service.getPluginManager('server-1')).toBe(manager);
    });

    it('should reuse existing plugin manager', async () => {
      const manager1 = await service.createPluginManager(mockBridge1);
      const manager2 = await service.createPluginManager(mockBridge1);
      
      expect(manager1).toBe(manager2);
    });

    it('should create separate managers for different servers', async () => {
      const manager1 = await service.createPluginManager(mockBridge1);
      const manager2 = await service.createPluginManager(mockBridge2);
      
      expect(manager1).not.toBe(manager2);
      expect(service.getPluginManager('server-1')).toBe(manager1);
      expect(service.getPluginManager('server-2')).toBe(manager2);
    });

    it('should emit manager initialized event', async () => {
      const managerInitSpy = jest.fn();
      service.on('pluginManagerInitialized', managerInitSpy);

      await service.createPluginManager(mockBridge1);

      expect(managerInitSpy).toHaveBeenCalledWith({ serverId: 'server-1' });
    });

    it('should forward plugin manager events', async () => {
      const integrationInitSpy = jest.fn();
      const integrationErrorSpy = jest.fn();
      const availabilityChangedSpy = jest.fn();

      service.on('pluginIntegrationInitialized', integrationInitSpy);
      service.on('pluginIntegrationError', integrationErrorSpy);
      service.on('pluginAvailabilityChanged', availabilityChangedSpy);

      const manager = await service.createPluginManager(mockBridge1);
      
      // Simulate events from plugin manager
      manager.emit('integrationInitialized', { type: 'placeholderapi', name: 'Test' });
      manager.emit('integrationError', { type: 'plan', error: 'Test error' });
      manager.emit('availabilityChanged', { type: 'vault', isAvailable: false });

      expect(integrationInitSpy).toHaveBeenCalledWith({ 
        serverId: 'server-1', 
        type: 'placeholderapi', 
        name: 'Test' 
      });
      expect(integrationErrorSpy).toHaveBeenCalledWith({ 
        serverId: 'server-1', 
        type: 'plan', 
        error: 'Test error' 
      });
      expect(availabilityChangedSpy).toHaveBeenCalledWith({ 
        serverId: 'server-1', 
        type: 'vault', 
        isAvailable: false 
      });
    });
  });

  describe('plugin manager access', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get plugin manager by server ID', async () => {
      const manager = await service.createPluginManager(mockBridge1);
      
      expect(service.getPluginManager('server-1')).toBe(manager);
    });

    it('should return null for non-existent server', () => {
      expect(service.getPluginManager('non-existent')).toBeNull();
    });

    it('should get all plugin managers', async () => {
      const manager1 = await service.createPluginManager(mockBridge1);
      const manager2 = await service.createPluginManager(mockBridge2);
      
      const allManagers = service.getAllPluginManagers();
      
      expect(allManagers.size).toBe(2);
      expect(allManagers.get('server-1')).toBe(manager1);
      expect(allManagers.get('server-2')).toBe(manager2);
    });

    it('should remove plugin manager', async () => {
      const manager = await service.createPluginManager(mockBridge1);
      const cleanupSpy = jest.spyOn(manager, 'cleanup');
      const managerRemovedSpy = jest.fn();
      
      service.on('managerRemoved', managerRemovedSpy);

      await service.removePluginManager('server-1');

      expect(cleanupSpy).toHaveBeenCalled();
      expect(service.getPluginManager('server-1')).toBeNull();
      expect(managerRemovedSpy).toHaveBeenCalledWith({ serverId: 'server-1' });
    });

    it('should handle removal of non-existent manager', async () => {
      await expect(service.removePluginManager('non-existent')).resolves.not.toThrow();
    });
  });

  describe('plugin integration access', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.createPluginManager(mockBridge1);
    });

    it('should get PlaceholderAPI integration', () => {
      const integration = service.getPlaceholderAPI('server-1');
      
      expect(integration).toBeInstanceOf(MockPlaceholderAPIIntegration);
      expect(integration?.type).toBe('placeholderapi');
    });

    it('should get Plan integration', () => {
      const integration = service.getPlan('server-1');
      
      expect(integration).toBeInstanceOf(MockPlanIntegration);
      expect(integration?.type).toBe('plan');
    });

    it('should get LuckPerms integration', () => {
      const integration = service.getLuckPerms('server-1');
      
      expect(integration).toBeInstanceOf(MockLuckPermsIntegration);
      expect(integration?.type).toBe('luckperms');
    });

    it('should get Vault integration', () => {
      const integration = service.getVault('server-1');
      
      expect(integration).toBeInstanceOf(MockVaultIntegration);
      expect(integration?.type).toBe('vault');
    });

    it('should return null for non-existent server', () => {
      expect(service.getPlaceholderAPI('non-existent')).toBeNull();
      expect(service.getPlan('non-existent')).toBeNull();
      expect(service.getLuckPerms('non-existent')).toBeNull();
      expect(service.getVault('non-existent')).toBeNull();
    });
  });

  describe('plugin availability checking', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.createPluginManager(mockBridge1);
    });

    it('should check plugin availability', () => {
      expect(service.isPluginAvailable('server-1', 'placeholderapi')).toBe(true);
      expect(service.isPluginAvailable('server-1', 'plan')).toBe(true);
      expect(service.isPluginAvailable('server-1', 'luckperms')).toBe(true);
      expect(service.isPluginAvailable('server-1', 'vault')).toBe(true);
    });

    it('should return false for non-existent server', () => {
      expect(service.isPluginAvailable('non-existent', 'placeholderapi')).toBe(false);
    });

    it('should get global plugin status', async () => {
      await service.createPluginManager(mockBridge2);
      
      const status = service.getGlobalPluginStatus();
      
      expect(status['server-1']).toEqual({
        placeholderapi: true,
        plan: true,
        luckperms: true,
        vault: true
      });
      expect(status['server-2']).toEqual({
        placeholderapi: true,
        plan: true,
        luckperms: true,
        vault: true
      });
    });

    it('should refresh all plugin availability', async () => {
      const manager1 = service.getPluginManager('server-1')!;
      const manager2 = await service.createPluginManager(mockBridge2);
      
      const refreshSpy1 = jest.spyOn(manager1, 'refreshAvailability').mockResolvedValue();
      const refreshSpy2 = jest.spyOn(manager2, 'refreshAvailability').mockResolvedValue();

      await service.refreshAllPluginAvailability();

      expect(refreshSpy1).toHaveBeenCalled();
      expect(refreshSpy2).toHaveBeenCalled();
    });

    it('should handle refresh failures gracefully', async () => {
      const manager = service.getPluginManager('server-1')!;
      jest.spyOn(manager, 'refreshAvailability').mockRejectedValue(new Error('Refresh failed'));

      await expect(service.refreshAllPluginAvailability()).resolves.not.toThrow();
    });
  });

  describe('fallback mechanisms', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle plugin manager creation failures', async () => {
      // Mock a bridge that throws during manager creation
      const failingBridge = new MockBridge('failing-server');
      jest.spyOn(failingBridge, 'getServerId').mockImplementation(() => {
        throw new Error('Bridge failure');
      });

      await expect(service.createPluginManager(failingBridge)).rejects.toThrow('Bridge failure');
    });

    it('should handle plugin unavailability gracefully', async () => {
      await service.createPluginManager(mockBridge1);
      
      // Make a plugin unavailable
      const manager = service.getPluginManager('server-1')!;
      const planIntegration = manager.getIntegration('plan') as MockPlanIntegration;
      planIntegration.setAvailable(false);

      expect(service.isPluginAvailable('server-1', 'plan')).toBe(false);
      expect(service.getPlan('server-1')).not.toBeNull(); // Still returns integration, but unavailable
    });

    it('should handle missing plugin integrations', async () => {
      // Clear registry to simulate missing plugins
      pluginRegistry.clear();
      
      await service.createPluginManager(mockBridge1);
      
      expect(service.getPlaceholderAPI('server-1')).toBeNull();
      expect(service.getPlan('server-1')).toBeNull();
      expect(service.getLuckPerms('server-1')).toBeNull();
      expect(service.getVault('server-1')).toBeNull();
    });

    it('should handle plugin manager initialization failures', async () => {
      // Mock PluginManager to throw during initialization
      const originalCreate = pluginRegistry.create;
      jest.spyOn(pluginRegistry, 'create').mockImplementation((type, config) => {
        const integration = originalCreate.call(pluginRegistry, type, config);
        if (integration && type === 'plan') {
          jest.spyOn(integration, 'initialize').mockRejectedValue(new Error('Init failed'));
        }
        return integration;
      });

      // Should still create manager despite plugin initialization failure
      const manager = await service.createPluginManager(mockBridge1);
      expect(manager).toBeInstanceOf(PluginManager);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should cleanup all plugin managers', async () => {
      const manager1 = await service.createPluginManager(mockBridge1);
      const manager2 = await service.createPluginManager(mockBridge2);
      
      const cleanupSpy1 = jest.spyOn(manager1, 'cleanup');
      const cleanupSpy2 = jest.spyOn(manager2, 'cleanup');
      const serviceCleanupSpy = jest.fn();
      
      service.on('cleanup', serviceCleanupSpy);

      await service.cleanup();

      expect(cleanupSpy1).toHaveBeenCalled();
      expect(cleanupSpy2).toHaveBeenCalled();
      expect(service.getAllPluginManagers().size).toBe(0);
      expect(serviceCleanupSpy).toHaveBeenCalled();
    });

    it('should handle cleanup failures gracefully', async () => {
      const manager = await service.createPluginManager(mockBridge1);
      jest.spyOn(manager, 'cleanup').mockRejectedValue(new Error('Cleanup failed'));

      await expect(service.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup when not initialized', async () => {
      const uninitializedService = new PluginIntegrationService();
      await expect(uninitializedService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle bridge disconnection gracefully', async () => {
      await service.createPluginManager(mockBridge1);
      
      await mockBridge1.disconnect();
      
      // Service should still function
      expect(service.getPluginManager('server-1')).not.toBeNull();
    });

    it('should handle plugin integration errors', async () => {
      const integrationErrorSpy = jest.fn();
      service.on('pluginIntegrationError', integrationErrorSpy);

      const manager = await service.createPluginManager(mockBridge1);
      
      // Simulate integration error
      manager.emit('integrationError', { 
        type: 'plan', 
        name: 'MockPlan', 
        error: 'Test error' 
      });

      expect(integrationErrorSpy).toHaveBeenCalledWith({
        serverId: 'server-1',
        type: 'plan',
        name: 'MockPlan',
        error: 'Test error'
      });
    });

    it('should handle concurrent manager creation', async () => {
      // Create multiple managers concurrently for the same server
      const promises = [
        service.createPluginManager(mockBridge1),
        service.createPluginManager(mockBridge1),
        service.createPluginManager(mockBridge1)
      ];

      const managers = await Promise.all(promises);
      
      // All should return the same manager instance
      expect(managers[0]).toBe(managers[1]);
      expect(managers[1]).toBe(managers[2]);
    });

    it('should handle plugin registry errors', async () => {
      // Mock registry to throw error
      jest.spyOn(pluginRegistry, 'create').mockImplementation(() => {
        throw new Error('Registry error');
      });

      // Should still create manager despite registry errors
      const manager = await service.createPluginManager(mockBridge1);
      expect(manager).toBeInstanceOf(PluginManager);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should forward plugin availability changes', async () => {
      const availabilityChangedSpy = jest.fn();
      service.on('pluginAvailabilityChanged', availabilityChangedSpy);

      const manager = await service.createPluginManager(mockBridge1);
      
      manager.emit('availabilityChanged', {
        type: 'vault',
        name: 'MockVault',
        isAvailable: false,
        wasAvailable: true
      });

      expect(availabilityChangedSpy).toHaveBeenCalledWith({
        serverId: 'server-1',
        type: 'vault',
        name: 'MockVault',
        isAvailable: false,
        wasAvailable: true
      });
    });

    it('should forward plugin manager cleanup events', async () => {
      const managerCleanupSpy = jest.fn();
      service.on('pluginManagerCleanup', managerCleanupSpy);

      const manager = await service.createPluginManager(mockBridge1);
      
      manager.emit('cleanup');

      expect(managerCleanupSpy).toHaveBeenCalledWith({ serverId: 'server-1' });
    });

    it('should handle event listener errors gracefully', async () => {
      // Add a failing event listener
      service.on('pluginManagerInitialized', () => {
        throw new Error('Event handler error');
      });

      // Should not prevent manager creation
      await expect(service.createPluginManager(mockBridge1)).resolves.not.toThrow();
    });
  });
});