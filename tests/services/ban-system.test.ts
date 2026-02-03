/**
 * Mochi-Link (大福连) - Ban System Tests
 * 
 * Unit tests for the ban system functionality
 */

import { Context } from 'koishi';
import { WhitelistManager } from '../../src/services/whitelist';

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

describe('Ban System', () => {
  let whitelistManager: WhitelistManager;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = createMockContext();
    whitelistManager = new WhitelistManager(mockContext);
    jest.clearAllMocks();
  });

  describe('Player Banning', () => {
    it('should ban a player when server is online', async () => {
      // Mock server as online
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(true);
      
      const mockBridge = {
        hasCapability: jest.fn().mockReturnValue(true),
        banTarget: jest.fn().mockResolvedValue(true)
      };
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);

      const result = await whitelistManager.banTarget(
        'test-server',
        'player',
        'TestPlayer',
        'TestPlayer',
        'Cheating',
        'admin',
        24 * 60 * 60 * 1000 // 24 hours
      );

      expect(result).toBe(true);
      expect(mockBridge.banTarget).toHaveBeenCalledWith(
        'player',
        'TestPlayer',
        'TestPlayer',
        'Cheating',
        24 * 60 * 60 * 1000
      );

      // Should have no pending operations
      expect(whitelistManager.getPendingBanOperationsCount('test-server')).toBe(0);
    });

    it('should cache ban operation when server is offline', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      const result = await whitelistManager.banTarget(
        'test-server',
        'player',
        'TestPlayer',
        'TestPlayer',
        'Griefing',
        'admin'
      );

      // Should return true (operation cached successfully)
      expect(result).toBe(true);

      // Should have one pending operation
      expect(whitelistManager.getPendingBanOperationsCount('test-server')).toBe(1);

      // Verify the cached operation
      const pendingOps = whitelistManager.getPendingBanOperations('test-server');
      expect(pendingOps.length).toBe(1);
      expect(pendingOps[0].type).toBe('ban');
      expect(pendingOps[0].banType).toBe('player');
      expect(pendingOps[0].target).toBe('TestPlayer');
      expect(pendingOps[0].reason).toBe('Griefing');
      expect(pendingOps[0].executor).toBe('admin');
    });

    it('should check if player is banned', async () => {
      // Mock server as offline to force caching
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Ban a player
      await whitelistManager.banTarget(
        'test-server',
        'player',
        'TestPlayer',
        'TestPlayer',
        'Test ban',
        'admin'
      );

      // Mock the ban cache to simulate the ban being processed
      const mockBanEntry = {
        id: 'test-ban-1',
        serverId: 'test-server',
        banType: 'player' as const,
        target: 'TestPlayer',
        targetName: 'TestPlayer',
        reason: 'Test ban',
        bannedBy: 'admin',
        bannedAt: new Date(),
        isActive: true
      };
      
      (whitelistManager as any).banCache.set('test-server', [mockBanEntry]);

      const isBanned = await whitelistManager.isBanned('test-server', 'player', 'TestPlayer');
      expect(isBanned).toBe(true);

      const isNotBanned = await whitelistManager.isBanned('test-server', 'player', 'OtherPlayer');
      expect(isNotBanned).toBe(false);
    });
  });

  describe('IP Banning', () => {
    it('should ban an IP address', async () => {
      // Mock server as online
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(true);
      
      const mockBridge = {
        hasCapability: jest.fn().mockReturnValue(true),
        banTarget: jest.fn().mockResolvedValue(true)
      };
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);

      const result = await whitelistManager.banTarget(
        'test-server',
        'ip',
        '192.168.1.100',
        undefined,
        'Suspicious activity',
        'admin'
      );

      expect(result).toBe(true);
      expect(mockBridge.banTarget).toHaveBeenCalledWith(
        'ip',
        '192.168.1.100',
        '192.168.1.100',
        'Suspicious activity',
        undefined
      );
    });

    it('should check if IP is banned', async () => {
      // Mock the ban cache
      const mockBanEntry = {
        id: 'test-ip-ban-1',
        serverId: 'test-server',
        banType: 'ip' as const,
        target: '192.168.1.100',
        reason: 'Suspicious activity',
        bannedBy: 'admin',
        bannedAt: new Date(),
        isActive: true
      };
      
      (whitelistManager as any).banCache.set('test-server', [mockBanEntry]);

      const isBanned = await whitelistManager.isBanned('test-server', 'ip', '192.168.1.100');
      expect(isBanned).toBe(true);
    });
  });

  describe('Device Banning', () => {
    it('should ban a device', async () => {
      // Mock server as online
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(true);
      
      const mockBridge = {
        hasCapability: jest.fn().mockReturnValue(true),
        banTarget: jest.fn().mockResolvedValue(true)
      };
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);

      const result = await whitelistManager.banTarget(
        'test-server',
        'device',
        'device-id-12345',
        undefined,
        'Multiple violations',
        'admin'
      );

      expect(result).toBe(true);
      expect(mockBridge.banTarget).toHaveBeenCalledWith(
        'device',
        'device-id-12345',
        'device-id-12345',
        'Multiple violations',
        undefined
      );
    });
  });

  describe('Unbanning', () => {
    it('should unban a target when server is online', async () => {
      // Mock server as online
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(true);
      
      const mockBridge = {
        hasCapability: jest.fn().mockReturnValue(true),
        unbanTarget: jest.fn().mockResolvedValue(true)
      };
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);

      const result = await whitelistManager.unbanTarget(
        'test-server',
        'player',
        'TestPlayer',
        'admin',
        'Appeal accepted'
      );

      expect(result).toBe(true);
      expect(mockBridge.unbanTarget).toHaveBeenCalledWith('player', 'TestPlayer');
    });

    it('should cache unban operation when server is offline', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      const result = await whitelistManager.unbanTarget(
        'test-server',
        'player',
        'TestPlayer',
        'admin',
        'Appeal accepted'
      );

      // Should return true (operation cached successfully)
      expect(result).toBe(true);

      // Should have one pending operation
      expect(whitelistManager.getPendingBanOperationsCount('test-server')).toBe(1);

      // Verify the cached operation
      const pendingOps = whitelistManager.getPendingBanOperations('test-server');
      expect(pendingOps.length).toBe(1);
      expect(pendingOps[0].type).toBe('unban');
      expect(pendingOps[0].banType).toBe('player');
      expect(pendingOps[0].target).toBe('TestPlayer');
      expect(pendingOps[0].reason).toBe('Appeal accepted');
      expect(pendingOps[0].executor).toBe('admin');
    });
  });

  describe('Ban Operation Optimization', () => {
    it('should optimize conflicting ban/unban operations', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Ban player
      await whitelistManager.banTarget(
        'test-server',
        'player',
        'TestPlayer',
        'TestPlayer',
        'Test ban',
        'admin'
      );
      expect(whitelistManager.getPendingBanOperationsCount('test-server')).toBe(1);

      // Unban same player (should cancel out the ban)
      await whitelistManager.unbanTarget(
        'test-server',
        'player',
        'TestPlayer',
        'admin',
        'Test unban'
      );
      expect(whitelistManager.getPendingBanOperationsCount('test-server')).toBe(0);
    });

    it('should update duplicate operations', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Ban player with admin1
      await whitelistManager.banTarget(
        'test-server',
        'player',
        'TestPlayer',
        'TestPlayer',
        'First ban',
        'admin1'
      );
      expect(whitelistManager.getPendingBanOperationsCount('test-server')).toBe(1);

      // Ban same player with admin2 (should update the existing operation)
      await whitelistManager.banTarget(
        'test-server',
        'player',
        'TestPlayer',
        'TestPlayer',
        'Updated ban',
        'admin2'
      );
      expect(whitelistManager.getPendingBanOperationsCount('test-server')).toBe(1);

      const pendingOps = whitelistManager.getPendingBanOperations('test-server');
      expect(pendingOps[0].executor).toBe('admin2');
      expect(pendingOps[0].reason).toBe('Updated ban');
    });
  });

  describe('Expired Ban Processing', () => {
    it('should process expired bans automatically', async () => {
      // Create an expired ban
      const expiredBan = {
        id: 'expired-ban-1',
        serverId: 'test-server',
        banType: 'player' as const,
        target: 'TestPlayer',
        targetName: 'TestPlayer',
        reason: 'Test ban',
        bannedBy: 'admin',
        bannedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
        isActive: true
      };

      // Mock the ban cache
      (whitelistManager as any).banCache.set('test-server', [expiredBan]);

      // Mock server as online
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(true);
      
      const mockBridge = {
        hasCapability: jest.fn().mockReturnValue(true),
        unbanTarget: jest.fn().mockResolvedValue(true)
      };
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);

      // Process expired bans
      await whitelistManager.processExpiredBans();

      // Ban should be marked as inactive
      const bans = (whitelistManager as any).banCache.get('test-server');
      expect(bans[0].isActive).toBe(false);

      // Server should have been called to unban
      expect(mockBridge.unbanTarget).toHaveBeenCalledWith('player', 'TestPlayer');
    });
  });

  describe('Ban Statistics', () => {
    it('should provide ban statistics', async () => {
      // Mock ban cache with test data
      const testBans = [
        {
          id: 'ban-1',
          serverId: 'server1',
          banType: 'player' as const,
          target: 'Player1',
          reason: 'Test',
          bannedBy: 'admin',
          bannedAt: new Date(),
          isActive: true
        },
        {
          id: 'ban-2',
          serverId: 'server1',
          banType: 'ip' as const,
          target: '192.168.1.1',
          reason: 'Test',
          bannedBy: 'admin',
          bannedAt: new Date(),
          isActive: true
        },
        {
          id: 'ban-3',
          serverId: 'server2',
          banType: 'device' as const,
          target: 'device-123',
          reason: 'Test',
          bannedBy: 'admin',
          bannedAt: new Date(),
          isActive: false // Inactive ban
        }
      ];

      (whitelistManager as any).banCache.set('server1', testBans.slice(0, 2));
      (whitelistManager as any).banCache.set('server2', testBans.slice(2));

      const stats = whitelistManager.getBanStats();

      expect(stats.totalServers).toBe(2);
      expect(stats.totalActiveBans).toBe(2); // Only active bans
      expect(stats.bansByType.player).toBe(1);
      expect(stats.bansByType.ip).toBe(1);
      expect(stats.bansByType.device).toBe(0); // Inactive ban not counted
    });
  });

  describe('Ban Search', () => {
    it('should search bans by target and reason', async () => {
      // Mock ban cache with test data
      const testBans = [
        {
          id: 'ban-1',
          serverId: 'test-server',
          banType: 'player' as const,
          target: 'TestPlayer',
          targetName: 'TestPlayer',
          reason: 'Cheating with hacks',
          bannedBy: 'admin',
          bannedAt: new Date(),
          isActive: true
        },
        {
          id: 'ban-2',
          serverId: 'test-server',
          banType: 'ip' as const,
          target: '192.168.1.100',
          reason: 'Suspicious activity',
          bannedBy: 'moderator',
          bannedAt: new Date(),
          isActive: true
        }
      ];

      (whitelistManager as any).banCache.set('test-server', testBans);

      // Search by player name
      let results = whitelistManager.searchBans('TestPlayer');
      expect(results.length).toBe(1);
      expect(results[0].target).toBe('TestPlayer');

      // Search by reason
      results = whitelistManager.searchBans('cheating');
      expect(results.length).toBe(1);
      expect(results[0].reason).toBe('Cheating with hacks');

      // Search by IP
      results = whitelistManager.searchBans('192.168');
      expect(results.length).toBe(1);
      expect(results[0].target).toBe('192.168.1.100');

      // Search by executor
      results = whitelistManager.searchBans('moderator');
      expect(results.length).toBe(1);
      expect(results[0].bannedBy).toBe('moderator');
    });
  });
});