/**
 * Player Information Format Consistency Property Tests
 * 
 * Property-based tests to verify that player information queries return
 * data in a unified format across all server types.
 */

import * as fc from 'fast-check';
import { createConnectorBridge } from '../../src/bridge';
import { BridgeConfig } from '../../src/bridge/types';
import { CoreType, Player } from '../../src/types';

// ============================================================================
// Test Utilities and Arbitraries
// ============================================================================

/**
 * Generate arbitrary server configurations for different core types
 */
const serverConfigArbitrary = fc.record({
  serverId: fc.string({ minLength: 5, maxLength: 32 }).map(s => {
    const sanitized = s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return sanitized || 'test-server';
  }),
  coreType: fc.constantFrom('Java', 'Bedrock') as fc.Arbitrary<CoreType>,
  coreName: fc.oneof(
    fc.constantFrom('Paper', 'Folia', 'Spigot', 'Bukkit'),
    fc.constantFrom('LLBDS', 'PMMP', 'Nukkit', 'BDS')
  ),
  coreVersion: fc.string({ minLength: 3, maxLength: 10 }).map(v => {
    const sanitized = v.replace(/[^0-9.]/g, '').substring(0, 10);
    return sanitized || '1.20.1';
  })
}).filter(config => {
  const javaNames = ['Paper', 'Folia', 'Spigot', 'Bukkit'];
  const bedrockNames = ['LLBDS', 'PMMP', 'Nukkit', 'BDS'];
  
  if (config.coreType === 'Java') {
    return javaNames.includes(config.coreName);
  } else {
    return bedrockNames.includes(config.coreName);
  }
});

/**
 * Generate mock player data for testing
 */
const mockPlayerDataArbitrary = fc.record({
  playerCount: fc.integer({ min: 0, max: 10 }),
  playerNames: fc.array(fc.string({ minLength: 3, maxLength: 16 }), { minLength: 0, maxLength: 10 })
});

/**
 * Create mock connection adapter with player data
 */
const createMockConnectionAdapter = (playerData: any) => ({
  isConnected: true,
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  sendCommand: jest.fn().mockImplementation((command: string) => {
    if (command === 'list') {
      const playerList = playerData.playerNames.join(', ');
      return Promise.resolve({
        success: true,
        output: [`There are ${playerData.playerCount} of a max of 20 players online: ${playerList}`],
        executionTime: 100
      });
    }
    return Promise.resolve({
      success: true,
      output: ['Mock command response'],
      executionTime: 100
    });
  }),
  on: jest.fn(),
  emit: jest.fn()
});

// ============================================================================
// Property 3: Player Information Format Consistency
// ============================================================================

describe('Property 3: Player information format consistency', () => {
  /**
   * **Validates: Requirements 4.1**
   * 
   * For any server type's player information query, the returned player data
   * should conform to a unified data structure format, including UUID/XUID,
   * name, display name, world, coordinates, ping, and other standard fields.
   */
  it('should return consistent player data format for all server types', async () => {
    await fc.assert(fc.asyncProperty(
      serverConfigArbitrary,
      mockPlayerDataArbitrary,
      async (serverConfig, playerData) => {
        // Feature: minecraft-unified-management, Property 3: 玩家信息格式统一性
        
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
        const mockAdapter = createMockConnectionAdapter(playerData);
        let bridge;
        
        try {
          bridge = createConnectorBridge(bridgeConfig, mockAdapter);
        } catch (error) {
          if (error instanceof Error && error.message.includes('Unsupported core type')) {
            return; // Skip unsupported configurations
          }
          throw error;
        }

        // Connect the bridge
        await bridge.connect();
        expect(bridge.isConnectedToBridge()).toBe(true);

        // Get online players
        const players = await bridge.getOnlinePlayers();
        
        // Verify players is an array
        expect(Array.isArray(players)).toBe(true);
        
        // Test each player in the list
        for (const player of players) {
          // Verify required fields exist and have correct types
          expect(typeof player.id).toBe('string');
          expect(player.id.length).toBeGreaterThan(0);
          
          expect(typeof player.name).toBe('string');
          expect(player.name.length).toBeGreaterThan(0);
          
          expect(typeof player.displayName).toBe('string');
          expect(player.displayName.length).toBeGreaterThan(0);
          
          expect(typeof player.world).toBe('string');
          expect(player.world.length).toBeGreaterThan(0);
          
          // Verify position object structure
          expect(player.position).toBeDefined();
          expect(typeof player.position.x).toBe('number');
          expect(typeof player.position.y).toBe('number');
          expect(typeof player.position.z).toBe('number');
          expect(Number.isFinite(player.position.x)).toBe(true);
          expect(Number.isFinite(player.position.y)).toBe(true);
          expect(Number.isFinite(player.position.z)).toBe(true);
          
          // Verify numeric fields
          expect(typeof player.ping).toBe('number');
          expect(player.ping).toBeGreaterThanOrEqual(0);
          
          // Verify boolean fields
          expect(typeof player.isOp).toBe('boolean');
          
          // Verify array fields
          expect(Array.isArray(player.permissions)).toBe(true);
          
          // Verify edition field matches server type
          expect(['Java', 'Bedrock']).toContain(player.edition);
          expect(player.edition).toBe(serverConfig.coreType);
          
          // Verify optional fields have correct types when present
          if (player.deviceType !== undefined) {
            expect(typeof player.deviceType).toBe('string');
          }
          
          if (player.ipAddress !== undefined) {
            expect(typeof player.ipAddress).toBe('string');
            // Basic IP format validation
            expect(player.ipAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$|^[a-fA-F0-9:]+$/);
          }
        }
        
        // Verify player count consistency (allow for empty player list)
        if (playerData.playerCount > 0) {
          expect(players.length).toBeGreaterThan(0);
          expect(players.length).toBeLessThanOrEqual(playerData.playerCount);
        } else {
          expect(players.length).toBe(0);
        }
        
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
   * Test that player detail information follows the same format consistency
   */
  it('should return consistent player detail format across server types', async () => {
    await fc.assert(fc.asyncProperty(
      serverConfigArbitrary.filter(config => 
        Boolean(config.serverId && config.serverId.length > 0)
      ),
      fc.string({ minLength: 3, maxLength: 16 }), // player name
      async (serverConfig, playerName) => {
        // Feature: minecraft-unified-management, Property 3: 玩家信息格式统一性
        
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

        const mockAdapter = createMockConnectionAdapter({
          playerCount: 1,
          playerNames: [playerName]
        });
        
        const bridge = createConnectorBridge(bridgeConfig, mockAdapter);
        await bridge.connect();

        // Try to get player detail (may return null for mock implementation)
        const playerDetail = await bridge.getPlayerDetail(playerName);
        
        if (playerDetail !== null) {
          // Verify all base Player fields are present
          expect(typeof playerDetail.id).toBe('string');
          expect(typeof playerDetail.name).toBe('string');
          expect(typeof playerDetail.displayName).toBe('string');
          expect(typeof playerDetail.world).toBe('string');
          expect(playerDetail.position).toBeDefined();
          expect(typeof playerDetail.ping).toBe('number');
          expect(typeof playerDetail.isOp).toBe('boolean');
          expect(Array.isArray(playerDetail.permissions)).toBe(true);
          expect(['Java', 'Bedrock']).toContain(playerDetail.edition);
          
          // Verify additional PlayerDetail fields
          expect(playerDetail.firstJoinAt).toBeInstanceOf(Date);
          expect(playerDetail.lastSeenAt).toBeInstanceOf(Date);
          expect(typeof playerDetail.totalPlayTime).toBe('number');
          expect(playerDetail.totalPlayTime).toBeGreaterThanOrEqual(0);
          expect(typeof playerDetail.isPremium).toBe('boolean');
          expect(typeof playerDetail.identityConfidence).toBe('number');
          expect(playerDetail.identityConfidence).toBeGreaterThanOrEqual(0);
          expect(playerDetail.identityConfidence).toBeLessThanOrEqual(1);
          
          // Verify identity markers structure
          expect(playerDetail.identityMarkers).toBeDefined();
          expect(Array.isArray(playerDetail.identityMarkers.serverIds)).toBe(true);
          
          if (playerDetail.identityMarkers.firstSeen !== undefined) {
            expect(playerDetail.identityMarkers.firstSeen).toBeInstanceOf(Date);
          }
          
          if (playerDetail.identityMarkers.lastSeen !== undefined) {
            expect(playerDetail.identityMarkers.lastSeen).toBeInstanceOf(Date);
          }
        }
        
        await bridge.disconnect();
      }
    ), { 
      numRuns: 30,
      timeout: 20000
    });
  });

  /**
   * Test that server information format is consistent
   */
  it('should return consistent server information format', async () => {
    await fc.assert(fc.asyncProperty(
      serverConfigArbitrary.filter(config => 
        Boolean(config.serverId && config.serverId.length > 0)
      ),
      async (serverConfig) => {
        // Feature: minecraft-unified-management, Property 3: 玩家信息格式统一性
        
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

        const mockAdapter = createMockConnectionAdapter({
          playerCount: 0,
          playerNames: []
        });
        
        const bridge = createConnectorBridge(bridgeConfig, mockAdapter);
        await bridge.connect();

        const serverInfo = await bridge.getServerInfo();
        
        // Verify server info structure
        expect(typeof serverInfo.serverId).toBe('string');
        expect(serverInfo.serverId).toBe(serverConfig.serverId);
        
        expect(typeof serverInfo.name).toBe('string');
        expect(serverInfo.name.length).toBeGreaterThan(0);
        
        expect(typeof serverInfo.version).toBe('string');
        expect(serverInfo.version.length).toBeGreaterThan(0);
        
        expect(['Java', 'Bedrock']).toContain(serverInfo.coreType);
        expect(serverInfo.coreType).toBe(serverConfig.coreType);
        
        expect(typeof serverInfo.coreName).toBe('string');
        expect(serverInfo.coreName.length).toBeGreaterThan(0);
        
        expect(typeof serverInfo.maxPlayers).toBe('number');
        expect(serverInfo.maxPlayers).toBeGreaterThan(0);
        
        expect(typeof serverInfo.onlinePlayers).toBe('number');
        expect(serverInfo.onlinePlayers).toBeGreaterThanOrEqual(0);
        expect(serverInfo.onlinePlayers).toBeLessThanOrEqual(serverInfo.maxPlayers);
        
        expect(typeof serverInfo.uptime).toBe('number');
        expect(serverInfo.uptime).toBeGreaterThanOrEqual(0);
        
        expect(typeof serverInfo.tps).toBe('number');
        expect(serverInfo.tps).toBeGreaterThan(0);
        expect(serverInfo.tps).toBeLessThanOrEqual(20);
        
        // Verify memory usage structure
        expect(serverInfo.memoryUsage).toBeDefined();
        expect(typeof serverInfo.memoryUsage.used).toBe('number');
        expect(typeof serverInfo.memoryUsage.max).toBe('number');
        expect(typeof serverInfo.memoryUsage.free).toBe('number');
        expect(typeof serverInfo.memoryUsage.percentage).toBe('number');
        expect(serverInfo.memoryUsage.used).toBeGreaterThanOrEqual(0);
        expect(serverInfo.memoryUsage.max).toBeGreaterThanOrEqual(0);
        expect(serverInfo.memoryUsage.free).toBeGreaterThanOrEqual(0);
        expect(serverInfo.memoryUsage.percentage).toBeGreaterThanOrEqual(0);
        expect(serverInfo.memoryUsage.percentage).toBeLessThanOrEqual(100);
        
        // Verify world info structure
        expect(Array.isArray(serverInfo.worldInfo)).toBe(true);
        for (const world of serverInfo.worldInfo) {
          expect(typeof world.name).toBe('string');
          expect(world.name.length).toBeGreaterThan(0);
          expect(typeof world.dimension).toBe('string');
          expect(typeof world.playerCount).toBe('number');
          expect(world.playerCount).toBeGreaterThanOrEqual(0);
          expect(typeof world.loadedChunks).toBe('number');
          expect(world.loadedChunks).toBeGreaterThanOrEqual(0);
        }
        
        await bridge.disconnect();
      }
    ), { 
      numRuns: 30,
      timeout: 20000
    });
  });
});