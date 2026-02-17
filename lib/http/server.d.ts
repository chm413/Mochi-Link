/**
 * HTTP API Server Implementation
 *
 * This file implements the HTTP API server using Node.js built-in HTTP module
 * with routing, middleware, and error handling capabilities.
 */
import { ServerResponse } from 'http';
import { Context } from 'koishi';
import { PluginConfig } from '../types';
import { RequestContext, HTTPRequest } from './types';
export { HTTPRequest, APIResponse, RequestContext } from './types';
export declare class HTTPServer {
    private ctx;
    private serviceManager;
    private server;
    private router;
    private logger;
    private config;
    private middlewares;
    private isRunning;
    private versionManager;
    private versioningMiddleware;
    private documentationServer;
    private documentationMiddleware;
    private securityService;
    constructor(ctx: Context, config: PluginConfig['http'], serviceManager: any);
    start(): Promise<void>;
    stop(): Promise<void>;
    private setupMiddlewares;
    private setupRoutes;
    private handleRequest;
    private sendResponse;
    private handleError;
    private handleOptions;
    private parseRequestBody;
    private getClientIP;
    private generateRequestId;
    isListening(): boolean;
    getAddress(): {
        host: string;
        port: number;
    } | null;
}
export interface HTTPMiddleware {
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        context?: Partial<RequestContext>;
    }>;
}
