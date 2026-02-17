/**
 * CORS Middleware
 *
 * Handles Cross-Origin Resource Sharing headers
 */
import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext, CorsConfig } from '../types';
export declare class CorsMiddleware implements HTTPMiddleware {
    private config;
    constructor(config: CorsConfig);
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        context?: Partial<RequestContext>;
    }>;
    private isOriginAllowed;
}
