/**
 * API Documentation Server
 *
 * Serves OpenAPI documentation and interactive API explorer
 */
import { ServerResponse } from 'http';
import { HTTPRequest } from './types';
import { APIResponse } from './types';
import { APIVersionManager } from './versioning';
export declare class DocumentationServer {
    private versionManager;
    constructor(versionManager: APIVersionManager);
    /**
     * Handle documentation requests
     */
    handleDocumentationRequest(request: HTTPRequest): Promise<APIResponse | null>;
    /**
     * Serve OpenAPI JSON specification
     */
    private serveOpenApiJson;
    /**
     * Serve OpenAPI YAML specification
     */
    private serveOpenApiYaml;
    /**
     * Serve API version information
     */
    private serveVersionInfo;
    /**
     * Serve Swagger UI HTML
     */
    private serveSwaggerUI;
    /**
     * Serve health check for documentation
     */
    private serveHealthCheck;
    /**
     * Serve list of available endpoints
     */
    private serveEndpointsList;
    /**
     * Generate Swagger UI HTML
     */
    private generateSwaggerUIHtml;
    /**
     * Handle raw response for non-JSON content
     */
    sendRawResponse(response: ServerResponse, content: string, contentType: string, statusCode?: number): void;
}
/**
 * Documentation middleware for handling doc requests
 */
export declare class DocumentationMiddleware {
    private docServer;
    constructor(docServer: DocumentationServer);
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        handled?: boolean;
    }>;
}
