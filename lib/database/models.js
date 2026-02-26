"use strict";
/**
 * Mochi-Link (大福连) - Database Models
 *
 * This file contains the database table definitions and model interfaces
 * for the Minecraft Unified Management and Monitoring System.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelUtils = void 0;
exports.defineModels = defineModels;
exports.createIndexes = createIndexes;
exports.runMigrations = runMigrations;
exports.checkDatabaseHealth = checkDatabaseHealth;
// ============================================================================
// Database Schema Definitions
// ============================================================================
function defineModels(ctx) {
    // Minecraft Servers Table
    ctx.model.extend('minecraft_servers', {
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
        created_at: { type: 'timestamp', initial: new Date() },
        updated_at: { type: 'timestamp', initial: new Date() },
        last_seen: 'timestamp'
    }, {
        primary: 'id'
    });
    // Server Access Control List Table
    ctx.model.extend('server_acl', {
        id: 'unsigned',
        user_id: 'string',
        server_id: 'string',
        role: 'string',
        permissions: 'text',
        granted_by: 'string',
        granted_at: { type: 'timestamp', initial: new Date() },
        expires_at: 'timestamp'
    }, {
        primary: 'id',
        autoInc: true
    });
    // API Tokens Table
    ctx.model.extend('api_tokens', {
        id: 'unsigned',
        server_id: 'string',
        token: 'string',
        token_hash: 'string',
        ip_whitelist: 'text',
        encryption_config: 'text',
        created_at: { type: 'timestamp', initial: new Date() },
        expires_at: 'timestamp',
        last_used: 'timestamp'
    }, {
        primary: 'id',
        autoInc: true
    });
    // Audit Logs Table
    ctx.model.extend('audit_logs', {
        id: 'unsigned',
        user_id: 'string',
        server_id: 'string',
        operation: 'string',
        operation_data: 'text',
        result: 'string',
        error_message: 'text',
        ip_address: 'string',
        user_agent: 'text',
        created_at: { type: 'timestamp', initial: new Date() }
    }, {
        primary: 'id',
        autoInc: true
    });
    // Pending Operations Table
    ctx.model.extend('pending_operations', {
        id: 'unsigned',
        server_id: 'string',
        operation_type: 'string',
        target: 'string',
        parameters: 'text',
        status: { type: 'string', initial: 'pending' },
        created_at: { type: 'timestamp', initial: new Date() },
        scheduled_at: 'timestamp',
        executed_at: 'timestamp'
    }, {
        primary: 'id',
        autoInc: true
    });
    // Server Bindings Table
    ctx.model.extend('server_bindings', {
        id: 'unsigned',
        group_id: 'string',
        server_id: 'string',
        binding_type: { type: 'string', initial: 'chat' },
        config: 'text',
        created_at: { type: 'timestamp', initial: new Date() }
    }, {
        primary: 'id',
        autoInc: true
    });
    // Player Cache Table
    ctx.model.extend('player_cache', {
        id: 'unsigned',
        uuid: 'string',
        xuid: 'string',
        name: 'string',
        display_name: 'string',
        last_server_id: 'string',
        last_seen: 'timestamp',
        identity_confidence: { type: 'double', initial: 1.0 },
        identity_markers: 'text',
        is_premium: 'boolean',
        device_type: 'string',
        created_at: { type: 'timestamp', initial: new Date() },
        updated_at: { type: 'timestamp', initial: new Date() }
    }, {
        primary: 'id',
        autoInc: true
    });
}
// ============================================================================
// Database Indexes
// ============================================================================
async function createIndexes(ctx) {
    // Note: In modern Koishi, indexes are typically handled by the database driver
    // This function is kept for compatibility but may not be needed
    ctx.logger('mochi-link').info('Database indexes will be handled by the database driver');
}
// ============================================================================
// Model Utilities
// ============================================================================
class ModelUtils {
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Convert database server record to application model
     */
    static dbServerToModel(dbServer) {
        return {
            id: dbServer.id,
            name: dbServer.name,
            coreType: dbServer.core_type,
            coreName: dbServer.core_name,
            coreVersion: dbServer.core_version,
            connectionMode: dbServer.connection_mode,
            connectionConfig: typeof dbServer.connection_config === 'string'
                ? JSON.parse(dbServer.connection_config)
                : dbServer.connection_config,
            status: dbServer.status,
            ownerId: dbServer.owner_id,
            tags: typeof dbServer.tags === 'string'
                ? JSON.parse(dbServer.tags)
                : dbServer.tags || [],
            createdAt: dbServer.created_at,
            updatedAt: dbServer.updated_at,
            lastSeen: dbServer.last_seen
        };
    }
    /**
     * Convert application model to database server record
     */
    static modelToDbServer(model) {
        return {
            id: model.id,
            name: model.name,
            core_type: model.coreType,
            core_name: model.coreName,
            core_version: model.coreVersion,
            connection_mode: model.connectionMode,
            connection_config: JSON.stringify(model.connectionConfig),
            status: model.status,
            owner_id: model.ownerId,
            tags: JSON.stringify(model.tags || []),
            updated_at: new Date()
        };
    }
    /**
     * Convert database ACL record to application model
     */
    static dbACLToModel(dbACL) {
        return {
            id: dbACL.id,
            userId: dbACL.user_id,
            serverId: dbACL.server_id,
            role: dbACL.role,
            permissions: typeof dbACL.permissions === 'string'
                ? JSON.parse(dbACL.permissions)
                : dbACL.permissions || [],
            grantedBy: dbACL.granted_by,
            grantedAt: dbACL.granted_at,
            expiresAt: dbACL.expires_at
        };
    }
    /**
     * Convert application ACL model to database record
     */
    static modelToDbACL(model) {
        return {
            user_id: model.userId,
            server_id: model.serverId,
            role: model.role,
            permissions: JSON.stringify(model.permissions || []),
            granted_by: model.grantedBy,
            granted_at: model.grantedAt,
            expires_at: model.expiresAt
        };
    }
    /**
     * Convert database audit log to application model
     */
    static dbAuditToModel(dbAudit) {
        return {
            id: dbAudit.id,
            userId: dbAudit.user_id,
            serverId: dbAudit.server_id,
            operation: dbAudit.operation,
            operationData: typeof dbAudit.operation_data === 'string'
                ? JSON.parse(dbAudit.operation_data)
                : dbAudit.operation_data,
            result: dbAudit.result,
            errorMessage: dbAudit.error_message,
            ipAddress: dbAudit.ip_address,
            userAgent: dbAudit.user_agent,
            createdAt: dbAudit.created_at
        };
    }
    /**
     * Convert application audit model to database record
     */
    static modelToDbAudit(model) {
        return {
            user_id: model.userId,
            server_id: model.serverId,
            operation: model.operation,
            operation_data: JSON.stringify(model.operationData || {}),
            result: model.result,
            error_message: model.errorMessage,
            ip_address: model.ipAddress,
            user_agent: model.userAgent
        };
    }
}
exports.ModelUtils = ModelUtils;
// ============================================================================
// Migration Functions
// ============================================================================
async function runMigrations(ctx) {
    const logger = ctx.logger('mochi-link:migration');
    try {
        logger.info('Starting database migrations...');
        // Define all models
        defineModels(ctx);
        // Create tables (Koishi handles this automatically when models are defined)
        logger.info('Database models defined successfully');
        // Create additional indexes
        await createIndexes(ctx);
        logger.info('Database migrations completed successfully');
    }
    catch (error) {
        logger.error('Database migration failed:', error);
        throw error;
    }
}
// ============================================================================
// Database Health Check
// ============================================================================
async function checkDatabaseHealth(ctx) {
    try {
        // Test basic connectivity
        if (ctx.database && ctx.database.get) {
            await ctx.database.get('minecraft_servers', {}, ['id']);
            return true;
        }
        return false;
    }
    catch (error) {
        ctx.logger('mochi-link').error('Database health check failed:', error);
        return false;
    }
}
