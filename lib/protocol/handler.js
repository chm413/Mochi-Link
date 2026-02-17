"use strict";
/**
 * U-WBP v2 Protocol Handler
 *
 * Main protocol handler that coordinates message processing, validation,
 * routing, and response handling for the U-WBP v2 protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolHandler = void 0;
const types_1 = require("../types");
const validation_1 = require("./validation");
const serialization_1 = require("./serialization");
const router_1 = require("./router");
const messages_1 = require("./messages");
// ============================================================================
// Protocol Handler
// ============================================================================
class ProtocolHandler {
    constructor(router, config) {
        this.pendingRequests = new Map();
        this.requestQueue = [];
        this.activeRequests = 0;
        this.router = router || new router_1.MessageRouter();
        this.config = {
            validateIncoming: true,
            validateOutgoing: true,
            strictValidation: false,
            compressionEnabled: false,
            encryptionEnabled: false,
            defaultTimeout: 30000,
            maxTimeout: 300000,
            throwOnValidationError: false,
            logErrors: true,
            maxConcurrentRequests: 100,
            requestQueueSize: 1000,
            ...config
        };
        this.setupDefaultHandlers();
    }
    // ============================================================================
    // Message Processing
    // ============================================================================
    /**
     * Handle incoming message from connection
     */
    async handleMessage(connection, rawMessage) {
        try {
            // Deserialize message
            const deserializeResult = serialization_1.MessageSerializer.deserialize(rawMessage, {
                validate: this.config.validateIncoming,
                strictValidation: this.config.strictValidation,
                throwOnError: this.config.throwOnValidationError,
                decrypt: this.config.encryptionEnabled,
                decryptionKey: this.config.encryptionKey
            });
            if (!deserializeResult.success) {
                throw new types_1.ProtocolError(`Failed to deserialize message: ${deserializeResult.error}`);
            }
            const message = deserializeResult.message;
            // Log warnings if any
            if (deserializeResult.warnings && deserializeResult.warnings.length > 0) {
                console.warn('Message validation warnings:', deserializeResult.warnings);
            }
            // Route message
            const response = await this.router.route(message, connection);
            // Send response if one was generated
            if (response) {
                await this.sendMessage(connection, response);
            }
        }
        catch (error) {
            await this.handleError(error, connection);
        }
    }
    /**
     * Send message through connection
     */
    async sendMessage(connection, message) {
        try {
            // Validate outgoing message
            if (this.config.validateOutgoing) {
                const validationResult = validation_1.MessageValidator.validate(message);
                if (!validationResult.valid && this.config.strictValidation) {
                    throw new types_1.ProtocolError(`Outgoing message validation failed: ${validation_1.ValidationUtils.getValidationSummary(validationResult)}`, message.id);
                }
            }
            // Serialize message
            const serializeResult = serialization_1.MessageSerializer.serialize(message, {
                validate: this.config.validateOutgoing,
                strictValidation: this.config.strictValidation,
                compress: this.config.compressionEnabled,
                encrypt: this.config.encryptionEnabled,
                encryptionKey: this.config.encryptionKey
            });
            if (!serializeResult.success) {
                throw new types_1.ProtocolError(`Failed to serialize message: ${serializeResult.error}`, message.id);
            }
            // Send through connection
            await connection.send(message);
        }
        catch (error) {
            await this.handleError(error, connection, message);
        }
    }
    // ============================================================================
    // Request/Response Handling
    // ============================================================================
    /**
     * Send request and wait for response
     */
    async sendRequest(connection, operation, data = {}, options = {}) {
        // Check request limits
        if (this.activeRequests >= this.config.maxConcurrentRequests) {
            if (this.requestQueue.length >= this.config.requestQueueSize) {
                throw new types_1.ProtocolError('Request queue full');
            }
            // Queue the request (simplified implementation)
            throw new types_1.ProtocolError('Too many concurrent requests');
        }
        const timeout = Math.min(options.timeout || this.config.defaultTimeout, this.config.maxTimeout);
        const request = messages_1.MessageFactory.createRequest(operation, data, {
            serverId: options.serverId,
            timeout
        });
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timer = setTimeout(() => {
                this.pendingRequests.delete(request.id);
                this.activeRequests--;
                reject(new types_1.ProtocolError(`Request timeout: ${operation}`, request.id));
            }, timeout);
            // Track pending request
            const pendingRequest = {
                id: request.id,
                operation,
                timestamp: Date.now(),
                timeout,
                resolve,
                reject,
                timer
            };
            this.pendingRequests.set(request.id, pendingRequest);
            this.activeRequests++;
            // Send request
            this.sendMessage(connection, request).catch(error => {
                clearTimeout(timer);
                this.pendingRequests.delete(request.id);
                this.activeRequests--;
                reject(error);
            });
        });
    }
    /**
     * Handle incoming response
     */
    async handleResponse(response, connection) {
        const pendingRequest = this.pendingRequests.get(response.requestId);
        if (!pendingRequest) {
            // Response for unknown request - might be late or duplicate
            console.warn(`Received response for unknown request: ${response.requestId}`);
            return;
        }
        // Clear timeout and remove from pending
        clearTimeout(pendingRequest.timer);
        this.pendingRequests.delete(response.requestId);
        this.activeRequests--;
        // Resolve or reject based on response
        if (response.success) {
            pendingRequest.resolve(response);
        }
        else {
            const error = new types_1.ProtocolError(response.error || 'Request failed', response.requestId);
            pendingRequest.reject(error);
        }
    }
    // ============================================================================
    // Event Handling
    // ============================================================================
    /**
     * Send event message
     */
    async sendEvent(connection, operation, data = {}, options = {}) {
        const event = messages_1.MessageFactory.createEvent(operation, data, options);
        await this.sendMessage(connection, event);
    }
    /**
     * Broadcast event to multiple connections
     */
    async broadcastEvent(connections, operation, data = {}, options = {}) {
        const event = messages_1.MessageFactory.createEvent(operation, data, options);
        // Send to all connections in parallel
        const promises = connections.map(connection => this.sendMessage(connection, event).catch(error => {
            console.error(`Failed to send event to ${connection.serverId}:`, error);
        }));
        await Promise.allSettled(promises);
    }
    // ============================================================================
    // System Message Handling
    // ============================================================================
    /**
     * Send system message
     */
    async sendSystemMessage(connection, operation, data = {}, options = {}) {
        const message = messages_1.MessageFactory.createSystemMessage(operation, data, options);
        // Send the system message
        await this.sendMessage(connection, message);
        // Return the message itself since it's a system message
        return message;
    }
    /**
     * Perform handshake with connection
     */
    async performHandshake(connection, capabilities, serverType = 'koishi') {
        const handshakeData = {
            protocolVersion: '2.0',
            serverType,
            capabilities,
            serverId: connection.serverId
        };
        await this.sendSystemMessage(connection, 'handshake', handshakeData);
    }
    // ============================================================================
    // Handler Registration
    // ============================================================================
    /**
     * Register request handler
     */
    onRequest(operation, handler) {
        this.router.registerRequestHandler(operation, handler);
    }
    /**
     * Register event handler
     */
    onEvent(operation, handler) {
        this.router.registerEventHandler(operation, handler);
    }
    /**
     * Register system message handler
     */
    onSystem(operation, handler) {
        this.router.registerSystemHandler(operation, handler);
    }
    // ============================================================================
    // Error Handling
    // ============================================================================
    async handleError(error, connection, originalMessage) {
        if (this.config.logErrors) {
            console.error('Protocol handler error:', {
                error: error instanceof Error ? error.message : String(error),
                serverId: connection.serverId,
                messageId: originalMessage?.id,
                operation: originalMessage?.op
            });
        }
        // Send error response for requests
        if (originalMessage && originalMessage.type === 'request') {
            const errorResponse = messages_1.MessageFactory.createError(originalMessage.id, originalMessage.op, error instanceof Error ? error.message : String(error), error instanceof types_1.ProtocolError ? error.code : 'HANDLER_ERROR');
            try {
                await this.sendMessage(connection, errorResponse);
            }
            catch (sendError) {
                console.error('Failed to send error response:', sendError);
            }
        }
    }
    // ============================================================================
    // Default Handlers
    // ============================================================================
    setupDefaultHandlers() {
        // Handle responses
        this.router.registerResponseHandler = (requestId, handler) => {
            // Override to use our response handling
            this.router.registerResponseHandler(requestId, async (response, connection) => {
                await this.handleResponse(response, connection);
            });
        };
        // Default ping handler
        this.onSystem('ping', async (message, connection) => {
            return messages_1.MessageFactory.createSystemMessage('pong', {
                timestamp: Date.now(),
                originalId: message.id
            });
        });
        // Default pong handler
        this.onSystem('pong', async (message, connection) => {
            // Update connection last ping time
            if (connection.lastPing !== undefined) {
                connection.lastPing = Date.now() - (message.data?.timestamp || Date.now());
            }
        });
        // Default capabilities handler
        this.onSystem('capabilities', async (message, connection) => {
            // Store connection capabilities
            if (Array.isArray(message.data?.capabilities)) {
                connection.capabilities = message.data.capabilities;
            }
        });
    }
    // ============================================================================
    // Cleanup and Management
    // ============================================================================
    /**
     * Clean up expired requests
     */
    cleanup() {
        const now = Date.now();
        const expiredRequests = [];
        for (const [id, request] of this.pendingRequests) {
            if (now - request.timestamp > request.timeout) {
                expiredRequests.push(id);
            }
        }
        for (const id of expiredRequests) {
            const request = this.pendingRequests.get(id);
            if (request) {
                clearTimeout(request.timer);
                this.pendingRequests.delete(id);
                this.activeRequests--;
                request.reject(new types_1.ProtocolError(`Request expired: ${request.operation}`, id));
            }
        }
    }
    /**
     * Get handler statistics
     */
    getStats() {
        return {
            pendingRequests: this.pendingRequests.size,
            activeRequests: this.activeRequests,
            queuedRequests: this.requestQueue.length,
            routerStats: this.router.getStats()
        };
    }
    /**
     * Shutdown handler
     */
    async shutdown() {
        // Cancel all pending requests
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timer);
            request.reject(new types_1.ProtocolError('Handler shutting down', id));
        }
        this.pendingRequests.clear();
        this.requestQueue.length = 0;
        this.activeRequests = 0;
    }
}
exports.ProtocolHandler = ProtocolHandler;
