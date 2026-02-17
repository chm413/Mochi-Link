/**
 * Mochi-Link (大福连) - Services Index
 *
 * This file exports all service classes and utilities for the
 * Minecraft Unified Management and Monitoring System.
 */
export { AuditService, AuditLogger, AuditQueryService, AuditStatisticsService, AuditExportService, type AuditFilter, type AuditExportOptions, type AuditStatistics, type AuditContext } from './audit';
export { PermissionManager, DEFAULT_ROLES, type PermissionCheckResult, type RoleDefinition, type PermissionContext } from './permission';
export { TokenManager, type TokenGenerationOptions, type TokenValidationResult, type TokenRefreshOptions, type TokenStats } from './token';
export { ServerManager } from './server';
export type { ServerRegistrationOptions, ServerUpdateOptions, ServerStatusInfo, ServerSummary } from './server';
export { PlayerInformationService } from './player';
export { WhitelistManager } from './whitelist';
export type { WhitelistEntry, WhitelistOperation, WhitelistSyncStatus, WhitelistCache } from './whitelist';
export { CommandExecutionService } from './command';
export type { CommandExecutionOptions, QuickActionDefinition, QuickActionParameter, ServerControlOperation, ServerControlResult, BatchOperationRequest, BatchOperationResult } from './command';
export { EventService } from './event';
export type { EventFilter as EventServiceFilter, EventSubscription, EventAggregation, EventDistributionRule, EventTarget, EventMetrics, EventListener } from './event';
export { MonitoringService } from './monitoring';
export type { MonitoringConfig, AlertThresholds, StorageConfig, ServerStatusReport, HistoricalData, HistoricalMetric, Alert, MonitoringStats } from './monitoring';
export { BindingManager } from './binding';
export type { ServerBinding, BindingConfig, BindingType, MessageFilter, EventFilter as BindingEventFilter, BindingRoute, BindingStats, BindingCreateOptions, BindingUpdateOptions, BindingQuery } from './binding';
export { ErrorHandlingService } from './error-handling';
export { BusinessErrorHandler } from './business-error-handler';
export type { ErrorHandlerConfig, ErrorContext, ConnectionQuality } from './error-handling';
export type { BusinessErrorHandlerConfig, SyncConflict, ConflictResolution, MaintenanceStatus } from './business-error-handler';
export { MessageRouter } from './message-router';
export type { IncomingMessage, OutgoingMessage, ServerEvent, GroupMessage, RoutingStats } from './message-router';
export { PluginIntegrationService, pluginIntegrationService } from './plugin-integration';
export { PerformanceOptimizationService } from './performance';
export { CacheService } from './cache';
export type { PerformanceConfig, PerformanceMetrics } from './performance';
export { SystemIntegrationService } from './system-integration';
export { HealthMonitoringService } from './health-monitoring';
export type { HealthCheckConfig, HealthStatus, ComponentHealth, HealthAlert, DiagnosticInfo } from './health-monitoring';
export * from '../config/deployment';
export * from '../connection';
import { Context } from 'koishi';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
import { TokenManager } from './token';
import { ServerManager } from './server';
import { PlayerInformationService } from './player';
import { WhitelistManager } from './whitelist';
import { CommandExecutionService } from './command';
import { EventService } from './event';
import { MonitoringService } from './monitoring';
import { BindingManager } from './binding';
import { MessageRouter } from './message-router';
import { PluginIntegrationService } from './plugin-integration';
import { PerformanceOptimizationService } from './performance';
/**
 * Main service manager that coordinates all services
 */
export declare class ServiceManager {
    private ctx;
    audit: AuditService;
    permission: PermissionManager;
    token: TokenManager;
    server: ServerManager;
    player: PlayerInformationService;
    whitelist: WhitelistManager;
    command: CommandExecutionService;
    event: EventService;
    monitoring: MonitoringService;
    binding: BindingManager;
    messageRouter: MessageRouter;
    pluginIntegration: PluginIntegrationService;
    performance: PerformanceOptimizationService;
    private db;
    constructor(ctx: Context);
    /**
     * Initialize all services
     */
    initialize(): Promise<void>;
    /**
     * Cleanup all services
     */
    cleanup(): Promise<void>;
    /**
     * Get health status of all services
     */
    getHealthStatus(): Promise<{
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
    }>;
}
