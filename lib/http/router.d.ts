/**
 * HTTP API Router Implementation
 *
 * This file implements the complete HTTP API router with all endpoint handlers
 * for the Mochi-Link system.
 */
import { Context } from 'koishi';
import { HTTPRequest, APIResponse } from './types';
export interface RouteHandler {
    (req: HTTPRequest): Promise<APIResponse>;
}
export interface Route {
    method: string;
    path: string;
    handler: RouteHandler;
}
export declare class APIRouter {
    private ctx;
    private serviceManager;
    private routes;
    constructor(ctx: Context, serviceManager: any);
    addRoute(method: string, path: string, handler: RouteHandler): void;
    get(path: string, handler: RouteHandler): void;
    post(path: string, handler: RouteHandler): void;
    put(path: string, handler: RouteHandler): void;
    delete(path: string, handler: RouteHandler): void;
    route(req: HTTPRequest): Promise<APIResponse>;
    private getHandler;
    getSystemHealth(req: HTTPRequest): Promise<APIResponse>;
    getSystemStats(req: HTTPRequest): Promise<APIResponse>;
    getServers(req: HTTPRequest): Promise<APIResponse>;
    createServer(req: HTTPRequest): Promise<APIResponse>;
    getServer(req: HTTPRequest): Promise<APIResponse>;
    updateServer(req: HTTPRequest): Promise<APIResponse>;
    deleteServer(req: HTTPRequest): Promise<APIResponse>;
    getPlayers(req: HTTPRequest): Promise<APIResponse>;
    getPlayer(req: HTTPRequest): Promise<APIResponse>;
    kickPlayer(req: HTTPRequest): Promise<APIResponse>;
    getWhitelist(req: HTTPRequest): Promise<APIResponse>;
    addToWhitelist(req: HTTPRequest): Promise<APIResponse>;
    removeFromWhitelist(req: HTTPRequest): Promise<APIResponse>;
    getBans(req: HTTPRequest): Promise<APIResponse>;
    createBan(req: HTTPRequest): Promise<APIResponse>;
    updateBan(req: HTTPRequest): Promise<APIResponse>;
    deleteBan(req: HTTPRequest): Promise<APIResponse>;
    executeCommand(req: HTTPRequest): Promise<APIResponse>;
    executeQuickAction(req: HTTPRequest): Promise<APIResponse>;
    getServerStatus(req: HTTPRequest): Promise<APIResponse>;
    getPerformanceHistory(req: HTTPRequest): Promise<APIResponse>;
    getAlerts(req: HTTPRequest): Promise<APIResponse>;
    acknowledgeAlert(req: HTTPRequest): Promise<APIResponse>;
    getCurrentMetrics(req: HTTPRequest): Promise<APIResponse>;
    getMetricsSummary(req: HTTPRequest): Promise<APIResponse>;
    executeBatchCommands(req: HTTPRequest): Promise<APIResponse>;
    executeBatchActions(req: HTTPRequest): Promise<APIResponse>;
    getAuditLogs(req: HTTPRequest): Promise<APIResponse>;
    verifyToken(req: HTTPRequest): Promise<APIResponse>;
    createToken(req: HTTPRequest): Promise<APIResponse>;
    getBindings(req: HTTPRequest): Promise<APIResponse>;
    createBinding(req: HTTPRequest): Promise<APIResponse>;
    getBinding(req: HTTPRequest): Promise<APIResponse>;
    updateBinding(req: HTTPRequest): Promise<APIResponse>;
    deleteBinding(req: HTTPRequest): Promise<APIResponse>;
    getBindingStats(req: HTTPRequest): Promise<APIResponse>;
    createBindingsBatch(req: HTTPRequest): Promise<APIResponse>;
    getGroupRoutes(req: HTTPRequest): Promise<APIResponse>;
    private matchPath;
    private extractPathParams;
    private createSuccessResponse;
    private createPaginatedResponse;
    private createErrorResponse;
}
export { APIRouter };
export default APIRouter;
