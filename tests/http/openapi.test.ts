/**
 * OpenAPI Documentation Tests
 */

import { generateOpenApiSpec, generateOpenApiYaml, openApiSpec } from '../../src/http/openapi';

describe('OpenAPI Documentation', () => {
  describe('OpenAPI Specification', () => {
    it('should have valid OpenAPI 3.0 structure', () => {
      expect(openApiSpec.openapi).toBe('3.0.3');
      expect(openApiSpec.info).toBeDefined();
      expect(openApiSpec.info.title).toBe('Mochi-Link API');
      expect(openApiSpec.info.version).toBe('1.0.0');
    });

    it('should include all required components', () => {
      expect(openApiSpec.components).toBeDefined();
      expect(openApiSpec.components!.schemas).toBeDefined();
      expect(openApiSpec.components!.responses).toBeDefined();
      expect(openApiSpec.components!.parameters).toBeDefined();
      expect(openApiSpec.components!.securitySchemes).toBeDefined();
    });

    it('should have security schemes defined', () => {
      const securitySchemes = openApiSpec.components!.securitySchemes!;
      expect(securitySchemes.bearerAuth).toBeDefined();
      expect(securitySchemes.bearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      });
    });

    it('should include common schemas', () => {
      const schemas = openApiSpec.components!.schemas!;
      expect(schemas.APIResponse).toBeDefined();
      expect(schemas.PaginationInfo).toBeDefined();
      expect(schemas.ValidationError).toBeDefined();
      expect(schemas.ServerSummary).toBeDefined();
      expect(schemas.Player).toBeDefined();
    });

    it('should include all endpoint paths', () => {
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.paths!['/api/health']).toBeDefined();
      expect(openApiSpec.paths!['/api/servers']).toBeDefined();
      expect(openApiSpec.paths!['/api/servers/{serverId}']).toBeDefined();
      expect(openApiSpec.paths!['/api/servers/{serverId}/players']).toBeDefined();
    });

    it('should have proper tags defined', () => {
      expect(openApiSpec.tags).toBeDefined();
      expect(openApiSpec.tags!.length).toBeGreaterThan(0);
      
      const tagNames = openApiSpec.tags!.map(tag => tag.name);
      expect(tagNames).toContain('System');
      expect(tagNames).toContain('Servers');
      expect(tagNames).toContain('Players');
      expect(tagNames).toContain('Commands');
    });
  });

  describe('JSON Generation', () => {
    it('should generate valid JSON specification', () => {
      const jsonSpec = generateOpenApiSpec();
      expect(() => JSON.parse(jsonSpec)).not.toThrow();
      
      const parsed = JSON.parse(jsonSpec);
      expect(parsed.openapi).toBe('3.0.3');
      expect(parsed.info.title).toBe('Mochi-Link API');
    });

    it('should include all required fields in JSON', () => {
      const jsonSpec = generateOpenApiSpec();
      const parsed = JSON.parse(jsonSpec);
      
      expect(parsed.openapi).toBeDefined();
      expect(parsed.info).toBeDefined();
      expect(parsed.paths).toBeDefined();
      expect(parsed.components).toBeDefined();
    });
  });

  describe('YAML Generation', () => {
    it('should generate YAML specification', () => {
      const yamlSpec = generateOpenApiYaml();
      expect(yamlSpec).toContain('openapi: 3.0.3');
      expect(yamlSpec).toContain('title: "Mochi-Link API"');
      expect(yamlSpec).toContain('servers:');
    });

    it('should include server information in YAML', () => {
      const yamlSpec = generateOpenApiYaml();
      expect(yamlSpec).toContain('url: "http://localhost:3000"');
      expect(yamlSpec).toContain('description: "Development server"');
    });
  });

  describe('Schema Validation', () => {
    it('should have valid server creation schema', () => {
      const schemas = openApiSpec.components!.schemas!;
      const createServerSchema = schemas.CreateServerRequest as any;
      
      expect(createServerSchema.type).toBe('object');
      expect(createServerSchema.required).toContain('name');
      expect(createServerSchema.required).toContain('coreType');
      expect(createServerSchema.required).toContain('connectionMode');
      expect(createServerSchema.required).toContain('connectionConfig');
    });

    it('should have valid player schema', () => {
      const schemas = openApiSpec.components!.schemas!;
      const playerSchema = schemas.Player as any;
      
      expect(playerSchema.type).toBe('object');
      expect(playerSchema.required).toContain('id');
      expect(playerSchema.required).toContain('name');
      expect(playerSchema.required).toContain('world');
      expect(playerSchema.required).toContain('position');
    });

    it('should have valid command execution schema', () => {
      const schemas = openApiSpec.components!.schemas!;
      const commandSchema = schemas.ExecuteCommandRequest as any;
      
      expect(commandSchema.type).toBe('object');
      expect(commandSchema.required).toContain('command');
      expect(commandSchema.properties.command.minLength).toBe(1);
      expect(commandSchema.properties.command.maxLength).toBe(1000);
    });
  });

  describe('Response Schemas', () => {
    it('should have standard error responses', () => {
      const responses = openApiSpec.components!.responses!;
      expect(responses.ValidationError).toBeDefined();
      expect(responses.Unauthorized).toBeDefined();
      expect(responses.Forbidden).toBeDefined();
      expect(responses.NotFound).toBeDefined();
      expect(responses.ServerError).toBeDefined();
    });

    it('should have proper error response structure', () => {
      const responses = openApiSpec.components!.responses!;
      const validationError = responses.ValidationError as any;
      
      expect(validationError.description).toBe('Validation error');
      expect(validationError.content['application/json']).toBeDefined();
    });
  });

  describe('Parameters', () => {
    it('should have common parameters defined', () => {
      const parameters = openApiSpec.components!.parameters!;
      expect(parameters.ServerId).toBeDefined();
      expect(parameters.PlayerId).toBeDefined();
      expect(parameters.Page).toBeDefined();
      expect(parameters.Limit).toBeDefined();
    });

    it('should have proper parameter validation', () => {
      const parameters = openApiSpec.components!.parameters!;
      const serverIdParam = parameters.ServerId as any;
      
      expect(serverIdParam.name).toBe('serverId');
      expect(serverIdParam.in).toBe('path');
      expect(serverIdParam.required).toBe(true);
      expect(serverIdParam.schema.pattern).toBeDefined();
    });
  });
});