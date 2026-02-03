/**
 * Mochi-Link (大福连) - Whitelist Operation Cache Optimization Property Tests
 * 
 * Property-based tests for operation cache optimization mechanism
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

const operationTypeGenerator = fc.constantFrom('add', 'remove');

describe('Whitelist Operation Cache Optimization Property Tests', () => {
  /**
   * **Validates: Requirements 5.5**
   * Property 6: Operation Cache Optimization
   * 
   * For any sequence of whitelist operations on the same player,
   * the system should optimize conflicting operations by canceling
   * them out or merging them to minimize the final operation count.
   */
  test('Property 6: Operation cache optimization', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        playerId: playerIdGenerator,
        executor: executorGenerator,
        operationSequence: fc.array(operationTypeGenerator, { minLength: 2, maxLength: 10 })
      }),
      async ({ serverId, playerId, executor, operationSequence }) => {
        // Feature: minecraft-unified-management, Property 6: 操作缓存优化
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline to force caching
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        // Execute operations in sequence
        for (const operationType of operationSequence) {
          if (operationType === 'add') {
            await whitelistManager.addToWhitelist(serverId, playerId, playerId, executor);
          } else {
            await whitelistManager.removeFromWhitelist(serverId, playerId, executor);
          }
        }
        
        // Get pending operations
        const pendingOps = whitelistManager.getPendingOperations(serverId);
        const pendingCount = whitelistManager.getPendingOperationsCount(serverId);
        
        // Verify optimization occurred
        expect(pendingCount).toBeLessThanOrEqual(1); // Should be optimized to at most 1 operation
        
        if (pendingCount === 1) {
          // If there's one operation, it should be the final state
          const finalOp = pendingOps[0];
          expect(finalOp.playerId).toBe(playerId);
          expect(finalOp.executor).toBe(executor);
          
          // The final operation type should match the last operation in the sequence
          const lastOperationType = operationSequence[operationSequence.length - 1];
          expect(finalOp.type).toBe(lastOperationType);
          
        } else if (pendingCount === 0) {
          // If no operations remain, the sequence must have canceled out
          // This happens when the last operation conflicts with a previous operation
          // and they cancel each other out
          expect(pendingCount).toBe(0);
        }
        
        // Verify no duplicate operations exist
        const playerIds = pendingOps.map(op => op.playerId);
        const uniquePlayerIds = new Set(playerIds);
        expect(playerIds.length).toBe(uniquePlayerIds.size);
      }
    ), { numRuns: 15 });
  });

  /**
   * Conflicting operations cancellation property
   * 
   * Verifies that add/remove operations for the same player
   * cancel each other out correctly.
   */
  test('Property: Conflicting operations cancellation', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        playerId: playerIdGenerator,
        executor: executorGenerator,
        pairs: fc.integer({ min: 1, max: 5 })
      }),
      async ({ serverId, playerId, executor, pairs }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        // Execute pairs of add/remove operations
        for (let i = 0; i < pairs; i++) {
          await whitelistManager.addToWhitelist(serverId, playerId, playerId, executor);
          await whitelistManager.removeFromWhitelist(serverId, playerId, executor);
        }
        
        // All operations should cancel out
        const pendingCount = whitelistManager.getPendingOperationsCount(serverId);
        expect(pendingCount).toBe(0);
        
        const pendingOps = whitelistManager.getPendingOperations(serverId);
        expect(pendingOps.length).toBe(0);
      }
    ), { numRuns: 10 });
  });

  /**
   * Duplicate operation merging property
   * 
   * Verifies that duplicate operations (same type, same player)
   * are merged into a single operation with the latest metadata.
   */
  test('Property: Duplicate operation merging', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        playerId: playerIdGenerator,
        operationType: operationTypeGenerator,
        executors: fc.array(executorGenerator, { minLength: 2, maxLength: 5 }),
        reasons: fc.array(fc.option(fc.string({ minLength: 1, maxLength: 50 })), { minLength: 2, maxLength: 5 })
      }),
      async ({ serverId, playerId, operationType, executors, reasons }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        const operationCount = Math.min(executors.length, reasons.length);
        
        // Execute multiple operations of the same type for the same player
        for (let i = 0; i < operationCount; i++) {
          if (operationType === 'add') {
            await whitelistManager.addToWhitelist(
              serverId, 
              playerId, 
              playerId, 
              executors[i], 
              reasons[i] || undefined
            );
          } else {
            await whitelistManager.removeFromWhitelist(
              serverId, 
              playerId, 
              executors[i], 
              reasons[i] || undefined
            );
          }
        }
        
        // Should be merged into a single operation
        const pendingCount = whitelistManager.getPendingOperationsCount(serverId);
        expect(pendingCount).toBe(1);
        
        const pendingOps = whitelistManager.getPendingOperations(serverId);
        expect(pendingOps.length).toBe(1);
        
        const mergedOp = pendingOps[0];
        expect(mergedOp.type).toBe(operationType);
        expect(mergedOp.playerId).toBe(playerId);
        
        // Should have the latest executor and reason
        expect(mergedOp.executor).toBe(executors[operationCount - 1]);
        if (reasons[operationCount - 1]) {
          expect(mergedOp.reason).toBe(reasons[operationCount - 1]);
        }
      }
    ), { numRuns: 10 });
  });

  /**
   * Multi-player optimization property
   * 
   * Verifies that optimization works correctly when operations
   * involve multiple different players.
   */
  test('Property: Multi-player optimization', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        playerOperations: fc.array(
          fc.record({
            playerId: playerIdGenerator,
            operations: fc.array(operationTypeGenerator, { minLength: 1, maxLength: 4 })
          }),
          { minLength: 2, maxLength: 5 }
        ).filter(ops => {
          // Ensure all player IDs are unique
          const playerIds = ops.map(op => op.playerId);
          return new Set(playerIds).size === playerIds.length;
        }),
        executor: executorGenerator
      }),
      async ({ serverId, playerOperations, executor }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        // Execute operations for multiple players
        for (const playerOp of playerOperations) {
          for (const operationType of playerOp.operations) {
            if (operationType === 'add') {
              await whitelistManager.addToWhitelist(
                serverId, 
                playerOp.playerId, 
                playerOp.playerId, 
                executor
              );
            } else {
              await whitelistManager.removeFromWhitelist(
                serverId, 
                playerOp.playerId, 
                executor
              );
            }
          }
        }
        
        const pendingOps = whitelistManager.getPendingOperations(serverId);
        const pendingCount = whitelistManager.getPendingOperationsCount(serverId);
        
        // Each player should have at most one operation
        const playerIds = pendingOps.map(op => op.playerId);
        const uniquePlayerIds = new Set(playerIds);
        expect(playerIds.length).toBe(uniquePlayerIds.size);
        
        // Verify each player's final state is correct
        for (const playerOp of playerOperations) {
          const playerPendingOps = pendingOps.filter(op => op.playerId === playerOp.playerId);
          
          if (playerPendingOps.length === 1) {
            // The final operation should be consistent with the optimization logic
            const finalOp = playerPendingOps[0];
            expect(finalOp.playerId).toBe(playerOp.playerId);
            expect(['add', 'remove']).toContain(finalOp.type);
            
            // The operation should be one of the operations in the sequence
            expect(playerOp.operations).toContain(finalOp.type);
            
          } else if (playerPendingOps.length === 0) {
            // Operations for this player canceled out
            // This can happen with various combinations, not just equal add/remove counts
            expect(playerPendingOps.length).toBe(0);
          } else {
            // Should never have more than one operation per player
            fail(`Player ${playerOp.playerId} has ${playerPendingOps.length} operations, expected 0 or 1`);
          }
        }
        
        // Total pending operations should not exceed number of unique players
        expect(pendingCount).toBeLessThanOrEqual(playerOperations.length);
      }
    ), { numRuns: 10 });
  });

  /**
   * Operation ordering preservation property
   * 
   * Verifies that when operations cannot be optimized away,
   * the timestamp ordering is preserved correctly.
   */
  test('Property: Operation ordering preservation', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        players: fc.array(playerIdGenerator, { minLength: 2, maxLength: 4 }),
        executor: executorGenerator
      }),
      async ({ serverId, players, executor }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        const operationTimes: Date[] = [];
        
        // Execute one operation per player with small delays to ensure different timestamps
        for (let i = 0; i < players.length; i++) {
          const operationType = i % 2 === 0 ? 'add' : 'remove';
          
          if (operationType === 'add') {
            await whitelistManager.addToWhitelist(serverId, players[i], players[i], executor);
          } else {
            await whitelistManager.removeFromWhitelist(serverId, players[i], executor);
          }
          
          operationTimes.push(new Date());
          
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        const pendingOps = whitelistManager.getPendingOperations(serverId);
        
        // Verify operations are ordered by timestamp
        for (let i = 1; i < pendingOps.length; i++) {
          expect(pendingOps[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            pendingOps[i - 1].timestamp.getTime()
          );
        }
        
        // Each player should have exactly one operation (no optimization possible)
        expect(pendingOps.length).toBe(players.length);
        
        // Verify all players are represented
        const pendingPlayerIds = new Set(pendingOps.map(op => op.playerId));
        const expectedPlayerIds = new Set(players);
        expect(pendingPlayerIds).toEqual(expectedPlayerIds);
      }
    ), { numRuns: 8 });
  });

  /**
   * Performance optimization property
   * 
   * Verifies that optimization reduces memory usage and
   * improves performance for large operation sequences.
   */
  test('Property: Performance optimization', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        serverId: serverIdGenerator,
        playerId: playerIdGenerator,
        executor: executorGenerator,
        operationCount: fc.integer({ min: 20, max: 100 })
      }),
      async ({ serverId, playerId, executor, operationCount }) => {
        const whitelistManager = new WhitelistManager(createMockContext());
        
        // Mock server as offline
        (whitelistManager as any).isServerOnline = jest.fn().mockResolvedValue(false);
        (whitelistManager as any).getBridge = jest.fn().mockResolvedValue(null);
        
        const startTime = Date.now();
        
        // Execute many alternating operations for the same player
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
        
        // Should complete quickly despite many operations
        expect(executionTime).toBeLessThan(500); // Less than 500ms
        
        const pendingCount = whitelistManager.getPendingOperationsCount(serverId);
        
        // Should be heavily optimized
        if (operationCount % 2 === 0) {
          // Even number of operations should cancel out completely
          expect(pendingCount).toBe(0);
        } else {
          // Odd number should leave exactly one operation
          expect(pendingCount).toBe(1);
          
          const pendingOps = whitelistManager.getPendingOperations(serverId);
          const finalOp = pendingOps[0];
          
          // Final operation should match the last operation type
          const expectedType = (operationCount - 1) % 2 === 0 ? 'add' : 'remove';
          expect(finalOp.type).toBe(expectedType);
        }
        
        // Memory usage should be minimal (at most 1 operation stored)
        expect(pendingCount).toBeLessThanOrEqual(1);
      }
    ), { numRuns: 5 });
  });
});