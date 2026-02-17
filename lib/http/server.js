"use strict";
/**
 * HTTP API Server Implementation
 *
 * This file implements the HTTP API server using Node.js built-in HTTP module
 * with routing, middleware, and error handling capabilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPServer = void 0;
const http_1 = require("http");
const url_1 = require("url");
const types_1 = require("../types");
const router_1 = require("./router");
const validation_1 = require("./middleware/validation");
const auth_1 = require("./middleware/auth");
const cors_1 = require("./middleware/cors");
const security_1 = require("./middleware/security");
const versioning_1 = require("./versioning");
const docs_1 = require("./docs");
const security_2 = require("../services/security");
const security_config_1 = require("../services/security-config");
// Logging middleware
class LoggingMiddleware {
    constructor(logger) {
        this.logger = logger;
    }
    async handle(request, response) {
        const startTime = Date.now();
        this.logger.info(`${request.method} ${request.path}`, {
            userAgent: request.headers['user-agent'],
            ip: request.context?.ipAddress
        });
        // Log response time after request completes
        const originalEnd = response.end;
        const logger = this.logger; // Capture logger reference
        response.end = function (...args) {
            const duration = Date.now() - startTime;
            logger.info(`${request.method} ${request.path} - ${response.statusCode} (${duration}ms)`);
            return originalEnd.apply(this, args);
        };
        return { continue: true };
    }
}
// ============================================================================
// HTTP Server Class
// ============================================================================
class HTTPServer {
    constructor(ctx, config, serviceManager) {
        this.ctx = ctx;
        this.serviceManager = serviceManager;
        this.server = null;
        this.middlewares = [];
        this.isRunning = false;
        this.config = config;
        this.logger = ctx.logger('http-api');
        this.router = new router_1.APIRouter(ctx, serviceManager);
        // Initialize versioning
        this.versionManager = new versioning_1.APIVersionManager();
        this.versioningMiddleware = new versioning_1.VersioningMiddleware(this.versionManager);
        // Initialize documentation
        this.documentationServer = new docs_1.DocumentationServer(this.versionManager);
        this.documentationMiddleware = new docs_1.DocumentationMiddleware(this.documentationServer);
        // Initialize security service
        const securityConfigManager = new security_config_1.SecurityConfigManager(ctx);
        this.securityService = new security_2.SecurityControlService(ctx, serviceManager.auditService, securityConfigManager.getConfig());
        this.setupMiddlewares();
        this.setupRoutes();
    }
    // ============================================================================
    // Server Lifecycle
    // ============================================================================
    async start() {
        if (this.isRunning || !this.config) {
            return;
        }
        return new Promise((resolve, reject) => {
            this.server = (0, http_1.createServer)(this.handleRequest.bind(this));
            this.server.on('error', (error) => {
                this.logger.error('HTTP server error:', error);
                reject(error);
            });
            const host = this.config.host || 'localhost';
            const port = this.config.port || 3000;
            this.server.listen(port, host, () => {
                this.isRunning = true;
                this.logger.info(`HTTP API server listening on ${host}:${port}`);
                resolve();
            });
        });
    }
    async stop() {
        if (!this.isRunning || !this.server) {
            return;
        }
        return new Promise((resolve) => {
            // Shutdown security service
            this.securityService.shutdown();
            this.server.close(() => {
                this.isRunning = false;
                this.server = null;
                this.logger.info('HTTP API server stopped');
                resolve();
            });
        });
    }
    // ============================================================================
    // Middleware Setup
    // ============================================================================
    setupMiddlewares() {
        // Documentation middleware (highest priority)
        this.middlewares.push(this.documentationMiddleware);
        // CORS middleware (if enabled)
        if (this.config && this.config.cors) {
            const corsConfig = {
                origin: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Version', 'API-Version'],
                credentials: true
            };
            this.middlewares.push(new cors_1.CorsMiddleware(corsConfig));
        }
        // Logging middleware
        this.middlewares.push(new LoggingMiddleware(this.logger));
        // Enhanced security middleware (replaces basic rate limiting)
        this.middlewares.push(new security_1.SecurityMiddleware(this.securityService, this.serviceManager.auditService));
        // Authentication middleware
        this.middlewares.push(new auth_1.AuthMiddleware(this.ctx, this.serviceManager));
        // Enhanced validation middleware
        this.middlewares.push(new validation_1.ValidationMiddleware());
    }
    // ============================================================================
    // Route Setup
    // ============================================================================
    setupRoutes() {
        // System routes
        this.router.get('/api/health', this.router.getSystemHealth.bind(this.router));
        this.router.get('/api/stats', this.router.getSystemStats.bind(this.router));
        // Server management routes
        this.router.get('/api/servers', this.router.getServers.bind(this.router));
        this.router.post('/api/servers', this.router.createServer.bind(this.router));
        this.router.get('/api/servers/:serverId', this.router.getServer.bind(this.router));
        this.router.put('/api/servers/:serverId', this.router.updateServer.bind(this.router));
        this.router.delete('/api/servers/:serverId', this.router.deleteServer.bind(this.router));
        // Player management routes
        this.router.get('/api/servers/:serverId/players', this.router.getPlayers.bind(this.router));
        this.router.get('/api/servers/:serverId/players/:playerId', this.router.getPlayer.bind(this.router));
        this.router.post('/api/servers/:serverId/players/:playerId/kick', this.router.kickPlayer.bind(this.router));
        // Whitelist management routes
        this.router.get('/api/servers/:serverId/whitelist', this.router.getWhitelist.bind(this.router));
        this.router.post('/api/servers/:serverId/whitelist', this.router.addToWhitelist.bind(this.router));
        this.router.delete('/api/servers/:serverId/whitelist/:playerId', this.router.removeFromWhitelist.bind(this.router));
        // Ban management routes
        this.router.get('/api/servers/:serverId/bans', this.router.getBans.bind(this.router));
        this.router.post('/api/servers/:serverId/bans', this.router.createBan.bind(this.router));
        this.router.put('/api/servers/:serverId/bans/:banId', this.router.updateBan.bind(this.router));
        this.router.delete('/api/servers/:serverId/bans/:banId', this.router.deleteBan.bind(this.router));
        // Command execution routes
        this.router.post('/api/servers/:serverId/commands', this.router.executeCommand.bind(this.router));
        this.router.post('/api/servers/:serverId/actions', this.router.executeQuickAction.bind(this.router));
        // Monitoring routes
        this.router.get('/api/servers/:serverId/status', this.router.getServerStatus.bind(this.router));
        this.router.get('/api/servers/:serverId/performance', this.router.getPerformanceHistory.bind(this.router));
        this.router.get('/api/servers/:serverId/alerts', this.router.getAlerts.bind(this.router));
        this.router.post('/api/servers/:serverId/alerts/:alertId/acknowledge', this.router.acknowledgeAlert.bind(this.router));
        // Real-time monitoring endpoints
        this.router.get('/api/servers/:serverId/metrics/current', this.router.getCurrentMetrics.bind(this.router));
        this.router.get('/api/servers/:serverId/metrics/summary', this.router.getMetricsSummary.bind(this.router));
        // Batch operations
        this.router.post('/api/batch/commands', this.router.executeBatchCommands.bind(this.router));
        this.router.post('/api/batch/actions', this.router.executeBatchActions.bind(this.router));
        // Audit log routes
        this.router.get('/api/audit', this.router.getAuditLogs.bind(this.router));
        // Authentication routes
        this.router.post('/api/auth/verify', this.router.verifyToken.bind(this.router));
        this.router.post('/api/auth/tokens', this.router.createToken.bind(this.router));
    }
    // ============================================================================
    // Request Handling
    // ============================================================================
    async handleRequest(req, res) {
        const startTime = Date.now();
        const requestId = this.generateRequestId();
        try {
            // Parse URL and method
            const url = (0, url_1.parse)(req.url || '', true);
            const method = req.method?.toUpperCase() || 'GET';
            const path = url.pathname || '/';
            // Create request context
            const context = {
                requestId,
                timestamp: startTime,
                ipAddress: this.getClientIP(req),
                userAgent: req.headers['user-agent'],
                permissions: []
            };
            // Handle preflight OPTIONS requests
            if (method === 'OPTIONS') {
                this.handleOptions(res);
                return;
            }
            // Parse request body for POST/PUT requests
            const body = await this.parseRequestBody(req);
            // Create request object
            const request = {
                method,
                url: req.url || '',
                path,
                query: url.query,
                body,
                headers: req.headers,
                context
            };
            // Handle API versioning
            const versionResult = await this.versioningMiddleware.handle(request);
            if (!versionResult.continue) {
                const versionResponse = this.versionManager.createVersionCompatibilityResponse(versionResult.version, requestId);
                this.sendResponse(res, versionResponse, startTime);
                return;
            }
            // Add version info to context
            request.context.apiVersion = versionResult.version;
            if (versionResult.warnings) {
                request.context.versionWarnings = versionResult.warnings;
            }
            // Apply middlewares
            for (const middleware of this.middlewares) {
                const result = await middleware.handle(request, res);
                if (!result.continue) {
                    // Check if documentation middleware handled the request
                    if ('handled' in result && result.handled) {
                        return; // Response already sent by documentation middleware
                    }
                    return; // Middleware handled the response
                }
                // Update context with middleware results
                Object.assign(request.context, result.context || {});
            }
            // Route the request
            const response = await this.router.route(request);
            // Add version headers to response
            const versionedResponse = this.versionManager.addVersionHeaders(response, versionResult.version, requestId);
            // Send response
            this.sendResponse(res, versionedResponse, startTime);
        }
        catch (error) {
            this.handleError(res, error, startTime, requestId);
        }
    }
    // ============================================================================
    // Response Handling
    // ============================================================================
    sendResponse(res, response, startTime) {
        const responseTime = Date.now() - startTime;
        // Set headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        res.setHeader('X-Request-ID', response.requestId || '');
        // Add API version headers
        if (response.apiVersion) {
            res.setHeader('X-API-Version', response.apiVersion);
        }
        // Add deprecation warnings
        if (response.warnings && response.warnings.length > 0) {
            res.setHeader('X-API-Warnings', response.warnings.join('; '));
        }
        // Set status code
        const statusCode = response.success ? 200 : 400;
        res.statusCode = statusCode;
        // Send response
        const responseBody = JSON.stringify({
            ...response,
            timestamp: response.timestamp || Date.now()
        });
        res.end(responseBody);
    }
    handleError(res, error, startTime, requestId) {
        const responseTime = Date.now() - startTime;
        this.logger.error('HTTP request error:', error);
        // Determine error details
        let statusCode = 500;
        let errorCode = 'INTERNAL_ERROR';
        let message = 'Internal server error';
        if (error instanceof types_1.MochiLinkError) {
            errorCode = error.code;
            message = error.message;
            // Map error types to HTTP status codes
            switch (error.code) {
                case 'AUTH_ERROR':
                case 'PERMISSION_DENIED':
                    statusCode = 403;
                    break;
                case 'SERVER_UNAVAILABLE':
                    statusCode = 503;
                    break;
                case 'VALIDATION_ERROR':
                    statusCode = 400;
                    break;
                default:
                    statusCode = 500;
            }
        }
        // Create error response
        const errorResponse = {
            success: false,
            error: errorCode,
            message,
            timestamp: Date.now(),
            requestId
        };
        // Set headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        res.setHeader('X-Request-ID', requestId);
        res.statusCode = statusCode;
        // Send error response
        res.end(JSON.stringify(errorResponse));
    }
    handleOptions(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Version, API-Version');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        res.statusCode = 200;
        res.end();
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    async parseRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    if (body.length === 0) {
                        resolve({});
                        return;
                    }
                    const contentType = req.headers['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        resolve(JSON.parse(body));
                    }
                    else {
                        resolve({ raw: body });
                    }
                }
                catch (error) {
                    reject(new Error('Invalid JSON in request body'));
                }
            });
            req.on('error', reject);
        });
    }
    getClientIP(req) {
        const forwarded = req.headers['x-forwarded-for'];
        const realIP = req.headers['x-real-ip'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        if (realIP) {
            return realIP;
        }
        return req.socket.remoteAddress || 'unknown';
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // ============================================================================
    // Public API
    // ============================================================================
    isListening() {
        return this.isRunning;
    }
    getAddress() {
        if (!this.server || !this.isRunning) {
            return null;
        }
        const address = this.server.address();
        if (typeof address === 'string') {
            return { host: 'localhost', port: parseInt(address) };
        }
        return address ? { host: address.address, port: address.port } : null;
    }
}
exports.HTTPServer = HTTPServer;
