"use strict";
/**
 * U-WBP v2 Protocol Message Router
 *
 * Handles routing of U-WBP messages to appropriate handlers based on
 * message type, operation, and routing rules.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRouter = exports.authMiddleware = exports.metricsMiddleware = exports.loggingMiddleware = exports.MessageRouter = void 0;
const types_1 = require("../types");
const messages_1 = require("./messages");
// ============================================================================
// Message Router
// ============================================================================
class MessageRouter {
    constructor() {
        this.requestHandlers = new Map();
        this.eventHandlers = new Map();
        this.systemHandlers = new Map();
        this.responseHandlers = new Map(); // keyed by requestId
        this.globalMiddleware = [];
        this.defaultTimeout = 30000; // 30 seconds
    }
    // ============================================================================
    // Handler Registration
    // ============================================================================
    /**
     * Register a request handler
     */
    registerRequestHandler(operation, handler, config = {}) {
        const routeConfig = {
            operation,
            handler,
            timeout: config.timeout || messages_1.MessageUtils.getExpectedResponseTime(operation),
            priority: config.priority || 0,
            ...config
        };
        this.requestHandlers.set(operation, routeConfig);
    }
    /**
     * Register an event handler
     */
    registerEventHandler(operation, handler, config = {}) {
        const routeConfig = {
            operation,
            handler,
            priority: config.priority || 0,
            ...config
        };
        this.eventHandlers.set(operation, routeConfig);
    }
    /**
     * Register a system message handler
     */
    registerSystemHandler(operation, handler, config = {}) {
        const routeConfig = {
            operation,
            handler,
            priority: config.priority || 0,
            ...config
        };
        this.systemHandlers.set(operation, routeConfig);
    }
    /**
     * Register a response handler for a specific request
     */
    registerResponseHandler(requestId, handler) {
        this.responseHandlers.set(requestId, handler);
    }
    /**
     * Unregister a response handler
     */
    unregisterResponseHandler(requestId) {
        this.responseHandlers.delete(requestId);
    }
    /**
     * Add global middleware
     */
    use(middleware) {
        this.globalMiddleware.push(middleware);
    }
    // ============================================================================
    // Message Routing
    // ============================================================================
    /**
     * Route a message to the appropriate handler
     */
    async route(message, connection) {
        const context = {
            message,
            connection,
            startTime: Date.now(),
            metadata: {}
        };
        try {
            // Find the appropriate route
            const route = this.findRoute(message);
            context.route = route;
            // Execute middleware chain
            await this.executeMiddleware(context);
            // Route based on message type
            switch (message.type) {
                case 'request':
                    return await this.routeRequest(message, context);
                case 'response':
                    await this.routeResponse(message, context);
                    break;
                case 'event':
                    await this.routeEvent(message, context);
                    break;
                case 'system':
                    await this.routeSystemMessage(message, context);
                    break;
                default:
                    throw new types_1.ProtocolError(`Unknown message type: ${message.type}`, message.id);
            }
        }
        catch (error) {
            await this.handleRoutingError(error, context);
            // Return error response for requests
            if ((0, messages_1.isUWBPRequest)(message)) {
                const { MessageFactory } = await Promise.resolve().then(() => __importStar(require('./messages')));
                return MessageFactory.createError(message.id, message.op, error instanceof Error ? error.message : String(error), error instanceof types_1.ProtocolError ? error.code : 'ROUTING_ERROR');
            }
            throw error;
        }
    }
    // ============================================================================
    // Route Handlers
    // ============================================================================
    async routeRequest(request, context) {
        if (!(0, messages_1.isUWBPRequest)(request)) {
            throw new types_1.ProtocolError('Invalid request message', request.id);
        }
        const handler = this.requestHandlers.get(request.op);
        if (!handler) {
            throw new types_1.ProtocolError(`No handler registered for operation: ${request.op}`, request.id);
        }
        // Check permissions
        await this.checkPermissions(handler, context);
        // Apply rate limiting
        await this.applyRateLimit(handler, context);
        // Execute handler with timeout
        const timeout = handler.timeout || this.defaultTimeout;
        const response = await this.executeWithTimeout(() => handler.handler(request, context.connection), timeout, `Request handler timeout for ${request.op}`);
        return response;
    }
    async routeResponse(response, context) {
        if (!(0, messages_1.isUWBPResponse)(response)) {
            throw new types_1.ProtocolError('Invalid response message', response.id);
        }
        const handler = this.responseHandlers.get(response.requestId);
        if (handler) {
            await handler(response, context.connection);
            this.responseHandlers.delete(response.requestId);
        }
        // Note: It's not an error if no response handler is registered
        // The response might be handled by a different mechanism
    }
    async routeEvent(event, context) {
        if (!(0, messages_1.isUWBPEvent)(event)) {
            throw new types_1.ProtocolError('Invalid event message', event.id);
        }
        const handler = this.eventHandlers.get(event.op);
        if (!handler) {
            // Events without handlers are not necessarily errors
            // They might be informational or handled by other systems
            return;
        }
        // Check permissions
        await this.checkPermissions(handler, context);
        // Execute handler
        await handler.handler(event, context.connection);
    }
    async routeSystemMessage(message, context) {
        if (!(0, messages_1.isUWBPSystemMessage)(message)) {
            throw new types_1.ProtocolError('Invalid system message', message.id);
        }
        const handler = this.systemHandlers.get(message.systemOp);
        if (!handler) {
            throw new types_1.ProtocolError(`No handler registered for system operation: ${message.systemOp}`, message.id);
        }
        // System messages typically don't require permission checks
        // Execute handler
        return await handler.handler(message, context.connection);
    }
    // ============================================================================
    // Route Discovery
    // ============================================================================
    findRoute(message) {
        switch (message.type) {
            case 'request':
                return this.requestHandlers.get(message.op);
            case 'event':
                return this.eventHandlers.get(message.op);
            case 'system':
                return this.systemHandlers.get(message.systemOp);
            default:
                return undefined;
        }
    }
    // ============================================================================
    // Middleware Execution
    // ============================================================================
    async executeMiddleware(context) {
        const middleware = [
            ...this.globalMiddleware,
            ...(context.route?.middleware || [])
        ];
        let index = 0;
        const next = async () => {
            if (index >= middleware.length) {
                return;
            }
            const currentMiddleware = middleware[index++];
            await currentMiddleware(context.message, context.connection, next);
        };
        await next();
    }
    // ============================================================================
    // Security and Rate Limiting
    // ============================================================================
    async checkPermissions(handler, context) {
        if (!handler.permissions || handler.permissions.length === 0) {
            return;
        }
        // Note: In a real implementation, you would integrate with the permission system
        // For now, we'll assume permissions are checked elsewhere
        const hasPermission = true; // Placeholder
        if (!hasPermission) {
            throw new types_1.ProtocolError(`Insufficient permissions for operation: ${handler.operation}`, context.message.id);
        }
    }
    async applyRateLimit(handler, context) {
        if (!handler.rateLimit) {
            return;
        }
        // Note: In a real implementation, you would use a proper rate limiting mechanism
        // For now, we'll skip rate limiting
        const rateLimitExceeded = false; // Placeholder
        if (rateLimitExceeded) {
            throw new types_1.ProtocolError(`Rate limit exceeded for operation: ${handler.operation}`, context.message.id);
        }
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    async executeWithTimeout(operation, timeoutMs, errorMessage) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new types_1.ProtocolError(errorMessage));
            }, timeoutMs);
            operation()
                .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    async handleRoutingError(error, context) {
        // Log the error
        console.error('Routing error:', {
            messageId: context.message.id,
            operation: context.message.op,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - context.startTime
        });
        // Additional error handling could be added here
        // such as metrics collection, alerting, etc.
    }
    // ============================================================================
    // Router Management
    // ============================================================================
    /**
     * Get all registered routes
     */
    getRoutes() {
        return {
            requests: new Map(this.requestHandlers),
            events: new Map(this.eventHandlers),
            system: new Map(this.systemHandlers)
        };
    }
    /**
     * Clear all handlers
     */
    clear() {
        this.requestHandlers.clear();
        this.eventHandlers.clear();
        this.systemHandlers.clear();
        this.responseHandlers.clear();
        this.globalMiddleware.length = 0;
    }
    /**
     * Get router statistics
     */
    getStats() {
        return {
            requestHandlers: this.requestHandlers.size,
            eventHandlers: this.eventHandlers.size,
            systemHandlers: this.systemHandlers.size,
            responseHandlers: this.responseHandlers.size,
            globalMiddleware: this.globalMiddleware.length
        };
    }
}
exports.MessageRouter = MessageRouter;
// ============================================================================
// Built-in Middleware
// ============================================================================
/**
 * Logging middleware
 */
const loggingMiddleware = async (message, connection, next) => {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] ${message.type.toUpperCase()} ${message.op} from ${connection.serverId}`);
    try {
        await next();
    }
    finally {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] Completed ${message.op} in ${duration}ms`);
    }
};
exports.loggingMiddleware = loggingMiddleware;
/**
 * Metrics collection middleware
 */
const metricsMiddleware = async (message, connection, next) => {
    const start = Date.now();
    try {
        await next();
        // Record success metrics
    }
    catch (error) {
        // Record error metrics
        throw error;
    }
    finally {
        const duration = Date.now() - start;
        // Record timing metrics
    }
};
exports.metricsMiddleware = metricsMiddleware;
/**
 * Authentication middleware
 */
const authMiddleware = async (message, connection, next) => {
    // Check if operation requires authentication
    if (messages_1.MessageUtils.requiresAuth(message.op)) {
        // Verify connection is authenticated
        if (!connection.serverId) {
            throw new types_1.ProtocolError('Authentication required', message.id);
        }
    }
    await next();
};
exports.authMiddleware = authMiddleware;
// ============================================================================
// Default Router Instance
// ============================================================================
exports.defaultRouter = new MessageRouter();
// Add default middleware
exports.defaultRouter.use(exports.loggingMiddleware);
exports.defaultRouter.use(exports.authMiddleware);
exports.defaultRouter.use(exports.metricsMiddleware);
