/**
 * WebSocket Authentication Manager
 * 
 * Handles authentication and authorization for WebSocket connections,
 * including token validation, challenge-response authentication,
 * and connection security.
 */

import { createHash, randomBytes, createHmac } from 'crypto';
import { EventEmitter } from 'events';
import { 
  APIToken, 
  AuthenticationError, 
  ProtocolError,
  UWBPMessage,
  UWBPSystemMessage 
} from '../types';

// ============================================================================
// Authentication Types
// ============================================================================

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

// ============================================================================
// Token Management Interface
// ============================================================================

export interface TokenManager {
  validateToken(serverId: string, token: string): Promise<APIToken | null>;
  getTokenByHash(tokenHash: string): Promise<APIToken | null>;
  updateTokenLastUsed(tokenId: number): Promise<void>;
  isTokenExpired(token: APIToken): boolean;
  checkIPWhitelist(token: APIToken, clientIP: string): boolean;
}

// ============================================================================
// Authentication Manager
// ============================================================================

export class AuthenticationManager extends EventEmitter {
  private tokenManager: TokenManager;
  private activeChallenges = new Map<string, AuthenticationChallenge>();
  private challengeCleanupInterval: NodeJS.Timeout;
  
  // Configuration
  private readonly challengeTimeout = 30000; // 30 seconds
  private readonly challengeLength = 32; // bytes
  private readonly maxChallengesPerServer = 5;

  constructor(tokenManager: TokenManager) {
    super();
    this.tokenManager = tokenManager;
    
    // Clean up expired challenges every minute
    this.challengeCleanupInterval = setInterval(() => {
      this.cleanupExpiredChallenges();
    }, 60000);
  }

  // ============================================================================
  // Challenge Generation and Validation
  // ============================================================================

  /**
   * Generate authentication challenge for a server
   */
  async generateChallenge(serverId: string): Promise<string> {
    // Clean up old challenges for this server
    this.cleanupChallengesForServer(serverId);
    
    // Check challenge limit
    const existingChallenges = Array.from(this.activeChallenges.values())
      .filter(c => c.serverId === serverId);
    
    if (existingChallenges.length >= this.maxChallengesPerServer) {
      throw new AuthenticationError(
        'Too many pending authentication challenges',
        serverId
      );
    }

    // Generate challenge
    const challenge = randomBytes(this.challengeLength).toString('hex');
    const timestamp = Date.now();
    const expiresAt = timestamp + this.challengeTimeout;

    const challengeData: AuthenticationChallenge = {
      challenge,
      timestamp,
      serverId,
      expiresAt
    };

    this.activeChallenges.set(challenge, challengeData);
    
    this.emit('challengeGenerated', serverId, challenge);
    
    return challenge;
  }

  /**
   * Validate authentication response
   */
  async validateAuthenticationResponse(
    response: AuthenticationResponse,
    clientIP?: string
  ): Promise<AuthenticationResult> {
    try {
      // Find and validate challenge
      const challenge = this.activeChallenges.get(response.challengeResponse);
      if (!challenge) {
        return {
          success: false,
          serverId: response.serverId,
          error: 'Invalid or expired challenge'
        };
      }

      // Check challenge expiry
      if (Date.now() > challenge.expiresAt) {
        this.activeChallenges.delete(response.challengeResponse);
        return {
          success: false,
          serverId: response.serverId,
          error: 'Challenge expired'
        };
      }

      // Verify server ID matches
      if (challenge.serverId !== response.serverId) {
        return {
          success: false,
          serverId: response.serverId,
          error: 'Server ID mismatch'
        };
      }

      // Validate token
      const token = await this.tokenManager.validateToken(response.serverId, response.token);
      if (!token) {
        return {
          success: false,
          serverId: response.serverId,
          error: 'Invalid authentication token'
        };
      }

      // Check token expiry
      if (this.tokenManager.isTokenExpired(token)) {
        return {
          success: false,
          serverId: response.serverId,
          error: 'Authentication token expired'
        };
      }

      // Check IP whitelist if configured
      if (clientIP && !this.tokenManager.checkIPWhitelist(token, clientIP)) {
        return {
          success: false,
          serverId: response.serverId,
          error: 'IP address not whitelisted'
        };
      }

      // Verify challenge response
      const expectedResponse = this.generateChallengeResponse(
        challenge.challenge,
        response.token,
        challenge.timestamp
      );

      if (response.challengeResponse !== expectedResponse) {
        return {
          success: false,
          serverId: response.serverId,
          error: 'Invalid challenge response'
        };
      }

      // Clean up used challenge
      this.activeChallenges.delete(response.challengeResponse);

      // Update token last used
      await this.tokenManager.updateTokenLastUsed(token.id);

      // Determine capabilities based on token
      const capabilities = this.getTokenCapabilities(token);

      this.emit('authenticationSuccess', response.serverId, token);

      return {
        success: true,
        serverId: response.serverId,
        token,
        capabilities
      };

    } catch (error) {
      this.emit('authenticationError', response.serverId, error);
      
      return {
        success: false,
        serverId: response.serverId,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  // ============================================================================
  // Token-based Authentication
  // ============================================================================

  /**
   * Authenticate using token only (for simple authentication)
   */
  async authenticateWithToken(
    serverId: string,
    token: string,
    clientIP?: string
  ): Promise<AuthenticationResult> {
    try {
      // Validate token
      const tokenData = await this.tokenManager.validateToken(serverId, token);
      if (!tokenData) {
        return {
          success: false,
          serverId,
          error: 'Invalid authentication token'
        };
      }

      // Check token expiry
      if (this.tokenManager.isTokenExpired(tokenData)) {
        return {
          success: false,
          serverId,
          error: 'Authentication token expired'
        };
      }

      // Check IP whitelist if configured
      if (clientIP && !this.tokenManager.checkIPWhitelist(tokenData, clientIP)) {
        return {
          success: false,
          serverId,
          error: 'IP address not whitelisted'
        };
      }

      // Update token last used
      await this.tokenManager.updateTokenLastUsed(tokenData.id);

      // Determine capabilities
      const capabilities = this.getTokenCapabilities(tokenData);

      this.emit('authenticationSuccess', serverId, tokenData);

      return {
        success: true,
        serverId,
        token: tokenData,
        capabilities
      };

    } catch (error) {
      this.emit('authenticationError', serverId, error);
      
      return {
        success: false,
        serverId,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  // ============================================================================
  // Message-based Authentication
  // ============================================================================

  /**
   * Handle authentication message
   */
  async handleAuthenticationMessage(
    message: UWBPSystemMessage,
    clientIP?: string
  ): Promise<UWBPSystemMessage | null> {
    if (message.op !== 'handshake') {
      return null;
    }

    const data = message.data;
    
    // Extract authentication data
    if (!data.authentication || !data.serverId) {
      return this.createAuthErrorResponse(
        message.id,
        'Missing authentication data'
      );
    }

    const { token, method } = data.authentication;
    const serverId = data.serverId;

    let result: AuthenticationResult;

    if (method === 'challenge') {
      // Challenge-response authentication
      if (!data.challengeResponse) {
        return this.createAuthErrorResponse(
          message.id,
          'Missing challenge response'
        );
      }

      result = await this.validateAuthenticationResponse({
        serverId,
        token,
        challengeResponse: data.challengeResponse,
        timestamp: message.timestamp || Date.now()
      }, clientIP);

    } else {
      // Simple token authentication
      result = await this.authenticateWithToken(serverId, token, clientIP);
    }

    if (result.success) {
      return this.createAuthSuccessResponse(message.id, result);
    } else {
      return this.createAuthErrorResponse(message.id, result.error || 'Authentication failed');
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate challenge response
   */
  private generateChallengeResponse(
    challenge: string,
    token: string,
    timestamp: number
  ): string {
    const data = `${challenge}:${token}:${timestamp}`;
    return createHmac('sha256', token).update(data).digest('hex');
  }

  /**
   * Get capabilities for a token
   */
  private getTokenCapabilities(token: APIToken): string[] {
    // Basic capabilities for all authenticated connections
    const capabilities = [
      'server.getInfo',
      'server.getStatus',
      'player.list',
      'player.getInfo'
    ];

    // Add additional capabilities based on token configuration
    // This could be extended to read from token metadata
    if (token.encryptionConfig) {
      capabilities.push('encryption');
    }

    return capabilities;
  }

  /**
   * Create authentication success response
   */
  private createAuthSuccessResponse(
    requestId: string,
    result: AuthenticationResult
  ): UWBPSystemMessage {
    return {
      type: 'system',
      id: `auth-success-${Date.now()}`,
      op: 'handshake',
      data: {
        success: true,
        serverId: result.serverId,
        capabilities: result.capabilities || [],
        protocolVersion: '2.0'
      },
      timestamp: Date.now(),
      serverId: result.serverId,
      version: '2.0',
      systemOp: 'handshake'
    };
  }

  /**
   * Create authentication error response
   */
  private createAuthErrorResponse(
    requestId: string,
    error: string
  ): UWBPSystemMessage {
    return {
      type: 'system',
      id: `auth-error-${Date.now()}`,
      op: 'error',
      data: {
        success: false,
        error,
        code: 'AUTH_FAILED'
      },
      timestamp: Date.now(),
      version: '2.0',
      systemOp: 'error'
    };
  }

  // ============================================================================
  // Cleanup Methods
  // ============================================================================

  /**
   * Clean up expired challenges
   */
  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    const expiredChallenges: string[] = [];

    for (const [challengeId, challenge] of this.activeChallenges) {
      if (now > challenge.expiresAt) {
        expiredChallenges.push(challengeId);
      }
    }

    for (const challengeId of expiredChallenges) {
      this.activeChallenges.delete(challengeId);
    }

    if (expiredChallenges.length > 0) {
      this.emit('challengesExpired', expiredChallenges.length);
    }
  }

  /**
   * Clean up challenges for specific server
   */
  private cleanupChallengesForServer(serverId: string): void {
    const challengesToRemove: string[] = [];

    for (const [challengeId, challenge] of this.activeChallenges) {
      if (challenge.serverId === serverId) {
        challengesToRemove.push(challengeId);
      }
    }

    for (const challengeId of challengesToRemove) {
      this.activeChallenges.delete(challengeId);
    }
  }

  /**
   * Get authentication statistics
   */
  getStats(): {
    activeChallenges: number;
    challengesByServer: Record<string, number>;
  } {
    const challengesByServer: Record<string, number> = {};

    for (const challenge of this.activeChallenges.values()) {
      challengesByServer[challenge.serverId] = 
        (challengesByServer[challenge.serverId] || 0) + 1;
    }

    return {
      activeChallenges: this.activeChallenges.size,
      challengesByServer
    };
  }

  /**
   * Shutdown authentication manager
   */
  shutdown(): void {
    if (this.challengeCleanupInterval) {
      clearInterval(this.challengeCleanupInterval);
    }
    
    this.activeChallenges.clear();
    this.removeAllListeners();
  }
}