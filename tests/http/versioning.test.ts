/**
 * API Versioning Tests
 */

import { APIVersionManager, VersioningMiddleware } from '../../src/http/versioning';
import { HTTPRequest } from '../../src/http/server';

describe('API Versioning', () => {
  let versionManager: APIVersionManager;
  let versioningMiddleware: VersioningMiddleware;

  beforeEach(() => {
    versionManager = new APIVersionManager();
    versioningMiddleware = new VersioningMiddleware(versionManager);
  });

  describe('Version Extraction', () => {
    it('should extract version from Accept header', () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: {},
        body: null,
        headers: {
          'accept': 'application/vnd.mochi-link.v1.1+json'
        },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const version = versionManager.extractVersion(request);
      expect(version).toBe('v1.1');
    });

    it('should extract version from custom header', () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: {},
        body: null,
        headers: {
          'x-api-version': 'v2'
        },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const version = versionManager.extractVersion(request);
      expect(version).toBe('v2');
    });

    it('should extract version from query parameter', () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: { version: 'v1.1' },
        body: null,
        headers: {},
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const version = versionManager.extractVersion(request);
      expect(version).toBe('v1.1');
    });

    it('should extract version from URL path', () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/v2/servers',
        query: {},
        body: null,
        headers: {},
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const version = versionManager.extractVersion(request);
      expect(version).toBe('v2');
    });

    it('should return default version when none specified', () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: {},
        body: null,
        headers: {},
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const version = versionManager.extractVersion(request);
      expect(version).toBe('v1');
    });

    it('should prioritize Accept header over other methods', () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/v2/servers',
        query: { version: 'v1.1' },
        body: null,
        headers: {
          'accept': 'application/vnd.mochi-link.v1+json',
          'x-api-version': 'v2'
        },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const version = versionManager.extractVersion(request);
      expect(version).toBe('v1');
    });
  });

  describe('Version Support', () => {
    it('should check if version is supported', () => {
      expect(versionManager.isVersionSupported('v1')).toBe(true);
      expect(versionManager.isVersionSupported('v1.1')).toBe(true);
      expect(versionManager.isVersionSupported('v2')).toBe(true);
      expect(versionManager.isVersionSupported('v3')).toBe(false);
    });

    it('should get version information', () => {
      const versionInfo = versionManager.getVersionInfo('v1');
      expect(versionInfo).toBeDefined();
      expect(versionInfo!.version).toBe('v1');
      expect(versionInfo!.changelog).toBeDefined();
    });

    it('should return null for unsupported version', () => {
      const versionInfo = versionManager.getVersionInfo('v99');
      expect(versionInfo).toBeNull();
    });

    it('should get all supported versions', () => {
      const versions = versionManager.getSupportedVersions();
      expect(versions.length).toBeGreaterThan(0);
      expect(versions.map(v => v.version)).toContain('v1');
    });
  });

  describe('Version Validation', () => {
    it('should validate version format', () => {
      expect(versionManager.validateVersionFormat('v1')).toBe(true);
      expect(versionManager.validateVersionFormat('v1.0')).toBe(true);
      expect(versionManager.validateVersionFormat('v1.1')).toBe(true);
      expect(versionManager.validateVersionFormat('v2')).toBe(true);
      expect(versionManager.validateVersionFormat('1')).toBe(false);
      expect(versionManager.validateVersionFormat('v1.1.1')).toBe(false);
      expect(versionManager.validateVersionFormat('invalid')).toBe(false);
    });
  });

  describe('Deprecation Management', () => {
    it('should mark version as deprecated', () => {
      const deprecationDate = new Date();
      const sunsetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      versionManager.deprecateVersion('v1', deprecationDate, sunsetDate);
      
      expect(versionManager.isVersionDeprecated('v1')).toBe(true);
      expect(versionManager.isVersionDeprecated('v1.1')).toBe(false);
    });

    it('should get deprecation warnings', () => {
      const deprecationDate = new Date();
      versionManager.deprecateVersion('v1', deprecationDate);
      
      const warnings = versionManager.getDeprecationWarnings('v1');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('deprecated');
    });

    it('should not have warnings for non-deprecated versions', () => {
      const warnings = versionManager.getDeprecationWarnings('v1.1');
      expect(warnings.length).toBe(0);
    });
  });

  describe('Version Headers', () => {
    it('should add version headers to response', () => {
      const response = {
        success: true,
        data: { test: true },
        timestamp: Date.now()
      };

      const versionedResponse = versionManager.addVersionHeaders(response, 'v1', 'req-123');
      
      expect(versionedResponse.version).toBe('v1');
      expect(versionedResponse.apiVersion).toBe('v1');
      expect(versionedResponse.supportedVersions).toBeDefined();
      expect(versionedResponse.requestId).toBe('req-123');
    });

    it('should include warnings for deprecated versions', () => {
      versionManager.deprecateVersion('v1');
      
      const response = {
        success: true,
        data: { test: true },
        timestamp: Date.now()
      };

      const versionedResponse = versionManager.addVersionHeaders(response, 'v1', 'req-123');
      
      expect(versionedResponse.warnings).toBeDefined();
      expect(versionedResponse.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('Compatibility Response', () => {
    it('should create version compatibility response', () => {
      const response = versionManager.createVersionCompatibilityResponse('v99', 'req-123');
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('VERSION_NOT_SUPPORTED');
      expect(response.data.requestedVersion).toBe('v99');
      expect(response.data.supportedVersions).toBeDefined();
      expect(response.data.latestVersion).toBeDefined();
      expect(response.requestId).toBe('req-123');
    });
  });

  describe('Version Info Response', () => {
    it('should create version info response', () => {
      const response = versionManager.createVersionInfoResponse('req-123');
      
      expect(response.success).toBe(true);
      expect(response.data.currentVersion).toBeDefined();
      expect(response.data.supportedVersions).toBeDefined();
      expect(response.data.compatibilityMatrix).toBeDefined();
      expect(response.data.versioningMethods).toBeDefined();
      expect(response.requestId).toBe('req-123');
    });
  });

  describe('Migration Guide', () => {
    it('should provide migration guide', () => {
      const guide = versionManager.getMigrationGuide('v1', 'v2');
      
      expect(guide.length).toBeGreaterThan(0);
      expect(guide[0]).toContain('Upgrading from v1 to v2');
    });
  });

  describe('Versioning Middleware', () => {
    it('should allow supported version', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: {},
        body: null,
        headers: { 'x-api-version': 'v1' },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const result = await versioningMiddleware.handle(request);
      
      expect(result.continue).toBe(true);
      expect(result.version).toBe('v1');
    });

    it('should reject unsupported version', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: {},
        body: null,
        headers: { 'x-api-version': 'v99' },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const result = await versioningMiddleware.handle(request);
      
      expect(result.continue).toBe(false);
      expect(result.version).toBe('v99');
    });

    it('should reject invalid version format', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: {},
        body: null,
        headers: { 'x-api-version': 'invalid-version' },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const result = await versioningMiddleware.handle(request);
      
      expect(result.continue).toBe(false);
    });

    it('should include warnings for deprecated versions', async () => {
      versionManager.deprecateVersion('v1');
      
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/servers',
        query: {},
        body: null,
        headers: { 'x-api-version': 'v1' },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const result = await versioningMiddleware.handle(request);
      
      expect(result.continue).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });
});