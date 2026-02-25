/**
 * Token Manager Implementation
 * 
 * Manages authentication tokens for WebSocket connections using api_tokens table
 */

import { Context } from 'koishi';
import { createHash } from 'crypto';
import { TokenManager } from './auth';
import { APIToken } from '../types';

export class SimpleTokenManager implements TokenManager {
  constructor(private ctx: Context, private tablePrefix: string = 'mochi') {}

  /**
   * Validate token for a server
   */
  async validateToken(serverId: string, token: string): Promise<APIToken | null> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    
    // Query api_tokens table by server_id and token
    const tokens = await this.ctx.database.get(`${prefix}api_tokens` as any, { 
      server_id: serverId,
      token: token
    });
    
    if (tokens.length === 0) {
      return null;
    }
    
    const tokenData = tokens[0] as any;
    
    // Convert to APIToken format
    return {
      id: tokenData.id,
      serverId: tokenData.server_id,
      token: tokenData.token,
      tokenHash: tokenData.token_hash,
      ipWhitelist: tokenData.ip_whitelist ? JSON.parse(tokenData.ip_whitelist) : undefined,
      encryptionConfig: tokenData.encryption_config ? JSON.parse(tokenData.encryption_config) : undefined,
      createdAt: tokenData.created_at,
      expiresAt: tokenData.expires_at,
      lastUsed: tokenData.last_used
    };
  }

  /**
   * Get token by hash
   */
  async getTokenByHash(tokenHash: string): Promise<APIToken | null> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    
    const tokens = await this.ctx.database.get(`${prefix}api_tokens` as any, { 
      token_hash: tokenHash
    });
    
    if (tokens.length === 0) {
      return null;
    }
    
    const tokenData = tokens[0] as any;
    
    return {
      id: tokenData.id,
      serverId: tokenData.server_id,
      token: tokenData.token,
      tokenHash: tokenData.token_hash,
      ipWhitelist: tokenData.ip_whitelist ? JSON.parse(tokenData.ip_whitelist) : undefined,
      encryptionConfig: tokenData.encryption_config ? JSON.parse(tokenData.encryption_config) : undefined,
      createdAt: tokenData.created_at,
      expiresAt: tokenData.expires_at,
      lastUsed: tokenData.last_used
    };
  }

  /**
   * Update token last used time
   */
  async updateTokenLastUsed(tokenId: number): Promise<void> {
    const prefix = this.tablePrefix.replace(/\.$/, '_');
    
    await this.ctx.database.set(`${prefix}api_tokens` as any, { id: tokenId }, {
      last_used: new Date()
    });
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: APIToken): boolean {
    if (!token.expiresAt) {
      return false;
    }
    
    return new Date() > new Date(token.expiresAt);
  }

  /**
   * Check IP whitelist
   */
  checkIPWhitelist(token: APIToken, clientIP: string): boolean {
    if (!token.ipWhitelist || token.ipWhitelist.length === 0) {
      return true; // No whitelist means all IPs allowed
    }
    
    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    const normalizedIP = clientIP.replace(/^::ffff:/, '');
    
    return token.ipWhitelist.includes(normalizedIP);
  }
}
