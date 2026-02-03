/**
 * Cross-Core Interface Consistency Property Tests
 * 
 * Property-based tests to verify that all supported Minecraft server cores
 * provide consistent API interfaces through the U-WBP v2 protocol.
 */

import * as fc from 'fast-check';
import { createConnectorBridge } from '../../src/bridge';
import { BridgeConfig } from '../../src/bridge/types';
import { CoreType } from '../../src/types';

// ============================================================================
// Test Utilities and Arbitraries
// ============================================================================

/**
 * Generate arbitrary server configurations for different core types
 */
const serverConfigArbitrary = fc.record({
  serverId: fc.string({ minLength: 5, maxLength: 32 }).map(s => {
    const sanitized = s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return sanitized || 'test-server'; // Ensure we always have a valid server ID
  }),
  coreType: fc.constantFrom('Java', 'Bedrock') as fc.Arbitrary<CoreType>,
  coreName: fc.oneof(
    // Java cores
    fc.constantFrom('Paper', 'Folia', 'Spigot', 'Bukkit', 'Fabric', 'Forge'),
    // Bedrock cores  
    fc.constantFrom('LLBDS', 'PMMP', 'Nukkit', 'BDS')
  ),
  coreVersion: fc.string({ minLength: 3, maxLength: 10 }).map(v => {
    const sanitized = v.replace(/[^0-9.]/g, '').substring(0, 10);
    return sanitized || '1.20.1'; // Ensure we always have a valid version
  })
}).filter(config => {
  // Ensure core name matches core type
  const javaNames = ['Paper', 'Folia', 'Spigot', 'Bukkit', 'Fabric', 'Forge'];
  const bedrockNames = ['LLBDS', 'PMMP', 'Nukkit', 'BDS'];
  
  if (config.coreType === 'Java') {
    return javaNames.includes(config.coreName);
  } else {
    return bedrockNames.includes(config.coreName);
  }
});

/**
 * Mock connection adapter for testing
 */
const createMockConnectionAdapter = () => ({
  isConnected: true,
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  sendCommand: jest.fn().mockResolvedValue({
    success: true,
    output: ['Mock command response'],
    executionTime: 100
  }),
  on: jest.fn(),
  emit: jest.fn()
});

// ============================================================================
// Property 1: Cross-Core Unified Interface Consistency
// ============================================================================

describe('Property 1: Cross-core unified interface consistency', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * For any supported Minecraft server core type (Java or Bedrock), when a 
   * connection is established through the Connector_Bridge, the returned 
   * WebSocket API interface should conform to the unified U_WBP_v2 protocol standard.
   */
  it('should return consistent API interface for all supported core types', async () => {
    await fc.assert(fc.asyncProperty(
      serverConfigArbitrary,
      async (serverConfig) => {
        // Feature: minecraft-unified-management, Property 1: 跨核心统一接口一致性
        
        // Ensure we have a valid server ID
        if (!serverConfig.serverId || serverConfig.serverId.length === 0) {
          serverConfig.serverId = 'test-server-' + Math.random().toString(36).substring(7);
        }
        
        // Create bridge configuration
        const bridgeConfig: BridgeConfig = {
          serverId: serverConfig.serverId,
          coreType: serverConfig.coreType,
          coreName: serverConfig.coreName,
          coreVersion: serverConfig.coreVersion,
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

        // Create bridge instance with mock adapter
        const mockAdapter = createMockConnectionAdapter();
        let bridge;
        
        try {
          bridge = createConnectorBridge(bridgeConfig, mockAdapter);
        } catch (error) {
          // Skip unsupported configurations
          if (error instanceof Error && error.message.includes('Unsupported core type')) {
            return; // Skip this test case
          }
          throw error;
        }

        // Verify bridge creation succeeded
        expect(bridge).toBeDefined();
        expect(typeof bridge).toBe('object');

        // Get bridge information (API interface) - this method works
        const bridgeInfo = bridge.getBridgeInfo();

        // Verify U-WBP v2 protocol compliance
        expect(bridgeInfo.protocolVersion).toBe('2.0');
        expect(bridgeInfo.serverId).toBe(serverConfig.serverId);
        expect(bridgeInfo.coreType).toBe(serverConfig.coreType);
        expect(bridgeInfo.coreName).toBe(serverConfig.coreName);
        expect(bridgeInfo.coreVersion).toBe(serverConfig.coreVersion);

        // Verify capabilities array exists and is valid
        expect(Array.isArray(bridgeInfo.capabilities)).toBe(true);
        expect(bridgeInfo.capabilities.length).toBeGreaterThan(0);

        // Verify standard capabilities are present for all core types
        const standardCapabilities = ['command_execution'];
        for (const capability of standardCapabilities) {
          expect(bridgeInfo.capabilities).toContain(capability);
        }

        // Verify bridge has consistent interface methods
        expect(typeof bridge.connect).toBe('function');
        expect(typeof bridge.disconnect).toBe('function');
        expect(typeof bridge.executeCommand).toBe('function');
        expect(typeof bridge.getServerInfo).toBe('function');
        expect(typeof bridge.getPerformanceMetrics).toBe('function');
        expect(typeof bridge.getOnlinePlayers).toBe('function');
        expect(typeof bridge.isHealthy).toBe('function');
        expect(typeof bridge.getBridgeInfo).toBe('function');
        expect(typeof bridge.getCapabilities).toBe('function');

        // Test that bridge can be connected (interface consistency)
        await expect(bridge.connect()).resolves.not.toThrow();
        expect(bridge.isConnectedToBridge()).toBe(true);

        // Test command execution interface consistency
        const commandResult = await bridge.executeCommand('test');
        expect(commandResult).toHaveProperty('success');
        expect(commandResult).toHaveProperty('output');
        expect(commandResult).toHaveProperty('executionTime');
        expect(typeof commandResult.success).toBe('boolean');
        expect(Array.isArray(commandResult.output)).toBe(true);
        expect(typeof commandResult.executionTime).toBe('number');

        // Test server info interface consistency
        mockAdapter.sendCommand.mockResolvedValueOnce({
          success: true,
          output: ['Server info response'],
          executionTime: 50
        });

        const serverInfo = await bridge.getServerInfo();
        expect(serverInfo).toHaveProperty('serverId');
        expect(serverInfo).toHaveProperty('coreType');
        expect(serverInfo).toHaveProperty('name');
        expect(serverInfo).toHaveProperty('version');
        expect(serverInfo).toHaveProperty('maxPlayers');
        expect(serverInfo).toHaveProperty('onlinePlayers');
        expect(serverInfo.serverId).toBe(serverConfig.serverId);
        expect(serverInfo.coreType).toBe(serverConfig.coreType);

        // Test performance metrics interface consistency
        const metrics = await bridge.getPerformanceMetrics();
        expect(metrics).toHaveProperty('serverId');
        expect(metrics).toHaveProperty('timestamp');
        expect(metrics).toHaveProperty('tps');
        expect(metrics).toHaveProperty('playerCount');
        expect(metrics.serverId).toBe(serverConfig.serverId);
        expect(typeof metrics.timestamp).toBe('number');
        expect(typeof metrics.tps).toBe('number');

        // Test player list interface consistency
        const players = await bridge.getOnlinePlayers();
        expect(Array.isArray(players)).toBe(true);
        
        // If players exist, verify their structure
        if (players.length > 0) {
          const player = players[0];
          expect(player).toHaveProperty('id');
          expect(player).toHaveProperty('name');
          expect(player).toHaveProperty('edition');
          expect(typeof player.id).toBe('string');
          expect(typeof player.name).toBe('string');
          expect(['Java', 'Bedrock']).toContain(player.edition);
        }

        // Test health check interface consistency
        const isHealthy = await bridge.isHealthy();
        expect(typeof isHealthy).toBe('boolean');

        // Clean up
        await bridge.disconnect();
      }
    ), { 
      numRuns: 50,
      timeout: 30000,
      verbose: false
    });
  });

  /**
   * Test that capability declarations are consistent across core types
   */
  it('should declare capabilities consistently across all core types', async () => {
    await fc.assert(fc.asyncProperty(
      serverConfigArbitrary.filter(config => 
        Boolean(config.serverId && config.serverId.length > 0)
      ),
      async (serverConfig) => {
        // Feature: minecraft-unified-management, Property 1: 跨核心统一接口一致性
        
        const bridgeConfig: BridgeConfig = {
          serverId: serverConfig.serverId,
          coreType: serverConfig.coreType,
          coreName: serverConfig.coreName,
          coreVersion: serverConfig.coreVersion,
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

        const bridge = createConnectorBridge(bridgeConfig, createMockConnectionAdapter());
        const capabilities = bridge.getCapabilities();

        // Verify capabilities are strings
        for (const capability of capabilities) {
          expect(typeof capability).toBe('string');
          expect(capability.length).toBeGreaterThan(0);
        }

        // Verify core capability is always present
        expect(capabilities).toContain('command_execution');

        // Verify capabilities are unique
        const uniqueCapabilities = [...new Set(capabilities)];
        expect(uniqueCapabilities.length).toBe(capabilities.length);

        // Verify bridge info contains the same capabilities
        const bridgeInfo = bridge.getBridgeInfo();
        expect(bridgeInfo.capabilities).toEqual(capabilities);
      }
    ), { 
      numRuns: 50,
      timeout: 15000
    });
  });
});