"use strict";
/**
 * Connector Bridge Module
 *
 * Unified server operation interface that abstracts differences between
 * Java and Bedrock editions of Minecraft servers.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockConnectorBridge = exports.JavaConnectorBridge = exports.BaseConnectorBridge = void 0;
exports.createConnectorBridge = createConnectorBridge;
exports.createBridgeConfig = createBridgeConfig;
exports.getSupportedCapabilities = getSupportedCapabilities;
// Export types
__exportStar(require("./types"), exports);
// Export base class
var base_1 = require("./base");
Object.defineProperty(exports, "BaseConnectorBridge", { enumerable: true, get: function () { return base_1.BaseConnectorBridge; } });
// Export implementations
var java_1 = require("./java");
Object.defineProperty(exports, "JavaConnectorBridge", { enumerable: true, get: function () { return java_1.JavaConnectorBridge; } });
var bedrock_1 = require("./bedrock");
Object.defineProperty(exports, "BedrockConnectorBridge", { enumerable: true, get: function () { return bedrock_1.BedrockConnectorBridge; } });
const java_2 = require("./java");
const bedrock_2 = require("./bedrock");
/**
 * Factory function to create the appropriate bridge instance
 */
function createConnectorBridge(config, connectionAdapter) {
    switch (config.coreType) {
        case 'Java':
            return new java_2.JavaConnectorBridge(config, connectionAdapter);
        case 'Bedrock':
            return new bedrock_2.BedrockConnectorBridge(config, connectionAdapter);
        default:
            throw new Error(`Unsupported core type: ${config.coreType}`);
    }
}
/**
 * Helper function to create bridge config from server config
 */
function createBridgeConfig(serverId, coreType, coreName, coreVersion, connectionConfig) {
    return {
        serverId,
        coreType,
        coreName,
        coreVersion,
        connection: {
            host: connectionConfig.plugin?.host || connectionConfig.rcon?.host || 'localhost',
            port: connectionConfig.plugin?.port || connectionConfig.rcon?.port || 25565,
            timeout: connectionConfig.rcon?.timeout || 10000,
            retryAttempts: 3,
            retryDelay: 5000
        },
        features: {
            playerManagement: true,
            worldManagement: true,
            pluginIntegration: true,
            performanceMonitoring: true,
            eventStreaming: true
        },
        coreSpecific: {
            // Java-specific settings
            ...(coreType === 'Java' && {
                supportsPaper: coreName.toLowerCase().includes('paper'),
                supportsFolia: coreName.toLowerCase().includes('folia'),
                supportsSpigot: coreName.toLowerCase().includes('spigot')
            }),
            // Bedrock-specific settings
            ...(coreType === 'Bedrock' && {
                supportsLLBDS: coreName.toLowerCase().includes('llbds'),
                supportsPMMP: coreName.toLowerCase().includes('pmmp')
            })
        }
    };
}
/**
 * Helper function to get supported capabilities for a server type
 */
function getSupportedCapabilities(coreType, coreName) {
    const baseCapabilities = [
        'player_management',
        'command_execution',
        'performance_monitoring',
        'event_streaming',
        'whitelist_management',
        'ban_management',
        'operator_management'
    ];
    if (coreType === 'Java') {
        return [
            ...baseCapabilities,
            'world_management',
            'server_control',
            ...(coreName.toLowerCase().includes('paper') ||
                coreName.toLowerCase().includes('spigot') ||
                coreName.toLowerCase().includes('folia') ? ['plugin_integration'] : [])
        ];
    }
    else if (coreType === 'Bedrock') {
        return [
            ...baseCapabilities,
            ...(coreName.toLowerCase().includes('llbds') ||
                coreName.toLowerCase().includes('pmmp') ? [
                'world_management',
                'plugin_integration',
                'server_control'
            ] : [])
        ];
    }
    return baseCapabilities;
}
