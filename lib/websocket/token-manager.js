"use strict";
/**
 * Token Manager Implementation
 *
 * Manages authentication tokens for WebSocket connections using api_tokens table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleTokenManager = void 0;
class SimpleTokenManager {
    constructor(ctx, tablePrefix = 'mochi') {
        this.ctx = ctx;
        this.tablePrefix = tablePrefix;
    }
    /**
     * Validate token for a server
     */
    async validateToken(serverId, token) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        // Query api_tokens table by server_id and token
        const tokens = await this.ctx.database.get(`${prefix}api_tokens`, {
            server_id: serverId,
            token: token
        });
        if (tokens.length === 0) {
            return null;
        }
        const tokenData = tokens[0];
        // Safely parse JSON fields
        let ipWhitelist;
        if (tokenData.ip_whitelist && typeof tokenData.ip_whitelist === 'string') {
            try {
                if (tokenData.ip_whitelist.trim()) {
                    ipWhitelist = JSON.parse(tokenData.ip_whitelist);
                }
            }
            catch (error) {
                console.error(`Failed to parse ip_whitelist for token ${tokenData.id}:`, error);
            }
        }
        let encryptionConfig;
        if (tokenData.encryption_config && typeof tokenData.encryption_config === 'string') {
            try {
                if (tokenData.encryption_config.trim()) {
                    encryptionConfig = JSON.parse(tokenData.encryption_config);
                }
            }
            catch (error) {
                console.error(`Failed to parse encryption_config for token ${tokenData.id}:`, error);
            }
        }
        // Convert to APIToken format
        return {
            id: tokenData.id,
            serverId: tokenData.server_id,
            token: tokenData.token,
            tokenHash: tokenData.token_hash,
            ipWhitelist,
            encryptionConfig,
            createdAt: tokenData.created_at,
            expiresAt: tokenData.expires_at,
            lastUsed: tokenData.last_used
        };
    }
    /**
     * Get token by hash
     */
    async getTokenByHash(tokenHash) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        const tokens = await this.ctx.database.get(`${prefix}api_tokens`, {
            token_hash: tokenHash
        });
        if (tokens.length === 0) {
            return null;
        }
        const tokenData = tokens[0];
        // Safely parse JSON fields
        let ipWhitelist;
        if (tokenData.ip_whitelist && typeof tokenData.ip_whitelist === 'string') {
            try {
                if (tokenData.ip_whitelist.trim()) {
                    ipWhitelist = JSON.parse(tokenData.ip_whitelist);
                }
            }
            catch (error) {
                console.error(`Failed to parse ip_whitelist for token ${tokenData.id}:`, error);
            }
        }
        let encryptionConfig;
        if (tokenData.encryption_config && typeof tokenData.encryption_config === 'string') {
            try {
                if (tokenData.encryption_config.trim()) {
                    encryptionConfig = JSON.parse(tokenData.encryption_config);
                }
            }
            catch (error) {
                console.error(`Failed to parse encryption_config for token ${tokenData.id}:`, error);
            }
        }
        return {
            id: tokenData.id,
            serverId: tokenData.server_id,
            token: tokenData.token,
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
    async updateTokenLastUsed(tokenId) {
        const prefix = this.tablePrefix.replace(/\.$/, '_');
        await this.ctx.database.set(`${prefix}api_tokens`, { id: tokenId }, {
            last_used: new Date()
        });
    }
    /**
     * Check if token is expired
     */
    isTokenExpired(token) {
        if (!token.expiresAt) {
            return false;
        }
        return new Date() > new Date(token.expiresAt);
    }
    /**
     * Check IP whitelist
     */
    checkIPWhitelist(token, clientIP) {
        if (!token.ipWhitelist || token.ipWhitelist.length === 0) {
            return true; // No whitelist means all IPs allowed
        }
        // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
        const normalizedIP = clientIP.replace(/^::ffff:/, '');
        return token.ipWhitelist.includes(normalizedIP);
    }
}
exports.SimpleTokenManager = SimpleTokenManager;
