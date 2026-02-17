/**
 * U-WBP v2 Protocol Message Router
 *
 * Handles routing of U-WBP messages to appropriate handlers based on
 * message type, operation, and routing rules.
 */
import { UWBPMessage, UWBPRequest, UWBPResponse, UWBPEvent, UWBPSystemMessage, Connection } from '../types';
import { RequestOperation, EventOperation, SystemOperation } from './messages';
export type RequestHandler = (request: UWBPRequest, connection: Connection) => Promise<UWBPResponse>;
export type EventHandler = (event: UWBPEvent, connection: Connection) => Promise<void>;
export type SystemHandler = (message: UWBPSystemMessage, connection: Connection) => Promise<UWBPSystemMessage | void>;
export type ResponseHandler = (response: UWBPResponse, connection: Connection) => Promise<void>;
export interface RouteConfig {
    operation: string;
    handler: RequestHandler | EventHandler | SystemHandler;
    middleware?: MiddlewareFunction[];
    permissions?: string[];
    rateLimit?: {
        maxRequests: number;
        windowMs: number;
    };
    timeout?: number;
    priority?: number;
}
export interface MiddlewareFunction {
    (message: UWBPMessage, connection: Connection, next: () => Promise<void>): Promise<void>;
}
export interface RoutingContext {
    message: UWBPMessage;
    connection: Connection;
    route?: RouteConfig;
    startTime: number;
    metadata: Record<string, any>;
}
export declare class MessageRouter {
    private requestHandlers;
    private eventHandlers;
    private systemHandlers;
    private responseHandlers;
    private globalMiddleware;
    private defaultTimeout;
    /**
     * Register a request handler
     */
    registerRequestHandler(operation: RequestOperation, handler: RequestHandler, config?: Partial<RouteConfig>): void;
    /**
     * Register an event handler
     */
    registerEventHandler(operation: EventOperation, handler: EventHandler, config?: Partial<RouteConfig>): void;
    /**
     * Register a system message handler
     */
    registerSystemHandler(operation: SystemOperation, handler: SystemHandler, config?: Partial<RouteConfig>): void;
    /**
     * Register a response handler for a specific request
     */
    registerResponseHandler(requestId: string, handler: ResponseHandler): void;
    /**
     * Unregister a response handler
     */
    unregisterResponseHandler(requestId: string): void;
    /**
     * Add global middleware
     */
    use(middleware: MiddlewareFunction): void;
    /**
     * Route a message to the appropriate handler
     */
    route(message: UWBPMessage, connection: Connection): Promise<UWBPResponse | void>;
    private routeRequest;
    private routeResponse;
    private routeEvent;
    private routeSystemMessage;
    private findRoute;
    private executeMiddleware;
    private checkPermissions;
    private applyRateLimit;
    private executeWithTimeout;
    private handleRoutingError;
    /**
     * Get all registered routes
     */
    getRoutes(): {
        requests: Map<RequestOperation, RouteConfig>;
        events: Map<EventOperation, RouteConfig>;
        system: Map<SystemOperation, RouteConfig>;
    };
    /**
     * Clear all handlers
     */
    clear(): void;
    /**
     * Get router statistics
     */
    getStats(): {
        requestHandlers: number;
        eventHandlers: number;
        systemHandlers: number;
        responseHandlers: number;
        globalMiddleware: number;
    };
}
/**
 * Logging middleware
 */
export declare const loggingMiddleware: MiddlewareFunction;
/**
 * Metrics collection middleware
 */
export declare const metricsMiddleware: MiddlewareFunction;
/**
 * Authentication middleware
 */
export declare const authMiddleware: MiddlewareFunction;
export declare const defaultRouter: MessageRouter;
