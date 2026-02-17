/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting based on IP address and user ID
 */
import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext, RateLimitConfig } from '../types';
export declare class RateLimitMiddleware implements HTTPMiddleware {
    private config;
    private ipLimits;
    private userLimits;
    constructor(config: RateLimitConfig);
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        context?: Partial<RequestContext>;
    }>;
    private checkLimit;
    private cleanupExpiredEntries;
    private sendRateLimitExceeded;
}
