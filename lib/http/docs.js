"use strict";
/**
 * API Documentation Server
 *
 * Serves OpenAPI documentation and interactive API explorer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationMiddleware = exports.DocumentationServer = void 0;
const openapi_1 = require("./openapi");
class DocumentationServer {
    constructor(versionManager) {
        this.versionManager = versionManager;
    }
    /**
     * Handle documentation requests
     */
    async handleDocumentationRequest(request) {
        const path = request.path;
        // OpenAPI JSON specification
        if (path === '/api/docs/openapi.json' || path === '/api/openapi.json') {
            return this.serveOpenApiJson(request);
        }
        // OpenAPI YAML specification
        if (path === '/api/docs/openapi.yaml' || path === '/api/openapi.yaml') {
            return this.serveOpenApiYaml(request);
        }
        // API version information
        if (path === '/api/docs/versions' || path === '/api/versions') {
            return this.serveVersionInfo(request);
        }
        // Interactive API documentation (Swagger UI)
        if (path === '/api/docs' || path === '/api/docs/') {
            return this.serveSwaggerUI(request);
        }
        // API health and status
        if (path === '/api/docs/health') {
            return this.serveHealthCheck(request);
        }
        // API endpoints list
        if (path === '/api/docs/endpoints') {
            return this.serveEndpointsList(request);
        }
        return null; // Not a documentation request
    }
    /**
     * Serve OpenAPI JSON specification
     */
    serveOpenApiJson(request) {
        try {
            const spec = (0, openapi_1.generateOpenApiSpec)();
            return {
                success: true,
                data: JSON.parse(spec),
                timestamp: Date.now(),
                requestId: request.context.requestId,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600'
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: 'DOCUMENTATION_ERROR',
                message: 'Failed to generate OpenAPI specification',
                timestamp: Date.now(),
                requestId: request.context.requestId
            };
        }
    }
    /**
     * Serve OpenAPI YAML specification
     */
    serveOpenApiYaml(request) {
        try {
            const yamlSpec = (0, openapi_1.generateOpenApiYaml)();
            return {
                success: true,
                data: yamlSpec,
                timestamp: Date.now(),
                requestId: request.context.requestId,
                headers: {
                    'Content-Type': 'application/x-yaml',
                    'Cache-Control': 'public, max-age=3600'
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: 'DOCUMENTATION_ERROR',
                message: 'Failed to generate OpenAPI YAML specification',
                timestamp: Date.now(),
                requestId: request.context.requestId
            };
        }
    }
    /**
     * Serve API version information
     */
    serveVersionInfo(request) {
        return this.versionManager.createVersionInfoResponse(request.context.requestId);
    }
    /**
     * Serve Swagger UI HTML
     */
    serveSwaggerUI(request) {
        const swaggerUIHtml = this.generateSwaggerUIHtml();
        return {
            success: true,
            data: swaggerUIHtml,
            timestamp: Date.now(),
            requestId: request.context.requestId,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=3600'
            }
        };
    }
    /**
     * Serve health check for documentation
     */
    serveHealthCheck(request) {
        return {
            success: true,
            data: {
                status: 'healthy',
                documentation: {
                    openapi: 'available',
                    swagger: 'available',
                    versions: 'available'
                },
                endpoints: {
                    openapi_json: '/api/docs/openapi.json',
                    openapi_yaml: '/api/docs/openapi.yaml',
                    swagger_ui: '/api/docs',
                    versions: '/api/docs/versions',
                    endpoints_list: '/api/docs/endpoints'
                }
            },
            timestamp: Date.now(),
            requestId: request.context.requestId
        };
    }
    /**
     * Serve list of available endpoints
     */
    serveEndpointsList(request) {
        const endpoints = [
            // System endpoints
            { method: 'GET', path: '/api/health', description: 'System health status' },
            { method: 'GET', path: '/api/stats', description: 'System statistics' },
            // Server management
            { method: 'GET', path: '/api/servers', description: 'List servers' },
            { method: 'POST', path: '/api/servers', description: 'Create server' },
            { method: 'GET', path: '/api/servers/{serverId}', description: 'Get server details' },
            { method: 'PUT', path: '/api/servers/{serverId}', description: 'Update server' },
            { method: 'DELETE', path: '/api/servers/{serverId}', description: 'Delete server' },
            // Player management
            { method: 'GET', path: '/api/servers/{serverId}/players', description: 'List players' },
            { method: 'GET', path: '/api/servers/{serverId}/players/{playerId}', description: 'Get player details' },
            { method: 'POST', path: '/api/servers/{serverId}/players/{playerId}/kick', description: 'Kick player' },
            // Whitelist management
            { method: 'GET', path: '/api/servers/{serverId}/whitelist', description: 'Get whitelist' },
            { method: 'POST', path: '/api/servers/{serverId}/whitelist', description: 'Add to whitelist' },
            { method: 'DELETE', path: '/api/servers/{serverId}/whitelist/{playerId}', description: 'Remove from whitelist' },
            // Ban management
            { method: 'GET', path: '/api/servers/{serverId}/bans', description: 'List bans' },
            { method: 'POST', path: '/api/servers/{serverId}/bans', description: 'Create ban' },
            { method: 'PUT', path: '/api/servers/{serverId}/bans/{banId}', description: 'Update ban' },
            { method: 'DELETE', path: '/api/servers/{serverId}/bans/{banId}', description: 'Delete ban' },
            // Command execution
            { method: 'POST', path: '/api/servers/{serverId}/commands', description: 'Execute command' },
            { method: 'POST', path: '/api/servers/{serverId}/actions', description: 'Execute quick action' },
            // Monitoring
            { method: 'GET', path: '/api/servers/{serverId}/status', description: 'Server status' },
            { method: 'GET', path: '/api/servers/{serverId}/performance', description: 'Performance history' },
            { method: 'GET', path: '/api/servers/{serverId}/alerts', description: 'Server alerts' },
            { method: 'POST', path: '/api/servers/{serverId}/alerts/{alertId}/acknowledge', description: 'Acknowledge alert' },
            // Batch operations
            { method: 'POST', path: '/api/batch/commands', description: 'Execute batch commands' },
            { method: 'POST', path: '/api/batch/actions', description: 'Execute batch actions' },
            // Audit logs
            { method: 'GET', path: '/api/audit', description: 'Get audit logs' },
            // Authentication
            { method: 'POST', path: '/api/auth/verify', description: 'Verify token' },
            { method: 'POST', path: '/api/auth/tokens', description: 'Create token' },
            // Documentation
            { method: 'GET', path: '/api/docs', description: 'Interactive API documentation' },
            { method: 'GET', path: '/api/docs/openapi.json', description: 'OpenAPI JSON specification' },
            { method: 'GET', path: '/api/docs/openapi.yaml', description: 'OpenAPI YAML specification' },
            { method: 'GET', path: '/api/docs/versions', description: 'API version information' }
        ];
        return {
            success: true,
            data: {
                totalEndpoints: endpoints.length,
                endpoints: endpoints.map(endpoint => ({
                    ...endpoint,
                    fullUrl: `${request.headers.host || 'localhost:3000'}${endpoint.path}`
                })),
                categories: {
                    system: endpoints.filter(e => e.path.startsWith('/api/health') || e.path.startsWith('/api/stats')).length,
                    servers: endpoints.filter(e => e.path.includes('/servers') && !e.path.includes('/players')).length,
                    players: endpoints.filter(e => e.path.includes('/players')).length,
                    whitelist: endpoints.filter(e => e.path.includes('/whitelist')).length,
                    bans: endpoints.filter(e => e.path.includes('/bans')).length,
                    commands: endpoints.filter(e => e.path.includes('/commands') || e.path.includes('/actions')).length,
                    monitoring: endpoints.filter(e => e.path.includes('/status') || e.path.includes('/performance') || e.path.includes('/alerts')).length,
                    batch: endpoints.filter(e => e.path.includes('/batch')).length,
                    audit: endpoints.filter(e => e.path.includes('/audit')).length,
                    auth: endpoints.filter(e => e.path.includes('/auth')).length,
                    docs: endpoints.filter(e => e.path.includes('/docs')).length
                }
            },
            timestamp: Date.now(),
            requestId: request.context.requestId
        };
    }
    /**
     * Generate Swagger UI HTML
     */
    generateSwaggerUIHtml() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mochi-Link API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
        .swagger-ui .topbar {
            background-color: #2c3e50;
        }
        .swagger-ui .topbar .download-url-wrapper .select-label {
            color: #ffffff;
        }
        .custom-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            margin-bottom: 20px;
        }
        .custom-header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .custom-header p {
            margin: 10px 0 0 0;
            font-size: 1.2em;
            opacity: 0.9;
        }
        .version-info {
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px;
            border-radius: 4px;
        }
        .version-info h3 {
            margin-top: 0;
            color: #007bff;
        }
    </style>
</head>
<body>
    <div class="custom-header">
        <h1>🍡 Mochi-Link API</h1>
        <p>Minecraft 统一管理与监控系统 HTTP API</p>
    </div>
    
    <div class="version-info">
        <h3>API Version Information</h3>
        <p>This documentation covers all supported API versions. Use version headers or URL prefixes to specify the desired version.</p>
        <ul>
            <li><strong>Accept Header:</strong> <code>application/vnd.mochi-link.v1+json</code></li>
            <li><strong>Custom Header:</strong> <code>X-API-Version: v1</code></li>
            <li><strong>Query Parameter:</strong> <code>?version=v1</code></li>
            <li><strong>URL Path:</strong> <code>/api/v1/...</code></li>
        </ul>
    </div>

    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/docs/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                validatorUrl: null,
                tryItOutEnabled: true,
                requestInterceptor: function(request) {
                    // Add version header to all requests
                    request.headers['X-API-Version'] = 'v1';
                    return request;
                },
                responseInterceptor: function(response) {
                    // Log API responses for debugging
                    console.log('API Response:', response);
                    return response;
                },
                onComplete: function() {
                    console.log('Swagger UI loaded successfully');
                },
                onFailure: function(error) {
                    console.error('Failed to load Swagger UI:', error);
                }
            });

            // Add custom styling
            setTimeout(function() {
                const topbar = document.querySelector('.swagger-ui .topbar');
                if (topbar) {
                    topbar.style.display = 'none';
                }
            }, 1000);
        };
    </script>
</body>
</html>`;
    }
    /**
     * Handle raw response for non-JSON content
     */
    sendRawResponse(response, content, contentType, statusCode = 200) {
        response.statusCode = statusCode;
        response.setHeader('Content-Type', contentType);
        response.setHeader('Cache-Control', 'public, max-age=3600');
        response.end(content);
    }
}
exports.DocumentationServer = DocumentationServer;
/**
 * Documentation middleware for handling doc requests
 */
class DocumentationMiddleware {
    constructor(docServer) {
        this.docServer = docServer;
    }
    async handle(request, response) {
        // Check if this is a documentation request
        if (request.path.startsWith('/api/docs') ||
            request.path === '/api/openapi.json' ||
            request.path === '/api/openapi.yaml' ||
            request.path === '/api/versions') {
            try {
                const docResponse = await this.docServer.handleDocumentationRequest(request);
                if (docResponse) {
                    // Handle HTML content specially
                    if (docResponse.headers?.['Content-Type'] === 'text/html') {
                        this.docServer.sendRawResponse(response, docResponse.data, 'text/html');
                        return { continue: false, handled: true };
                    }
                    // Handle YAML content specially
                    if (docResponse.headers?.['Content-Type'] === 'application/x-yaml') {
                        this.docServer.sendRawResponse(response, docResponse.data, 'application/x-yaml');
                        return { continue: false, handled: true };
                    }
                    // Handle JSON responses normally
                    response.statusCode = docResponse.success ? 200 : 400;
                    response.setHeader('Content-Type', 'application/json');
                    if (docResponse.headers?.['Cache-Control']) {
                        response.setHeader('Cache-Control', docResponse.headers['Cache-Control']);
                    }
                    response.end(JSON.stringify(docResponse));
                    return { continue: false, handled: true };
                }
            }
            catch (error) {
                // Send error response
                response.statusCode = 500;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({
                    success: false,
                    error: 'DOCUMENTATION_ERROR',
                    message: 'Failed to serve documentation',
                    timestamp: Date.now()
                }));
                return { continue: false, handled: true };
            }
        }
        return { continue: true, handled: false };
    }
}
exports.DocumentationMiddleware = DocumentationMiddleware;
