"use strict";
/**
 * Mochi-Link (����) - Database Operations
 *
 * This file contains the database CRUD operations and business logic
 * for managing servers, permissions, tokens, and audit logs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = exports.PendingOperationsManager = exports.AuditOperations = exports.TokenOperations = exports.ACLOperations = exports.ServerOperations = void 0;
const models_1 = require("./models");
const table_names_1 = require("./table-names");
// ============================================================================
// Server Operations
// ============================================================================
class ServerOperations {
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Create a new server configuration
     */
    async createServer(config) {
        const dbServer = models_1.ModelUtils.modelToDbServer({
            ...config,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await this.ctx.database.create(table_names_1.TableNames.minecraftServers, dbServer);
        // Return the created server
        const created = await this.getServer(config.id);
        if (!created) {
            throw new Error(`Failed to create server ${config.id}`);
        }
        return created;
    }
    /**
     * Get server by ID
     */
    async getServer(serverId) {
        const dbServers = await this.ctx.database.get(table_names_1.TableNames.minecraftServers, { id: serverId });
        if (dbServers.length === 0) {
            return null;
        }
        return models_1.ModelUtils.dbServerToModel(dbServers[0]);
    }
    /**
     * Get all servers
     */
    async getAllServers() {
        const dbServers = await this.ctx.database.get(table_names_1.TableNames.minecraftServers, {});
        return dbServers.map(models_1.ModelUtils.dbServerToModel);
    }
    /**
     * Get servers by owner
     */
    async getServersByOwner(ownerId) {
        const dbServers = await this.ctx.database.get(table_names_1.TableNames.minecraftServers, { owner_id: ownerId });
        return dbServers.map(models_1.ModelUtils.dbServerToModel);
    }
    /**
     * Update server configuration
     */
    async updateServer(serverId, updates) {
        const dbUpdates = models_1.ModelUtils.modelToDbServer({
            ...updates,
            updatedAt: new Date()
        });
        await this.ctx.database.set(table_names_1.TableNames.minecraftServers, { id: serverId }, dbUpdates);
        const updated = await this.getServer(serverId);
        if (!updated) {
            throw new Error(`Server ${serverId} not found after update`);
        }
        return updated;
    }
    /**
     * Update server status
     */
    async updateServerStatus(serverId, status, lastSeen) {
        const updates = {
            status,
            updated_at: new Date()
        };
        if (lastSeen) {
            updates.last_seen = lastSeen;
        }
        await this.ctx.database.set(table_names_1.TableNames.minecraftServers, { id: serverId }, updates);
    }
    /**
     * Delete server
     */
    async deleteServer(serverId) {
        const result = await this.ctx.database.remove(table_names_1.TableNames.minecraftServers, { id: serverId });
        return result.matched ? result.matched > 0 : false;
    }
    /**
     * Check if server exists
     */
    async serverExists(serverId) {
        const servers = await this.ctx.database.get(table_names_1.TableNames.minecraftServers, { id: serverId }, ['id']);
        return servers.length > 0;
    }
}
exports.ServerOperations = ServerOperations;
// ============================================================================
// Access Control Operations
// ============================================================================
class ACLOperations {
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Grant permissions to user for server
     */
    async grantPermission(userId, serverId, role, permissions, grantedBy, expiresAt) {
        const dbACL = models_1.ModelUtils.modelToDbACL({
            userId,
            serverId,
            role,
            permissions,
            grantedBy,
            grantedAt: new Date(),
            expiresAt
        });
        // Remove existing ACL for this user-server combination
        await this.ctx.database.remove(table_names_1.TableNames.serverAcl, {
            user_id: userId,
            server_id: serverId
        });
        // Create new ACL
        const result = await this.ctx.database.create(table_names_1.TableNames.serverAcl, dbACL);
        const created = await this.getACL(userId, serverId);
        if (!created) {
            throw new Error(`Failed to create ACL for user ${userId} on server ${serverId}`);
        }
        return created;
    }
    /**
     * Get ACL for user and server
     */
    async getACL(userId, serverId) {
        const dbACLs = await this.ctx.database.get(table_names_1.TableNames.serverAcl, {
            user_id: userId,
            server_id: serverId
        });
        if (dbACLs.length === 0) {
            return null;
        }
        return models_1.ModelUtils.dbACLToModel(dbACLs[0]);
    }
    /**
     * Get all ACLs for a server
     */
    async getServerACLs(serverId) {
        const dbACLs = await this.ctx.database.get(table_names_1.TableNames.serverAcl, { server_id: serverId });
        return dbACLs.map(models_1.ModelUtils.dbACLToModel);
    }
    /**
     * Get all ACLs for a user
     */
    async getUserACLs(userId) {
        const dbACLs = await this.ctx.database.get(table_names_1.TableNames.serverAcl, { user_id: userId });
        return dbACLs.map(models_1.ModelUtils.dbACLToModel);
    }
    /**
     * Check if user has permission
     */
    async hasPermission(userId, serverId, operation) {
        const acl = await this.getACL(userId, serverId);
        if (!acl) {
            return false;
        }
        // Check if ACL is expired
        if (acl.expiresAt && acl.expiresAt < new Date()) {
            return false;
        }
        // Check if user has the specific permission
        const permissionKey = `${serverId}.${operation}`;
        return acl.permissions.includes(permissionKey) || acl.permissions.includes('*');
    }
    /**
     * Revoke permissions
     */
    async revokePermission(userId, serverId) {
        const result = await this.ctx.database.remove(table_names_1.TableNames.serverAcl, {
            user_id: userId,
            server_id: serverId
        });
        return result.matched ? result.matched > 0 : false;
    }
    /**
     * Clean up expired ACLs
     */
    async cleanupExpiredACLs() {
        const now = new Date();
        const result = await this.ctx.database.remove(table_names_1.TableNames.serverAcl, {
            expires_at: { $lt: now }
        });
        return result.matched || 0;
    }
}
exports.ACLOperations = ACLOperations;
// ============================================================================
// API Token Operations
// ============================================================================
class TokenOperations {
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Create API token for server
     */
    async createToken(serverId, token, tokenHash, ipWhitelist, encryptionConfig, expiresAt) {
        const dbToken = {
            server_id: serverId,
            token,
            token_hash: tokenHash,
            ip_whitelist: ipWhitelist ? JSON.stringify(ipWhitelist) : undefined,
            encryption_config: encryptionConfig ? JSON.stringify(encryptionConfig) : undefined,
            created_at: new Date(),
            expires_at: expiresAt
        };
        const result = await this.ctx.database.create(table_names_1.TableNames.apiTokens, dbToken);
        const created = await this.getTokenById(result[0].id);
        if (!created) {
            throw new Error(`Failed to create token for server ${serverId}`);
        }
        return created;
    }
    /**
     * Get token by ID
     */
    async getTokenById(tokenId) {
        const dbTokens = await this.ctx.database.get(table_names_1.TableNames.apiTokens, { id: tokenId });
        if (dbTokens.length === 0) {
            return null;
        }
        return this.dbTokenToModel(dbTokens[0]);
    }
    /**
     * Get token by hash
     */
    async getTokenByHash(tokenHash) {
        const dbTokens = await this.ctx.database.get(table_names_1.TableNames.apiTokens, { token_hash: tokenHash });
        if (dbTokens.length === 0) {
            return null;
        }
        return this.dbTokenToModel(dbTokens[0]);
    }
    /**
     * Get tokens for server
     */
    async getServerTokens(serverId) {
        const dbTokens = await this.ctx.database.get(table_names_1.TableNames.apiTokens, { server_id: serverId });
        return dbTokens.map(token => this.dbTokenToModel(token));
    }
    /**
     * Update token last used timestamp
     */
    async updateTokenLastUsed(tokenId) {
        await this.ctx.database.set(table_names_1.TableNames.apiTokens, { id: tokenId }, {
            last_used: new Date()
        });
    }
    /**
     * Delete token
     */
    async deleteToken(tokenId) {
        const result = await this.ctx.database.remove(table_names_1.TableNames.apiTokens, { id: tokenId });
        return result.matched ? result.matched > 0 : false;
    }
    /**
     * Clean up expired tokens
     */
    async cleanupExpiredTokens() {
        const now = new Date();
        const result = await this.ctx.database.remove(table_names_1.TableNames.apiTokens, {
            expires_at: { $lt: now }
        });
        return result.matched || 0;
    }
    /**
     * Convert database token to model
     */
    dbTokenToModel(dbToken) {
        return {
            id: dbToken.id,
            serverId: dbToken.server_id,
            token: dbToken.token,
            tokenHash: dbToken.token_hash,
            ipWhitelist: dbToken.ip_whitelist ? JSON.parse(dbToken.ip_whitelist) : undefined,
            encryptionConfig: dbToken.encryption_config ? JSON.parse(dbToken.encryption_config) : undefined,
            createdAt: dbToken.created_at,
            expiresAt: dbToken.expires_at,
            lastUsed: dbToken.last_used
        };
    }
}
exports.TokenOperations = TokenOperations;
// ============================================================================
// Audit Log Operations
// ============================================================================
class AuditOperations {
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Log an operation
     */
    async logOperation(userId, serverId, operation, operationData, result, errorMessage, ipAddress, userAgent) {
        const dbAudit = models_1.ModelUtils.modelToDbAudit({
            userId,
            serverId,
            operation,
            operationData,
            result,
            errorMessage,
            ipAddress,
            userAgent,
            createdAt: new Date()
        });
        const insertResult = await this.ctx.database.create(table_names_1.TableNames.auditLogs, dbAudit);
        const created = await this.getAuditLog(insertResult[0].id);
        if (!created) {
            throw new Error('Failed to create audit log');
        }
        return created;
    }
    /**
     * Get audit log by ID
     */
    async getAuditLog(logId) {
        const dbLogs = await this.ctx.database.get(table_names_1.TableNames.auditLogs, { id: logId });
        if (dbLogs.length === 0) {
            return null;
        }
        return models_1.ModelUtils.dbAuditToModel(dbLogs[0]);
    }
    /**
     * Get audit logs with filters
     */
    async getAuditLogs(filters) {
        const query = {};
        if (filters.userId)
            query.user_id = filters.userId;
        if (filters.serverId)
            query.server_id = filters.serverId;
        if (filters.operation)
            query.operation = filters.operation;
        if (filters.result)
            query.result = filters.result;
        if (filters.startDate || filters.endDate) {
            query.created_at = {};
            if (filters.startDate)
                query.created_at.$gte = filters.startDate;
            if (filters.endDate)
                query.created_at.$lte = filters.endDate;
        }
        const dbLogs = await this.ctx.database.get(table_names_1.TableNames.auditLogs, query, {
            limit: filters.limit || 100,
            offset: filters.offset || 0
        });
        return dbLogs.map(log => models_1.ModelUtils.dbAuditToModel(log));
    }
    /**
     * Clean up old audit logs
     */
    async cleanupOldLogs(retentionDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const result = await this.ctx.database.remove(table_names_1.TableNames.auditLogs, {
            created_at: { $lt: cutoffDate }
        });
        return result.matched || 0;
    }
}
exports.AuditOperations = AuditOperations;
// ============================================================================
// Pending Operations
// ============================================================================
class PendingOperationsManager {
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Add pending operation
     */
    async addOperation(serverId, operationType, target, parameters, scheduledAt) {
        const dbOperation = {
            server_id: serverId,
            operation_type: operationType,
            target,
            parameters: JSON.stringify(parameters),
            status: 'pending',
            created_at: new Date(),
            scheduled_at: scheduledAt
        };
        const result = await this.ctx.database.create(table_names_1.TableNames.pendingOperations, dbOperation);
        const created = await this.getOperation(result[0].id);
        if (!created) {
            throw new Error('Failed to create pending operation');
        }
        return created;
    }
    /**
     * Get operation by ID
     */
    async getOperation(operationId) {
        const dbOps = await this.ctx.database.get(table_names_1.TableNames.pendingOperations, { id: operationId });
        if (dbOps.length === 0) {
            return null;
        }
        return this.dbOperationToModel(dbOps[0]);
    }
    /**
     * Get pending operations for server
     */
    async getPendingOperations(serverId) {
        const dbOps = await this.ctx.database.get(table_names_1.TableNames.pendingOperations, {
            server_id: serverId,
            status: 'pending'
        });
        return dbOps.map(op => this.dbOperationToModel(op));
    }
    /**
     * Update operation status
     */
    async updateOperationStatus(operationId, status, executedAt, error) {
        const updates = {
            status
        };
        if (executedAt) {
            updates.executed_at = executedAt;
        }
        if (error) {
            updates.parameters = JSON.stringify({ error });
        }
        await this.ctx.database.set(table_names_1.TableNames.pendingOperations, { id: operationId }, updates);
    }
    /**
     * Optimize operations for same target
     */
    async optimizeOperations(serverId) {
        const operations = await this.getPendingOperations(serverId);
        let optimizedCount = 0;
        // Group operations by target
        const operationsByTarget = new Map();
        for (const op of operations) {
            if (!operationsByTarget.has(op.target)) {
                operationsByTarget.set(op.target, []);
            }
            operationsByTarget.get(op.target).push(op);
        }
        // Optimize each target's operations
        for (const [target, targetOps] of Array.from(operationsByTarget.entries())) {
            if (targetOps.length < 2)
                continue;
            // Look for contradictory operations (add/remove pairs)
            const adds = targetOps.filter(op => op.operationType.includes('add'));
            const removes = targetOps.filter(op => op.operationType.includes('remove'));
            // Remove contradictory pairs
            for (const add of adds) {
                const matchingRemove = removes.find(remove => remove.createdAt > add.createdAt &&
                    remove.operationType.replace('remove', 'add') === add.operationType);
                if (matchingRemove) {
                    await this.ctx.database.remove(table_names_1.TableNames.pendingOperations, { id: add.id });
                    await this.ctx.database.remove(table_names_1.TableNames.pendingOperations, { id: matchingRemove.id });
                    optimizedCount += 2;
                }
            }
        }
        return optimizedCount;
    }
    /**
     * Convert database operation to model
     */
    dbOperationToModel(dbOp) {
        return {
            id: dbOp.id,
            serverId: dbOp.server_id,
            operationType: dbOp.operation_type,
            target: dbOp.target,
            parameters: JSON.parse(dbOp.parameters),
            status: dbOp.status,
            createdAt: dbOp.created_at,
            scheduledAt: dbOp.scheduled_at,
            executedAt: dbOp.executed_at
        };
    }
}
exports.PendingOperationsManager = PendingOperationsManager;
// ============================================================================
// Database Manager - Main Interface
// ============================================================================
class DatabaseManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.servers = new ServerOperations(ctx);
        this.acl = new ACLOperations(ctx);
        this.tokens = new TokenOperations(ctx);
        this.audit = new AuditOperations(ctx);
        this.pendingOps = new PendingOperationsManager(ctx);
    }
    /**
     * Perform database health check
     */
    async healthCheck() {
        try {
            // Test basic connectivity by querying servers table
            await this.ctx.database.get(table_names_1.TableNames.minecraftServers, {}, ['id']);
            return true;
        }
        catch (error) {
            this.ctx.logger('mochi-link:db').error('Database health check failed:', error);
            return false;
        }
    }
    /**
     * Get database statistics
     */
    async getStatistics() {
        const [servers, acls, tokens, auditLogs, pendingOps] = await Promise.all([
            this.ctx.database.get(table_names_1.TableNames.minecraftServers, {}, ['id']),
            this.ctx.database.get(table_names_1.TableNames.serverAcl, {}, ['id']),
            this.ctx.database.get(table_names_1.TableNames.apiTokens, {}, ['id']),
            this.ctx.database.get(table_names_1.TableNames.auditLogs, {}, ['id']),
            this.ctx.database.get(table_names_1.TableNames.pendingOperations, {}, ['id'])
        ]);
        return {
            servers: servers.length,
            acls: acls.length,
            tokens: tokens.length,
            auditLogs: auditLogs.length,
            pendingOps: pendingOps.length
        };
    }
    /**
     * Perform maintenance tasks
     */
    async performMaintenance(config) {
        const results = {
            auditLogsRemoved: 0,
            tokensRemoved: 0,
            aclsRemoved: 0
        };
        // Clean up old audit logs
        results.auditLogsRemoved = await this.audit.cleanupOldLogs(config.auditRetentionDays);
        // Clean up expired tokens
        if (config.tokenCleanup) {
            results.tokensRemoved = await this.tokens.cleanupExpiredTokens();
        }
        // Clean up expired ACLs
        if (config.aclCleanup) {
            results.aclsRemoved = await this.acl.cleanupExpiredACLs();
        }
        return results;
    }
}
exports.DatabaseManager = DatabaseManager;
