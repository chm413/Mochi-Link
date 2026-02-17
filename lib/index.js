"use strict";
/**
 * Mochi-Link (大福连) - Main Plugin Entry Point
 * 
 * Simplified version with lazy loading to avoid module resolution issues
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.name = exports.usage = void 0;
exports.apply = apply;

const { Schema, Logger } = require("koishi");

// ============================================================================
// Plugin Configuration Schema
// ============================================================================
exports.Config = Schema.object({
    websocket: Schema.object({
        port: Schema.number().default(8080).description('WebSocket server port'),
        host: Schema.string().default('0.0.0.0').description('WebSocket server host'),
        ssl: Schema.object({
            cert: Schema.string().description('SSL certificate path'),
            key: Schema.string().description('SSL private key path')
        }).description('SSL configuration (optional)')
    }).description('WebSocket server configuration'),
    
    http: Schema.object({
        port: Schema.number().default(8081).description('HTTP API server port'),
        host: Schema.string().default('0.0.0.0').description('HTTP API server host'),
        cors: Schema.boolean().default(true).description('Enable CORS')
    }).description('HTTP API configuration (optional)'),
    
    database: Schema.object({
        prefix: Schema.string().default('mochi_').description('Database table prefix')
    }).description('Database configuration'),
    
    security: Schema.object({
        tokenExpiry: Schema.number().default(86400).description('Token expiry time in seconds'),
        maxConnections: Schema.number().default(100).description('Maximum concurrent connections'),
        rateLimiting: Schema.object({
            windowMs: Schema.number().default(60000).description('Rate limiting window in milliseconds'),
            maxRequests: Schema.number().default(100).description('Maximum requests per window')
        }).description('Rate limiting configuration')
    }).description('Security configuration'),
    
    monitoring: Schema.object({
        reportInterval: Schema.number().default(30).description('Status report interval in seconds'),
        historyRetention: Schema.number().default(30).description('History retention in days')
    }).description('Monitoring configuration'),
    
    logging: Schema.object({
        level: Schema.union(['debug', 'info', 'warn', 'error']).default('info').description('Log level'),
        auditRetention: Schema.number().default(90).description('Audit log retention in days')
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
// Plugin Apply Function (with lazy loading)
// ============================================================================
function apply(ctx, config) {
    const logger = ctx.logger('mochi-link');
    
    // Service instances (lazy loaded)
    let systemIntegration = null;
    let healthMonitoring = null;
    let isInitialized = false;
    
    // Initialize on ready
    ctx.on('ready', async () => {
        try {
            logger.info('Starting Mochi-Link plugin...');
            
            // Lazy load dependencies only when needed
            const { SystemIntegrationService } = require('./services/system-integration');
            const { HealthMonitoringService } = require('./services/health-monitoring');
            const { EnvironmentDetector, DeploymentConfigManager, ConfigurationUtils } = require('./config/deployment');
            
            // Detect environment
            const environment = EnvironmentDetector.detectEnvironment();
            const deploymentInfo = EnvironmentDetector.getDeploymentInfo();
            logger.info(`Starting in ${environment} environment`, deploymentInfo);
            
            // Load deployment configuration
            const deploymentConfigManager = new DeploymentConfigManager();
            const deploymentConfig = deploymentConfigManager.loadConfig(environment);
            const finalDeploymentConfig = ConfigurationUtils.applyEnvironmentOverrides(deploymentConfig);
            
            // Merge configurations
            const pluginConfigFromDeployment = deploymentConfigManager.toPluginConfig(finalDeploymentConfig);
            const finalConfig = { ...config, ...pluginConfigFromDeployment };
            
            // Initialize system integration
            systemIntegration = new SystemIntegrationService(ctx, finalConfig, {
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
            
            // Initialize health monitoring
            healthMonitoring = new HealthMonitoringService(ctx, {
                systemCheckInterval: finalDeploymentConfig.monitoring.healthCheck.interval,
                thresholds: {
                    memoryUsage: 85,
                    cpuUsage: 80,
                    responseTime: finalDeploymentConfig.monitoring.healthCheck.timeout,
                    errorRate: 5,
                    diskUsage: 90
                }
            });
            
            // Start services
            await systemIntegration.initialize();
            await healthMonitoring.start();
            
            isInitialized = true;
            logger.info('Mochi-Link plugin started successfully');
            
        } catch (error) {
            logger.error('Failed to start Mochi-Link plugin:', error);
            logger.error('Stack trace:', error.stack);
        }
    });
    
    // Cleanup on dispose
    ctx.on('dispose', async () => {
        try {
            logger.info('Stopping Mochi-Link plugin...');
            
            if (healthMonitoring) {
                await healthMonitoring.stop();
            }
            
            if (systemIntegration) {
                await systemIntegration.shutdown();
            }
            
            isInitialized = false;
            logger.info('Mochi-Link plugin stopped successfully');
            
        } catch (error) {
            logger.error('Error stopping Mochi-Link plugin:', error);
        }
    });
    
    // Expose service access methods
    ctx.provide('mochi-link', {
        getHealth: async () => {
            return {
                status: isInitialized ? 'healthy' : 'initializing',
                initialized: isInitialized,
                uptime: process.uptime()
            };
        },
        getConfig: () => ({ ...config }),
        isReady: () => isInitialized && systemIntegration?.isReady() === true
    });
}

// Export configuration schema for Koishi
apply.Config = exports.Config;

// Set as default export
exports.default = apply;
