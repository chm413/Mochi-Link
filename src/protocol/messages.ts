/**
 * U-WBP v2 Protocol Message Definitions
 * 
 * Defines all message types, operations, and data structures for the
 * Unified WebSocket Bridge Protocol version 2.
 */

import { 
  UWBPMessage, 
  UWBPRequest, 
  UWBPResponse, 
  UWBPEvent, 
  UWBPSystemMessage,
  Player,
  PlayerDetail,
  ServerInfo,
  PerformanceMetrics,
  CommandResult
} from '../types';

// ============================================================================
// Protocol Constants
// ============================================================================

export const UWBP_VERSION = '2.0';
export const PROTOCOL_NAME = 'U-WBP';

// ============================================================================
// Operation Types
// ============================================================================

export type RequestOperation = 
  // Server management operations
  | 'server.getInfo'
  | 'server.getStatus'
  | 'server.getMetrics'
  | 'server.shutdown'
  | 'server.restart'
  | 'server.reload'
  | 'server.save'
  
  // Player management operations
  | 'player.list'
  | 'player.getInfo'
  | 'player.kick'
  | 'player.ban'
  | 'player.unban'
  | 'player.message'
  | 'player.teleport'
  
  // Whitelist operations
  | 'whitelist.get'
  | 'whitelist.add'
  | 'whitelist.remove'
  | 'whitelist.enable'
  | 'whitelist.disable'
  
  // Command operations
  | 'command.execute'
  | 'command.suggest'
  
  // World operations
  | 'world.list'
  | 'world.getInfo'
  | 'world.setTime'
  | 'world.setWeather'
  | 'world.broadcast';

export type EventOperation =
  // Player events
  | 'player.join'
  | 'player.leave'
  | 'player.chat'
  | 'player.death'
  | 'player.advancement'
  | 'player.move'
  
  // Server events
  | 'server.status'
  | 'server.logLine'
  | 'server.metrics'
  
  // Alert events
  | 'alert.tpsLow'
  | 'alert.memoryHigh'
  | 'alert.playerFlood'
  | 'alert.diskSpace'
  | 'alert.connectionLost';

export type SystemOperation =
  | 'ping'
  | 'pong'
  | 'handshake'
  | 'capabilities'
  | 'disconnect'
  | 'error';

// ============================================================================
// Message Factories
// ============================================================================

export class MessageFactory {
  /**
   * Create a request message
   */
  static createRequest(
    op: RequestOperation,
    data: any = {},
    options: {
      id?: string;
      serverId?: string;
      timeout?: number;
    } = {}
  ): UWBPRequest {
    return {
      type: 'request',
      id: options.id || this.generateId(),
      op,
      data,
      timestamp: Date.now(),
      serverId: options.serverId,
      version: UWBP_VERSION,
      timeout: options.timeout
    };
  }

  /**
   * Create a response message
   */
  static createResponse(
    requestId: string,
    op: string,
    data: any = {},
    options: {
      success?: boolean;
      error?: string;
      serverId?: string;
    } = {}
  ): UWBPResponse {
    return {
      type: 'response',
      id: this.generateId(),
      op,
      data,
      timestamp: Date.now(),
      serverId: options.serverId,
      version: UWBP_VERSION,
      success: options.success ?? true,
      error: options.error,
      requestId
    };
  }

  /**
   * Create an event message
   */
  static createEvent(
    op: EventOperation,
    data: any = {},
    options: {
      serverId?: string;
      eventType?: string;
    } = {}
  ): UWBPEvent {
    return {
      type: 'event',
      id: this.generateId(),
      op,
      data,
      timestamp: Date.now(),
      serverId: options.serverId,
      version: UWBP_VERSION,
      eventType: options.eventType || op
    };
  }

  /**
   * Create a system message
   */
  static createSystemMessage(
    op: SystemOperation,
    data: any = {},
    options: {
      serverId?: string;
    } = {}
  ): UWBPSystemMessage {
    return {
      type: 'system',
      id: this.generateId(),
      op,
      data,
      timestamp: Date.now(),
      serverId: options.serverId,
      version: UWBP_VERSION,
      systemOp: op
    };
  }

  /**
   * Create an error response
   */
  static createError(
    requestId: string,
    op: string,
    error: string,
    code?: string,
    details?: any
  ): UWBPResponse {
    return this.createResponse(requestId, op, { code, details }, {
      success: false,
      error
    });
  }

  /**
   * Generate a unique message ID
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Specific Message Data Types
// ============================================================================

// Server operation data types
export interface ServerInfoData {
  info: ServerInfo;
}

export interface ServerStatusData {
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'error';
  uptime?: number;
  playerCount?: number;
  maxPlayers?: number;
  tps?: number;
  memoryUsage?: {
    used: number;
    max: number;
    percentage: number;
  };
}

export interface ServerMetricsData {
  metrics: PerformanceMetrics;
}

// Player operation data types
export interface PlayerListData {
  players: Player[];
  online: number;
  max: number;
}

export interface PlayerInfoData {
  player: PlayerDetail;
}

export interface PlayerActionData {
  playerId: string;
  playerName?: string;
  reason?: string;
  message?: string;
  location?: {
    world: string;
    x: number;
    y: number;
    z: number;
  };
}

// Whitelist operation data types
export interface WhitelistData {
  enabled: boolean;
  players: string[];
}

export interface WhitelistActionData {
  playerId: string;
  playerName?: string;
}

// Command operation data types
export interface CommandExecuteData {
  command: string;
  sender?: string;
  timeout?: number;
}

export interface CommandResultData {
  result: CommandResult;
}

export interface CommandSuggestData {
  partial: string;
  suggestions: string[];
}

// World operation data types
export interface WorldListData {
  worlds: Array<{
    name: string;
    dimension: string;
    playerCount: number;
    loadedChunks: number;
  }>;
}

export interface WorldActionData {
  world?: string;
  time?: number | 'day' | 'night' | 'noon' | 'midnight';
  weather?: 'clear' | 'rain' | 'thunder';
  duration?: number;
  message?: string;
}

// Event data types
export interface PlayerJoinEventData {
  player: Player;
  firstJoin: boolean;
}

export interface PlayerLeaveEventData {
  playerId: string;
  playerName: string;
  reason?: 'quit' | 'kick' | 'ban' | 'timeout';
}

export interface PlayerChatEventData {
  playerId: string;
  playerName: string;
  message: string;
  channel?: string;
  recipients?: string[];
}

export interface PlayerDeathEventData {
  playerId: string;
  playerName: string;
  cause: string;
  killer?: string;
  location: {
    world: string;
    x: number;
    y: number;
    z: number;
  };
}

export interface ServerLogEventData {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  source?: string;
  thread?: string;
}

export interface AlertEventData {
  alertType: 'tps' | 'memory' | 'disk' | 'connection' | 'player';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
  details?: any;
}

// System message data types
export interface HandshakeData {
  protocolVersion: string;
  serverType: 'koishi' | 'connector';
  serverId?: string;
  capabilities: string[];
  authentication?: {
    token: string;
    method: 'token' | 'certificate';
  };
}

export interface CapabilitiesData {
  capabilities: string[];
  serverInfo?: {
    name: string;
    version: string;
    coreType: 'Java' | 'Bedrock';
    coreName: string;
  };
}

export interface DisconnectData {
  reason: string;
  code?: number;
  reconnect?: boolean;
  retryAfter?: number;
}

// ============================================================================
// Message Type Guards
// ============================================================================

export function isUWBPMessage(obj: any): obj is UWBPMessage {
  return !!(obj && 
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    typeof obj.id === 'string' &&
    typeof obj.op === 'string' &&
    obj.data !== undefined);
}

export function isUWBPRequest(obj: any): obj is UWBPRequest {
  return isUWBPMessage(obj) && obj.type === 'request';
}

export function isUWBPResponse(obj: any): obj is UWBPResponse {
  return isUWBPMessage(obj) && 
    obj.type === 'response' &&
    typeof (obj as any).success === 'boolean' &&
    typeof (obj as any).requestId === 'string';
}

export function isUWBPEvent(obj: any): obj is UWBPEvent {
  return isUWBPMessage(obj) && 
    obj.type === 'event' &&
    typeof (obj as any).eventType === 'string';
}

export function isUWBPSystemMessage(obj: any): obj is UWBPSystemMessage {
  return isUWBPMessage(obj) && 
    obj.type === 'system' &&
    typeof (obj as any).systemOp === 'string';
}

// ============================================================================
// Message Utilities
// ============================================================================

export class MessageUtils {
  /**
   * Extract operation category from operation string
   */
  static getOperationCategory(op: string): string {
    const parts = op.split('.');
    return parts[0] || 'unknown';
  }

  /**
   * Extract operation action from operation string
   */
  static getOperationAction(op: string): string {
    const parts = op.split('.');
    return parts[1] || 'unknown';
  }

  /**
   * Check if operation requires authentication
   */
  static requiresAuth(op: string): boolean {
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
  static isModifyingOperation(op: string): boolean {
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
  static getExpectedResponseTime(op: string): number {
    const timeouts: Record<string, number> = {
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