/**
 * Token Manager Implementation
 * 
 * Manages authentication tokens for WebSocket connections using api_tokens table
 */

import { Context } from 'koishi';
import { createHash } from 'crypto';
import { TokenManager } from './auth';
import { APIToken } from '../types';
import { buildTableName } from '../database/table-names';

export class SimpleTokenManager implements TokenManager {
  private logger = this.ctx.logger('mochi-link:token-manager');

  constructor(private ctx: Context, private tablePrefix: string = 'mochi') {}

  private table(baseName: string): string {
    return buildTableName(this.tablePrefix, baseName);
  }

  /**
   * Validate token for a server
   *
   * Lookup is performed by SHA-256 hash (same as the HTTP path) so the
   * plaintext token column is not required for authentication. A fallback
   * to the legacy plaintext query is kept for rows written by very old
   * versions that lack a token_hash value.
   */
  async validateToken(serverId: string, token: string): Promise<APIToken | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const tokenData = await this.getTokenByHash(tokenHash);

    if (!tokenData) {
      const legacy = await this.lookupByPlaintext(serverId, token);
      if (legacy) {
        this.logger.warn(
          `Token ${legacy.id} for server ${serverId} has no usable hash; ` +
          'falling back to plaintext lookup. Re-issue the token to fix.'
        );
        return legacy;
      }
      return null;
    }

    // A token must match the server it was issued for
    if (tokenData.serverId !== serverId) {
      return null;
    }

    return tokenData;
  }

  /**
   * Legacy lookup by plaintext token (compatibility only)
   */
  private async lookupByPlaintext(serverId: string, token: string): Promise<APIToken | null> {
    const tokens = await this.ctx.database.get(this.table('api_tokens') as any, {
      server_id: serverId,
      token: token
    });

    if (tokens.length === 0) {
      return null;
    }

    return this.toAPIToken(tokens[0] as any);
  }

  /**
   * Get token by hash
   */
  async getTokenByHash(tokenHash: string): Promise<APIToken | null> {
    const tokens = await this.ctx.database.get(this.table('api_tokens') as any, {
      token_hash: tokenHash
    });

    if (tokens.length === 0) {
      return null;
    }

    return this.toAPIToken(tokens[0] as any);
  }

  /**
   * Convert a raw database row to APIToken format
   */
  private toAPIToken(tokenData: any): APIToken {
    // Safely parse JSON fields
    let ipWhitelist: string[] | undefined;
    if (tokenData.ip_whitelist && typeof tokenData.ip_whitelist === 'string') {
      try {
        if (tokenData.ip_whitelist.trim()) {
          ipWhitelist = JSON.parse(tokenData.ip_whitelist);
        }
      } catch (error) {
        this.logger.error(`Failed to parse ip_whitelist for token ${tokenData.id}:`, error);
      }
    }

    let encryptionConfig: any | undefined;
    if (tokenData.encryption_config && typeof tokenData.encryption_config === 'string') {
      try {
        if (tokenData.encryption_config.trim()) {
          encryptionConfig = JSON.parse(tokenData.encryption_config);
        }
      } catch (error) {
        this.logger.error(`Failed to parse encryption_config for token ${tokenData.id}:`, error);
      }
    }

    return {
      id: tokenData.id,
      serverId: tokenData.server_id,
      token: tokenData.token || '',
      tokenHash: tokenData.token_hash,
      ipWhitelist,
      encryptionConfig,
      createdAt: tokenData.created_at,
      expiresAt: tokenData.expires_at,
      lastUsed: tokenData.last_used
    };
  }

  /**
   * Update token last used time
   */
  async updateTokenLastUsed(tokenId: number): Promise<void> {
    await this.ctx.database.set(this.table('api_tokens') as any, { id: tokenId }, {
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
