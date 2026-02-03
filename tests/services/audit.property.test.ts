/**
 * Audit Service Property-Based Tests
 * 
 * This file contains property-based tests for the audit logging service
 * to validate correctness properties across all valid inputs.
 */

import * as fc from 'fast-check';
import { Context } from 'koishi';
import { AuditService, AuditLogger, AuditContext } from '../../src/services/audit';
import { createMockContext } from '../setup';

describe('Audit Service - Property Tests', () => {
  let ctx: Context;
  let auditService: AuditService;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    ctx = createMockContext();
    auditService = new AuditService(ctx);
    auditLogger = new AuditLogger(ctx);
  });

  // ============================================================================
  // Property Test Generators
  // ============================================================================

  const userIdArbitrary = fc.string({ minLength: 3, maxLength: 32 });
  const serverIdArbitrary = fc.string({ minLength: 3, maxLength: 32 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s));
  const operationArbitrary = fc.string({ minLength: 1, maxLength: 50 });
  const ipAddressArbitrary = fc.ipV4();
  const userAgentArbitrary = fc.string({ minLength: 1, maxLength: 100 });
  const resultArbitrary = fc.constantFrom('success', 'failure', 'error');

  const operationDataArbitrary = fc.record({
    reason: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    duration: fc.option(fc.integer({ min: 0, max: 86400 }), { nil: undefined }),
    timestamp: fc.option(fc.integer({ min: 0 }), { nil: undefined })
  });

  const auditContextArbitrary = fc.record({
    userId: fc.option(userIdArbitrary, { nil: undefined }),
    serverId: fc.option(serverIdArbitrary, { nil: undefined }),
    ipAddress: fc.option(ipAddressArbitrary, { nil: undefined }),
    userAgent: fc.option(userAgentArbitrary, { nil: undefined }),
    sessionId: fc.option(fc.uuid(), { nil: undefined }),
    requestId: fc.option(fc.uuid(), { nil: undefined })
  });

  // ============================================================================
  // Property 11: Audit Log Completeness
  // ============================================================================

  describe('Property 11: Audit log completeness', () => {
    it('should record complete audit information for all successful operations', async () => {
      await fc.assert(fc.asyncProperty(
        operationArbitrary,
        operationDataArbitrary,
        auditContextArbitrary,
        async (operation, operationData, context) => {
          // **Validates: Requirements 10.1**
          // Mock successful database operations
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

          // Verify all audit information is recorded
          expect(result.userId).toBe(context.userId);
          expect(result.serverId).toBe(context.serverId);
          expect(result.operation).toBe(operation);
          expect(result.operationData).toEqual(operationData);
          expect(result.result).toBe('success');
          expect(result.errorMessage).toBeNull();
          expect(result.ipAddress).toBe(context.ipAddress);
          expect(result.userAgent).toBe(context.userAgent);
          expect(result.createdAt).toBeInstanceOf(Date);

          // Verify database was called with correct parameters
          expect(ctx.database.create).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
            user_id: context.userId,
            server_id: context.serverId,
            operation,
            operation_data: JSON.stringify(operationData),
            result: 'success',
            ip_address: context.ipAddress,
            user_agent: context.userAgent
          }));
        }
      ), { numRuns: 100 });
    });

    it('should record complete audit information for all failed operations', async () => {
      await fc.assert(fc.asyncProperty(
        operationArbitrary,
        operationDataArbitrary,
        fc.string({ minLength: 1, maxLength: 500 }), // error message
        auditContextArbitrary,
        async (operation, operationData, errorMessage, context) => {
          // **Validates: Requirements 10.1**
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: context.userId,
            server_id: context.serverId,
            operation,
            operation_data: JSON.stringify(operationData),
            result: 'failure',
            error_message: errorMessage,
            ip_address: context.ipAddress,
            user_agent: context.userAgent,
            created_at: new Date()
          }]);

          const result = await auditLogger.logFailure(operation, operationData, errorMessage, context);

          // Verify all audit information is recorded including error details
          expect(result.userId).toBe(context.userId);
          expect(result.serverId).toBe(context.serverId);
          expect(result.operation).toBe(operation);
          expect(result.operationData).toEqual(operationData);
          expect(result.result).toBe('failure');
          expect(result.errorMessage).toBe(errorMessage);
          expect(result.ipAddress).toBe(context.ipAddress);
          expect(result.userAgent).toBe(context.userAgent);
          expect(result.createdAt).toBeInstanceOf(Date);
        }
      ), { numRuns: 100 });
    });

    it('should record complete audit information for all error operations', async () => {
      await fc.assert(fc.asyncProperty(
        operationArbitrary,
        operationDataArbitrary,
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 500 }), // string error
          fc.record({ message: fc.string({ minLength: 1, maxLength: 500 }), name: fc.string({ minLength: 1, maxLength: 50 }) }) // Error-like object
        ),
        auditContextArbitrary,
        async (operation, operationData, error, context) => {
          // **Validates: Requirements 10.1**
          const errorMessage = typeof error === 'string' ? error : error.message;
          
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: context.userId,
            server_id: context.serverId,
            operation,
            operation_data: JSON.stringify(operationData),
            result: 'error',
            error_message: errorMessage,
            ip_address: context.ipAddress,
            user_agent: context.userAgent,
            created_at: new Date()
          }]);

          const result = await auditLogger.logError(operation, operationData, error, context);

          // Verify all audit information is recorded including error details
          expect(result.userId).toBe(context.userId);
          expect(result.serverId).toBe(context.serverId);
          expect(result.operation).toBe(operation);
          expect(result.operationData).toEqual(operationData);
          expect(result.result).toBe('error');
          expect(result.errorMessage).toBe(errorMessage);
          expect(result.ipAddress).toBe(context.ipAddress);
          expect(result.userAgent).toBe(context.userAgent);
          expect(result.createdAt).toBeInstanceOf(Date);
        }
      ), { numRuns: 100 });
    });
  });

  // ============================================================================
  // Audit Log Consistency Properties
  // ============================================================================

  describe('Audit log consistency properties', () => {
    it('should maintain operation-result consistency', async () => {
      await fc.assert(fc.asyncProperty(
        operationArbitrary,
        operationDataArbitrary,
        resultArbitrary,
        auditContextArbitrary,
        async (operation, operationData, result, context) => {
          const errorMessage = result !== 'success' ? 'Test error message' : undefined;
          
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: context.userId,
            server_id: context.serverId,
            operation,
            operation_data: JSON.stringify(operationData),
            result,
            error_message: errorMessage,
            ip_address: context.ipAddress,
            user_agent: context.userAgent,
            created_at: new Date()
          }]);

          let auditResult: any;
          switch (result) {
            case 'success':
              auditResult = await auditLogger.logSuccess(operation, operationData, context);
              break;
            case 'failure':
              auditResult = await auditLogger.logFailure(operation, operationData, errorMessage!, context);
              break;
            case 'error':
              auditResult = await auditLogger.logError(operation, operationData, errorMessage!, context);
              break;
          }

          // Verify result consistency
          expect(auditResult!.result).toBe(result);
          
          // Verify error message consistency
          if (result === 'success') {
            expect(auditResult!.errorMessage).toBeUndefined();
          } else {
            expect(auditResult!.errorMessage).toBe(errorMessage);
          }
        }
      ), { numRuns: 100 });
    });

    it('should preserve operation data integrity', async () => {
      await fc.assert(fc.asyncProperty(
        operationArbitrary,
        operationDataArbitrary,
        auditContextArbitrary,
        async (operation, operationData, context) => {
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

          // Verify operation data is preserved exactly
          expect(result.operationData).toEqual(operationData);
          
          // Verify serialization/deserialization doesn't corrupt data
          const serialized = JSON.stringify(operationData);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual(operationData);
        }
      ), { numRuns: 100 });
    });

    it('should handle special operation types correctly', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        fc.constantFrom('connect', 'disconnect', 'reconnect') as fc.Arbitrary<'connect' | 'disconnect' | 'reconnect'>,
        fc.record({
          connectionMode: fc.constantFrom('plugin', 'rcon', 'terminal'),
          duration: fc.integer({ min: 0, max: 86400 }),
          reason: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
        }),
        auditContextArbitrary,
        async (serverId, event, details, context) => {
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: context.userId,
            server_id: serverId,
            operation: `connection.${event}`,
            operation_data: JSON.stringify({ serverId, ...details }),
            result: 'success',
            error_message: null,
            ip_address: context.ipAddress,
            user_agent: context.userAgent,
            created_at: new Date()
          }]);

          const result = await auditLogger.logConnection(serverId, event, details, context);

          // Verify connection event logging
          expect(result.operation).toBe(`connection.${event}`);
          expect(result.serverId).toBe(serverId);
          expect(result.operationData).toEqual({ serverId, ...details });
          expect(result.result).toBe('success');
        }
      ), { numRuns: 100 });
    });

    it('should handle server operations with proper prefixing', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        fc.constantFrom('start', 'stop', 'restart', 'reload', 'backup'),
        operationDataArbitrary,
        resultArbitrary as fc.Arbitrary<'success' | 'failure' | 'error'>,
        auditContextArbitrary,
        async (serverId, operation, operationData, result, context) => {
          const errorMessage = result !== 'success' ? 'Test error' : undefined;
          
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: context.userId,
            server_id: serverId,
            operation: `server.${operation}`,
            operation_data: JSON.stringify(operationData),
            result,
            error_message: errorMessage,
            ip_address: context.ipAddress,
            user_agent: context.userAgent,
            created_at: new Date()
          }]);

          const auditResult = await auditLogger.logServerOperation(
            serverId, operation, operationData, result, errorMessage, context
          );

          // Verify server operation logging
          expect(auditResult.operation).toBe(`server.${operation}`);
          expect(auditResult.serverId).toBe(serverId);
          expect(auditResult.operationData).toEqual(operationData);
          expect(auditResult.result).toBe(result);
        }
      ), { numRuns: 100 });
    });

    it('should handle player operations with proper data structure', async () => {
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        fc.string({ minLength: 3, maxLength: 16 }), // playerId
        fc.constantFrom('kick', 'ban', 'unban', 'mute', 'unmute'),
        operationDataArbitrary,
        resultArbitrary as fc.Arbitrary<'success' | 'failure' | 'error'>,
        auditContextArbitrary,
        async (serverId, playerId, operation, operationData, result, context) => {
          const errorMessage = result !== 'success' ? 'Test error' : undefined;
          
          ctx.database.create = jest.fn().mockResolvedValue([{ id: 1 }]);
          ctx.database.get = jest.fn().mockResolvedValue([{
            id: 1,
            user_id: context.userId,
            server_id: serverId,
            operation: `player.${operation}`,
            operation_data: JSON.stringify({ playerId, ...operationData }),
            result,
            error_message: errorMessage,
            ip_address: context.ipAddress,
            user_agent: context.userAgent,
            created_at: new Date()
          }]);

          const auditResult = await auditLogger.logPlayerOperation(
            serverId, playerId, operation, operationData, result, errorMessage, context
          );

          // Verify player operation logging
          expect(auditResult.operation).toBe(`player.${operation}`);
          expect(auditResult.serverId).toBe(serverId);
          expect(auditResult.operationData.playerId).toBe(playerId);
          expect(auditResult.result).toBe(result);
          
          // Verify player ID is included in operation data
          expect(auditResult.operationData).toEqual({ playerId, ...operationData });
        }
      ), { numRuns: 100 });
    });
  });

  // ============================================================================
  // Audit Query Properties
  // ============================================================================

  describe('Audit query properties', () => {
    it('should return consistent results for same query parameters', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          userId: fc.option(userIdArbitrary, { nil: undefined }),
          serverId: fc.option(serverIdArbitrary, { nil: undefined }),
          operation: fc.option(operationArbitrary, { nil: undefined }),
          limit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined })
        }),
        async (filter) => {
          const mockLogs = [{
            id: 1,
            user_id: filter.userId || 'user123',
            server_id: filter.serverId || 'server123',
            operation: filter.operation || 'test.operation',
            operation_data: JSON.stringify({}),
            result: 'success',
            error_message: null,
            ip_address: null,
            user_agent: null,
            created_at: new Date()
          }];

          ctx.database.get = jest.fn().mockResolvedValue(mockLogs);

          // Query twice with same parameters
          const result1 = await auditService.query.queryLogs(filter);
          const result2 = await auditService.query.queryLogs(filter);

          // Results should be identical
          expect(result1).toEqual(result2);
          expect(ctx.database.get).toHaveBeenCalledTimes(2);
          
          // Verify query parameters are passed correctly
          const expectedQuery: any = {};
          if (filter.userId) expectedQuery.user_id = filter.userId;
          if (filter.serverId) expectedQuery.server_id = filter.serverId;
          if (filter.operation) expectedQuery.operation = filter.operation;

          expect(ctx.database.get).toHaveBeenCalledWith(
            'audit_logs',
            expectedQuery,
            {
              limit: filter.limit || 100,
              offset: 0
            }
          );
        }
      ), { numRuns: 50 });
    });

    it('should handle date range queries correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
        async (date1, date2) => {
          // Ensure startDate <= endDate
          const startDate = date1 <= date2 ? date1 : date2;
          const endDate = date1 <= date2 ? date2 : date1;

          ctx.database.get = jest.fn().mockResolvedValue([]);

          await auditService.query.getLogsInDateRange(startDate, endDate);

          expect(ctx.database.get).toHaveBeenCalledWith('audit_logs', {
            created_at: {
              $gte: startDate,
              $lte: endDate
            }
          }, {
            limit: 1000,
            offset: 0
          });
        }
      ), { numRuns: 50 });
    });
  });

  // ============================================================================
  // Export Format Properties
  // ============================================================================

  describe('Export format properties', () => {
    it('should produce valid JSON for all log combinations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          id: fc.integer({ min: 1 }),
          user_id: fc.option(userIdArbitrary, { nil: null }),
          server_id: fc.option(serverIdArbitrary, { nil: null }),
          operation: operationArbitrary,
          operation_data: fc.jsonValue().map(v => JSON.stringify(v)),
          result: resultArbitrary,
          error_message: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
          ip_address: fc.option(ipAddressArbitrary, { nil: null }),
          user_agent: fc.option(userAgentArbitrary, { nil: null }),
          created_at: fc.date()
        }), { maxLength: 10 }),
        async (mockDbLogs) => {
          ctx.database.get = jest.fn().mockResolvedValue(mockDbLogs);

          const jsonExport = await auditService.export.exportLogs({ format: 'json' });

          // Should produce valid JSON
          expect(() => JSON.parse(jsonExport)).not.toThrow();
          
          const parsed = JSON.parse(jsonExport);
          expect(parsed).toHaveProperty('metadata');
          expect(parsed).toHaveProperty('logs');
          expect(parsed.logs).toHaveLength(mockDbLogs.length);
          
          // Verify each log entry
          parsed.logs.forEach((log: any, index: number) => {
            const originalLog = mockDbLogs[index];
            expect(log.id).toBe(originalLog.id);
            expect(log.operation).toBe(originalLog.operation);
            expect(log.result).toBe(originalLog.result);
          });
        }
      ), { numRuns: 30 });
    });

    it('should produce valid CSV for all log combinations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          id: fc.integer({ min: 1 }),
          user_id: fc.option(userIdArbitrary.filter(s => !s.includes(',') && !s.includes('"')), { nil: null }),
          server_id: fc.option(serverIdArbitrary.filter(s => !s.includes(',') && !s.includes('"')), { nil: null }),
          operation: operationArbitrary.filter(s => !s.includes('"') && !s.includes(',')), // Avoid quotes and commas in operation names for CSV
          operation_data: fc.record({ test: fc.string({ maxLength: 50 }).filter(s => !s.includes('"') && !s.includes(',')) }).map(v => JSON.stringify(v)),
          result: resultArbitrary,
          error_message: fc.option(fc.string({ maxLength: 100 }).filter(s => !s.includes('"') && !s.includes(',')), { nil: null }),
          ip_address: fc.option(ipAddressArbitrary, { nil: null }),
          user_agent: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('"') && !s.includes(',')), { nil: null }),
          created_at: fc.date()
        }), { maxLength: 5 }),
        async (mockDbLogs) => {
          ctx.database.get = jest.fn().mockResolvedValue(mockDbLogs);

          const csvExport = await auditService.export.exportLogs({ 
            format: 'csv',
            includeHeaders: true 
          });

          const lines = csvExport.split('\n').filter(line => line.trim());
          
          // Should have header + data lines
          expect(lines.length).toBe(mockDbLogs.length + 1);
          
          // First line should be headers
          expect(lines[0]).toContain('ID,User ID,Server ID,Operation');
          
          // Each data line should have correct number of fields
          for (let i = 1; i < lines.length; i++) {
            const fields = lines[i].split(',');
            expect(fields.length).toBe(10); // Number of columns
          }
        }
      ), { numRuns: 20 });
    });

    it('should produce valid XML for all log combinations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          id: fc.integer({ min: 1 }),
          user_id: fc.option(userIdArbitrary, { nil: null }),
          server_id: fc.option(serverIdArbitrary, { nil: null }),
          operation: operationArbitrary.filter(s => !/[<>&"']/.test(s)), // XML-safe operation names
          operation_data: fc.record({ test: fc.string({ maxLength: 50 }).filter(s => !/[<>&"']/.test(s)) }).map(v => JSON.stringify(v)),
          result: resultArbitrary,
          error_message: fc.option(fc.string({ maxLength: 100 }).filter(s => !/[<>&"']/.test(s)), { nil: null }),
          ip_address: fc.option(ipAddressArbitrary, { nil: null }),
          user_agent: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[<>&"']/.test(s)), { nil: null }),
          created_at: fc.date()
        }), { maxLength: 5 }),
        async (mockDbLogs) => {
          ctx.database.get = jest.fn().mockResolvedValue(mockDbLogs);

          const xmlExport = await auditService.export.exportLogs({ format: 'xml' });

          // Should be valid XML structure
          expect(xmlExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
          expect(xmlExport).toContain('<audit_logs>');
          expect(xmlExport).toContain('</audit_logs>');
          
          // Should contain correct number of log entries
          const logMatches = xmlExport.match(/<log id="\d+">/g);
          expect(logMatches?.length || 0).toBe(mockDbLogs.length);
        }
      ), { numRuns: 20 });
    });
  });

  // ============================================================================
  // Error Handling Properties
  // ============================================================================

  describe('Error handling properties', () => {
    it('should handle database errors gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        operationArbitrary,
        operationDataArbitrary,
        auditContextArbitrary,
        async (operation, operationData, context) => {
          // Mock database error
          ctx.database.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

          // Operation should throw error but not crash
          await expect(auditLogger.logSuccess(operation, operationData, context))
            .rejects.toThrow('Database connection failed');
        }
      ), { numRuns: 30 });
    });

    it('should handle malformed operation data gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        operationArbitrary,
        fc.anything(), // Any possible operation data
        auditContextArbitrary,
        async (operation, operationData, context) => {
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

          // Should not throw error even with malformed data
          const result = await auditLogger.logSuccess(operation, operationData, context);
          
          expect(result.operation).toBe(operation);
          expect(result.result).toBe('success');
          
          // Verify data can be serialized/deserialized
          expect(() => JSON.stringify(operationData)).not.toThrow();
        }
      ), { numRuns: 50 });
    });
  });
});