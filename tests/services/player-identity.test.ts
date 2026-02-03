/**
 * Mochi-Link (大福连) - Non-Premium Player Identity Recognition Tests
 * 
 * Unit tests for non-premium player identity recognition system
 */

import { Context } from 'koishi';
import { PlayerInformationService } from '../../src/services/player';
import { Player } from '../../src/types';

// Mock Koishi context
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

describe('Non-Premium Player Identity Recognition', () => {
  let playerService: PlayerInformationService;

  beforeEach(() => {
    playerService = new PlayerInformationService(createMockContext());
  });

  describe('Premium Status Detection', () => {
    it('should detect Java premium players by UUID format', () => {
      const premiumPlayer: Player = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'TestPlayer',
        displayName: 'TestPlayer',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: [],
        edition: 'Java'
      };

      const detectPremium = (playerService as any).detectPremiumStatus.bind(playerService);
      expect(detectPremium(premiumPlayer)).toBe(true);
    });

    it('should detect Bedrock premium players by XUID format', () => {
      const premiumPlayer: Player = {
        id: '2535428692344834',
        name: 'TestPlayer',
        displayName: 'TestPlayer',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: [],
        edition: 'Bedrock'
      };

      const detectPremium = (playerService as any).detectPremiumStatus.bind(playerService);
      expect(detectPremium(premiumPlayer)).toBe(true);
    });

    it('should detect non-premium players by invalid ID format', () => {
      const nonPremiumPlayer: Player = {
        id: 'TestPlayer123',
        name: 'TestPlayer123',
        displayName: 'TestPlayer123',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: [],
        edition: 'Java'
      };

      const detectPremium = (playerService as any).detectPremiumStatus.bind(playerService);
      expect(detectPremium(nonPremiumPlayer)).toBe(false);
    });
  });

  describe('Identity Confidence Calculation', () => {
    it('should assign higher confidence to premium players', () => {
      const premiumPlayer: Player = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'TestPlayer',
        displayName: 'TestPlayer',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: [],
        edition: 'Java'
      };

      const calculateConfidence = (playerService as any).calculateIdentityConfidence.bind(playerService);
      const confidence = calculateConfidence(premiumPlayer);
      
      expect(confidence).toBeGreaterThan(0.8);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should assign lower confidence to non-premium players', () => {
      const nonPremiumPlayer: Player = {
        id: 'TestPlayer123',
        name: 'TestPlayer123',
        displayName: 'TestPlayer123',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: [],
        edition: 'Java'
      };

      const calculateConfidence = (playerService as any).calculateIdentityConfidence.bind(playerService);
      const confidence = calculateConfidence(nonPremiumPlayer);
      
      expect(confidence).toBeLessThan(0.9);
      expect(confidence).toBeGreaterThan(0);
    });

    it('should increase confidence with additional identity markers', () => {
      const playerWithMarkers: Player = {
        id: 'TestPlayer123',
        name: 'TestPlayer123',
        displayName: 'TestPlayer123',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: [],
        edition: 'Java',
        deviceType: 'PC',
        ipAddress: '192.168.1.100'
      };

      const playerWithoutMarkers: Player = {
        id: 'TestPlayer456',
        name: 'TestPlayer456',
        displayName: 'TestPlayer456',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: [],
        edition: 'Java'
      };

      const calculateConfidence = (playerService as any).calculateIdentityConfidence.bind(playerService);
      const confidenceWithMarkers = calculateConfidence(playerWithMarkers);
      const confidenceWithoutMarkers = calculateConfidence(playerWithoutMarkers);
      
      expect(confidenceWithMarkers).toBeGreaterThan(confidenceWithoutMarkers);
    });
  });

  describe('Identity Conflict Detection', () => {
    it('should return empty array when no conflicts exist', () => {
      const player = {
        id: 'UniquePlayer',
        name: 'UniquePlayer',
        identityConfidence: 0.7,
        identityMarkers: {
          serverIds: ['server1'],
          firstSeen: new Date(),
          lastSeen: new Date()
        }
      };

      const identifyConflicts = (playerService as any).identifyPlayerConflicts.bind(playerService);
      const conflicts = identifyConflicts(player);
      
      expect(Array.isArray(conflicts)).toBe(true);
      expect(conflicts.length).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should return valid cache statistics', () => {
      const stats = playerService.getCacheStats();
      
      expect(stats).toHaveProperty('totalPlayers');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('averageConfidence');
      expect(stats).toHaveProperty('conflictCount');
      
      expect(typeof stats.totalPlayers).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.averageConfidence).toBe('number');
      expect(typeof stats.conflictCount).toBe('number');
      
      expect(stats.totalPlayers).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeLessThanOrEqual(1);
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
      expect(stats.conflictCount).toBeGreaterThanOrEqual(0);
    });
  });
});