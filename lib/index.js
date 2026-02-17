"use strict";
/**
 * Mochi-Link (大福连) - Main Plugin Entry Point
 *
 * This is the main entry point for the Koishi plugin that implements
 * the Minecraft Unified Management and Monitoring System.
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
exports.MochiLinkPlugin = exports.usage = exports.name = exports.Config = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
const init_1 = require("./database/init");
const system_integration_1 = require("./services/system-integration");
const health_monitoring_1 = require("./services/health-monitoring");
const deployment_1 = require("./config/deployment");
// ============================================================================
// Plugin Configuration Schema
// ============================================================================
exports.Config = koishi_1.Schema.object({
    websocket: koishi_1.Schema.object({
        port: koishi_1.Schema.number().default(8080).description('WebSocket server port'),
        host: koishi_1.Schema.string().default('0.0.0.0').description('WebSocket server host'),
        ssl: koishi_1.Schema.object({
            cert: koishi_1.Schema.string().description('SSL certificate path'),
            key: koishi_1.Schema.string().description('SSL private key path')
        }).description('SSL configuration (optional)')
    }).description('WebSocket server configuration'),
    http: koishi_1.Schema.object({
        port: koishi_1.Schema.number().default(8081).description('HTTP API server port'),
        host: koishi_1.Schema.string().default('0.0.0.0').description('HTTP API server host'),
        cors: koishi_1.Schema.boolean().default(true).description('Enable CORS')
    }).description('HTTP API configuration (optional)'),
    database: koishi_1.Schema.object({
        prefix: koishi_1.Schema.string().default('mochi_').description('Database table prefix')
    }).description('Database configuration'),
    security: koishi_1.Schema.object({
        tokenExpiry: koishi_1.Schema.number().default(86400).description('Token expiry time in seconds'),
        maxConnections: koishi_1.Schema.number().default(100).description('Maximum concurrent connections'),
        rateLimiting: koishi_1.Schema.object({
            windowMs: koishi_1.Schema.number().default(60000).description('Rate limiting window in milliseconds'),
            maxRequests: koishi_1.Schema.number().default(100).description('Maximum requests per window')
        }).description('Rate limiting configuration')
    }).description('Security configuration'),
    monitoring: koishi_1.Schema.object({
        reportInterval: koishi_1.Schema.number().default(30).description('Status report interval in seconds'),
        historyRetention: koishi_1.Schema.number().default(30).description('History retention in days')
    }).description('Monitoring configuration'),
    logging: koishi_1.Schema.object({
        level: koishi_1.Schema.union(['debug', 'info', 'warn', 'error']).default('info').description('Log level'),
        auditRetention: koishi_1.Schema.number().default(90).description('Audit log retention in days')
    }).description('Logging configuration')
});
// ============================================================================
// Plugin Name and Metadata
// ============================================================================
exports.name = 'mochi-link';
exports.usage = `
# Mochi-Link (大福连) - Minecraft 统一管理与监控系统

这是一个 Koishi 插件，提供跨核心、跨版本、跨平台的 Minecraft 服务器统一管理功能。

## 主要功能

- 🎯 **跨核心统一接口**: 支持 Java 版 (Paper/Folia) 和基岩版 (LLBDS/PMMP) 服务器
- 🔗 **双向连接架构**: 支持正向和反向 WebSocket 连接模式
- 👥 **多服务器管理**: 在一个实例中管理多台 MC 服务器
- 🛡️ **权限分离控制**: 基于服务器 ID 的细粒度权限管理
- 📊 **实时监控推送**: 服务器状态、玩家活动、性能指标实时推送
- 🔐 **安全认证机制**: API 令牌、IP 白名单、可选通信加密

## 快速开始

1. 确保已安装并配置好 Koishi 数据库服务
2. 安装并启用本插件
3. 配置 WebSocket 和 HTTP 服务端口
4. 在目标 Minecraft 服务器上安装对应的 Connector Bridge
5. 通过管理命令注册服务器并建立连接

## 配置说明

请参考配置面板中的各项设置，所有配置都有详细的说明和合理的默认值。

## 支持的服务器核心

### Java 版
- Paper
- Folia  
- Fabric
- Forge
- Mohist
- Geyser

### 基岩版
- LLBDS
- Nukkit
- PMMP
- BDS (官方)

## 技术特性

- 基于 U-WBP v2 协议的标准化通信
- 支持插件、RCON、终端注入等多种接入模式
- 完整的审计日志和操作记录
- 自动重连和故障恢复机制
- 非正版玩家身份识别和管理
- 离线操作缓存和同步机制
`;
// ============================================================================
// Main Plugin Class
// ============================================================================
class MochiLinkPlugin extends koishi_1.Service {
    constructor(ctx, config) {
        super(ctx, 'mochi-link', true);
        this.config = config;
        this.isInitialized = false;
        this.logger = ctx.logger('mochi-link');
        this.dbInitializer = new init_1.DatabaseInitializer(ctx);
        this.deploymentConfigManager = new deployment_1.DeploymentConfigManager();
    }
    async start() {
        this.logger.info('Starting Mochi-Link plugin...');
        try {
            // Detect environment and load deployment configuration
            const environment = deployment_1.EnvironmentDetector.detectEnvironment();
            const deploymentInfo = deployment_1.EnvironmentDetector.getDeploymentInfo();
            this.logger.info(`Starting in ${environment} environment`, deploymentInfo);
            // Load and validate deployment configuration
            const deploymentConfig = this.deploymentConfigManager.loadConfig(environment);
            const envValidation = deployment_1.ConfigurationUtils.validateEnvironmentVariables();
            if (!envValidation.valid) {
                this.logger.warn('Environment validation warnings:', envValidation.errors);
            }
            // Apply environment overrides
            const finalDeploymentConfig = deployment_1.ConfigurationUtils.applyEnvironmentOverrides(deploymentConfig);
            // Convert to plugin config if needed (merge with existing config)
            const pluginConfigFromDeployment = this.deploymentConfigManager.toPluginConfig(finalDeploymentConfig);
            this.config = { ...this.config, ...pluginConfigFromDeployment };
            // Initialize system integration service
            this.systemIntegration = new system_integration_1.SystemIntegrationService(this.ctx, this.config, {
                monitoring: {
                    enabled: finalDeploymentConfig.monitoring.enabled,
                    metricsInterval: finalDeploymentConfig.monitoring.metrics.interval,
                    alertThresholds: {
                        memoryUsage: 85,
                        cpuUsage: 80,
                        responseTime: finalDeploymentConfig.monitoring.healthCheck.timeout,
                        errorRate: 5
                    }
                }
            });
            // Initialize health monitoring service
            this.healthMonitoring = new health_monitoring_1.HealthMonitoringService(this.ctx, {
                systemCheckInterval: finalDeploymentConfig.monitoring.healthCheck.interval,
                thresholds: {
                    memoryUsage: 85,
                    cpuUsage: 80,
                    responseTime: finalDeploymentConfig.monitoring.healthCheck.timeout,
                    errorRate: 5,
                    diskUsage: 90
                }
            });
            // Initialize the entire system through system integration service
            await this.systemIntegration.initialize();
            // Start health monitoring
            await this.healthMonitoring.start();
            // Get references to initialized components
            this.dbManager = this.systemIntegration.getDatabaseManager();
            this.serviceManager = this.systemIntegration.getServiceManager();
            this.isInitialized = true;
            this.logger.info('Mochi-Link plugin started successfully');
        }
        catch (error) {
            this.logger.error('Failed to start Mochi-Link plugin:', error);
            throw error;
        }
    }
    async stop() {
        this.logger.info('Stopping Mochi-Link plugin...');
        try {
            // Stop health monitoring
            if (this.healthMonitoring) {
                await this.healthMonitoring.stop();
            }
            // Shutdown system integration (handles all components)
            if (this.systemIntegration) {
                await this.systemIntegration.shutdown();
            }
            this.isInitialized = false;
            this.logger.info('Mochi-Link plugin stopped successfully');
        }
        catch (error) {
            this.logger.error('Error stopping Mochi-Link plugin:', error);
        }
    }
    // ============================================================================
    // Public API Methods
    // ============================================================================
    /**
     * Get plugin health status
     */
    async getHealth() {
        const baseHealth = {
            status: this.isInitialized ? 'healthy' : 'initializing',
            initialized: this.isInitialized,
            uptime: process.uptime()
        };
        if (this.systemIntegration) {
            const systemHealth = await this.systemIntegration.getSystemHealth();
            const systemStats = this.systemIntegration.getSystemStats();
            baseHealth.system = {
                health: systemHealth,
                stats: systemStats
            };
        }
        if (this.healthMonitoring) {
            const healthStatus = await this.healthMonitoring.getHealthStatus();
            const diagnostics = this.healthMonitoring.getDiagnosticInfo();
            baseHealth.monitoring = {
                status: healthStatus,
                diagnostics
            };
        }
        // Add deployment information
        const deploymentInfo = deployment_1.EnvironmentDetector.getDeploymentInfo();
        const currentConfig = this.deploymentConfigManager.getCurrentConfig();
        baseHealth.deployment = {
            info: deploymentInfo,
            config: currentConfig ? {
                environment: currentConfig.environment,
                version: currentConfig.version,
                buildTime: currentConfig.buildTime
            } : null
        };
        return baseHealth;
    }
    /**
     * Get plugin configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get system integration service
     */
    getSystemIntegration() {
        return this.systemIntegration;
    }
    /**
     * Get health monitoring service
     */
    getHealthMonitoring() {
        return this.healthMonitoring;
    }
    /**
     * Get service manager (for external access)
     */
    getServiceManager() {
        return this.serviceManager;
    }
    /**
     * Get database manager (for external access)
     */
    getDatabaseManager() {
        return this.dbManager;
    }
    /**
     * Check if system is ready
     */
    isReady() {
        return this.isInitialized &&
            this.systemIntegration?.isReady() === true;
    }
    /**
     * Force shutdown (emergency stop)
     */
    async forceShutdown() {
        this.logger.warn('Force shutdown initiated');
        try {
            if (this.healthMonitoring) {
                await this.healthMonitoring.stop();
            }
            if (this.systemIntegration) {
                await this.systemIntegration.forceShutdown();
            }
            this.isInitialized = false;
            this.logger.info('Force shutdown completed');
        }
        catch (error) {
            this.logger.error('Error during force shutdown:', error);
        }
    }
}
exports.MochiLinkPlugin = MochiLinkPlugin;
MochiLinkPlugin.inject = ['database'];
// ============================================================================
// Plugin Export (Koishi v4 Compatible)
// ============================================================================
function apply(ctx, config) {
    const plugin = new MochiLinkPlugin(ctx, config);
    ctx.on('ready', async () => {
        await plugin.start();
    });
    ctx.on('dispose', async () => {
        await plugin.stop();
    });
    // Expose plugin instance as a service
    ctx.provide('mochi-link', plugin);
}
// Export configuration schema for Koishi
apply.Config = exports.Config;
// Set as default export
exports.default = apply;
// Re-export types for external use
__exportStar(require("./types"), exports);
__exportStar(require("./database/models"), exports);
