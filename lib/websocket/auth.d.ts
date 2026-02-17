/**
 * WebSocket Authentication Manager
 *
 * Handles authentication and authorization for WebSocket connections,
 * including token validation, challenge-response authentication,
 * and connection security.
 */
import { EventEmitter } from 'events';
import { APIToken, UWBPSystemMessage } from '../types';
export interface AuthenticationChallenge {
    challenge: string;
    timestamp: number;
    serverId: string;
    expiresAt: number;
}
export interface AuthenticationResponse {
    serverId: string;
    token: string;
    challengeResponse: string;
    timestamp: number;
}
export interface AuthenticationResult {
    success: boolean;
    serverId: string;
    token?: APIToken;
    error?: string;
    capabilities?: string[];
}
export interface TokenManager {
    validateToken(serverId: string, token: string): Promise<APIToken | null>;
    getTokenByHash(tokenHash: string): Promise<APIToken | null>;
    updateTokenLastUsed(tokenId: number): Promise<void>;
    isTokenExpired(token: APIToken): boolean;
    checkIPWhitelist(token: APIToken, clientIP: string): boolean;
}
export declare class AuthenticationManager extends EventEmitter {
    private tokenManager;
    private activeChallenges;
    private challengeCleanupInterval;
    private readonly challengeTimeout;
    private readonly challengeLength;
    private readonly maxChallengesPerServer;
    constructor(tokenManager: TokenManager);
    /**
     * Generate authentication challenge for a server
     */
    generateChallenge(serverId: string): Promise<string>;
    /**
     * Validate authentication response
     */
    validateAuthenticationResponse(response: AuthenticationResponse, clientIP?: string): Promise<AuthenticationResult>;
    /**
     * Authenticate using token only (for simple authentication)
     */
    authenticateWithToken(serverId: string, token: string, clientIP?: string): Promise<AuthenticationResult>;
    /**
     * Handle authentication message
     */
    handleAuthenticationMessage(message: UWBPSystemMessage, clientIP?: string): Promise<UWBPSystemMessage | null>;
    /**
     * Generate challenge response
     */
    private generateChallengeResponse;
    /**
     * Get capabilities for a token
     */
    private getTokenCapabilities;
    /**
     * Create authentication success response
     */
    private createAuthSuccessResponse;
    /**
     * Create authentication error response
     */
    private createAuthErrorResponse;
    /**
     * Clean up expired challenges
     */
    private cleanupExpiredChallenges;
    /**
     * Clean up challenges for specific server
     */
    private cleanupChallengesForServer;
    /**
     * Get authentication statistics
     */
    getStats(): {
        activeChallenges: number;
        challengesByServer: Record<string, number>;
    };
    /**
     * Shutdown authentication manager
     */
    shutdown(): void;
}
