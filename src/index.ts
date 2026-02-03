/**
 * Mochi-Link (大福连) - Main Plugin Entry Point
 * 
 * This is the main entry point for the Koishi plugin that implements
 * the Minecraft Unified Management and Monitoring System.
 */

import { Context, Schema, Service, Logger } from 'koishi';
import { PluginConfig } from './types';
import { DatabaseInitializer, DatabaseManager } from './database/init';
import { ServiceManager } from './services';
import { SystemIntegrationService } from './services/system-integration';
import { HealthMonitoringService } from './services/health-monitoring';
import { DeploymentConfigManager, EnvironmentDetector, ConfigurationUtils } from './config/deployment';

// ============================================================================
// Plugin Configuration Schema
// ============================================================================

export const Config: Schema<PluginConfig> = Schema.object({
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

export const name = 'mochi-link';
export const usage = `
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

export class MochiLinkPlugin extends Service {
  static readonly inject = ['database'] as const;
  
  public logger: Logger;
  public dbManager!: DatabaseManager;
  public serviceManager!: ServiceManager;
  public systemIntegration!: SystemIntegrationService;
  public healthMonitoring!: HealthMonitoringService;
  private dbInitializer: DatabaseInitializer;
  private deploymentConfigManager: DeploymentConfigManager;
  private isInitialized = false;

  constructor(ctx: Context, public config: PluginConfig) {
    super(ctx, 'mochi-link', true);
    this.logger = ctx.logger('mochi-link');
    this.dbInitializer = new DatabaseInitializer(ctx);
    this.deploymentConfigManager = new DeploymentConfigManager();
  }

  async start(): Promise<void> {
    this.logger.info('Starting Mochi-Link plugin...');
    
    try {
      // Detect environment and load deployment configuration
      const environment = EnvironmentDetector.detectEnvironment();
      const deploymentInfo = EnvironmentDetector.getDeploymentInfo();
      
      this.logger.info(`Starting in ${environment} environment`, deploymentInfo);
      
      // Load and validate deployment configuration
      const deploymentConfig = this.deploymentConfigManager.loadConfig(environment);
      const envValidation = ConfigurationUtils.validateEnvironmentVariables();
      
      if (!envValidation.valid) {
        this.logger.warn('Environment validation warnings:', envValidation.errors);
      }
      
      // Apply environment overrides
      const finalDeploymentConfig = ConfigurationUtils.applyEnvironmentOverrides(deploymentConfig);
      
      // Convert to plugin config if needed (merge with existing config)
      const pluginConfigFromDeployment = this.deploymentConfigManager.toPluginConfig(finalDeploymentConfig);
      this.config = { ...this.config, ...pluginConfigFromDeployment };
      
      // Initialize system integration service
      this.systemIntegration = new SystemIntegrationService(
        this.ctx,
        this.config,
        {
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
        }
      );
      
      // Initialize health monitoring service
      this.healthMonitoring = new HealthMonitoringService(
        this.ctx,
        {
          systemCheckInterval: finalDeploymentConfig.monitoring.healthCheck.interval,
          thresholds: {
            memoryUsage: 85,
            cpuUsage: 80,
            responseTime: finalDeploymentConfig.monitoring.healthCheck.timeout,
            errorRate: 5,
            diskUsage: 90
          },
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
        }
      );
      
      // Initialize the entire system through system integration service
      await this.systemIntegration.initialize();
      
      // Start health monitoring
      await this.healthMonitoring.start(this.systemIntegration);
      
      // Get references to initialized components
      this.dbManager = this.systemIntegration.getDatabaseManager()!;
      this.serviceManager = this.systemIntegration.getServiceManager()!;
      
      this.isInitialized = true;
      this.logger.info('Mochi-Link plugin started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start Mochi-Link plugin:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
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
      
    } catch (error) {
      this.logger.error('Error stopping Mochi-Link plugin:', error);
    }
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get plugin health status
   */
  async getHealth(): Promise<{ status: string; initialized: boolean; uptime: number; system?: any; deployment?: any }> {
    const baseHealth = {
      status: this.isInitialized ? 'healthy' : 'initializing',
      initialized: this.isInitialized,
      uptime: process.uptime()
    };

    if (this.systemIntegration) {
      const systemHealth = await this.systemIntegration.getSystemHealth();
      const systemStats = this.systemIntegration.getSystemStats();
      
      (baseHealth as any).system = {
        health: systemHealth,
        stats: systemStats
      };
    }

    if (this.healthMonitoring) {
      const healthStatus = await this.healthMonitoring.getHealthStatus();
      const diagnostics = this.healthMonitoring.getDiagnosticInfo();
      
      (baseHealth as any).monitoring = {
        status: healthStatus,
        diagnostics
      };
    }

    // Add deployment information
    const deploymentInfo = EnvironmentDetector.getDeploymentInfo();
    const currentConfig = this.deploymentConfigManager.getCurrentConfig();
    
    (baseHealth as any).deployment = {
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
  getConfig(): PluginConfig {
    return { ...this.config };
  }

  /**
   * Get system integration service
   */
  getSystemIntegration(): SystemIntegrationService | undefined {
    return this.systemIntegration;
  }

  /**
   * Get health monitoring service
   */
  getHealthMonitoring(): HealthMonitoringService | undefined {
    return this.healthMonitoring;
  }

  /**
   * Get service manager (for external access)
   */
  getServiceManager(): ServiceManager | undefined {
    return this.serviceManager;
  }

  /**
   * Get database manager (for external access)
   */
  getDatabaseManager(): DatabaseManager | undefined {
    return this.dbManager;
  }

  /**
   * Check if system is ready
   */
  isReady(): boolean {
    return this.isInitialized && 
           this.systemIntegration?.isReady() === true;
  }

  /**
   * Force shutdown (emergency stop)
   */
  async forceShutdown(): Promise<void> {
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
      
    } catch (error) {
      this.logger.error('Error during force shutdown:', error);
    }
  }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default MochiLinkPlugin;

// Re-export types for external use
export * from './types';
export * from './database/models';