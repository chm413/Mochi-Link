/**
 * HTTP API Types and Interfaces
 * 
 * This file contains all type definitions for the HTTP API endpoints,
 * request/response schemas, and related interfaces.
 */

import { ServerConfig, Player, PlayerDetail, CommandResult, AuditLog, PerformanceMetrics } from '../types';

// ============================================================================
// Common API Types
// ============================================================================

export interface HTTPRequest {
  method: string;
  url: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: any;
  context: RequestContext;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  serverId?: string;
  playerId?: string;
  banId?: string;
  alertId?: string;
  bindingId?: string;
  groupId?: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
  requestId?: string;
  version?: string;
  apiVersion?: string;
  supportedVersions?: string[];
  warnings?: string[];
  headers?: Record<string, string>;
  statusCode?: number;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// ============================================================================
// Server Management API Types
// ============================================================================

export interface ServerSummary {
  id: string;
  name: string;
  coreType: 'Java' | 'Bedrock';
  coreName: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  playerCount: number;
  maxPlayers: number;
  uptime?: number;
  lastSeen?: string;
  tags: string[];
}

export interface GetServersResponse extends PaginatedResponse<ServerSummary> {}

export interface GetServerResponse extends APIResponse<ServerConfig> {}

export interface CreateServerRequest {
  name: string;
  coreType: 'Java' | 'Bedrock';
  coreName: string;
  coreVersion?: string;
  connectionMode: 'plugin' | 'rcon' | 'terminal';
  connectionConfig: {
    plugin?: {
      host: string;
      port: number;
      ssl?: boolean;
      path?: string;
    };
    rcon?: {
      host: string;
      port: number;
      password: string;
      timeout?: number;
    };
    terminal?: {
      processId: number;
      workingDir: string;
      command: string;
      args?: string[];
    };
  };
  tags?: string[];
}

export interface CreateServerResponse extends APIResponse<{ serverId: string; token: string }> {}

export interface UpdateServerRequest {
  name?: string;
  connectionConfig?: Partial<CreateServerRequest['connectionConfig']>;
  tags?: string[];
}

export interface UpdateServerResponse extends APIResponse<ServerConfig> {}

// ============================================================================
// Player Management API Types
// ============================================================================

export interface GetPlayersResponse extends PaginatedResponse<Player> {
  summary: {
    online: number;
    total: number;
    byEdition: {
      java: number;
      bedrock: number;
    };
  };
}

export interface GetPlayerResponse extends APIResponse<PlayerDetail> {}

export interface KickPlayerRequest {
  reason: string;
}

export interface KickPlayerResponse extends APIResponse<{ success: boolean }> {}

export interface PlayerSearchQuery {
  name?: string;
  uuid?: string;
  xuid?: string;
  ip?: string;
  world?: string;
  isOp?: boolean;
  edition?: 'Java' | 'Bedrock';
}

// ============================================================================
// Whitelist Management API Types
// ============================================================================

export interface WhitelistEntry {
  playerId: string;
  playerName: string;
  addedBy: string;
  addedAt: string;
  synced: boolean;
}

export interface GetWhitelistResponse extends APIResponse<WhitelistEntry[]> {
  metadata: {
    synced: boolean;
    lastSync: string;
    pendingOperations: number;
  };
}

export interface AddWhitelistRequest {
  playerId: string;
  playerName?: string;
}

export interface AddWhitelistResponse extends APIResponse<{ success: boolean; cached?: boolean }> {}

export interface RemoveWhitelistRequest {
  playerId: string;
}

export interface RemoveWhitelistResponse extends APIResponse<{ success: boolean; cached?: boolean }> {}

// ============================================================================
// Ban Management API Types
// ============================================================================

export interface BanEntry {
  id: string;
  type: 'player' | 'ip' | 'device';
  target: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  expiresAt?: string;
  active: boolean;
}

export interface GetBansResponse extends PaginatedResponse<BanEntry> {}

export interface CreateBanRequest {
  type: 'player' | 'ip' | 'device';
  target: string;
  reason: string;
  duration?: number; // in seconds, undefined for permanent
}

export interface CreateBanResponse extends APIResponse<{ banId: string }> {}

export interface UpdateBanRequest {
  reason?: string;
  expiresAt?: string;
  active?: boolean;
}

export interface UpdateBanResponse extends APIResponse<BanEntry> {}

// ============================================================================
// Command Execution API Types
// ============================================================================

export interface ExecuteCommandRequest {
  command: string;
  timeout?: number;
}

export interface ExecuteCommandResponse extends APIResponse<CommandResult> {}

export interface QuickActionRequest {
  action: 'kick' | 'broadcast' | 'message' | 'time' | 'weather' | 'save' | 'reload';
  parameters: {
    // For kick action
    playerId?: string;
    reason?: string;
    
    // For broadcast/message actions
    message?: string;
    targetPlayerId?: string; // for private message
    
    // For time action
    time?: number | 'day' | 'night';
    
    // For weather action
    weather?: 'clear' | 'rain' | 'thunder';
  };
}

export interface QuickActionResponse extends APIResponse<{ success: boolean; result?: any }> {}

// ============================================================================
// Monitoring API Types
// ============================================================================

export interface ServerStatusResponse extends APIResponse<{
  serverId: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  uptime: number;
  playerCount: number;
  maxPlayers: number;
  tps: number;
  memoryUsage: {
    used: number;
    max: number;
    percentage: number;
  };
  lastUpdate: string;
}> {}

export interface PerformanceHistoryQuery {
  startTime?: string;
  endTime?: string;
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
  metrics?: ('tps' | 'memory' | 'cpu' | 'players')[];
}

export interface PerformanceHistoryResponse extends APIResponse<PerformanceMetrics[]> {}

export interface AlertsResponse extends PaginatedResponse<{
  id: string;
  type: 'tps_low' | 'memory_high' | 'player_flood' | 'connection_lost';
  serverId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}> {}

// ============================================================================
// Binding Management API Types
// ============================================================================

export interface BindingEntry {
  id: number;
  groupId: string;
  serverId: string;
  bindingType: 'chat' | 'event' | 'command' | 'monitoring';
  config: {
    chat?: {
      enabled: boolean;
      bidirectional: boolean;
      messageFormat?: string;
      filterRules?: Array<{
        type: 'regex' | 'keyword' | 'user' | 'length';
        pattern: string;
        action: 'allow' | 'block' | 'transform';
        replacement?: string;
      }>;
      rateLimiting?: {
        maxMessages: number;
        windowMs: number;
      };
    };
    event?: {
      enabled: boolean;
      eventTypes: string[];
      format?: string;
      filters?: Array<{
        eventType: string;
        conditions?: any;
        action: 'allow' | 'block' | 'transform';
      }>;
    };
    command?: {
      enabled: boolean;
      allowedCommands: string[];
      requiredRole?: string;
      prefix?: string;
    };
    monitoring?: {
      enabled: boolean;
      alertTypes: string[];
      threshold?: any;
    };
  };
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  lastActivity?: string;
}

export interface GetBindingsResponse extends PaginatedResponse<BindingEntry> {}

export interface GetBindingResponse extends APIResponse<BindingEntry> {}

export interface CreateBindingRequest {
  groupId: string;
  serverId: string;
  bindingType: 'chat' | 'event' | 'command' | 'monitoring';
  config: BindingEntry['config'];
  priority?: number;
}

export interface CreateBindingResponse extends APIResponse<{ bindingId: number }> {}

export interface UpdateBindingRequest {
  config?: Partial<BindingEntry['config']>;
  bindingType?: 'chat' | 'event' | 'command' | 'monitoring';
  priority?: number;
}

export interface UpdateBindingResponse extends APIResponse<BindingEntry> {}

export interface BindingStatsResponse extends APIResponse<{
  totalBindings: number;
  activeBindings: number;
  bindingsByType: Record<'chat' | 'event' | 'command' | 'monitoring', number>;
  bindingsByGroup: Record<string, number>;
  bindingsByServer: Record<string, number>;
  messageCount24h: number;
  errorCount24h: number;
}> {}

export interface GroupRoutesResponse extends APIResponse<Array<{
  groupId: string;
  serverIds: string[];
  bindingType: 'chat' | 'event' | 'command' | 'monitoring';
  priority: number;
}>> {}

export interface BatchBindingRequest {
  bindings: CreateBindingRequest[];
}

export interface BatchBindingResponse extends APIResponse<{
  totalRequested: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    groupId: string;
    serverId: string;
    bindingType: string;
    success: boolean;
    bindingId?: number;
    error?: string;
  }>;
}> {}

// ============================================================================
// Audit Log API Types
// ============================================================================

export interface AuditLogQuery {
  userId?: string;
  serverId?: string;
  operation?: string;
  result?: 'success' | 'failure' | 'error';
  startTime?: string;
  endTime?: string;
}

export interface AuditLogResponse extends PaginatedResponse<AuditLog> {}

// ============================================================================
// System API Types
// ============================================================================

export interface SystemHealthResponse extends APIResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  services: {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: any;
  }[];
  database: {
    connected: boolean;
    responseTime?: number;
  };
  connections: {
    active: number;
    total: number;
    byStatus: Record<string, number>;
  };
}> {}

export interface SystemStatsResponse extends APIResponse<{
  servers: {
    total: number;
    online: number;
    offline: number;
    byType: Record<string, number>;
  };
  players: {
    total: number;
    online: number;
    byEdition: Record<string, number>;
  };
  operations: {
    pending: number;
    completed24h: number;
    failed24h: number;
  };
  performance: {
    avgResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
  };
}> {}

// ============================================================================
// Authentication and Authorization Types
// ============================================================================

export interface AuthRequest {
  token: string;
  serverId?: string;
}

export interface AuthResponse extends APIResponse<{
  valid: boolean;
  serverId?: string;
  permissions: string[];
  expiresAt?: string;
}> {}

export interface CreateTokenRequest {
  serverId: string;
  expiresIn?: number; // in seconds
  ipWhitelist?: string[];
  permissions?: string[];
}

export interface CreateTokenResponse extends APIResponse<{
  token: string;
  expiresAt: string;
}> {}

// ============================================================================
// Batch Operations API Types
// ============================================================================

export interface BatchCommandRequest {
  serverIds: string[];
  command: string;
  timeout?: number;
}

export interface BatchActionRequest {
  serverIds: string[];
  action: string;
  parameters: Record<string, any>;
}

export interface BatchOperationResult {
  totalServers: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    serverId: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  duration: number;
}

export interface BatchOperationResponse extends APIResponse<BatchOperationResult> {}

// ============================================================================
// Real-time Metrics API Types
// ============================================================================

export interface CurrentMetricsResponse extends APIResponse<{
  timestamp: number;
  serverId: string;
  tps: number;
  playerCount: number;
  memoryUsage: {
    used: number;
    max: number;
    percentage: number;
  };
  cpuUsage: number;
  ping: number;
  uptime: number;
  status: string;
}> {}

export interface MetricsSummaryResponse extends APIResponse<{
  currentStatus: any;
  averageMetrics: {
    tps: number;
    memoryUsage: number;
    cpuUsage: number;
    playerCount: number;
  };
  alertCount: number;
  uptimePercentage: number;
}> {}

// ============================================================================
// Alert Management API Types
// ============================================================================

export interface AcknowledgeAlertResponse extends APIResponse<{ acknowledged: boolean }> {}

export interface RequestContext {
  userId?: string;
  serverId?: string;
  playerId?: string;
  banId?: string;
  alertId?: string;
  bindingId?: string;
  permissions: string[];
  ipAddress: string;
  userAgent?: string;
  requestId: string;
  timestamp: number;
  apiVersion?: string;
  versionWarnings?: string[];
  sanitizedBody?: any;
  sanitizedQuery?: any;
}

export interface AuthenticatedRequest extends RequestContext {
  userId: string;
  serverId: string;
}

// ============================================================================
// Middleware Types
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface CorsConfig {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}