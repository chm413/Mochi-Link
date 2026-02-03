/**
 * Mochi-Link (大福连) - Player Information Management Property Tests
 * 
 * Property-based tests for the player information management system
 */

import * as fc from 'fast-check';
import { Context } from 'koishi';
import { PlayerInformationService } from '../../src/services/player';
import { Player, PlayerDetail, IdentityMarkers } from '../../src/types';

// Mock Koishi context for property tests
const createMockContext = (): Context => ({
  logger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  database: {
    get: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue([{ id: 1 }]),
    set: jest.fn().mockResolvedValue({ matched: 1 }),
    remove: jest.fn().mockResolvedValue({ matched: 1 })
  }
} as unknown as Context);

// Generators for player data
const playerIdGenerator = fc.oneof(
  // Java UUID format
  fc.string({ minLength: 36, maxLength: 36 })
    .filter(s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)),
  // Bedrock XUID format (numeric)
  fc.integer({ min: 1000000000000000, max: 9999999999999999 }).map(n => n.toString()),
  // Non-premium player name-based ID
  fc.string({ minLength: 3, maxLength: 16 })
    .filter(s => /^[a-zA-Z0-9_]+$/.test(s))
);

const playerNameGenerator = fc.string({ minLength: 3, maxLength: 16 })
  .filter(s => /^[a-zA-Z0-9_]+$/.test(s));

const serverIdGenerator = fc.string({ minLength: 3, maxLength: 32 })
  .filter(s => s.trim() === s && !s.includes(' '));

const positionGenerator = fc.record({
  x: fc.double({ min: -30000000, max: 30000000 }),
  y: fc.double({ min: -64, max: 320 }),
  z: fc.double({ min: -30000000, max: 30000000 }),
  yaw: fc.option(fc.double({ min: -180, max: 180 })),
  pitch: fc.option(fc.double({ min: -90, max: 90 }))
});

const playerGenerator = fc.record({
  id: playerIdGenerator,
  name: playerNameGenerator,
  displayName: playerNameGenerator,
  world: fc.string({ minLength: 1, maxLength: 32 }),
  position: positionGenerator,
  ping: fc.integer({ min: 0, max: 1000 }),
  isOp: fc.boolean(),
  permissions: fc.array(fc.string({ minLength: 1, maxLength: 64 }), { maxLength: 10 }),
  edition: fc.constantFrom('Java', 'Bedrock'),
  deviceType: fc.option(fc.constantFrom('PC', 'Mobile', 'Console', 'Unknown')),
  ipAddress: fc.option(fc.ipV4())
});

const identityMarkersGenerator = fc.record({
  ip: fc.option(fc.ipV4()),
  device: fc.option(fc.string({ minLength: 1, maxLength: 32 })),
  firstSeen: fc.option(fc.date()),
  lastSeen: fc.option(fc.date()),
  serverIds: fc.array(serverIdGenerator, { minLength: 1, maxLength: 5 })
});

const playerDetailGenerator = fc.record({
  id: playerIdGenerator,
  name: playerNameGenerator,
  displayName: playerNameGenerator,
  world: fc.string({ minLength: 1, maxLength: 32 }),
  position: positionGenerator,
  ping: fc.integer({ min: 0, max: 1000 }),
  isOp: fc.boolean(),
  permissions: fc.array(fc.string({ minLength: 1, maxLength: 64 }), { maxLength: 10 }),
  edition: fc.constantFrom('Java', 'Bedrock'),
  deviceType: fc.option(fc.constantFrom('PC', 'Mobile', 'Console', 'Unknown')),
  ipAddress: fc.option(fc.ipV4()),
  firstJoinAt: fc.date(),
  lastSeenAt: fc.date(),
  totalPlayTime: fc.integer({ min: 0, max: 1000000 }),
  isPremium: fc.boolean(),
  identityConfidence: fc.double({ min: 0, max: 1 }),
  identityMarkers: identityMarkersGenerator
});

describe('Player Information Management Property Tests', () => {
  /**
   * **Validates: Requirements 4.1**
   * Property 3: Player Information Format Consistency
   * 
   * For any player information retrieved from different server types (Java/Bedrock),
   * the system should return a unified format with consistent field names, types,
   * and structure regardless of the source server implementation.
   */
  test('Property 3: Player information format consistency', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        javaPlayer: playerDetailGenerator,
        bedrockPlayer: playerDetailGenerator,
        serverId: serverIdGenerator
      }),
      async ({ javaPlayer, bedrockPlayer, serverId }) => {
        // Feature: minecraft-unified-management, Property 3: 玩家信息格式统一性
        const playerService = new PlayerInformationService(createMockContext());
        
        // Ensure both players have different editions
        const javaPlayerData = { ...javaPlayer, edition: 'Java' as const };
        const bedrockPlayerData = { ...bedrockPlayer, edition: 'Bedrock' as const };
        
        // Mock the bridge to return different player data
        const mockBridge = {
          getPlayerDetail: jest.fn()
            .mockResolvedValueOnce(javaPlayerData)
            .mockResolvedValueOnce(bedrockPlayerData)
        };
        
        // Override getBridge method for testing
        (playerService as any).getBridge = jest.fn().mockReturnValue(mockBridge);
        
        // Get player info from both Java and Bedrock servers
        const javaResult = await playerService.getPlayerInfo(serverId + '-java', javaPlayerData.id);
        const bedrockResult = await playerService.getPlayerInfo(serverId + '-bedrock', bedrockPlayerData.id);
        
        // Both results should have the same structure
        if (javaResult && bedrockResult) {
          // Verify all required fields are present
          const requiredFields = [
            'id', 'name', 'displayName', 'world', 'position', 'ping', 
            'isOp', 'permissions', 'edition', 'firstJoinAt', 'lastSeenAt',
            'totalPlayTime', 'isPremium', 'identityConfidence', 'identityMarkers'
          ];
          
          for (const field of requiredFields) {
            expect(javaResult).toHaveProperty(field);
            expect(bedrockResult).toHaveProperty(field);
          }
          
          // Verify field types are consistent
          expect(typeof javaResult.id).toBe('string');
          expect(typeof bedrockResult.id).toBe('string');
          
          expect(typeof javaResult.name).toBe('string');
          expect(typeof bedrockResult.name).toBe('string');
          
          expect(typeof javaResult.ping).toBe('number');
          expect(typeof bedrockResult.ping).toBe('number');
          
          expect(typeof javaResult.isOp).toBe('boolean');
          expect(typeof bedrockResult.isOp).toBe('boolean');
          
          expect(Array.isArray(javaResult.permissions)).toBe(true);
          expect(Array.isArray(bedrockResult.permissions)).toBe(true);
          
          expect(javaResult.firstJoinAt).toBeInstanceOf(Date);
          expect(bedrockResult.firstJoinAt).toBeInstanceOf(Date);
          
          expect(typeof javaResult.isPremium).toBe('boolean');
          expect(typeof bedrockResult.isPremium).toBe('boolean');
          
          expect(typeof javaResult.identityConfidence).toBe('number');
          expect(typeof bedrockResult.identityConfidence).toBe('number');
          expect(javaResult.identityConfidence).toBeGreaterThanOrEqual(0);
          expect(javaResult.identityConfidence).toBeLessThanOrEqual(1);
          expect(bedrockResult.identityConfidence).toBeGreaterThanOrEqual(0);
          expect(bedrockResult.identityConfidence).toBeLessThanOrEqual(1);
          
          // Verify position structure is consistent
          expect(javaResult.position).toHaveProperty('x');
          expect(javaResult.position).toHaveProperty('y');
          expect(javaResult.position).toHaveProperty('z');
          expect(bedrockResult.position).toHaveProperty('x');
          expect(bedrockResult.position).toHaveProperty('y');
          expect(bedrockResult.position).toHaveProperty('z');
          
          // Verify identity markers structure is consistent
          expect(javaResult.identityMarkers).toHaveProperty('serverIds');
          expect(bedrockResult.identityMarkers).toHaveProperty('serverIds');
          expect(Array.isArray(javaResult.identityMarkers.serverIds)).toBe(true);
          expect(Array.isArray(bedrockResult.identityMarkers.serverIds)).toBe(true);
          
          // Verify edition-specific consistency
          expect(['Java', 'Bedrock']).toContain(javaResult.edition);
          expect(['Java', 'Bedrock']).toContain(bedrockResult.edition);
        }
      }
    ), { numRuns: 10 });
  });

  /**
   * Player information caching consistency property
   * 
   * Verifies that cached player information maintains the same format
   * and structure as fresh data from the server.
   */
  test('Property: Player information caching consistency', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        player: playerDetailGenerator,
        serverId: serverIdGenerator
      }),
      async ({ player, serverId }) => {
        const playerService = new PlayerInformationService(createMockContext());
        
        // Mock the bridge to return player data
        const mockBridge = {
          getPlayerDetail: jest.fn().mockResolvedValue(player)
        };
        
        (playerService as any).getBridge = jest.fn().mockReturnValue(mockBridge);
        
        // Get player info twice (first should cache, second should use cache)
        const firstResult = await playerService.getPlayerInfo(serverId, player.id);
        const secondResult = await playerService.getPlayerInfo(serverId, player.id);
        
        // Both results should be identical
        if (firstResult && secondResult) {
          expect(firstResult).toEqual(secondResult);
          
          // Verify cache statistics are updated
          const stats = playerService.getCacheStats();
          expect(stats.totalPlayers).toBeGreaterThan(0);
        }
      }
    ), { numRuns: 5 });
  });

  /**
   * Player search result format consistency property
   * 
   * Verifies that player search results maintain consistent format
   * regardless of search criteria or number of matches.
   */
  test('Property: Player search result format consistency', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        players: fc.array(playerDetailGenerator, { minLength: 1, maxLength: 5 }),
        searchName: playerNameGenerator,
        serverId: serverIdGenerator
      }),
      async ({ players, searchName, serverId }) => {
        const playerService = new PlayerInformationService(createMockContext());
        
        // Mock the bridge to return online players
        const mockBridge = {
          getOnlinePlayers: jest.fn().mockResolvedValue(
            players.map(p => ({
              id: p.id,
              name: p.name,
              displayName: p.displayName,
              world: p.world,
              position: p.position,
              ping: p.ping,
              isOp: p.isOp,
              permissions: p.permissions,
              edition: p.edition,
              deviceType: p.deviceType,
              ipAddress: p.ipAddress
            }))
          )
        };
        
        (playerService as any).getBridge = jest.fn().mockReturnValue(mockBridge);
        (playerService as any).getConnectedServerIds = jest.fn().mockReturnValue([serverId]);
        
        // Search for players
        const searchResults = await playerService.searchPlayers({
          name: searchName,
          serverId: serverId
        });
        
        // Verify all search results have consistent format
        for (const match of searchResults) {
          expect(match).toHaveProperty('player');
          expect(match).toHaveProperty('confidence');
          expect(match).toHaveProperty('matchedBy');
          
          expect(typeof match.confidence).toBe('number');
          expect(match.confidence).toBeGreaterThanOrEqual(0);
          expect(match.confidence).toBeLessThanOrEqual(1);
          
          expect(Array.isArray(match.matchedBy)).toBe(true);
          
          // Verify player object has consistent structure
          const player = match.player;
          expect(player).toHaveProperty('id');
          expect(player).toHaveProperty('name');
          expect(player).toHaveProperty('edition');
          expect(typeof player.id).toBe('string');
          expect(typeof player.name).toBe('string');
          expect(['Java', 'Bedrock']).toContain(player.edition);
        }
      }
    ), { numRuns: 5 });
  });

  /**
   * Identity confidence calculation consistency property
   * 
   * Verifies that identity confidence values are calculated consistently
   * and fall within the expected range [0, 1].
   */
  test('Property: Identity confidence calculation consistency', async () => {
    await fc.assert(fc.asyncProperty(
      playerGenerator,
      async (player) => {
        const playerService = new PlayerInformationService(createMockContext());
        
        // Test the private method through reflection for property testing
        const calculateConfidence = (playerService as any).calculateIdentityConfidence.bind(playerService);
        
        const confidence = calculateConfidence(player);
        
        // Confidence should always be a number between 0 and 1
        expect(typeof confidence).toBe('number');
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
        expect(Number.isFinite(confidence)).toBe(true);
        expect(Number.isNaN(confidence)).toBe(false);
        
        // Premium players should have higher confidence
        const isPremium = (playerService as any).detectPremiumStatus(player);
        if (isPremium) {
          expect(confidence).toBeGreaterThan(0.5);
        }
      }
    ), { numRuns: 20 });
  });

  /**
   * Premium status detection consistency property
   * 
   * Verifies that premium status detection is consistent and follows
   * the expected patterns for Java and Bedrock editions.
   */
  test('Property: Premium status detection consistency', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        javaUuid: fc.string({ minLength: 36, maxLength: 36 })
          .filter(s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)),
        bedrockXuid: fc.integer({ min: 1000000000000000, max: 9999999999999999 }).map(n => n.toString()),
        nonPremiumId: fc.string({ minLength: 3, maxLength: 16 })
          .filter(s => /^[a-zA-Z0-9_]+$/.test(s) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)),
        playerName: playerNameGenerator
      }),
      async ({ javaUuid, bedrockXuid, nonPremiumId, playerName }) => {
        const playerService = new PlayerInformationService(createMockContext());
        const detectPremium = (playerService as any).detectPremiumStatus.bind(playerService);
        
        // Test Java premium player
        const javaPlayer: Player = {
          id: javaUuid,
          name: playerName,
          displayName: playerName,
          world: 'world',
          position: { x: 0, y: 64, z: 0 },
          ping: 50,
          isOp: false,
          permissions: [],
          edition: 'Java'
        };
        
        const javaIsPremium = detectPremium(javaPlayer);
        expect(typeof javaIsPremium).toBe('boolean');
        expect(javaIsPremium).toBe(true); // Valid UUID should be premium
        
        // Test Bedrock premium player
        const bedrockPlayer: Player = {
          id: bedrockXuid,
          name: playerName,
          displayName: playerName,
          world: 'world',
          position: { x: 0, y: 64, z: 0 },
          ping: 50,
          isOp: false,
          permissions: [],
          edition: 'Bedrock'
        };
        
        const bedrockIsPremium = detectPremium(bedrockPlayer);
        expect(typeof bedrockIsPremium).toBe('boolean');
        expect(bedrockIsPremium).toBe(true); // Valid XUID should be premium
        
        // Test non-premium player
        const nonPremiumPlayer: Player = {
          id: nonPremiumId,
          name: playerName,
          displayName: playerName,
          world: 'world',
          position: { x: 0, y: 64, z: 0 },
          ping: 50,
          isOp: false,
          permissions: [],
          edition: 'Java'
        };
        
        const nonPremiumIsPremium = detectPremium(nonPremiumPlayer);
        expect(typeof nonPremiumIsPremium).toBe('boolean');
        expect(nonPremiumIsPremium).toBe(false); // Non-UUID should not be premium
      }
    ), { numRuns: 10 });
  });
});