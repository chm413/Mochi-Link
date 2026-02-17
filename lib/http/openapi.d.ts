/**
 * OpenAPI/Swagger Documentation Generator
 *
 * This file generates OpenAPI 3.0 specification for the Mochi-Link HTTP API
 */
import { OpenAPIV3 } from 'openapi-types';
export declare const openApiSpec: OpenAPIV3.Document;
/**
 * Generate OpenAPI specification as JSON string
 */
export declare function generateOpenApiSpec(): string;
/**
 * Generate OpenAPI specification as YAML string
 */
export declare function generateOpenApiYaml(): string;
