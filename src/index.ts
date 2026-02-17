/**
 * Mochi-Link (大福连) - Main Plugin Entry Point
 * 
 * Simplified version with lazy loading to avoid module resolution issues
 */

import { Context, Schema, Logger } from 'koishi';
import { PluginConfig } from './types';

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
// Plugin Apply Function (with lazy loading)
// ============================================================================

export function apply(ctx: Context, config: PluginConfig) {
    const logger = ctx.logger('mochi-link');
    
    // Service instances
    let dbManager: any = null;
    let isInitialized = false;
    
    // Initialize on ready
    ctx.on('ready', async () => {
        try {
            logger.info('Starting Mochi-Link plugin...');
            
            // Initialize database
            const { SimpleDatabaseManager } = await import('./database/simple-init');
            dbManager = new SimpleDatabaseManager(ctx, config.database?.prefix || 'mochi');
            
            await dbManager.initialize();
            logger.info('Database initialized successfully');
            
            isInitialized = true;
            logger.info('Mochi-Link plugin started successfully');
            logger.info('Database tables created with prefix:', config.database?.prefix || 'mochi');
            
        } catch (error) {
            logger.error('Failed to start Mochi-Link plugin:', error);
            logger.error('Stack trace:', (error as Error).stack);
        }
    });
    
    // Cleanup on dispose
    ctx.on('dispose', async () => {
        try {
            logger.info('Stopping Mochi-Link plugin...');
            isInitialized = false;
            logger.info('Mochi-Link plugin stopped successfully');
        } catch (error) {
            logger.error('Error stopping Mochi-Link plugin:', error);
        }
    });
    
    // Register commands
    ctx.command('mochi', 'Mochi-Link 管理命令')
      .action(({ session }) => {
        return 'Mochi-Link (大福连) - Minecraft 统一管理系统\n' +
               '使用 mochi.help 查看可用命令';
      });
    
    ctx.command('mochi.server', '服务器管理')
      .action(({ session }) => {
        return '服务器管理命令：\n' +
               '  mochi.server.list - 列出所有服务器\n' +
               '  mochi.server.add <id> <name> - 添加服务器\n' +
               '  mochi.server.info <id> - 查看服务器信息\n' +
               '  mochi.server.remove <id> - 删除服务器';
      });
    
    ctx.command('mochi.server.list', '列出所有服务器')
      .action(async ({ session }) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        try {
          const servers = await dbManager.listServers();
          if (servers.length === 0) {
            return '暂无服务器';
          }
          
          return '服务器列表：\n' + servers.map(s => 
            `  [${s.id}] ${s.name} (${s.core_type}/${s.core_name}) - ${s.status}`
          ).join('\n');
        } catch (error) {
          logger.error('Failed to list servers:', error);
          return '获取服务器列表失败';
        }
      });
    
    ctx.command('mochi.server.add <id> <name>', '添加服务器')
      .option('type', '-t <type:string> 服务器类型 (java/bedrock)', { fallback: 'java' })
      .option('core', '-c <core:string> 核心名称', { fallback: 'paper' })
      .action(async ({ session, options }, id, name) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!id || !name) {
          return '用法: mochi.server.add <id> <name> [-t type] [-c core]';
        }
        
        try {
          // Check if server already exists
          const existing = await dbManager.getServer(id);
          if (existing) {
            return `服务器 ${id} 已存在`;
          }
          
          // Create server
          await dbManager.createServer({
            id,
            name,
            core_type: options.type as 'java' | 'bedrock',
            core_name: options.core,
            connection_mode: 'reverse',
            connection_config: JSON.stringify({}),
            status: 'offline',
            owner_id: session?.userId
          });
          
          // Create audit log
          await dbManager.createAuditLog({
            user_id: session?.userId,
            server_id: id,
            operation: 'server.create',
            operation_data: JSON.stringify({ name, type: options.type, core: options.core }),
            result: 'success'
          });
          
          return `服务器 ${name} (${id}) 创建成功`;
        } catch (error) {
          logger.error('Failed to create server:', error);
          return '创建服务器失败';
        }
      });
    
    ctx.command('mochi.server.info <id>', '查看服务器信息')
      .action(async ({ session }, id) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!id) {
          return '用法: mochi.server.info <id>';
        }
        
        try {
          const server = await dbManager.getServer(id);
          if (!server) {
            return `服务器 ${id} 不存在`;
          }
          
          return `服务器信息：\n` +
                 `  ID: ${server.id}\n` +
                 `  名称: ${server.name}\n` +
                 `  类型: ${server.core_type}\n` +
                 `  核心: ${server.core_name}\n` +
                 `  版本: ${server.core_version || '未知'}\n` +
                 `  状态: ${server.status}\n` +
                 `  连接模式: ${server.connection_mode}\n` +
                 `  创建时间: ${server.created_at.toLocaleString()}\n` +
                 `  最后更新: ${server.updated_at.toLocaleString()}`;
        } catch (error) {
          logger.error('Failed to get server info:', error);
          return '获取服务器信息失败';
        }
      });
    
    ctx.command('mochi.server.remove <id>', '删除服务器')
      .action(async ({ session }, id) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!id) {
          return '用法: mochi.server.remove <id>';
        }
        
        try {
          const server = await dbManager.getServer(id);
          if (!server) {
            return `服务器 ${id} 不存在`;
          }
          
          await dbManager.deleteServer(id);
          
          // Create audit log
          await dbManager.createAuditLog({
            user_id: session?.userId,
            server_id: id,
            operation: 'server.delete',
            operation_data: JSON.stringify({ name: server.name }),
            result: 'success'
          });
          
          return `服务器 ${server.name} (${id}) 已删除`;
        } catch (error) {
          logger.error('Failed to delete server:', error);
          return '删除服务器失败';
        }
      });
    
    ctx.command('mochi.audit', '查看审计日志')
      .option('limit', '-l <limit:number> 显示条数', { fallback: 10 })
      .action(async ({ session, options }) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        try {
          const logs = await dbManager.getAuditLogs(options.limit);
          if (logs.length === 0) {
            return '暂无审计日志';
          }
          
          return '审计日志：\n' + logs.map(log => 
            `  [${log.timestamp.toLocaleString()}] ${log.operation} - ${log.result}` +
            (log.user_id ? ` (用户: ${log.user_id})` : '') +
            (log.server_id ? ` (服务器: ${log.server_id})` : '')
          ).join('\n');
        } catch (error) {
          logger.error('Failed to get audit logs:', error);
          return '获取审计日志失败';
        }
      });
    
    // Expose service access methods
    ctx.provide('mochi-link', {
        getHealth: async () => {
            return {
                status: isInitialized ? 'healthy' : 'initializing',
                initialized: isInitialized,
                uptime: process.uptime(),
                database: isInitialized ? 'connected' : 'disconnected'
            };
        },
        getConfig: () => ({ ...config }),
        isReady: () => isInitialized,
        getDatabaseManager: () => dbManager
    });
}

// Export configuration schema for Koishi
apply.Config = Config;

// Re-export types for external use (optional, for advanced users)
export type { PluginConfig } from './types';
