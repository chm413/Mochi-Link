/**
 * U-WBP v2 Protocol Message Router
 * 
 * Handles routing of U-WBP messages to appropriate handlers based on
 * message type, operation, and routing rules.
 */

import { 
  UWBPMessage, 
  UWBPRequest, 
  UWBPResponse, 
  UWBPEvent, 
  UWBPSystemMessage,
  Connection,
  ProtocolError
} from '../types';
import { 
  RequestOperation, 
  EventOperation, 
  SystemOperation,
  MessageUtils,
  isUWBPRequest,
  isUWBPResponse,
  isUWBPEvent,
  isUWBPSystemMessage
} from './messages';

// ============================================================================
// Handler Types
// ============================================================================

export type RequestHandler = (
  request: UWBPRequest, 
  connection: Connection
) => Promise<UWBPResponse>;

export type EventHandler = (
  event: UWBPEvent, 
  connection: Connection
) => Promise<void>;

export type SystemHandler = (
  message: UWBPSystemMessage, 
  connection: Connection
) => Promise<UWBPSystemMessage | void>;

export type ResponseHandler = (
  response: UWBPResponse, 
  connection: Connection
) => Promise<void>;

// ============================================================================
// Route Configuration
// ============================================================================

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

// ============================================================================
// Routing Context
// ============================================================================

export interface RoutingContext {
  message: UWBPMessage;
  connection: Connection;
  route?: RouteConfig;
  startTime: number;
  metadata: Record<string, any>;
}

// ============================================================================
// Message Router
// ============================================================================

export class MessageRouter {
  private requestHandlers = new Map<RequestOperation, RouteConfig>();
  private eventHandlers = new Map<EventOperation, RouteConfig>();
  private systemHandlers = new Map<SystemOperation, RouteConfig>();
  private responseHandlers = new Map<string, ResponseHandler>(); // keyed by requestId
  private globalMiddleware: MiddlewareFunction[] = [];
  private defaultTimeout = 30000; // 30 seconds

  // ============================================================================
  // Handler Registration
  // ============================================================================

  /**
   * Register a request handler
   */
  registerRequestHandler(
    operation: RequestOperation,
    handler: RequestHandler,
    config: Partial<RouteConfig> = {}
  ): void {
    const routeConfig: RouteConfig = {
      operation,
      handler,
      timeout: config.timeout || MessageUtils.getExpectedResponseTime(operation),
      priority: config.priority || 0,
      ...config
    };

    this.requestHandlers.set(operation, routeConfig);
  }

  /**
   * Register an event handler
   */
  registerEventHandler(
    operation: EventOperation,
    handler: EventHandler,
    config: Partial<RouteConfig> = {}
  ): void {
    const routeConfig: RouteConfig = {
      operation,
      handler,
      priority: config.priority || 0,
      ...config
    };

    this.eventHandlers.set(operation, routeConfig);
  }

  /**
   * Register a system message handler
   */
  registerSystemHandler(
    operation: SystemOperation,
    handler: SystemHandler,
    config: Partial<RouteConfig> = {}
  ): void {
    const routeConfig: RouteConfig = {
      operation,
      handler,
      priority: config.priority || 0,
      ...config
    };

    this.systemHandlers.set(operation, routeConfig);
  }

  /**
   * Register a response handler for a specific request
   */
  registerResponseHandler(requestId: string, handler: ResponseHandler): void {
    this.responseHandlers.set(requestId, handler);
  }

  /**
   * Unregister a response handler
   */
  unregisterResponseHandler(requestId: string): void {
    this.responseHandlers.delete(requestId);
  }

  /**
   * Add global middleware
   */
  use(middleware: MiddlewareFunction): void {
    this.globalMiddleware.push(middleware);
  }

  // ============================================================================
  // Message Routing
  // ============================================================================

  /**
   * Route a message to the appropriate handler
   */
  async route(message: UWBPMessage, connection: Connection): Promise<UWBPResponse | void> {
    const context: RoutingContext = {
      message,
      connection,
      startTime: Date.now(),
      metadata: {}
    };

    try {
      // Find the appropriate route
      const route = this.findRoute(message);
      context.route = route;

      // Execute middleware chain
      await this.executeMiddleware(context);

      // Route based on message type
      switch (message.type) {
        case 'request':
          return await this.routeRequest(message as UWBPRequest, context);
        
        case 'response':
          await this.routeResponse(message as UWBPResponse, context);
          break;
        
        case 'event':
          await this.routeEvent(message as UWBPEvent, context);
          break;
        
        case 'system':
          await this.routeSystemMessage(message as UWBPSystemMessage, context);
          break;
        
        default:
          throw new ProtocolError(`Unknown message type: ${message.type}`, message.id);
      }

    } catch (error) {
      await this.handleRoutingError(error, context);
      
      // Return error response for requests
      if (isUWBPRequest(message)) {
        const { MessageFactory } = await import('./messages');
        return MessageFactory.createError(
          message.id,
          message.op,
          error instanceof Error ? error.message : String(error),
          error instanceof ProtocolError ? error.code : 'ROUTING_ERROR'
        );
      }
      
      throw error;
    }
  }

  // ============================================================================
  // Route Handlers
  // ============================================================================

  private async routeRequest(request: UWBPRequest, context: RoutingContext): Promise<UWBPResponse> {
    if (!isUWBPRequest(request)) {
      throw new ProtocolError('Invalid request message', (request as any).id);
    }

    const handler = this.requestHandlers.get(request.op as RequestOperation);
    if (!handler) {
      throw new ProtocolError(`No handler registered for operation: ${request.op}`, request.id);
    }

    // Check permissions
    await this.checkPermissions(handler, context);

    // Apply rate limiting
    await this.applyRateLimit(handler, context);

    // Execute handler with timeout
    const timeout = handler.timeout || this.defaultTimeout;
    const response = await this.executeWithTimeout(
      () => (handler.handler as RequestHandler)(request, context.connection),
      timeout,
      `Request handler timeout for ${request.op}`
    );

    return response;
  }

  private async routeResponse(response: UWBPResponse, context: RoutingContext): Promise<void> {
    if (!isUWBPResponse(response)) {
      throw new ProtocolError('Invalid response message', (response as any).id);
    }

    const handler = this.responseHandlers.get(response.requestId);
    if (handler) {
      await handler(response, context.connection);
      this.responseHandlers.delete(response.requestId);
    }
    // Note: It's not an error if no response handler is registered
    // The response might be handled by a different mechanism
  }

  private async routeEvent(event: UWBPEvent, context: RoutingContext): Promise<void> {
    if (!isUWBPEvent(event)) {
      throw new ProtocolError('Invalid event message', (event as any).id);
    }

    const handler = this.eventHandlers.get(event.op as EventOperation);
    if (!handler) {
      // Events without handlers are not necessarily errors
      // They might be informational or handled by other systems
      return;
    }

    // Check permissions
    await this.checkPermissions(handler, context);

    // Execute handler
    await (handler.handler as EventHandler)(event, context.connection);
  }

  private async routeSystemMessage(
    message: UWBPSystemMessage, 
    context: RoutingContext
  ): Promise<UWBPSystemMessage | void> {
    if (!isUWBPSystemMessage(message)) {
      throw new ProtocolError('Invalid system message', (message as any).id);
    }

    const handler = this.systemHandlers.get(message.systemOp);
    if (!handler) {
      throw new ProtocolError(`No handler registered for system operation: ${message.systemOp}`, message.id);
    }

    // System messages typically don't require permission checks
    // Execute handler
    return await (handler.handler as SystemHandler)(message, context.connection);
  }

  // ============================================================================
  // Route Discovery
  // ============================================================================

  private findRoute(message: UWBPMessage): RouteConfig | undefined {
    switch (message.type) {
      case 'request':
        return this.requestHandlers.get(message.op as RequestOperation);
      case 'event':
        return this.eventHandlers.get(message.op as EventOperation);
      case 'system':
        return this.systemHandlers.get((message as UWBPSystemMessage).systemOp);
      default:
        return undefined;
    }
  }

  // ============================================================================
  // Middleware Execution
  // ============================================================================

  private async executeMiddleware(context: RoutingContext): Promise<void> {
    const middleware = [
      ...this.globalMiddleware,
      ...(context.route?.middleware || [])
    ];

    let index = 0;
    
    const next = async (): Promise<void> => {
      if (index >= middleware.length) {
        return;
      }
      
      const currentMiddleware = middleware[index++];
      await currentMiddleware(context.message, context.connection, next);
    };

    await next();
  }

  // ============================================================================
  // Security and Rate Limiting
  // ============================================================================

  private async checkPermissions(handler: RouteConfig, context: RoutingContext): Promise<void> {
    if (!handler.permissions || handler.permissions.length === 0) {
      return;
    }

    // Note: In a real implementation, you would integrate with the permission system
    // For now, we'll assume permissions are checked elsewhere
    const hasPermission = true; // Placeholder

    if (!hasPermission) {
      throw new ProtocolError(
        `Insufficient permissions for operation: ${handler.operation}`,
        context.message.id
      );
    }
  }

  private async applyRateLimit(handler: RouteConfig, context: RoutingContext): Promise<void> {
    if (!handler.rateLimit) {
      return;
    }

    // Note: In a real implementation, you would use a proper rate limiting mechanism
    // For now, we'll skip rate limiting
    const rateLimitExceeded = false; // Placeholder

    if (rateLimitExceeded) {
      throw new ProtocolError(
        `Rate limit exceeded for operation: ${handler.operation}`,
        context.message.id
      );
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ProtocolError(errorMessage));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async handleRoutingError(error: any, context: RoutingContext): Promise<void> {
    // Log the error
    console.error('Routing error:', {
      messageId: context.message.id,
      operation: context.message.op,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - context.startTime
    });

    // Additional error handling could be added here
    // such as metrics collection, alerting, etc.
  }

  // ============================================================================
  // Router Management
  // ============================================================================

  /**
   * Get all registered routes
   */
  getRoutes(): {
    requests: Map<RequestOperation, RouteConfig>;
    events: Map<EventOperation, RouteConfig>;
    system: Map<SystemOperation, RouteConfig>;
  } {
    return {
      requests: new Map(this.requestHandlers),
      events: new Map(this.eventHandlers),
      system: new Map(this.systemHandlers)
    };
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.requestHandlers.clear();
    this.eventHandlers.clear();
    this.systemHandlers.clear();
    this.responseHandlers.clear();
    this.globalMiddleware.length = 0;
  }

  /**
   * Get router statistics
   */
  getStats(): {
    requestHandlers: number;
    eventHandlers: number;
    systemHandlers: number;
    responseHandlers: number;
    globalMiddleware: number;
  } {
    return {
      requestHandlers: this.requestHandlers.size,
      eventHandlers: this.eventHandlers.size,
      systemHandlers: this.systemHandlers.size,
      responseHandlers: this.responseHandlers.size,
      globalMiddleware: this.globalMiddleware.length
    };
  }
}

// ============================================================================
// Built-in Middleware
// ============================================================================

/**
 * Logging middleware
 */
export const loggingMiddleware: MiddlewareFunction = async (message, connection, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${message.type.toUpperCase()} ${message.op} from ${connection.serverId}`);
  
  try {
    await next();
  } finally {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] Completed ${message.op} in ${duration}ms`);
  }
};

/**
 * Metrics collection middleware
 */
export const metricsMiddleware: MiddlewareFunction = async (message, connection, next) => {
  const start = Date.now();
  
  try {
    await next();
    // Record success metrics
  } catch (error) {
    // Record error metrics
    throw error;
  } finally {
    const duration = Date.now() - start;
    // Record timing metrics
  }
};

/**
 * Authentication middleware
 */
export const authMiddleware: MiddlewareFunction = async (message, connection, next) => {
  // Check if operation requires authentication
  if (MessageUtils.requiresAuth(message.op)) {
    // Verify connection is authenticated
    if (!connection.serverId) {
      throw new ProtocolError('Authentication required', message.id);
    }
  }
  
  await next();
};

// ============================================================================
// Default Router Instance
// ============================================================================

export const defaultRouter = new MessageRouter();

// Add default middleware
defaultRouter.use(loggingMiddleware);
defaultRouter.use(authMiddleware);
defaultRouter.use(metricsMiddleware);