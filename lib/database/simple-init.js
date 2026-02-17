"use strict";
/**
 * Mochi-Link (大福连) - Simple Database Initialization
 * 
 * Simplified database initialization for basic mode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleDatabaseManager = void 0;

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

        // Minecraft Servers Table
        ctx.model.extend(`${this.tablePrefix}.servers`, {
            id: 'string',
            name: 'string',
            core_type: 'string',
            core_name: 'string',
            core_version: 'string',
            connection_mode: 'string',
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
        ctx.model.extend(`${this.tablePrefix}.server_acl`, {
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
        ctx.model.extend(`${this.tablePrefix}.api_tokens`, {
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
        ctx.model.extend(`${this.tablePrefix}.audit_logs`, {
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

        await this.ctx.database.create(`${this.tablePrefix}.servers`, newServer);
        return newServer;
    }

    /**
     * Get server by ID
     */
    async getServer(id) {
        const servers = await this.ctx.database.get(`${this.tablePrefix}.servers`, { id });
        return servers[0] || null;
    }

    /**
     * List all servers
     */
    async listServers() {
        return await this.ctx.database.get(`${this.tablePrefix}.servers`, {});
    }

    /**
     * Update server
     */
    async updateServer(id, updates) {
        await this.ctx.database.set(`${this.tablePrefix}.servers`, { id }, {
            ...updates,
            updated_at: new Date()
        });
    }

    /**
     * Delete server
     */
    async deleteServer(id) {
        await this.ctx.database.remove(`${this.tablePrefix}.servers`, { id });
    }

    /**
     * Create audit log
     */
    async createAuditLog(log) {
        await this.ctx.database.create(`${this.tablePrefix}.audit_logs`, {
            ...log,
            timestamp: new Date()
        });
    }

    /**
     * Get recent audit logs
     */
    async getAuditLogs(limit = 100) {
        const logs = await this.ctx.database.get(`${this.tablePrefix}.audit_logs`, {});
        return logs.slice(-limit);
    }
}

exports.SimpleDatabaseManager = SimpleDatabaseManager;
