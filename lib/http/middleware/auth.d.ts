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
export declare class AuthMiddleware implements HTTPMiddleware {
    private ctx;
    private serviceManager;
    constructor(ctx: Context, serviceManager: any);
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        context?: Partial<RequestContext>;
    }>;
    private isPublicEndpoint;
    private sendUnauthorized;
}
