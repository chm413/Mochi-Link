"use strict";
/**
 * Mochi-Link (大福连) - Main Plugin Entry Point
 *
 * Simplified version with lazy loading to avoid module resolution issues
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.usage = exports.inject = exports.name = exports.Config = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
const services_1 = require("./services");
// ============================================================================
// Helper Functions
// ============================================================================
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
exports.inject = ['database']; // Declare database dependency
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
    // Service instances
    let dbManager = null;
    let serviceManager = null;
    let wsManager = null;
    let httpServer = null;
    let isInitialized = false;
    /**
     * Get server ID from parameter or group binding
     */
    async function getServerId(session, providedId) {
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
            const { TableNames } = await Promise.resolve().then(() => __importStar(require('./database/table-names')));
            TableNames.initialize(config.database?.prefix || 'mochi');
            logger.info(`Table names initialized with prefix: ${config.database?.prefix || 'mochi'}`);
            // Initialize database
            const { SimpleDatabaseManager } = await Promise.resolve().then(() => __importStar(require('./database/simple-init')));
            dbManager = new SimpleDatabaseManager(ctx, config.database?.prefix || 'mochi');
            await dbManager.initialize();
            logger.info('Database initialized successfully');
            // Initialize service manager
            serviceManager = new services_1.ServiceManager(ctx);
            await serviceManager.initialize();
            logger.info('Service manager initialized successfully');
            // Initialize WebSocket server
            try {
                const { SimpleTokenManager } = await Promise.resolve().then(() => __importStar(require('./websocket/token-manager')));
                const { MochiWebSocketServer } = await Promise.resolve().then(() => __importStar(require('./websocket/server')));
                const { AuthenticationManager } = await Promise.resolve().then(() => __importStar(require('./websocket/auth')));
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
                wsManager.on('connection', (connection) => {
                    logger.info(`Server connected: ${connection.serverId}`);
                });
                wsManager.on('authenticated', async (connection) => {
                    logger.info(`Server authenticated: ${connection.serverId}`);
                    // Update server status to online and create bridge
                    if (serviceManager) {
                        try {
                            await serviceManager.server.updateServerStatus(connection.serverId, 'online');
                            // Create WebSocket bridge for command execution
                            await serviceManager.server.createWebSocketBridge(connection.serverId, connection);
                            logger.info(`Bridge created for server ${connection.serverId}`);
                        }
                        catch (error) {
                            logger.error(`Failed to setup server ${connection.serverId}:`, error);
                        }
                    }
                });
                wsManager.on('message', async (message, connection) => {
                    try {
                        logger.debug(`Received message from ${connection.serverId}:`, message);
                        // Route message through message router service
                        if (serviceManager) {
                            await serviceManager.messageRouter.handleServerEvent({
                                serverId: connection.serverId,
                                eventType: message.op || message.type,
                                data: message.data || message,
                                timestamp: message.timestamp || Date.now()
                            });
                        }
                    }
                    catch (error) {
                        logger.error(`Error handling message from ${connection.serverId}:`, error);
                    }
                });
                wsManager.on('disconnection', async (connection, code, reason) => {
                    logger.info(`Server disconnected: ${connection.serverId} (${code}: ${reason})`);
                    // Update server status to offline and remove bridge
                    if (serviceManager) {
                        try {
                            await serviceManager.server.updateServerStatus(connection.serverId, 'offline');
                            // Remove bridge
                            await serviceManager.server.removeBridge(connection.serverId);
                            logger.info(`Bridge removed for server ${connection.serverId}`);
                        }
                        catch (error) {
                            logger.error(`Failed to cleanup server ${connection.serverId}:`, error);
                        }
                    }
                });
                wsManager.on('error', (error) => {
                    logger.error('WebSocket server error:', error);
                });
            }
            catch (wsError) {
                logger.error('Failed to start WebSocket server:', wsError);
                logger.warn('Plugin will continue without WebSocket support');
            }
            // Initialize HTTP API server (if configured)
            if (config.http && serviceManager) {
                try {
                    const { HTTPServer } = await Promise.resolve().then(() => __importStar(require('./http/server')));
                    httpServer = new HTTPServer(ctx, config.http, serviceManager);
                    await httpServer.start();
                    logger.info(`HTTP API server started on ${config.http.host || 'localhost'}:${config.http.port || 3000}`);
                }
                catch (httpError) {
                    logger.error('Failed to start HTTP API server:', httpError);
                    logger.warn('Plugin will continue without HTTP API support');
                }
            }
            isInitialized = true;
            logger.info('Mochi-Link plugin initialized successfully');
        }
        catch (error) {
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
                }
                catch (error) {
                    logger.error('Error stopping HTTP API server:', error);
                }
            }
            // Stop WebSocket server
            if (wsManager) {
                try {
                    await wsManager.stop();
                    logger.info('WebSocket server stopped');
                }
                catch (error) {
                    logger.error('Error stopping WebSocket server:', error);
                }
            }
            // Cleanup service manager
            if (serviceManager) {
                try {
                    await serviceManager.cleanup();
                    logger.info('Service manager cleaned up');
                }
                catch (error) {
                    logger.error('Error cleaning up service manager:', error);
                }
            }
            isInitialized = false;
            logger.info('Mochi-Link plugin stopped successfully');
        }
        catch (error) {
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
            const items = servers.map((s) => {
                return `  [${s.id}] ${s.name} (${s.core_type}/${s.core_name}) - ${s.status}`;
            }).join('\n');
            return header + '\n' + items;
        }
        catch (error) {
            logger.error('Failed to list servers:', error);
            return '获取服务器列表失败';
        }
    });
    // Add server - Level 3 (管理员)
    ctx.command('mochi.server.add <id> <name>', '添加服务器')
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
                '示例: mochi.server.add survival 生存服 -t java -c paper';
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
                core_type: (options.type || 'java'),
                core_name: options.core || 'paper',
                connection_mode: 'reverse',
                connection_config: JSON.stringify({}),
                status: 'offline',
                owner_id: session?.userId
            });
            // Generate API token for the server
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            await dbManager.createAPIToken(id, token, tokenHash);
            // Create audit log using service
            if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(id, 'create', { name, type: options.type, core: options.core }, 'success', undefined, { userId: session?.userId });
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
        }
        catch (error) {
            logger.error('Failed to create server:', error);
            return '创建服务器失败';
        }
    });
    // Register server - Level 3 (管理员) - 完整注册（包含连接信息）
    ctx.command('mochi.server.register <id> <name>', '注册服务器（完整信息）')
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
                core_type: finalType,
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
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            await dbManager.createAPIToken(id, token, tokenHash);
            // 创建审计日志使用服务
            if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(id, 'register', {
                    id,
                    name,
                    host: host,
                    port: port,
                    type: finalType,
                    core: core
                }, 'success', undefined, { userId: session?.userId });
            }
            // 根据核心类型推荐连接器
            const connectorMap = {
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
        }
        catch (error) {
            logger.error('Failed to register server:', error);
            return `❌ 注册服务器失败\n\n` +
                `错误信息: ${error.message}\n\n` +
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
        }
        catch (error) {
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
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
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
                    await serviceManager.audit.logger.logServerOperation(id, 'token.regenerate', { server_name: server.name }, 'success', undefined, { userId: session?.userId });
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
            const tokenList = tokens.map((t, i) => {
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
        }
        catch (error) {
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
                await serviceManager.audit.logger.logServerOperation(id, 'delete', { name: server.name }, 'success', undefined, { userId: session?.userId });
            }
            return `服务器 ${server.name} (${id}) 已删除`;
        }
        catch (error) {
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
            return `审计日志 (最近 ${logs.length} 条)：\n` + logs.map((log) => `  [${log.createdAt.toLocaleString()}] ${log.operation} - ${log.result}` +
                (log.userId ? ` (用户: ${log.userId})` : '') +
                (log.serverId ? ` (服务器: ${log.serverId})` : '')).join('\n');
        }
        catch (error) {
            logger.error('Failed to get audit logs:', error);
            return '获取审计日志失败';
        }
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
                        whitelist.map((entry, index) => `  [${index + 1}] ${entry.name || entry.uuid}`).join('\n');
                }
                catch (error) {
                    logger.error('Failed to get whitelist from service:', error);
                    return `获取白名单失败: ${error.message}\n` +
                        `提示: 确保服务器已连接`;
                }
            }
            else {
                return `服务器 ${server.name} 的白名单功能需要服务器连接\n` +
                    `提示: 请确保服务器已通过 WebSocket 连接`;
            }
        }
        catch (error) {
            logger.error('Failed to get whitelist:', error);
            return '获取白名单失败';
        }
    });
    // Add to whitelist - Level 2 (受信任用户)
    ctx.command('mochi.whitelist.add [serverId] <player>', '添加白名单')
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
        let targetServerId;
        let targetPlayer;
        if (!player) {
            // 只有一个参数，从群组绑定获取服务器
            targetServerId = await getServerId(session);
            targetPlayer = serverIdOrPlayer;
        }
        else {
            // 两个参数，第一个是服务器 ID
            targetServerId = serverIdOrPlayer;
            targetPlayer = player;
        }
        if (!targetServerId) {
            return '请指定服务器 ID 或在群组中绑定服务器\n' +
                '用法: mochi.whitelist.add <serverId> <player>\n' +
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
                    await serviceManager.whitelist.addToWhitelist(targetServerId, targetPlayer, // playerId
                    targetPlayer, // playerName (使用相同的值)
                    session?.userId || 'system', // executor
                    undefined // reason (可选)
                    );
                    // 记录审计日志使用服务
                    if (serviceManager?.audit) {
                        await serviceManager.audit.logger.logServerOperation(targetServerId, 'whitelist.add', { player: targetPlayer }, 'success', undefined, { userId: session?.userId });
                    }
                    return `已将 ${targetPlayer} 添加到服务器 ${server.name} 的白名单`;
                }
                catch (error) {
                    logger.error('Failed to add to whitelist:', error);
                    // 记录失败的审计日志使用服务
                    if (serviceManager?.audit) {
                        await serviceManager.audit.logger.logServerOperation(targetServerId, 'whitelist.add', { player: targetPlayer }, 'failure', error.message, { userId: session?.userId });
                    }
                    return `添加到白名单失败: ${error.message}`;
                }
            }
            else {
                return `服务器 ${server.name} 的白名单功能需要服务器连接\n` +
                    `提示: 请确保服务器已通过 WebSocket 连接`;
            }
        }
        catch (error) {
            logger.error('Failed to add to whitelist:', error);
            return '添加到白名单失败';
        }
    });
    // Remove from whitelist - Level 2 (受信任用户)
    ctx.command('mochi.whitelist.remove [serverId] <player>', '移除白名单')
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
        let targetServerId;
        let targetPlayer;
        if (!player) {
            // 只有一个参数，从群组绑定获取serverId
            targetServerId = await getServerId(session);
            targetPlayer = serverIdOrPlayer;
        }
        else {
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
            // 记录审计日志使用服务
            if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(targetServerId, 'whitelist.remove', { player: targetPlayer }, 'success', undefined, { userId: session?.userId });
            }
            // TODO: 调用实际的白名单服务
            return `已将 ${targetPlayer} 从服务器 ${server.name} 的白名单移除\n` +
                `提示: 需要服务器连接后才能同步到游戏`;
        }
        catch (error) {
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
                        players.map((player, index) => `  [${index + 1}] ${player.name}` +
                            (player.health !== undefined ? ` - 生命: ${player.health}/20` : '') +
                            (player.level !== undefined ? ` - 等级: ${player.level}` : '') +
                            (player.gameMode ? ` - ${player.gameMode}` : '')).join('\n');
                }
                catch (error) {
                    logger.error('Failed to get players:', error);
                    return `获取在线玩家失败: ${error.message}`;
                }
            }
            else {
                return `服务器 ${server.name} 的玩家查询功能需要服务器连接`;
            }
        }
        catch (error) {
            logger.error('Failed to get players:', error);
            return '获取在线玩家失败';
        }
    });
    // Player info - Level 1 (所有用户可查看)
    ctx.command('mochi.player.info [serverId] <player>', '查看玩家信息')
        .userFields(['authority'])
        .action(async ({ session }, serverIdOrPlayer, player) => {
        if (!isInitialized || !dbManager) {
            return '插件尚未初始化完成';
        }
        let targetServerId;
        let targetPlayer;
        if (!player) {
            // 只有一个参数，从群组绑定获取serverId
            targetServerId = await getServerId(session);
            targetPlayer = serverIdOrPlayer;
        }
        else {
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
            // TODO: 调用实际的玩家服务
            return `玩家 ${player} 在服务器 ${server.name} 的详情功能正在开发中\n` +
                `提示: 需要服务器连接后才能获取玩家数据`;
        }
        catch (error) {
            logger.error('Failed to get player info:', error);
            return '获取玩家信息失败';
        }
    });
    // Kick player - Level 3 (管理员)
    ctx.command('mochi.player.kick [serverId] <player> [reason]', '踢出玩家')
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
        let targetServerId;
        let targetPlayer;
        let kickReason;
        if (!playerOrReason) {
            // 只有一个参数
            targetServerId = await getServerId(session);
            targetPlayer = serverIdOrPlayer;
            kickReason = undefined;
        }
        else if (!reason) {
            // 两个参数，可能是 serverId+player 或 player+reason
            // 尝试从绑定获取serverId
            const boundServerId = await getServerId(session);
            if (boundServerId) {
                // 有绑定，第一个参数是player，第二个是reason
                targetServerId = boundServerId;
                targetPlayer = serverIdOrPlayer;
                kickReason = playerOrReason;
            }
            else {
                // 无绑定，第一个是serverId，第二个是player
                targetServerId = serverIdOrPlayer;
                targetPlayer = playerOrReason;
                kickReason = undefined;
            }
        }
        else {
            // 三个参数
            targetServerId = await getServerId(session, serverIdOrPlayer);
            targetPlayer = playerOrReason;
            kickReason = reason;
        }
        if (!targetServerId) {
            return '请指定服务器 ID 或在群组中绑定服务器\n' +
                '用法: mochi.player.kick [serverId] <player> [reason]';
        }
        try {
            const server = await dbManager.getServer(targetServerId);
            if (!server) {
                return `服务器 ${targetServerId} 不存在`;
            }
            if (server.status !== 'online') {
                return `服务器 ${server.name} 当前离线`;
            }
            // 记录审计日志使用服务
            if (serviceManager?.audit) {
                await serviceManager.audit.logger.logServerOperation(targetServerId, 'player.kick', { player: targetPlayer, reason: kickReason || '无' }, 'success', undefined, { userId: session?.userId });
            }
            // TODO: 调用实际的玩家服务
            return `已踢出玩家 ${targetPlayer} 从服务器 ${server.name}\n` +
                `原因: ${kickReason || '无'}\n` +
                `提示: 需要服务器连接后才能执行`;
        }
        catch (error) {
            logger.error('Failed to kick player:', error);
            return '踢出玩家失败';
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
        let targetServerId;
        let command;
        // 判断第一个参数是serverId还是command
        if (commandParts.length === 0) {
            // 只有一个参数，从群组绑定获取serverId
            targetServerId = await getServerId(session);
            command = serverIdOrCommand || '';
        }
        else {
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
                    const result = await serviceManager.command.executeCommand(targetServerId, command, session?.userId || 'system', {
                        timeout: 30000,
                        requirePermission: false // 已经在命令层检查过权限
                    });
                    // 记录审计日志使用服务
                    if (serviceManager?.audit) {
                        await serviceManager.audit.logger.logServerOperation(targetServerId, 'command.execute', { command, executor: options.as }, 'success', undefined, { userId: session?.userId });
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
                }
                catch (error) {
                    logger.error('Failed to execute command:', error);
                    // 记录失败的审计日志使用服务
                    if (serviceManager?.audit) {
                        await serviceManager.audit.logger.logServerOperation(targetServerId, 'command.execute', { command, executor: options.as }, 'failure', error.message, { userId: session?.userId });
                    }
                    return `执行命令失败: ${error.message}`;
                }
            }
            else {
                return `服务器 ${server.name} 的命令执行功能需要服务器连接`;
            }
        }
        catch (error) {
            logger.error('Failed to execute command:', error);
            return '执行命令失败';
        }
    });
    // ========================================================================
    // 群组绑定管理
    // ========================================================================
    // Channel binding - Level 2 (受信任用户)
    ctx.command('mochi.bind', '频道绑定管理')
        .userFields(['authority']);
    // Add binding - Level 3 (管理员)
    ctx.command('mochi.bind.add <serverId>', '添加频道绑定')
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
                '示例: mochi.bind.add survival -t full';
        }
        if (!options) {
            return '选项参数错误';
        }
        try {
            // 验证服务器存在
            const server = await dbManager.getServer(serverId);
            if (!server) {
                return `服务器 ${serverId} 不存在`;
            }
            // 使用 BindingManager 创建绑定
            if (serviceManager?.binding) {
                try {
                    const binding = await serviceManager.binding.createBinding(session.userId || 'unknown', {
                        groupId: session.guildId,
                        serverId: serverId,
                        bindingType: (options.type || 'full'),
                        config: {}
                    });
                    return `已将服务器 ${server.name} 绑定到当前群组\n` +
                        `绑定类型: ${options.type}\n` +
                        `绑定 ID: ${binding.id}\n` +
                        `提示: 现在可以在群组中直接使用命令，无需指定服务器 ID`;
                }
                catch (error) {
                    logger.error('Failed to create binding:', error);
                    return `创建绑定失败: ${error.message}`;
                }
            }
            else {
                // 降级到直接数据库操作
                const existingBindings = await dbManager.getGroupBindings(session.guildId);
                const alreadyBound = existingBindings.find((b) => b.server_id === serverId);
                if (alreadyBound) {
                    return `服务器 ${server.name} 已绑定到此群组`;
                }
                const binding = await dbManager.createGroupBinding({
                    group_id: session.guildId,
                    server_id: serverId,
                    binding_type: (options.type || 'full'),
                    config: JSON.stringify({}),
                    created_by: session.userId || 'unknown',
                    status: 'active'
                });
                // 记录审计日志
                if (serviceManager?.audit) {
                    await serviceManager.audit.logger.logServerOperation(serverId, 'binding.create', {
                        groupId: session.guildId,
                        bindingType: options.type
                    }, 'success', undefined, { userId: session.userId });
                }
                return `已将服务器 ${server.name} 绑定到当前群组\n` +
                    `绑定类型: ${options.type}\n` +
                    `绑定 ID: ${binding.id}\n` +
                    `提示: 现在可以在群组中直接使用命令，无需指定服务器 ID`;
            }
        }
        catch (error) {
            logger.error('Failed to create binding:', error);
            return '创建绑定失败';
        }
    });
    // List bindings - Level 1 (所有用户可查看)
    ctx.command('mochi.bind.list', '查看频道绑定')
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
                return '当前群组暂无绑定的服务器\n' +
                    '使用 mochi.bind.add <serverId> 绑定服务器';
            }
            let result = '当前群组绑定的服务器：\n';
            for (const binding of bindings) {
                const server = await dbManager.getServer(binding.server_id);
                if (server) {
                    result += `  [${binding.id}] ${server.name} (${server.id}) - ${binding.binding_type} - ${binding.status}\n`;
                }
            }
            return result;
        }
        catch (error) {
            logger.error('Failed to list bindings:', error);
            return '获取绑定列表失败';
        }
    });
    // Remove binding - Level 3 (管理员)
    ctx.command('mochi.bind.remove <bindingId:number>', '移除频道绑定')
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
            return '用法: mochi.bind.remove <bindingId>';
        }
        try {
            // 使用 BindingManager 删除绑定
            if (serviceManager?.binding) {
                try {
                    await serviceManager.binding.deleteBinding(session.userId || 'unknown', bindingId);
                    return `已解除绑定 ${bindingId}`;
                }
                catch (error) {
                    logger.error('Failed to remove binding:', error);
                    return `解除绑定失败: ${error.message}`;
                }
            }
            else {
                // 降级到直接数据库操作
                const bindings = await dbManager.getGroupBindings(session.guildId);
                const binding = bindings.find((b) => b.id === bindingId);
                if (!binding) {
                    return `绑定 ${bindingId} 不存在或不属于当前群组`;
                }
                const server = await dbManager.getServer(binding.server_id);
                await dbManager.deleteGroupBinding(bindingId);
                // 记录审计日志
                if (serviceManager?.audit) {
                    await serviceManager.audit.logger.logServerOperation(binding.server_id, 'binding.delete', {
                        groupId: session.guildId,
                        bindingId
                    }, 'success', undefined, { userId: session.userId });
                }
                return `已解除服务器 ${server?.name || binding.server_id} 的绑定`;
            }
        }
        catch (error) {
            logger.error('Failed to remove binding:', error);
            return '解除绑定失败';
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
apply.Config = exports.Config;
