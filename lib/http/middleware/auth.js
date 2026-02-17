"use strict";
/**
 * Authentication Middleware
 *
 * Handles API token authentication and user identification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMiddleware = void 0;
class AuthMiddleware {
    constructor(ctx, serviceManager) {
        this.ctx = ctx;
        this.serviceManager = serviceManager;
    }
    async handle(request, response) {
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
        }
        catch (error) {
            this.ctx.logger('auth-middleware').error('Token verification failed:', error);
            this.sendUnauthorized(response, 'Token verification failed');
            return { continue: false };
        }
    }
    isPublicEndpoint(path) {
        const publicPaths = [
            '/api/health',
            '/api/auth/verify'
        ];
        return publicPaths.some(publicPath => path.startsWith(publicPath));
    }
    sendUnauthorized(response, message) {
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
exports.AuthMiddleware = AuthMiddleware;
