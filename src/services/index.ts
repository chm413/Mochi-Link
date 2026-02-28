/**
 * Mochi-Link (大福连) - Services Index
 * 
 * This file exports all service classes and utilities for the
 * Minecraft Unified Management and Monitoring System.
 */

// Audit Services
export {
  AuditService,
  AuditLogger,
  AuditQueryService,
  AuditStatisticsService,
  AuditExportService,
  type AuditFilter,
  type AuditExportOptions,
  type AuditStatistics,
  type AuditContext
} from './audit';

// Permission Services
export {
  PermissionManager,
  DEFAULT_ROLES,
  type PermissionCheckResult,
  type RoleDefinition,
  type PermissionContext
} from './permission';

// Token Services
export {
  TokenManager,
  type TokenGenerationOptions,
  type TokenValidationResult,
  type TokenRefreshOptions,
  type TokenStats
} from './token';

// Server Services
export { ServerManager } from './server';
export type {
  ServerRegistrationOptions,
  ServerUpdateOptions,
  ServerStatusInfo,
  ServerSummary
} from './server';

// Player Services
export { PlayerInformationService } from './player';
export { PlayerActionService } from './player-action';
export type {
  PlayerKickOptions,
  PlayerKickResult,
  PlayerMessageOptions,
  PlayerMessageResult,
  PlayerTeleportOptions,
  PlayerTeleportResult
} from './player-action';

// Server Control Services
export { ServerControlService } from './server-control';
export type {
  ServerRestartOptions,
  ServerRestartResult,
  ServerShutdownOptions,
  ServerShutdownResult,
  ServerSaveOptions,
  ServerSaveResult,
  ServerReloadOptions,
  ServerReloadResult
} from './server-control';

// Whitelist Services
export { WhitelistManager } from './whitelist';
export type {
  WhitelistEntry,
  WhitelistOperation,
  WhitelistSyncStatus,
  WhitelistCache
} from './whitelist';

// Command Services
export { CommandExecutionService } from './command';
export type {
  CommandExecutionOptions,
  QuickActionDefinition,
  QuickActionParameter,
  ServerControlOperation,
  ServerControlResult,
  BatchOperationRequest,
  BatchOperationResult
} from './command';

// Event Services
export { EventService } from './event';
export { SubscriptionHandler } from './subscription-handler';
export { RequestHandler } from './request-handler';
export type {
  EventFilter as EventServiceFilter,
  EventSubscription,
  EventAggregation,
  EventDistributionRule,
  EventTarget,
  EventMetrics,
  EventListener
} from './event';

// Monitoring Services
export { MonitoringService } from './monitoring';
export type {
  MonitoringConfig,
  AlertThresholds,
  StorageConfig,
  ServerStatusReport,
  HistoricalData,
  HistoricalMetric,
  Alert,
  MonitoringStats
} from './monitoring';

// Binding Services
export { BindingManager } from './binding';
export type {
  ServerBinding,
  BindingConfig,
  BindingType,
  MessageFilter,
  EventFilter as BindingEventFilter,
  BindingRoute,
  BindingStats,
  BindingCreateOptions,
  BindingUpdateOptions,
  BindingQuery
} from './binding';

// Error Handling Services
export { ErrorHandlingService } from './error-handling';
export { BusinessErrorHandler } from './business-error-handler';
export type {
  ErrorHandlerConfig,
  ErrorContext,
  ConnectionQuality
} from './error-handling';
export type {
  BusinessErrorHandlerConfig,
  SyncConflict,
  ConflictResolution,
  MaintenanceStatus
} from './business-error-handler';

// Message Router Services
export { MessageRouter } from './message-router';
export type {
  IncomingMessage,
  OutgoingMessage,
  ServerEvent,
  GroupMessage,
  RoutingStats
} from './message-router';

// Plugin Integration Services
export { PluginIntegrationService, pluginIntegrationService } from './plugin-integration';

// Performance Optimization Services
export { PerformanceOptimizationService } from './performance';
export { CacheService } from './cache';
export type {
  PerformanceConfig,
  PerformanceMetrics
} from './performance';

// System Integration Services
export { SystemIntegrationService } from './system-integration';
export { HealthMonitoringService } from './health-monitoring';
export type {
  HealthCheckConfig,
  HealthStatus,
  ComponentHealth,
  HealthAlert,
  DiagnosticInfo
} from './health-monitoring';

// Configuration Services
export * from '../config/deployment';

// Connection Services
export * from '../connection';

// ============================================================================
// Service Manager
// ============================================================================

import { Context } from 'koishi';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
import { TokenManager } from './token';
import { ServerManager } from './server';
import { PlayerInformationService } from './player';
import { PlayerActionService } from './player-action';
import { ServerControlService } from './server-control';
import { WhitelistManager } from './whitelist';
import { CommandExecutionService } from './command';
import { EventService } from './event';
import { MonitoringService } from './monitoring';
import { BindingManager } from './binding';
import { MessageRouter } from './message-router';
import { PluginIntegrationService } from './plugin-integration';
import { PerformanceOptimizationService } from './performance';
import { DatabaseManager } from '../database/operations';

/**
 * Main service manager that coordinates all services
 */
export class ServiceManager {
  public audit: AuditService;
  public permission: PermissionManager;
  public token: TokenManager;
  public server: ServerManager;
  public player: PlayerInformationService;
  public playerAction: PlayerActionService;
  public serverControl: ServerControlService;
  public whitelist: WhitelistManager;
  public command: CommandExecutionService;
  public event: EventService;
  public monitoring: MonitoringService;
  public binding: BindingManager;
  public messageRouter: MessageRouter;
  public pluginIntegration: PluginIntegrationService;
  public performance: PerformanceOptimizationService;
  private db: DatabaseManager;

  constructor(private ctx: Context) {
    this.db = new DatabaseManager(ctx);
    this.audit = new AuditService(ctx);
    this.permission = new PermissionManager(ctx);
    this.token = new TokenManager(ctx);
    this.pluginIntegration = new PluginIntegrationService();
    this.server = new ServerManager(ctx, this.db, this.audit, this.permission, this.token, this.pluginIntegration);
    
    // Pass getBridge function to services that need bridge access
    this.player = new PlayerInformationService(
      ctx,
      (serverId: string) => this.server.getBridge(serverId)
    );
    this.playerAction = new PlayerActionService(
      ctx,
      (serverId: string) => this.server.getBridge(serverId),
      this.audit,
      this.permission
    );
    this.serverControl = new ServerControlService(
      ctx,
      (serverId: string) => this.server.getBridge(serverId),
      this.audit,
      this.permission
    );
    this.whitelist = new WhitelistManager(
      ctx,
      (serverId: string) => this.server.getBridge(serverId)
    );
    this.command = new CommandExecutionService(
      ctx,
      this.audit,
      this.permission,
      (serverId: string) => this.server.getBridge(serverId)
    );
    this.event = new EventService(ctx, this.audit);
    this.monitoring = new MonitoringService(ctx, this.audit, this.event);
    this.binding = new BindingManager(ctx, this.audit, this.permission);
    this.messageRouter = new MessageRouter(ctx, this.binding, this.event);
    this.performance = new PerformanceOptimizationService(ctx, this.db);
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:services');
    logger.info('Initializing services...');

    try {
      // Initialize plugin integration service
      await this.pluginIntegration.initialize();
      
      // Initialize performance optimization service
      await this.performance.initialize();
      
      // Services are initialized on construction
      // Additional initialization logic can be added here if needed
      
      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup all services
   */
  async cleanup(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:services');
    logger.info('Cleaning up services...');

    try {
      // Cleanup services in reverse order
      await this.performance.shutdown();
      await this.pluginIntegration.cleanup();
      await this.monitoring.shutdown();
      await this.event.shutdown();
      await this.messageRouter.cleanup();
      await this.binding.cleanup();
      await this.server.cleanup();
      
      logger.info('All services cleaned up successfully');
    } catch (error) {
      logger.error('Service cleanup failed:', error);
    }
  }

  /**
   * Get health status of all services
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      audit: any;
      permission: any;
      token: any;
      server: any;
      player: any;
      whitelist: any;
      command: any;
      event: any;
      monitoring: any;
      binding: any;
      messageRouter: any;
      performance: any;
    };
  }> {
    const auditHealth = await this.audit.getHealthStatus();
    const permissionHealth = await this.permission.getHealthStatus();
    const tokenHealth = await this.token.getHealthStatus();
    const serverHealth = await this.server.getHealthStatus();
    const eventHealth = await this.event.getHealthStatus();
    const monitoringHealth = await this.monitoring.getHealthStatus();
    const bindingHealth = await this.binding.getHealthStatus();
    const messageRouterHealth = await this.messageRouter.getHealthStatus();
    const performanceHealth = await this.performance.getHealthStatus();
    
    // Simple health checks for existing services
    const playerHealth = { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy' };
    const playerActionHealth = { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy' };
    const serverControlHealth = { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy' };
    const whitelistHealth = { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy' };
    const commandHealth = { status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy' };

    const allHealthy = auditHealth.status === 'healthy' && 
                      permissionHealth.status === 'healthy' && 
                      tokenHealth.status === 'healthy' &&
                      serverHealth.status === 'healthy' &&
                      playerHealth.status === 'healthy' &&
                      playerActionHealth.status === 'healthy' &&
                      serverControlHealth.status === 'healthy' &&
                      whitelistHealth.status === 'healthy' &&
                      commandHealth.status === 'healthy' &&
                      eventHealth.status === 'healthy' &&
                      monitoringHealth.status === 'healthy' &&
                      bindingHealth.status === 'healthy' &&
                      messageRouterHealth.status === 'healthy' &&
                      performanceHealth.status === 'healthy';
    const anyUnhealthy = auditHealth.status === 'unhealthy' || 
                        permissionHealth.status === 'unhealthy' || 
                        tokenHealth.status === 'unhealthy' ||
                        serverHealth.status === 'unhealthy' ||
                        playerHealth.status === 'unhealthy' ||
                        playerActionHealth.status === 'unhealthy' ||
                        serverControlHealth.status === 'unhealthy' ||
                        whitelistHealth.status === 'unhealthy' ||
                        commandHealth.status === 'unhealthy' ||
                        eventHealth.status === 'unhealthy' ||
                        monitoringHealth.status === 'unhealthy' ||
                        bindingHealth.status === 'unhealthy' ||
                        messageRouterHealth.status === 'unhealthy' ||
                        performanceHealth.status === 'unhealthy';

    const overallStatus = allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded';

    return {
      status: overallStatus,
      services: {
        audit: auditHealth,
        permission: permissionHealth,
        token: tokenHealth,
        server: serverHealth,
        player: playerHealth,
        playerAction: playerActionHealth,
        serverControl: serverControlHealth,
        whitelist: whitelistHealth,
        command: commandHealth,
        event: eventHealth,
        monitoring: monitoringHealth,
        binding: bindingHealth,
        messageRouter: messageRouterHealth,
        performance: performanceHealth
      }
    };
  }
}