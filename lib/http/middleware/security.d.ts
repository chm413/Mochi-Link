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
export declare class SecurityMiddleware implements HTTPMiddleware {
    private securityService;
    private auditService;
    constructor(securityService: SecurityControlService, auditService: AuditService);
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        context?: Partial<RequestContext>;
    }>;
    private sendSecurityError;
}
