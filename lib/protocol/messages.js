"use strict";
/**
 * U-WBP v2 Protocol Message Definitions
 *
 * Defines all message types, operations, and data structures for the
 * Unified WebSocket Bridge Protocol version 2.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageUtils = exports.MessageFactory = exports.PROTOCOL_NAME = exports.UWBP_VERSION = void 0;
exports.isUWBPMessage = isUWBPMessage;
exports.isUWBPRequest = isUWBPRequest;
exports.isUWBPResponse = isUWBPResponse;
exports.isUWBPEvent = isUWBPEvent;
exports.isUWBPSystemMessage = isUWBPSystemMessage;
// ============================================================================
// Protocol Constants
// ============================================================================
exports.UWBP_VERSION = '2.0';
exports.PROTOCOL_NAME = 'U-WBP';
// ============================================================================
// Message Factories
// ============================================================================
class MessageFactory {
    /**
     * Create a request message
     */
    static createRequest(op, data = {}, options = {}) {
        return {
            type: 'request',
            id: options.id || this.generateId(),
            op,
            data,
            timestamp: Date.now(),
            serverId: options.serverId,
            version: exports.UWBP_VERSION,
            timeout: options.timeout
        };
    }
    /**
     * Create a response message
     */
    static createResponse(requestId, op, data = {}, options = {}) {
        return {
            type: 'response',
            id: this.generateId(),
            op,
            data,
            timestamp: Date.now(),
            serverId: options.serverId,
            version: exports.UWBP_VERSION,
            success: options.success ?? true,
            error: options.error,
            requestId
        };
    }
    /**
     * Create an event message
     */
    static createEvent(op, data = {}, options = {}) {
        return {
            type: 'event',
            id: this.generateId(),
            op,
            data,
            timestamp: Date.now(),
            serverId: options.serverId,
            version: exports.UWBP_VERSION,
            eventType: options.eventType || op
        };
    }
    /**
     * Create a system message
     */
    static createSystemMessage(op, data = {}, options = {}) {
        return {
            type: 'system',
            id: this.generateId(),
            op,
            data,
            timestamp: Date.now(),
            serverId: options.serverId,
            version: exports.UWBP_VERSION,
            systemOp: op
        };
    }
    /**
     * Create an error response
     */
    static createError(requestId, op, error, code, details) {
        return this.createResponse(requestId, op, { code, details }, {
            success: false,
            error
        });
    }
    /**
     * Generate a unique message ID
     */
    static generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.MessageFactory = MessageFactory;
// ============================================================================
// Message Type Guards
// ============================================================================
function isUWBPMessage(obj) {
    return !!(obj &&
        typeof obj === 'object' &&
        typeof obj.type === 'string' &&
        typeof obj.id === 'string' &&
        typeof obj.op === 'string' &&
        obj.data !== undefined);
}
function isUWBPRequest(obj) {
    return isUWBPMessage(obj) && obj.type === 'request';
}
function isUWBPResponse(obj) {
    return isUWBPMessage(obj) &&
        obj.type === 'response' &&
        typeof obj.success === 'boolean' &&
        typeof obj.requestId === 'string';
}
function isUWBPEvent(obj) {
    return isUWBPMessage(obj) &&
        obj.type === 'event' &&
        typeof obj.eventType === 'string';
}
function isUWBPSystemMessage(obj) {
    return isUWBPMessage(obj) &&
        obj.type === 'system' &&
        typeof obj.systemOp === 'string';
}
// ============================================================================
// Message Utilities
// ============================================================================
class MessageUtils {
    /**
     * Extract operation category from operation string
     */
    static getOperationCategory(op) {
        const parts = op.split('.');
        return parts[0] || 'unknown';
    }
    /**
     * Extract operation action from operation string
     */
    static getOperationAction(op) {
        const parts = op.split('.');
        return parts[1] || 'unknown';
    }
    /**
     * Check if operation requires authentication
     */
    static requiresAuth(op) {
        const authRequiredOps = [
            'server.shutdown',
            'server.restart',
            'server.reload',
            'player.kick',
            'player.ban',
            'player.unban',
            'whitelist.add',
            'whitelist.remove',
            'whitelist.enable',
            'whitelist.disable',
            'command.execute'
        ];
        return authRequiredOps.includes(op);
    }
    /**
     * Check if operation modifies server state
     */
    static isModifyingOperation(op) {
        const readOnlyOps = [
            'server.getInfo',
            'server.getStatus',
            'server.getMetrics',
            'player.list',
            'player.getInfo',
            'whitelist.get',
            'command.suggest',
            'world.list',
            'world.getInfo'
        ];
        return !readOnlyOps.includes(op);
    }
    /**
     * Get expected response time for operation (in milliseconds)
     */
    static getExpectedResponseTime(op) {
        const timeouts = {
            'server.shutdown': 30000,
            'server.restart': 60000,
            'server.reload': 15000,
            'server.save': 10000,
            'command.execute': 5000,
            'world.setTime': 1000,
            'world.setWeather': 1000,
            'world.broadcast': 1000
        };
        return timeouts[op] || 3000; // Default 3 seconds
    }
}
exports.MessageUtils = MessageUtils;
