"use strict";
/**
 * Mochi-Link (大福连) - Simple Database Initialization
 *
 * Simplified database initialization for basic mode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleDatabaseManager = void 0;
// ============================================================================
// Database Initialization
// ============================================================================
class SimpleDatabaseManager {
    constructor(ctx, tablePrefix = 'mochi') {
        this.ctx = ctx;
        this.tablePrefix = tablePrefix;
    }
    /**
     * Initialize database tables
     */
    async initialize() {
        const ctx = this.ctx;
        const prefix = this.tablePrefix.replace(/\.$/, '_'); // Replace . with _
        // Minecraft Servers Table
        ctx.model.extend(`${prefix}servers`, {
            id: 'string',
            name: 'string',
            core_type: 'string',
            core_name: 'string',
            core_version: 'string',
            connection_mode: 'string',
            connection_config: 'text',
            status: { type: 'string', initial: 'offline' },
            owner_id: 'string',
            auth_token: 'string',
            tags: 'text',
            created_at: 'timestamp',
            updated_at: 'timestamp',
            last_seen: 'timestamp'
        }, {
            primary: 'id'
        });
        // Server Access Control List Table
        ctx.model.extend(`${prefix}server_acl`, {
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
        ctx.model.extend(`${prefix}api_tokens`, {
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
        ctx.model.extend(`${prefix}audit_logs`, {
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
        ctx.model.extend(`${prefix}group_bindings`, {
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
    }
    /**
     * Create a new server
     */
    async createServer(server) {
        const now = new Date();
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        const newServer = {
            ...server,
            created_at: now,
            updated_at: now
        };
        await this.ctx.database.create(`${prefix}servers`, newServer);
        return newServer;
    }
    /**
     * Get server by ID
     */
    async getServer(id) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        const servers = await this.ctx.database.get(`${prefix}servers`, { id });
        return servers[0] || null;
    }
    /**
     * List all servers
     */
    async listServers() {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        return await this.ctx.database.get(`${prefix}servers`, {});
    }
    /**
     * Update server
     */
    async updateServer(id, updates) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        await this.ctx.database.set(`${prefix}servers`, { id }, {
            ...updates,
            updated_at: new Date()
        });
    }
    /**
     * Delete server
     */
    async deleteServer(id) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        await this.ctx.database.remove(`${prefix}servers`, { id });
    }
    /**
     * Create audit log
     */
    async createAuditLog(log) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        await this.ctx.database.create(`${prefix}audit_logs`, {
            ...log,
            timestamp: new Date()
        });
    }
    /**
     * Get recent audit logs
     */
    async getAuditLogs(limit = 100) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        const logs = await this.ctx.database.get(`${prefix}audit_logs`, {});
        return logs.slice(-limit);
    }
    /**
     * Create group binding
     */
    async createGroupBinding(binding) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        const now = new Date();
        const newBinding = {
            ...binding,
            created_at: now,
            updated_at: now
        };
        const result = await this.ctx.database.create(`${prefix}group_bindings`, newBinding);
        return { ...newBinding, id: result.id };
    }
    /**
     * Get group bindings by group ID
     */
    async getGroupBindings(groupId) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        const bindings = await this.ctx.database.get(`${prefix}group_bindings`, {
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
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        await this.ctx.database.remove(`${prefix}group_bindings`, { id });
    }
    /**
     * Get all bindings for a server
     */
    async getServerBindings(serverId) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        const bindings = await this.ctx.database.get(`${prefix}group_bindings`, {
            server_id: serverId,
            status: 'active'
        });
        return bindings;
    }
}
exports.SimpleDatabaseManager = SimpleDatabaseManager;
