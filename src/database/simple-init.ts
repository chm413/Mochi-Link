/**
 * Mochi-Link (大福连) - Simple Database Initialization
 * 
 * Simplified database initialization for basic mode
 */

import { Context } from 'koishi';

// ============================================================================
// Database Types
// ============================================================================

export interface MinecraftServer {
  id: string;
  name: string;
  core_type: 'java' | 'bedrock';
  core_name: string;
  core_version?: string;
  connection_mode: 'forward' | 'reverse';
  connection_config: string; // JSON string
  status: 'online' | 'offline' | 'error';
  owner_id?: string;
  tags?: string; // JSON array string
  created_at: Date;
  updated_at: Date;
  last_seen?: Date;
}

export interface ServerACL {
  id: number;
  user_id: string;
  server_id: string;
  role: 'owner' | 'admin' | 'operator' | 'viewer';
  permissions: string; // JSON array string
  granted_by: string;
  granted_at: Date;
  expires_at?: Date;
}

export interface APIToken {
  id: number;
  server_id: string;
  token: string;
  token_hash: string;
  ip_whitelist?: string; // JSON array string
  encryption_config?: string; // JSON string
  created_at: Date;
  expires_at?: Date;
  last_used?: Date;
}

export interface AuditLog {
  id: number;
  user_id?: string;
  server_id?: string;
  operation: string;
  operation_data?: string; // JSON string
  result: 'success' | 'failure';
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

// ============================================================================
// Extend Koishi Tables
// ============================================================================

declare module 'koishi' {
  interface Tables {
    'mochi_servers': MinecraftServer;
    'mochi_server_acl': ServerACL;
    'mochi_api_tokens': APIToken;
    'mochi_audit_logs': AuditLog;
  }
}

// ============================================================================
// Database Initialization
// ============================================================================

export class SimpleDatabaseManager {
  constructor(private ctx: Context, private tablePrefix: string = 'mochi') {}

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    const ctx = this.ctx;
    const prefix = this.tablePrefix.replace(/\.$/, '_'); // Replace . with _

    // Minecraft Servers Table
    ctx.model.extend(`${prefix}servers` as any, {
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
    ctx.model.extend(`${prefix}server_acl` as any, {
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
    ctx.model.extend(`${prefix}api_tokens` as any, {
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
    ctx.model.extend(`${prefix}audit_logs` as any, {
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
  async createServer(server: Omit<MinecraftServer, 'created_at' | 'updated_at'>): Promise<MinecraftServer> {
    const now = new Date();
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const newServer: MinecraftServer = {
      ...server,
      created_at: now,
      updated_at: now
    };

    await this.ctx.database.create(`${prefix}servers` as any, newServer);
    return newServer;
  }

  /**
   * Get server by ID
   */
  async getServer(id: string): Promise<MinecraftServer | null> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const servers = await this.ctx.database.get(`${prefix}servers` as any, { id });
    return (servers[0] as any) || null;
  }

  /**
   * List all servers
   */
  async listServers(): Promise<MinecraftServer[]> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    return await this.ctx.database.get(`${prefix}servers` as any, {}) as any;
  }

  /**
   * Update server
   */
  async updateServer(id: string, updates: Partial<MinecraftServer>): Promise<void> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    await this.ctx.database.set(`${prefix}servers` as any, { id }, {
      ...updates,
      updated_at: new Date()
    });
  }

  /**
   * Delete server
   */
  async deleteServer(id: string): Promise<void> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    await this.ctx.database.remove(`${prefix}servers` as any, { id });
  }

  /**
   * Create audit log
   */
  async createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    await this.ctx.database.create(`${prefix}audit_logs` as any, {
      ...log,
      timestamp: new Date()
    });
  }

  /**
   * Get recent audit logs
   */
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const logs = await this.ctx.database.get(`${prefix}audit_logs` as any, {});
    return logs.slice(-limit) as any;
  }
}
