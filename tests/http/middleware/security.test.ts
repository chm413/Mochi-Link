/**
 * Security Middleware Tests
 * 
 * Tests for the HTTP security middleware integration
 */

import { ServerResponse } from 'http';
import { Context } from 'koishi';
import { SecurityMiddleware } from '../../../src/http/middleware/security';
import { SecurityControlService } from '../../../src/services/security';
import { SecurityConfigManager } from '../../../src/services/security-config';
import { AuditService } from '../../../src/services/audit';
import { HTTPRequest } from '../../../src/http/types';

// Mock dependencies
jest.mock('../../../src/services/audit');

describe('SecurityMiddleware', () => {
  let ctx: Context;
  let auditService: AuditService;
  let securityService: SecurityControlService;
  let securityMiddleware: SecurityMiddleware;
  let mockResponse: ServerResponse;

  beforeEach(() => {
    ctx = {} as Context;
    auditService = new AuditService(ctx);
    
    const configManager = new SecurityConfigManager(ctx);
    securityService = new SecurityControlService(ctx, auditService, configManager.getConfig());
    securityMiddleware = new SecurityMiddleware(securityService, auditService);

    // Mock ServerResponse
    mockResponse = {
      setHeader: jest.fn(),
      statusCode: 200,
      end: jest.fn()
    } as any;
  });

  afterEach(() => {
    securityService.shutdown();
    jest.clearAllMocks();
  });

  describe('Request Security Checks', () => {
    it('should allow valid requests and add security headers', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-123',
          ipAddress: '192.168.1.1',
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      const result = await securityMiddleware.handle(request, mockResponse);

      expect(result.continue).toBe(true);
      expect(result.context?.securityCheckTime).toBeDefined();
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        expect.stringMatching(/X-/),
        expect.any(String)
      );
    });

    it('should block requests exceeding rate limits', async () => {
      const ip = '192.168.1.2';
      
      // First, exhaust the rate limit
      for (let i = 0; i < 200; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-124',
          ipAddress: ip,
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      const result = await securityMiddleware.handle(request, mockResponse);

      expect(result.continue).toBe(false);
      expect(mockResponse.statusCode).toBe(429);
      expect(mockResponse.end).toHaveBeenCalledWith(
        expect.stringContaining('RATE_LIMIT_EXCEEDED')
      );
    });

    it('should block suspicious activity', async () => {
      const ip = '192.168.1.3';
      const userId = 'suspicioususer';
      
      // Build up suspicious activity
      for (let i = 0; i < 101; i++) {
        securityService.recordAPISuccess(ip, userId, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-125',
          ipAddress: ip,
          userId,
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      const result = await securityMiddleware.handle(request, mockResponse);

      expect(result.continue).toBe(false);
      expect(mockResponse.statusCode).toBe(403);
      expect(mockResponse.end).toHaveBeenCalledWith(
        expect.stringContaining('SUSPICIOUS_ACTIVITY_DETECTED')
      );
    });

    it('should handle DDoS attacks', async () => {
      const ip = '192.168.1.4';
      
      // Trigger DDoS protection
      for (let i = 0; i < 60; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-126',
          ipAddress: ip,
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      const result = await securityMiddleware.handle(request, mockResponse);

      expect(result.continue).toBe(false);
      expect(mockResponse.statusCode).toBe(503);
      expect(mockResponse.end).toHaveBeenCalledWith(
        expect.stringContaining('SERVICE_TEMPORARILY_UNAVAILABLE')
      );
    });
  });

  describe('Security Headers', () => {
    it('should add comprehensive security headers', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-127',
          ipAddress: '192.168.1.5',
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      await securityMiddleware.handle(request, mockResponse);

      // Verify security headers are set
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'"
      );
    });

    it('should add rate limit headers', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-128',
          ipAddress: '192.168.1.6',
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      await securityMiddleware.handle(request, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        expect.any(String)
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.any(String)
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should indicate emergency mode in headers', async () => {
      // Trigger emergency mode
      for (let i = 0; i < 5001; i++) {
        securityService.checkAPIRequest(`192.168.1.${100 + (i % 100)}`, undefined, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-129',
          ipAddress: '192.168.1.7',
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      await securityMiddleware.handle(request, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Emergency-Mode', 'true');
    });
  });

  describe('Error Handling', () => {
    it('should handle security service errors gracefully', async () => {
      // Mock security service to throw error
      const errorSecurityService = {
        checkAPIRequest: jest.fn().mockImplementation(() => {
          throw new Error('Security service error');
        }),
        recordAPIFailure: jest.fn(),
        recordAPISuccess: jest.fn()
      } as any;

      const errorMiddleware = new SecurityMiddleware(errorSecurityService, auditService);

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-130',
          ipAddress: '192.168.1.8',
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      const result = await errorMiddleware.handle(request, mockResponse);

      // Should continue despite error
      expect(result.continue).toBe(true);
      expect(errorSecurityService.recordAPIFailure).toHaveBeenCalledWith(
        '192.168.1.8',
        undefined,
        '/api/servers',
        'security_middleware_error'
      );
    });

    it('should log security violations to audit service', async () => {
      const ip = '192.168.1.9';
      
      // Exhaust rate limit
      for (let i = 0; i < 200; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: { 'user-agent': 'test-client' },
        body: {},
        context: {
          requestId: 'test-131',
          ipAddress: ip,
          userAgent: 'test-client',
          timestamp: Date.now(),
          permissions: []
        }
      };

      await securityMiddleware.handle(request, mockResponse);

      expect(auditService.logger.logSecurityEvent).toHaveBeenCalledWith(
        'api_request_blocked',
        expect.objectContaining({
          ip,
          endpoint: '/api/servers',
          reason: expect.stringContaining('rate limit')
        }),
        undefined
      );
    });
  });

  describe('Response Status Codes', () => {
    it('should return 429 for rate limit exceeded', async () => {
      const ip = '192.168.1.10';
      
      // Exhaust rate limit
      for (let i = 0; i < 200; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: {},
        body: {},
        context: {
          requestId: 'test-132',
          ipAddress: ip,
          timestamp: Date.now(),
          permissions: []
        }
      };

      await securityMiddleware.handle(request, mockResponse);

      expect(mockResponse.statusCode).toBe(429);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should return 403 for suspicious activity', async () => {
      const ip = '192.168.1.11';
      const userId = 'suspicioususer2';
      
      // Build suspicious activity
      for (let i = 0; i < 101; i++) {
        securityService.recordAPISuccess(ip, userId, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: {},
        body: {},
        context: {
          requestId: 'test-133',
          ipAddress: ip,
          userId,
          timestamp: Date.now(),
          permissions: []
        }
      };

      await securityMiddleware.handle(request, mockResponse);

      expect(mockResponse.statusCode).toBe(403);
    });

    it('should return 503 for DDoS attacks', async () => {
      const ip = '192.168.1.12';
      
      // Trigger DDoS protection
      for (let i = 0; i < 60; i++) {
        securityService.checkAPIRequest(ip, undefined, '/api/servers');
      }

      const request: HTTPRequest = {
        method: 'GET',
        url: '/api/servers',
        path: '/api/servers',
        query: {},
        headers: {},
        body: {},
        context: {
          requestId: 'test-134',
          ipAddress: ip,
          timestamp: Date.now(),
          permissions: []
        }
      };

      await securityMiddleware.handle(request, mockResponse);

      expect(mockResponse.statusCode).toBe(503);
    });
  });
});