/**
 * Connection Mode Manager Tests
 * 
 * Unit tests for the connection mode manager functionality.
 */

import { Context } from 'koishi';
import { ConnectionModeManager } from '../../src/connection/manager';
import { ServerConfig, ConnectionMode } from '../../src/types';

// Mock the adapters
jest.mock('../../src/connection/adapters/plugin');
jest.mock('../../src/connection/adapters/rcon');
jest.mock('../../src/connection/adapters/terminal');

describe('ConnectionModeManager', () => {
  let manager: ConnectionModeManager;
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      logger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }))
    };

    manager = new ConnectionModeManager(mockCtx as Context, {
      autoSwitchOnFailure: true,
      preferredModeOrder: ['plugin', 'rcon', 'terminal'],
      maxRetryAttempts: 3
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Establishment', () => {
    it('should establish plugin connection successfully', async () => {
      const serverConfig: ServerConfig = {
        id: 'test-server-1',
        name: 'Test Server',
        coreType: 'Java',
        coreName: 'Paper',
        coreVersion: '1.20.1',
        connectionMode: 'plugin',
        connectionConfig: {
          plugin: {
            host: 'localhost',
            port: 8080,
            ssl: false
          }
        },
        status: 'offline',
        ownerId: 'user-1',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock successful connection
      const mockAdapter = {
        serverId: serverConfig.id,
        mode: 'plugin',
        isConnected: true,
        capabilities: ['realtime_events'],
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue(undefined),
        sendCommand: jest.fn().mockResolvedValue({ success: true, output: [], executionTime: 100 }),
        getConnectionInfo: jest.fn().mockReturnValue({
          serverId: serverConfig.id,
          mode: 'plugin',
          isConnected: true,
          capabilities: ['realtime_events'],
          stats: { messagesReceived: 0, messagesSent: 0, commandsExecuted: 0, errors: 0, uptime: 0 }
        }),
        isHealthy: jest.fn().mockReturnValue(true),
        on: jest.fn(),
        emit: jest.fn()
      };

      // Mock adapter creation
      jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);

      const adapter = await manager.establishConnection(serverConfig);

      expect(adapter).toBe(mockAdapter);
      expect(mockAdapter.connect).toHaveBeenCalledWith(serverConfig.connectionConfig);
      expect(manager.isConnected(serverConfig.id)).toBe(true);
    });

    it('should fail to establish connection with invalid config', async () => {
      const serverConfig: ServerConfig = {
        id: 'test-server-2',
        name: 'Test Server 2',
        coreType: 'Java',
        coreName: 'Paper',
        coreVersion: '1.20.1',
        connectionMode: 'plugin',
        connectionConfig: {}, // Invalid config
        status: 'offline',
        ownerId: 'user-1',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAdapter = {
        serverId: serverConfig.id,
        mode: 'plugin',
        isConnected: false,
        capabilities: [],
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        on: jest.fn(),
        emit: jest.fn()
      };

      jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);

      await expect(manager.establishConnection(serverConfig)).rejects.toThrow('Connection failed');
    });
  });

  describe('Connection Mode Switching', () => {
    it('should switch from plugin to RCON mode', async () => {
      const serverConfig: ServerConfig = {
        id: 'test-server-3',
        name: 'Test Server 3',
        coreType: 'Java',
        coreName: 'Paper',
        coreVersion: '1.20.1',
        connectionMode: 'plugin',
        connectionConfig: {
          plugin: {
            host: 'localhost',
            port: 8080,
            ssl: false
          },
          rcon: {
            host: 'localhost',
            port: 25575,
            password: 'test123'
          }
        },
        status: 'online',
        ownerId: 'user-1',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock initial plugin adapter
      const mockPluginAdapter = {
        serverId: serverConfig.id,
        mode: 'plugin',
        isConnected: true,
        capabilities: ['realtime_events'],
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        emit: jest.fn()
      };

      // Mock RCON adapter
      const mockRconAdapter = {
        serverId: serverConfig.id,
        mode: 'rcon',
        isConnected: true,
        capabilities: ['command_execution'],
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        getConnectionInfo: jest.fn().mockReturnValue({
          serverId: serverConfig.id,
          mode: 'rcon',
          isConnected: true,
          capabilities: ['command_execution'],
          stats: { messagesReceived: 0, messagesSent: 0, commandsExecuted: 0, errors: 0, uptime: 0 }
        }),
        on: jest.fn(),
        emit: jest.fn()
      };

      // Setup initial connection
      jest.spyOn(manager as any, 'createAdapter').mockReturnValueOnce(mockPluginAdapter);
      await manager.establishConnection(serverConfig);

      // Mock adapter creation for switch
      jest.spyOn(manager as any, 'createAdapter').mockReturnValueOnce(mockRconAdapter);

      await manager.switchConnectionMode(serverConfig.id, 'rcon');

      expect(mockPluginAdapter.disconnect).toHaveBeenCalled();
      expect(mockRconAdapter.connect).toHaveBeenCalled();
      
      const connectionInfo = manager.getConnectionInfo(serverConfig.id);
      expect(connectionInfo?.mode).toBe('rcon');
    });
  });

  describe('Message and Command Handling', () => {
    it('should send messages through connected adapter', async () => {
      const serverConfig: ServerConfig = {
        id: 'test-server-4',
        name: 'Test Server 4',
        coreType: 'Java',
        coreName: 'Paper',
        coreVersion: '1.20.1',
        connectionMode: 'plugin',
        connectionConfig: {
          plugin: {
            host: 'localhost',
            port: 8080,
            ssl: false
          }
        },
        status: 'offline',
        ownerId: 'user-1',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAdapter = {
        serverId: serverConfig.id,
        mode: 'plugin',
        isConnected: true,
        capabilities: ['realtime_events'],
        connect: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        emit: jest.fn()
      };

      jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);
      await manager.establishConnection(serverConfig);

      const message = {
        type: 'request' as const,
        id: 'test-1',
        op: 'server.info',
        data: {},
        timestamp: Date.now(),
        serverId: serverConfig.id,
        version: '2.0'
      };

      await manager.sendMessage(serverConfig.id, message);

      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(message);
    });

    it('should execute commands through connected adapter', async () => {
      const serverConfig: ServerConfig = {
        id: 'test-server-5',
        name: 'Test Server 5',
        coreType: 'Java',
        coreName: 'Paper',
        coreVersion: '1.20.1',
        connectionMode: 'rcon',
        connectionConfig: {
          rcon: {
            host: 'localhost',
            port: 25575,
            password: 'test123'
          }
        },
        status: 'offline',
        ownerId: 'user-1',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAdapter = {
        serverId: serverConfig.id,
        mode: 'rcon',
        isConnected: true,
        capabilities: ['command_execution'],
        connect: jest.fn().mockResolvedValue(undefined),
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          output: ['There are 0 of a max of 20 players online'],
          executionTime: 150
        }),
        on: jest.fn(),
        emit: jest.fn()
      };

      jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);
      await manager.establishConnection(serverConfig);

      const result = await manager.sendCommand(serverConfig.id, 'list');

      expect(mockAdapter.sendCommand).toHaveBeenCalledWith('list');
      expect(result.success).toBe(true);
      expect(result.output).toContain('There are 0 of a max of 20 players online');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', async () => {
      // Setup multiple connections
      const configs = [
        {
          id: 'server-1',
          mode: 'plugin' as ConnectionMode,
          status: 'connected'
        },
        {
          id: 'server-2',
          mode: 'rcon' as ConnectionMode,
          status: 'connected'
        },
        {
          id: 'server-3',
          mode: 'terminal' as ConnectionMode,
          status: 'error'
        }
      ];

      // Mock connections
      for (const config of configs) {
        const mockAdapter = {
          serverId: config.id,
          mode: config.mode,
          isConnected: config.status === 'connected',
          capabilities: [],
          connect: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
          emit: jest.fn()
        };

        jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);
        
        const serverConfig: ServerConfig = {
          id: config.id,
          name: `Test Server ${config.id}`,
          coreType: 'Java',
          coreName: 'Paper',
          coreVersion: '1.20.1',
          connectionMode: config.mode,
          connectionConfig: {
            [config.mode]: {
              host: 'localhost',
              port: config.mode === 'plugin' ? 8080 : 25575,
              ...(config.mode === 'rcon' && { password: 'test123' }),
              ...(config.mode === 'terminal' && { processId: 12345, workingDir: '/opt/minecraft', command: 'java' })
            }
          },
          status: 'offline',
          ownerId: 'user-1',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        try {
          await manager.establishConnection(serverConfig);
        } catch (error) {
          // Expected for error status
        }
      }

      const stats = manager.getStats();

      expect(stats.totalConnections).toBe(3);
      expect(stats.modeDistribution.plugin).toBe(1);
      expect(stats.modeDistribution.rcon).toBe(1);
      expect(stats.modeDistribution.terminal).toBe(1);
    });
  });
});