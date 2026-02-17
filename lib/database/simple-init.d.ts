/**
 * Mochi-Link (大福连) - Simple Database Initialization
 *
 * Simplified database initialization for basic mode
 */
import { Context } from 'koishi';
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
export interface APIToken {
    id: number;
    server_id: string;
    token: string;
    token_hash: string;
    ip_whitelist?: string;
    encryption_config?: string;
    created_at: Date;
    expires_at?: Date;
    last_used?: Date;
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
declare module 'koishi' {
    interface Tables {
        'mochi.servers': MinecraftServer;
        'mochi.server_acl': ServerACL;
        'mochi.api_tokens': APIToken;
        'mochi.audit_logs': AuditLog;
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
}
