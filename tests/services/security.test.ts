/**
 * Security Control Service Tests
 * 
 * Tests for API rate limiting, suspicious activity detection,
 * and communication encryption features
 */

import { SecurityControlService, SecurityConfig } from '../../src/services/security';
import { SecurityConfigManager } from '../../src/services/security-config';
import { AuditService } from '../../src/services/audit';
import { UWBPMessage } from '../../src/types';
import { Context } from 'koishi';

// Mock dependencies
jest.mock('../../src/services/audit', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    logger: {
      logError: jest.fn().mockResolvedValue(undefined)
    }
  }))
}));

describe('SecurityControlService', () => {
  let ctx: Context;
  let auditService: AuditService;
  let securityService: SecurityControlService;
  let configManager: SecurityConfigManager;

  beforeEach(() => {
    ctx = {} as Context;
    auditService = new AuditService(ctx);
    configManager = new SecurityConfigManager(ctx);
    securityService = new SecurityControlService(ctx, auditService, configManager.getConfig());
  });

  afterEach(() => {
    securityService.shutdown();
    jest.clearAllMocks();
  });

  describe('API Rate Limiting', () => {
    it('should allow requests within rate limits', async () => {
      const result = securityService.checkAPIRequest('192.168.1.1', 'user1', '/api/servers');
      
      expect(result.allowed).toBe(true);
      expect(result.securityHeaders).toBeDefined();
      expect(result.securityHeaders['X-RateLimit-Limit']).toBeDefined();
    });

    it('should block requests exceeding IP rate limits', async () => {
      const ip = '192.168.1.2';
      
      // Make requests up to the limit
      for (let i = 0; i < 200; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }
      
      // Next request should be blocked
      const result = securityService.checkAPIRequest(ip, undefined, '/api/servers');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('rate limit');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should apply endpoint-specific rate limits', async () => {
      const ip = '192.168.1.3';
      const endpoint = '/api/auth';
      
      // Make requests up to the endpoint limit (10 per minute)
      for (let i = 0; i < 10; i++) {
        securityService.checkAPIRequest(ip, undefined, endpoint);
      }
      
      // Next request should be blocked
      const result = securityService.checkAPIRequest(ip, undefined, endpoint);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Endpoint rate limit exceeded');
    });

    it('should apply user-specific rate limits', async () => {
      const userId = 'testuser';
      const ip = '192.168.1.4';
      
      // Make requests up to the user limit (100 per minute)
      for (let i = 0; i < 100; i++) {
        securityService.checkAPIRequest(ip, userId, '/api/servers');
      }
      
      // Next request should be blocked
      const result = securityService.checkAPIRequest(ip, userId, '/api/servers');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('User rate limit exceeded');
    });

    it('should handle emergency mode with stricter limits', async () => {
      const ip = '192.168.1.5';
      
      // Trigger emergency mode by simulating high request volume
      const stats = securityService.getSecurityStats();
      expect(stats.ddosProtection.emergencyMode).toBe(false);
      
      // Make many requests to trigger emergency mode
      for (let i = 0; i < 5001; i++) {
        securityService.checkAPIRequest(`192.168.1.${100 + (i % 100)}`, undefined, '/api/servers');
      }
      
      // Wait for emergency mode check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Requests should now be more restricted
      const result = securityService.checkAPIRequest(ip, undefined, '/api/servers');
      expect(result.securityHeaders['X-Emergency-Mode']).toBe('true');
    });
  });

  describe('DDoS Protection', () => {
    it('should detect and block DDoS attacks', async () => {
      const ip = '192.168.1.10';
      
      // Simulate rapid requests (more than 50 per second)
      const promises = [];
      for (let i = 0; i < 60; i++) {
        promises.push(securityService.checkAPIRequest(ip, undefined, '/api/servers'));
      }
      
      await Promise.all(promises);
      
      // Next request should be blocked
      const result = securityService.checkAPIRequest(ip, undefined, '/api/servers');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DDoS');
    });

    it('should whitelist trusted IPs', async () => {
      const trustedIp = '127.0.0.1';
      
      // Make many requests from trusted IP
      for (let i = 0; i < 100; i++) {
        const result = securityService.checkAPIRequest(trustedIp, undefined, '/api/servers');
        expect(result.allowed).toBe(true);
      }
    });

    it('should track failed requests for suspicious activity', async () => {
      const ip = '192.168.1.11';
      
      // Record multiple failed requests
      for (let i = 0; i < 25; i++) {
        securityService.recordAPIFailure(ip, undefined, '/api/auth', 'authentication_failed');
      }
      
      // Next request should be blocked due to excessive failures
      const result = securityService.checkAPIRequest(ip, undefined, '/api/auth');
      
      expect(result.allowed).toBe(false);
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect rapid fire requests', async () => {
      const ip = '192.168.1.20';
      const userId = 'suspicioususer';
      
      // Make rapid requests within the threshold window
      for (let i = 0; i < 101; i++) {
        securityService.recordAPISuccess(ip, userId, '/api/servers');
      }
      
      // Next request should trigger suspicious activity detection
      const result = securityService.checkAPIRequest(ip, userId, '/api/servers');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('suspicious activity');
    });

    it('should detect unusual endpoint access patterns', async () => {
      const ip = '192.168.1.21';
      const userId = 'newuser';
      const sensitiveEndpoint = '/api/servers/test/commands';
      
      // First access to sensitive endpoint should be flagged
      const result = securityService.checkAPIRequest(ip, userId, sensitiveEndpoint);
      
      // Should still be allowed but flagged
      expect(result.allowed).toBe(true);
      
      // Check that threat was created
      const threats = securityService.getAllSecurityThreats();
      const endpointThreat = threats.find(t => 
        t.type === 'suspicious_activity' && 
        t.details.description.includes('sensitive endpoint')
      );
      expect(endpointThreat).toBeDefined();
    });

    it('should calculate risk scores for user profiles', async () => {
      const ip = '192.168.1.22';
      const userId = 'riskuser';
      
      // Build up activity profile
      for (let i = 0; i < 50; i++) {
        securityService.recordAPISuccess(ip, userId, `/api/endpoint${i % 10}`);
      }
      
      // Add some flags
      securityService.recordAPIFailure(ip, userId, '/api/auth', 'authentication_failed');
      securityService.recordAPIFailure(ip, userId, '/api/auth', 'authentication_failed');
      
      // Check if high risk score triggers threat detection
      const stats = securityService.getSecurityStats();
      expect(stats.threats.total).toBeGreaterThan(0);
    });
  });

  describe('Communication Encryption', () => {
    it('should generate encryption keys for servers', async () => {
      const serverId = 'test-server-1';
      
      const encryptionConfig = await securityService.generateEncryptionKey(serverId);
      
      expect(encryptionConfig).toBeDefined();
      expect(encryptionConfig.algorithm).toBe('AES-256-GCM');
      expect(encryptionConfig.key).toBeDefined();
      expect(encryptionConfig.iv).toBeDefined();
    });

    it('should encrypt and decrypt messages', async () => {
      const serverId = 'test-server-2';
      const message: UWBPMessage = {
        type: 'request',
        id: 'test-123',
        op: 'player.list',
        data: { serverId }
      };
      
      // Generate encryption key
      await securityService.generateEncryptionKey(serverId);
      
      // Encrypt message
      const encrypted = await securityService.encryptMessage(message, serverId);
      
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.keyId).toBeDefined();
      
      // Decrypt message
      const decrypted = await securityService.decryptMessage(
        encrypted.encrypted,
        serverId,
        encrypted.algorithm
      );
      
      expect(decrypted).toEqual(message);
    });

    it('should rotate encryption keys', async () => {
      const serverId = 'test-server-3';
      
      // Generate initial key
      const initialConfig = await securityService.generateEncryptionKey(serverId);
      
      // Rotate key
      const rotatedConfig = await securityService.rotateEncryptionKey(serverId);
      
      expect(rotatedConfig.key).not.toBe(initialConfig.key);
      expect(rotatedConfig.algorithm).toBe(initialConfig.algorithm);
    });

    it('should handle encryption failures gracefully', async () => {
      const serverId = 'nonexistent-server';
      const message: UWBPMessage = {
        type: 'request',
        id: 'test-456',
        op: 'player.list',
        data: { serverId }
      };
      
      // Try to encrypt without generating key first
      await expect(securityService.encryptMessage(message, serverId))
        .rejects.toThrow('No encryption key found');
    });
  });

  describe('Security Event Management', () => {
    it('should create and manage security threats', async () => {
      const ip = '192.168.1.30';
      
      // Trigger a security threat
      for (let i = 0; i < 60; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }
      
      const threats = securityService.getAllSecurityThreats();
      expect(threats.length).toBeGreaterThan(0);
      
      const ddosThreat = threats.find(t => t.type === 'ddos_attack');
      if (ddosThreat) {
        expect(ddosThreat.severity).toBe('critical');
        expect(ddosThreat.source.ip).toBe(ip);
        expect(ddosThreat.actions.length).toBeGreaterThan(0);
      }
    });

    it('should execute automatic security actions', async () => {
      const ip = '192.168.1.31';
      let blockEventReceived = false;
      
      // Listen for security events
      securityService.on('securityThreat', (threat) => {
        if (threat.type === 'ddos_attack') {
          blockEventReceived = true;
        }
      });
      
      // Trigger DDoS protection
      for (let i = 0; i < 60; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }
      
      expect(blockEventReceived).toBe(true);
    });

    it('should generate security reports', async () => {
      // Generate some activity
      for (let i = 0; i < 10; i++) {
        securityService.checkAPIRequest(`192.168.1.${40 + i}`, `user${i}`, '/api/servers');
      }
      
      const stats = securityService.getSecurityStats();
      
      expect(stats.rateLimiting).toBeDefined();
      expect(stats.ddosProtection).toBeDefined();
      expect(stats.threats).toBeDefined();
      expect(stats.encryption).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should update security configuration', () => {
      const newConfig: Partial<SecurityConfig> = {
        rateLimiting: {
          enabled: false,
          globalLimits: {
            requestsPerMinute: 1000,
            requestsPerHour: 10000,
            requestsPerDay: 100000
          },
          endpointLimits: {},
          userLimits: {
            requestsPerMinute: 100,
            requestsPerHour: 1000
          },
          ipLimits: {
            requestsPerMinute: 200,
            requestsPerHour: 2000,
            maxConcurrentConnections: 10
          }
        }
      };
      
      securityService.updateConfig(newConfig);
      
      // Verify configuration was updated
      const result = securityService.checkAPIRequest('192.168.1.50', undefined, '/api/servers');
      expect(result.allowed).toBe(true); // Should be allowed since rate limiting is disabled
    });

    it('should validate configuration changes', () => {
      const configManager = new SecurityConfigManager(ctx);
      
      expect(() => {
        configManager.updateConfig({
          rateLimiting: {
            enabled: true,
            globalLimits: {
              requestsPerMinute: -1, // Invalid negative value
              requestsPerHour: 1000,
              requestsPerDay: 10000
            }
          }
        } as any);
      }).toThrow('Global rate limit must be positive');
    });

    it('should provide environment-specific configurations', () => {
      const configManager = new SecurityConfigManager(ctx);
      
      const devConfig = configManager.getEnvironmentConfig('development');
      expect(devConfig.rateLimiting?.enabled).toBe(false);
      
      const prodConfig = configManager.getEnvironmentConfig('production');
      expect(prodConfig.rateLimiting?.enabled).toBe(true);
      
      const testConfig = configManager.getEnvironmentConfig('testing');
      expect(testConfig.rateLimiting?.enabled).toBe(true);
      expect(testConfig.rateLimiting?.globalLimits?.requestsPerMinute).toBeGreaterThan(1000);
    });
  });
});