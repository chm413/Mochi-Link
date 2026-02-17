/**
 * Connector Bridge Module
 *
 * Unified server operation interface that abstracts differences between
 * Java and Bedrock editions of Minecraft servers.
 */
export * from './types';
export { BaseConnectorBridge } from './base';
export { JavaConnectorBridge } from './java';
export { BedrockConnectorBridge } from './bedrock';
import { BridgeConfig } from './types';
import { CoreType } from '../types/index';
/**
 * Factory function to create the appropriate bridge instance
 */
export declare function createConnectorBridge(config: BridgeConfig, connectionAdapter?: any): any;
/**
 * Helper function to create bridge config from server config
 */
export declare function createBridgeConfig(serverId: string, coreType: CoreType, coreName: string, coreVersion: string, connectionConfig: any): BridgeConfig;
/**
 * Helper function to get supported capabilities for a server type
 */
export declare function getSupportedCapabilities(coreType: CoreType, coreName: string): string[];
