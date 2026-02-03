/**
 * Connector Bridge Module
 * 
 * Unified server operation interface that abstracts differences between
 * Java and Bedrock editions of Minecraft servers.
 */

// Export types
export * from './types';

// Export base class
export { BaseConnectorBridge } from './base';

// Export implementations
export { JavaConnectorBridge } from './java';
export { BedrockConnectorBridge } from './bedrock';

// Export factory function
import { BaseConnectorBridge } from './base';
import { JavaConnectorBridge } from './java';
import { BedrockConnectorBridge } from './bedrock';
import { BridgeConfig } from './types';
import { CoreType } from '../types/index';

/**
 * Factory function to create the appropriate bridge instance
 */
export function createConnectorBridge(
  config: BridgeConfig,
  connectionAdapter?: any
): any {
  switch (config.coreType) {
    case 'Java':
      return new JavaConnectorBridge(config, connectionAdapter);
    case 'Bedrock':
      return new BedrockConnectorBridge(config, connectionAdapter);
    default:
      throw new Error(`Unsupported core type: ${config.coreType}`);
  }
}

/**
 * Helper function to create bridge config from server config
 */
export function createBridgeConfig(
  serverId: string,
  coreType: CoreType,
  coreName: string,
  coreVersion: string,
  connectionConfig: any
): BridgeConfig {
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
export function getSupportedCapabilities(coreType: CoreType, coreName: string): string[] {
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
  } else if (coreType === 'Bedrock') {
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