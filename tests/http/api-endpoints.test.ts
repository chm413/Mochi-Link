/**
 * HTTP API Endpoints Test
 * 
 * Tests for the command execution and monitoring API endpoints
 * implemented in task 13.2.
 */

import { Context } from 'koishi';
import { HTTPServer } from '../../src/http/server';
// import { APIRouter } from '../../src/http/router';
const { APIRouter } = require('../../temp/router.js');
import { PluginConfig } from '../../src/types';

describe('HTTP API Endpoints - Task 13.2', () => {
  let ctx: Context;
  let httpServer: HTTPServer;
  let mockServiceManager: any;

  beforeEach(() => {
    ctx = new Context();
    
    // Mock service manager
    mockServiceManager = {
      commandService: {
        executeCommand: jest.fn().mockResolvedValue({
          success: true,
          output: ['Command executed successfully'],
          executionTime: 100,
          error: null
        }),
        executeQuickAction: jest.fn().mockResolvedValue({
          success: true,
          result: 'Action completed'
        }),
        executeBatchOperation: jest.fn().mockResolvedValue({
          totalServers: 2,
          successCount: 2,
          failureCount: 0,
          results: [
            { serverId: 'server1', success: true, result: { success: true } },
            { serverId: 'server2', success: true, result: { success: true } }
          ],
          duration: 500
        })
      },
      monitoringService: {
        getHistoricalData: jest.fn().mockResolvedValue({
          serverId: 'test-server',
          timeRange: { start: new Date(), end: new Date() },
          interval: 5,
          metrics: [
            {
              timestamp: Date.now(),
              tps: 19.5,
              playerCount: 5,
              memoryUsage: 75.0,
              cpuUsage: 45.0,
              ping: 50
            }
          ]
        }),
        getActiveAlerts: jest.fn().mockReturnValue([
          {
            id: 'alert-1',
            serverId: 'test-server',
            type: 'alert.tpsLow',
            severity: 'high',
            message: 'Low TPS detected',
            timestamp: Date.now(),
            acknowledged: false
          }
        ]),
        acknowledgeAlert: jest.fn().mockResolvedValue(undefined),
        getServerPerformanceSummary: jest.fn().mockResolvedValue({
          currentStatus: null,
          averageMetrics: {
            tps: 19.0,
            memoryUsage: 70.0,
            cpuUsage: 40.0,
            playerCount: 8
          },
          alertCount: 1,
          uptimePercentage: 98.5
        })
      },
      serverManager: {
        getServerStatus: jest.fn().mockReturnValue({
          serverId: 'test-server',
          status: 'online',
          uptime: 86400000,
          playerCount: 5,
          tps: 19.8,
          memoryUsage: { used: 3000, max: 4096, percentage: 73.2 },
          cpuUsage: 42.0,
          ping: 45,
          lastSeen: new Date()
        })
      },
      permissionManager: {
        checkPermission: jest.fn().mockResolvedValue({ granted: true })
      },
      auditService: {
        getLogs: jest.fn().mockResolvedValue({
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
        })
      }
    };

    const config: PluginConfig['http'] = {
      host: 'localhost',
      port: 3001,
      cors: true
    };

    httpServer = new HTTPServer(ctx, config, mockServiceManager);
  });

  afterEach(async () => {
    if (httpServer.isListening()) {
      await httpServer.stop();
    }
  });

  describe('Command Execution API', () => {
    it('should create router with command execution endpoints', () => {
      const router = new APIRouter(ctx, mockServiceManager);
      expect(router).toBeDefined();
    });

    it('should handle command execution request structure', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'POST',
        path: '/api/servers/test-server/commands',
        query: {},
        body: {
          command: 'say Hello World',
          timeout: 5000
        },
        headers: { 'content-type': 'application/json' },
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: ['commands.execute'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-1',
          timestamp: Date.now()
        }
      };

      const response = await router.executeCommand(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.success).toBe(true);
      expect(mockServiceManager.commandService.executeCommand).toHaveBeenCalledWith(
        'test-server',
        'say Hello World',
        'test-user',
        expect.objectContaining({
          timeout: 5000,
          requirePermission: true,
          auditLog: true
        })
      );
    });

    it('should handle quick action execution', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'POST',
        path: '/api/servers/test-server/actions',
        query: {},
        body: {
          action: 'kick',
          parameters: {
            player: 'TestPlayer',
            reason: 'Test kick'
          }
        },
        headers: { 'content-type': 'application/json' },
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: ['commands.quick-action'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-2',
          timestamp: Date.now()
        }
      };

      const response = await router.executeQuickAction(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(mockServiceManager.commandService.executeQuickAction).toHaveBeenCalledWith(
        'test-server',
        expect.objectContaining({
          action: 'kick',
          parameters: {
            player: 'TestPlayer',
            reason: 'Test kick'
          }
        }),
        'test-user'
      );
    });

    it('should handle batch command execution', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'POST',
        path: '/api/batch/commands',
        query: {},
        body: {
          serverIds: ['server1', 'server2'],
          command: 'save-all',
          timeout: 10000
        },
        headers: { 'content-type': 'application/json' },
        context: {
          userId: 'test-user',
          permissions: ['batch.commands'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-3',
          timestamp: Date.now()
        }
      };

      const response = await router.executeBatchCommands(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.totalServers).toBe(2);
      expect(response.data.successCount).toBe(2);
      expect(mockServiceManager.commandService.executeBatchOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          serverIds: ['server1', 'server2'],
          operation: 'command',
          payload: { command: 'save-all' }
        }),
        'test-user'
      );
    });
  });

  describe('Monitoring API', () => {
    it('should handle performance history requests', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'GET',
        path: '/api/servers/test-server/performance',
        query: {
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString(),
          interval: '5m',
          metrics: ['tps', 'memory', 'cpu']
        },
        body: {},
        headers: {},
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: ['servers.performance'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-4',
          timestamp: Date.now()
        }
      };

      const response = await router.getPerformanceHistory(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      expect(mockServiceManager.monitoringService.getHistoricalData).toHaveBeenCalledWith(
        'test-server',
        expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date)
        }),
        5
      );
    });

    it('should handle alerts retrieval', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'GET',
        path: '/api/servers/test-server/alerts',
        query: {
          page: '1',
          limit: '20',
          acknowledged: 'false',
          severity: 'high'
        },
        body: {},
        headers: {},
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: ['servers.alerts'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-5',
          timestamp: Date.now()
        }
      };

      const response = await router.getAlerts(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.pagination).toBeDefined();
      expect(mockServiceManager.monitoringService.getActiveAlerts).toHaveBeenCalledWith('test-server');
    });

    it('should handle current metrics requests', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'GET',
        path: '/api/servers/test-server/metrics/current',
        query: {},
        body: {},
        headers: {},
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: ['servers.metrics'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-6',
          timestamp: Date.now()
        }
      };

      const response = await router.getCurrentMetrics(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.serverId).toBe('test-server');
      expect(response.data.tps).toBeDefined();
      expect(response.data.playerCount).toBeDefined();
      expect(mockServiceManager.serverManager.getServerStatus).toHaveBeenCalledWith('test-server');
    });

    it('should handle metrics summary requests', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'GET',
        path: '/api/servers/test-server/metrics/summary',
        query: {},
        body: {},
        headers: {},
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: ['servers.metrics'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-7',
          timestamp: Date.now()
        }
      };

      const response = await router.getMetricsSummary(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.averageMetrics).toBeDefined();
      expect(response.data.alertCount).toBeDefined();
      expect(response.data.uptimePercentage).toBeDefined();
      expect(mockServiceManager.monitoringService.getServerPerformanceSummary).toHaveBeenCalledWith('test-server');
    });

    it('should handle alert acknowledgment', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'POST',
        path: '/api/servers/test-server/alerts/alert-1/acknowledge',
        query: {},
        body: {},
        headers: {},
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          alertId: 'alert-1',
          permissions: ['servers.alerts.acknowledge'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-8',
          timestamp: Date.now()
        }
      };

      const response = await router.acknowledgeAlert(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.acknowledged).toBe(true);
      expect(mockServiceManager.monitoringService.acknowledgeAlert).toHaveBeenCalledWith('alert-1', 'test-user');
    });
  });

  describe('Audit Log API', () => {
    it('should handle audit log queries', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'GET',
        path: '/api/audit',
        query: {
          userId: 'test-user',
          serverId: 'test-server',
          operation: 'command.execute',
          page: '1',
          limit: '20'
        },
        body: {},
        headers: {},
        context: {
          userId: 'test-user',
          permissions: ['audit.read'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-9',
          timestamp: Date.now()
        }
      };

      const response = await router.getAuditLogs(mockRequest);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.pagination).toBeDefined();
      expect(mockServiceManager.auditService.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          serverId: 'test-server',
          operation: 'command.execute'
        }),
        expect.objectContaining({
          page: 1,
          limit: 20
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing server ID in command execution', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'POST',
        path: '/api/servers//commands',
        query: {},
        body: { command: 'test' },
        headers: {},
        context: {
          userId: 'test-user',
          permissions: ['commands.execute'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-10',
          timestamp: Date.now()
        }
      };

      const response = await router.executeCommand(mockRequest);
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('INVALID_REQUEST');
      expect(response.message).toBe('Server ID is required');
    });

    it('should handle missing command in command execution', async () => {
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'POST',
        path: '/api/servers/test-server/commands',
        query: {},
        body: {},
        headers: {},
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: ['commands.execute'],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-11',
          timestamp: Date.now()
        }
      };

      const response = await router.executeCommand(mockRequest);
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Command is required');
    });

    it('should handle permission errors', async () => {
      mockServiceManager.permissionManager.checkPermission.mockResolvedValue({ granted: false });
      
      const router = new APIRouter(ctx, mockServiceManager);
      
      const mockRequest = {
        method: 'POST',
        path: '/api/servers/test-server/commands',
        query: {},
        body: { command: 'test' },
        headers: {},
        context: {
          userId: 'test-user',
          serverId: 'test-server',
          permissions: [],
          ipAddress: '127.0.0.1',
          requestId: 'test-request-12',
          timestamp: Date.now()
        }
      };

      const response = await router.executeCommand(mockRequest);
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('SERVER_ERROR');
    });
  });
});