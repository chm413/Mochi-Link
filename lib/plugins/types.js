"use strict";
/**
 * Plugin Integration Types
 *
 * Type definitions for the plugin integration framework that allows
 * Mochi-Link to integrate with popular Minecraft plugins.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginOperationError = exports.PluginNotAvailableError = exports.PluginIntegrationError = void 0;
// ============================================================================
// Error Types
// ============================================================================
class PluginIntegrationError extends Error {
    constructor(message, pluginType, code, details) {
        super(message);
        this.pluginType = pluginType;
        this.code = code;
        this.details = details;
        this.name = 'PluginIntegrationError';
    }
}
exports.PluginIntegrationError = PluginIntegrationError;
class PluginNotAvailableError extends PluginIntegrationError {
    constructor(pluginType) {
        super(`Plugin integration '${pluginType}' is not available`, pluginType, 'PLUGIN_NOT_AVAILABLE');
        this.name = 'PluginNotAvailableError';
    }
}
exports.PluginNotAvailableError = PluginNotAvailableError;
class PluginOperationError extends PluginIntegrationError {
    constructor(pluginType, operation, error) {
        super(`Plugin operation '${operation}' failed: ${error}`, pluginType, 'PLUGIN_OPERATION_ERROR', { operation, error });
        this.name = 'PluginOperationError';
    }
}
exports.PluginOperationError = PluginOperationError;
