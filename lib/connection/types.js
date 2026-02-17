"use strict";
/**
 * Connection Mode Management Types
 *
 * Type definitions for connection adapters, managers, and related functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionModeError = void 0;
const types_1 = require("../types");
// ============================================================================
// Connection Errors
// ============================================================================
class ConnectionModeError extends types_1.MochiLinkError {
    constructor(message, mode, serverId) {
        super(message, 'CONNECTION_MODE_ERROR', { mode, serverId });
        this.mode = mode;
        this.serverId = serverId;
        this.name = 'ConnectionModeError';
    }
}
exports.ConnectionModeError = ConnectionModeError;
