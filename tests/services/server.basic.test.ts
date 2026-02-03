/**
 * Mochi-Link (大福连) - Server Management Service Basic Tests
 * 
 * This file contains basic unit tests for the server configuration management
 * functionality to verify core operations work correctly.
 */

import { ServerManager } from '../../src/services/server';
import { 
  ServerConfig, 
  ConnectionMode, 
  CoreType, 
  ServerStatus
} from '../../src/types';

describe('ServerManager Basic Tests', () => {
  let serverManager: any;

  beforeEach(() => {
    // Create a minimal mock context
    const mockCtx = {
      logger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      })),
      emit: jest.fn()
    };

    // Create minimal mock services
    const mockDb = {
      servers: {
        createServer: jest.fn(),
        getServer: jest.fn(),
        getAllServers: jest.fn(),
        getServersByOwner: jest.fn(),
        updateServer: jest.fn(),
        updateServerStatus: jest.fn(),
        deleteServer: jest.fn(),
        serverExists: jest.fn()
      },
      acl: {
        getUserACLs: jest.fn()
      },
      healthCheck: jest.fn()
    };

    const mockAudit = {
      logServerOperation: jest.fn().mockResolvedValue({}),
      logError: jest.fn().mockResolvedValue({})
    };

    const mockPermission = {
      assignRole: jest.fn().mockResolvedValue({}),
      checkPermission: jest.fn().mockResolvedValue({ granted: true, reason: 'owner' })
    };

    const mockToken = {
      generateToken: jest.fn().mockResolvedValue({})
    };

    // Create server manager instance
    serverManager = new ServerManager(mockCtx as any, mockDb as any, mockAudit as any, mockPermission as any, mockToken as any);
  });

  describe('Utility Methods', () => {
    it('should generate unique server IDs', () => {
      // Act
      const id1 = serverManager.generateServerId('Test Server', 'Java');
      const id2 = serverManager.generateServerId('Test Server', 'Java');

      // Assert
      expect(id1).toMatch(/^java-test-server-[a-z0-9]+-[a-z0-9]+$/);
      expect(id2).toMatch(/^java-test-server-[a-z0-9]+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2); // Should be unique
    });

    it('should generate different IDs for different core types', () => {
      // Act
      const javaId = serverManager.generateServerId('Test Server', 'Java');
      const bedrockId = serverManager.generateServerId('Test Server', 'Bedrock');

      // Assert
      expect(javaId.startsWith('java-')).toBe(true);
      expect(bedrockId.startsWith('bedrock-')).toBe(true);
      expect(javaId).not.toBe(bedrockId);
    });

    it('should sanitize server names in IDs', () => {
      // Act
      const id = serverManager.generateServerId('My Awesome Server!@#$', 'Java');

      // Assert
      expect(id).toMatch(/^java-my-awesome-server-[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('Connection Configuration Validation', () => {
    it('should validate plugin connection config', () => {
      const validConfig = {
        plugin: {
          host: '127.0.0.1',
          port: 8080,
          ssl: false
        }
      };

      // Should not throw
      expect(() => {
        serverManager.validateConnectionConfig('plugin', validConfig);
      }).not.toThrow();
    });

    it('should validate RCON connection config', () => {
      const validConfig = {
        rcon: {
          host: '127.0.0.1',
          port: 25575,
          password: 'secret123'
        }
      };

      // Should not throw
      expect(() => {
        serverManager.validateConnectionConfig('rcon', validConfig);
      }).not.toThrow();
    });

    it('should validate terminal connection config', () => {
      const validConfig = {
        terminal: {
          processId: 12345,
          workingDir: '/opt/minecraft',
          command: 'java -jar server.jar'
        }
      };

      // Should not throw
      expect(() => {
        serverManager.validateConnectionConfig('terminal', validConfig);
      }).not.toThrow();
    });

    it('should reject invalid plugin config', () => {
      const invalidConfig = {
        plugin: {
          host: '127.0.0.1'
          // Missing port
        }
      };

      expect(() => {
        serverManager.validateConnectionConfig('plugin', invalidConfig);
      }).toThrow();
    });

    it('should reject empty config', () => {
      expect(() => {
        serverManager.validateConnectionConfig('plugin', {});
      }).toThrow();
    });
  });

  describe('IP Extraction', () => {
    it('should extract non-localhost IPs', () => {
      const config = {
        plugin: {
          host: '192.168.1.100',
          port: 8080,
          ssl: false
        }
      };

      const ips = serverManager.extractIPFromConnectionConfig(config);
      expect(ips).toEqual(['192.168.1.100']);
    });

    it('should not extract localhost IPs', () => {
      const config = {
        plugin: {
          host: 'localhost',
          port: 8080,
          ssl: false
        }
      };

      const ips = serverManager.extractIPFromConnectionConfig(config);
      expect(ips).toBeUndefined();
    });

    it('should not extract 127.0.0.1', () => {
      const config = {
        plugin: {
          host: '127.0.0.1',
          port: 8080,
          ssl: false
        }
      };

      const ips = serverManager.extractIPFromConnectionConfig(config);
      expect(ips).toBeUndefined();
    });

    it('should extract multiple IPs from different connection types', () => {
      const config = {
        plugin: {
          host: '192.168.1.100',
          port: 8080,
          ssl: false
        },
        rcon: {
          host: '10.0.0.50',
          port: 25575,
          password: 'secret'
        }
      };

      const ips = serverManager.extractIPFromConnectionConfig(config);
      expect(ips).toEqual(['192.168.1.100', '10.0.0.50']);
    });
  });

  describe('Status Management', () => {
    it('should track server status', async () => {
      const serverId = 'test-server-123';
      
      // Initially no status
      expect(serverManager.getServerStatus(serverId)).toBeNull();
      
      // Update status
      await serverManager.updateServerStatus(serverId, 'online', {
        playerCount: 5,
        tps: 20.0
      });
      
      // Should have status now
      const status = serverManager.getServerStatus(serverId);
      expect(status).toBeDefined();
      expect(status.serverId).toBe(serverId);
      expect(status.status).toBe('online');
      expect(status.playerCount).toBe(5);
      expect(status.tps).toBe(20.0);
    });

    it('should check online status correctly', async () => {
      const serverId = 'test-server-123';
      
      // Initially offline
      expect(serverManager.isServerOnline(serverId)).toBe(false);
      
      // Set to online
      await serverManager.updateServerStatus(serverId, 'online');
      expect(serverManager.isServerOnline(serverId)).toBe(true);
      
      // Set to offline
      await serverManager.updateServerStatus(serverId, 'offline');
      expect(serverManager.isServerOnline(serverId)).toBe(false);
    });

    it('should count online servers correctly', async () => {
      // Add some servers
      await serverManager.updateServerStatus('server1', 'online');
      await serverManager.updateServerStatus('server2', 'offline');
      await serverManager.updateServerStatus('server3', 'online');
      await serverManager.updateServerStatus('server4', 'error');
      
      expect(serverManager.getOnlineServersCount()).toBe(2);
    });

    it('should calculate system health correctly', async () => {
      // Add servers with different statuses
      await serverManager.updateServerStatus('server1', 'online');
      await serverManager.updateServerStatus('server2', 'online');
      await serverManager.updateServerStatus('server3', 'offline');
      await serverManager.updateServerStatus('server4', 'error');
      
      const health = await serverManager.getSystemHealth();
      
      expect(health.totalServers).toBe(4);
      expect(health.onlineServers).toBe(2);
      expect(health.offlineServers).toBe(1);
      expect(health.errorServers).toBe(1);
      expect(health.status).toBe('degraded'); // Has error servers
    });
  });

  describe('Multi-Server Operations', () => {
    it('should execute operations on multiple servers', async () => {
      const serverIds = ['server1', 'server2', 'server3'];
      const mockOperation = jest.fn().mockImplementation(async (serverId: string) => {
        return `result-${serverId}`;
      });

      const results = await serverManager.executeOnMultipleServers(
        serverIds,
        mockOperation,
        { maxConcurrency: 2 }
      );

      expect(results.size).toBe(3);
      expect(mockOperation).toHaveBeenCalledTimes(3);
      
      for (const serverId of serverIds) {
        expect(results.has(serverId)).toBe(true);
        const result = results.get(serverId);
        expect(result.success).toBe(true);
        expect(result.result).toBe(`result-${serverId}`);
      }
    });

    it('should handle operation failures', async () => {
      const serverIds = ['server1', 'server2'];
      const mockOperation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Operation failed'));

      const results = await serverManager.executeOnMultipleServers(
        serverIds,
        mockOperation,
        { continueOnError: true }
      );

      expect(results.size).toBe(2);
      expect(results.get('server1').success).toBe(true);
      expect(results.get('server2').success).toBe(false);
      expect(results.get('server2').error).toBeInstanceOf(Error);
    });
  });

  describe('Service Health', () => {
    it('should return health status', async () => {
      // Mock database health check
      serverManager.db = {
        healthCheck: jest.fn().mockResolvedValue(true)
      };

      const health = await serverManager.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.details.database).toBe(true);
    });

    it('should handle health check errors', async () => {
      // Mock database health check failure
      serverManager.db = {
        healthCheck: jest.fn().mockRejectedValue(new Error('DB connection failed'))
      };

      const health = await serverManager.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      // Mock the connection manager cleanup
      const mockConnectionManager = {
        cleanup: jest.fn().mockResolvedValue(undefined)
      };
      
      // Replace the connection manager
      (serverManager as any).connectionManager = mockConnectionManager;

      await serverManager.cleanup();

      expect(mockConnectionManager.cleanup).toHaveBeenCalled();
    });
  });
});