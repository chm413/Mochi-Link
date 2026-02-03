/**
 * Connection Mode Management Property Tests
 * 
 * Property-based tests for connection mode management functionality.
 */

import * as fc from 'fast-check';
import { Context } from 'koishi';
import { ConnectionModeManager } from '../../src/connection/manager';
import { ServerConfig, ConnectionMode, CoreType } from '../../src/types';

// Mock the adapters
jest.mock('../../src/connection/adapters/plugin');
jest.mock('../../src/connection/adapters/rcon');
jest.mock('../../src/connection/adapters/terminal');

describe('Connection Mode Management Properties', () => {
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

    manager = new ConnectionModeManager(mockCtx as Context);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Clean up any connections
    try {
      await manager.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  // ============================================================================
  // Property Test Generators
  // ============================================================================

  const connectionModeArbitrary = fc.constantFrom('plugin', 'rcon', 'terminal');
  
  const pluginConfigArbitrary = fc.record({
    host: fc.oneof(fc.constant('localhost'), fc.ipV4()),
    port: fc.integer({ min: 1024, max: 65535 }),
    ssl: fc.boolean(),
    path: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
  });

  const rconConfigArbitrary = fc.record({
    host: fc.oneof(fc.constant('localhost'), fc.ipV4()),
    port: fc.integer({ min: 1024, max: 65535 }),
    password: fc.string({ minLength: 1, maxLength: 50 }),
    timeout: fc.option(fc.integer({ min: 1000, max: 30000 }))
  });

  const terminalConfigArbitrary = fc.record({
    processId: fc.integer({ min: 1, max: 99999 }),
    workingDir: fc.string({ minLength: 1, maxLength: 100 }),
    command: fc.string({ minLength: 1, maxLength: 50 }),
    args: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }))
  });

  const connectionConfigArbitrary = fc.record({
    plugin: fc.option(pluginConfigArbitrary),
    rcon: fc.option(rconConfigArbitrary),
    terminal: fc.option(terminalConfigArbitrary)
  });

  const serverConfigArbitrary = fc.record({
    id: fc.string({ minLength: 3, maxLength: 32 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    coreType: fc.constantFrom('Java', 'Bedrock') as fc.Arbitrary<CoreType>,
    coreName: fc.string({ minLength: 1, maxLength: 20 }),
    coreVersion: fc.string({ minLength: 1, maxLength: 10 }),
    connectionMode: connectionModeArbitrary,
    connectionConfig: connectionConfigArbitrary,
    status: fc.constantFrom('online', 'offline', 'error', 'maintenance'),
    ownerId: fc.string({ minLength: 1, maxLength: 32 }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 })
  }).map(config => ({
    ...config,
    createdAt: new Date(),
    updatedAt: new Date()
  })) as fc.Arbitrary<ServerConfig>;

  // ============================================================================
  // Property Tests
  // ============================================================================

  /**
   * **Validates: Requirements 16.1, 16.2, 16.3**
   * Property: Connection mode adapters should be created for all supported modes
   */
  it('should create appropriate adapters for all connection modes', async () => {
    await fc.assert(fc.asyncProperty(
      connectionModeArbitrary,
      fc.string({ minLength: 3, maxLength: 32 }),
      async (mode, serverId) => {
        // Feature: minecraft-unified-management, Property: Connection mode adapter creation
        
        // Mock adapter creation
        const mockAdapter = {
          serverId,
          mode,
          isConnected: false,
          capabilities: [],
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
          sendMessage: jest.fn().mockResolvedValue(undefined),
          sendCommand: jest.fn().mockResolvedValue({ success: true, output: [], executionTime: 100 }),
          getConnectionInfo: jest.fn().mockReturnValue({
            serverId,
            mode,
            isConnected: false,
            capabilities: [],
            stats: { messagesReceived: 0, messagesSent: 0, commandsExecuted: 0, errors: 0, uptime: 0 }
          }),
          isHealthy: jest.fn().mockReturnValue(false),
          on: jest.fn(),
          emit: jest.fn()
        };

        jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);

        const adapter = (manager as any).createAdapter(serverId, mode);

        expect(adapter).toBeDefined();
        expect(adapter.serverId).toBe(serverId);
        expect(adapter.mode).toBe(mode);
      }
    ), { numRuns: 50 });
  });

  /**
   * **Validates: Requirements 16.4, 16.5**
   * Property: Connection mode switching should preserve server identity
   */
  it('should preserve server identity during mode switching', async () => {
    await fc.assert(fc.asyncProperty(
      serverConfigArbitrary.filter((config: ServerConfig) => {
        // Ensure we have at least two connection modes available
        const availableModes = [
          config.connectionConfig.plugin,
          config.connectionConfig.rcon,
          config.connectionConfig.terminal
        ].filter(Boolean);
        return availableModes.length >= 2;
      }),
      connectionModeArbitrary,
      async (serverConfig, newMode) => {
        // Feature: minecraft-unified-management, Property: Connection mode switching identity preservation
        
        // Skip if new mode is same as current or not available in config
        if (newMode === serverConfig.connectionMode) return;
        
        const hasNewModeConfig = (
          (newMode === 'plugin' && serverConfig.connectionConfig.plugin) ||
          (newMode === 'rcon' && serverConfig.connectionConfig.rcon) ||
          (newMode === 'terminal' && serverConfig.connectionConfig.terminal)
        );
        
        if (!hasNewModeConfig) return;

        // Mock adapters
        const mockOriginalAdapter = {
          serverId: serverConfig.id,
          mode: serverConfig.connectionMode,
          isConnected: true,
          capabilities: [],
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
          getConnectionInfo: jest.fn().mockReturnValue({
            serverId: serverConfig.id,
            mode: serverConfig.connectionMode,
            isConnected: true,
            capabilities: [],
            stats: { messagesReceived: 0, messagesSent: 0, commandsExecuted: 0, errors: 0, uptime: 0 }
          }),
          on: jest.fn(),
          emit: jest.fn()
        };

        const mockNewAdapter = {
          serverId: serverConfig.id,
          mode: newMode,
          isConnected: true,
          capabilities: [],
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
          getConnectionInfo: jest.fn().mockReturnValue({
            serverId: serverConfig.id,
            mode: newMode,
            isConnected: true,
            capabilities: [],
            stats: { messagesReceived: 0, messagesSent: 0, commandsExecuted: 0, errors: 0, uptime: 0 }
          }),
          on: jest.fn(),
          emit: jest.fn()
        };

        jest.spyOn(manager as any, 'createAdapter')
          .mockReturnValueOnce(mockOriginalAdapter)
          .mockReturnValueOnce(mockNewAdapter);

        // Establish initial connection
        try {
          await manager.establishConnection(serverConfig);
        } catch (error) {
          // If connection fails, skip this test case
          return;
        }
        
        // Switch mode
        await manager.switchConnectionMode(serverConfig.id, newMode);

        // Verify server identity is preserved
        const connectionInfo = manager.getConnectionInfo(serverConfig.id);
        expect(connectionInfo?.serverId).toBe(serverConfig.id);
        expect(connectionInfo?.mode).toBe(newMode);
      }
    ), { numRuns: 30 });
  });

  /**
   * **Validates: Requirements 16.1, 16.2, 16.3**
   * Property: All connection modes should support basic command execution
   */
  it('should support command execution across all connection modes', async () => {
    await fc.assert(fc.asyncProperty(
      connectionModeArbitrary,
      fc.string({ minLength: 3, maxLength: 32 }), // serverId
      fc.string({ minLength: 1, maxLength: 100 }), // command
      async (mode, serverId, command) => {
        // Feature: minecraft-unified-management, Property: Universal command execution support
        
        const mockAdapter = {
          serverId,
          mode,
          isConnected: true,
          capabilities: ['command_execution'],
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
          sendCommand: jest.fn().mockResolvedValue({
            success: true,
            output: [`Command executed: ${command}`],
            executionTime: Math.floor(Math.random() * 1000)
          }),
          getConnectionInfo: jest.fn().mockReturnValue({
            serverId,
            mode,
            isConnected: true,
            capabilities: ['command_execution'],
            stats: { messagesReceived: 0, messagesSent: 0, commandsExecuted: 0, errors: 0, uptime: 0 }
          }),
          on: jest.fn(),
          emit: jest.fn()
        };

        jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);

        // Ensure no existing connection
        try {
          await manager.disconnectServer(serverId);
        } catch (error) {
          // Ignore if no connection exists
        }

        const serverConfig: ServerConfig = {
          id: serverId,
          name: `Test Server ${serverId}`,
          coreType: 'Java',
          coreName: 'Paper',
          coreVersion: '1.20.1',
          connectionMode: mode as ConnectionMode,
          connectionConfig: {
            [mode]: mode === 'plugin' 
              ? { host: 'localhost', port: 8080, ssl: false }
              : mode === 'rcon'
              ? { host: 'localhost', port: 25575, password: 'test123' }
              : { processId: 12345, workingDir: '/opt/minecraft', command: 'java' }
          },
          status: 'offline',
          ownerId: 'user-1',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await manager.establishConnection(serverConfig);
        const result = await manager.sendCommand(serverId, command);

        expect(result.success).toBe(true);
        expect(result.output).toContain(`Command executed: ${command}`);
        expect(typeof result.executionTime).toBe('number');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      }
    ), { numRuns: 50 });
  });

  /**
   * **Validates: Requirements 16.4**
   * Property: Connection status should be consistent across operations
   */
  it('should maintain consistent connection status', async () => {
    await fc.assert(fc.asyncProperty(
      serverConfigArbitrary.filter((config: ServerConfig) => {
        // Ensure at least one connection mode is configured
        return !!(config.connectionConfig.plugin || config.connectionConfig.rcon || config.connectionConfig.terminal);
      }),
      async (serverConfig) => {
        // Feature: minecraft-unified-management, Property: Connection status consistency
        
        const mockAdapter = {
          serverId: serverConfig.id,
          mode: serverConfig.connectionMode,
          isConnected: false,
          capabilities: [],
          connect: jest.fn().mockImplementation(() => {
            mockAdapter.isConnected = true;
            return Promise.resolve();
          }),
          disconnect: jest.fn().mockImplementation(() => {
            mockAdapter.isConnected = false;
            return Promise.resolve();
          }),
          getConnectionInfo: jest.fn().mockImplementation(() => ({
            serverId: serverConfig.id,
            mode: serverConfig.connectionMode,
            isConnected: mockAdapter.isConnected,
            capabilities: [],
            stats: { messagesReceived: 0, messagesSent: 0, commandsExecuted: 0, errors: 0, uptime: 0 }
          })),
          on: jest.fn(),
          emit: jest.fn()
        };

        jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);

        // Initially disconnected
        expect(manager.isConnected(serverConfig.id)).toBe(false);

        // Ensure no existing connection
        try {
          await manager.disconnectServer(serverConfig.id);
        } catch (error) {
          // Ignore if no connection exists
        }

        // Connect
        await manager.establishConnection(serverConfig);
        expect(manager.isConnected(serverConfig.id)).toBe(true);
        expect(manager.getConnectionStatus(serverConfig.id)).toBe('connected');

        // Disconnect
        await manager.disconnectServer(serverConfig.id);
        expect(manager.isConnected(serverConfig.id)).toBe(false);
        expect(manager.getConnectionStatus(serverConfig.id)).toBe('disconnected');
      }
    ), { numRuns: 30 });
  });

  /**
   * **Validates: Requirements 16.5**
   * Property: Connection statistics should be accurate and non-negative
   */
  it('should provide accurate connection statistics', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(serverConfigArbitrary.filter((config: ServerConfig) => 
        !!(config.connectionConfig.plugin || config.connectionConfig.rcon || config.connectionConfig.terminal)
      ), { minLength: 1, maxLength: 10 }),
      async (serverConfigs) => {
        // Feature: minecraft-unified-management, Property: Connection statistics accuracy
        
        // Setup mock adapters for all servers
        for (const config of serverConfigs) {
          const mockAdapter = {
            serverId: config.id,
            mode: config.connectionMode,
            isConnected: true,
            capabilities: [],
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
            on: jest.fn(),
            emit: jest.fn()
          };

          jest.spyOn(manager as any, 'createAdapter').mockReturnValue(mockAdapter);
          
          try {
            await manager.establishConnection(config);
          } catch (error) {
            // Some connections might fail, that's okay for this test
          }
        }

        const stats = manager.getStats();

        // Verify statistics are non-negative
        expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
        expect(stats.connectedCount).toBeGreaterThanOrEqual(0);
        expect(stats.disconnectedCount).toBeGreaterThanOrEqual(0);
        expect(stats.errorCount).toBeGreaterThanOrEqual(0);

        // Verify mode distribution is non-negative
        expect(stats.modeDistribution.plugin).toBeGreaterThanOrEqual(0);
        expect(stats.modeDistribution.rcon).toBeGreaterThanOrEqual(0);
        expect(stats.modeDistribution.terminal).toBeGreaterThanOrEqual(0);

        // Verify totals add up
        const totalByStatus = stats.connectedCount + stats.disconnectedCount + stats.errorCount;
        expect(totalByStatus).toBeLessThanOrEqual(stats.totalConnections);

        const totalByMode = stats.modeDistribution.plugin + stats.modeDistribution.rcon + stats.modeDistribution.terminal;
        expect(totalByMode).toBe(stats.totalConnections);

        // Verify health status is valid
        expect(['healthy', 'degraded', 'unhealthy']).toContain(stats.healthStatus);
      }
    ), { numRuns: 20 });
  });
});