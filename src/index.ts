/**
 * Mochi-Link (大福连) - Main Plugin Entry Point
 * 
 * Simplified version with lazy loading to avoid module resolution issues
 */

import { Context, Schema, Logger } from 'koishi';
import { PluginConfig } from './types';
import type { SimpleDatabaseManager } from './database/simple-init';
import type { MochiWebSocketServer } from './websocket/server';
import type { WebSocketConnection } from './websocket/connection';
import { ServiceManager } from './services';
import type { HTTPServer } from './http/server';

// ============================================================================
// Helper Functions
// ============================================================================

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
export const inject = ['database']; // Declare database dependency
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
    let dbManager: SimpleDatabaseManager | null = null;
    let serviceManager: ServiceManager | null = null;
    let wsManager: MochiWebSocketServer | null = null;
    let httpServer: HTTPServer | null = null;
    let isInitialized = false;
    
    /**
     * Get server ID from parameter or group binding
     */
    async function getServerId(session: any, providedId?: string): Promise<string | null> {
        if (providedId) {
            return providedId;
        }
        
        // Try to get from group binding
        if (session?.guildId && dbManager) {
            const serverId = await dbManager.getGroupPrimaryServer(session.guildId);
            return serverId;
        }
        
        return null;
    }
    
    // Initialize on ready
    ctx.on('ready', async () => {
        try {
            logger.info('Starting Mochi-Link plugin...');
            
            // Initialize table names with prefix
            const { TableNames } = await import('./database/table-names');
            TableNames.initialize(config.database?.prefix || 'mochi');
            logger.info(`Table names initialized with prefix: ${config.database?.prefix || 'mochi'}`);
            
            // Initialize database
            const { SimpleDatabaseManager } = await import('./database/simple-init');
            dbManager = new SimpleDatabaseManager(ctx, config.database?.prefix || 'mochi');
            
            await dbManager.initialize();
            logger.info('Database initialized successfully');
            
            // Initialize service manager
            serviceManager = new ServiceManager(ctx);
            await serviceManager.initialize();
            logger.info('Service manager initialized successfully');
            
            // Initialize WebSocket server
            try {
                const { SimpleTokenManager } = await import('./websocket/token-manager');
                const { MochiWebSocketServer } = await import('./websocket/server');
                const { AuthenticationManager } = await import('./websocket/auth');
                
                const tokenManager = new SimpleTokenManager(ctx, config.database?.prefix || 'mochi');
                const authManager = new AuthenticationManager(tokenManager);
                
                wsManager = new MochiWebSocketServer(authManager, {
                    port: config.websocket?.port || 8080,
                    host: config.websocket?.host || '0.0.0.0',
                    ssl: config.websocket?.ssl,
                    authenticationRequired: true,
                    maxConnections: config.security?.maxConnections || 100,
                    heartbeatInterval: 30000,
                    heartbeatTimeout: 5000
                });
                
                await wsManager.start();
                logger.info(`WebSocket server started on ${config.websocket?.host || '0.0.0.0'}:${config.websocket?.port || 8080}`);
                
                // Setup WebSocket event handlers using service manager
                wsManager.on('connection', (connection: WebSocketConnection) => {
                    logger.info(`Server connected: ${connection.serverId}`);
                });
                
                wsManager.on('authenticated', async (connection: WebSocketConnection) => {
                    logger.info(`Server authenticated: ${connection.serverId}`);
                    
                    // Update server status to online and create bridge
                    if (serviceManager) {
                        try {
                            await serviceManager.server.updateServerStatus(connection.serverId, 'online');
                            
                            // Create WebSocket bridge for command execution
                            await serviceManager.server.createWebSocketBridge(connection.serverId, connection);
                            
                            logger.info(`Bridge created for server ${connection.serverId}`);
                        } catch (error) {
                            logger.error(`Failed to setup server ${connection.serverId}:`, error);
                        }
                    }
                });
                
                wsManager.on('message', async (message: any, connection: WebSocketConnection) => {
                    try {
                        logger.debug(`Received message from ${connection.serverId}:`, message);
                        
                        if (!serviceManager) {
                            logger.error('Service manager not initialized');
                            return;
                        }

                        // Handle different message types according to U-WBP v2 protocol
                        switch (message.type) {
                            case 'request':
                                // Handle request messages (operations from connector)
                                const { RequestHandler } = await import('./services/request-handler');
                                const requestHandler = new RequestHandler(ctx, {
                                    event: serviceManager.event,
                                    server: serviceManager.server,
                                    player: serviceManager.player,
                                    playerAction: serviceManager.playerAction,
                                    serverControl: serviceManager.serverControl,
                                    whitelist: serviceManager.whitelist,
                                    command: serviceManager.command,
                                    permission: serviceManager.permission
                                });
                                
                                const response = await requestHandler.handleRequest(message, connection);
                                await connection.send(response);
                                break;

                            case 'response':
                                // Handle response messages (responses to our requests)
                                logger.debug(`Received response for request ${message.requestId}`);
                                // Emit event for pending request handlers
                                connection.emit('response', message);
                                break;

                            case 'event':
                                // Handle event messages (server events)
                                await serviceManager.messageRouter.handleServerEvent({
                                    serverId: connection.serverId,
                                    eventType: message.op || message.eventType,
                                    data: message.data || message,
                                    timestamp: message.timestamp || new Date().toISOString()  // 确保是 ISO 8601 字符串
                                });
                                break;

                            case 'system':
                                // Handle system messages (ping, pong, etc.)
                                await handleSystemMessage(message, connection);
                                break;

                            default:
                                logger.warn(`Unknown message type: ${message.type}`);
                        }
                        
                    } catch (error) {
                        logger.error(`Error handling message from ${connection.serverId}:`, error);
                        
                        // Send error response if it was a request
                        if (message.type === 'request') {
                            try {
                                const { MessageFactory } = await import('./protocol/messages');
                                const errorResponse = MessageFactory.createError(
                                    message.id,
                                    message.op,
                                    error instanceof Error ? error.message : 'Internal error',
                                    'INTERNAL_ERROR'
                                );
                                await connection.send(errorResponse);
                            } catch (sendError) {
                                logger.error('Failed to send error response:', sendError);
                            }
                        }
                    }
                });
                
                // Helper function to handle system messages
                async function handleSystemMessage(message: any, connection: WebSocketConnection) {
                    switch (message.systemOp || message.op) {
                        case 'ping':
                            // Respond with pong
                            const { MessageFactory } = await import('./protocol/messages');
                            const pongResponse = MessageFactory.createResponse(
                                message.id,
                                'system.pong',
                                {
                                    latency: Date.now() - (message.timestamp 
                                        ? new Date(message.timestamp).getTime() 
                                        : Date.now())
                                },
                                { success: true, serverId: connection.serverId }
                            );
                            await connection.send(pongResponse);
                            break;

                        case 'pong':
                            // Update connection ping time
                            connection.lastPing = Date.now();
                            logger.debug(`Pong received from ${connection.serverId}`);
                            break;

                        case 'disconnect':
                            logger.info(`Disconnect message from ${connection.serverId}: ${message.data?.reason}`);
                            break;

                        default:
                            logger.debug(`Unhandled system operation: ${message.systemOp || message.op}`);
                    }
                }
                
                wsManager.on('disconnection', async (connection: WebSocketConnection, code: number, reason: string) => {
                    logger.info(`Server disconnected: ${connection.serverId} (${code}: ${reason})`);
                    
                    // Update server status to offline and remove bridge
                    if (serviceManager) {
                        try {
                            await serviceManager.server.updateServerStatus(connection.serverId, 'offline');
                            
                            // Remove bridge
                            await serviceManager.server.removeBridge(connection.serverId);
                            
                            logger.info(`Bridge removed for server ${connection.serverId}`);
                        } catch (error) {
                            logger.error(`Failed to cleanup server ${connection.serverId}:`, error);
                        }
                    }
                });
                
                wsManager.on('error', (error: Error) => {
                    logger.error('WebSocket server error:', error);
                });
                
            } catch (wsError) {
                logger.error('Failed to start WebSocket server:', wsError);
                logger.warn('Plugin will continue without WebSocket support');
            }
            
            // Initialize HTTP API server (if configured)
            if (config.http && serviceManager) {
                try {
                    const { HTTPServer } = await import('./http/server');
                    httpServer = new HTTPServer(ctx, config.http, serviceManager);
                    await httpServer.start();
                    logger.info(`HTTP API server started on ${config.http.host || 'localhost'}:${config.http.port || 3000}`);
                } catch (httpError) {
                    logger.error('Failed to start HTTP API server:', httpError);
                    logger.warn('Plugin will continue without HTTP API support');
                }
            }
            
            isInitialized = true;
            logger.info('Mochi-Link plugin initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Mochi-Link plugin:', error);
        }
    });
    
    // Cleanup on dispose
    ctx.on('dispose', async () => {
        try {
            logger.info('Stopping Mochi-Link plugin...');
            
            // Stop HTTP server
            if (httpServer) {
                try {
                    await httpServer.stop();
                    logger.info('HTTP API server stopped');
                } catch (error) {
                    logger.error('Error stopping HTTP API server:', error);
                }
            }
            
            // Stop WebSocket server
            if (wsManager) {
                try {
                    await wsManager.stop();
                    logger.info('WebSocket server stopped');
                } catch (error) {
                    logger.error('Error stopping WebSocket server:', error);
                }
            }
            
            // Cleanup service manager
            if (serviceManager) {
                try {
                    await serviceManager.cleanup();
                    logger.info('Service manager cleaned up');
                } catch (error) {
                    logger.error('Error cleaning up service manager:', error);
                }
            }
            
            isInitialized = false;
            logger.info('Mochi-Link plugin stopped successfully');
        } catch (error) {
            logger.error('Error stopping Mochi-Link plugin:', error);
        }
    });
    
    // ========================================================================
    // Command Registration with Permission Levels
    // ========================================================================
    // Level 1: 普通用户 - 查看信息
    // Level 2: 受信任用户 - 基本操作
    // Level 3: 管理员 - 管理操作
    // Level 4: 超级管理员 - 危险操作
    
    // Root command - Level 1 (所有用户可用)
    ctx.command('mochi', 'Minecraft 统一管理系统')
      .alias('大福连')
      .alias('墨池')
      .userFields(['authority']);
    
    // Server management - Level 2 (受信任用户)
    ctx.command('mochi.server', '服务器管理')
      .userFields(['authority']);
    
    // List servers - Level 1 (所有用户可查看)
    ctx.command('mochi.server.list', '列出所有服务器')
      .userFields(['authority'])
      .action(async ({ session }) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        try {
          const servers = await dbManager.listServers();
          if (servers.length === 0) {
            return '暂无服务器';
          }
          
          const header = '服务器列表：';
          const items = servers.map((s: any) => {
            return `  [${s.id}] ${s.name} (${s.core_type}/${s.core_name}) - ${s.status}`;
          }).join('\n');
          return header + '\n' + items;
        } catch (error) {
          logger.error('Failed to list servers:', error);
          return '获取服务器列表失败';
        }
      });
    
    // Add server - Level 3 (管理员)
    ctx.command('mochi.server.add <id> <name:text>', '添加服务器')
      .userFields(['authority'])
      .option('type', '-t <type:string> 服务器类型 (java/bedrock)', { fallback: 'java' })
      .option('core', '-c <core:string> 核心类型 (paper/fabric/forge/folia/nukkit/pmmp/llbds)', { fallback: 'paper' })
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .action(async ({ session, options }, id, name) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!id || !name) {
          return '用法: mochi.server.add <id> <name> [-t type] [-c core]\n' +
                 '示例: mochi.server.add survival 生存服 -t java -c paper\n' +
                 '      mochi.server.add survival "My Server" -t java -c paper  (名称包含空格时使用引号)';
        }
        
        if (!options) {
          return '选项参数错误';
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
            core_type: (options.type || 'java') as 'java' | 'bedrock',
            core_name: options.core || 'paper',
            connection_mode: 'reverse',
            connection_config: JSON.stringify({}),
            status: 'offline',
            owner_id: session?.userId
          });
          
          // Generate API token for the server
          const crypto = await import('crypto');
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          await dbManager.createAPIToken(id, token, tokenHash);
          
          // Create audit log using service
          if (serviceManager?.audit) {
            await serviceManager.audit.logger.logServerOperation(
              id,
              'create',
              { name, type: options.type, core: options.core },
              'success',
              undefined,
              { userId: session?.userId }
            );
          }
          
          return `✅ 服务器创建成功！\n\n` +
                 `📋 服务器信息:\n` +
                 `  🆔 ID: ${id}\n` +
                 `  📝 名称: ${name}\n` +
                 `  🎮 类型: ${options.type}\n` +
                 `  ⚙️ 核心: ${options.core}\n\n` +
                 `🔐 连接令牌:\n` +
                 `  ${token}\n\n` +
                 `📝 下一步:\n` +
                 `  1. 在连接器配置中使用此令牌\n` +
                 `  2. 使用 mochi.server.token ${id} 可随时查看令牌\n` +
                 `  3. 使用 mochi.server.token ${id} -r 可重新生成令牌`;
        } catch (error) {
          logger.error('Failed to create server:', error);
          return '创建服务器失败';
        }
      });
    
    // Register server - Level 3 (管理员) - 完整注册（包含连接信息）
    ctx.command('mochi.server.register <id> <name:text>', '注册服务器（完整信息）')
      .userFields(['authority'])
      .option('host', '--host <host:string> 服务器地址', { fallback: '127.0.0.1' })
      .option('port', '-p <port:number> 服务器端口', { fallback: 25565 })
      .option('type', '-t <type:string> 服务器类型 (java/bedrock)', { fallback: 'java' })
      .option('core', '-c <core:string> 核心类型 (paper/fabric/forge/folia/nukkit/pmmp/llbds)', { fallback: 'paper' })
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .action(async ({ session, options }, id, name) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!id || !name) {
          return '用法: mochi.server.register <id> <name> [--host host] [-p port] [-t type] [-c core]\n' +
                 '示例: mochi.server.register survival 生存服 --host 127.0.0.1 -p 25565 -t java -c paper';
        }
        
        if (!options) {
          return '选项参数错误';
        }
        
        // 验证 ID 格式
        if (!/^[\w-]+$/.test(id)) {
          return '❌ 服务器 ID 格式错误\n' +
                 'ID 只能包含字母、数字、下划线和连字符';
        }
        
        // 验证端口范围
        const port = options.port ?? 25565;
        if (port < 1 || port > 65535) {
          return '❌ 端口号必须在 1-65535 范围内';
        }
        
        const host = options.host ?? '127.0.0.1';
        const type = options.type ?? 'java';
        const core = options.core ?? 'paper';
        
        try {
          // 检查服务器是否已存在
          const existing = await dbManager.getServer(id);
          if (existing) {
            return `❌ 服务器 ID "${id}" 已存在\n\n` +
                   `💡 提示:\n` +
                   `  • 使用 mochi.server.list 查看已注册的服务器\n` +
                   `  • 选择一个不同的 ID\n` +
                   `  • 或使用 mochi.server.remove ${id} 删除旧服务器（需要超级管理员权限）`;
          }
          
          // 自动识别服务器类型
          const bedrockCores = ['nukkit', 'pmmp', 'bds', 'llbds', 'powernukkit', 'cloudburst'];
          const autoType = bedrockCores.some(bc => core.toLowerCase().includes(bc)) ? 'bedrock' : 'java';
          const finalType = type || autoType;
          
          // 创建服务器
          await dbManager.createServer({
            id,
            name,
            core_type: finalType as 'java' | 'bedrock',
            core_name: core,
            connection_mode: 'reverse',
            connection_config: JSON.stringify({
              host: host,
              port: port
            }),
            status: 'offline',
            owner_id: session?.userId
          });
          
          // 生成 API token
          const crypto = await import('crypto');
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          await dbManager.createAPIToken(id, token, tokenHash);
          
          // 创建审计日志使用服务
          if (serviceManager?.audit) {
            await serviceManager.audit.logger.logServerOperation(
              id,
              'register',
              {
                id,
                name,
                host: host,
                port: port,
                type: finalType,
                core: core
              },
              'success',
              undefined,
              { userId: session?.userId }
            );
          }
          
          // 根据核心类型推荐连接器
          const connectorMap: Record<string, string> = {
            'paper': 'MochiLinkConnector-Paper.jar',
            'spigot': 'MochiLinkConnector-Paper.jar',
            'folia': 'MochiLinkConnector-Folia.jar',
            'fabric': 'MochiLinkConnector-Fabric.jar',
            'forge': 'MochiLinkConnector-Forge.jar',
            'nukkit': 'MochiLinkConnector-Nukkit.jar',
            'powernukkit': 'MochiLinkConnector-Nukkit.jar',
            'llbds': 'mochi-link-connector-llbds',
            'pmmp': 'mochi-link-connector-pmmp'
          };
          
          const connector = connectorMap[core.toLowerCase()] || '对应的连接器';
          
          return `✅ 服务器注册成功！\n\n` +
                 `📋 服务器信息:\n` +
                 `  🆔 ID: ${id}\n` +
                 `  📝 名称: ${name}\n` +
                 `  🎮 类型: ${finalType === 'java' ? 'Java 版' : '基岩版'}\n` +
                 `  ⚙️ 核心: ${core}\n` +
                 `  🌐 地址: ${host}:${port}\n` +
                 `  👤 所有者: ${session?.username || session?.userId}\n\n` +
                 `� 连接令牌:\n` +
                 `  ${token}\n\n` +
                 `📦 连接配置:\n` +
                 `  WebSocket URL: ws://your-host:${config.websocket?.port || 8080}/ws?serverId=${id}&token=${token}\n\n` +
                 `📦 下一步:\n` +
                 `  1️⃣ 在服务器上安装连接器: ${connector}\n` +
                 `  2️⃣ 在连接器配置中设置:\n` +
                 `     - serverId: ${id}\n` +
                 `     - token: ${token}\n` +
                 `     - url: ws://your-host:${config.websocket?.port || 8080}/ws\n` +
                 `  3️⃣ 启动服务器，等待连接建立\n` +
                 `  4️⃣ 使用 mochi.server.list 查看连接状态\n\n` +
                 `💡 提示:\n` +
                 `  • 使用 mochi.server.token ${id} 可随时查看令牌\n` +
                 `  • 使用 mochi.server.token ${id} -r 可重新生成令牌\n` +
                 `  • 请妥善保管令牌，不要泄露`;
        } catch (error) {
          logger.error('Failed to register server:', error);
          return `❌ 注册服务器失败\n\n` +
                 `错误信息: ${(error as Error).message}\n\n` +
                 `💡 如果问题持续，请联系管理员查看日志`;
        }
      });
    

    
    // Server info - Level 1 (所有用户可查看)
    ctx.command('mochi.server.info [id]', '查看服务器信息')
      .userFields(['authority'])
      .action(async ({ session }, id) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        const targetServerId = await getServerId(session, id);
        
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.server.info [id]';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
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
    
    // Server token - Level 3 (管理员)
    ctx.command('mochi.server.token <id>', '查看服务器连接令牌')
      .userFields(['authority'])
      .option('regenerate', '-r 重新生成令牌', { fallback: false })
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .action(async ({ session, options }, id) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!id) {
          return '用法: mochi.server.token <id> [-r]\n' +
                 '示例: mochi.server.token survival';
        }
        
        if (!options) {
          return '选项参数错误';
        }
        
        try {
          const server = await dbManager.getServer(id);
          if (!server) {
            return `服务器 ${id} 不存在`;
          }
          
          const crypto = await import('crypto');
          
          // 检查是否需要重新生成令牌
          if (options.regenerate) {
            // 删除旧令牌
            await dbManager.deleteServerAPITokens(id);
            
            // 生成新的令牌
            const newToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
            
            // 创建新令牌
            await dbManager.createAPIToken(id, newToken, tokenHash);
            
            // 记录审计日志使用服务
            if (serviceManager?.audit) {
              await serviceManager.audit.logger.logServerOperation(
                id,
                'token.regenerate',
                { server_name: server.name },
                'success',
                undefined,
                { userId: session?.userId }
              );
            }
            
            return `✅ 令牌已重新生成\n\n` +
                   `🔐 服务器连接令牌:\n` +
                   `  服务器: ${server.name} (${id})\n` +
                   `  令牌: ${newToken}\n\n` +
                   `⚠️ 警告:\n` +
                   `  • 旧令牌已失效，请立即更新连接器配置\n` +
                   `  • 请妥善保管令牌，不要泄露给他人\n` +
                   `  • 令牌用于服务器连接认证\n\n` +
                   `📝 连接配置:\n` +
                   `  URL: ws://your-host:${config.websocket?.port || 8080}/ws?serverId=${id}&token=${newToken}`;
          }
          
          // 查看现有令牌
          const tokens = await dbManager.getAPITokens(id);
          
          if (tokens.length === 0) {
            // 如果没有令牌，自动生成一个
            const newToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
            
            await dbManager.createAPIToken(id, newToken, tokenHash);
            
            return `✅ 令牌已生成\n\n` +
                   `🔐 服务器连接令牌:\n` +
                   `  服务器: ${server.name} (${id})\n` +
                   `  令牌: ${newToken}\n\n` +
                   `📝 使用说明:\n` +
                   `  1. 在连接器配置文件中设置此令牌\n` +
                   `  2. 令牌用于服务器连接认证\n` +
                   `  3. 请妥善保管，不要泄露\n\n` +
                   `📝 连接配置:\n` +
                   `  URL: ws://your-host:${config.websocket?.port || 8080}/ws?serverId=${id}&token=${newToken}\n\n` +
                   `💡 提示: 使用 -r 选项可以重新生成令牌`;
          }
          
          // 显示所有令牌
          const tokenList = tokens.map((t: any, i: number) => {
            const expiryInfo = t.expiresAt 
              ? `\n  过期时间: ${new Date(t.expiresAt).toLocaleString()}`
              : '';
            const lastUsedInfo = t.lastUsed
              ? `\n  最后使用: ${new Date(t.lastUsed).toLocaleString()}`
              : '';
            const ipWhitelistInfo = t.ipWhitelist && t.ipWhitelist.length > 0
              ? `\n  IP 白名单: ${t.ipWhitelist.join(', ')}`
              : '';
            
            return `令牌 #${i + 1}:\n` +
                   `  ID: ${t.id}\n` +
                   `  令牌: ${t.token}\n` +
                   `  创建时间: ${new Date(t.createdAt).toLocaleString()}` +
                   expiryInfo + lastUsedInfo + ipWhitelistInfo;
          }).join('\n\n');
          
          return `🔐 服务器连接令牌:\n` +
                 `  服务器: ${server.name} (${id})\n\n` +
                 tokenList + '\n\n' +
                 `📝 连接配置:\n` +
                 `  URL: ws://your-host:${config.websocket?.port || 8080}/ws?serverId=${id}&token=${tokens[0].token}\n\n` +
                 `💡 提示: 使用 -r 选项可以重新生成令牌`;
        } catch (error) {
          logger.error('Failed to get server token:', error);
          return '获取服务器令牌失败: ' + (error instanceof Error ? error.message : String(error));
        }
      });
    
    // Remove server - Level 4 (超级管理员)
    ctx.command('mochi.server.remove <id>', '删除服务器')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 4) {
          return '权限不足：需要超级管理员权限（等级 4）';
        }
      })
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
          
          // Create audit log using service
          if (serviceManager?.audit) {
            await serviceManager.audit.logger.logServerOperation(
              id,
              'delete',
              { name: server.name },
              'success',
              undefined,
              { userId: session?.userId }
            );
          }
          
          return `服务器 ${server.name} (${id}) 已删除`;
        } catch (error) {
          logger.error('Failed to delete server:', error);
          return '删除服务器失败';
        }
      });
    
    // Audit logs - Level 3 (管理员)
    ctx.command('mochi.audit', '审计日志')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .option('limit', '-l <limit:number> 显示条数 (默认10)', { fallback: 10 })
      .action(async ({ session, options }) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        if (!options) {
          return '选项参数错误';
        }
        
        try {
          // 使用 AuditService 查询日志
          const logs = await serviceManager.audit.query.getRecentLogs(options.limit);
          if (logs.length === 0) {
            return '暂无审计日志';
          }
          
          return `审计日志 (最近 ${logs.length} 条)：\n` + logs.map((log: any) => 
            `  [${log.createdAt.toLocaleString()}] ${log.operation} - ${log.result}` +
            (log.userId ? ` (用户: ${log.userId})` : '') +
            (log.serverId ? ` (服务器: ${log.serverId})` : '')
          ).join('\n');
        } catch (error) {
          logger.error('Failed to get audit logs:', error);
          return '获取审计日志失败';
        }
      });
    
    // ========================================================================
    // 权限管理命令
    // ========================================================================
    
    // Permission management - Level 3 (管理员)
    ctx.command('mochi.permission', '权限管理')
      .alias('mochi.perm')
      .alias('mochi.op')
      .userFields(['authority']);
    
    // Grant permission - Level 4 (仅服务器所有者)
    ctx.command('mochi.permission.grant <userId> <serverId> <role>', '授予权限')
      .alias('mochi.op.grant')
      .userFields(['authority'])
      .option('expires', '-e <date:string> 过期时间 (ISO 8601格式)', { fallback: undefined })
      .option('reason', '-r <reason:text> 授权原因', { fallback: undefined })
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 4) {
          return '权限不足：只有服务器所有者可以授予权限（等级 4）';
        }
      })
      .action(async ({ session, options }, userId, serverId, role) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        if (!userId || !serverId || !role) {
          return '用法: mochi.permission.grant <userId> <serverId> <role>\n' +
                 '可用角色: admin, sm, pm, moderator, viewer\n' +
                 '选项:\n' +
                 '  -e <date> 过期时间 (例如: 2024-12-31T23:59:59Z)\n' +
                 '  -r <reason> 授权原因';
        }
        
        // 验证角色
        const validRoles = ['admin', 'sm', 'pm', 'moderator', 'viewer'];
        if (!validRoles.includes(role)) {
          return `无效的角色: ${role}\n可用角色: ${validRoles.join(', ')}`;
        }
        
        try {
          // 验证服务器存在
          const server = await dbManager!.getServer(serverId);
          if (!server) {
            return `服务器 ${serverId} 不存在`;
          }
          
          // 检查是否为服务器所有者
          if (server.owner_id !== session?.userId) {
            return `权限不足：只有服务器所有者 (${server.owner_id}) 可以授予权限`;
          }
          
          const expiresAt = options?.expires ? new Date(options.expires) : undefined;
          
          const acl = await serviceManager.permission.assignRole(
            userId,
            serverId,
            role as any,
            session?.userId || 'system',
            expiresAt
          );
          
          let message = `✅ 已授予用户 ${userId} 在服务器 ${server.name} (${serverId}) 的 ${role} 权限`;
          if (expiresAt) {
            message += `\n⏰ 过期时间: ${expiresAt.toLocaleString()}`;
          }
          if (options?.reason) {
            message += `\n📝 原因: ${options.reason}`;
          }
          
          return message;
        } catch (error) {
          logger.error('Failed to grant permission:', error);
          return `授予权限失败: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
    
    // Revoke permission - Level 4 (仅服务器所有者)
    ctx.command('mochi.permission.revoke <userId> <serverId>', '撤销权限')
      .alias('mochi.op.revoke')
      .userFields(['authority'])
      .option('reason', '-r <reason:text> 撤销原因', { fallback: undefined })
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 4) {
          return '权限不足：只有服务器所有者可以撤销权限（等级 4）';
        }
      })
      .action(async ({ session, options }, userId, serverId) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        if (!userId || !serverId) {
          return '用法: mochi.permission.revoke <userId> <serverId>\n' +
                 '选项:\n' +
                 '  -r <reason> 撤销原因';
        }
        
        try {
          // 验证服务器存在
          const server = await dbManager!.getServer(serverId);
          if (!server) {
            return `服务器 ${serverId} 不存在`;
          }
          
          // 检查是否为服务器所有者
          if (server.owner_id !== session?.userId) {
            return `权限不足：只有服务器所有者 (${server.owner_id}) 可以撤销权限`;
          }
          
          const success = await serviceManager.permission.removeRole(
            userId,
            serverId,
            session?.userId || 'system'
          );
          
          if (success) {
            let message = `✅ 已撤销用户 ${userId} 在服务器 ${server.name} (${serverId}) 的权限`;
            if (options?.reason) {
              message += `\n📝 原因: ${options.reason}`;
            }
            return message;
          } else {
            return `撤销权限失败：用户可能没有该服务器的权限`;
          }
        } catch (error) {
          logger.error('Failed to revoke permission:', error);
          return `撤销权限失败: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
    
    // Update permission - Level 4 (仅服务器所有者)
    ctx.command('mochi.permission.update <userId> <serverId> <role>', '更新权限')
      .alias('mochi.op.update')
      .userFields(['authority'])
      .option('expires', '-e <date:string> 过期时间 (ISO 8601格式)', { fallback: undefined })
      .option('reason', '-r <reason:text> 更新原因', { fallback: undefined })
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 4) {
          return '权限不足：只有服务器所有者可以更新权限（等级 4）';
        }
      })
      .action(async ({ session, options }, userId, serverId, role) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        if (!userId || !serverId || !role) {
          return '用法: mochi.permission.update <userId> <serverId> <role>\n' +
                 '可用角色: admin, sm, pm, moderator, viewer\n' +
                 '选项:\n' +
                 '  -e <date> 过期时间 (例如: 2024-12-31T23:59:59Z)\n' +
                 '  -r <reason> 更新原因';
        }
        
        // 验证角色
        const validRoles = ['admin', 'sm', 'pm', 'moderator', 'viewer'];
        if (!validRoles.includes(role)) {
          return `无效的角色: ${role}\n可用角色: ${validRoles.join(', ')}`;
        }
        
        try {
          // 验证服务器存在
          const server = await dbManager!.getServer(serverId);
          if (!server) {
            return `服务器 ${serverId} 不存在`;
          }
          
          // 检查是否为服务器所有者
          if (server.owner_id !== session?.userId) {
            return `权限不足：只有服务器所有者 (${server.owner_id}) 可以更新权限`;
          }
          
          const expiresAt = options?.expires ? new Date(options.expires) : undefined;
          
          await serviceManager.permission.updateRole(
            userId,
            serverId,
            role as any,
            session?.userId || 'system',
            expiresAt,
            options?.reason
          );
          
          let message = `✅ 已更新用户 ${userId} 在服务器 ${server.name} (${serverId}) 的权限为 ${role}`;
          if (expiresAt) {
            message += `\n⏰ 过期时间: ${expiresAt.toLocaleString()}`;
          }
          if (options?.reason) {
            message += `\n📝 原因: ${options.reason}`;
          }
          
          return message;
        } catch (error) {
          logger.error('Failed to update permission:', error);
          return `更新权限失败: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
    
    // Query permission - Level 1 (所有用户可查询自己的权限)
    ctx.command('mochi.permission.query [userId] [serverId]', '查询权限')
      .alias('mochi.op.query')
      .userFields(['authority'])
      .action(async ({ session }, userId, serverId) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        // 如果没有指定 userId，查询自己的权限
        const targetUserId = userId || session?.userId;
        if (!targetUserId) {
          return '无法确定用户 ID';
        }
        
        // 如果查询他人权限，需要管理员权限
        if (userId && userId !== session?.userId && (session?.user?.authority ?? 0) < 3) {
          return '权限不足：查询他人权限需要管理员权限（等级 3）';
        }
        
        try {
          if (serverId) {
            // 查询特定服务器的权限
            const server = await dbManager!.getServer(serverId);
            if (!server) {
              return `服务器 ${serverId} 不存在`;
            }
            
            const role = await serviceManager.permission.getUserRole(targetUserId, serverId);
            if (!role) {
              return `用户 ${targetUserId} 在服务器 ${server.name} (${serverId}) 没有权限`;
            }
            
            const permissions = await serviceManager.permission.getUserPermissions(targetUserId, serverId);
            const serverUsers = await serviceManager.permission.getServerUsers(serverId);
            const userInfo = serverUsers.find(u => u.userId === targetUserId);
            
            let message = `👤 用户 ${targetUserId} 在服务器 ${server.name} (${serverId}) 的权限：\n`;
            message += `📋 角色: ${role}\n`;
            message += `🔑 权限数量: ${permissions.length}\n`;
            if (userInfo) {
              message += `👨‍💼 授予者: ${userInfo.grantedBy}\n`;
              message += `📅 授予时间: ${userInfo.grantedAt.toLocaleString()}\n`;
              if (userInfo.expiresAt) {
                message += `⏰ 过期时间: ${userInfo.expiresAt.toLocaleString()}\n`;
              }
            }
            
            return message;
          } else {
            // 查询所有服务器的权限
            const managedServers = await serviceManager.permission.getUserManagedServers(targetUserId);
            
            if (managedServers.length === 0) {
              return `用户 ${targetUserId} 没有管理任何服务器的权限`;
            }
            
            let message = `👤 用户 ${targetUserId} 的权限列表：\n\n`;
            for (const server of managedServers) {
              message += `📦 ${server.serverName} (${server.serverId})\n`;
              message += `  📋 角色: ${server.role}\n`;
              message += `  📅 授予时间: ${server.grantedAt.toLocaleString()}\n`;
              if (server.expiresAt) {
                message += `  ⏰ 过期时间: ${server.expiresAt.toLocaleString()}\n`;
              }
              message += '\n';
            }
            
            return message;
          }
        } catch (error) {
          logger.error('Failed to query permission:', error);
          return `查询权限失败: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
    
    // List permissions - Level 3 (管理员)
    ctx.command('mochi.permission.list <serverId> [role]', '列出服务器权限')
      .alias('mochi.op.list')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .action(async ({ session }, serverId, role) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        if (!serverId) {
          return '用法: mochi.permission.list <serverId> [role]\n' +
                 '可选角色过滤: admin, sm, pm, moderator, viewer';
        }
        
        try {
          // 验证服务器存在
          const server = await dbManager!.getServer(serverId);
          if (!server) {
            return `服务器 ${serverId} 不存在`;
          }
          
          const serverUsers = await serviceManager.permission.getServerUsers(serverId);
          
          // 按角色过滤
          const filteredUsers = role 
            ? serverUsers.filter(u => u.role === role)
            : serverUsers;
          
          if (filteredUsers.length === 0) {
            return role 
              ? `服务器 ${server.name} (${serverId}) 没有 ${role} 角色的用户`
              : `服务器 ${server.name} (${serverId}) 没有配置任何权限`;
          }
          
          let message = `📋 服务器 ${server.name} (${serverId}) 的权限列表`;
          if (role) {
            message += ` (角色: ${role})`;
          }
          message += '：\n\n';
          
          // 按角色分组
          const roleGroups: Record<string, typeof filteredUsers> = {};
          for (const user of filteredUsers) {
            if (!roleGroups[user.role]) {
              roleGroups[user.role] = [];
            }
            roleGroups[user.role].push(user);
          }
          
          // 角色排序
          const roleOrder = ['owner', 'admin', 'sm', 'pm', 'moderator', 'viewer'];
          const sortedRoles = Object.keys(roleGroups).sort((a, b) => 
            roleOrder.indexOf(a) - roleOrder.indexOf(b)
          );
          
          for (const roleName of sortedRoles) {
            const users = roleGroups[roleName];
            message += `【${roleName.toUpperCase()}】 (${users.length}人)\n`;
            for (const user of users) {
              message += `  👤 ${user.userId}\n`;
              message += `    授予者: ${user.grantedBy}\n`;
              message += `    授予时间: ${user.grantedAt.toLocaleString()}\n`;
              if (user.expiresAt) {
                message += `    过期时间: ${user.expiresAt.toLocaleString()}\n`;
              }
            }
            message += '\n';
          }
          
          return message;
        } catch (error) {
          logger.error('Failed to list permissions:', error);
          return `列出权限失败: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
    
    // Show role information - Level 1 (所有用户可查看)
    ctx.command('mochi.permission.roles', '查看角色说明')
      .alias('mochi.op.roles')
      .userFields(['authority'])
      .action(async () => {
        return `📋 Mochi-Link 权限角色说明：

【Owner - 服主】
  等级: 5 (最高)
  权限: 所有权限
  说明: 服务器创建者，拥有完全控制权
  特权: 可以授予和撤销其他用户的权限

【Admin - 管理员】
  等级: 4
  权限: 服务器管理 + 玩家管理 + 命令执行
  说明: 全面管理服务器和玩家
  继承: SM + PM + Moderator 的所有权限

【SM - Server Manager (服务器管理员)】
  等级: 3
  权限: 服务器控制、命令执行、日志查看
  说明: 专注于服务器运维和维护
  操作: 重启、停止、保存、执行命令、查看日志

【PM - Player Manager (玩家管理员)】
  等级: 3
  权限: 玩家管理、白名单、消息发送
  说明: 专注于玩家管理和社区维护
  操作: 踢出、封禁、白名单、发送消息

【Moderator - 协管员】
  等级: 2
  权限: 基础玩家管理
  说明: 协助维护服务器秩序
  操作: 踢出玩家、发送警告、查看信息

【Viewer - 查看者】
  等级: 1
  权限: 只读权限
  说明: 只能查看服务器和玩家信息
  操作: 查看状态、玩家列表、性能数据

💡 提示：
  - 只有 Owner 可以授予和撤销权限
  - SM 和 PM 是平行角色，各有专长
  - Admin 拥有 SM 和 PM 的所有权限`;
      });
    
    // ========================================================================
    // 白名单管理命令
    // ========================================================================
    
    // Whitelist management - Level 2 (受信任用户)
    ctx.command('mochi.whitelist', '白名单管理')
      .userFields(['authority']);
    
    // List whitelist - Level 1 (所有用户可查看)
    ctx.command('mochi.whitelist.list [serverId]', '查看白名单')
      .userFields(['authority'])
      .action(async ({ session }, serverId) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        // 获取服务器 ID（从参数或群组绑定）
        const targetServerId = await getServerId(session, serverId);
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.whitelist.list <serverId>\n' +
                 '或在群组中: mochi.bind.add <serverId>';
        }
        
        try {
          // 验证服务器存在
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          // 调用实际的白名单服务
          if (serviceManager?.whitelist) {
            try {
              const whitelist = await serviceManager.whitelist.getWhitelist(targetServerId);
              
              if (!whitelist || whitelist.length === 0) {
                return `服务器 ${server.name} 的白名单为空`;
              }
              
              return `服务器 ${server.name} 的白名单 (${whitelist.length} 人)：\n` +
                     whitelist.map((entry: any, index: number) => 
                       `  [${index + 1}] ${entry.name || entry.uuid}`
                     ).join('\n');
            } catch (error) {
              logger.error('Failed to get whitelist from service:', error);
              return `获取白名单失败: ${(error as Error).message}\n` +
                     `提示: 确保服务器已连接`;
            }
          } else {
            return `服务器 ${server.name} 的白名单功能需要服务器连接\n` +
                   `提示: 请确保服务器已通过 WebSocket 连接`;
          }
        } catch (error) {
          logger.error('Failed to get whitelist:', error);
          return '获取白名单失败';
        }
      });
    
    // Add to whitelist - Level 2 (受信任用户)
    ctx.command('mochi.whitelist.add [serverId] <player:text>', '添加白名单')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 2) {
          return '权限不足：需要受信任用户权限（等级 2）';
        }
      })
      .action(async ({ session }, serverIdOrPlayer, player) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        // 判断参数：如果只有一个参数，则为 player，serverId 从群组绑定获取
        let targetServerId: string | null;
        let targetPlayer: string;
        
        if (!player) {
          // 只有一个参数，从群组绑定获取服务器
          targetServerId = await getServerId(session);
          targetPlayer = serverIdOrPlayer;
        } else {
          // 两个参数，第一个可能是服务器 ID
          targetServerId = await getServerId(session, serverIdOrPlayer);
          targetPlayer = player;
        }
        
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.whitelist.add <serverId> <player>\n' +
                 '      mochi.whitelist.add <serverId> "Player Name"  (玩家名包含空格时使用引号)\n' +
                 '或在群组中: mochi.whitelist.add <player>';
        }
        
        if (!targetPlayer) {
          return '请指定玩家名称';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          // 调用实际的白名单服务
          if (serviceManager?.whitelist) {
            try {
              await serviceManager.whitelist.addToWhitelist(
                targetServerId, 
                targetPlayer,  // playerId
                targetPlayer,  // playerName (使用相同的值)
                session?.userId || 'system',  // executor
                undefined  // reason (可选)
              );
              
              // 记录审计日志使用服务
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'whitelist.add',
                  { player: targetPlayer },
                  'success',
                  undefined,
                  { userId: session?.userId }
                );
              }
              
              return `已将 ${targetPlayer} 添加到服务器 ${server.name} 的白名单`;
            } catch (error) {
              logger.error('Failed to add to whitelist:', error);
              
              // 记录失败的审计日志使用服务
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'whitelist.add',
                  { player: targetPlayer },
                  'failure',
                  (error as Error).message,
                  { userId: session?.userId }
                );
              }
              
              return `添加到白名单失败: ${(error as Error).message}`;
            }
          } else {
            return `服务器 ${server.name} 的白名单功能需要服务器连接\n` +
                   `提示: 请确保服务器已通过 WebSocket 连接`;
          }
        } catch (error) {
          logger.error('Failed to add to whitelist:', error);
          return '添加到白名单失败';
        }
      });
    
    // Remove from whitelist - Level 2 (受信任用户)
    ctx.command('mochi.whitelist.remove [serverId] <player:text>', '移除白名单')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 2) {
          return '权限不足：需要受信任用户权限（等级 2）';
        }
      })
      .action(async ({ session }, serverIdOrPlayer, player) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        let targetServerId: string | null;
        let targetPlayer: string;
        
        if (!player) {
          // 只有一个参数，从群组绑定获取serverId
          targetServerId = await getServerId(session);
          targetPlayer = serverIdOrPlayer;
        } else {
          // 有两个参数
          targetServerId = await getServerId(session, serverIdOrPlayer);
          targetPlayer = player;
        }
        
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.whitelist.remove [serverId] <player>\n' +
                 '或在群组中: mochi.bind.add <serverId>';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          // 调用实际的白名单服务
          if (serviceManager?.whitelist) {
            try {
              await serviceManager.whitelist.removeFromWhitelist(
                targetServerId,
                targetPlayer,  // playerId
                session?.userId || 'system',  // executor
                undefined  // reason (可选)
              );
              
              // 记录审计日志使用服务
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'whitelist.remove',
                  { player: targetPlayer },
                  'success',
                  undefined,
                  { userId: session?.userId }
                );
              }
              
              return `✅ 已将 ${targetPlayer} 从服务器 ${server.name} 的白名单移除`;
            } catch (error) {
              logger.error('Failed to remove from whitelist:', error);
              
              // 记录失败的审计日志
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'whitelist.remove',
                  { player: targetPlayer },
                  'failure',
                  (error as Error).message,
                  { userId: session?.userId }
                );
              }
              
              return `❌ 从白名单移除失败: ${(error as Error).message}`;
            }
          } else {
            return `服务器 ${server.name} 的白名单功能需要服务器连接\n` +
                   `提示: 请确保服务器已通过 WebSocket 连接`;
          }
        } catch (error) {
          logger.error('Failed to remove from whitelist:', error);
          return '从白名单移除失败';
        }
      });
    
    // ========================================================================
    // 玩家管理命令
    // ========================================================================
    
    // Player management - Level 2 (受信任用户)
    ctx.command('mochi.player', '玩家管理')
      .userFields(['authority']);
    
    // List players - Level 1 (所有用户可查看)
    ctx.command('mochi.player.list [serverId]', '查看在线玩家')
      .userFields(['authority'])
      .action(async ({ session }, serverId) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        const targetServerId = await getServerId(session, serverId);
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          if (server.status !== 'online') {
            return `服务器 ${server.name} 当前离线`;
          }
          
          // 调用实际的玩家服务
          if (serviceManager?.player) {
            try {
              const players = await serviceManager.player.getOnlinePlayers(targetServerId);
              
              if (!players || players.length === 0) {
                return `服务器 ${server.name} 当前无在线玩家`;
              }
              
              return `服务器 ${server.name} 在线玩家 (${players.length} 人)：\n` +
                     players.map((player: any, index: number) => 
                       `  [${index + 1}] ${player.name}` +
                       (player.health !== undefined ? ` - 生命: ${player.health}/20` : '') +
                       (player.level !== undefined ? ` - 等级: ${player.level}` : '') +
                       (player.gameMode ? ` - ${player.gameMode}` : '')
                     ).join('\n');
            } catch (error) {
              logger.error('Failed to get players:', error);
              return `获取在线玩家失败: ${(error as Error).message}`;
            }
          } else {
            return `服务器 ${server.name} 的玩家查询功能需要服务器连接`;
          }
        } catch (error) {
          logger.error('Failed to get players:', error);
          return '获取在线玩家失败';
        }
      });
    
    // Player info - Level 1 (所有用户可查看)
    ctx.command('mochi.player.info [serverId] <player:text>', '查看玩家信息')
      .userFields(['authority'])
      .action(async ({ session }, serverIdOrPlayer, player) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        let targetServerId: string | null;
        let targetPlayer: string;
        
        if (!player) {
          // 只有一个参数，从群组绑定获取serverId
          targetServerId = await getServerId(session);
          targetPlayer = serverIdOrPlayer;
        } else {
          // 有两个参数
          targetServerId = await getServerId(session, serverIdOrPlayer);
          targetPlayer = player;
        }
        
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.player.info [serverId] <player>';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          // 调用实际的玩家服务
          if (serviceManager?.player) {
            try {
              const playerInfo = await serviceManager.player.getPlayerInfo(targetServerId, targetPlayer);
              
              if (!playerInfo) {
                return `未找到玩家 ${targetPlayer} 在服务器 ${server.name}`;
              }
              
              return `玩家信息 - ${server.name}\n` +
                     `━━━━━━━━━━━━━━━━━━━━\n` +
                     `名称: ${playerInfo.name}\n` +
                     `显示名: ${playerInfo.displayName || playerInfo.name}\n` +
                     `UUID: ${playerInfo.id}\n` +
                     `世界: ${playerInfo.world || '未知'}\n` +
                     `位置: ${playerInfo.position ? `X:${Math.floor(playerInfo.position.x)} Y:${Math.floor(playerInfo.position.y)} Z:${Math.floor(playerInfo.position.z)}` : '未知'}\n` +
                     `延迟: ${playerInfo.ping !== undefined ? `${playerInfo.ping}ms` : '未知'}\n` +
                     `生命值: ${playerInfo.health !== undefined ? `${playerInfo.health}/20` : '未知'}\n` +
                     `等级: ${playerInfo.level !== undefined ? playerInfo.level : '未知'}\n` +
                     `游戏模式: ${playerInfo.gameMode || '未知'}\n` +
                     `OP: ${playerInfo.isOp ? '是' : '否'}\n` +
                     `在线: ${playerInfo.isOnline ? '是' : '否'}\n` +
                     `━━━━━━━━━━━━━━━━━━━━`;
            } catch (error) {
              logger.error('Failed to get player info:', error);
              return `获取玩家信息失败: ${(error as Error).message}`;
            }
          } else {
            return `服务器 ${server.name} 的玩家查询功能需要服务器连接`;
          }
        } catch (error) {
          logger.error('Failed to get player info:', error);
          return '获取玩家信息失败';
        }
      });
    
    // Kick player - Level 3 (管理员)
    ctx.command('mochi.player.kick [serverId] <player:text> [reason:text]', '踢出玩家')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .action(async ({ session }, serverIdOrPlayer, playerOrReason, reason) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        let targetServerId: string | null;
        let targetPlayer: string;
        let kickReason: string | undefined;
        
        if (!playerOrReason) {
          // 只有一个参数
          targetServerId = await getServerId(session);
          targetPlayer = serverIdOrPlayer;
          kickReason = undefined;
        } else if (!reason) {
          // 两个参数，可能是 serverId+player 或 player+reason
          // 尝试从绑定获取serverId
          const boundServerId = await getServerId(session);
          if (boundServerId) {
            // 有绑定，第一个参数是player，第二个是reason
            targetServerId = boundServerId;
            targetPlayer = serverIdOrPlayer;
            kickReason = playerOrReason;
          } else {
            // 无绑定，第一个可能是serverId，第二个是player
            targetServerId = await getServerId(session, serverIdOrPlayer);
            targetPlayer = playerOrReason;
            kickReason = undefined;
          }
        } else {
          // 三个参数
          targetServerId = await getServerId(session, serverIdOrPlayer);
          targetPlayer = playerOrReason;
          kickReason = reason;
        }
        
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.player.kick [serverId] <player> [reason]\n' +
                 '      mochi.player.kick [serverId] "Player Name" "Kick Reason"  (包含空格时使用引号)';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          if (server.status !== 'online') {
            return `服务器 ${server.name} 当前离线`;
          }
          
          // 调用 PlayerActionService 踢出玩家
          if (!serviceManager?.playerAction) {
            return '玩家操作服务未初始化';
          }
          
          const result = await serviceManager.playerAction.kickPlayer(
            targetServerId,
            {
              playerId: targetPlayer,
              playerName: targetPlayer,
              reason: kickReason || '被管理员踢出',
              executor: session?.userId
            }
          );
          
          if (result.success) {
            return `✅ 已踢出玩家 ${targetPlayer} 从服务器 ${server.name}\n` +
                   `原因: ${kickReason || '被管理员踢出'}`;
          } else {
            return `❌ 踢出玩家失败: ${result.error || '未知错误'}`;
          }
        } catch (error) {
          logger.error('Failed to kick player:', error);
          return `❌ 踢出玩家失败: ${error instanceof Error ? error.message : '未知错误'}`;
        }
      });
    
    // ========================================================================
    // 命令执行
    // ========================================================================
    
    // Execute command - Level 4 (超级管理员)
    ctx.command('mochi.exec [serverId] <command...>', '执行服务器命令')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 4) {
          return '权限不足：需要超级管理员权限（等级 4）';
        }
      })
      .option('as', '-a <executor:string> 执行者身份 (console/player，默认console)', { fallback: 'console' })
      .action(async ({ session, options }, serverIdOrCommand, ...commandParts) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        let targetServerId: string | null;
        let command: string;
        
        // 判断第一个参数是serverId还是command
        if (commandParts.length === 0) {
          // 只有一个参数，从群组绑定获取serverId
          targetServerId = await getServerId(session);
          command = serverIdOrCommand || '';
        } else {
          // 有多个参数，第一个可能是serverId
          targetServerId = await getServerId(session, serverIdOrCommand);
          command = commandParts.join(' ');
        }
        
        if (!targetServerId || !command) {
          return '用法: mochi.exec [serverId] <command...> [-a executor]\n' +
                 '示例: mochi.exec survival say Hello -a console\n' +
                 '或在群组绑定后: mochi.exec say Hello -a console';
        }
        
        if (!options) {
          return '选项参数错误';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          if (server.status !== 'online') {
            return `服务器 ${server.name} 当前离线`;
          }
          
          // 调用实际的命令执行服务
          if (serviceManager?.command) {
            try {
              const result = await serviceManager.command.executeCommand(
                targetServerId,
                command,
                session?.userId || 'system',
                {
                  timeout: 30000,
                  requirePermission: false  // 已经在命令层检查过权限
                }
              );
              
              // 记录审计日志使用服务
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'command.execute',
                  { command, executor: options.as },
                  'success',
                  undefined,
                  { userId: session?.userId }
                );
              }
              
              let response = `已在服务器 ${server.name} 执行命令: ${command}\n`;
              response += `执行者: ${options.as}\n`;
              response += `状态: ${result.success ? '成功' : '失败'}\n`;
              
              if (result.output) {
                response += `输出:\n${result.output}`;
              }
              
              if (result.error) {
                response += `\n错误: ${result.error}`;
              }
              
              return response;
            } catch (error) {
              logger.error('Failed to execute command:', error);
              
              // 记录失败的审计日志使用服务
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'command.execute',
                  { command, executor: options.as },
                  'failure',
                  (error as Error).message,
                  { userId: session?.userId }
                );
              }
              
              return `执行命令失败: ${(error as Error).message}`;
            }
          } else {
            return `服务器 ${server.name} 的命令执行功能需要服务器连接`;
          }
        } catch (error) {
          logger.error('Failed to execute command:', error);
          return '执行命令失败';
        }
      });
    
    // ========================================================================
    // 事件订阅管理命令
    // ========================================================================
    
    // Event subscription management - Level 2 (受信任用户)
    ctx.command('mochi.event', '事件订阅管理')
      .userFields(['authority']);
    
    // List available event types - Level 1 (所有用户可查看)
    ctx.command('mochi.event.types', '查看可用事件类型')
      .userFields(['authority'])
      .action(async () => {
        if (!isInitialized) {
          return '插件尚未初始化完成';
        }
        
        try {
          const { SubscriptionHandler } = await import('./services/subscription-handler');
          
          const basicEvents = SubscriptionHandler.getBasicEventTypes();
          const extendedEvents = SubscriptionHandler.getExtendedEventTypes();
          
          return `📋 可用事件类型：\n\n` +
                 `✅ 基础事件（默认订阅）：\n` +
                 basicEvents.map(e => `  • ${e}`).join('\n') +
                 `\n\n⚡ 扩展事件（按需订阅）：\n` +
                 extendedEvents.map(e => `  • ${e}`).join('\n') +
                 `\n\n💡 提示：\n` +
                 `  • 基础事件会在服务器连接时自动订阅\n` +
                 `  • 扩展事件需要手动订阅，可能增加服务器负担\n` +
                 `  • 使用 mochi.event.subscribe 订阅特定事件`;
        } catch (error) {
          logger.error('Failed to get event types:', error);
          return '获取事件类型失败';
        }
      });
    
    // List subscriptions - Level 1 (所有用户可查看)
    ctx.command('mochi.event.list [serverId]', '查看事件订阅')
      .userFields(['authority'])
      .action(async ({ session }, serverId) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        const targetServerId = await getServerId(session, serverId);
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.event.list [serverId]';
        }
        
        try {
          const server = await dbManager?.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          // 获取该服务器的所有订阅
          const subscriptions = await serviceManager.event.getSubscriptionsForConnection(targetServerId);
          
          if (subscriptions.length === 0) {
            return `服务器 ${server.name} 当前无事件订阅\n` +
                   `提示：服务器连接时会自动订阅基础事件`;
          }
          
          let result = `服务器 ${server.name} 的事件订阅：\n\n`;
          for (const sub of subscriptions) {
            const eventTypes = sub.filter.eventTypes || ['所有事件'];
            result += `📌 订阅 ID: ${sub.id}\n`;
            result += `  状态: ${sub.isActive ? '✅ 活跃' : '❌ 已停用'}\n`;
            result += `  事件类型: ${eventTypes.join(', ')}\n`;
            result += `  创建时间: ${sub.createdAt.toLocaleString()}\n`;
            result += `  最后活动: ${sub.lastActivity.toLocaleString()}\n\n`;
          }
          
          return result;
        } catch (error) {
          logger.error('Failed to list subscriptions:', error);
          return '获取订阅列表失败';
        }
      });
    
    // Subscribe to events - Level 2 (受信任用户)
    ctx.command('mochi.event.subscribe [serverId] <events...>', '订阅事件')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 2) {
          return '权限不足：需要受信任用户权限（等级 2）';
        }
      })
      .option('default', '-d 使用默认基础事件', { fallback: false })
      .action(async ({ session, options }, serverIdOrEvent, ...events) => {
        if (!isInitialized || !serviceManager || !wsManager) {
          return '插件尚未初始化完成';
        }
        
        if (!options) {
          return '选项参数错误';
        }
        
        let targetServerId: string | null;
        let eventTypes: string[];
        
        // 解析参数
        if (events.length === 0 && !options.default) {
          // 只有一个参数，从群组绑定获取serverId
          targetServerId = await getServerId(session);
          eventTypes = [serverIdOrEvent];
        } else if (options.default) {
          // 使用默认事件
          targetServerId = await getServerId(session, serverIdOrEvent);
          const { SubscriptionHandler } = await import('./services/subscription-handler');
          eventTypes = SubscriptionHandler.getBasicEventTypes();
        } else {
          // 多个参数
          targetServerId = await getServerId(session, serverIdOrEvent);
          eventTypes = events;
        }
        
        if (!targetServerId) {
          return '请指定服务器 ID 或在群组中绑定服务器\n' +
                 '用法: mochi.event.subscribe [serverId] <events...> [-d]\n' +
                 '示例: mochi.event.subscribe survival player.join player.leave\n' +
                 '或使用默认: mochi.event.subscribe survival -d';
        }
        
        try {
          const server = await dbManager?.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          if (server.status !== 'online') {
            return `服务器 ${server.name} 当前离线，无法订阅事件`;
          }
          
          // 获取服务器连接
          const connection = wsManager.getConnection(targetServerId);
          if (!connection) {
            return `服务器 ${server.name} 未建立 WebSocket 连接`;
          }
          
          // 创建订阅
          const subscription = await serviceManager.event.subscribe(connection, {
            serverId: targetServerId,
            eventTypes: eventTypes as any[]
          });
          
          // 记录审计日志
          if (serviceManager.audit) {
            await serviceManager.audit.logger.logServerOperation(
              targetServerId,
              'event.subscribe',
              { eventTypes, subscriptionId: subscription.id },
              'success',
              undefined,
              { userId: session?.userId }
            );
          }
          
          return `✅ 事件订阅成功\n\n` +
                 `📋 订阅信息：\n` +
                 `  服务器: ${server.name}\n` +
                 `  订阅 ID: ${subscription.id}\n` +
                 `  事件类型: ${eventTypes.join(', ')}\n\n` +
                 `💡 提示：\n` +
                 `  • 使用 mochi.event.list 查看所有订阅\n` +
                 `  • 使用 mochi.event.unsubscribe 取消订阅`;
        } catch (error) {
          logger.error('Failed to subscribe to events:', error);
          return `订阅事件失败: ${(error as Error).message}`;
        }
      });
    
    // Unsubscribe from events - Level 2 (受信任用户)
    ctx.command('mochi.event.unsubscribe <subscriptionId>', '取消事件订阅')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 2) {
          return '权限不足：需要受信任用户权限（等级 2）';
        }
      })
      .action(async ({ session }, subscriptionId) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        if (!subscriptionId) {
          return '用法: mochi.event.unsubscribe <subscriptionId>\n' +
                 '提示: 使用 mochi.event.list 查看订阅 ID';
        }
        
        try {
          // 获取订阅信息
          const subscription = await serviceManager.event.getSubscription(subscriptionId);
          if (!subscription) {
            return `订阅 ${subscriptionId} 不存在`;
          }
          
          // 取消订阅
          await serviceManager.event.unsubscribe(subscriptionId);
          
          // 记录审计日志
          if (serviceManager.audit) {
            await serviceManager.audit.logger.logServerOperation(
              subscription.serverId || subscription.connectionId,
              'event.unsubscribe',
              { subscriptionId },
              'success',
              undefined,
              { userId: session?.userId }
            );
          }
          
          return `✅ 已取消订阅 ${subscriptionId}`;
        } catch (error) {
          logger.error('Failed to unsubscribe:', error);
          return `取消订阅失败: ${(error as Error).message}`;
        }
      });
    
    // Get event statistics - Level 1 (所有用户可查看)
    ctx.command('mochi.event.stats [serverId]', '查看事件统计')
      .userFields(['authority'])
      .action(async ({ session }, serverId) => {
        if (!isInitialized || !serviceManager) {
          return '插件尚未初始化完成';
        }
        
        const targetServerId = serverId ? await getServerId(session, serverId) : undefined;
        
        try {
          const stats = await serviceManager.event.getEventStatistics(targetServerId || undefined);
          const metrics = serviceManager.event.getMetrics();
          
          let result = `📊 事件统计信息\n\n`;
          
          if (targetServerId) {
            const server = await dbManager?.getServer(targetServerId);
            result += `服务器: ${server?.name || targetServerId}\n\n`;
          } else {
            result += `全局统计\n\n`;
          }
          
          result += `📈 总体数据：\n`;
          result += `  总事件数: ${stats.totalEvents}\n`;
          result += `  平均事件/分钟: ${stats.averageEventsPerMinute.toFixed(2)}\n`;
          result += `  活跃订阅数: ${metrics.subscriptions}\n`;
          result += `  活跃连接数: ${metrics.activeConnections}\n`;
          result += `  平均延迟: ${metrics.averageLatency.toFixed(2)}ms\n\n`;
          
          if (stats.topEventTypes.length > 0) {
            result += `🔥 热门事件类型：\n`;
            stats.topEventTypes.slice(0, 5).forEach((item, index) => {
              result += `  ${index + 1}. ${item.type}: ${item.count} 次\n`;
            });
          }
          
          return result;
        } catch (error) {
          logger.error('Failed to get event statistics:', error);
          return '获取事件统计失败';
        }
      });
    
    // ========================================================================
    // 群组绑定管理
    // ========================================================================
    
    // Channel binding - Level 2 (受信任用户)
    ctx.command('mochi.bind', '频道绑定管理')
      .userFields(['authority']);
    
    // Add binding - Level 3 (管理员)
    ctx.command('mochi.bind.add <serverId>', '绑定服务器到当前群组')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .option('type', '-t <type:string> 绑定类型 (full/chat/event，默认full)', { fallback: 'full' })
      .action(async ({ session, options }, serverId) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!session?.guildId) {
          return '此命令只能在群组中使用';
        }
        
        if (!serverId) {
          return '用法: mochi.bind.add <serverId> [-t type]\n' +
                 '示例: mochi.bind.add survival -t full\n\n' +
                 '提示: 一个群组只能绑定一个服务器';
        }
        
        if (!options) {
          return '选项参数错误';
        }
        
        try {
          // 验证服务器存在
          const server = await dbManager.getServer(serverId);
          if (!server) {
            return `服务器 ${serverId} 不存在\n使用 mochi.server.list 查看可用服务器`;
          }
          
          // 检查群组是否已有绑定
          const existingBindings = await dbManager.getGroupBindings(session.guildId);
          if (existingBindings.length > 0) {
            const existingBinding = existingBindings[0];
            const existingServer = await dbManager.getServer(existingBinding.server_id);
            const existingServerName = existingServer ? existingServer.name : existingBinding.server_id;
            
            return `❌ 当前群组已绑定服务器: ${existingServerName} (${existingBinding.server_id})\n` +
                   `绑定 ID: ${existingBinding.id}\n\n` +
                   `💡 一个群组只能绑定一个服务器\n` +
                   `如需更换，请先使用以下命令解除绑定：\n` +
                   `mochi.bind.remove ${existingBinding.id}`;
          }
          
          // 使用 BindingManager 创建绑定
          if (serviceManager?.binding) {
            try {
              const binding = await serviceManager.binding.createBinding(
                session.userId || 'unknown',
                {
                  groupId: session.guildId,
                  serverId: serverId,
                  bindingType: (options.type || 'full') as any,
                  config: {}
                }
              );
              
              return `✅ 已将服务器 ${server.name} 绑定到当前群组\n` +
                     `📋 绑定类型: ${options.type}\n` +
                     `🆔 绑定 ID: ${binding.id}\n\n` +
                     `💡 提示: 现在可以在群组中直接使用命令，无需指定服务器 ID\n` +
                     `例如: 在线、添加白名单 <玩家名>`;
            } catch (error) {
              logger.error('Failed to create binding:', error);
              const errorMsg = (error as Error).message;
              
              // 处理已绑定的错误
              if (errorMsg.includes('already bound')) {
                return `❌ ${errorMsg}`;
              }
              
              return `创建绑定失败: ${errorMsg}`;
            }
          } else {
            // 降级到直接数据库操作（保持向后兼容）
            const binding = await dbManager.createGroupBinding({
              group_id: session.guildId,
              server_id: serverId,
              binding_type: (options.type || 'full') as 'full' | 'monitor' | 'command',
              config: JSON.stringify({}),
              created_by: session.userId || 'unknown',
              status: 'active'
            });
            
            // 记录审计日志
            if (serviceManager?.audit) {
              await serviceManager.audit.logger.logServerOperation(
                serverId,
                'binding.create',
                { 
                  groupId: session.guildId, 
                  bindingType: options.type 
                },
                'success',
                undefined,
                { userId: session.userId }
              );
            }
            
            return `✅ 已将服务器 ${server.name} 绑定到当前群组\n` +
                   `📋 绑定类型: ${options.type}\n` +
                   `🆔 绑定 ID: ${binding.id}\n\n` +
                   `💡 提示: 现在可以在群组中直接使用命令，无需指定服务器 ID`;
          }
        } catch (error) {
          logger.error('Failed to create binding:', error);
          return `创建绑定失败: ${(error as Error).message}`;
        }
      });
    
    // List bindings - Level 1 (所有用户可查看)
    ctx.command('mochi.bind.list', '查看当前群组绑定的服务器')
      .alias('mochi.bind.info')
      .userFields(['authority'])
      .action(async ({ session }) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!session?.guildId) {
          return '此命令只能在群组中使用';
        }
        
        try {
          const bindings = await dbManager.getGroupBindings(session.guildId);
          
          if (bindings.length === 0) {
            return '📭 当前群组暂未绑定服务器\n\n' +
                   '💡 使用以下命令绑定服务器：\n' +
                   'mochi.bind.add <服务器ID>\n\n' +
                   '查看可用服务器：mochi.server.list';
          }
          
          // 一个群组只应该有一个绑定
          const binding = bindings[0];
          const server = await dbManager.getServer(binding.server_id);
          
          if (!server) {
            return `⚠️ 绑定的服务器 ${binding.server_id} 不存在\n` +
                   `建议使用以下命令解除绑定：\n` +
                   `mochi.bind.remove ${binding.id}`;
          }
          
          let result = '📋 当前群组绑定信息：\n\n';
          result += `🎮 服务器: ${server.name}\n`;
          result += `🆔 服务器 ID: ${server.id}\n`;
          result += `📊 状态: ${server.status === 'online' ? '🟢 在线' : '🔴 离线'}\n`;
          result += `🔗 绑定类型: ${binding.binding_type}\n`;
          result += `🆔 绑定 ID: ${binding.id}\n`;
          result += `📅 绑定时间: ${binding.created_at.toLocaleString()}\n\n`;
          result += `💡 提示: 可以直接使用命令，无需指定服务器 ID\n`;
          result += `例如: 在线、添加白名单 <玩家名>`;
          
          // 如果有多个绑定（不应该发生，但作为安全检查）
          if (bindings.length > 1) {
            result += `\n\n⚠️ 警告: 检测到多个绑定（不推荐）\n`;
            result += `建议保留一个，删除其他绑定`;
          }
          
          return result;
        } catch (error) {
          logger.error('Failed to list bindings:', error);
          return '获取绑定信息失败';
        }
      });
    
    // Remove binding - Level 3 (管理员)
    ctx.command('mochi.bind.remove <bindingId:number>', '解除服务器绑定')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 3) {
          return '权限不足：需要管理员权限（等级 3）';
        }
      })
      .action(async ({ session }, bindingId) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!session?.guildId) {
          return '此命令只能在群组中使用';
        }
        
        if (!bindingId) {
          return '用法: mochi.bind.remove <bindingId>\n\n' +
                 '💡 使用 mochi.bind.list 查看绑定 ID';
        }
        
        try {
          // 使用 BindingManager 删除绑定
          if (serviceManager?.binding) {
            try {
              // 先获取绑定信息用于显示
              const binding = await serviceManager.binding.getBinding(bindingId);
              if (!binding) {
                return `❌ 绑定 ${bindingId} 不存在`;
              }
              
              // 检查是否属于当前群组
              if (binding.groupId !== session.guildId) {
                return `❌ 绑定 ${bindingId} 不属于当前群组`;
              }
              
              const server = await dbManager.getServer(binding.serverId);
              const serverName = server ? server.name : binding.serverId;
              
              await serviceManager.binding.deleteBinding(session.userId || 'unknown', bindingId);
              
              return `✅ 已解除与服务器 ${serverName} 的绑定\n\n` +
                     `💡 如需绑定其他服务器，使用：\n` +
                     `mochi.bind.add <服务器ID>`;
            } catch (error) {
              logger.error('Failed to remove binding:', error);
              return `解除绑定失败: ${(error as Error).message}`;
            }
          } else {
            // 降级到直接数据库操作
            const bindings = await dbManager.getGroupBindings(session.guildId);
            const binding = bindings.find((b: any) => b.id === bindingId);
            
            if (!binding) {
              return `❌ 绑定 ${bindingId} 不存在或不属于当前群组\n\n` +
                     `💡 使用 mochi.bind.list 查看当前绑定`;
            }
            
            const server = await dbManager.getServer(binding.server_id);
            const serverName = server ? server.name : binding.server_id;
            
            await dbManager.deleteGroupBinding(bindingId);
            
            // 记录审计日志
            if (serviceManager?.audit) {
              await serviceManager.audit.logger.logServerOperation(
                binding.server_id,
                'binding.delete',
                { 
                  groupId: session.guildId,
                  bindingId 
                },
                'success',
                undefined,
                { userId: session.userId }
              );
            }
            
            return `✅ 已解除与服务器 ${serverName} 的绑定\n\n` +
                   `💡 如需绑定其他服务器，使用：\n` +
                   `mochi.bind.add <服务器ID>`;
          }
        } catch (error) {
          logger.error('Failed to remove binding:', error);
          return `解除绑定失败: ${(error as Error).message}`;
        }
      });
    
    // ========================================================================
    // 简化指令 - 快捷操作
    // ========================================================================
    
    // 添加白名单 - 简化指令 - Level 2 (受信任用户)
    ctx.command('添加白名单 <player:text>', '快速添加白名单')
      .alias('白名单添加')
      .alias('wl')
      .userFields(['authority'])
      .before(({ session }) => {
        if ((session?.user?.authority ?? 0) < 2) {
          return '权限不足：需要受信任用户权限（等级 2）';
        }
      })
      .action(async ({ session }, player) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        if (!player) {
          return '用法: 添加白名单 <玩家名>\n' +
                 '示例: 添加白名单 Steve\n' +
                 '      添加白名单 "Player Name"  (玩家名包含空格时使用引号)';
        }
        
        // 从群组绑定获取服务器
        const targetServerId = await getServerId(session);
        if (!targetServerId) {
          return '请先在群组中绑定服务器\n' +
                 '用法: mochi.bind.add <serverId>';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          // 调用白名单服务
          if (serviceManager?.whitelist) {
            try {
              await serviceManager.whitelist.addToWhitelist(
                targetServerId, 
                player,
                player,
                session?.userId || 'system'
              );
              
              // 记录审计日志
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'whitelist.add',
                  { player: player },
                  'success',
                  undefined,
                  { userId: session?.userId }
                );
              }
              
              return `✅ 已将 ${player} 添加到服务器 ${server.name} 的白名单`;
            } catch (error) {
              logger.error('Failed to add to whitelist:', error);
              
              // 记录失败的审计日志
              if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(
                  targetServerId,
                  'whitelist.add',
                  { player: player },
                  'failure',
                  (error as Error).message,
                  { userId: session?.userId }
                );
              }
              
              return `❌ 添加到白名单失败: ${(error as Error).message}`;
            }
          } else {
            return `服务器 ${server.name} 的白名单功能需要服务器连接\n` +
                   `提示: 请确保服务器已通过 WebSocket 连接`;
          }
        } catch (error) {
          logger.error('Failed to add to whitelist:', error);
          return '添加到白名单失败';
        }
      });
    
    // 在线玩家 - 简化指令 - Level 1 (所有用户可查看)
    ctx.command('在线', '查看在线玩家和服务器状态')
      .alias('online')
      .alias('玩家')
      .userFields(['authority'])
      .action(async ({ session }) => {
        if (!isInitialized || !dbManager) {
          return '插件尚未初始化完成';
        }
        
        // 从群组绑定获取服务器
        const targetServerId = await getServerId(session);
        if (!targetServerId) {
          return '请先在群组中绑定服务器\n' +
                 '用法: mochi.bind.add <serverId>';
        }
        
        try {
          const server = await dbManager.getServer(targetServerId);
          if (!server) {
            return `服务器 ${targetServerId} 不存在`;
          }
          
          if (server.status !== 'online') {
            return `❌ 服务器 ${server.name} 当前离线`;
          }
          
          // 获取在线玩家
          if (serviceManager?.player) {
            try {
              const players = await serviceManager.player.getOnlinePlayers(targetServerId);
              
              // 获取服务器状态（通过 bridge）
              const bridge = serviceManager.server.getBridge(targetServerId);
              let serverInfo = null;
              if (bridge) {
                try {
                  serverInfo = await bridge.getServerInfo();
                } catch (error) {
                  logger.debug('Failed to get server info:', error);
                }
              }
              
              // 构建响应消息
              let response = `📊 服务器状态 - ${server.name}\n`;
              response += `━━━━━━━━━━━━━━━━━━━━\n`;
              
              // 服务器基本信息
              if (serverInfo) {
                response += `🎮 版本: ${serverInfo.version || server.core_version || '未知'}\n`;
                response += `⚙️ 核心: ${serverInfo.coreName || server.core_name}\n`;
                response += `📈 TPS: ${serverInfo.tps !== undefined ? serverInfo.tps.toFixed(1) : '未知'}\n`;
                
                if (serverInfo.memoryUsage) {
                  const memUsed = (serverInfo.memoryUsage.used / 1024 / 1024).toFixed(0);
                  const memMax = (serverInfo.memoryUsage.max / 1024 / 1024).toFixed(0);
                  const memPercent = serverInfo.memoryUsage.percentage?.toFixed(1) || 
                                    ((serverInfo.memoryUsage.used / serverInfo.memoryUsage.max) * 100).toFixed(1);
                  response += `💾 内存: ${memUsed}MB / ${memMax}MB (${memPercent}%)\n`;
                }
                
                if (serverInfo.uptime !== undefined) {
                  const hours = Math.floor(serverInfo.uptime / 3600);
                  const minutes = Math.floor((serverInfo.uptime % 3600) / 60);
                  response += `⏱️ 运行时间: ${hours}小时${minutes}分钟\n`;
                }
              }
              
              response += `━━━━━━━━━━━━━━━━━━━━\n`;
              
              // 在线玩家信息
              if (!players || players.length === 0) {
                response += `👥 在线玩家: 0 人\n`;
                response += `\n当前无玩家在线`;
              } else {
                const maxPlayers = serverInfo?.maxPlayers || '?';
                response += `👥 在线玩家: ${players.length} / ${maxPlayers}\n`;
                response += `━━━━━━━━━━━━━━━━━━━━\n`;
                
                players.forEach((player: any, index: number) => {
                  response += `${index + 1}. ${player.name}`;
                  
                  // 添加额外信息（如果有）
                  const details: string[] = [];
                  if (player.ping !== undefined) {
                    details.push(`${player.ping}ms`);
                  }
                  if (player.world) {
                    details.push(player.world);
                  }
                  if (player.gameMode) {
                    details.push(player.gameMode);
                  }
                  
                  if (details.length > 0) {
                    response += ` (${details.join(', ')})`;
                  }
                  
                  response += '\n';
                });
              }
              
              return response;
            } catch (error) {
              logger.error('Failed to get players:', error);
              return `❌ 获取在线玩家失败: ${(error as Error).message}`;
            }
          } else {
            return `服务器 ${server.name} 的玩家查询功能需要服务器连接`;
          }
        } catch (error) {
          logger.error('Failed to get online players:', error);
          return '获取在线玩家失败';
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
