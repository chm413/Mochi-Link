/**
 * Connector Bridge Types
 * 
 * Type definitions for the unified server operation interface that abstracts
 * differences between Java and Bedrock editions.
 */

import { Player, PlayerDetail, Position, CommandResult, ServerInfo, PerformanceMetrics } from '../types/index';

// ============================================================================
// Core Bridge Types
// ============================================================================

export type BridgeCapability = 
  | 'player_management'
  | 'world_management'
  | 'command_execution'
  | 'performance_monitoring'
  | 'event_streaming'
  | 'plugin_integration'
  | 'whitelist_management'
  | 'ban_management'
  | 'operator_management'
  | 'server_control';

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

// ============================================================================
// Player Management Types
// ============================================================================

export interface PlayerAction {
  type: 'kick' | 'ban' | 'tempban' | 'mute' | 'tempmute' | 'warn' | 'teleport';
  target: string; // player name or UUID
  reason?: string;
  duration?: number; // in seconds for temporary actions
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
  id: string; // UUID or XUID
  name: string;
  addedBy: string;
  addedAt: Date;
  reason?: string;
}

export interface BanEntry {
  id: string; // UUID, XUID, or IP
  type: 'player' | 'ip';
  name?: string;
  reason: string;
  bannedBy: string;
  bannedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

// ============================================================================
// World Management Types
// ============================================================================

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

// ============================================================================
// Server Control Types
// ============================================================================

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

// ============================================================================
// Plugin Integration Types
// ============================================================================

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

// ============================================================================
// Event Types
// ============================================================================

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

// ============================================================================
// Configuration Types
// ============================================================================

export interface BridgeConfig {
  serverId: string;
  coreType: 'Java' | 'Bedrock';
  coreName: string;
  coreVersion: string;
  
  // Connection settings
  connection: {
    host: string;
    port: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  
  // Feature toggles
  features: {
    playerManagement: boolean;
    worldManagement: boolean;
    pluginIntegration: boolean;
    performanceMonitoring: boolean;
    eventStreaming: boolean;
  };
  
  // Core-specific settings
  coreSpecific: Record<string, any>;
}

// ============================================================================
// Error Types
// ============================================================================

export class BridgeError extends Error {
  constructor(
    message: string,
    public code: string,
    public serverId: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

export class UnsupportedOperationError extends BridgeError {
  constructor(operation: string, serverId: string, coreType: string) {
    super(
      `Operation '${operation}' is not supported on ${coreType} servers`,
      'UNSUPPORTED_OPERATION',
      serverId,
      { operation, coreType }
    );
    this.name = 'UnsupportedOperationError';
  }
}

export class BridgeConnectionError extends BridgeError {
  constructor(message: string, serverId: string, retryAfter?: number) {
    super(message, 'BRIDGE_CONNECTION_ERROR', serverId, { retryAfter });
    this.name = 'BridgeConnectionError';
  }
}

export class BridgeTimeoutError extends BridgeError {
  constructor(operation: string, serverId: string, timeout: number) {
    super(
      `Operation '${operation}' timed out after ${timeout}ms`,
      'BRIDGE_TIMEOUT',
      serverId,
      { operation, timeout }
    );
    this.name = 'BridgeTimeoutError';
  }
}