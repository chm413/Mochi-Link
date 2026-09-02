"use strict";
/**
 * Mochi-Link (大福连) - Simple Database Initialization
 *
 * Simplified database initialization for basic mode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleDatabaseManager = void 0;
const table_names_1 = require("./table-names");
// ============================================================================
// Database Initialization
// ============================================================================
class SimpleDatabaseManager {
    constructor(ctx, tablePrefix = 'mochi') {
        this.ctx = ctx;
        this.tablePrefix = tablePrefix;
        this.startupMigrationSummary = {
            migratedReverseToForward: 0,
            skipped: 0,
            warnedLegacyRead: 0
        };
    }
    table(baseName) {
        return (0, table_names_1.buildTableName)(this.tablePrefix, baseName);
    }
    /**
     * Initialize database tables
     */
    async initialize() {
        const ctx = this.ctx;
        // Minecraft Servers Table
        ctx.model.extend(this.table('servers'), {
            id: 'string',
            name: 'string',
            core_type: 'string',
            core_name: 'string',
            core_version: 'string',
            connection_mode: 'string',
            accept_inbound_ws: { type: 'boolean', initial: true },
            dial_outbound_ws: { type: 'boolean', initial: false },
            connection_config: 'text',
            status: { type: 'string', initial: 'offline' },
            owner_id: 'string',
            tags: 'text',
            created_at: 'timestamp',
            updated_at: 'timestamp',
            last_seen: 'timestamp'
        }, {
            primary: 'id'
        });
        // Server Access Control List Table
        ctx.model.extend(this.table('server_acl'), {
            id: 'unsigned',
            user_id: 'string',
            server_id: 'string',
            role: 'string',
            permissions: 'text',
            granted_by: 'string',
            granted_at: 'timestamp',
            expires_at: 'timestamp'
        }, {
            primary: 'id',
            autoInc: true
        });
        // API Tokens Table
        ctx.model.extend(this.table('api_tokens'), {
            id: 'unsigned',
            server_id: 'string',
            token: 'string',
            token_hash: 'string',
            ip_whitelist: 'text',
            encryption_config: 'text',
            created_at: 'timestamp',
            expires_at: 'timestamp',
            last_used: 'timestamp'
        }, {
            primary: 'id',
            autoInc: true
        });
        // Audit Logs Table
        ctx.model.extend(this.table('audit_logs'), {
            id: 'unsigned',
            user_id: 'string',
            server_id: 'string',
            operation: 'string',
            operation_data: 'text',
            result: 'string',
            error_message: 'text',
            ip_address: 'string',
            user_agent: 'text',
            timestamp: 'timestamp'
        }, {
            primary: 'id',
            autoInc: true
        });
        // Group Bindings Table
        ctx.model.extend(this.table('group_bindings'), {
            id: 'unsigned',
            group_id: 'string',
            server_id: 'string',
            binding_type: { type: 'string', initial: 'full' },
            config: 'text',
            created_by: 'string',
            created_at: 'timestamp',
            updated_at: 'timestamp',
            status: { type: 'string', initial: 'active' }
        }, {
            primary: 'id',
            autoInc: true
        });
        // Pending Operations Table
        ctx.model.extend(this.table('pending_operations'), {
            id: 'unsigned',
            server_id: 'string',
            operation_type: 'string',
            target: 'string',
            parameters: 'text',
            status: { type: 'string', initial: 'pending' },
            created_at: 'timestamp',
            updated_at: 'timestamp'
        }, {
            primary: 'id',
            autoInc: true
        });
        // Player Cache Table
        ctx.model.extend(this.table('player_cache'), {
            id: 'unsigned',
            uuid: 'string',
            xuid: 'string',
            name: 'string',
            last_server_id: 'string',
            last_seen: 'timestamp',
            created_at: 'timestamp',
            updated_at: 'timestamp'
        }, {
            primary: 'id',
            autoInc: true
        });
        // Server Bindings Table
        ctx.model.extend(this.table('server_bindings'), {
            id: 'unsigned',
            group_id: 'string',
            server_id: 'string',
            binding_type: 'string',
            config: 'text',
            created_at: 'timestamp'
        }, {
            primary: 'id',
            autoInc: true
        });
        await this.migrateLegacyConnectionMode();
    }
    /**
     * Startup migration: map legacy reverse values to the new connector-perspective semantics.
     * Legacy `reverse` is migrated to `forward` (forward-only fallback) and synchronized with
     * capability fields.
     */
    async migrateLegacyConnectionMode() {
        const logger = this.ctx.logger('mochi-link:db-migration');
        const servers = await this.ctx.database.get(this.table('servers'), {});
        let migrated = 0;
        let skipped = 0;
        let warnedLegacyRead = 0;
        for (const server of servers) {
            if (server.connection_mode !== 'reverse') {
                skipped++;
                continue;
            }
            let parsedConfig = {};
            if (typeof server.connection_config === 'string' && server.connection_config.trim()) {
                try {
                    parsedConfig = JSON.parse(server.connection_config);
                }
                catch {
                    parsedConfig = {};
                }
            }
            const hasOwn = (obj, key) => !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
            const hasConfigCapabilities = hasOwn(parsedConfig, 'accept_inbound_ws') ||
                hasOwn(parsedConfig, 'dial_outbound_ws') ||
                hasOwn(parsedConfig?.ws_capabilities, 'accept_inbound_ws') ||
                hasOwn(parsedConfig?.ws_capabilities, 'dial_outbound_ws');
            const hasMigrationMarker = hasOwn(parsedConfig?.migration, 'auto_migrated_legacy_reverse_at');
            const isNonLegacyByConfig = hasConfigCapabilities || hasMigrationMarker;
            // 兼容窗口：仅当配置中已有显式能力字段或明确迁移标记，才视为新语义数据并保留 reverse。
            if (isNonLegacyByConfig) {
                warnedLegacyRead++;
                logger.warn(`检测到服务器 ${server.id} 使用 reverse 且配置中存在能力字段或迁移标记，保留为新语义数据（兼容窗口内）。`);
                skipped++;
                continue;
            }
            const migratedConfig = {
                ...parsedConfig,
                ws_capabilities: {
                    accept_inbound_ws: true,
                    dial_outbound_ws: false
                },
                migration: {
                    auto_migrated_legacy_reverse_at: new Date().toISOString()
                }
            };
            await this.ctx.database.set(this.table('servers'), { id: server.id }, {
                connection_mode: 'forward',
                accept_inbound_ws: true,
                dial_outbound_ws: false,
                connection_config: JSON.stringify(migratedConfig),
                updated_at: new Date()
            });
            migrated++;
            logger.warn(`已自动迁移服务器 ${server.id}: legacy connection_mode=reverse -> forward（新语义/forward-only）`);
        }
        this.startupMigrationSummary = {
            migratedReverseToForward: migrated,
            skipped,
            warnedLegacyRead
        };
        if (migrated > 0) {
            logger.info(`启动迁移完成：已自动迁移 ${migrated} 条 legacy reverse 数据（下一版本将彻底移除 legacy connection_mode 读取）。`);
        }
        else {
            logger.info('启动迁移检查完成：未发现需要自动迁移的 legacy reverse 数据。');
        }
    }
    getStartupMigrationSummary() {
        return this.startupMigrationSummary;
    }
    /**
     * Create a new server
     */
    async createServer(server) {
        const now = new Date();
        const newServer = {
            ...server,
            created_at: now,
            updated_at: now
        };
        await this.ctx.database.create(this.table('servers'), newServer);
        return newServer;
    }
    /**
     * Get server by ID
     */
    async getServer(id) {
        const servers = await this.ctx.database.get(this.table('servers'), { id });
        return servers[0] || null;
    }
    /**
     * List all servers
     */
    async listServers() {
        return await this.ctx.database.get(this.table('servers'), {});
    }
    /**
     * Update server
     */
    async updateServer(id, updates) {
        // The route/query identifies the record. Never allow a partial update to
        // move the primary key or rewrite the creation time.
        const safeUpdates = { ...updates };
        delete safeUpdates.id;
        delete safeUpdates.created_at;
        await this.ctx.database.set(this.table('servers'), { id }, {
            ...safeUpdates,
            updated_at: new Date()
        });
    }
    /**
     * Delete server
     */
    async deleteServer(id) {
        await this.ctx.database.remove(this.table('servers'), { id });
    }
    /**
     * Create audit log
     */
    async createAuditLog(log) {
        await this.ctx.database.create(this.table('audit_logs'), {
            ...log,
            timestamp: new Date()
        });
    }
    /**
     * Get recent audit logs
     */
    async getAuditLogs(limit = 100) {
        const logs = await this.ctx.database.get(this.table('audit_logs'), {});
        return logs.slice(-limit);
    }
    /**
     * Create group binding
     */
    async createGroupBinding(binding) {
        const now = new Date();
        const newBinding = {
            ...binding,
            created_at: now,
            updated_at: now
        };
        const result = await this.ctx.database.create(this.table('group_bindings'), newBinding);
        return { ...newBinding, id: result.id };
    }
    /**
     * Get group bindings by group ID
     */
    async getGroupBindings(groupId) {
        const bindings = await this.ctx.database.get(this.table('group_bindings'), {
            group_id: groupId,
            status: 'active'
        });
        return bindings;
    }
    /**
     * Get primary server for a group
     */
    async getGroupPrimaryServer(groupId) {
        const bindings = await this.getGroupBindings(groupId);
        if (bindings.length === 0)
            return null;
        // Return the first active binding's server
        return bindings[0].server_id;
    }
    /**
     * Delete group binding
     */
    async deleteGroupBinding(id) {
        await this.ctx.database.remove(this.table('group_bindings'), { id });
    }
    /**
     * Get all bindings for a server
     */
    async getServerBindings(serverId) {
        const bindings = await this.ctx.database.get(this.table('group_bindings'), {
            server_id: serverId,
            status: 'active'
        });
        return bindings;
    }
    /**
     * Create API token for a server
     */
    async createAPIToken(serverId, token, tokenHash, options) {
        const now = new Date();
        const tokenData = {
            server_id: serverId,
            token: '',
            token_hash: tokenHash,
            ip_whitelist: options?.ipWhitelist ? JSON.stringify(options.ipWhitelist) : null,
            encryption_config: options?.encryptionConfig ? JSON.stringify(options.encryptionConfig) : null,
            created_at: now,
            expires_at: options?.expiresAt || null,
            last_used: null
        };
        const result = await this.ctx.database.create(this.table('api_tokens'), tokenData);
        return {
            id: result.id,
            serverId: serverId,
            token: token,
            tokenHash: tokenHash,
            ipWhitelist: options?.ipWhitelist,
            encryptionConfig: options?.encryptionConfig,
            createdAt: now,
            expiresAt: options?.expiresAt,
            lastUsed: undefined
        };
    }
    /**
     * Get API tokens for a server
     */
    async getAPITokens(serverId) {
        const tokens = await this.ctx.database.get(this.table('api_tokens'), {
            server_id: serverId
        });
        return tokens.map((t) => ({
            id: t.id,
            serverId: t.server_id,
            token: t.token || '',
            tokenHash: t.token_hash,
            ipWhitelist: t.ip_whitelist ? JSON.parse(t.ip_whitelist) : undefined,
            encryptionConfig: t.encryption_config ? JSON.parse(t.encryption_config) : undefined,
            createdAt: t.created_at,
            expiresAt: t.expires_at,
            lastUsed: t.last_used
        }));
    }
    /**
     * Delete API token
     */
    async deleteAPIToken(tokenId) {
        await this.ctx.database.remove(this.table('api_tokens'), { id: tokenId });
    }
    /**
     * Delete all API tokens for a server
     */
    async deleteServerAPITokens(serverId) {
        await this.ctx.database.remove(this.table('api_tokens'), { server_id: serverId });
    }
}
exports.SimpleDatabaseManager = SimpleDatabaseManager;
