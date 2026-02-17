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
    'mochi.servers': MinecraftServer;
    'mochi.server_acl': ServerACL;
    'mochi.api_tokens': APIToken;
    'mochi.audit_logs': AuditLog;
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
  async createServer(server: Omit<MinecraftServer, 'created_at' | 'updated_at'>): Promise<MinecraftServer> {
    const now = new Date();
    const newServer: MinecraftServer = {
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
  async getServer(id: string): Promise<MinecraftServer | null> {
    const servers = await this.ctx.database.get(`${this.tablePrefix}.servers`, { id });
    return servers[0] || null;
  }

  /**
   * List all servers
   */
  async listServers(): Promise<MinecraftServer[]> {
    return await this.ctx.database.get(`${this.tablePrefix}.servers`, {});
  }

  /**
   * Update server
   */
  async updateServer(id: string, updates: Partial<MinecraftServer>): Promise<void> {
    await this.ctx.database.set(`${this.tablePrefix}.servers`, { id }, {
      ...updates,
      updated_at: new Date()
    });
  }

  /**
   * Delete server
   */
  async deleteServer(id: string): Promise<void> {
    await this.ctx.database.remove(`${this.tablePrefix}.servers`, { id });
  }

  /**
   * Create audit log
   */
  async createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    await this.ctx.database.create(`${this.tablePrefix}.audit_logs`, {
      ...log,
      timestamp: new Date()
    });
  }

  /**
   * Get recent audit logs
   */
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    const logs = await this.ctx.database.get(`${this.tablePrefix}.audit_logs`, {});
    return logs.slice(-limit);
  }
}
