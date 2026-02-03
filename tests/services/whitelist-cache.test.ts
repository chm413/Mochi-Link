/**
 * Mochi-Link (大福连) - Whitelist Offline Operation Caching Tests
 * 
 * Unit tests for offline operation caching mechanism
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

describe('Whitelist Offline Operation Caching', () => {
  let whitelistManager: WhitelistManager;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = createMockContext();
    whitelistManager = new WhitelistManager(mockContext);
    jest.clearAllMocks();
  });

  describe('Offline Operation Caching', () => {
    it('should cache add operations when server is offline', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      const result = await whitelistManager.addToWhitelist(
        'test-server',
        'TestPlayer',
        'TestPlayer',
        'admin',
        'Test reason'
      );

      // Should return true (operation cached successfully)
      expect(result).toBe(true);

      // Should have one pending operation
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);

      // Verify the cached operation
      const pendingOps = whitelistManager.getPendingOperations('test-server');
      expect(pendingOps.length).toBe(1);
      expect(pendingOps[0].type).toBe('add');
      expect(pendingOps[0].playerId).toBe('TestPlayer');
      expect(pendingOps[0].executor).toBe('admin');
      expect(pendingOps[0].reason).toBe('Test reason');
    });

    it('should cache remove operations when server is offline', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      const result = await whitelistManager.removeFromWhitelist(
        'test-server',
        'TestPlayer',
        'admin',
        'Test reason'
      );

      // Should return true (operation cached successfully)
      expect(result).toBe(true);

      // Should have one pending operation
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);

      // Verify the cached operation
      const pendingOps = whitelistManager.getPendingOperations('test-server');
      expect(pendingOps.length).toBe(1);
      expect(pendingOps[0].type).toBe('remove');
      expect(pendingOps[0].playerId).toBe('TestPlayer');
      expect(pendingOps[0].executor).toBe('admin');
      expect(pendingOps[0].reason).toBe('Test reason');
    });

    it('should execute operations immediately when server is online', async () => {
      // Mock server as online
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(true);
      
      const mockBridge = {
        hasCapability: jest.fn().mockReturnValue(true),
        addToWhitelist: jest.fn().mockResolvedValue(true)
      };
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);

      const result = await whitelistManager.addToWhitelist(
        'test-server',
        'TestPlayer',
        'TestPlayer',
        'admin'
      );

      // Should return true (operation executed successfully)
      expect(result).toBe(true);

      // Should have no pending operations
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(0);

      // Bridge should have been called
      expect(mockBridge.addToWhitelist).toHaveBeenCalledWith('TestPlayer', 'TestPlayer', undefined);
    });

    it('should optimize conflicting operations', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Add player
      await whitelistManager.addToWhitelist('test-server', 'TestPlayer', 'TestPlayer', 'admin');
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);

      // Remove same player (should cancel out the add)
      await whitelistManager.removeFromWhitelist('test-server', 'TestPlayer', 'admin');
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(0);
    });

    it('should handle multiple operations for different players', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Add multiple players
      await whitelistManager.addToWhitelist('test-server', 'Player1', 'Player1', 'admin');
      await whitelistManager.addToWhitelist('test-server', 'Player2', 'Player2', 'admin');
      await whitelistManager.removeFromWhitelist('test-server', 'Player3', 'admin');

      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(3);

      const pendingOps = whitelistManager.getPendingOperations('test-server');
      expect(pendingOps.find(op => op.playerId === 'Player1' && op.type === 'add')).toBeDefined();
      expect(pendingOps.find(op => op.playerId === 'Player2' && op.type === 'add')).toBeDefined();
      expect(pendingOps.find(op => op.playerId === 'Player3' && op.type === 'remove')).toBeDefined();
    });

    it('should update duplicate operations', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Add player with admin1
      await whitelistManager.addToWhitelist('test-server', 'TestPlayer', 'TestPlayer', 'admin1');
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);

      // Add same player with admin2 (should update the existing operation)
      await whitelistManager.addToWhitelist('test-server', 'TestPlayer', 'TestPlayer', 'admin2');
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);

      const pendingOps = whitelistManager.getPendingOperations('test-server');
      expect(pendingOps[0].executor).toBe('admin2');
    });

    it('should handle server state transitions', async () => {
      // Start with server offline
      let isOnline = false;
      (whitelistManager as any).isServerOnline = jest.fn().mockImplementation(() => Promise.resolve(isOnline));
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Cache an operation
      await whitelistManager.addToWhitelist('test-server', 'TestPlayer', 'TestPlayer', 'admin');
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);

      // Server comes online
      isOnline = true;
      const mockBridge = {
        hasCapability: jest.fn().mockReturnValue(true),
        addToWhitelist: jest.fn().mockResolvedValue(true)
      };
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);

      // New operations should execute immediately
      const result = await whitelistManager.addToWhitelist('test-server', 'Player2', 'Player2', 'admin');
      expect(result).toBe(true);
      expect(mockBridge.addToWhitelist).toHaveBeenCalledWith('Player2', 'Player2', undefined);

      // Cached operation should still be pending (processed by periodic sync)
      expect(whitelistManager.getPendingOperationsCount('test-server')).toBe(1);
    });
  });

  describe('Cache Statistics', () => {
    it('should track pending operations in statistics', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Add some operations
      await whitelistManager.addToWhitelist('server1', 'Player1', 'Player1', 'admin');
      await whitelistManager.addToWhitelist('server2', 'Player2', 'Player2', 'admin');

      const stats = whitelistManager.getWhitelistStats();
      expect(stats.totalPendingOperations).toBe(2);
    });
  });

  describe('Sync Status', () => {
    it('should update sync status when operations are cached', async () => {
      // Mock server as offline
      (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
      (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);

      // Cache an operation
      await whitelistManager.addToWhitelist('test-server', 'TestPlayer', 'TestPlayer', 'admin');

      // Check sync status
      const status = whitelistManager.getSyncStatus('test-server');
      expect(status).toBeDefined();
      if (status) {
        expect(status.pendingOperations).toBe(1);
        expect(status.isOnline).toBe(false);
      }
    });
  });
});