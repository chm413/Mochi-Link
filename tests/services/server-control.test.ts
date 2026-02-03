/**
 * Server Control Operations Tests
 * 
 * Tests for server-level control operations including save world,
 * reload config, graceful shutdown, restart, and backup functionality.
 */

import { Context } from 'koishi';
import { CommandExecutionService, ServerControlOperation } from '../../src/services/command';
import { AuditService } from '../../src/services/audit';
import { PermissionManager } from '../../src/services/permission';
import { BaseConnectorBridge } from '../../src/bridge/base';
import { CommandResult } from '../../src/types';

describe('Server Control Operations', () => {
  let ctx: Context;
  let commandService: CommandExecutionService;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockPermissionManager: jest.Mocked<PermissionManager>;
  let mockGetBridge: jest.MockedFunction<(serverId: string) => BaseConnectorBridge | null>;
  let mockBridge: jest.Mocked<BaseConnectorBridge>;

  beforeEach(() => {
    // Create mock context
    ctx = {
      logger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }))
    } as any;

    // Create mock services
    mockAuditService = {
      logger: {
        logSuccess: jest.fn().mockResolvedValue(undefined),
        logFailure: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    mockPermissionManager = {
      checkPermission: jest.fn().mockResolvedValue({ granted: true })
    } as any;

    // Create mock bridge
    mockBridge = {
      isConnectedToBridge: jest.fn().mockReturnValue(true),
      executeCommand: jest.fn().mockResolvedValue({
        success: true,
        output: ['Command executed successfully'],
        executionTime: 100,
        error: undefined
      } as CommandResult)
    } as any;

    mockGetBridge = jest.fn().mockReturnValue(mockBridge);

    // Create command service
    commandService = new CommandExecutionService(
      ctx,
      mockAuditService,
      mockPermissionManager,
      mockGetBridge
    );
  });

  describe('Save World Operation', () => {
    it('should execute save world operation successfully', async () => {
      const operation: ServerControlOperation = {
        type: 'save-world',
        serverId: 'test-server-1',
        parameters: { world: 'world' }
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(result.operation).toEqual(operation);
      expect(result.duration).toBeGreaterThan(0);
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('save-all world', undefined);
    });

    it('should execute save world for default world when no world specified', async () => {
      const operation: ServerControlOperation = {
        type: 'save-world',
        serverId: 'test-server-1'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('save-all', undefined);
    });
  });

  describe('Reload Config Operation', () => {
    it('should execute reload config operation successfully', async () => {
      const operation: ServerControlOperation = {
        type: 'reload-config',
        serverId: 'test-server-1'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(result.operation).toEqual(operation);
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('reload', undefined);
    });
  });

  describe('Graceful Shutdown Operation', () => {
    it('should execute graceful shutdown with custom message', async () => {
      const operation: ServerControlOperation = {
        type: 'graceful-shutdown',
        serverId: 'test-server-1',
        message: 'Server maintenance in progress',
        timeout: 60
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(result.operation).toEqual(operation);
      
      // Should broadcast message first, then shutdown
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('say Server maintenance in progress');
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('stop', 60000);
    });

    it('should execute graceful shutdown with default message', async () => {
      const operation: ServerControlOperation = {
        type: 'graceful-shutdown',
        serverId: 'test-server-1'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('say Server is shutting down');
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('stop', 30000);
    });
  });

  describe('Restart Operation', () => {
    it('should execute restart operation with custom message', async () => {
      const operation: ServerControlOperation = {
        type: 'restart',
        serverId: 'test-server-1',
        message: 'Server restarting for updates'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(result.operation).toEqual(operation);
      
      // Should broadcast message first, then restart
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('say Server restarting for updates');
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('restart', undefined);
    });
  });

  describe('Backup Operation', () => {
    it('should execute backup operation with custom name', async () => {
      const operation: ServerControlOperation = {
        type: 'backup',
        serverId: 'test-server-1',
        parameters: { name: 'pre-update-backup' }
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(result.operation).toEqual(operation);
      expect(result.details?.backupName).toBe('pre-update-backup');
      
      // Should save world first, then create backup
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('save-all');
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('backup create pre-update-backup', undefined);
    });

    it('should execute backup operation with auto-generated name', async () => {
      const operation: ServerControlOperation = {
        type: 'backup',
        serverId: 'test-server-1'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(true);
      expect(result.details?.backupName).toMatch(/^backup-\d+$/);
      
      // Should save world first, then create backup
      expect(mockBridge.executeCommand).toHaveBeenCalledWith('save-all');
      expect(mockBridge.executeCommand).toHaveBeenCalledWith(
        expect.stringMatching(/^backup create backup-\d+$/),
        undefined
      );
    });
  });

  describe('Permission Checking', () => {
    it('should check permissions for server operations', async () => {
      const operation: ServerControlOperation = {
        type: 'save-world',
        serverId: 'test-server-1'
      };

      await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: true, auditLog: false }
      );

      expect(mockPermissionManager.checkPermission).toHaveBeenCalledWith(
        'test-user',
        'test-server-1',
        'server.save-world'
      );
    });

    it('should handle permission denied', async () => {
      mockPermissionManager.checkPermission.mockResolvedValue({ granted: false });

      const operation: ServerControlOperation = {
        type: 'graceful-shutdown',
        serverId: 'test-server-1'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: true, auditLog: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('lacks permission');
      expect(mockBridge.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle server unavailable', async () => {
      mockGetBridge.mockReturnValue(null);

      const operation: ServerControlOperation = {
        type: 'save-world',
        serverId: 'test-server-1'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should handle bridge command failure', async () => {
      mockBridge.executeCommand.mockRejectedValue(new Error('Bridge communication error'));

      const operation: ServerControlOperation = {
        type: 'reload-config',
        serverId: 'test-server-1'
      };

      const result = await commandService.executeServerControl(
        operation,
        'test-user',
        { requirePermission: false, auditLog: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bridge communication error');
    });
  });
});