/**
 * Mochi-Link (大福连) - Token Management Unit Tests
 * 
 * Unit tests for the token management system
 */

import { Context } from 'koishi';
import { TokenManager } from '../../src/services/token';
import { EncryptionConfig } from '../../src/types';

// Mock Koishi context for testing
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

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = createMockContext();
    tokenManager = new TokenManager(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Generation', () => {
    test('should generate a secure token with default settings', async () => {
      // Mock database responses
      (mockContext.database.create as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (mockContext.database.get as jest.Mock).mockResolvedValue([{
        id: 1,
        server_id: 'test-server',
        token: '[REDACTED]',
        token_hash: 'mock-hash',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }]);

      const result = await tokenManager.generateToken(
        { serverId: 'test-server' },
        'test-user'
      );

      expect(result.token).toBeDefined();
      expect(result.rawToken).toBeDefined();
      expect(result.token.serverId).toBe('test-server');
      expect(result.rawToken).toHaveLength(128); // 64 bytes = 128 hex chars
      expect(mockContext.database.create).toHaveBeenCalled();
    });

    test('should generate token with custom expiration', async () => {
      const expiresIn = 3600; // 1 hour
      
      (mockContext.database.create as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (mockContext.database.get as jest.Mock).mockResolvedValue([{
        id: 1,
        server_id: 'test-server',
        token: '[REDACTED]',
        token_hash: 'mock-hash',
        created_at: new Date(),
        expires_at: new Date(Date.now() + expiresIn * 1000)
      }]);

      const result = await tokenManager.generateToken(
        { serverId: 'test-server', expiresIn },
        'test-user'
      );

      expect(result.token.expiresAt).toBeDefined();
      // Check that expiration is approximately 1 hour from now
      const expectedExpiry = new Date(Date.now() + expiresIn * 1000);
      const actualExpiry = result.token.expiresAt!;
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    test('should generate token with IP whitelist', async () => {
      const ipWhitelist = ['192.168.1.0/24', '10.0.0.1'];
      
      (mockContext.database.create as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (mockContext.database.get as jest.Mock).mockResolvedValue([{
        id: 1,
        server_id: 'test-server',
        token: '[REDACTED]',
        token_hash: 'mock-hash',
        ip_whitelist: JSON.stringify(ipWhitelist),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }]);

      const result = await tokenManager.generateToken(
        { serverId: 'test-server', ipWhitelist },
        'test-user'
      );

      expect(result.token.ipWhitelist).toEqual(ipWhitelist);
    });

    test('should reject invalid IP whitelist', async () => {
      const invalidIpWhitelist = ['invalid-ip', '999.999.999.999'];

      // Mock audit operations to handle the error logging
      const mockAuditLog = {
        id: 1,
        userId: 'test-user',
        serverId: 'test-server',
        operation: 'token.create',
        operationData: { error: 'Invalid IP address format: invalid-ip' },
        result: 'error' as const,
        errorMessage: 'Invalid IP address format: invalid-ip',
        createdAt: new Date()
      };

      (mockContext.database.create as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (mockContext.database.get as jest.Mock).mockResolvedValue([mockAuditLog]);

      await expect(tokenManager.generateToken(
        { serverId: 'test-server', ipWhitelist: invalidIpWhitelist },
        'test-user'
      )).rejects.toThrow('Invalid IP address format');
    });

    test('should generate multiple tokens', async () => {
      (mockContext.database.create as jest.Mock).mockImplementation(() => 
        Promise.resolve([{ id: Math.floor(Math.random() * 1000) }])
      );
      (mockContext.database.get as jest.Mock).mockImplementation(() => 
        Promise.resolve([{
          id: Math.floor(Math.random() * 1000),
          server_id: 'test-server',
          token: '[REDACTED]',
          token_hash: 'mock-hash',
          created_at: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }])
      );

      const results = await tokenManager.generateMultipleTokens(
        'test-server',
        3,
        {},
        'test-user'
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.token.serverId === 'test-server')).toBe(true);
      expect(results.every(r => r.rawToken.length === 128)).toBe(true);
    });

    test('should reject invalid token count for batch generation', async () => {
      await expect(tokenManager.generateMultipleTokens(
        'test-server',
        0,
        {},
        'test-user'
      )).rejects.toThrow('Token count must be between 1 and 10');

      await expect(tokenManager.generateMultipleTokens(
        'test-server',
        15,
        {},
        'test-user'
      )).rejects.toThrow('Token count must be between 1 and 10');
    });
  });

  describe('Token Validation', () => {
    test('should validate a valid token', async () => {
      const mockToken = {
        id: 1,
        serverId: 'test-server',
        token: 'raw-token',
        tokenHash: 'token-hash',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      // Mock token lookup
      (mockContext.database.get as jest.Mock).mockResolvedValue([{
        id: 1,
        server_id: 'test-server',
        token: 'raw-token',
        token_hash: 'token-hash',
        created_at: mockToken.createdAt,
        expires_at: mockToken.expiresAt
      }]);

      const result = await tokenManager.validateToken('raw-token');

      expect(result.valid).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token!.serverId).toBe('test-server');
    });

    test('should reject expired token', async () => {
      const expiredToken = {
        id: 1,
        server_id: 'test-server',
        token: 'raw-token',
        token_hash: 'token-hash',
        created_at: new Date(),
        expires_at: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      (mockContext.database.get as jest.Mock).mockResolvedValue([expiredToken]);

      const result = await tokenManager.validateToken('raw-token');

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.reason).toBe('Token expired');
    });

    test('should reject token with invalid IP', async () => {
      const tokenWithWhitelist = {
        id: 1,
        server_id: 'test-server',
        token: 'raw-token',
        token_hash: 'token-hash',
        ip_whitelist: JSON.stringify(['192.168.1.0/24']),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      (mockContext.database.get as jest.Mock).mockResolvedValue([tokenWithWhitelist]);

      const result = await tokenManager.validateToken('raw-token', '10.0.0.1');

      expect(result.valid).toBe(false);
      expect(result.ipAllowed).toBe(false);
      expect(result.reason).toBe('IP address not in whitelist');
    });

    test('should accept token with valid IP in whitelist', async () => {
      const tokenWithWhitelist = {
        id: 1,
        server_id: 'test-server',
        token: 'raw-token',
        token_hash: 'token-hash',
        ip_whitelist: JSON.stringify(['192.168.1.0/24']),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      (mockContext.database.get as jest.Mock).mockResolvedValue([tokenWithWhitelist]);

      const result = await tokenManager.validateToken('raw-token', '192.168.1.100');

      expect(result.valid).toBe(true);
      expect(result.ipAllowed).toBe(true);
    });

    test('should reject non-existent token', async () => {
      (mockContext.database.get as jest.Mock).mockResolvedValue([]);

      const result = await tokenManager.validateToken('non-existent-token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token not found');
    });

    test('should validate token for specific server', async () => {
      const mockToken = {
        id: 1,
        server_id: 'test-server',
        token: 'raw-token',
        token_hash: 'token-hash',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      (mockContext.database.get as jest.Mock).mockResolvedValue([mockToken]);

      const validResult = await tokenManager.validateTokenForServer('raw-token', 'test-server');
      expect(validResult.valid).toBe(true);

      const invalidResult = await tokenManager.validateTokenForServer('raw-token', 'other-server');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.reason).toBe('Token not valid for this server');
    });
  });

  describe('Token Management', () => {
    test('should revoke a token', async () => {
      const mockToken = {
        id: 1,
        server_id: 'test-server',
        token: '[REDACTED]',
        token_hash: 'token-hash',
        created_at: new Date()
      };

      (mockContext.database.get as jest.Mock).mockResolvedValue([mockToken]);
      (mockContext.database.remove as jest.Mock).mockResolvedValue({ matched: 1 });

      const result = await tokenManager.revokeToken(1, 'test-user');

      expect(result).toBe(true);
      expect(mockContext.database.remove).toHaveBeenCalledWith('api_tokens', { id: 1 });
    });

    test('should return false when revoking non-existent token', async () => {
      (mockContext.database.get as jest.Mock).mockResolvedValue([]);

      const result = await tokenManager.revokeToken(999, 'test-user');

      expect(result).toBe(false);
    });

    test('should revoke all tokens for a server', async () => {
      const mockTokens = [
        { id: 1, server_id: 'test-server' },
        { id: 2, server_id: 'test-server' },
        { id: 3, server_id: 'test-server' }
      ];

      (mockContext.database.get as jest.Mock).mockResolvedValue(mockTokens);
      (mockContext.database.remove as jest.Mock).mockResolvedValue({ matched: 1 });

      const result = await tokenManager.revokeAllServerTokens('test-server', 'test-user');

      expect(result).toBe(3);
      expect(mockContext.database.remove).toHaveBeenCalledTimes(3);
    });
  });

  describe('Encryption Configuration', () => {
    test('should generate AES-256-GCM encryption config', () => {
      const config = tokenManager.generateEncryptionConfig('AES-256-GCM');

      expect(config.algorithm).toBe('AES-256-GCM');
      expect(config.key).toBeDefined();
      expect(config.iv).toBeDefined();
      expect(config.key).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(config.iv).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    test('should generate RSA-OAEP encryption config', () => {
      const config = tokenManager.generateEncryptionConfig('RSA-OAEP');

      expect(config.algorithm).toBe('RSA-OAEP');
      expect(config.publicKey).toBeDefined();
      expect(config.privateKey).toBeDefined();
      expect(config.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(config.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    });

    test('should reject unsupported encryption algorithm', () => {
      expect(() => {
        tokenManager.generateEncryptionConfig('INVALID' as any);
      }).toThrow('Unsupported encryption algorithm: INVALID');
    });
  });

  describe('IP Whitelist Management', () => {
    test('should validate correct IP formats', () => {
      const validIps = ['192.168.1.1', '10.0.0.0/8', '172.16.0.0/12', '127.0.0.1'];
      
      // This should not throw
      expect(() => {
        (tokenManager as any).validateIpWhitelist(validIps);
      }).not.toThrow();
    });

    test('should reject invalid IP formats', () => {
      const invalidIps = ['invalid-ip', '999.999.999.999', '192.168.1.1/33'];
      
      expect(() => {
        (tokenManager as any).validateIpWhitelist(invalidIps);
      }).toThrow();
    });

    test('should match IP against CIDR pattern', () => {
      const matchIpPattern = (tokenManager as any).matchIpPattern.bind(tokenManager);
      
      // Exact match
      expect(matchIpPattern('192.168.1.1', '192.168.1.1')).toBe(true);
      expect(matchIpPattern('192.168.1.1', '192.168.1.2')).toBe(false);
      
      // CIDR match
      expect(matchIpPattern('192.168.1.100', '192.168.1.0/24')).toBe(true);
      expect(matchIpPattern('192.168.2.100', '192.168.1.0/24')).toBe(false);
    });
  });

  describe('Token Statistics', () => {
    test('should calculate token statistics', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const mockTokens = [
        { 
          id: 1, 
          created_at: now, 
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          last_used: now
        },
        { 
          id: 2, 
          created_at: yesterday, 
          expires_at: yesterday, // Expired
          last_used: null
        },
        { 
          id: 3, 
          created_at: lastMonth, 
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          last_used: yesterday
        }
      ];

      (mockContext.database.get as jest.Mock).mockResolvedValue(mockTokens);

      const stats = await tokenManager.getTokenStats();

      expect(stats.totalTokens).toBe(3);
      expect(stats.activeTokens).toBe(2); // Tokens 1 and 3
      expect(stats.expiredTokens).toBe(1); // Token 2
      expect(stats.tokensUsedToday).toBe(1); // Token 1
      expect(stats.tokensCreatedThisMonth).toBe(2); // Tokens 1 and 2 (yesterday is still this month)
    });
  });

  describe('Health Status', () => {
    test('should return healthy status when operational', async () => {
      (mockContext.database.get as jest.Mock).mockResolvedValue([]);

      const health = await tokenManager.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.details.tokenOperational).toBe(true);
    });

    test('should return unhealthy status on error', async () => {
      (mockContext.database.get as jest.Mock).mockRejectedValue(new Error('Database error'));

      const health = await tokenManager.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.details.tokenOperational).toBe(false);
    });
  });
});