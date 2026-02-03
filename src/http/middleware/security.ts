/**
 * Enhanced Security Middleware
 * 
 * Integrates the SecurityControlService with HTTP API endpoints to provide:
 * - Advanced API rate limiting and DDoS protection
 * - Suspicious activity detection and blocking
 * - Security event monitoring and alerting
 */

import { ServerResponse } from 'http';
import { HTTPRequest, RequestContext } from '../types';
import { HTTPMiddleware } from '../server';
import { SecurityControlService } from '../../services/security';
import { AuditService } from '../../services/audit';

export class SecurityMiddleware implements HTTPMiddleware {
  constructor(
    private securityService: SecurityControlService,
    private auditService: AuditService
  ) {}

  async handle(request: HTTPRequest, response: ServerResponse): Promise<{
    continue: boolean;
    context?: Partial<RequestContext>;
  }> {
    const startTime = Date.now();
    
    try {
      // Check API request against security controls
      const securityCheck = this.securityService.checkAPIRequest(
        request.context.ipAddress,
        request.context.userId,
        request.path,
        request.headers['user-agent']
      );

      // Add security headers to response
      for (const [header, value] of Object.entries(securityCheck.securityHeaders)) {
        response.setHeader(header, value);
      }

      if (!securityCheck.allowed) {
        // Log security violation
        await this.auditService.logger.logError(
          'api_request_blocked',
          {
            ip: request.context.ipAddress,
            userId: request.context.userId,
            endpoint: request.path,
            reason: securityCheck.reason,
            userAgent: request.headers['user-agent']
          },
          request.context.serverId
        );

        // Send security error response
        this.sendSecurityError(response, securityCheck.reason!, securityCheck.retryAfter);
        return { continue: false };
      }

      // Record successful security check
      this.securityService.recordAPISuccess(
        request.context.ipAddress,
        request.context.userId,
        request.path
      );

      return { 
        continue: true
      };

    } catch (error) {
      // Log security middleware error
      await this.auditService.logger.logError(
        'security_middleware_error',
        {
          ip: request.context.ipAddress,
          endpoint: request.path,
          error: error instanceof Error ? error.message : String(error)
        },
        error instanceof Error ? error : new Error(String(error)),
        { serverId: request.context.serverId }
      );

      // Record security failure
      this.securityService.recordAPIFailure(
        request.context.ipAddress,
        request.context.userId,
        request.path,
        'security_middleware_error'
      );

      // Allow request to continue but log the error
      return { continue: true };
    }
  }

  private sendSecurityError(response: ServerResponse, reason: string, retryAfter?: number): void {
    let statusCode = 429; // Too Many Requests
    let errorCode = 'RATE_LIMIT_EXCEEDED';

    // Determine appropriate status code based on reason
    if (reason.includes('DDoS') || reason.includes('attack')) {
      statusCode = 503; // Service Unavailable
      errorCode = 'SERVICE_TEMPORARILY_UNAVAILABLE';
    } else if (reason.includes('suspicious')) {
      statusCode = 403; // Forbidden
      errorCode = 'SUSPICIOUS_ACTIVITY_DETECTED';
    } else if (reason.includes('blocked')) {
      statusCode = 403; // Forbidden
      errorCode = 'IP_BLOCKED';
    }

    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json');
    
    if (retryAfter) {
      response.setHeader('Retry-After', retryAfter.toString());
    }

    const errorResponse = {
      success: false,
      error: errorCode,
      message: reason,
      timestamp: Date.now(),
      retryAfter
    };

    response.end(JSON.stringify(errorResponse));
  }
}