/**
 * Java Connector Bridge Tests
 * 
 * Unit tests for the Java edition connector bridge functionality.
 */

import { JavaConnectorBridge } from '../../src/bridge/java';
import { BridgeConfig } from '../../src/bridge/types';

// Mock connection adapter
const mockConnectionAdapter = {
  isConnected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendCommand: jest.fn(),
  on: jest.fn(),
  emit: jest.fn()
};

describe('JavaConnectorBridge', () => {
  let bridge: JavaConnectorBridge;
  let config: BridgeConfig;

  beforeEach(() => {
    config = {
      serverId: 'java-server-1',
      coreType: 'Java',
      coreName: 'Paper',
      coreVersion: '1.20.1',
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
      coreSpecific: {
        supportsPaper: true
      }
    };

    // Reset mock call history but keep implementations
    mockConnectionAdapter.connect.mockClear();
    mockConnectionAdapter.disconnect.mockClear();
    mockConnectionAdapter.sendCommand.mockClear();
    mockConnectionAdapter.on.mockClear();
    mockConnectionAdapter.emit.mockClear();
    mockConnectionAdapter.isConnected = false;
    
    bridge = new JavaConnectorBridge(config, mockConnectionAdapter);
  });

  describe('Initialization', () => {
    it('should initialize with Java-specific capabilities', () => {
      const capabilities = bridge.getCapabilities();
      
      expect(capabilities).toContain('player_management');
      expect(capabilities).toContain('world_management');
      expect(capabilities).toContain('command_execution');
      expect(capabilities).toContain('performance_monitoring');
      expect(capabilities).toContain('event_streaming');
      expect(capabilities).toContain('whitelist_management');
      expect(capabilities).toContain('ban_management');
      expect(capabilities).toContain('operator_management');
      expect(capabilities).toContain('server_control');
      expect(capabilities).toContain('plugin_integration'); // Paper supports plugins
    });

    it('should have correct bridge info', () => {
      const info = bridge.getBridgeInfo();
      
      expect(info.serverId).toBe('java-server-1');
      expect(info.coreType).toBe('Java');
      expect(info.coreName).toBe('Paper');
      expect(info.coreVersion).toBe('1.20.1');
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['This server is running Paper version git-Paper-123 (MC: 1.20.1)'],
        executionTime: 100
      });

      await bridge.connect();

      expect(mockConnectionAdapter.connect).toHaveBeenCalled();
      expect(bridge.isConnectedToBridge()).toBe(true);
    });

    it('should handle connection failure', async () => {
      mockConnectionAdapter.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(bridge.connect()).rejects.toThrow('Connection failed');
      expect(bridge.isConnectedToBridge()).toBe(false);
    });

    it('should disconnect successfully', async () => {
      // First connect
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      await bridge.connect();
      expect(bridge.isConnectedToBridge()).toBe(true);

      // Then disconnect - just check that the bridge state changes
      await bridge.disconnect();

      expect(bridge.isConnectedToBridge()).toBe(false);
    });
  });

  describe('Command Execution', () => {
    beforeEach(async () => {
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['Command executed'],
        executionTime: 100
      });
      await bridge.connect();
    });

    it('should execute commands successfully', async () => {
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['There are 0 of a max of 20 players online'],
        executionTime: 150
      });

      const result = await bridge.executeCommand('list');

      expect(result.success).toBe(true);
      expect(result.output).toContain('There are 0 of a max of 20 players online');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockConnectionAdapter.sendCommand).toHaveBeenCalledWith('list');
    });

    it('should handle command failures', async () => {
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: false,
        output: [],
        error: 'Unknown command'
      });

      const result = await bridge.executeCommand('invalidcommand');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown command');
    });

    it('should handle command timeouts', async () => {
      // Override the mock to reject
      mockConnectionAdapter.sendCommand.mockRejectedValue(new Error('Request timeout'));

      const result = await bridge.executeCommand('slowcommand');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
    });
  });

  describe('Server Information', () => {
    beforeEach(async () => {
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      await bridge.connect();
    });

    it('should get server information', async () => {
      mockConnectionAdapter.sendCommand
        .mockResolvedValueOnce({
          success: true,
          output: ['This server is running Paper version git-Paper-123 (MC: 1.20.1)'],
          executionTime: 100
        })
        .mockResolvedValueOnce({
          success: true,
          output: ['There are 5 of a max of 20 players online: player1, player2, player3, player4, player5'],
          executionTime: 50
        });

      const serverInfo = await bridge.getServerInfo();

      expect(serverInfo.serverId).toBe('java-server-1');
      expect(serverInfo.coreType).toBe('Java');
      expect(serverInfo.maxPlayers).toBe(20);
      expect(serverInfo.onlinePlayers).toBe(5);
    });

    it('should get performance metrics', async () => {
      mockConnectionAdapter.sendCommand
        .mockResolvedValueOnce({
          success: true,
          output: ['TPS from last 1m, 5m, 15m: 20.0, 19.8, 19.5'],
          executionTime: 100
        })
        .mockResolvedValueOnce({
          success: true,
          output: ['Memory usage: 2048MB / 4096MB'],
          executionTime: 50
        })
        .mockResolvedValueOnce({
          success: true,
          output: ['There are 3 of a max of 20 players online'],
          executionTime: 30
        });

      const metrics = await bridge.getPerformanceMetrics();

      expect(metrics.serverId).toBe('java-server-1');
      expect(typeof metrics.timestamp).toBe('number');
      expect(typeof metrics.tps).toBe('number');
      expect(typeof metrics.playerCount).toBe('number');
    });
  });

  describe('Player Management', () => {
    beforeEach(async () => {
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['Command executed'],
        executionTime: 100
      });
      await bridge.connect();
    });

    it('should get online players', async () => {
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['There are 2 of a max of 20 players online: TestPlayer1, TestPlayer2'],
        executionTime: 100
      });

      const players = await bridge.getOnlinePlayers();

      expect(Array.isArray(players)).toBe(true);
      expect(players.length).toBe(2);
      expect(players[0].name).toBe('TestPlayer1');
      expect(players[0].edition).toBe('Java');
      expect(players[1].name).toBe('TestPlayer2');
      expect(mockConnectionAdapter.sendCommand).toHaveBeenCalledWith('list');
    });

    it('should perform player actions', async () => {
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['TestPlayer has been kicked from the server'],
        executionTime: 100
      });

      const action = {
        type: 'kick' as const,
        target: 'TestPlayer',
        reason: 'Test kick'
      };

      const result = await bridge.performPlayerAction(action);

      expect(result.success).toBe(true);
      expect(result.action).toEqual(action);
      expect(mockConnectionAdapter.sendCommand).toHaveBeenCalledWith('kick TestPlayer Test kick');
    });

    it('should handle teleport actions', async () => {
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['Teleported TestPlayer to 100, 64, 200'],
        executionTime: 100
      });

      const action = {
        type: 'teleport' as const,
        target: 'TestPlayer',
        metadata: { x: 100, y: 64, z: 200 }
      };

      const result = await bridge.performPlayerAction(action);

      expect(result.success).toBe(true);
      expect(mockConnectionAdapter.sendCommand).toHaveBeenCalledWith('tp TestPlayer 100 64 200');
    });
  });

  describe('World Management', () => {
    beforeEach(async () => {
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['Command executed'],
        executionTime: 100
      });
      await bridge.connect();
    });

    it('should perform world operations', async () => {
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['Saved the game'],
        executionTime: 200
      });

      const operation = {
        type: 'save' as const
      };

      const result = await bridge.performWorldOperation(operation);

      expect(result.success).toBe(true);
      expect(result.operation).toEqual(operation);
      expect(mockConnectionAdapter.sendCommand).toHaveBeenCalledWith('save-all');
    });

    it('should update world settings', async () => {
      mockConnectionAdapter.sendCommand
        .mockResolvedValueOnce({
          success: true,
          output: ['Set the time to 1000'],
          executionTime: 100
        })
        .mockResolvedValueOnce({
          success: true,
          output: ['Set weather to rain'],
          executionTime: 100
        });

      const settings = {
        time: 1000,
        weather: 'rain' as const
      };

      const result = await bridge.updateWorldSettings(settings);

      expect(result).toBe(true);
      expect(mockConnectionAdapter.sendCommand).toHaveBeenCalledWith('time set 1000');
      expect(mockConnectionAdapter.sendCommand).toHaveBeenCalledWith('weather rain');
    });
  });

  describe('Health Check', () => {
    it('should return false when not connected', async () => {
      const healthy = await bridge.isHealthy();
      expect(healthy).toBe(false);
    });

    it('should return true when connected and responsive', async () => {
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: true,
        output: ['Server is responsive'],
        executionTime: 100
      });

      await bridge.connect();
      const healthy = await bridge.isHealthy();

      expect(healthy).toBe(true);
    });

    it('should return false when connected but unresponsive', async () => {
      // First connect the bridge
      mockConnectionAdapter.connect.mockResolvedValue(undefined);
      await bridge.connect();

      // Then make the health check fail
      mockConnectionAdapter.sendCommand.mockResolvedValue({
        success: false,
        output: [],
        error: 'Server not responding'
      });

      const healthy = await bridge.isHealthy();

      expect(healthy).toBe(false);
    });
  });
});