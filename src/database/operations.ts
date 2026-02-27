/**
 * Mochi-Link (����) - Database Operations
 * 
 * This file contains the database CRUD operations and business logic
 * for managing servers, permissions, tokens, and audit logs.
 */

import { Context } from 'koishi';
import { 
  ServerConfig, 
  ServerACL, 
  APIToken, 
  AuditLog, 
  PendingOperation,
  DatabaseServer,
  DatabaseServerACL,
  DatabaseAPIToken,
  DatabaseAuditLog,
  DatabasePendingOperation,
  DatabaseServerBinding,
  DatabasePlayerCache,
  ServerRole,
  OperationStatus
} from '../types';
import { ModelUtils } from './models';
import { TableNames } from './table-names';

// ============================================================================
// Server Operations
// ============================================================================

export class ServerOperations {
  constructor(private ctx: Context) {}

  /**
   * Create a new server configuration
   */
  async createServer(config: Omit<ServerConfig, 'createdAt' | 'updatedAt'>): Promise<ServerConfig> {
    const dbServer = ModelUtils.modelToDbServer({
      ...config,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await this.ctx.database.create(TableNames.minecraftServers as any, dbServer);
    
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
  async getServer(serverId: string): Promise<ServerConfig | null> {
    const dbServers = await this.ctx.database.get(TableNames.minecraftServers as any, { id: serverId });
    
    if (dbServers.length === 0) {
      return null;
    }
    
    return ModelUtils.dbServerToModel(dbServers[0]);
  }

  /**
   * Get all servers
   */
  async getAllServers(): Promise<ServerConfig[]> {
    const dbServers = await this.ctx.database.get(TableNames.minecraftServers as any, {});
    return dbServers.map(ModelUtils.dbServerToModel);
  }

  /**
   * Get servers by owner
   */
  async getServersByOwner(ownerId: string): Promise<ServerConfig[]> {
    const dbServers = await this.ctx.database.get(TableNames.minecraftServers as any, { owner_id: ownerId });
    return dbServers.map(ModelUtils.dbServerToModel);
  }

  /**
   * Update server configuration
   */
  async updateServer(serverId: string, updates: Partial<ServerConfig>): Promise<ServerConfig> {
    const dbUpdates = ModelUtils.modelToDbServer({
      ...updates,
      updatedAt: new Date()
    });

    await this.ctx.database.set(TableNames.minecraftServers as any, { id: serverId }, dbUpdates);
    
    const updated = await this.getServer(serverId);
    if (!updated) {
      throw new Error(`Server ${serverId} not found after update`);
    }
    
    return updated;
  }

  /**
   * Update server status
   */
  async updateServerStatus(serverId: string, status: ServerConfig['status'], lastSeen?: Date): Promise<void> {
    const updates: Partial<DatabaseServer> = {
      status,
      updated_at: new Date()
    };
    
    if (lastSeen) {
      updates.last_seen = lastSeen;
    }

    await this.ctx.database.set(TableNames.minecraftServers as any, { id: serverId }, updates);
  }

  /**
   * Delete server
   */
  async deleteServer(serverId: string): Promise<boolean> {
    const result = await this.ctx.database.remove(TableNames.minecraftServers as any, { id: serverId });
    return result.matched ? result.matched > 0 : false;
  }

  /**
   * Check if server exists
   */
  async serverExists(serverId: string): Promise<boolean> {
    const servers = await this.ctx.database.get(TableNames.minecraftServers as any, { id: serverId }, ['id']);
    return servers.length > 0;
  }
}

// ============================================================================
// Access Control Operations
// ============================================================================

export class ACLOperations {
  constructor(private ctx: Context) {}

  /**
   * Grant permissions to user for server
   */
  async grantPermission(
    userId: string, 
    serverId: string, 
    role: ServerRole, 
    permissions: string[], 
    grantedBy: string,
    expiresAt?: Date
  ): Promise<ServerACL> {
    const dbACL = ModelUtils.modelToDbACL({
      userId,
      serverId,
      role,
      permissions,
      grantedBy,
      grantedAt: new Date(),
      expiresAt
    });

    // Remove existing ACL for this user-server combination
    await this.ctx.database.remove(TableNames.serverAcl as any, { 
      user_id: userId, 
      server_id: serverId 
    });

    // Create new ACL
    const result = await this.ctx.database.create(TableNames.serverAcl as any, dbACL);
    
    const created = await this.getACL(userId, serverId);
    if (!created) {
      throw new Error(`Failed to create ACL for user ${userId} on server ${serverId}`);
    }
    
    return created;
  }

  /**
   * Get ACL for user and server
   */
  async getACL(userId: string, serverId: string): Promise<ServerACL | null> {
    const dbACLs = await this.ctx.database.get(TableNames.serverAcl as any, { 
      user_id: userId, 
      server_id: serverId 
    });
    
    if (dbACLs.length === 0) {
      return null;
    }
    
    return ModelUtils.dbACLToModel(dbACLs[0]);
  }

  /**
   * Get all ACLs for a server
   */
  async getServerACLs(serverId: string): Promise<ServerACL[]> {
    const dbACLs = await this.ctx.database.get(TableNames.serverAcl as any, { server_id: serverId });
    return dbACLs.map(ModelUtils.dbACLToModel);
  }

  /**
   * Get all ACLs for a user
   */
  async getUserACLs(userId: string): Promise<ServerACL[]> {
    const dbACLs = await this.ctx.database.get(TableNames.serverAcl as any, { user_id: userId });
    return dbACLs.map(ModelUtils.dbACLToModel);
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, serverId: string, operation: string): Promise<boolean> {
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
  async revokePermission(userId: string, serverId: string): Promise<boolean> {
    const result = await this.ctx.database.remove(TableNames.serverAcl as any, { 
      user_id: userId, 
      server_id: serverId 
    });
    return result.matched ? result.matched > 0 : false;
  }

  /**
   * Clean up expired ACLs
   */
  async cleanupExpiredACLs(): Promise<number> {
    const now = new Date();
    const result = await this.ctx.database.remove(TableNames.serverAcl as any, {
      expires_at: { $lt: now }
    });
    return result.matched || 0;
  }
}

// ============================================================================
// API Token Operations
// ============================================================================

export class TokenOperations {
  constructor(private ctx: Context) {}

  /**
   * Create API token for server
   */
  async createToken(
    serverId: string, 
    token: string, 
    tokenHash: string,
    ipWhitelist?: string[],
    encryptionConfig?: any,
    expiresAt?: Date
  ): Promise<APIToken> {
    const dbToken: Partial<DatabaseAPIToken> = {
      server_id: serverId,
      token,
      token_hash: tokenHash,
      ip_whitelist: ipWhitelist ? JSON.stringify(ipWhitelist) : undefined,
      encryption_config: encryptionConfig ? JSON.stringify(encryptionConfig) : undefined,
      created_at: new Date(),
      expires_at: expiresAt
    };

    const result = await this.ctx.database.create(TableNames.apiTokens as any, dbToken);
    
    const created = await this.getTokenById((result as any)[0].id);
    if (!created) {
      throw new Error(`Failed to create token for server ${serverId}`);
    }
    
    return created;
  }

  /**
   * Get token by ID
   */
  async getTokenById(tokenId: number): Promise<APIToken | null> {
    const dbTokens = await this.ctx.database.get(TableNames.apiTokens as any, { id: tokenId });
    
    if (dbTokens.length === 0) {
      return null;
    }
    
    return this.dbTokenToModel(dbTokens[0]);
  }

  /**
   * Get token by hash
   */
  async getTokenByHash(tokenHash: string): Promise<APIToken | null> {
    const dbTokens = await this.ctx.database.get(TableNames.apiTokens as any, { token_hash: tokenHash });
    
    if (dbTokens.length === 0) {
      return null;
    }
    
    return this.dbTokenToModel(dbTokens[0]);
  }

  /**
   * Get tokens for server
   */
  async getServerTokens(serverId: string): Promise<APIToken[]> {
    const dbTokens = await this.ctx.database.get(TableNames.apiTokens as any, { server_id: serverId });
    return dbTokens.map(token => this.dbTokenToModel(token));
  }

  /**
   * Update token last used timestamp
   */
  async updateTokenLastUsed(tokenId: number): Promise<void> {
    await this.ctx.database.set(TableNames.apiTokens as any, { id: tokenId }, {
      last_used: new Date()
    });
  }

  /**
   * Delete token
   */
  async deleteToken(tokenId: number): Promise<boolean> {
    const result = await this.ctx.database.remove(TableNames.apiTokens as any, { id: tokenId });
    return result.matched ? result.matched > 0 : false;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    const result = await this.ctx.database.remove(TableNames.apiTokens as any, {
      expires_at: { $lt: now }
    });
    return result.matched || 0;
  }

  /**
   * Convert database token to model
   */
  private dbTokenToModel(dbToken: DatabaseAPIToken): APIToken {
    // Safely parse ip_whitelist
    let ipWhitelist: string[] | undefined;
    if (dbToken.ip_whitelist) {
      try {
        if (dbToken.ip_whitelist.trim()) {
          ipWhitelist = JSON.parse(dbToken.ip_whitelist);
        }
      } catch (error) {
        console.error(`Failed to parse ip_whitelist for token ${dbToken.id}:`, error);
        ipWhitelist = undefined;
      }
    }

    // Safely parse encryption_config
    let encryptionConfig: any | undefined;
    if (dbToken.encryption_config) {
      try {
        if (dbToken.encryption_config.trim()) {
          encryptionConfig = JSON.parse(dbToken.encryption_config);
        }
      } catch (error) {
        console.error(`Failed to parse encryption_config for token ${dbToken.id}:`, error);
        encryptionConfig = undefined;
      }
    }

    return {
      id: dbToken.id,
      serverId: dbToken.server_id,
      token: dbToken.token,
      tokenHash: dbToken.token_hash,
      ipWhitelist,
      encryptionConfig,
      createdAt: dbToken.created_at,
      expiresAt: dbToken.expires_at,
      lastUsed: dbToken.last_used
    };
  }
}

// ============================================================================
// Audit Log Operations
// ============================================================================

export class AuditOperations {
  constructor(private ctx: Context) {}

  /**
   * Log an operation
   */
  async logOperation(
    userId: string | undefined,
    serverId: string | undefined,
    operation: string,
    operationData: any,
    result: 'success' | 'failure' | 'error',
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLog> {
    const dbAudit = ModelUtils.modelToDbAudit({
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

    const insertResult = await this.ctx.database.create(TableNames.auditLogs as any, dbAudit);
    
    // database.create returns the created object, not an array
    const createdId = (insertResult as any).id;
    if (!createdId) {
      throw new Error('Failed to create audit log - no ID returned');
    }
    
    const created = await this.getAuditLog(createdId);
    if (!created) {
      throw new Error('Failed to retrieve created audit log');
    }
    
    return created;
  }

  /**
   * Get audit log by ID
   */
  async getAuditLog(logId: number): Promise<AuditLog | null> {
    const dbLogs = await this.ctx.database.get(TableNames.auditLogs as any, { id: logId });
    
    if (dbLogs.length === 0) {
      return null;
    }
    
    return ModelUtils.dbAuditToModel(dbLogs[0]);
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters: {
    userId?: string;
    serverId?: string;
    operation?: string;
    result?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const query: any = {};
    
    if (filters.userId) query.user_id = filters.userId;
    if (filters.serverId) query.server_id = filters.serverId;
    if (filters.operation) query.operation = filters.operation;
    if (filters.result) query.result = filters.result;
    
    if (filters.startDate || filters.endDate) {
      query.created_at = {};
      if (filters.startDate) query.created_at.$gte = filters.startDate;
      if (filters.endDate) query.created_at.$lte = filters.endDate;
    }

    const dbLogs = await this.ctx.database.get(TableNames.auditLogs as any, query, {
      limit: filters.limit || 100,
      offset: filters.offset || 0
    });
    
    return dbLogs.map(log => ModelUtils.dbAuditToModel(log as any));
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await this.ctx.database.remove(TableNames.auditLogs as any, {
      created_at: { $lt: cutoffDate }
    });
    
    return result.matched || 0;
  }
}

// ============================================================================
// Pending Operations
// ============================================================================

export class PendingOperationsManager {
  constructor(private ctx: Context) {}

  /**
   * Add pending operation
   */
  async addOperation(
    serverId: string,
    operationType: string,
    target: string,
    parameters: any,
    scheduledAt?: Date
  ): Promise<PendingOperation> {
    const dbOperation: Partial<DatabasePendingOperation> = {
      server_id: serverId,
      operation_type: operationType,
      target,
      parameters: JSON.stringify(parameters),
      status: 'pending',
      created_at: new Date(),
      scheduled_at: scheduledAt
    };

    const result = await this.ctx.database.create(TableNames.pendingOperations as any, dbOperation);
    
    const created = await this.getOperation((result as any)[0].id);
    if (!created) {
      throw new Error('Failed to create pending operation');
    }
    
    return created;
  }

  /**
   * Get operation by ID
   */
  async getOperation(operationId: number): Promise<PendingOperation | null> {
    const dbOps = await this.ctx.database.get(TableNames.pendingOperations as any, { id: operationId });
    
    if (dbOps.length === 0) {
      return null;
    }
    
    return this.dbOperationToModel(dbOps[0]);
  }

  /**
   * Get pending operations for server
   */
  async getPendingOperations(serverId: string): Promise<PendingOperation[]> {
    const dbOps = await this.ctx.database.get(TableNames.pendingOperations as any, { 
      server_id: serverId,
      status: 'pending'
    });
    
    return dbOps.map(op => this.dbOperationToModel(op));
  }

  /**
   * Update operation status
   */
  async updateOperationStatus(
    operationId: number, 
    status: OperationStatus,
    executedAt?: Date,
    error?: string
  ): Promise<void> {
    const updates: Partial<DatabasePendingOperation> = {
      status
    };
    
    if (executedAt) {
      updates.executed_at = executedAt;
    }
    
    if (error) {
      updates.parameters = JSON.stringify({ error });
    }

    await this.ctx.database.set(TableNames.pendingOperations as any, { id: operationId }, updates);
  }

  /**
   * Optimize operations for same target
   */
  async optimizeOperations(serverId: string): Promise<number> {
    const operations = await this.getPendingOperations(serverId);
    let optimizedCount = 0;

    // Group operations by target
    const operationsByTarget = new Map<string, PendingOperation[]>();
    for (const op of operations) {
      if (!operationsByTarget.has(op.target)) {
        operationsByTarget.set(op.target, []);
      }
      operationsByTarget.get(op.target)!.push(op);
    }

    // Optimize each target's operations
    for (const [target, targetOps] of Array.from(operationsByTarget.entries())) {
      if (targetOps.length < 2) continue;

      // Look for contradictory operations (add/remove pairs)
      const adds = targetOps.filter(op => op.operationType.includes('add'));
      const removes = targetOps.filter(op => op.operationType.includes('remove'));

      // Remove contradictory pairs
      for (const add of adds) {
        const matchingRemove = removes.find(remove => 
          remove.createdAt > add.createdAt &&
          remove.operationType.replace('remove', 'add') === add.operationType
        );
        
        if (matchingRemove) {
          await this.ctx.database.remove(TableNames.pendingOperations as any, { id: add.id });
          await this.ctx.database.remove(TableNames.pendingOperations as any, { id: matchingRemove.id });
          optimizedCount += 2;
        }
      }
    }

    return optimizedCount;
  }

  /**
   * Convert database operation to model
   */
  private dbOperationToModel(dbOp: DatabasePendingOperation): PendingOperation {
    // Safely parse parameters
    let parameters: any = {};
    if (dbOp.parameters) {
      try {
        if (dbOp.parameters.trim()) {
          parameters = JSON.parse(dbOp.parameters);
        }
      } catch (error) {
        console.error(`Failed to parse parameters for operation ${dbOp.id}:`, error);
        parameters = {};
      }
    }

    return {
      id: dbOp.id,
      serverId: dbOp.server_id,
      operationType: dbOp.operation_type,
      target: dbOp.target,
      parameters,
      status: dbOp.status as OperationStatus,
      createdAt: dbOp.created_at,
      scheduledAt: dbOp.scheduled_at,
      executedAt: dbOp.executed_at
    };
  }
}

// ============================================================================
// Database Manager - Main Interface
// ============================================================================

export class DatabaseManager {
  public servers: ServerOperations;
  public acl: ACLOperations;
  public tokens: TokenOperations;
  public audit: AuditOperations;
  public pendingOps: PendingOperationsManager;

  constructor(private ctx: Context) {
    this.servers = new ServerOperations(ctx);
    this.acl = new ACLOperations(ctx);
    this.tokens = new TokenOperations(ctx);
    this.audit = new AuditOperations(ctx);
    this.pendingOps = new PendingOperationsManager(ctx);
  }

  /**
   * Perform database health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic connectivity by querying servers table
      await this.ctx.database.get(TableNames.minecraftServers as any, {}, ['id']);
      return true;
    } catch (error) {
      this.ctx.logger('mochi-link:db').error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    servers: number;
    acls: number;
    tokens: number;
    auditLogs: number;
    pendingOps: number;
  }> {
    const [servers, acls, tokens, auditLogs, pendingOps] = await Promise.all([
      this.ctx.database.get(TableNames.minecraftServers as any, {}, ['id']),
      this.ctx.database.get(TableNames.serverAcl as any, {}, ['id']),
      this.ctx.database.get(TableNames.apiTokens as any, {}, ['id']),
      this.ctx.database.get(TableNames.auditLogs as any, {}, ['id']),
      this.ctx.database.get(TableNames.pendingOperations as any, {}, ['id'])
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
  async performMaintenance(config: {
    auditRetentionDays: number;
    tokenCleanup: boolean;
    aclCleanup: boolean;
  }): Promise<{
    auditLogsRemoved: number;
    tokensRemoved: number;
    aclsRemoved: number;
  }> {
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