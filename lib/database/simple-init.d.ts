/**
 * Mochi-Link (大福连) - Simple Database Initialization
 *
 * Simplified database initialization for basic mode
 */
import { Context } from 'koishi';
import { APIToken } from '../types';
export interface MinecraftServer {
    id: string;
    name: string;
    core_type: 'java' | 'bedrock';
    core_name: string;
    core_version?: string;
    connection_mode: 'forward' | 'reverse';
    connection_config: string;
    status: 'online' | 'offline' | 'error';
    owner_id?: string;
    tags?: string;
    created_at: Date;
    updated_at: Date;
    last_seen?: Date;
}
export interface ServerACL {
    id: number;
    user_id: string;
    server_id: string;
    role: 'owner' | 'admin' | 'operator' | 'viewer';
    permissions: string;
    granted_by: string;
    granted_at: Date;
    expires_at?: Date;
}
export interface AuditLog {
    id: number;
    user_id?: string;
    server_id?: string;
    operation: string;
    operation_data?: string;
    result: 'success' | 'failure';
    error_message?: string;
    ip_address?: string;
    user_agent?: string;
    timestamp: Date;
}
export interface GroupBinding {
    id: number;
    group_id: string;
    server_id: string;
    binding_type: 'full' | 'monitor' | 'command';
    config: string;
    created_by: string;
    created_at: Date;
    updated_at: Date;
    status: 'active' | 'inactive';
}
export interface PendingOperation {
    id: number;
    server_id: string;
    operation_type: string;
    target: string;
    parameters: string;
    status: 'pending' | 'completed' | 'failed';
    created_at: Date;
    updated_at?: Date;
}
export interface PlayerCache {
    id: number;
    uuid?: string;
    xuid?: string;
    name: string;
    last_server_id: string;
    last_seen: Date;
    created_at: Date;
    updated_at: Date;
}
export interface ServerBinding {
    id: number;
    group_id: string;
    server_id: string;
    binding_type: 'chat' | 'event' | 'command' | 'monitoring';
    config: string;
    created_at: Date;
}
declare module 'koishi' {
    interface Tables {
        'mochi_servers': MinecraftServer;
        'mochi_server_acl': ServerACL;
        'mochi_api_tokens': APIToken;
        'mochi_audit_logs': AuditLog;
        'mochi_group_bindings': GroupBinding;
        'mochi_pending_operations': PendingOperation;
        'mochi_player_cache': PlayerCache;
        'mochi_server_bindings': ServerBinding;
    }
}
export declare class SimpleDatabaseManager {
    private ctx;
    private tablePrefix;
    constructor(ctx: Context, tablePrefix?: string);
    /**
     * Initialize database tables
     */
    initialize(): Promise<void>;
    /**
     * Create a new server
     */
    createServer(server: Omit<MinecraftServer, 'created_at' | 'updated_at'>): Promise<MinecraftServer>;
    /**
     * Get server by ID
     */
    getServer(id: string): Promise<MinecraftServer | null>;
    /**
     * List all servers
     */
    listServers(): Promise<MinecraftServer[]>;
    /**
     * Update server
     */
    updateServer(id: string, updates: Partial<MinecraftServer>): Promise<void>;
    /**
     * Delete server
     */
    deleteServer(id: string): Promise<void>;
    /**
     * Create audit log
     */
    createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void>;
    /**
     * Get recent audit logs
     */
    getAuditLogs(limit?: number): Promise<AuditLog[]>;
    /**
     * Create group binding
     */
    createGroupBinding(binding: Omit<GroupBinding, 'id' | 'created_at' | 'updated_at'>): Promise<GroupBinding>;
    /**
     * Get group bindings by group ID
     */
    getGroupBindings(groupId: string): Promise<GroupBinding[]>;
    /**
     * Get primary server for a group
     */
    getGroupPrimaryServer(groupId: string): Promise<string | null>;
    /**
     * Delete group binding
     */
    deleteGroupBinding(id: number): Promise<void>;
    /**
     * Get all bindings for a server
     */
    getServerBindings(serverId: string): Promise<GroupBinding[]>;
    /**
     * Create API token for a server
     */
    createAPIToken(serverId: string, token: string, tokenHash: string, options?: {
        ipWhitelist?: string[];
        encryptionConfig?: any;
        expiresAt?: Date;
    }): Promise<APIToken>;
    /**
     * Get API tokens for a server
     */
    getAPITokens(serverId: string): Promise<APIToken[]>;
    /**
     * Delete API token
     */
    deleteAPIToken(tokenId: number): Promise<void>;
    /**
     * Delete all API tokens for a server
     */
    deleteServerAPITokens(serverId: string): Promise<void>;
}
