/**
 * Mochi-Link (大福连) - API Token Management Service
 *
 * This file implements the comprehensive API token management system that handles
 * token generation, validation, refresh, IP whitelist management, and encryption configuration.
 */
import { Context } from 'koishi';
import { APIToken, EncryptionConfig } from '../types';
export interface TokenGenerationOptions {
    serverId: string;
    expiresIn?: number;
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
    extendBy?: number;
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
export declare class TokenManager {
    private ctx;
    private tokenOps;
    private auditOps;
    private readonly DEFAULT_TOKEN_LENGTH;
    private readonly DEFAULT_EXPIRY_HOURS;
    constructor(ctx: Context);
    /**
     * Generate a new API token for a server
     */
    generateToken(options: TokenGenerationOptions, createdBy: string): Promise<{
        token: APIToken;
        rawToken: string;
    }>;
    /**
     * Generate multiple tokens for a server (batch operation)
     */
    generateMultipleTokens(serverId: string, count: number, baseOptions: Omit<TokenGenerationOptions, 'serverId'>, createdBy: string): Promise<Array<{
        token: APIToken;
        rawToken: string;
    }>>;
    /**
     * Validate an API token
     */
    validateToken(rawToken: string, clientIp?: string, updateLastUsed?: boolean): Promise<TokenValidationResult>;
    /**
     * Validate token and require specific server access
     */
    validateTokenForServer(rawToken: string, serverId: string, clientIp?: string): Promise<TokenValidationResult>;
    /**
     * Refresh/extend a token's expiration
     */
    refreshToken(tokenId: number, options: TokenRefreshOptions, refreshedBy: string): Promise<APIToken>;
    /**
     * Revoke/delete a token
     */
    revokeToken(tokenId: number, revokedBy: string): Promise<boolean>;
    /**
     * Revoke all tokens for a server
     */
    revokeAllServerTokens(serverId: string, revokedBy: string): Promise<number>;
    /**
     * Get all tokens for a server (without raw token values)
     */
    getServerTokens(serverId: string): Promise<APIToken[]>;
    /**
     * Get token information by ID (without raw token value)
     */
    getTokenInfo(tokenId: number): Promise<APIToken | null>;
    /**
     * Get token statistics
     */
    getTokenStats(): Promise<TokenStats>;
    /**
     * Update IP whitelist for a token
     */
    updateTokenIpWhitelist(tokenId: number, ipWhitelist: string[], updatedBy: string): Promise<APIToken>;
    /**
     * Check if IP is allowed by whitelist
     */
    private isIpAllowed;
    /**
     * Match IP against pattern (supports CIDR notation)
     */
    private matchIpPattern;
    /**
     * Convert IPv4 address to number
     */
    private ipToNumber;
    /**
     * Generate encryption configuration
     */
    generateEncryptionConfig(algorithm: 'AES-256-GCM' | 'RSA-OAEP'): EncryptionConfig;
    /**
     * Generate a cryptographically secure token
     */
    private generateSecureToken;
    /**
     * Hash a token for secure storage
     */
    private hashToken;
    /**
     * Validate IP whitelist format
     */
    private validateIpWhitelist;
    /**
     * Validate encryption configuration
     */
    private validateEncryptionConfig;
    /**
     * Cleanup expired tokens
     */
    cleanupExpiredTokens(): Promise<number>;
    /**
     * Get token manager health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: {
            tokenOperational: boolean;
            totalTokens: number;
            expiredTokens: number;
        };
    }>;
}
