/**
 * Mochi-Link (大福连) - Simple Database Initialization
 * 
 * Simplified database initialization for basic mode
 */

import { Context } from 'koishi';
import { APIToken } from '../types';

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

export interface GroupBinding {
  id: number;
  group_id: string;
  server_id: string;
  binding_type: 'full' | 'monitor' | 'command';
  config: string; // JSON string
  created_by: string;
  created_at: Date;
  updated_at: Date;
  status: 'active' | 'inactive';
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
    'mochi_group_bindings': GroupBinding;
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

    // Group Bindings Table
    ctx.model.extend(`${prefix}group_bindings` as any, {
      id: 'unsigned',
      group_id: 'string',
      server_id: 'string',
      binding_type: { type: 'string', initial: 'full' },
      config: 'text',
      created_by: 'string',
      created_at: 'timestamp',
      updated_at: 'timestamp',
      status: { type: 'string', initial: 'active' }
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

  /**
   * Create group binding
   */
  async createGroupBinding(binding: Omit<GroupBinding, 'id' | 'created_at' | 'updated_at'>): Promise<GroupBinding> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const now = new Date();
    const newBinding: any = {
      ...binding,
      created_at: now,
      updated_at: now
    };
    
    const result = await this.ctx.database.create(`${prefix}group_bindings` as any, newBinding);
    return { ...newBinding, id: result.id } as GroupBinding;
  }

  /**
   * Get group bindings by group ID
   */
  async getGroupBindings(groupId: string): Promise<GroupBinding[]> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const bindings = await this.ctx.database.get(`${prefix}group_bindings` as any, { 
      group_id: groupId,
      status: 'active'
    });
    return bindings as any;
  }

  /**
   * Get primary server for a group
   */
  async getGroupPrimaryServer(groupId: string): Promise<string | null> {
    const bindings = await this.getGroupBindings(groupId);
    if (bindings.length === 0) return null;
    
    // Return the first active binding's server
    return bindings[0].server_id;
  }

  /**
   * Delete group binding
   */
  async deleteGroupBinding(id: number): Promise<void> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    await this.ctx.database.remove(`${prefix}group_bindings` as any, { id });
  }

  /**
   * Get all bindings for a server
   */
  async getServerBindings(serverId: string): Promise<GroupBinding[]> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const bindings = await this.ctx.database.get(`${prefix}group_bindings` as any, { 
      server_id: serverId,
      status: 'active'
    });
    return bindings as any;
  }

  /**
   * Create API token for a server
   */
  async createAPIToken(serverId: string, token: string, tokenHash: string, options?: {
    ipWhitelist?: string[];
    encryptionConfig?: any;
    expiresAt?: Date;
  }): Promise<APIToken> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const now = new Date();
    
    const tokenData: any = {
      server_id: serverId,
      token: token,
      token_hash: tokenHash,
      ip_whitelist: options?.ipWhitelist ? JSON.stringify(options.ipWhitelist) : null,
      encryption_config: options?.encryptionConfig ? JSON.stringify(options.encryptionConfig) : null,
      created_at: now,
      expires_at: options?.expiresAt || null,
      last_used: null
    };
    
    const result = await this.ctx.database.create(`${prefix}api_tokens` as any, tokenData);
    
    return {
      id: result.id,
      serverId: serverId,
      token: token,
      tokenHash: tokenHash,
      ipWhitelist: options?.ipWhitelist,
      encryptionConfig: options?.encryptionConfig,
      createdAt: now,
      expiresAt: options?.expiresAt,
      lastUsed: undefined
    };
  }

  /**
   * Get API tokens for a server
   */
  async getAPITokens(serverId: string): Promise<APIToken[]> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    const tokens = await this.ctx.database.get(`${prefix}api_tokens` as any, { 
      server_id: serverId
    });
    
    return tokens.map((t: any) => ({
      id: t.id,
      serverId: t.server_id,
      token: t.token,
      tokenHash: t.token_hash,
      ipWhitelist: t.ip_whitelist ? JSON.parse(t.ip_whitelist) : undefined,
      encryptionConfig: t.encryption_config ? JSON.parse(t.encryption_config) : undefined,
      createdAt: t.created_at,
      expiresAt: t.expires_at,
      lastUsed: t.last_used
    })) as APIToken[];
  }

  /**
   * Delete API token
   */
  async deleteAPIToken(tokenId: number): Promise<void> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    await this.ctx.database.remove(`${prefix}api_tokens` as any, { id: tokenId });
  }

  /**
   * Delete all API tokens for a server
   */
  async deleteServerAPITokens(serverId: string): Promise<void> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    await this.ctx.database.remove(`${prefix}api_tokens` as any, { server_id: serverId });
  }
}
