/**
 * Logging Middleware
 *
 * Logs HTTP requests and responses for monitoring and debugging
 */
import { Logger } from 'koishi';
import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext } from '../types';
export declare class LoggingMiddleware implements HTTPMiddleware {
    private logger;
    constructor(logger: Logger);
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        context?: Partial<RequestContext>;
    }>;
}
