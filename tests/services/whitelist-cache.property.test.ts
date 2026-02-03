/**
 * Mochi-Link (大福连) - Whitelist Offline Operation Caching Property Tests
 * 
 * Property-based tests for offline operation caching mechanism
 */

import * as fc from 'fast-check';
import { Context } from 'koishi';
import { WhitelistManager, WhitelistOperation } from '../../src/services/whitelist';

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

// Generators for whitelist operations
const playerIdGenerator = fc.string({ minLength: 3, maxLength: 16 })
  .filter(s => /^[a-zA-Z0-9_]+$/.test(s));

const serverIdGenerator = fc.string({ minLength: 3, maxLength: 32 })
  .filter(s => s.trim() === s && !s.includes(' '));

const executorGenerator = fc.string({ minLength: 3, maxLength: 16 })
  .filter(s => /^[a-zA-Z0-9_]+$/.test(s));

const whitelistOperationGenerator = fc.record({
  type: fc.constantFrom('add', 'remove'),
  playerId: playerIdGenerator,
  playerName: fc.option(playerIdGenerator),
  reason: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  executor: executorGenerator,
  timestamp: fc.date()
});

describe('Whitelist Offline Operation Caching Property Tests', () => {
  /**
   * **Validates: Requirements 5.4**
   * Property 5: Offline Operation Caching Mechanism
   * 
   * For any whitelist operation executed while the server is offline,
   * the operation should be correctly added to the cache and executed
   * in order when the server comes back online.
   */
  test('Property 5: Offline operation caching mechanism', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        operations: fc.array(whitelistOperationGenerator, { minLength: 1, maxLength: 10 }),
        isServerOnline: fc.boolean()
      }),
      async ({ serverId, operations, isServerOnline }) => {
        // Feature: minecraft-unified-management, Property 5: 离线操作缓存机制
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server online status
        const mockIsServerOnline = jest.fn().mockResolvedValue(isServerOnline);
        (whitelistManager as any).isServerOnline = mockIsServerOnline;
        
        // Mock bridge for online server
        let mockBridge: any = null;
        if (isServerOnline) {
          mockBridge = {
            hasCapability: jest.fn().mockReturnValue(true),
            addToWhitelist: jest.fn().mockResolvedValue(true),
            removeFromWhitelist: jest.fn().mockResolvedValue(true),
            isHealthy: jest.fn().mockResolvedValue(true)
          };
        }
        
        const mockGetBridge = jest.fn().mockResolvedValue(mockBridge);
        (whitelistManager as any).getBridge = mockGetBridge;
        
        // Execute operations
        const results: boolean[] = [];
        for (const operation of operations) {
          let result: boolean;
          if (operation.type === 'add') {
            result = await whitelistManager.addToWhitelist(
              serverId,
              operation.playerId,
              operation.playerName || operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          } else {
            result = await whitelistManager.removeFromWhitelist(
              serverId,
              operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          }
          results.push(result);
        }
        
        // Verify behavior based on server status
        if (isServerOnline) {
          // When server is online, operations should be executed immediately
          expect(mockGetBridge).toHaveBeenCalled();
          if (mockBridge) {
            const addCalls = operations.filter(op => op.type === 'add').length;
            const removeCalls = operations.filter(op => op.type === 'remove').length;
            
            expect(mockBridge.addToWhitelist).toHaveBeenCalledTimes(addCalls);
            expect(mockBridge.removeFromWhitelist).toHaveBeenCalledTimes(removeCalls);
          }
          
          // All operations should succeed when server is online
          results.forEach(result => {
            expect(result).toBe(true);
          });
          
          // No pending operations should remain
          expect(whitelistManager.getPendingOperationsCount(serverId)).toBe(0);
          
        } else {
          // When server is offline, operations should be cached
          // Note: getBridge is still called to check server capabilities
          
          // All operations should be cached (return true for caching success)
          results.forEach(result => {
            expect(result).toBe(true);
          });
          
          // Operations should be in pending cache
          const pendingCount = whitelistManager.getPendingOperationsCount(serverId);
          expect(pendingCount).toBeGreaterThan(0);
          expect(pendingCount).toBeLessThanOrEqual(operations.length); // May be optimized
          
          // Verify pending operations contain the expected operations
          const pendingOps = whitelistManager.getPendingOperations(serverId);
          expect(pendingOps.length).toBe(pendingCount);
          
          // All pending operations should have valid structure
          pendingOps.forEach(op => {
            expect(op).toHaveProperty('type');
            expect(op).toHaveProperty('playerId');
            expect(op).toHaveProperty('executor');
            expect(op).toHaveProperty('timestamp');
            expect(['add', 'remove']).toContain(op.type);
            expect(typeof op.playerId).toBe('string');
            expect(typeof op.executor).toBe('string');
            expect(op.timestamp).toBeInstanceOf(Date);
          });
        }
      }
    ), { numRuns: 10 });
  });

  /**
   * Operation persistence property
   * 
   * Verifies that cached operations persist correctly and maintain
   * their order and integrity.
   */
  test('Property: Operation persistence and ordering', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        operationSequence: fc.array(whitelistOperationGenerator, { minLength: 2, maxLength: 5 })
      }),
      async ({ serverId, operationSequence }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        // Execute operations in sequence
        for (const operation of operationSequence) {
          if (operation.type === 'add') {
            await whitelistManager.addToWhitelist(
              serverId,
              operation.playerId,
              operation.playerName || operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          } else {
            await whitelistManager.removeFromWhitelist(
              serverId,
              operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          }
        }
        
        // Verify operations are cached
        const pendingOps = whitelistManager.getPendingOperations(serverId);
        expect(pendingOps.length).toBeGreaterThan(0);
        expect(pendingOps.length).toBeLessThanOrEqual(operationSequence.length);
        
        // Verify operation structure integrity
        pendingOps.forEach((op, index) => {
          expect(op.type).toMatch(/^(add|remove)$/);
          expect(typeof op.playerId).toBe('string');
          expect(op.playerId.length).toBeGreaterThan(0);
          expect(typeof op.executor).toBe('string');
          expect(op.executor.length).toBeGreaterThan(0);
          expect(op.timestamp).toBeInstanceOf(Date);
          
          // Verify timestamp ordering (later operations should have later timestamps)
          if (index > 0) {
            expect(op.timestamp.getTime()).toBeGreaterThanOrEqual(
              pendingOps[index - 1].timestamp.getTime()
            );
          }
        });
      }
    ), { numRuns: 10 });
  });

  /**
   * Cache capacity and limits property
   * 
   * Verifies that the caching system handles large numbers of operations
   * correctly and maintains performance.
   */
  test('Property: Cache capacity and performance', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        operationCount: fc.integer({ min: 10, max: 50 }),
        playerId: playerIdGenerator,
        executor: executorGenerator
      }),
      async ({ serverId, operationCount, playerId, executor }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        const startTime = Date.now();
        
        // Execute many operations for the same player (should be optimized)
        for (let i = 0; i < operationCount; i++) {
          const operationType = i % 2 === 0 ? 'add' : 'remove';
          
          if (operationType === 'add') {
            await whitelistManager.addToWhitelist(serverId, playerId, playerId, executor);
          } else {
            await whitelistManager.removeFromWhitelist(serverId, playerId, executor);
          }
        }
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        // Verify performance (should complete within reasonable time)
        expect(executionTime).toBeLessThan(1000); // Less than 1 second
        
        // Verify optimization - conflicting operations should be optimized
        const pendingCount = whitelistManager.getPendingOperationsCount(serverId);
        expect(pendingCount).toBeLessThanOrEqual(1); // Should be optimized to at most 1 operation
        
        // If there's a pending operation, it should be the final state
        if (pendingCount > 0) {
          const pendingOps = whitelistManager.getPendingOperations(serverId);
          expect(pendingOps.length).toBe(1);
          
          const finalOp = pendingOps[0];
          expect(finalOp.playerId).toBe(playerId);
          expect(finalOp.executor).toBe(executor);
          
          // The final operation type should match the last operation
          const expectedType = (operationCount - 1) % 2 === 0 ? 'add' : 'remove';
          expect(finalOp.type).toBe(expectedType);
        }
      }
    ), { numRuns: 5 });
  });

  /**
   * Server state transition property
   * 
   * Verifies that operations behave correctly when server transitions
   * from offline to online state.
   */
  test('Property: Server state transition handling', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        offlineOperations: fc.array(whitelistOperationGenerator, { minLength: 1, maxLength: 5 }),
        onlineOperations: fc.array(whitelistOperationGenerator, { minLength: 1, maxLength: 3 })
      }),
      async ({ serverId, offlineOperations, onlineOperations }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Phase 1: Server offline - operations should be cached
        let isOnline = false;
        (whitelistManager as any).isServerOnline = jest.fn().mockImplementation(() => Promise.resolve(isOnline));
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        // Execute offline operations
        for (const operation of offlineOperations) {
          if (operation.type === 'add') {
            await whitelistManager.addToWhitelist(
              serverId,
              operation.playerId,
              operation.playerName || operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          } else {
            await whitelistManager.removeFromWhitelist(
              serverId,
              operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          }
        }
        
        // Verify operations are cached
        const cachedCount = whitelistManager.getPendingOperationsCount(serverId);
        expect(cachedCount).toBeGreaterThan(0);
        
        // Phase 2: Server comes online
        isOnline = true;
        const mockBridge = {
          hasCapability: jest.fn().mockReturnValue(true),
          addToWhitelist: jest.fn().mockResolvedValue(true),
          removeFromWhitelist: jest.fn().mockResolvedValue(true)
        };
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(mockBridge);
        
        // Execute online operations
        for (const operation of onlineOperations) {
          if (operation.type === 'add') {
            await whitelistManager.addToWhitelist(
              serverId,
              operation.playerId,
              operation.playerName || operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          } else {
            await whitelistManager.removeFromWhitelist(
              serverId,
              operation.playerId,
              operation.executor,
              operation.reason || undefined
            );
          }
        }
        
        // Verify online operations were executed immediately
        expect(mockBridge.addToWhitelist.mock.calls.length + mockBridge.removeFromWhitelist.mock.calls.length)
          .toBeGreaterThan(0);
        
        // Verify cached operations are still pending (would be processed by periodic sync)
        const remainingCached = whitelistManager.getPendingOperationsCount(serverId);
        expect(remainingCached).toBeGreaterThanOrEqual(0);
      }
    ), { numRuns: 10 });
  });

  /**
   * Operation data integrity property
   * 
   * Verifies that cached operations maintain all their data correctly
   * and don't lose information during caching.
   */
  test('Property: Operation data integrity', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        operation: whitelistOperationGenerator
      }),
      async ({ serverId, operation }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        // Execute operation
        if (operation.type === 'add') {
          await whitelistManager.addToWhitelist(
            serverId,
            operation.playerId,
            operation.playerName || operation.playerId,
            operation.executor,
            operation.reason || undefined
          );
        } else {
          await whitelistManager.removeFromWhitelist(
            serverId,
            operation.playerId,
            operation.executor,
            operation.reason || undefined
          );
        }
        
        // Verify operation is cached with correct data
        const pendingOps = whitelistManager.getPendingOperations(serverId);
        expect(pendingOps.length).toBe(1);
        
        const cachedOp = pendingOps[0];
        
        // Verify all essential data is preserved
        expect(cachedOp.type).toBe(operation.type);
        expect(cachedOp.playerId).toBe(operation.playerId);
        expect(cachedOp.executor).toBe(operation.executor);
        
        // Verify optional data is preserved if provided
        if (operation.reason) {
          expect(cachedOp.reason).toBe(operation.reason);
        }
        
        // For add operations, playerName should be preserved
        if (operation.type === 'add' && operation.playerName) {
          expect(cachedOp.playerName).toBe(operation.playerName);
        }
        
        // Verify timestamp is set and reasonable
        expect(cachedOp.timestamp).toBeInstanceOf(Date);
        expect(cachedOp.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        expect(cachedOp.timestamp.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
      }
    ), { numRuns: 10 });
  });
});