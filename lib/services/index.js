"use strict";
/**
 * Mochi-Link (大福连) - Services Index
 *
 * This file exports all service classes and utilities for the
 * Minecraft Unified Management and Monitoring System.
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
exports.ServiceManager = exports.HealthMonitoringService = exports.SystemIntegrationService = exports.CacheService = exports.PerformanceOptimizationService = exports.pluginIntegrationService = exports.PluginIntegrationService = exports.MessageRouter = exports.BusinessErrorHandler = exports.ErrorHandlingService = exports.BindingManager = exports.MonitoringService = exports.EventService = exports.CommandExecutionService = exports.WhitelistManager = exports.PlayerInformationService = exports.ServerManager = exports.TokenManager = exports.DEFAULT_ROLES = exports.PermissionManager = exports.AuditExportService = exports.AuditStatisticsService = exports.AuditQueryService = exports.AuditLogger = exports.AuditService = void 0;
// Audit Services
var audit_1 = require("./audit");
Object.defineProperty(exports, "AuditService", { enumerable: true, get: function () { return audit_1.AuditService; } });
Object.defineProperty(exports, "AuditLogger", { enumerable: true, get: function () { return audit_1.AuditLogger; } });
Object.defineProperty(exports, "AuditQueryService", { enumerable: true, get: function () { return audit_1.AuditQueryService; } });
Object.defineProperty(exports, "AuditStatisticsService", { enumerable: true, get: function () { return audit_1.AuditStatisticsService; } });
Object.defineProperty(exports, "AuditExportService", { enumerable: true, get: function () { return audit_1.AuditExportService; } });
// Permission Services
var permission_1 = require("./permission");
Object.defineProperty(exports, "PermissionManager", { enumerable: true, get: function () { return permission_1.PermissionManager; } });
Object.defineProperty(exports, "DEFAULT_ROLES", { enumerable: true, get: function () { return permission_1.DEFAULT_ROLES; } });
// Token Services
var token_1 = require("./token");
Object.defineProperty(exports, "TokenManager", { enumerable: true, get: function () { return token_1.TokenManager; } });
// Server Services
var server_1 = require("./server");
Object.defineProperty(exports, "ServerManager", { enumerable: true, get: function () { return server_1.ServerManager; } });
// Player Services
var player_1 = require("./player");
Object.defineProperty(exports, "PlayerInformationService", { enumerable: true, get: function () { return player_1.PlayerInformationService; } });
// Whitelist Services
var whitelist_1 = require("./whitelist");
Object.defineProperty(exports, "WhitelistManager", { enumerable: true, get: function () { return whitelist_1.WhitelistManager; } });
// Command Services
var command_1 = require("./command");
Object.defineProperty(exports, "CommandExecutionService", { enumerable: true, get: function () { return command_1.CommandExecutionService; } });
// Event Services
var event_1 = require("./event");
Object.defineProperty(exports, "EventService", { enumerable: true, get: function () { return event_1.EventService; } });
// Monitoring Services
var monitoring_1 = require("./monitoring");
Object.defineProperty(exports, "MonitoringService", { enumerable: true, get: function () { return monitoring_1.MonitoringService; } });
// Binding Services
var binding_1 = require("./binding");
Object.defineProperty(exports, "BindingManager", { enumerable: true, get: function () { return binding_1.BindingManager; } });
// Error Handling Services
var error_handling_1 = require("./error-handling");
Object.defineProperty(exports, "ErrorHandlingService", { enumerable: true, get: function () { return error_handling_1.ErrorHandlingService; } });
var business_error_handler_1 = require("./business-error-handler");
Object.defineProperty(exports, "BusinessErrorHandler", { enumerable: true, get: function () { return business_error_handler_1.BusinessErrorHandler; } });
// Message Router Services
var message_router_1 = require("./message-router");
Object.defineProperty(exports, "MessageRouter", { enumerable: true, get: function () { return message_router_1.MessageRouter; } });
// Plugin Integration Services
var plugin_integration_1 = require("./plugin-integration");
Object.defineProperty(exports, "PluginIntegrationService", { enumerable: true, get: function () { return plugin_integration_1.PluginIntegrationService; } });
Object.defineProperty(exports, "pluginIntegrationService", { enumerable: true, get: function () { return plugin_integration_1.pluginIntegrationService; } });
// Performance Optimization Services
var performance_1 = require("./performance");
Object.defineProperty(exports, "PerformanceOptimizationService", { enumerable: true, get: function () { return performance_1.PerformanceOptimizationService; } });
var cache_1 = require("./cache");
Object.defineProperty(exports, "CacheService", { enumerable: true, get: function () { return cache_1.CacheService; } });
// System Integration Services
var system_integration_1 = require("./system-integration");
Object.defineProperty(exports, "SystemIntegrationService", { enumerable: true, get: function () { return system_integration_1.SystemIntegrationService; } });
var health_monitoring_1 = require("./health-monitoring");
Object.defineProperty(exports, "HealthMonitoringService", { enumerable: true, get: function () { return health_monitoring_1.HealthMonitoringService; } });
// Configuration Services
__exportStar(require("../config/deployment"), exports);
// Connection Services
__exportStar(require("../connection"), exports);
const audit_2 = require("./audit");
const permission_2 = require("./permission");
const token_2 = require("./token");
const server_2 = require("./server");
const player_2 = require("./player");
const whitelist_2 = require("./whitelist");
const command_2 = require("./command");
const event_2 = require("./event");
const monitoring_2 = require("./monitoring");
const binding_2 = require("./binding");
const message_router_2 = require("./message-router");
const plugin_integration_2 = require("./plugin-integration");
const performance_2 = require("./performance");
const operations_1 = require("../database/operations");
/**
 * Main service manager that coordinates all services
 */
class ServiceManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.db = new operations_1.DatabaseManager(ctx);
        this.audit = new audit_2.AuditService(ctx);
        this.permission = new permission_2.PermissionManager(ctx);
        this.token = new token_2.TokenManager(ctx);
        this.pluginIntegration = new plugin_integration_2.PluginIntegrationService();
        this.server = new server_2.ServerManager(ctx, this.db, this.audit, this.permission, this.token, this.pluginIntegration);
        // Pass getBridge function to services that need bridge access
        this.player = new player_2.PlayerInformationService(ctx, (serverId) => this.server.getBridge(serverId));
        this.whitelist = new whitelist_2.WhitelistManager(ctx, (serverId) => this.server.getBridge(serverId));
        this.command = new command_2.CommandExecutionService(ctx, this.audit, this.permission, (serverId) => this.server.getBridge(serverId));
        this.event = new event_2.EventService(ctx, this.audit);
        this.monitoring = new monitoring_2.MonitoringService(ctx, this.audit, this.event);
        this.binding = new binding_2.BindingManager(ctx, this.audit, this.permission);
        this.messageRouter = new message_router_2.MessageRouter(ctx, this.binding, this.event);
        this.performance = new performance_2.PerformanceOptimizationService(ctx, this.db);
    }
    /**
     * Initialize all services
     */
    async initialize() {
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
        }
        catch (error) {
            logger.error('Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Cleanup all services
     */
    async cleanup() {
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
        }
        catch (error) {
            logger.error('Service cleanup failed:', error);
        }
    }
    /**
     * Get health status of all services
     */
    async getHealthStatus() {
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
        const playerHealth = { status: 'healthy' };
        const whitelistHealth = { status: 'healthy' };
        const commandHealth = { status: 'healthy' };
        const allHealthy = auditHealth.status === 'healthy' &&
            permissionHealth.status === 'healthy' &&
            tokenHealth.status === 'healthy' &&
            serverHealth.status === 'healthy' &&
            playerHealth.status === 'healthy' &&
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
exports.ServiceManager = ServiceManager;
