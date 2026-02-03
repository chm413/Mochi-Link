/**
 * Authentication Middleware
 * 
 * Handles API token authentication and user identification
 */

import { Context } from 'koishi';
import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext } from '../types';

export class AuthMiddleware implements HTTPMiddleware {
  constructor(
    private ctx: Context,
    private serviceManager: any
  ) {}

  async handle(request: HTTPRequest, response: ServerResponse): Promise<{
    continue: boolean;
    context?: Partial<RequestContext>;
  }> {
    // Skip auth for health check and public endpoints
    if (this.isPublicEndpoint(request.path)) {
      return { continue: true };
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.sendUnauthorized(response, 'Missing or invalid authorization header');
      return { continue: false };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify token
      const tokenInfo = await this.serviceManager.tokenManager.verifyToken(token);
      
      if (!tokenInfo.valid) {
        this.sendUnauthorized(response, 'Invalid or expired token');
        return { continue: false };
      }

      // Get user permissions
      const permissions = tokenInfo.permissions || [];
      
      return {
        continue: true,
        context: {
          userId: tokenInfo.userId || 'api-user',
          serverId: tokenInfo.serverId,
          permissions
        }
      };

    } catch (error) {
      this.ctx.logger('auth-middleware').error('Token verification failed:', error);
      this.sendUnauthorized(response, 'Token verification failed');
      return { continue: false };
    }
  }

  private isPublicEndpoint(path: string): boolean {
    const publicPaths = [
      '/api/health',
      '/api/auth/verify'
    ];
    
    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  private sendUnauthorized(response: ServerResponse, message: string): void {
    response.statusCode = 401;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      success: false,
      error: 'UNAUTHORIZED',
      message,
      timestamp: Date.now()
    }));
  }
}