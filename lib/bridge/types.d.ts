/**
 * Connector Bridge Types
 *
 * Type definitions for the unified server operation interface that abstracts
 * differences between Java and Bedrock editions.
 */
import { Player, PerformanceMetrics } from '../types/index';
export type BridgeCapability = 'player_management' | 'world_management' | 'command_execution' | 'performance_monitoring' | 'event_streaming' | 'plugin_integration' | 'whitelist_management' | 'ban_management' | 'operator_management' | 'server_control';
export interface BridgeInfo {
    serverId: string;
    coreType: 'Java' | 'Bedrock';
    coreName: string;
    coreVersion: string;
    capabilities: BridgeCapability[];
    protocolVersion: string;
    isOnline: boolean;
    lastUpdate: Date;
}
export interface PlayerAction {
    type: 'kick' | 'ban' | 'tempban' | 'mute' | 'tempmute' | 'warn' | 'teleport';
    target: string;
    reason?: string;
    duration?: number;
    executor?: string;
    metadata?: Record<string, any>;
}
export interface PlayerActionResult {
    success: boolean;
    action: PlayerAction;
    timestamp: Date;
    error?: string;
    affectedPlayer?: Player;
}
export interface WhitelistEntry {
    id: string;
    name: string;
    addedBy: string;
    addedAt: Date;
    reason?: string;
}
export interface BanEntry {
    id: string;
    type: 'player' | 'ip';
    name?: string;
    reason: string;
    bannedBy: string;
    bannedAt: Date;
    expiresAt?: Date;
    isActive: boolean;
}
export interface WorldOperation {
    type: 'save' | 'backup' | 'reload' | 'unload' | 'load' | 'delete';
    worldName?: string;
    parameters?: Record<string, any>;
}
export interface WorldOperationResult {
    success: boolean;
    operation: WorldOperation;
    timestamp: Date;
    duration: number;
    error?: string;
    details?: Record<string, any>;
}
export interface WorldSettings {
    name: string;
    gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
    difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
    pvp: boolean;
    time: number;
    weather: 'clear' | 'rain' | 'thunder';
    gamerules: Record<string, any>;
}
export interface ServerOperation {
    type: 'start' | 'stop' | 'restart' | 'reload' | 'save' | 'backup';
    graceful?: boolean;
    timeout?: number;
    message?: string;
}
export interface ServerOperationResult {
    success: boolean;
    operation: ServerOperation;
    timestamp: Date;
    duration: number;
    error?: string;
    details?: Record<string, any>;
}
export interface PluginInfo {
    name: string;
    version: string;
    description?: string;
    authors: string[];
    enabled: boolean;
    dependencies: string[];
    softDependencies?: string[];
}
export interface PluginOperation {
    type: 'enable' | 'disable' | 'reload' | 'install' | 'uninstall';
    pluginName: string;
    parameters?: Record<string, any>;
}
export interface PluginOperationResult {
    success: boolean;
    operation: PluginOperation;
    timestamp: Date;
    error?: string;
    plugin?: PluginInfo;
}
export interface BridgeEvent {
    type: string;
    serverId: string;
    timestamp: Date;
    data: Record<string, any>;
    source: 'server' | 'plugin' | 'bridge';
}
export interface PlayerEvent extends BridgeEvent {
    playerId: string;
    playerName: string;
}
export interface ServerEvent extends BridgeEvent {
    serverStatus?: string;
    performance?: PerformanceMetrics;
}
export interface BridgeConfig {
    serverId: string;
    coreType: 'Java' | 'Bedrock';
    coreName: string;
    coreVersion: string;
    connection: {
        host: string;
        port: number;
        timeout: number;
        retryAttempts: number;
        retryDelay: number;
    };
    features: {
        playerManagement: boolean;
        worldManagement: boolean;
        pluginIntegration: boolean;
        performanceMonitoring: boolean;
        eventStreaming: boolean;
    };
    coreSpecific: Record<string, any>;
}
export declare class BridgeError extends Error {
    code: string;
    serverId: string;
    details?: any;
    constructor(message: string, code: string, serverId: string, details?: any);
}
export declare class UnsupportedOperationError extends BridgeError {
    constructor(operation: string, serverId: string, coreType: string);
}
export declare class BridgeConnectionError extends BridgeError {
    constructor(message: string, serverId: string, retryAfter?: number);
}
export declare class BridgeTimeoutError extends BridgeError {
    constructor(operation: string, serverId: string, timeout: number);
}
