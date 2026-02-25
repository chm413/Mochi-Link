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
    constructor(ctx: Context, tablePrefix?: string);
    /**
     * Validate token for a server
     */
    validateToken(serverId: string, token: string): Promise<APIToken | null>;
    /**
     * Get token by hash
     */
    getTokenByHash(tokenHash: string): Promise<APIToken | null>;
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
