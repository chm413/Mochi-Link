/**
 * Database Operations Property-Based Tests
 * 
 * This file contains property-based tests for database operations
 * to validate correctness properties across all valid inputs.
 */

import * as fc from 'fast-check';
import { Context } from 'koishi';
import { DatabaseManager, ServerOperations } from '../../src/database/operations';
import { ServerConfig, ServerRole } from '../../src/types';
import { createMockContext } from '../setup';

describe('Database Operations - Property Tests', () => {
  let ctx: Context;
  let dbManager: DatabaseManager;

  beforeEach(() => {
    ctx = createMockContext();
    dbManager = new DatabaseManager(ctx);
  });

  // ============================================================================
  // Property Test Generators
  // ============================================================================

  const serverIdArbitrary = fc.string({ minLength: 3, maxLength: 32 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s));
  const userIdArbitrary = fc.string({ minLength: 3, maxLength: 32 });
  const serverNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
  const coreTypeArbitrary = fc.constantFrom('Java', 'Bedrock');
  const coreNameArbitrary = fc.constantFrom('Paper', 'Folia', 'LLBDS', 'PMMP', 'Nukkit');
  const connectionModeArbitrary = fc.constantFrom('plugin', 'rcon', 'terminal');
  const serverStatusArbitrary = fc.constantFrom('online', 'offline', 'error', 'maintenance');
  const serverRoleArbitrary = fc.constantFrom('owner', 'admin', 'moderator', 'viewer');

  const connectionConfigArbitrary = fc.record({
    plugin: fc.record({
      host: fc.ipV4(),
      port: fc.integer({ min: 1024, max: 65535 }),
      ssl: fc.boolean()
    })
  });

  const serverConfigArbitrary = fc.record({
    id: serverIdArbitrary,
    name: serverNameArbitrary,
    coreType: coreTypeArbitrary,
    coreName: coreNameArbitrary,
    coreVersion: fc.string({ minLength: 1, maxLength: 20 }),
    connectionMode: connectionModeArbitrary,
    connectionConfig: connectionConfigArbitrary,
    status: serverStatusArbitrary,
    ownerId: userIdArbitrary,
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 })
  });

  // ============================================================================
  // Property 2: Data Persistence Integrity
  // ============================================================================

  describe('Property 2: Data persistence integrity', () => {
    it('should persist all required server configuration fields correctly', async () => {
      await fc.assert(fc.asyncProperty(
        serverConfigArbitrary,
        async (serverConfig) => {
          // **Validates: Requirements 15.1**
          // Cast the generated config to proper types
          const typedConfig: Omit<ServerConfig, 'createdAt' | 'updatedAt'> = {
            ...serverConfig,
            coreType: serverConfig.coreType as any,
            connectionMode: serverConfig.connectionMode as any,
            status: serverConfig.status as any
          };
          // Mock successful database operations
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: typedConfig.id,
            name: typedConfig.name,
            core_type: typedConfig.coreType,
            core_name: typedConfig.coreName,
            core_version: typedConfig.coreVersion,
            connection_mode: typedConfig.connectionMode,
            connection_config: JSON.stringify(typedConfig.connectionConfig),
            status: typedConfig.status,
            owner_id: typedConfig.ownerId,
            tags: JSON.stringify(typedConfig.tags),
            created_at: new Date(),
            updated_at: new Date()
          }]);

          const result = await dbManager.servers.createServer(typedConfig);

          // Verify all required fields are preserved
          expect(result.id).toBe(typedConfig.id);
          expect(result.name).toBe(typedConfig.name);
          expect(result.coreType).toBe(typedConfig.coreType);
          expect(result.coreName).toBe(typedConfig.coreName);
          expect(result.coreVersion).toBe(typedConfig.coreVersion);
          expect(result.connectionMode).toBe(typedConfig.connectionMode);
          expect(result.connectionConfig).toEqual(typedConfig.connectionConfig);
          expect(result.status).toBe(typedConfig.status);
          expect(result.ownerId).toBe(typedConfig.ownerId);
          expect(result.tags).toEqual(typedConfig.tags);
          expect(result.createdAt).toBeInstanceOf(Date);
          expect(result.updatedAt).toBeInstanceOf(Date);
        }
      ), { numRuns: 100 });
    });
  });

  // ============================================================================
  // Property 5: Offline Operation Caching Mechanism
  // ============================================================================

  describe('Property 5: Offline operation caching mechanism', () => {
    it('should cache operations when server is offline', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        fc.constantFrom('whitelist_add', 'whitelist_remove', 'player_kick'),
        fc.string({ minLength: 3, maxLength: 16 }), // target (player name)
        fc.record({ reason: fc.string({ maxLength: 100 }) }), // parameters
        async (serverId, operationType, target, parameters) => {
          // **Validates: Requirements 5.4**
          const typedOperationType = operationType as any;
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            server_id: serverId,
            operation_type: typedOperationType,
            target,
            parameters: JSON.stringify(parameters),
            status: 'pending',
            created_at: new Date(),
            scheduled_at: null,
            executed_at: null
          }]);

          const result = await dbManager.pendingOps.addOperation(
            serverId, typedOperationType, target, parameters
          );

          // Verify operation is cached correctly
          expect(result.serverId).toBe(serverId);
          expect(result.operationType).toBe(typedOperationType);
          expect(result.target).toBe(target);
          expect(result.parameters).toEqual(parameters);
          expect(result.status).toBe('pending');
          expect(result.createdAt).toBeInstanceOf(Date);
        }
      ), { numRuns: 100 });
    });
  });

  // ============================================================================
  // Property 6: Operation Cache Optimization
  // ============================================================================

  describe('Property 6: Operation cache optimization', () => {
    it('should optimize contradictory operations for same target', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        fc.string({ minLength: 3, maxLength: 16 }), // playerId
        async (serverId, playerId) => {
          // **Validates: Requirements 5.5**
          const baseDate = new Date();
          const laterDate = new Date(baseDate.getTime() + 1000);

          // Mock contradictory operations (add then remove)
          ctx.database.get = jest.fn().mockResolvedValue([
            {
              id: 1,
              server_id: serverId,
              operation_type: 'whitelist_add',
              target: playerId,
              parameters: JSON.stringify({}),
              status: 'pending',
              created_at: baseDate,
              scheduled_at: null,
              executed_at: null
            },
            {
              id: 2,
              server_id: serverId,
              operation_type: 'whitelist_remove',
              target: playerId,
              parameters: JSON.stringify({}),
              status: 'pending',
              created_at: laterDate,
              scheduled_at: null,
              executed_at: null
            }
          ]);

          ctx.database.remove = jest.fn().mockResolvedValue({ affectedRows: 1 });

          const optimizedCount = await dbManager.pendingOps.optimizeOperations(serverId);

          // Verify contradictory operations are optimized away
          expect(optimizedCount).toBe(2);
          expect(ctx.database.remove).toHaveBeenCalledTimes(2);
        }
      ), { numRuns: 100 });
    });
  });

  // ============================================================================
  // Property 10: Permission Check Format Consistency
  // ============================================================================

  describe('Property 10: Permission check format consistency', () => {
    it('should use serverId.operation format for permission checks', async () => {
      await fc.assert(fc.asyncProperty(
        userIdArbitrary,
        serverIdArbitrary,
        fc.string({ minLength: 1, maxLength: 20 }), // operation
        serverRoleArbitrary,
        async (userId, serverId, operation, role) => {
          // **Validates: Requirements 9.4**
          const typedRole = role as any;
          const expectedPermission = `${serverId}.${operation}`;
          
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: userId,
            server_id: serverId,
            role: typedRole,
            permissions: JSON.stringify([expectedPermission]),
            granted_by: 'system',
            granted_at: new Date(),
            expires_at: null
          }]);

          const hasPermission = await dbManager.acl.hasPermission(userId, serverId, operation);

          // Verify permission check uses correct format
          expect(hasPermission).toBe(true);
          expect(ctx.database.get).toHaveBeenCalledWith('server_acl', {
            user_id: userId,
            server_id: serverId
          });
        }
      ), { numRuns: 100 });
    });

    it('should grant wildcard permissions correctly', async () => {
      await fc.assert(fc.asyncProperty(
        userIdArbitrary,
        serverIdArbitrary,
        fc.string({ minLength: 1, maxLength: 20 }), // any operation
        async (userId, serverId, operation) => {
          // **Validates: Requirements 9.4**
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: userId,
            server_id: serverId,
            role: 'owner',
            permissions: JSON.stringify(['*']), // Wildcard permission
            granted_by: 'system',
            granted_at: new Date(),
            expires_at: null
          }]);

          const hasPermission = await dbManager.acl.hasPermission(userId, serverId, operation);

          // Verify wildcard permission grants access to any operation
          expect(hasPermission).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });

  // ============================================================================
  // Property 11: Audit Log Completeness
  // ============================================================================

  describe('Property 11: Audit log completeness', () => {
    it('should record complete audit information for all operations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.option(userIdArbitrary, { nil: undefined }),
        fc.option(serverIdArbitrary, { nil: undefined }),
        fc.string({ minLength: 1, maxLength: 50 }), // operation
        fc.record({ data: fc.string() }), // operation data
        fc.constantFrom('success', 'failure', 'error') as fc.Arbitrary<'success' | 'failure' | 'error'>,
        fc.option(fc.string({ maxLength: 200 }), { nil: undefined }), // error message
        fc.option(fc.ipV4(), { nil: undefined }), // IP address
        fc.option(fc.string({ maxLength: 100 }), { nil: undefined }), // user agent
        async (userId, serverId, operation, operationData, result, errorMessage, ipAddress, userAgent) => {
          // **Validates: Requirements 10.1**
          const typedResult = result as 'success' | 'failure' | 'error';
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: userId,
            server_id: serverId,
            operation,
            operation_data: JSON.stringify(operationData),
            result: typedResult,
            error_message: errorMessage,
            ip_address: ipAddress,
            user_agent: userAgent,
            created_at: new Date()
          }]);

          const auditLog = await dbManager.audit.logOperation(
            userId, serverId, operation, operationData, typedResult, errorMessage, ipAddress, userAgent
          );

          // Verify all audit information is recorded
          expect(auditLog.userId).toBe(userId);
          expect(auditLog.serverId).toBe(serverId);
          expect(auditLog.operation).toBe(operation);
          expect(auditLog.operationData).toEqual(operationData);
          expect(auditLog.result).toBe(typedResult);
          expect(auditLog.errorMessage).toBe(errorMessage);
          expect(auditLog.ipAddress).toBe(ipAddress);
          expect(auditLog.userAgent).toBe(userAgent);
          expect(auditLog.createdAt).toBeInstanceOf(Date);
        }
      ), { numRuns: 100 });
    });
  });

  // ============================================================================
  // Database Consistency Properties
  // ============================================================================

  describe('Database consistency properties', () => {
    it('should maintain referential integrity for server-related operations', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        userIdArbitrary,
        async (serverId, userId) => {
          // Mock server exists
          ctx.database.get = jest.fn()
            .mockResolvedValueOnce([{ id: serverId }]) // Server exists check
            .mockResolvedValueOnce([{
              id: 1,
              user_id: userId,
              server_id: serverId,
              role: 'admin',
              permissions: JSON.stringify([`${serverId}.manage`]),
              granted_by: 'owner',
              granted_at: new Date(),
              expires_at: null
            }]);

          ctx.database.remove = jest.fn().mockResolvedValue({ affectedRows: 0 });
          ctx.database.create = jest.fn().mockResolvedValue({ insertId: 1 });

          // Check server exists before granting permissions
          const serverExists = await dbManager.servers.serverExists(serverId);
          expect(serverExists).toBe(true);

          // Grant permission should succeed for existing server
          const acl = await dbManager.acl.grantPermission(
            userId, serverId, 'admin', [`${serverId}.manage`], 'owner'
          );

          expect(acl.serverId).toBe(serverId);
          expect(acl.userId).toBe(userId);
        }
      ), { numRuns: 50 });
    });

    it('should handle concurrent operations safely', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        fc.array(userIdArbitrary, { minLength: 2, maxLength: 5 }),
        async (serverId, userIds) => {
          // Mock database operations for concurrent ACL grants
          ctx.database.remove = jest.fn().mockResolvedValue({ matched: 0 });
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          
          let callCount = 0;
          ctx.database.get = jest.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve([{
              id: callCount,
              user_id: userIds[callCount - 1] || userIds[0],
              server_id: serverId,
              role: 'viewer',
              permissions: JSON.stringify([`${serverId}.view`]),
              granted_by: 'admin',
              granted_at: new Date(),
              expires_at: null
            }]);
          });

          // Simulate concurrent permission grants
          const promises = userIds.map(userId => 
            dbManager.acl.grantPermission(userId, serverId, 'viewer', [`${serverId}.view`], 'admin')
          );

          const results = await Promise.all(promises);

          // Verify all operations completed successfully
          expect(results).toHaveLength(userIds.length);
          results.forEach((result, index) => {
            expect(result.serverId).toBe(serverId);
            expect(result.role).toBe('viewer');
          });
        }
      ), { numRuns: 30 });
    });
  });

  // ============================================================================
  // Error Handling Properties
  // ============================================================================

  describe('Error handling properties', () => {
    it('should handle database errors gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        serverConfigArbitrary,
        async (serverConfig) => {
          // Cast the generated config to proper types
          const typedConfig: Omit<ServerConfig, 'createdAt' | 'updatedAt'> = {
            ...serverConfig,
            coreType: serverConfig.coreType as any,
            connectionMode: serverConfig.connectionMode as any,
            status: serverConfig.status as any
          };

          // Mock database error
          ctx.database.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

          // Operation should throw error but not crash
          await expect(dbManager.servers.createServer(typedConfig))
            .rejects.toThrow('Database connection failed');
        }
      ), { numRuns: 50 });
    });
  });
});