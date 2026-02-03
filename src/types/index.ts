/**
 * Mochi-Link (大福连) - Core Type Definitions
 * 
 * This file contains all the core TypeScript interfaces and type definitions
 * for the Minecraft Unified Management and Monitoring System.
 */

// ============================================================================
// Core System Types
// ============================================================================

export type CoreType = 'Java' | 'Bedrock';
export type ConnectionMode = 'plugin' | 'rcon' | 'terminal';
export type ServerStatus = 'online' | 'offline' | 'error' | 'maintenance';
export type ServerRole = 'owner' | 'admin' | 'moderator' | 'viewer';
export type OperationStatus = 'pending' | 'executing' | 'completed' | 'failed';

// ============================================================================
// Server Configuration Types
// ============================================================================

export interface ServerConfig {
  id: string;
  name: string;
  coreType: CoreType;
  coreName: string;
  coreVersion: string;
  connectionMode: ConnectionMode;
  connectionConfig: ConnectionConfig;
  status: ServerStatus;
  ownerId: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastSeen?: Date;
}

export interface ConnectionConfig {
  // Plugin connection mode
  plugin?: {
    host: string;
    port: number;
    ssl: boolean;
    path?: string;
  };
  
  // RCON connection mode
  rcon?: {
    host: string;
    port: number;
    password: string;
    timeout?: number;
  };
  
  // Terminal injection mode
  terminal?: {
    processId: number;
    workingDir: string;
    command: string;
    args?: string[];
  };
}

// ============================================================================
// Player Data Types
// ============================================================================

export interface Player {
  id: string;              // UUID or XUID
  name: string;
  displayName: string;
  world: string;
  position: Position;
  ping: number;
  isOp: boolean;
  permissions: string[];
  edition: 'Java' | 'Bedrock';
  deviceType?: string;
  ipAddress?: string;
}

export interface PlayerDetail extends Player {
  firstJoinAt: Date;
  lastSeenAt: Date;
  totalPlayTime: number;
  isPremium: boolean;
  identityConfidence: number;
  identityMarkers: IdentityMarkers;
}

export interface PlayerIdentity {
  uuid?: string;
  xuid?: string;
  name: string;
  confidence: number;
  markers: IdentityMarkers;
  conflicts: PlayerIdentity[];
}

export interface IdentityMarkers {
  ip?: string;
  device?: string;
  firstSeen?: Date;
  lastSeen?: Date;
  serverIds: string[];
}

export interface Position {
  x: number;
  y: number;
  z: number;
  yaw?: number;
  pitch?: number;
}

// ============================================================================
// U-WBP v2 Protocol Types
// ============================================================================

export type UWBPMessageType = 'request' | 'response' | 'event' | 'system';

export interface UWBPMessage {
  type: UWBPMessageType;
  id: string;
  op: string;
  data: any;
  timestamp?: number;
  serverId?: string;
  version?: string;
}

export interface UWBPRequest extends UWBPMessage {
  type: 'request';
  timeout?: number;
}

export interface UWBPResponse extends UWBPMessage {
  type: 'response';
  success: boolean;
  error?: string;
  requestId: string;
}

export interface UWBPEvent extends UWBPMessage {
  type: 'event';
  eventType: string;
}

export interface UWBPSystemMessage extends UWBPMessage {
  type: 'system';
  systemOp: 'ping' | 'pong' | 'disconnect' | 'handshake' | 'capabilities' | 'error';
}

// ============================================================================
// Event Types
// ============================================================================

export type EventType = 
  | 'player.join'
  | 'player.leave' 
  | 'player.chat'
  | 'player.death'
  | 'player.advancement'
  | 'server.status'
  | 'server.logLine'
  | 'alert.tpsLow'
  | 'alert.memoryHigh'
  | 'alert.playerFlood';

export interface BaseEvent {
  type: EventType;
  serverId: string;
  timestamp: number;
  version: string;
}

export interface PlayerJoinEvent extends BaseEvent {
  type: 'player.join';
  player: Player;
}

export interface PlayerLeaveEvent extends BaseEvent {
  type: 'player.leave';
  playerId: string;
  playerName: string;
  reason?: string;
}

export interface PlayerChatEvent extends BaseEvent {
  type: 'player.chat';
  playerId: string;
  playerName: string;
  message: string;
  channel?: string;
}

export interface ServerStatusEvent extends BaseEvent {
  type: 'server.status';
  status: ServerStatus;
  details?: any;
}

// ============================================================================
// Permission and Security Types
// ============================================================================

export interface Permission {
  serverId: string;
  operation: string;
  granted: boolean;
  inheritedFrom?: string;
}

export interface ServerACL {
  id: number;
  userId: string;
  serverId: string;
  role: ServerRole;
  permissions: string[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface APIToken {
  id: number;
  serverId: string;
  token: string;
  tokenHash: string;
  ipWhitelist?: string[];
  encryptionConfig?: EncryptionConfig;
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
}

export interface EncryptionConfig {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'RSA-OAEP';
  key?: string;
  iv?: string;
  publicKey?: string;
  privateKey?: string;
}

// ============================================================================
// Operation and Audit Types
// ============================================================================

export interface PendingOperation {
  id: number;
  serverId: string;
  operationType: string;
  target: string;
  parameters: any;
  status: OperationStatus;
  createdAt: Date;
  scheduledAt?: Date;
  executedAt?: Date;
  error?: string;
}

export interface AuditLog {
  id: number;
  userId?: string;
  serverId?: string;
  operation: string;
  operationData: any;
  result: 'success' | 'failure' | 'error';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================================================
// Command and Control Types
// ============================================================================

export interface CommandResult {
  success: boolean;
  output: string[];
  executionTime: number;
  error?: string;
}

export interface QuickAction {
  type: 'kick' | 'broadcast' | 'message' | 'time' | 'weather';
  parameters: any;
}

// ============================================================================
// Monitoring and Performance Types
// ============================================================================

export interface ServerInfo {
  serverId: string;
  name: string;
  version: string;
  coreType: CoreType;
  coreName: string;
  maxPlayers: number;
  onlinePlayers: number;
  uptime: number;
  tps: number;
  memoryUsage: MemoryInfo;
  worldInfo: WorldInfo[];
}

export interface MemoryInfo {
  used: number;
  max: number;
  free: number;
  percentage: number;
}

export interface WorldInfo {
  name: string;
  dimension: string;
  playerCount: number;
  loadedChunks: number;
}

export interface PerformanceMetrics {
  serverId: string;
  timestamp: number;
  tps: number;
  cpuUsage: number;
  memoryUsage: MemoryInfo;
  playerCount: number;
  ping: number;
  diskUsage?: DiskInfo;
}

export interface DiskInfo {
  used: number;
  total: number;
  free: number;
  percentage: number;
}

// ============================================================================
// Database Model Types
// ============================================================================

export interface DatabaseServer {
  id: string;
  name: string;
  core_type: string;
  core_name: string;
  core_version: string;
  connection_mode: string;
  connection_config: string; // JSON string
  status: string;
  owner_id: string;
  tags: string; // JSON string
  created_at: Date;
  updated_at: Date;
  last_seen?: Date;
}

export interface DatabaseServerACL {
  id: number;
  user_id: string;
  server_id: string;
  role: string;
  permissions: string; // JSON string
  granted_by: string;
  granted_at: Date;
  expires_at?: Date;
}

export interface DatabaseAPIToken {
  id: number;
  server_id: string;
  token: string;
  token_hash: string;
  ip_whitelist?: string; // JSON string
  encryption_config?: string; // JSON string
  created_at: Date;
  expires_at?: Date;
  last_used?: Date;
}

export interface DatabaseAuditLog {
  id: number;
  user_id?: string;
  server_id?: string;
  operation: string;
  operation_data: string; // JSON string
  result: string;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface DatabasePendingOperation {
  id: number;
  server_id: string;
  operation_type: string;
  target: string;
  parameters: string; // JSON string
  status: string;
  created_at: Date;
  scheduled_at?: Date;
  executed_at?: Date;
}

export interface DatabaseServerBinding {
  id: number;
  group_id: string;
  server_id: string;
  binding_type: string;
  config: string; // JSON string
  created_at: Date;
}

export interface DatabasePlayerCache {
  id: number;
  uuid?: string;
  xuid?: string;
  name: string;
  display_name?: string;
  last_server_id?: string;
  last_seen?: Date;
  identity_confidence: number;
  identity_markers: string; // JSON string
  is_premium?: boolean;
  device_type?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Service Interface Types
// ============================================================================

export interface Connection {
  serverId: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  mode: ConnectionMode;
  lastPing?: number;
  capabilities: string[];
  send(message: UWBPMessage): Promise<void>;
  close(): Promise<void>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  uptime: number;
  version: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: any;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface PluginConfig {
  // WebSocket server configuration
  websocket: {
    port: number;
    host: string;
    ssl?: {
      cert: string;
      key: string;
    };
  };
  
  // HTTP API configuration
  http?: {
    port: number;
    host: string;
    cors?: boolean;
  };
  
  // Database configuration
  database: {
    prefix: string;
  };
  
  // Security configuration
  security: {
    tokenExpiry: number; // in seconds
    maxConnections: number;
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
  };
  
  // Monitoring configuration
  monitoring: {
    reportInterval: number; // in seconds
    historyRetention: number; // in days
  };
  
  // Logging configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    auditRetention: number; // in days
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class MochiLinkError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MochiLinkError';
  }
}

export class ConnectionError extends MochiLinkError {
  constructor(message: string, public serverId: string, public retryAfter?: number) {
    super(message, 'CONNECTION_ERROR', { serverId, retryAfter });
    this.name = 'ConnectionError';
  }
}

export class AuthenticationError extends MochiLinkError {
  constructor(message: string, public serverId: string) {
    super(message, 'AUTH_ERROR', { serverId });
    this.name = 'AuthenticationError';
  }
}

export class PermissionDeniedError extends MochiLinkError {
  constructor(message: string, public userId: string, public serverId: string, public operation: string) {
    super(message, 'PERMISSION_DENIED', { userId, serverId, operation });
    this.name = 'PermissionDeniedError';
  }
}

export class ProtocolError extends MochiLinkError {
  constructor(
    message: string, 
    public messageId?: string, 
    public severity: 'minor' | 'major' | 'critical' = 'minor'
  ) {
    super(message, 'PROTOCOL_ERROR', { messageId, severity });
    this.name = 'ProtocolError';
  }
}

export class ServerUnavailableError extends MochiLinkError {
  constructor(message: string, public serverId: string) {
    super(message, 'SERVER_UNAVAILABLE', { serverId });
    this.name = 'ServerUnavailableError';
  }
}

export class MaintenanceError extends MochiLinkError {
  constructor(message: string, public serverId: string, public estimatedEnd?: Date) {
    super(message, 'MAINTENANCE_MODE', { serverId, estimatedEnd });
    this.name = 'MaintenanceError';
  }
}

export class ConnectionModeError extends MochiLinkError {
  constructor(message: string, public mode: string, public serverId: string) {
    super(message, 'CONNECTION_MODE_ERROR', { mode, serverId });
    this.name = 'ConnectionModeError';
  }
}