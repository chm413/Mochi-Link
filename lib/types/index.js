"use strict";
/**
 * Mochi-Link (大福连) - Core Type Definitions
 *
 * This file contains all the core TypeScript interfaces and type definitions
 * for the Minecraft Unified Management and Monitoring System.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionModeError = exports.MaintenanceError = exports.ServerUnavailableError = exports.ProtocolError = exports.PermissionDeniedError = exports.AuthenticationError = exports.ConnectionError = exports.MochiLinkError = void 0;
// ============================================================================
// Error Types
// ============================================================================
class MochiLinkError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'MochiLinkError';
    }
}
exports.MochiLinkError = MochiLinkError;
class ConnectionError extends MochiLinkError {
    constructor(message, serverId, retryAfter) {
        super(message, 'CONNECTION_ERROR', { serverId, retryAfter });
        this.serverId = serverId;
        this.retryAfter = retryAfter;
        this.name = 'ConnectionError';
    }
}
exports.ConnectionError = ConnectionError;
class AuthenticationError extends MochiLinkError {
    constructor(message, serverId) {
        super(message, 'AUTH_ERROR', { serverId });
        this.serverId = serverId;
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class PermissionDeniedError extends MochiLinkError {
    constructor(message, userId, serverId, operation) {
        super(message, 'PERMISSION_DENIED', { userId, serverId, operation });
        this.userId = userId;
        this.serverId = serverId;
        this.operation = operation;
        this.name = 'PermissionDeniedError';
    }
}
exports.PermissionDeniedError = PermissionDeniedError;
class ProtocolError extends MochiLinkError {
    constructor(message, messageId, severity = 'minor') {
        super(message, 'PROTOCOL_ERROR', { messageId, severity });
        this.messageId = messageId;
        this.severity = severity;
        this.name = 'ProtocolError';
    }
}
exports.ProtocolError = ProtocolError;
class ServerUnavailableError extends MochiLinkError {
    constructor(message, serverId) {
        super(message, 'SERVER_UNAVAILABLE', { serverId });
        this.serverId = serverId;
        this.name = 'ServerUnavailableError';
    }
}
exports.ServerUnavailableError = ServerUnavailableError;
class MaintenanceError extends MochiLinkError {
    constructor(message, serverId, estimatedEnd) {
        super(message, 'MAINTENANCE_MODE', { serverId, estimatedEnd });
        this.serverId = serverId;
        this.estimatedEnd = estimatedEnd;
        this.name = 'MaintenanceError';
    }
}
exports.MaintenanceError = MaintenanceError;
class ConnectionModeError extends MochiLinkError {
    constructor(message, mode, serverId) {
        super(message, 'CONNECTION_MODE_ERROR', { mode, serverId });
        this.mode = mode;
        this.serverId = serverId;
        this.name = 'ConnectionModeError';
    }
}
exports.ConnectionModeError = ConnectionModeError;
