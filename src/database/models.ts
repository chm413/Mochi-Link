/**
 * Mochi-Link (大福连) - Database Models
 * 
 * This file contains the database table definitions and model interfaces
 * for the Minecraft Unified Management and Monitoring System.
 */

import { Context } from 'koishi';
import { 
  DatabaseServer, 
  DatabaseServerACL, 
  DatabaseAPIToken, 
  DatabaseAuditLog,
  DatabasePendingOperation,
  DatabaseServerBinding,
  DatabasePlayerCache
} from '../types';

// ============================================================================
// Table Declarations
// ============================================================================

declare module 'koishi' {
  interface Tables {
    minecraft_servers: DatabaseServer;
    server_acl: DatabaseServerACL;
    api_tokens: DatabaseAPIToken;
    audit_logs: DatabaseAuditLog;
    pending_operations: DatabasePendingOperation;
    server_bindings: DatabaseServerBinding;
    player_cache: DatabasePlayerCache;
  }
}

// ============================================================================
// Database Schema Definitions
// ============================================================================

export function defineModels(ctx: Context): void {
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

export async function createIndexes(ctx: Context): Promise<void> {
  // Note: In modern Koishi, indexes are typically handled by the database driver
  // This function is kept for compatibility but may not be needed
  ctx.logger('mochi-link').info('Database indexes will be handled by the database driver');
}

// ============================================================================
// Model Utilities
// ============================================================================

export class ModelUtils {
  constructor(private ctx: Context) {}

  /**
   * Convert database server record to application model
   */
  static dbServerToModel(dbServer: DatabaseServer): any {
    // Safely parse connection_config
    let connectionConfig: any = {};
    if (dbServer.connection_config) {
      if (typeof dbServer.connection_config === 'string') {
        try {
          // Only parse if not empty
          if (dbServer.connection_config.trim()) {
            connectionConfig = JSON.parse(dbServer.connection_config);
          }
        } catch (error) {
          console.error(`Failed to parse connection_config for server ${dbServer.id}:`, error);
          console.error(`Raw value: "${dbServer.connection_config}"`);
          connectionConfig = {};
        }
      } else {
        connectionConfig = dbServer.connection_config;
      }
    }

    // Safely parse tags
    let tags: string[] = [];
    if (dbServer.tags) {
      if (typeof dbServer.tags === 'string') {
        try {
          // Only parse if not empty
          if (dbServer.tags.trim()) {
            tags = JSON.parse(dbServer.tags);
          }
        } catch (error) {
          console.error(`Failed to parse tags for server ${dbServer.id}:`, error);
          console.error(`Raw value: "${dbServer.tags}"`);
          tags = [];
        }
      } else {
        tags = dbServer.tags || [];
      }
    }

    return {
      id: dbServer.id,
      name: dbServer.name,
      coreType: dbServer.core_type as any,
      coreName: dbServer.core_name,
      coreVersion: dbServer.core_version,
      connectionMode: dbServer.connection_mode as any,
      connectionConfig,
      status: dbServer.status as any,
      ownerId: dbServer.owner_id,
      tags,
      createdAt: dbServer.created_at,
      updatedAt: dbServer.updated_at,
      lastSeen: dbServer.last_seen
    };
  }

  /**
   * Convert application model to database server record
   */
  static modelToDbServer(model: any): Partial<DatabaseServer> {
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
  static dbACLToModel(dbACL: DatabaseServerACL): any {
    // Safely parse permissions
    let permissions: string[] = [];
    if (dbACL.permissions) {
      if (typeof dbACL.permissions === 'string') {
        try {
          if (dbACL.permissions.trim()) {
            permissions = JSON.parse(dbACL.permissions);
          }
        } catch (error) {
          console.error(`Failed to parse permissions for ACL ${dbACL.id}:`, error);
          permissions = [];
        }
      } else {
        permissions = dbACL.permissions || [];
      }
    }

    return {
      id: dbACL.id,
      userId: dbACL.user_id,
      serverId: dbACL.server_id,
      role: dbACL.role as any,
      permissions,
      grantedBy: dbACL.granted_by,
      grantedAt: dbACL.granted_at,
      expiresAt: dbACL.expires_at
    };
  }

  /**
   * Convert application ACL model to database record
   */
  static modelToDbACL(model: any): Partial<DatabaseServerACL> {
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
  static dbAuditToModel(dbAudit: DatabaseAuditLog): any {
    // Safely parse operation_data
    let operationData: any = {};
    if (dbAudit.operation_data) {
      if (typeof dbAudit.operation_data === 'string') {
        try {
          if (dbAudit.operation_data.trim()) {
            operationData = JSON.parse(dbAudit.operation_data);
          }
        } catch (error) {
          console.error(`Failed to parse operation_data for audit log ${dbAudit.id}:`, error);
          operationData = {};
        }
      } else {
        operationData = dbAudit.operation_data;
      }
    }

    return {
      id: dbAudit.id,
      userId: dbAudit.user_id,
      serverId: dbAudit.server_id,
      operation: dbAudit.operation,
      operationData,
      result: dbAudit.result as any,
      errorMessage: dbAudit.error_message,
      ipAddress: dbAudit.ip_address,
      userAgent: dbAudit.user_agent,
      createdAt: dbAudit.created_at
    };
  }

  /**
   * Convert application audit model to database record
   */
  static modelToDbAudit(model: any): Partial<DatabaseAuditLog> {
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

// ============================================================================
// Migration Functions
// ============================================================================

export async function runMigrations(ctx: Context): Promise<void> {
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
  } catch (error) {
    logger.error('Database migration failed:', error);
    throw error;
  }
}

// ============================================================================
// Database Health Check
// ============================================================================

export async function checkDatabaseHealth(ctx: Context): Promise<boolean> {
  try {
    // Test basic connectivity
    if (ctx.database && ctx.database.get) {
      await ctx.database.get('minecraft_servers', {}, ['id']);
      return true;
    }
    return false;
  } catch (error) {
    ctx.logger('mochi-link').error('Database health check failed:', error);
    return false;
  }
}