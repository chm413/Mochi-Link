/**
 * Base Connector Bridge Tests
 * 
 * Unit tests for the base connector bridge functionality.
 */

import { BaseConnectorBridge } from '../../src/bridge/base';
import { BridgeConfig, BridgeCapability, UnsupportedOperationError } from '../../src/bridge/types';
import { ServerInfo, PerformanceMetrics, Player, PlayerDetail, CommandResult } from '../../src/types';

// Create a concrete implementation for testing
class TestConnectorBridge extends BaseConnectorBridge {
  private mockConnected: boolean = false;
  private mockHealthy: boolean = true;

  async connect(): Promise<void> {
    this.mockConnected = true;
    this.setConnected(true);
  }

  async disconnect(): Promise<void> {
    this.mockConnected = false;
    this.setConnected(false);
  }

  async isHealthy(): Promise<boolean> {
    return this.mockHealthy;
  }

  async getServerInfo(): Promise<ServerInfo> {
    return {
      serverId: this.config.serverId,
      name: 'Test Server',
      version: '1.20.1',
      coreType: 'Java',
      coreName: 'Test',
      maxPlayers: 20,
      onlinePlayers: 0,
      uptime: 0,
      tps: 20.0,
      memoryUsage: { used: 0, max: 0, free: 0, percentage: 0 },
      worldInfo: []
    };
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      serverId: this.config.serverId,
      timestamp: Date.now(),
      tps: 20.0,
      cpuUsage: 0,
      memoryUsage: { used: 0, max: 0, free: 0, percentage: 0 },
      playerCount: 0,
      ping: 0
    };
  }

  async executeCommand(command: string): Promise<CommandResult> {
    return {
      success: true,
      output: [`Executed: ${command}`],
      executionTime: 100
    };
  }

  async getOnlinePlayers(): Promise<Player[]> {
    return [];
  }

  async getPlayerDetail(playerId: string): Promise<PlayerDetail | null> {
    return null;
  }

  protected initializeCapabilities(): void {
    this.addCapability('command_execution');
    this.addCapability('player_management');
  }

  // Expose protected methods for testing
  public testAddCapability(capability: BridgeCapability): void {
    this.addCapability(capability);
  }

  public testRemoveCapability(capability: BridgeCapability): void {
    this.removeCapability(capability);
  }

  public testSetConnected(connected: boolean): void {
    this.setConnected(connected);
  }

  public testRequireCapability(capability: BridgeCapability): void {
    this.requireCapability(capability);
  }
}

describe('BaseConnectorBridge', () => {
  let bridge: TestConnectorBridge;
  let config: BridgeConfig;

  beforeEach(() => {
    config = {
      serverId: 'test-server-1',
      coreType: 'Java',
      coreName: 'Test',
      coreVersion: '1.0.0',
      connection: {
        host: 'localhost',
        port: 25565,
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 5000
      },
      features: {
        playerManagement: true,
        worldManagement: true,
        pluginIntegration: true,
        performanceMonitoring: true,
        eventStreaming: true
      },
      coreSpecific: {}
    };

    bridge = new TestConnectorBridge(config);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(bridge.getServerId()).toBe('test-server-1');
      expect(bridge.getCoreType()).toBe('Java');
      expect(bridge.isConnectedToBridge()).toBe(false);
    });

    it('should initialize with default capabilities', () => {
      const capabilities = bridge.getCapabilities();
      expect(capabilities).toContain('command_execution');
      expect(capabilities).toContain('player_management');
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      expect(bridge.isConnectedToBridge()).toBe(false);
      
      await bridge.connect();
      
      expect(bridge.isConnectedToBridge()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await bridge.connect();
      expect(bridge.isConnectedToBridge()).toBe(true);
      
      await bridge.disconnect();
      
      expect(bridge.isConnectedToBridge()).toBe(false);
    });

    it('should emit connection events', async () => {
      const connectSpy = jest.fn();
      const disconnectSpy = jest.fn();
      
      bridge.on('connected', connectSpy);
      bridge.on('disconnected', disconnectSpy);
      
      await bridge.connect();
      expect(connectSpy).toHaveBeenCalled();
      
      await bridge.disconnect();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Capability Management', () => {
    it('should check capabilities correctly', () => {
      expect(bridge.hasCapability('command_execution')).toBe(true);
      expect(bridge.hasCapability('world_management')).toBe(false);
    });

    it('should add and remove capabilities', () => {
      expect(bridge.hasCapability('world_management')).toBe(false);
      
      bridge.testAddCapability('world_management');
      expect(bridge.hasCapability('world_management')).toBe(true);
      
      bridge.testRemoveCapability('world_management');
      expect(bridge.hasCapability('world_management')).toBe(false);
    });

    it('should require capabilities and throw error if not supported', () => {
      expect(() => {
        bridge.testRequireCapability('world_management');
      }).toThrow(UnsupportedOperationError);
      
      expect(() => {
        bridge.testRequireCapability('command_execution');
      }).not.toThrow();
    });
  });

  describe('Bridge Information', () => {
    it('should provide correct bridge information', () => {
      const info = bridge.getBridgeInfo();
      
      expect(info.serverId).toBe('test-server-1');
      expect(info.coreType).toBe('Java');
      expect(info.coreName).toBe('Test');
      expect(info.coreVersion).toBe('1.0.0');
      expect(info.protocolVersion).toBe('2.0');
      expect(info.isOnline).toBe(false);
      expect(Array.isArray(info.capabilities)).toBe(true);
    });

    it('should update bridge information when connected', async () => {
      let info = bridge.getBridgeInfo();
      expect(info.isOnline).toBe(false);
      
      await bridge.connect();
      
      info = bridge.getBridgeInfo();
      expect(info.isOnline).toBe(true);
    });
  });

  describe('Server Operations', () => {
    beforeEach(async () => {
      await bridge.connect();
    });

    it('should get server information', async () => {
      const serverInfo = await bridge.getServerInfo();
      
      expect(serverInfo.serverId).toBe('test-server-1');
      expect(serverInfo.name).toBe('Test Server');
      expect(serverInfo.coreType).toBe('Java');
    });

    it('should get performance metrics', async () => {
      const metrics = await bridge.getPerformanceMetrics();
      
      expect(metrics.serverId).toBe('test-server-1');
      expect(typeof metrics.timestamp).toBe('number');
      expect(typeof metrics.tps).toBe('number');
    });

    it('should execute commands', async () => {
      const result = await bridge.executeCommand('test command');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Executed: test command');
      expect(typeof result.executionTime).toBe('number');
    });

    it('should get online players', async () => {
      const players = await bridge.getOnlinePlayers();
      
      expect(Array.isArray(players)).toBe(true);
    });
  });

  describe('Player Management', () => {
    beforeEach(async () => {
      await bridge.connect();
    });

    it('should handle unsupported player actions', async () => {
      // Remove player_management capability to test error handling
      bridge.testRemoveCapability('player_management');
      
      const action = {
        type: 'kick' as const,
        target: 'testPlayer',
        reason: 'Test kick'
      };
      
      await expect(bridge.performPlayerAction(action)).rejects.toThrow(UnsupportedOperationError);
    });

    it('should handle unsupported whitelist operations', async () => {
      // Remove whitelist_management capability
      bridge.testRemoveCapability('whitelist_management');
      
      await expect(bridge.getWhitelist()).rejects.toThrow(UnsupportedOperationError);
      await expect(bridge.addToWhitelist('uuid', 'player')).rejects.toThrow(UnsupportedOperationError);
      await expect(bridge.removeFromWhitelist('uuid')).rejects.toThrow(UnsupportedOperationError);
    });
  });

  describe('Event Handling', () => {
    it('should emit bridge events', (done) => {
      bridge.on('bridgeEvent', (event) => {
        expect(event.type).toBe('test.event');
        expect(event.serverId).toBe('test-server-1');
        expect(event.source).toBe('bridge');
        done();
      });
      
      // Simulate emitting a bridge event
      const event = (bridge as any).createBridgeEvent('test.event', { test: true });
      (bridge as any).emitBridgeEvent(event);
    });

    it('should emit specific event types', (done) => {
      bridge.on('bridgeEvent:test.specific', (event) => {
        expect(event.type).toBe('test.specific');
        done();
      });
      
      const event = (bridge as any).createBridgeEvent('test.specific', { test: true });
      (bridge as any).emitBridgeEvent(event);
    });
  });

  describe('Error Handling', () => {
    it('should handle health check', async () => {
      await bridge.connect();
      const healthy = await bridge.isHealthy();
      expect(typeof healthy).toBe('boolean');
    });
  });
});