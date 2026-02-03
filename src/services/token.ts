/**
 * Mochi-Link (大福连) - API Token Management Service
 * 
 * This file implements the comprehensive API token management system that handles
 * token generation, validation, refresh, IP whitelist management, and encryption configuration.
 */

import { Context } from 'koishi';
import { TokenOperations, AuditOperations } from '../database/operations';
import { APIToken, EncryptionConfig } from '../types';
import * as crypto from 'crypto';

// ============================================================================
// Token Management Types
// ============================================================================

export interface TokenGenerationOptions {
  serverId: string;
  expiresIn?: number; // seconds
  ipWhitelist?: string[];
  encryptionConfig?: EncryptionConfig;
  description?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: APIToken;
  reason?: string;
  ipAllowed?: boolean;
  expired?: boolean;
}

export interface TokenRefreshOptions {
  extendBy?: number; // seconds
  newIpWhitelist?: string[];
  newEncryptionConfig?: EncryptionConfig;
}

export interface TokenStats {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  tokensUsedToday: number;
  tokensCreatedThisMonth: number;
}

// ============================================================================
// Token Manager Class
// ============================================================================

export class TokenManager {
  private tokenOps: TokenOperations;
  private auditOps: AuditOperations;
  private readonly DEFAULT_TOKEN_LENGTH = 64;
  private readonly DEFAULT_EXPIRY_HOURS = 24 * 30; // 30 days

  constructor(private ctx: Context) {
    this.tokenOps = new TokenOperations(ctx);
    this.auditOps = new AuditOperations(ctx);
  }

  // ============================================================================
  // Token Generation
  // ============================================================================

  /**
   * Generate a new API token for a server
   */
  async generateToken(
    options: TokenGenerationOptions,
    createdBy: string
  ): Promise<{ token: APIToken; rawToken: string }> {
    try {
      // Generate secure random token
      const rawToken = this.generateSecureToken();
      const tokenHash = this.hashToken(rawToken);

      // Calculate expiration date
      const expiresAt = options.expiresIn 
        ? new Date(Date.now() + options.expiresIn * 1000)
        : new Date(Date.now() + this.DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);

      // Validate IP whitelist
      if (options.ipWhitelist) {
        this.validateIpWhitelist(options.ipWhitelist);
      }

      // Validate encryption config
      if (options.encryptionConfig) {
        this.validateEncryptionConfig(options.encryptionConfig);
      }

      // Create token in database
      const token = await this.tokenOps.createToken(
        options.serverId,
        rawToken, // Store raw token for initial response only
        tokenHash,
        options.ipWhitelist,
        options.encryptionConfig,
        expiresAt
      );

      // Log token creation
      await this.auditOps.logOperation(
        createdBy,
        options.serverId,
        'token.create',
        { 
          tokenId: token.id,
          expiresAt,
          ipWhitelist: options.ipWhitelist?.length || 0,
          hasEncryption: !!options.encryptionConfig,
          description: options.description
        },
        'success'
      );

      // Clear raw token from database record for security
      const secureToken = { ...token };
      secureToken.token = '[REDACTED]';

      return { token: secureToken, rawToken };

    } catch (error) {
      await this.auditOps.logOperation(
        createdBy,
        options.serverId,
        'token.create',
        { error: (error as Error).message },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Generate multiple tokens for a server (batch operation)
   */
  async generateMultipleTokens(
    serverId: string,
    count: number,
    baseOptions: Omit<TokenGenerationOptions, 'serverId'>,
    createdBy: string
  ): Promise<Array<{ token: APIToken; rawToken: string }>> {
    if (count <= 0 || count > 10) {
      throw new Error('Token count must be between 1 and 10');
    }

    const results = [];
    for (let i = 0; i < count; i++) {
      const options = { ...baseOptions, serverId };
      const result = await this.generateToken(options, createdBy);
      results.push(result);
    }

    return results;
  }

  // ============================================================================
  // Token Validation
  // ============================================================================

  /**
   * Validate an API token
   */
  async validateToken(
    rawToken: string,
    clientIp?: string,
    updateLastUsed: boolean = true
  ): Promise<TokenValidationResult> {
    try {
      const tokenHash = this.hashToken(rawToken);
      const token = await this.tokenOps.getTokenByHash(tokenHash);

      if (!token) {
        return {
          valid: false,
          reason: 'Token not found'
        };
      }

      // Check if token is expired
      if (token.expiresAt && token.expiresAt < new Date()) {
        return {
          valid: false,
          token,
          reason: 'Token expired',
          expired: true
        };
      }

      // Check IP whitelist
      let ipAllowed = true;
      if (token.ipWhitelist && token.ipWhitelist.length > 0 && clientIp) {
        ipAllowed = this.isIpAllowed(clientIp, token.ipWhitelist);
        if (!ipAllowed) {
          return {
            valid: false,
            token,
            reason: 'IP address not in whitelist',
            ipAllowed: false
          };
        }
      }

      // Update last used timestamp
      if (updateLastUsed) {
        await this.tokenOps.updateTokenLastUsed(token.id);
      }

      return {
        valid: true,
        token,
        ipAllowed
      };

    } catch (error) {
      this.ctx.logger('mochi-link:token').error('Token validation failed:', error);
      return {
        valid: false,
        reason: 'Validation error'
      };
    }
  }

  /**
   * Validate token and require specific server access
   */
  async validateTokenForServer(
    rawToken: string,
    serverId: string,
    clientIp?: string
  ): Promise<TokenValidationResult> {
    const result = await this.validateToken(rawToken, clientIp);
    
    if (!result.valid || !result.token) {
      return result;
    }

    if (result.token.serverId !== serverId) {
      return {
        valid: false,
        token: result.token,
        reason: 'Token not valid for this server'
      };
    }

    return result;
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  /**
   * Refresh/extend a token's expiration
   */
  async refreshToken(
    tokenId: number,
    options: TokenRefreshOptions,
    refreshedBy: string
  ): Promise<APIToken> {
    try {
      const existingToken = await this.tokenOps.getTokenById(tokenId);
      if (!existingToken) {
        throw new Error(`Token ${tokenId} not found`);
      }

      // Calculate new expiration
      let newExpiresAt = existingToken.expiresAt;
      if (options.extendBy) {
        const baseTime = newExpiresAt || new Date();
        newExpiresAt = new Date(baseTime.getTime() + options.extendBy * 1000);
      }

      // Update IP whitelist if provided
      const ipWhitelist = options.newIpWhitelist !== undefined 
        ? options.newIpWhitelist 
        : existingToken.ipWhitelist;

      // Update encryption config if provided
      const encryptionConfig = options.newEncryptionConfig !== undefined
        ? options.newEncryptionConfig
        : existingToken.encryptionConfig;

      // Validate new settings
      if (ipWhitelist) {
        this.validateIpWhitelist(ipWhitelist);
      }
      if (encryptionConfig) {
        this.validateEncryptionConfig(encryptionConfig);
      }

      // Create new token with updated settings
      const newRawToken = this.generateSecureToken();
      const newTokenHash = this.hashToken(newRawToken);

      // Delete old token
      await this.tokenOps.deleteToken(tokenId);

      // Create new token
      const refreshedToken = await this.tokenOps.createToken(
        existingToken.serverId,
        '[REDACTED]', // Don't store raw token
        newTokenHash,
        ipWhitelist,
        encryptionConfig,
        newExpiresAt
      );

      // Log token refresh
      await this.auditOps.logOperation(
        refreshedBy,
        existingToken.serverId,
        'token.refresh',
        { 
          oldTokenId: tokenId,
          newTokenId: refreshedToken.id,
          extendedBy: options.extendBy,
          ipWhitelistUpdated: options.newIpWhitelist !== undefined,
          encryptionUpdated: options.newEncryptionConfig !== undefined
        },
        'success'
      );

      return refreshedToken;

    } catch (error) {
      await this.auditOps.logOperation(
        refreshedBy,
        'unknown',
        'token.refresh',
        { tokenId, error: (error as Error).message },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Revoke/delete a token
   */
  async revokeToken(tokenId: number, revokedBy: string): Promise<boolean> {
    try {
      const token = await this.tokenOps.getTokenById(tokenId);
      if (!token) {
        return false;
      }

      const success = await this.tokenOps.deleteToken(tokenId);

      // Log token revocation
      await this.auditOps.logOperation(
        revokedBy,
        token.serverId,
        'token.revoke',
        { tokenId },
        success ? 'success' : 'failure'
      );

      return success;

    } catch (error) {
      await this.auditOps.logOperation(
        revokedBy,
        'unknown',
        'token.revoke',
        { tokenId, error: (error as Error).message },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Revoke all tokens for a server
   */
  async revokeAllServerTokens(serverId: string, revokedBy: string): Promise<number> {
    try {
      const tokens = await this.tokenOps.getServerTokens(serverId);
      let revokedCount = 0;

      for (const token of tokens) {
        const success = await this.tokenOps.deleteToken(token.id);
        if (success) {
          revokedCount++;
        }
      }

      // Log bulk revocation
      await this.auditOps.logOperation(
        revokedBy,
        serverId,
        'token.revoke_all',
        { revokedCount, totalTokens: tokens.length },
        'success'
      );

      return revokedCount;

    } catch (error) {
      await this.auditOps.logOperation(
        revokedBy,
        serverId,
        'token.revoke_all',
        { error: (error as Error).message },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  // ============================================================================
  // Token Information and Statistics
  // ============================================================================

  /**
   * Get all tokens for a server (without raw token values)
   */
  async getServerTokens(serverId: string): Promise<APIToken[]> {
    const tokens = await this.tokenOps.getServerTokens(serverId);
    
    // Redact raw tokens for security
    return tokens.map(token => ({
      ...token,
      token: '[REDACTED]'
    }));
  }

  /**
   * Get token information by ID (without raw token value)
   */
  async getTokenInfo(tokenId: number): Promise<APIToken | null> {
    const token = await this.tokenOps.getTokenById(tokenId);
    
    if (!token) {
      return null;
    }

    return {
      ...token,
      token: '[REDACTED]'
    };
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<TokenStats> {
    // This would require additional database queries
    // For now, we'll implement a basic version
    const allTokens = await this.ctx.database.get('api_tokens', {});
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeTokens = allTokens.filter(token => 
      !token.expires_at || token.expires_at > now
    );

    const expiredTokens = allTokens.filter(token => 
      token.expires_at && token.expires_at <= now
    );

    const tokensUsedToday = allTokens.filter(token => 
      token.last_used && token.last_used >= todayStart
    );

    const tokensCreatedThisMonth = allTokens.filter(token => 
      token.created_at >= monthStart
    );

    return {
      totalTokens: allTokens.length,
      activeTokens: activeTokens.length,
      expiredTokens: expiredTokens.length,
      tokensUsedToday: tokensUsedToday.length,
      tokensCreatedThisMonth: tokensCreatedThisMonth.length
    };
  }

  // ============================================================================
  // IP Whitelist Management
  // ============================================================================

  /**
   * Update IP whitelist for a token
   */
  async updateTokenIpWhitelist(
    tokenId: number,
    ipWhitelist: string[],
    updatedBy: string
  ): Promise<APIToken> {
    try {
      const token = await this.tokenOps.getTokenById(tokenId);
      if (!token) {
        throw new Error(`Token ${tokenId} not found`);
      }

      // Validate IP whitelist
      this.validateIpWhitelist(ipWhitelist);

      // Update token with new IP whitelist
      // Note: This would require adding an update method to TokenOperations
      // For now, we'll refresh the token with new settings
      const refreshed = await this.refreshToken(
        tokenId,
        { newIpWhitelist: ipWhitelist },
        updatedBy
      );

      return refreshed;

    } catch (error) {
      await this.auditOps.logOperation(
        updatedBy,
        'unknown',
        'token.update_ip_whitelist',
        { tokenId, error: (error as Error).message },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Check if IP is allowed by whitelist
   */
  private isIpAllowed(clientIp: string, whitelist: string[]): boolean {
    if (!whitelist || whitelist.length === 0) {
      return true;
    }

    for (const allowedIp of whitelist) {
      if (this.matchIpPattern(clientIp, allowedIp)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match IP against pattern (supports CIDR notation)
   */
  private matchIpPattern(ip: string, pattern: string): boolean {
    // Exact match
    if (ip === pattern) {
      return true;
    }

    // CIDR notation support (basic implementation)
    if (pattern.includes('/')) {
      // This is a simplified CIDR check
      // In production, you'd want to use a proper IP library
      const [network, prefixLength] = pattern.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      // Convert IPs to numbers for comparison (IPv4 only)
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
      
      return (ipNum & mask) === (networkNum & mask);
    }

    return false;
  }

  /**
   * Convert IPv4 address to number
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  // ============================================================================
  // Encryption Configuration
  // ============================================================================

  /**
   * Generate encryption configuration
   */
  generateEncryptionConfig(algorithm: 'AES-256-GCM' | 'RSA-OAEP'): EncryptionConfig {
    switch (algorithm) {
      case 'AES-256-GCM':
        return {
          algorithm,
          key: crypto.randomBytes(32).toString('hex'),
          iv: crypto.randomBytes(16).toString('hex')
        };
      
      case 'RSA-OAEP':
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        
        return {
          algorithm,
          publicKey,
          privateKey
        };
      
      default:
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate a cryptographically secure token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(this.DEFAULT_TOKEN_LENGTH).toString('hex');
  }

  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate IP whitelist format
   */
  private validateIpWhitelist(ipWhitelist: string[]): void {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    
    for (const ip of ipWhitelist) {
      if (!ipv4Regex.test(ip)) {
        throw new Error(`Invalid IP address format: ${ip}`);
      }
      
      // Additional validation for IP ranges
      if (ip.includes('/')) {
        const [, prefixLength] = ip.split('/');
        const prefix = parseInt(prefixLength, 10);
        if (prefix < 0 || prefix > 32) {
          throw new Error(`Invalid CIDR prefix length: ${prefix}`);
        }
      }
    }
  }

  /**
   * Validate encryption configuration
   */
  private validateEncryptionConfig(config: EncryptionConfig): void {
    if (!['AES-256-GCM', 'RSA-OAEP'].includes(config.algorithm)) {
      throw new Error(`Unsupported encryption algorithm: ${config.algorithm}`);
    }

    if (config.algorithm === 'AES-256-GCM') {
      if (!config.key || !config.iv) {
        throw new Error('AES-256-GCM requires key and iv');
      }
      if (config.key.length !== 64) { // 32 bytes = 64 hex chars
        throw new Error('AES-256-GCM key must be 32 bytes (64 hex characters)');
      }
      if (config.iv.length !== 32) { // 16 bytes = 32 hex chars
        throw new Error('AES-256-GCM IV must be 16 bytes (32 hex characters)');
      }
    }

    if (config.algorithm === 'RSA-OAEP') {
      if (!config.publicKey || !config.privateKey) {
        throw new Error('RSA-OAEP requires both public and private keys');
      }
    }
  }

  /**
   * Cleanup expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    return await this.tokenOps.cleanupExpiredTokens();
  }

  /**
   * Get token manager health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      tokenOperational: boolean;
      totalTokens: number;
      expiredTokens: number;
    };
  }> {
    try {
      const stats = await this.getTokenStats();
      
      return {
        status: 'healthy',
        details: {
          tokenOperational: true,
          totalTokens: stats.totalTokens,
          expiredTokens: stats.expiredTokens
        }
      };

    } catch (error) {
      this.ctx.logger('mochi-link:token').error('Token health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          tokenOperational: false,
          totalTokens: 0,
          expiredTokens: 0
        }
      };
    }
  }
}