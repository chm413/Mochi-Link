/**
 * Mochi-Link (大福连) - Whitelist Manager Tests
 * 
 * Unit tests for the whitelist management system
 */

import { Context } from 'koishi';
import { WhitelistManager, WhitelistEntry, WhitelistOperation } from '../../src/services/whitelist';

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

describe('WhitelistManager', () => {
  let whitelistManager: WhitelistManager;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = createMockContext();
    whitelistManager = new WhitelistManager(mockContext);
    jest.clearAllMocks();
  });

  describe('Basic Whitelist Operations', () => {
    it('should initialize with empty whitelist', async () => {
      const whitelist = await whitelistManager.getWhitelist('test-server');
      expect(Array.isArray(whitelist)).toBe(true);
      expect(whitelist.length).toBe(0);
    });

    it('should check if player is whitelisted', async () => {
      const isWhitelisted = await whitelistManager.isWhitelisted('test-server', 'TestPlayer');
      expect(isWhitelisted).toBe(false);
    });

    it('should return sync status for server', () => {
      const status = whitelistManager.getSyncStatus('test-server');
      expect(status).toBeNull(); // No status initially
    });

    it('should return pending operations count', () => {
      const count = whitelistManager.getPendingOperationsCount('test-server');
      expect(count).toBe(0);
    });

    it('should return empty pending operations list', () => {
      const operations = whitelistManager.getPendingOperations('test-server');
      expect(Array.isArray(operations)).toBe(true);
      expect(operations.length).toBe(0);
    });
  });

  describe('Operation Optimization', () => {
    it('should optimize conflicting operations', () => {
      const optimizeOperations = (whitelistManager as any).optimizeOperations.bind(whitelistManager);
      
      const existingOps: WhitelistOperation[] = [
        {
          type: 'add',
          playerId: 'TestPlayer',
          playerName: 'TestPlayer',
          executor: 'admin',
          timestamp: new Date('2023-01-01')
        }
      ];
      
      const newOp: WhitelistOperation = {
        type: 'remove',
        playerId: 'TestPlayer',
        executor: 'admin',
        timestamp: new Date('2023-01-02')
      };
      
      const optimized = optimizeOperations(existingOps, newOp);
      
      // Should cancel out the add operation
      expect(optimized.length).toBe(0);
    });

    it('should update duplicate operations', () => {
      const optimizeOperations = (whitelistManager as any).optimizeOperations.bind(whitelistManager);
      
      const existingOps: WhitelistOperation[] = [
        {
          type: 'add',
          playerId: 'TestPlayer',
          playerName: 'TestPlayer',
          executor: 'admin1',
          timestamp: new Date('2023-01-01')
        }
      ];
      
      const newOp: WhitelistOperation = {
        type: 'add',
        playerId: 'TestPlayer',
        playerName: 'TestPlayer',
        executor: 'admin2',
        timestamp: new Date('2023-01-02')
      };
      
      const optimized = optimizeOperations(existingOps, newOp);
      
      // Should update the existing operation
      expect(optimized.length).toBe(1);
      expect(optimized[0].executor).toBe('admin2');
      expect(optimized[0].timestamp).toEqual(new Date('2023-01-02'));
    });

    it('should add new non-conflicting operations', () => {
      const optimizeOperations = (whitelistManager as any).optimizeOperations.bind(whitelistManager);
      
      const existingOps: WhitelistOperation[] = [
        {
          type: 'add',
          playerId: 'Player1',
          playerName: 'Player1',
          executor: 'admin',
          timestamp: new Date('2023-01-01')
        }
      ];
      
      const newOp: WhitelistOperation = {
        type: 'add',
        playerId: 'Player2',
        playerName: 'Player2',
        executor: 'admin',
        timestamp: new Date('2023-01-02')
      };
      
      const optimized = optimizeOperations(existingOps, newOp);
      
      // Should add the new operation
      expect(optimized.length).toBe(2);
      expect(optimized.find((op: WhitelistOperation) => op.playerId === 'Player2')).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should update cache correctly', () => {
      const updateCache = (whitelistManager as any).updateCache.bind(whitelistManager);
      
      const entries: WhitelistEntry[] = [
        {
          playerId: 'TestPlayer',
          playerName: 'TestPlayer',
          addedBy: 'admin',
          addedAt: new Date(),
          serverId: 'test-server'
        }
      ];
      
      updateCache('test-server', entries);
      
      const cache = (whitelistManager as any).whitelistCache.get('test-server');
      expect(cache).toBeDefined();
      expect(cache.entries.length).toBe(1);
      expect(cache.entries[0].playerId).toBe('TestPlayer');
    });

    it('should update sync status correctly', () => {
      const updateSyncStatus = (whitelistManager as any).updateSyncStatus.bind(whitelistManager);
      
      updateSyncStatus('test-server', true);
      
      const status = whitelistManager.getSyncStatus('test-server');
      expect(status).toBeDefined();
      expect(status!.serverId).toBe('test-server');
      expect(status!.isOnline).toBe(true);
      expect(status!.syncErrors.length).toBe(0);
    });

    it('should update sync status with errors', () => {
      const updateSyncStatus = (whitelistManager as any).updateSyncStatus.bind(whitelistManager);
      
      updateSyncStatus('test-server', false, 'Connection failed');
      
      const status = whitelistManager.getSyncStatus('test-server');
      expect(status).toBeDefined();
      expect(status!.isOnline).toBe(false);
      expect(status!.syncErrors).toContain('Connection failed');
    });
  });

  describe('Statistics', () => {
    it('should return correct whitelist statistics', () => {
      // Add some test data
      const updateCache = (whitelistManager as any).updateCache.bind(whitelistManager);
      const updateSyncStatus = (whitelistManager as any).updateSyncStatus.bind(whitelistManager);
      
      updateCache('server1', [
        {
          playerId: 'Player1',
          playerName: 'Player1',
          addedBy: 'admin',
          addedAt: new Date(),
          serverId: 'server1'
        }
      ]);
      
      updateCache('server2', [
        {
          playerId: 'Player2',
          playerName: 'Player2',
          addedBy: 'admin',
          addedAt: new Date(),
          serverId: 'server2'
        },
        {
          playerId: 'Player3',
          playerName: 'Player3',
          addedBy: 'admin',
          addedAt: new Date(),
          serverId: 'server2'
        }
      ]);
      
      updateSyncStatus('server1', true);
      updateSyncStatus('server2', false, 'Error');
      
      const stats = whitelistManager.getWhitelistStats();
      
      expect(stats.totalServers).toBe(2);
      expect(stats.totalEntries).toBe(3);
      expect(stats.serversOnline).toBe(1);
      expect(stats.lastSyncErrors).toBe(1);
    });
  });

  describe('Sync Status Management', () => {
    it('should return all sync statuses', () => {
      const updateSyncStatus = (whitelistManager as any).updateSyncStatus.bind(whitelistManager);
      
      updateSyncStatus('server1', true);
      updateSyncStatus('server2', false);
      
      const allStatuses = whitelistManager.getAllSyncStatus();
      
      expect(allStatuses.size).toBe(2);
      expect(allStatuses.has('server1')).toBe(true);
      expect(allStatuses.has('server2')).toBe(true);
      expect(allStatuses.get('server1')!.isOnline).toBe(true);
      expect(allStatuses.get('server2')!.isOnline).toBe(false);
    });
  });

  describe('Pending Operations Management', () => {
    it('should clear pending operations', async () => {
      // Add some pending operations
      const pendingOps = (whitelistManager as any).pendingOperations;
      pendingOps.set('test-server', [
        {
          type: 'add',
          playerId: 'TestPlayer',
          executor: 'admin',
          timestamp: new Date()
        }
      ]);
      
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);
      
      await whitelistManager.clearPendingOperations('test-server', 'admin');
      
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(0);
    });
  });

  describe('Server Online Status', () => {
    it('should return false for offline server', async () => {
      const isServerOnline = (whitelistManager as any).isServerOnline.bind(whitelistManager);
      
      const isOnline = await isServerOnline('test-server');
      expect(isOnline).toBe(false);
    });
  });
});