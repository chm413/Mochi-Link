/**
 * Mochi-Link (����) - Database Operations
 *
 * This file contains the database CRUD operations and business logic
 * for managing servers, permissions, tokens, and audit logs.
 */
import { Context } from 'koishi';
import { ServerConfig, ServerACL, APIToken, AuditLog, PendingOperation, ServerRole, OperationStatus } from '../types';
export declare class ServerOperations {
    private ctx;
    constructor(ctx: Context);
    /**
     * Create a new server configuration
     */
    createServer(config: Omit<ServerConfig, 'createdAt' | 'updatedAt'>): Promise<ServerConfig>;
    /**
     * Get server by ID
     */
    getServer(serverId: string): Promise<ServerConfig | null>;
    /**
     * Get all servers
     */
    getAllServers(): Promise<ServerConfig[]>;
    /**
     * Get servers by owner
     */
    getServersByOwner(ownerId: string): Promise<ServerConfig[]>;
    /**
     * Update server configuration
     */
    updateServer(serverId: string, updates: Partial<ServerConfig>): Promise<ServerConfig>;
    /**
     * Update server status
     */
    updateServerStatus(serverId: string, status: ServerConfig['status'], lastSeen?: Date): Promise<void>;
    /**
     * Delete server
     */
    deleteServer(serverId: string): Promise<boolean>;
    /**
     * Check if server exists
     */
    serverExists(serverId: string): Promise<boolean>;
}
export declare class ACLOperations {
    private ctx;
    constructor(ctx: Context);
    /**
     * Grant permissions to user for server
     */
    grantPermission(userId: string, serverId: string, role: ServerRole, permissions: string[], grantedBy: string, expiresAt?: Date): Promise<ServerACL>;
    /**
     * Get ACL for user and server
     */
    getACL(userId: string, serverId: string): Promise<ServerACL | null>;
    /**
     * Get all ACLs for a server
     */
    getServerACLs(serverId: string): Promise<ServerACL[]>;
    /**
     * Get all ACLs for a user
     */
    getUserACLs(userId: string): Promise<ServerACL[]>;
    /**
     * Check if user has permission
     */
    hasPermission(userId: string, serverId: string, operation: string): Promise<boolean>;
    /**
     * Revoke permissions
     */
    revokePermission(userId: string, serverId: string): Promise<boolean>;
    /**
     * Clean up expired ACLs
     */
    cleanupExpiredACLs(): Promise<number>;
}
export declare class TokenOperations {
    private ctx;
    constructor(ctx: Context);
    /**
     * Create API token for server
     */
    createToken(serverId: string, token: string, tokenHash: string, ipWhitelist?: string[], encryptionConfig?: any, expiresAt?: Date): Promise<APIToken>;
    /**
     * Get token by ID
     */
    getTokenById(tokenId: number): Promise<APIToken | null>;
    /**
     * Get token by hash
     */
    getTokenByHash(tokenHash: string): Promise<APIToken | null>;
    /**
     * Get tokens for server
     */
    getServerTokens(serverId: string): Promise<APIToken[]>;
    /**
     * Update token last used timestamp
     */
    updateTokenLastUsed(tokenId: number): Promise<void>;
    /**
     * Delete token
     */
    deleteToken(tokenId: number): Promise<boolean>;
    /**
     * Clean up expired tokens
     */
    cleanupExpiredTokens(): Promise<number>;
    /**
     * Convert database token to model
     */
    private dbTokenToModel;
}
export declare class AuditOperations {
    private ctx;
    constructor(ctx: Context);
    /**
     * Log an operation
     */
    logOperation(userId: string | undefined, serverId: string | undefined, operation: string, operationData: any, result: 'success' | 'failure' | 'error', errorMessage?: string, ipAddress?: string, userAgent?: string): Promise<AuditLog>;
    /**
     * Get audit log by ID
     */
    getAuditLog(logId: number): Promise<AuditLog | null>;
    /**
     * Get audit logs with filters
     */
    getAuditLogs(filters: {
        userId?: string;
        serverId?: string;
        operation?: string;
        result?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<AuditLog[]>;
    /**
     * Clean up old audit logs
     */
    cleanupOldLogs(retentionDays: number): Promise<number>;
}
export declare class PendingOperationsManager {
    private ctx;
    constructor(ctx: Context);
    /**
     * Add pending operation
     */
    addOperation(serverId: string, operationType: string, target: string, parameters: any, scheduledAt?: Date): Promise<PendingOperation>;
    /**
     * Get operation by ID
     */
    getOperation(operationId: number): Promise<PendingOperation | null>;
    /**
     * Get pending operations for server
     */
    getPendingOperations(serverId: string): Promise<PendingOperation[]>;
    /**
     * Update operation status
     */
    updateOperationStatus(operationId: number, status: OperationStatus, executedAt?: Date, error?: string): Promise<void>;
    /**
     * Optimize operations for same target
     */
    optimizeOperations(serverId: string): Promise<number>;
    /**
     * Convert database operation to model
     */
    private dbOperationToModel;
}
export declare class DatabaseManager {
    private ctx;
    servers: ServerOperations;
    acl: ACLOperations;
    tokens: TokenOperations;
    audit: AuditOperations;
    pendingOps: PendingOperationsManager;
    constructor(ctx: Context);
    /**
     * 修复问题 #7: 创建服务器并生成令牌（事务包装）
     * 确保服务器创建和令牌生成是原子操作
     */
    createServerWithToken(serverConfig: Omit<ServerConfig, 'createdAt' | 'updatedAt'>, token: string, tokenHash: string, ipWhitelist?: string[], encryptionConfig?: any, expiresAt?: Date): Promise<{
        server: ServerConfig;
        token: APIToken;
    }>;
    /**
     * 修复问题 #7: 授予权限并记录审计日志（事务包装）
     * 确保权限授予和审计日志记录是原子操作
     */
    grantPermissionWithAudit(userId: string, serverId: string, role: ServerRole, permissions: string[], grantedBy: string, auditContext?: {
        ipAddress?: string;
        userAgent?: string;
    }, expiresAt?: Date): Promise<ServerACL>;
    /**
     * 修复问题 #7: 撤销权限并记录审计日志（事务包装）
     */
    revokePermissionWithAudit(userId: string, serverId: string, revokedBy: string, auditContext?: {
        ipAddress?: string;
        userAgent?: string;
    }): Promise<boolean>;
    /**
     * 修复问题 #7: 删除服务器及其所有关联数据（事务包装）
     * 确保服务器、令牌、ACL、绑定等都被正确删除
     */
    deleteServerWithRelations(serverId: string): Promise<{
        serverDeleted: boolean;
        tokensDeleted: number;
        aclsDeleted: number;
        bindingsDeleted: number;
    }>;
    /**
     * Perform database health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get database statistics
     */
    getStatistics(): Promise<{
        servers: number;
        acls: number;
        tokens: number;
        auditLogs: number;
        pendingOps: number;
    }>;
    /**
     * Perform maintenance tasks
     */
    performMaintenance(config: {
        auditRetentionDays: number;
        tokenCleanup: boolean;
        aclCleanup: boolean;
    }): Promise<{
        auditLogsRemoved: number;
        tokensRemoved: number;
        aclsRemoved: number;
    }>;
}
