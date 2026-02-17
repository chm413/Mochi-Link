"use strict";
/**
 * Connector Bridge Types
 *
 * Type definitions for the unified server operation interface that abstracts
 * differences between Java and Bedrock editions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeTimeoutError = exports.BridgeConnectionError = exports.UnsupportedOperationError = exports.BridgeError = void 0;
// ============================================================================
// Error Types
// ============================================================================
class BridgeError extends Error {
    constructor(message, code, serverId, details) {
        super(message);
        this.code = code;
        this.serverId = serverId;
        this.details = details;
        this.name = 'BridgeError';
    }
}
exports.BridgeError = BridgeError;
class UnsupportedOperationError extends BridgeError {
    constructor(operation, serverId, coreType) {
        super(`Operation '${operation}' is not supported on ${coreType} servers`, 'UNSUPPORTED_OPERATION', serverId, { operation, coreType });
        this.name = 'UnsupportedOperationError';
    }
}
exports.UnsupportedOperationError = UnsupportedOperationError;
class BridgeConnectionError extends BridgeError {
    constructor(message, serverId, retryAfter) {
        super(message, 'BRIDGE_CONNECTION_ERROR', serverId, { retryAfter });
        this.name = 'BridgeConnectionError';
    }
}
exports.BridgeConnectionError = BridgeConnectionError;
class BridgeTimeoutError extends BridgeError {
    constructor(operation, serverId, timeout) {
        super(`Operation '${operation}' timed out after ${timeout}ms`, 'BRIDGE_TIMEOUT', serverId, { operation, timeout });
        this.name = 'BridgeTimeoutError';
    }
}
exports.BridgeTimeoutError = BridgeTimeoutError;
