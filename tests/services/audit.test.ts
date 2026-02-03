/**
 * Audit Service Tests
 * 
 * This file contains comprehensive unit tests for the audit logging service.
 */

import { Context } from 'koishi';
import { 
  AuditService, 
  AuditLogger, 
  AuditQueryService, 
  AuditStatisticsService,
  AuditExportService,
  AuditFilter,
  AuditExportOptions,
  AuditContext
} from '../../src/services/audit';
import { AuditLog } from '../../src/types';
import { createMockContext } from '../setup';

describe('Audit Service', () => {
  let ctx: Context;
  let auditService: AuditService;

  beforeEach(() => {
    ctx = createMockContext();
    auditService = new AuditService(ctx);
  });

  describe('AuditLogger', () => {
    let auditLogger: AuditLogger;

    beforeEach(() => {
      auditLogger = new AuditLogger(ctx);
    });

    describe('logSuccess', () => {
      it('should log successful operations', async () => {
        const operation = 'player.kick';
        const operationData = { playerId: 'player123', reason: 'test' };
        const context: AuditContext = {
          userId: 'user123',
          serverId: 'server123',
          ipAddress: '127.0.0.1',
          userAgent: 'MochiLink/1.0'
        };

        // Mock database response
        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: context.userId,
          server_id: context.serverId,
          operation,
          operation_data: JSON.stringify(operationData),
          result: 'success',
          error_message: null,
          ip_address: context.ipAddress,
          user_agent: context.userAgent,
          created_at: new Date()
        }]);

        const result = await auditLogger.logSuccess(operation, operationData, context);

        expect(ctx.database.create).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
          user_id: context.userId,
          server_id: context.serverId,
          operation,
          operation_data: JSON.stringify(operationData),
          result: 'success',
          ip_address: context.ipAddress,
          user_agent: context.userAgent
        }));
        expect(result.operation).toBe(operation);
        expect(result.result).toBe('success');
      });
    });

    describe('logFailure', () => {
      it('should log failed operations with error message', async () => {
        const operation = 'player.kick';
        const operationData = { playerId: 'player123' };
        const errorMessage = 'Player not found';
        const context: AuditContext = { userId: 'user123', serverId: 'server123' };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: context.userId,
          server_id: context.serverId,
          operation,
          operation_data: JSON.stringify(operationData),
          result: 'failure',
          error_message: errorMessage,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logFailure(operation, operationData, errorMessage, context);

        expect(result.result).toBe('failure');
        expect(result.errorMessage).toBe(errorMessage);
      });
    });

    describe('logError', () => {
      it('should log error operations with Error object', async () => {
        const operation = 'server.connect';
        const operationData = { serverId: 'server123' };
        const error = new Error('Connection timeout');
        const context: AuditContext = { serverId: 'server123' };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: null,
          server_id: context.serverId,
          operation,
          operation_data: JSON.stringify(operationData),
          result: 'error',
          error_message: error.message,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logError(operation, operationData, error, context);

        expect(result.result).toBe('error');
        expect(result.errorMessage).toBe(error.message);
      });

      it('should log error operations with string error', async () => {
        const operation = 'server.connect';
        const operationData = { serverId: 'server123' };
        const errorString = 'Connection failed';
        const context: AuditContext = { serverId: 'server123' };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: null,
          server_id: context.serverId,
          operation,
          operation_data: JSON.stringify(operationData),
          result: 'error',
          error_message: errorString,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logError(operation, operationData, errorString, context);

        expect(result.result).toBe('error');
        expect(result.errorMessage).toBe(errorString);
      });
    });

    describe('logAuthFailure', () => {
      it('should log authentication failures', async () => {
        const serverId = 'server123';
        const reason = 'invalid_token';
        const context: AuditContext = { ipAddress: '192.168.1.1' };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: null,
          server_id: serverId,
          operation: 'auth.failure',
          operation_data: JSON.stringify({ serverId, reason }),
          result: 'failure',
          error_message: `Authentication failed: ${reason}`,
          ip_address: context.ipAddress,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logAuthFailure(serverId, reason, context);

        expect(result.operation).toBe('auth.failure');
        expect(result.result).toBe('failure');
        expect(result.errorMessage).toContain(reason);
      });
    });

    describe('logPermissionDenied', () => {
      it('should log permission denied events', async () => {
        const userId = 'user123';
        const serverId = 'server123';
        const operation = 'player.kick';

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: userId,
          server_id: serverId,
          operation: 'permission.denied',
          operation_data: JSON.stringify({ userId, serverId, operation }),
          result: 'failure',
          error_message: `Permission denied for operation: ${operation}`,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logPermissionDenied(userId, serverId, operation);

        expect(result.operation).toBe('permission.denied');
        expect(result.result).toBe('failure');
        expect(result.errorMessage).toContain(operation);
      });
    });

    describe('logConnection', () => {
      it('should log connection events', async () => {
        const serverId = 'server123';
        const event = 'connect';
        const details = { connectionMode: 'plugin', duration: 1500 };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: null,
          server_id: serverId,
          operation: `connection.${event}`,
          operation_data: JSON.stringify({ serverId, ...details }),
          result: 'success',
          error_message: null,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logConnection(serverId, event, details);

        expect(result.operation).toBe(`connection.${event}`);
        expect(result.result).toBe('success');
        expect(result.operationData).toEqual({ serverId, ...details });
      });
    });

    describe('logServerOperation', () => {
      it('should log server management operations', async () => {
        const serverId = 'server123';
        const operation = 'restart';
        const operationData = { graceful: true, timeout: 30 };
        const context: AuditContext = { userId: 'admin123' };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: context.userId,
          server_id: serverId,
          operation: `server.${operation}`,
          operation_data: JSON.stringify(operationData),
          result: 'success',
          error_message: null,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logServerOperation(
          serverId, operation, operationData, 'success', undefined, context
        );

        expect(result.operation).toBe(`server.${operation}`);
        expect(result.result).toBe('success');
        expect(result.serverId).toBe(serverId);
      });
    });

    describe('logPlayerOperation', () => {
      it('should log player management operations', async () => {
        const serverId = 'server123';
        const playerId = 'player123';
        const operation = 'kick';
        const operationData = { reason: 'griefing' };
        const context: AuditContext = { userId: 'mod123' };

        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: context.userId,
          server_id: serverId,
          operation: `player.${operation}`,
          operation_data: JSON.stringify({ playerId, ...operationData }),
          result: 'success',
          error_message: null,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        }]);

        const result = await auditLogger.logPlayerOperation(
          serverId, playerId, operation, operationData, 'success', undefined, context
        );

        expect(result.operation).toBe(`player.${operation}`);
        expect(result.result).toBe('success');
        expect(result.operationData.playerId).toBe(playerId);
      });
    });
  });

  describe('AuditQueryService', () => {
    let queryService: AuditQueryService;

    beforeEach(() => {
      queryService = new AuditQueryService(ctx);
    });

    describe('queryLogs', () => {
      it('should query logs with filters', async () => {
        const filter: AuditFilter = {
          userId: 'user123',
          serverId: 'server123',
          operation: 'player.kick',
          limit: 50
        };

        const mockLogs = [{
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
        }];

        ctx.database.get = jest.fn().mockResolvedValue(mockLogs);

        const result = await queryService.queryLogs(filter);

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {
          user_id: filter.userId,
          server_id: filter.serverId,
          operation: filter.operation
        }, {
          limit: filter.limit,
          offset: 0
        });
        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('user123');
      });

      it('should query logs without filters', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        const result = await queryService.queryLogs();

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {}, {
          limit: 100,
          offset: 0
        });
        expect(result).toHaveLength(0);
      });
    });

    describe('getLogById', () => {
      it('should return log when found', async () => {
        const logId = 1;
        const mockLog = {
          id: logId,
          user_id: 'user123',
          server_id: 'server123',
          operation: 'player.kick',
          operation_data: JSON.stringify({}),
          result: 'success',
          error_message: null,
          ip_address: null,
          user_agent: null,
          created_at: new Date()
        };

        ctx.database.get = jest.fn().mockResolvedValue([mockLog]);

        const result = await queryService.getLogById(logId);

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', { id: logId });
        expect(result).not.toBeNull();
        expect(result!.id).toBe(logId);
      });

      it('should return null when log not found', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        const result = await queryService.getLogById(999);

        expect(result).toBeNull();
      });
    });

    describe('getRecentLogs', () => {
      it('should return recent logs with default limit', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        await queryService.getRecentLogs();

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {}, {
          limit: 100,
          offset: 0
        });
      });

      it('should return recent logs with custom limit', async () => {
        const limit = 50;
        ctx.database.get = jest.fn().mockResolvedValue([]);

        await queryService.getRecentLogs(limit);

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {}, {
          limit,
          offset: 0
        });
      });
    });

    describe('getUserLogs', () => {
      it('should return logs for specific user', async () => {
        const userId = 'user123';
        ctx.database.get = jest.fn().mockResolvedValue([]);

        await queryService.getUserLogs(userId);

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {
          user_id: userId
        }, {
          limit: 100,
          offset: 0
        });
      });
    });

    describe('getServerLogs', () => {
      it('should return logs for specific server', async () => {
        const serverId = 'server123';
        ctx.database.get = jest.fn().mockResolvedValue([]);

        await queryService.getServerLogs(serverId);

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {
          server_id: serverId
        }, {
          limit: 100,
          offset: 0
        });
      });
    });

    describe('getLogsInDateRange', () => {
      it('should return logs within date range', async () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-01-31');
        ctx.database.get = jest.fn().mockResolvedValue([]);

        await queryService.getLogsInDateRange(startDate, endDate);

        expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {
          created_at: {
            $gte: startDate,
            $lte: endDate
          }
        }, {
          limit: 1000,
          offset: 0
        });
      });
    });

    describe('searchLogs', () => {
      it('should search logs by operation pattern', async () => {
        const searchTerm = 'kick';
        const mockLogs = [
          {
            id: 1,
            userId: 'user123',
            serverId: 'server123',
            operation: 'player.kick',
            operationData: { playerId: 'player123' },
            result: 'success' as const,
            errorMessage: undefined,
            ipAddress: undefined,
            userAgent: undefined,
            createdAt: new Date()
          },
          {
            id: 2,
            userId: 'user123',
            serverId: 'server123',
            operation: 'player.ban',
            operationData: { playerId: 'player456' },
            result: 'success' as const,
            errorMessage: undefined,
            ipAddress: undefined,
            userAgent: undefined,
            createdAt: new Date()
          }
        ];

        ctx.database.get = jest.fn().mockResolvedValue([
          {
            id: 1,
            user_id: 'user123',
            server_id: 'server123',
            operation: 'player.kick',
            operation_data: JSON.stringify({ playerId: 'player123' }),
            result: 'success',
            error_message: null,
            ip_address: null,
            user_agent: null,
            created_at: new Date()
          },
          {
            id: 2,
            user_id: 'user123',
            server_id: 'server123',
            operation: 'player.ban',
            operation_data: JSON.stringify({ playerId: 'player456' }),
            result: 'success',
            error_message: null,
            ip_address: null,
            user_agent: null,
            created_at: new Date()
          }
        ]);

        const result = await queryService.searchLogs(searchTerm);

        expect(result).toHaveLength(1);
        expect(result[0].operation).toBe('player.kick');
      });
    });
  });

  describe('AuditStatisticsService', () => {
    let statsService: AuditStatisticsService;

    beforeEach(() => {
      statsService = new AuditStatisticsService(ctx);
    });

    describe('getStatistics', () => {
      it('should calculate comprehensive statistics', async () => {
        const mockLogs = [
          {
            id: 1,
            user_id: 'user1',
            server_id: 'server1',
            operation: 'player.kick',
            operation_data: JSON.stringify({}),
            result: 'success',
            error_message: null,
            ip_address: null,
            user_agent: null,
            created_at: new Date('2023-01-01')
          },
          {
            id: 2,
            user_id: 'user2',
            server_id: 'server1',
            operation: 'player.ban',
            operation_data: JSON.stringify({}),
            result: 'failure',
            error_message: 'Player not found',
            ip_address: null,
            user_agent: null,
            created_at: new Date('2023-01-02')
          },
          {
            id: 3,
            user_id: 'user1',
            server_id: 'server2',
            operation: 'server.restart',
            operation_data: JSON.stringify({}),
            result: 'error',
            error_message: 'Connection lost',
            ip_address: null,
            user_agent: null,
            created_at: new Date('2023-01-03')
          }
        ];

        ctx.database.get = jest.fn().mockResolvedValue(mockLogs);

        const stats = await statsService.getStatistics();

        expect(stats.totalOperations).toBe(3);
        expect(stats.successfulOperations).toBe(1);
        expect(stats.failedOperations).toBe(1);
        expect(stats.errorOperations).toBe(1);
        expect(stats.uniqueUsers).toBe(2);
        expect(stats.uniqueServers).toBe(2);
        expect(stats.operationsByType['player.kick']).toBe(1);
        expect(stats.operationsByType['player.ban']).toBe(1);
        expect(stats.operationsByType['server.restart']).toBe(1);
        expect(stats.operationsByResult['success']).toBe(1);
        expect(stats.operationsByResult['failure']).toBe(1);
        expect(stats.operationsByResult['error']).toBe(1);
        expect(stats.timeRange.earliest).toEqual(new Date('2023-01-01'));
        expect(stats.timeRange.latest).toEqual(new Date('2023-01-03'));
      });

      it('should handle empty logs', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([]);

        const stats = await statsService.getStatistics();

        expect(stats.totalOperations).toBe(0);
        expect(stats.successfulOperations).toBe(0);
        expect(stats.failedOperations).toBe(0);
        expect(stats.errorOperations).toBe(0);
        expect(stats.uniqueUsers).toBe(0);
        expect(stats.uniqueServers).toBe(0);
        expect(stats.timeRange.earliest).toBeNull();
        expect(stats.timeRange.latest).toBeNull();
      });
    });

    describe('getOperationFrequency', () => {
      it('should return operation frequency by day', async () => {
        ctx.database.get = jest.fn().mockResolvedValue([
          {
            id: 1,
            user_id: 'user1',
            server_id: 'server1',
            operation: 'player.kick',
            operation_data: JSON.stringify({}),
            result: 'success',
            error_message: null,
            ip_address: null,
            user_agent: null,
            created_at: new Date()
          }
        ]);

        const result = await statsService.getOperationFrequency('day', 7);

        expect(result).toHaveLength(7);
        expect(ctx.database.get).toHaveBeenCalledTimes(7);
        result.forEach(period => {
          expect(period).toHaveProperty('period');
          expect(period).toHaveProperty('count');
          expect(period).toHaveProperty('operations');
        });
      });
    });
  });

  describe('AuditExportService', () => {
    let exportService: AuditExportService;

    beforeEach(() => {
      exportService = new AuditExportService(ctx);
    });

    const mockLogs: AuditLog[] = [
      {
        id: 1,
        userId: 'user123',
        serverId: 'server123',
        operation: 'player.kick',
        operationData: { playerId: 'player123', reason: 'test' },
        result: 'success',
        errorMessage: undefined,
        ipAddress: '127.0.0.1',
        userAgent: 'MochiLink/1.0',
        createdAt: new Date('2023-01-01T12:00:00Z')
      }
    ];

    describe('exportLogs', () => {
      beforeEach(() => {
        ctx.database.get = jest.fn().mockResolvedValue([{
          id: 1,
          user_id: 'user123',
          server_id: 'server123',
          operation: 'player.kick',
          operation_data: JSON.stringify({ playerId: 'player123', reason: 'test' }),
          result: 'success',
          error_message: null,
          ip_address: '127.0.0.1',
          user_agent: 'MochiLink/1.0',
          created_at: new Date('2023-01-01T12:00:00Z')
        }]);
      });

      it('should export logs as JSON', async () => {
        const options: AuditExportOptions = {
          format: 'json',
          includeHeaders: true
        };

        const result = await exportService.exportLogs(options);
        const parsed = JSON.parse(result);

        expect(parsed).toHaveProperty('metadata');
        expect(parsed).toHaveProperty('logs');
        expect(parsed.metadata.format).toBe('json');
        expect(parsed.logs).toHaveLength(1);
        expect(parsed.logs[0].operation).toBe('player.kick');
      });

      it('should export logs as CSV', async () => {
        const options: AuditExportOptions = {
          format: 'csv',
          includeHeaders: true
        };

        const result = await exportService.exportLogs(options);
        const lines = result.split('\n');

        expect(lines[0]).toContain('ID,User ID,Server ID,Operation');
        expect(lines[1]).toContain('"1","user123","server123","player.kick"');
      });

      it('should export logs as CSV without headers', async () => {
        const options: AuditExportOptions = {
          format: 'csv',
          includeHeaders: false
        };

        const result = await exportService.exportLogs(options);
        const lines = result.split('\n');

        expect(lines[0]).toContain('"1","user123","server123","player.kick"');
        expect(lines[0]).not.toContain('ID,User ID');
      });

      it('should export logs as XML', async () => {
        const options: AuditExportOptions = {
          format: 'xml'
        };

        const result = await exportService.exportLogs(options);

        expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(result).toContain('<audit_logs>');
        expect(result).toContain('<log id="1">');
        expect(result).toContain('<operation>player.kick</operation>');
        expect(result).toContain('</audit_logs>');
      });

      it('should throw error for unsupported format', async () => {
        const options: AuditExportOptions = {
          format: 'pdf' as any
        };

        await expect(exportService.exportLogs(options))
          .rejects.toThrow('Unsupported export format: pdf');
      });

      it('should format dates according to specified format', async () => {
        const options: AuditExportOptions = {
          format: 'json',
          dateFormat: 'date'
        };

        const result = await exportService.exportLogs(options);
        const parsed = JSON.parse(result);

        expect(parsed.logs[0].createdAt).toBe('2023-01-01');
      });
    });
  });

  describe('AuditService Integration', () => {
    describe('performMaintenance', () => {
      it('should perform maintenance and return statistics', async () => {
        // Mock recent and old logs
        ctx.database.get = jest.fn()
          .mockResolvedValueOnce([{ // recent logs
            id: 1,
            created_at: new Date()
          }])
          .mockResolvedValueOnce([{ // oldest logs
            id: 100,
            created_at: new Date('2023-01-01')
          }]);

        // Mock cleanup operation
        ctx.database.remove = jest.fn().mockResolvedValue({ matched: 50 });

        const result = await auditService.performMaintenance(30);

        expect(result.logsRemoved).toBe(50);
        expect(result.newestLogDate).toBeInstanceOf(Date);
        expect(result.oldestLogDate).toEqual(new Date('2023-01-01'));
      });
    });

    describe('getHealthStatus', () => {
      it('should return healthy status when all operations work', async () => {
        // Mock successful write
        ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
        ctx.database.get = jest.fn()
          .mockResolvedValueOnce([{ // for write test
            id: 1,
            user_id: 'system',
            server_id: null,
            operation: 'health.check',
            operation_data: JSON.stringify({ timestamp: expect.any(Number) }),
            result: 'success',
            error_message: null,
            ip_address: null,
            user_agent: null,
            created_at: new Date()
          }])
          .mockResolvedValueOnce([{ // for read test
            id: 1,
            created_at: new Date()
          }]);

        const result = await auditService.getHealthStatus();

        expect(result.status).toBe('healthy');
        expect(result.details.canWrite).toBe(true);
        expect(result.details.canRead).toBe(true);
        expect(result.details.recentLogCount).toBe(1);
      });

      it('should return unhealthy status when operations fail', async () => {
        ctx.database.create = jest.fn().mockRejectedValue(new Error('Database error'));

        const result = await auditService.getHealthStatus();

        expect(result.status).toBe('unhealthy');
        expect(result.details.canWrite).toBe(false);
        expect(result.details.canRead).toBe(false);
      });
    });
  });
});