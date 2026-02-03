/**
 * Documentation Server Tests
 */

import { DocumentationServer, DocumentationMiddleware } from '../../src/http/docs';
import { APIVersionManager } from '../../src/http/versioning';
import { HTTPRequest } from '../../src/http/server';
import { ServerResponse } from 'http';

// Mock ServerResponse
const createMockResponse = () => {
  const headers: Record<string, string> = {};
  const response = {
    statusCode: 200,
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    getHeader: jest.fn((name: string) => headers[name]),
    end: jest.fn(),
    write: jest.fn(),
    writeHead: jest.fn()
  };
  
  return response as unknown as ServerResponse;
};

describe('Documentation Server', () => {
  let docServer: DocumentationServer;
  let versionManager: APIVersionManager;
  let docMiddleware: DocumentationMiddleware;

  beforeEach(() => {
    versionManager = new APIVersionManager();
    docServer = new DocumentationServer(versionManager);
    docMiddleware = new DocumentationMiddleware(docServer);
  });

  describe('OpenAPI JSON Endpoint', () => {
    it('should serve OpenAPI JSON specification', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/openapi.json',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.data).toBeDefined();
      expect(response!.data.openapi).toBe('3.0.3');
      expect(response!.headers?.['Content-Type']).toBe('application/json');
    });

    it('should serve OpenAPI JSON at alternative path', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/openapi.json',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
    });
  });

  describe('OpenAPI YAML Endpoint', () => {
    it('should serve OpenAPI YAML specification', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/openapi.yaml',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.data).toContain('openapi: 3.0.3');
      expect(response!.headers?.['Content-Type']).toBe('application/x-yaml');
    });
  });

  describe('Version Information Endpoint', () => {
    it('should serve version information', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/versions',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.data.currentVersion).toBeDefined();
      expect(response!.data.supportedVersions).toBeDefined();
      expect(response!.data.compatibilityMatrix).toBeDefined();
    });

    it('should serve version information at alternative path', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/versions',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
    });
  });

  describe('Swagger UI Endpoint', () => {
    it('should serve Swagger UI HTML', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.data).toContain('<!DOCTYPE html>');
      expect(response!.data).toContain('Mochi-Link API');
      expect(response!.data).toContain('swagger-ui');
      expect(response!.headers?.['Content-Type']).toBe('text/html');
    });

    it('should serve Swagger UI at root docs path', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.data).toContain('<!DOCTYPE html>');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should serve documentation health check', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/health',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.data.status).toBe('healthy');
      expect(response!.data.documentation).toBeDefined();
      expect(response!.data.endpoints).toBeDefined();
    });
  });

  describe('Endpoints List Endpoint', () => {
    it('should serve list of available endpoints', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/endpoints',
        query: {},
        body: null,
        headers: { host: 'localhost:3000' },
        context: {
          requestId: 'test-123',
          timestamp: Date.now(),
          ipAddress: '127.0.0.1',
          permissions: []
        }
      };

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.data.totalEndpoints).toBeGreaterThan(0);
      expect(response!.data.endpoints).toBeDefined();
      expect(response!.data.categories).toBeDefined();
      
      // Check that endpoints have full URLs
      const firstEndpoint = response!.data.endpoints[0];
      expect(firstEndpoint.fullUrl).toContain('localhost:3000');
    });

    it('should categorize endpoints correctly', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/endpoints',
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      
      const categories = response!.data.categories;
      expect(categories.system).toBeGreaterThan(0);
      expect(categories.servers).toBeGreaterThan(0);
      expect(categories.players).toBeGreaterThan(0);
      expect(categories.commands).toBeGreaterThan(0);
      expect(categories.docs).toBeGreaterThan(0);
    });
  });

  describe('Non-documentation Requests', () => {
    it('should return null for non-documentation requests', async () => {
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

      const response = await docServer.handleDocumentationRequest(request);
      
      expect(response).toBeNull();
    });
  });

  describe('Documentation Middleware', () => {
    it('should handle documentation requests', async () => {
      const mockResponse = createMockResponse();
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/openapi.json',
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

      const result = await docMiddleware.handle(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.handled).toBe(true);
      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    });

    it('should handle HTML documentation requests', async () => {
      const mockResponse = createMockResponse();
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs',
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

      const result = await docMiddleware.handle(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.handled).toBe(true);
    });

    it('should handle YAML documentation requests', async () => {
      const mockResponse = createMockResponse();
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/openapi.yaml',
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

      const result = await docMiddleware.handle(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.handled).toBe(true);
    });

    it('should pass through non-documentation requests', async () => {
      const mockResponse = createMockResponse();
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

      const result = await docMiddleware.handle(request, mockResponse);
      
      expect(result.continue).toBe(true);
      expect(result.handled).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const mockResponse = createMockResponse();
      
      // Create a mock that throws an error
      const errorDocServer = {
        handleDocumentationRequest: jest.fn().mockRejectedValue(new Error('Test error'))
      };
      const errorMiddleware = new DocumentationMiddleware(errorDocServer as any);

      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/docs/openapi.json',
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

      const result = await errorMiddleware.handle(request, mockResponse);
      
      expect(result.continue).toBe(false);
      expect(result.handled).toBe(true);
      expect(mockResponse.statusCode).toBe(500);
    });
  });
});