/**
 * Unit Tests for Binding Management Service
 * 
 * Tests the group-server binding management functionality including
 * CRUD operations, routing rules, and status monitoring.
 */

import { Context } from 'koishi';
import { BindingManager, BindingCreateOptions, BindingType } from '../../src/services/binding';
import { AuditService } from '../../src/services/audit';
import { PermissionManager } from '../../src/services/permission';
import { MochiLinkError } from '../../src/types';

// Mock dependencies
jest.mock('../../src/services/audit');
jest.mock('../../src/services/permission');

describe('BindingManager', () => {
  let ctx: Context;
  let bindingManager: BindingManager;
  let mockAudit: any;
  let mockPermission: any;
  let mockDatabase: any;

  beforeEach(() => {
    // Mock Koishi context
    ctx = {
      logger: jest.fn(() => ({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      })),
      database: {
        get: jest.fn(),
        create: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        eval: jest.fn()
      }
    } as any;

    mockDatabase = ctx.database;
    
    // Create proper mocks
    mockAudit = {
      logger: {
        logSuccess: jest.fn(),
        logFailure: jest.fn(),
        logError: jest.fn(),
        logAuthFailure: jest.fn(),
        logPermissionDenied: jest.fn(),
        logConnection: jest.fn(),
        logServerOperation: jest.fn(),
        logPlayerOperation: jest.fn()
      },
      query: {
        queryLogs: jest.fn(),
        getLogById: jest.fn(),
        getRecentLogs: jest.fn(),
        getUserLogs: jest.fn(),
        getServerLogs: jest.fn(),
        getOperationLogs: jest.fn(),
        getLogsInDateRange: jest.fn(),
        searchLogs: jest.fn()
      },
      statistics: {
        getStatistics: jest.fn(),
        getOperationFrequency: jest.fn()
      },
      export: {
        exportLogs: jest.fn()
      },
      performMaintenance: jest.fn(),
      getHealthStatus: jest.fn()
    } as any;

    mockPermission = {
      checkPermission: jest.fn(),
      requirePermission: jest.fn(),
      checkMultiplePermissions: jest.fn(),
      assignRole: jest.fn(),
      removeRole: jest.fn(),
      getUserRoles: jest.fn(),
      getServerAdmins: jest.fn(),
      getUserPermissions: jest.fn(),
      getHealthStatus: jest.fn()
    } as any;

    bindingManager = new BindingManager(ctx, mockAudit, mockPermission);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBinding', () => {
    const userId = 'user123';
    const bindingOptions: BindingCreateOptions = {
      groupId: 'group123',
      serverId: 'server123',
      bindingType: 'chat',
      config: {
        chat: {
          enabled: true,
          bidirectional: true,
          messageFormat: '[{username}] {content}'
        }
      }
    };

    it('should create a new binding successfully', async () => {
      // Mock permission check
      mockPermission.checkPermission.mockResolvedValue({ granted: true });

      // Mock server exists check
      mockDatabase.get.mockResolvedValueOnce([{ id: 'server123' }]); // Server exists
      mockDatabase.get.mockResolvedValueOnce([]); // No existing binding

      // Mock database create and subsequent get
      mockDatabase.create.mockResolvedValue(undefined);
      const mockBinding = {
        id: 1,
        group_id: 'group123',
        server_id: 'server123',
        binding_type: 'chat',
        config: JSON.stringify(bindingOptions.config),
        created_at: new Date()
      };
      mockDatabase.get.mockResolvedValueOnce([mockBinding]); // Get created binding

      // Mock audit log
      mockAudit.logger.logServerOperation.mockResolvedValue({} as any);

      const result = await bindingManager.createBinding(userId, bindingOptions);

      expect(result).toEqual({
        id: 1,
        groupId: 'group123',
        serverId: 'server123',
        bindingType: 'chat',
        config: bindingOptions.config,
        createdAt: mockBinding.created_at,
        status: 'active',
        lastActivity: undefined
      });

      expect(mockPermission.checkPermission).toHaveBeenCalledWith(userId, 'server123', 'binding.create');
      expect(mockDatabase.create).toHaveBeenCalledWith('server_bindings', expect.objectContaining({
        group_id: 'group123',
        server_id: 'server123',
        binding_type: 'chat',
        config: JSON.stringify(bindingOptions.config)
      }));
      expect(mockAudit.logger.logServerOperation).toHaveBeenCalledWith(
        'server123',
        'binding.create',
        expect.objectContaining({
          groupId: 'group123',
          bindingType: 'chat',
          bindingId: 1
        }),
        'success',
        undefined,
        expect.objectContaining({
          userId
        })
      );
    });

    it('should throw error when user lacks permission', async () => {
      mockPermission.checkPermission.mockResolvedValue({ granted: false, reason: 'Insufficient permissions' });

      await expect(bindingManager.createBinding(userId, bindingOptions))
        .rejects.toThrow('lacks permission to create bindings');
    });

    it('should throw error when server does not exist', async () => {
      mockPermission.checkPermission.mockResolvedValue({ granted: true });
      mockDatabase.get.mockResolvedValueOnce([]); // Server doesn't exist

      await expect(bindingManager.createBinding(userId, bindingOptions))
        .rejects.toThrow('Server server123 not found');
    });

    it('should throw error when binding already exists', async () => {
      mockPermission.checkPermission.mockResolvedValue({ granted: true });
      mockDatabase.get.mockResolvedValueOnce([{ id: 'server123' }]); // Server exists
      mockDatabase.get.mockResolvedValueOnce([{ id: 1 }]); // Binding exists

      await expect(bindingManager.createBinding(userId, bindingOptions))
        .rejects.toThrow('Binding already exists');
    });
  });

  describe('updateBinding', () => {
    const userId = 'user123';
    const bindingId = 1;
    const updateOptions = {
      config: {
        chat: {
          enabled: false,
          bidirectional: false
        }
      }
    };

    it('should update binding successfully', async () => {
      const existingBinding = {
        id: 1,
        group_id: 'group123',
        server_id: 'server123',
        binding_type: 'chat',
        config: JSON.stringify({
          chat: { enabled: true, bidirectional: true }
        }),
        created_at: new Date()
      };

      mockDatabase.get.mockResolvedValueOnce([existingBinding]); // Get existing
      mockPermission.checkPermission.mockResolvedValue({ granted: true });
      mockDatabase.set.mockResolvedValue(undefined);
      mockDatabase.get.mockResolvedValueOnce([{
        ...existingBinding,
        config: JSON.stringify({
          chat: { enabled: false, bidirectional: false }
        })
      }]); // Get updated
      mockAudit.logger.logServerOperation.mockResolvedValue({} as any);

      const result = await bindingManager.updateBinding(userId, bindingId, updateOptions);

      expect(result.config.chat?.enabled).toBe(false);
      expect(result.config.chat?.bidirectional).toBe(false);
      expect(mockDatabase.set).toHaveBeenCalledWith('server_bindings', bindingId, expect.objectContaining({
        config: expect.stringContaining('"enabled":false')
      }));
    });

    it('should throw error when binding not found', async () => {
      mockDatabase.get.mockResolvedValueOnce([]); // Binding doesn't exist

      await expect(bindingManager.updateBinding(userId, bindingId, updateOptions))
        .rejects.toThrow('Binding 1 not found');
    });
  });

  describe('deleteBinding', () => {
    const userId = 'user123';
    const bindingId = 1;

    it('should delete binding successfully', async () => {
      const existingBinding = {
        id: 1,
        group_id: 'group123',
        server_id: 'server123',
        binding_type: 'chat',
        config: '{}',
        created_at: new Date()
      };

      mockDatabase.get.mockResolvedValueOnce([existingBinding]);
      mockPermission.checkPermission.mockResolvedValue({ granted: true });
      mockDatabase.remove.mockResolvedValue(undefined);
      mockAudit.logger.logServerOperation.mockResolvedValue({} as any);

      await bindingManager.deleteBinding(userId, bindingId);

      expect(mockDatabase.remove).toHaveBeenCalledWith('server_bindings', bindingId);
      expect(mockAudit.logger.logServerOperation).toHaveBeenCalledWith(
        'server123',
        'binding.delete',
        expect.objectContaining({
          bindingId: 1,
          groupId: 'group123'
        }),
        'success',
        undefined,
        expect.objectContaining({
          userId
        })
      );
    });
  });

  describe('queryBindings', () => {
    it('should query bindings with filters', async () => {
      const mockBindings = [
        {
          id: 1,
          group_id: 'group123',
          server_id: 'server123',
          binding_type: 'chat',
          config: '{"chat":{"enabled":true}}',
          created_at: new Date()
        },
        {
          id: 2,
          group_id: 'group123',
          server_id: 'server456',
          binding_type: 'event',
          config: '{"event":{"enabled":true}}',
          created_at: new Date()
        }
      ];

      mockDatabase.eval.mockResolvedValue(2); // Total count
      mockDatabase.get.mockResolvedValue(mockBindings);

      const result = await bindingManager.queryBindings({
        groupId: 'group123',
        limit: 10,
        offset: 0
      });

      expect(result.total).toBe(2);
      expect(result.bindings).toHaveLength(2);
      expect(result.bindings[0].groupId).toBe('group123');
      expect(result.bindings[0].bindingType).toBe('chat');
      expect(result.bindings[1].bindingType).toBe('event');
    });
  });

  describe('getGroupRoutes', () => {
    it('should return routing rules for a group', async () => {
      const mockBindings = [
        {
          id: 1,
          group_id: 'group123',
          server_id: 'server123',
          binding_type: 'chat',
          config: '{}',
          created_at: new Date()
        },
        {
          id: 2,
          group_id: 'group123',
          server_id: 'server456',
          binding_type: 'chat',
          config: '{}',
          created_at: new Date()
        },
        {
          id: 3,
          group_id: 'group123',
          server_id: 'server123',
          binding_type: 'event',
          config: '{}',
          created_at: new Date()
        }
      ];

      mockDatabase.get.mockResolvedValue(mockBindings);

      const routes = await bindingManager.getGroupRoutes('group123');

      expect(routes).toHaveLength(2); // chat and event types
      
      const chatRoute = routes.find(r => r.bindingType === 'chat');
      const eventRoute = routes.find(r => r.bindingType === 'event');
      
      expect(chatRoute?.serverIds).toEqual(['server123', 'server456']);
      expect(eventRoute?.serverIds).toEqual(['server123']);
      expect(eventRoute?.priority).toBeGreaterThan(chatRoute?.priority || 0);
    });
  });

  describe('getGroupServers', () => {
    it('should return unique server IDs for a group', async () => {
      const mockBindings = [
        { server_id: 'server123' },
        { server_id: 'server456' },
        { server_id: 'server123' } // Duplicate
      ];

      mockDatabase.get.mockResolvedValue(mockBindings);

      const serverIds = await bindingManager.getGroupServers('group123');

      expect(serverIds).toEqual(['server123', 'server456']);
      expect(serverIds).toHaveLength(2); // No duplicates
    });

    it('should filter by binding type', async () => {
      const mockBindings = [
        { server_id: 'server123' },
        { server_id: 'server456' }
      ];

      mockDatabase.get.mockResolvedValue(mockBindings);

      await bindingManager.getGroupServers('group123', 'chat');

      expect(mockDatabase.get).toHaveBeenCalledWith('server_bindings', {
        group_id: 'group123',
        binding_type: 'chat'
      });
    });
  });

  describe('getServerGroups', () => {
    it('should return unique group IDs for a server', async () => {
      const mockBindings = [
        { group_id: 'group123' },
        { group_id: 'group456' },
        { group_id: 'group123' } // Duplicate
      ];

      mockDatabase.get.mockResolvedValue(mockBindings);

      const groupIds = await bindingManager.getServerGroups('server123');

      expect(groupIds).toEqual(['group123', 'group456']);
      expect(groupIds).toHaveLength(2); // No duplicates
    });
  });

  describe('hasBinding', () => {
    it('should return true when binding exists', async () => {
      mockDatabase.get.mockResolvedValue([{ id: 1 }]);

      const exists = await bindingManager.hasBinding('group123', 'server123');

      expect(exists).toBe(true);
      expect(mockDatabase.get).toHaveBeenCalledWith('server_bindings', {
        group_id: 'group123',
        server_id: 'server123'
      });
    });

    it('should return false when binding does not exist', async () => {
      mockDatabase.get.mockResolvedValue([]);

      const exists = await bindingManager.hasBinding('group123', 'server123');

      expect(exists).toBe(false);
    });

    it('should filter by binding type when specified', async () => {
      mockDatabase.get.mockResolvedValue([{ id: 1 }]);

      await bindingManager.hasBinding('group123', 'server123', 'chat');

      expect(mockDatabase.get).toHaveBeenCalledWith('server_bindings', {
        group_id: 'group123',
        server_id: 'server123',
        binding_type: 'chat'
      });
    });
  });

  describe('getBindingStats', () => {
    it('should return binding statistics', async () => {
      const mockBindings = [
        {
          id: 1,
          group_id: 'group123',
          server_id: 'server123',
          binding_type: 'chat',
          config: '{}',
          created_at: new Date()
        },
        {
          id: 2,
          group_id: 'group456',
          server_id: 'server123',
          binding_type: 'event',
          config: '{}',
          created_at: new Date()
        },
        {
          id: 3,
          group_id: 'group123',
          server_id: 'server456',
          binding_type: 'chat',
          config: '{}',
          created_at: new Date()
        }
      ];

      mockDatabase.get.mockResolvedValue(mockBindings);

      const stats = await bindingManager.getBindingStats();

      expect(stats.totalBindings).toBe(3);
      expect(stats.activeBindings).toBe(3); // All are active by default
      expect(stats.bindingsByType.chat).toBe(2);
      expect(stats.bindingsByType.event).toBe(1);
      expect(stats.bindingsByGroup['group123']).toBe(2);
      expect(stats.bindingsByGroup['group456']).toBe(1);
      expect(stats.bindingsByServer['server123']).toBe(2);
      expect(stats.bindingsByServer['server456']).toBe(1);
    });
  });

  describe('createBindingsBatch', () => {
    it('should create multiple bindings successfully', async () => {
      const userId = 'user123';
      const bindings: BindingCreateOptions[] = [
        {
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: { chat: { enabled: true, bidirectional: true } }
        },
        {
          groupId: 'group123',
          serverId: 'server456',
          bindingType: 'event',
          config: { event: { enabled: true, eventTypes: ['player.join'] } }
        }
      ];

      // Mock successful creation for both bindings
      mockPermission.checkPermission.mockResolvedValue({ granted: true });
      mockDatabase.get.mockResolvedValue([{ id: 'server123' }]); // Server exists
      mockDatabase.get.mockResolvedValue([]); // No existing binding
      mockDatabase.create.mockResolvedValueOnce([{ id: 1, ...bindings[0] }]);
      mockDatabase.create.mockResolvedValueOnce([{ id: 2, ...bindings[1] }]);
      mockAudit.logger.logServerOperation.mockResolvedValue({} as any);

      // Mock the individual createBinding calls
      jest.spyOn(bindingManager, 'createBinding')
        .mockResolvedValueOnce({
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: bindings[0].config,
          createdAt: new Date(),
          status: 'active'
        })
        .mockResolvedValueOnce({
          id: 2,
          groupId: 'group123',
          serverId: 'server456',
          bindingType: 'event',
          config: bindings[1].config,
          createdAt: new Date(),
          status: 'active'
        });

      const results = await bindingManager.createBindingsBatch(userId, bindings);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(1);
      expect(results[1].id).toBe(2);
    });
  });

  describe('deleteGroupBindings', () => {
    it('should delete all bindings for a group', async () => {
      const userId = 'user123';
      const groupId = 'group123';

      const mockBindings = [
        { id: 1, server_id: 'server123' },
        { id: 2, server_id: 'server456' }
      ];

      mockDatabase.get.mockResolvedValue(mockBindings);
      jest.spyOn(bindingManager, 'deleteBinding').mockResolvedValue(undefined);

      const deletedCount = await bindingManager.deleteGroupBindings(userId, groupId);

      expect(deletedCount).toBe(2);
      expect(bindingManager.deleteBinding).toHaveBeenCalledTimes(2);
      expect(bindingManager.deleteBinding).toHaveBeenCalledWith(userId, 1);
      expect(bindingManager.deleteBinding).toHaveBeenCalledWith(userId, 2);
    });
  });

  describe('deleteServerBindings', () => {
    it('should delete all bindings for a server', async () => {
      const userId = 'user123';
      const serverId = 'server123';

      const mockBindings = [
        { id: 1, group_id: 'group123' },
        { id: 2, group_id: 'group456' }
      ];

      mockDatabase.get.mockResolvedValue(mockBindings);
      jest.spyOn(bindingManager, 'deleteBinding').mockResolvedValue(undefined);

      const deletedCount = await bindingManager.deleteServerBindings(userId, serverId);

      expect(deletedCount).toBe(2);
      expect(bindingManager.deleteBinding).toHaveBeenCalledTimes(2);
      expect(bindingManager.deleteBinding).toHaveBeenCalledWith(userId, 1);
      expect(bindingManager.deleteBinding).toHaveBeenCalledWith(userId, 2);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      mockDatabase.get.mockResolvedValue([]);
      jest.spyOn(bindingManager, 'getBindingStats').mockResolvedValue({
        totalBindings: 5,
        activeBindings: 4,
        bindingsByType: { chat: 2, event: 2, command: 0, monitoring: 0 },
        bindingsByGroup: {},
        bindingsByServer: {},
        messageCount24h: 100,
        errorCount24h: 2
      });

      const health = await bindingManager.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.details.totalBindings).toBe(5);
      expect(health.details.activeBindings).toBe(4);
    });

    it('should return unhealthy status on database error', async () => {
      mockDatabase.get.mockRejectedValue(new Error('Database connection failed'));

      const health = await bindingManager.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBe('Database connection failed');
    });
  });
});