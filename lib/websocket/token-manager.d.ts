/**
 * Token Manager Implementation
 *
 * Manages authentication tokens for WebSocket connections using api_tokens table
 */
import { Context } from 'koishi';
import { TokenManager } from './auth';
import { APIToken } from '../types';
export declare class SimpleTokenManager implements TokenManager {
    private ctx;
    private tablePrefix;
    private logger;
    constructor(ctx: Context, tablePrefix?: string);
    /**
     * Validate token for a server
     *
     * Lookup is performed by SHA-256 hash (same as the HTTP path) so the
     * plaintext token column is not required for authentication. A fallback
     * to the legacy plaintext query is kept for rows written by very old
     * versions that lack a token_hash value.
     */
    validateToken(serverId: string, token: string): Promise<APIToken | null>;
    /**
     * Legacy lookup by plaintext token (compatibility only)
     */
    private lookupByPlaintext;
    /**
     * Get token by hash
     */
    getTokenByHash(tokenHash: string): Promise<APIToken | null>;
    /**
     * Convert a raw database row to APIToken format
     */
    private toAPIToken;
    /**
     * Update token last used time
     */
    updateTokenLastUsed(tokenId: number): Promise<void>;
    /**
     * Check if token is expired
     */
    isTokenExpired(token: APIToken): boolean;
    /**
     * Check IP whitelist
     */
    checkIPWhitelist(token: APIToken, clientIP: string): boolean;
}
