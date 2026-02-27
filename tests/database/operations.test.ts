/**
 * Database Operations Tests
 * 
 * This file contains comprehensive tests for database CRUD operations.
 */

import { Context } from 'koishi';
import { 
  DatabaseManager, 
  ServerOperations, 
  ACLOperations, 
  TokenOperations, 
  AuditOperations,
  PendingOperationsManager
} from '../../src/database/operations';
import { ServerConfig, ServerRole } from '../../src/types';
import { createMockContext } from '../setup';

describe('Database Operations', () => {
  let ctx: Context;
  let dbManager: DatabaseManager;

  beforeEach(() => {
    ctx = createMockContext();
    dbManager = new DatabaseManager(ctx);
  });

  describe('ServerOperations', () => {
    let serverOps: ServerOperations;

    beforeEach(() => {
      serverOps = new ServerOperations(ctx);
    });

    describe('createServer', () => {
      it('should create a new server configuration', async () => {
        const serverConfig = {
          id: 'test-server-1',
          name: 'Test Server 1',
          coreType: 'Java' as const,
          coreName: 'Paper',
          coreVersion: '1.20.1',
          connectionMode: 'plugin' as const,
          connectionConfig: {
            plugin: { host: '127.0.0.1', port: 8080, ssl: false }
          },
          status: 'offline' as const,
          ownerId: 'user123',
          tags: ['test', 'development']
        };

        // Mock database responses
        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 'test-server-1',
          name: 'Test Server 1',
          core_type: 'Java',
          core_name: 'Paper',
          core_version: '1.20.1',
          connection_mode: 'plugin',
          connection_config: JSON.stringify({ plugin: { host: '127.0.0.1', port: 8080, ssl: false } }),
          status: 'offline',
          owner_id: 'user123',
          tags: JSON.stringify(['test', 'development']),
          created_at: new Date(),
          updated_at: new Date()
        }]);

        const result = await serverOps.createServer(serverConfig);

        expect(ctx.database.create).toHaveBeenCalledWith('minecraft_servers', expect.objectContaining({
          id: 'test-server-1',
          name: 'Test Server 1',
          core_type: 'Java'
        }));
        expect(result.id).toBe('test-server-1');
        expect(result.coreType).toBe('Java');
      });

      it('should throw error if server creation fails', async () => {
        const serverConfig = {
          id: 'test-server-1',
          name: 'Test Server 1',
          coreType: 'Java' as const,
          coreName: 'Paper',
          coreVersion: '1.20.1',
          connectionMode: 'plugin' as const,
          connectionConfig: { plugin: { host: '127.0.0.1', port: 8080, ssl: false } },
          status: 'offline' as const,
          ownerId: 'user123',
          tags: ['test']
        };

        ctx.database.create = jest.fn().mockResolvedValue({ insertId: 1 });
        ctx.database.get = jest.fn().mockResolvedValue([]); // Simulate creation failure

        await expect(serverOps.createServer(serverConfig)).rejects.toThrow('Failed to create server test-server-1');
      });
    });

    describe('getServer', () => {
      it('should return server configuration when found', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 'test-server-1',
          name: 'Test Server 1',
          core_type: 'Java',
          core_name: 'Paper',
          core_version: '1.20.1',
          connection_mode: 'plugin',
          connection_config: JSON.stringify({ plugin: { host: '127.0.0.1', port: 8080, ssl: false } }),
          status: 'online',
          owner_id: 'user123',
          tags: JSON.stringify(['test']),
          created_at: new Date(),
          updated_at: new Date(),
          last_seen: new Date()
        }]);

        const result = await serverOps.getServer('test-server-1');

        expect(ctx.database.get).toHaveBeenCalledWith('minecraft_servers', { id: 'test-server-1' });
        expect(result).not.toBeNull();
        expect(result!.id).toBe('test-server-1');
        expect(result!.status).toBe('online');
      });

      it('should return null when server not found', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        const result = await serverOps.getServer('nonexistent-server');

        expect(result).toBeNull();
      });
    });

    describe('updateServerStatus', () => {
      it('should update server status and last seen time', async () => {
        const lastSeen = new Date();
        ctx.database.set = jest.fn().mockResolvedValue({ matched: 1, modified: 1 });

        await serverOps.updateServerStatus('test-server-1', 'online', lastSeen);

        expect(ctx.database.set).toHaveBeenCalledWith(
          'minecraft_servers',
          { id: 'test-server-1' },
          expect.objectContaining({
            status: 'online',
            last_seen: lastSeen,
            updated_at: expect.any(Date)
          })
        );
      });
    });

    describe('deleteServer', () => {
      it('should delete server and return true when successful', async () => {
        ctx.database.remove = jest.fn().mockResolvedValue({ matched: 1 });

        const result = await serverOps.deleteServer('test-server-1');

        expect(ctx.database.remove).toHaveBeenCalledWith('minecraft_servers', { id: 'test-server-1' });
        expect(result).toBe(true);
      });

      it('should return false when server not found', async () => {
        ctx.database.remove = jest.fn().mockResolvedValue({ matched: 0 });

        const result = await serverOps.deleteServer('nonexistent-server');

        expect(result).toBe(false);
      });
    });
  });

  describe('ACLOperations', () => {
    let aclOps: ACLOperations;

    beforeEach(() => {
      aclOps = new ACLOperations(ctx);
    });

    describe('grantPermission', () => {
      it('should grant permissions to user for server', async () => {
        const userId = 'user123';
        const serverId = 'server123';
        const role: ServerRole = 'admin';
        const permissions = ['server.manage', 'player.kick'];
        const grantedBy = 'owner123';

        ctx.database.remove = jest.fn().mockResolvedValue({ matched: 0 });
        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: userId,
          server_id: serverId,
          role,
          permissions: JSON.stringify(permissions),
          granted_by: grantedBy,
          granted_at: new Date(),
          expires_at: null
        }]);

        const result = await aclOps.grantPermission(userId, serverId, role, permissions, grantedBy);

        expect(ctx.database.remove).toHaveBeenCalledWith('server_acl', { 
          user_id: userId, 
          server_id: serverId 
        });
        expect(ctx.database.create).toHaveBeenCalledWith('server_acl', expect.objectContaining({
          user_id: userId,
          server_id: serverId,
          role,
          permissions: JSON.stringify(permissions)
        }));
        expect(result.userId).toBe(userId);
        expect(result.role).toBe(role);
      });
    });

    describe('hasPermission', () => {
      it('should return true when user has specific permission', async () => {
        const userId = 'user123';
        const serverId = 'server123';
        const operation = 'manage';

        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: userId,
          server_id: serverId,
          role: 'admin',
          permissions: JSON.stringify(['server123.manage', 'server123.kick']),
          granted_by: 'owner123',
          granted_at: new Date(),
          expires_at: null
        }]);

        const result = await aclOps.hasPermission(userId, serverId, operation);

        expect(result).toBe(true);
      });

      it('should return true when user has wildcard permission', async () => {
        const userId = 'user123';
        const serverId = 'server123';
        const operation = 'anything';

        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: userId,
          server_id: serverId,
          role: 'owner',
          permissions: JSON.stringify(['*']),
          granted_by: 'system',
          granted_at: new Date(),
          expires_at: null
        }]);

        const result = await aclOps.hasPermission(userId, serverId, operation);

        expect(result).toBe(true);
      });

      it('should return false when user has no ACL', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        const result = await aclOps.hasPermission('user123', 'server123', 'manage');

        expect(result).toBe(false);
      });

      it('should return false when ACL is expired', async () => {
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: 'user123',
          server_id: 'server123',
          role: 'admin',
          permissions: JSON.stringify(['server123.manage']),
          granted_by: 'owner123',
          granted_at: new Date(),
          expires_at: expiredDate
        }]);

        const result = await aclOps.hasPermission('user123', 'server123', 'manage');

        expect(result).toBe(false);
      });
    });

    describe('cleanupExpiredACLs', () => {
      it('should remove expired ACLs and return count', async () => {
        ctx.database.remove = jest.fn().mockResolvedValue({ matched: 3 });

        const result = await aclOps.cleanupExpiredACLs();

        expect(ctx.database.remove).toHaveBeenCalledWith('server_acl', {
          expires_at: { $lt: expect.any(Date) }
        });
        expect(result).toBe(3);
      });
    });
  });

  describe('TokenOperations', () => {
    let tokenOps: TokenOperations;

    beforeEach(() => {
      tokenOps = new TokenOperations(ctx);
    });

    describe('createToken', () => {
      it('should create API token for server', async () => {
        const serverId = 'server123';
        const token = 'token123';
        const tokenHash = 'hash123';
        const ipWhitelist = ['127.0.0.1', '192.168.1.1'];

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          server_id: serverId,
          token,
          token_hash: tokenHash,
          ip_whitelist: JSON.stringify(ipWhitelist),
          encryption_config: null,
          created_at: new Date(),
          expires_at: null,
          last_used: null
        }]);

        const result = await tokenOps.createToken(serverId, token, tokenHash, ipWhitelist);

        expect(ctx.database.create).toHaveBeenCalledWith('api_tokens', expect.objectContaining({
          server_id: serverId,
          token,
          token_hash: tokenHash,
          ip_whitelist: JSON.stringify(ipWhitelist)
        }));
        expect(result.serverId).toBe(serverId);
        expect(result.ipWhitelist).toEqual(ipWhitelist);
      });
    });

    describe('getTokenByHash', () => {
      it('should return token when found by hash', async () => {
        const tokenHash = 'hash123';

        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          server_id: 'server123',
          token: 'token123',
          token_hash: tokenHash,
          ip_whitelist: null,
          encryption_config: null,
          created_at: new Date(),
          expires_at: null,
          last_used: null
        }]);

        const result = await tokenOps.getTokenByHash(tokenHash);

        expect(ctx.database.get).toHaveBeenCalledWith('api_tokens', { token_hash: tokenHash });
        expect(result).not.toBeNull();
        expect(result!.tokenHash).toBe(tokenHash);
      });

      it('should return null when token not found', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        const result = await tokenOps.getTokenByHash('nonexistent-hash');

        expect(result).toBeNull();
      });
    });

    describe('updateTokenLastUsed', () => {
      it('should update token last used timestamp', async () => {
        ctx.database.set = jest.fn().mockResolvedValue({ matched: 1, modified: 1 });

        await tokenOps.updateTokenLastUsed(1);

        expect(ctx.database.set).toHaveBeenCalledWith(
          'api_tokens',
          { id: 1 },
          { last_used: expect.any(Date) }
        );
      });
    });
  });

  describe('AuditOperations', () => {
    let auditOps: AuditOperations;

    beforeEach(() => {
      auditOps = new AuditOperations(ctx);
    });

    describe('logOperation', () => {
      it('should create audit log entry', async () => {
        const userId = 'user123';
        const serverId = 'server123';
        const operation = 'player.kick';
        const operationData = { playerId: 'player123', reason: 'test' };
        const result = 'success';

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: userId,
          server_id: serverId,
          operation,
          operation_data: JSON.stringify(operationData),
          result,
          error_message: null,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const auditLog = await auditOps.logOperation(
          userId, serverId, operation, operationData, result
        );

        expect(ctx.database.create).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
          user_id: userId,
          server_id: serverId,
          operation,
          operation_data: JSON.stringify(operationData),
          result
        }));
        expect(auditLog.operation).toBe(operation);
        expect(auditLog.result).toBe(result);
      });
    });

    describe('getAuditLogs', () => {
      it('should return filtered audit logs', async () => {
        const filters = {
          userId: 'user123',
          serverId: 'server123',
          limit: 50
        };

        ctx.database.get = jest.fn().mockResolvedValue([
          {
            id: 1,
            user_id: 'user123',
            server_id: 'server123',
            operation: 'player.kick',
            operation_data: JSON.stringify({ playerId: 'player123' }),
            result: 'success',
            error_message: null,
            ip_address: '127.0.0.1',
            user_agent: 'MochiLink/1.0',
            created_at: new Date()
          }
        ]);

        const result = await auditOps.getAuditLogs(filters);

        expect(ctx.database.get).toHaveBeenCalledWith(
          'audit_logs',
          { user_id: 'user123', server_id: 'server123' },
          { limit: 50, offset: 0 }
        );
        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('user123');
      });
    });

    describe('cleanupOldLogs', () => {
      it('should remove old audit logs and return count', async () => {
        ctx.database.remove = jest.fn().mockResolvedValue({ matched: 10 });

        const result = await auditOps.cleanupOldLogs(30);

        expect(ctx.database.remove).toHaveBeenCalledWith('audit_logs', {
          created_at: { $lt: expect.any(Date) }
        });
        expect(result).toBe(10);
      });
    });
  });

  describe('PendingOperationsManager', () => {
    let pendingOps: PendingOperationsManager;

    beforeEach(() => {
      pendingOps = new PendingOperationsManager(ctx);
    });

    describe('addOperation', () => {
      it('should add pending operation', async () => {
        const serverId = 'server123';
        const operationType = 'whitelist_add';
        const target = 'player123';
        const parameters = { reason: 'test' };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          server_id: serverId,
          operation_type: operationType,
          target,
          parameters: JSON.stringify(parameters),
          status: 'pending',
          created_at: new Date(),
          scheduled_at: null,
          executed_at: null
        }]);

        const result = await pendingOps.addOperation(serverId, operationType, target, parameters);

        expect(ctx.database.create).toHaveBeenCalledWith('pending_operations', expect.objectContaining({
          server_id: serverId,
          operation_type: operationType,
          target,
          parameters: JSON.stringify(parameters),
          status: 'pending'
        }));
        expect(result.serverId).toBe(serverId);
        expect(result.operationType).toBe(operationType);
      });
    });

    describe('optimizeOperations', () => {
      it('should optimize contradictory operations', async () => {
        const serverId = 'server123';
        const baseDate = new Date();
        const laterDate = new Date(baseDate.getTime() + 1000);

        // Mock pending operations with add/remove pair
        ctx.database.get = jest.fn().mockResolvedValue([
          {
            id: 1,
            server_id: serverId,
            operation_type: 'whitelist_add',
            target: 'player123',
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
            target: 'player123',
            parameters: JSON.stringify({}),
            status: 'pending',
            created_at: laterDate,
            scheduled_at: null,
            executed_at: null
          }
        ]);

        ctx.database.remove = jest.fn().mockResolvedValue({ matched: 1 });

        const result = await pendingOps.optimizeOperations(serverId);

        expect(ctx.database.remove).toHaveBeenCalledTimes(2);
        expect(result).toBe(2);
      });
    });
  });

  describe('DatabaseManager', () => {
    describe('healthCheck', () => {
      it('should return true when database is healthy', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        const result = await dbManager.healthCheck();

        expect(result).toBe(true);
        expect(ctx.database.get).toHaveBeenCalledWith('minecraft_servers', {}, ['id']);
      });

      it('should return false when database query fails', async () => {
        ctx.database.get = jest.fn().mockRejectedValue(new Error('Database error'));

        const result = await dbManager.healthCheck();

        expect(result).toBe(false);
      });
    });

    describe('getStatistics', () => {
      it('should return database statistics', async () => {
        // Mock database responses for statistics
        ctx.database.get = jest.fn()
          .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // servers
          .mockResolvedValueOnce([{ id: 1 }]) // acls
          .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]) // tokens
          .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]) // audit logs
          .mockResolvedValueOnce([{ id: 1 }]); // pending ops

        const result = await dbManager.getStatistics();

        expect(result).toEqual({
          servers: 2,
          acls: 1,
          tokens: 3,
          auditLogs: 4,
          pendingOps: 1
        });
      });
    });

    describe('performMaintenance', () => {
      it('should perform maintenance tasks and return results', async () => {
        const config = {
          auditRetentionDays: 30,
          tokenCleanup: true,
          aclCleanup: true
        };

        // Mock cleanup operations
        ctx.database.remove = jest.fn()
          .mockResolvedValueOnce({ matched: 5 }) // audit logs
          .mockResolvedValueOnce({ matched: 2 }) // tokens
          .mockResolvedValueOnce({ matched: 1 }); // acls

        const result = await dbManager.performMaintenance(config);

        expect(result).toEqual({
          auditLogsRemoved: 5,
          tokensRemoved: 2,
          aclsRemoved: 1
        });
      });
    });
  });
});