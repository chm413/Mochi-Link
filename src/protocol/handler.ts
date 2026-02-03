/**
 * U-WBP v2 Protocol Handler
 * 
 * Main protocol handler that coordinates message processing, validation,
 * routing, and response handling for the U-WBP v2 protocol.
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
import { MessageValidator, ValidationUtils } from './validation';
import { MessageSerializer } from './serialization';
import { MessageRouter, RequestHandler, EventHandler, SystemHandler } from './router';
import { MessageFactory, MessageUtils } from './messages';

// ============================================================================
// Handler Configuration
// ============================================================================

export interface ProtocolHandlerConfig {
  // Validation settings
  validateIncoming: boolean;
  validateOutgoing: boolean;
  strictValidation: boolean;
  
  // Serialization settings
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  encryptionKey?: string;
  
  // Timeout settings
  defaultTimeout: number;
  maxTimeout: number;
  
  // Error handling
  throwOnValidationError: boolean;
  logErrors: boolean;
  
  // Performance settings
  maxConcurrentRequests: number;
  requestQueueSize: number;
}

// ============================================================================
// Request Tracking
// ============================================================================

interface PendingRequest {
  id: string;
  operation: string;
  timestamp: number;
  timeout: number;
  resolve: (response: UWBPResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

// ============================================================================
// Protocol Handler
// ============================================================================

export class ProtocolHandler {
  private router: MessageRouter;
  private config: ProtocolHandlerConfig;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestQueue: UWBPRequest[] = [];
  private activeRequests = 0;

  constructor(
    router?: MessageRouter,
    config?: Partial<ProtocolHandlerConfig>
  ) {
    this.router = router || new MessageRouter();
    this.config = {
      validateIncoming: true,
      validateOutgoing: true,
      strictValidation: false,
      compressionEnabled: false,
      encryptionEnabled: false,
      defaultTimeout: 30000,
      maxTimeout: 300000,
      throwOnValidationError: false,
      logErrors: true,
      maxConcurrentRequests: 100,
      requestQueueSize: 1000,
      ...config
    };

    this.setupDefaultHandlers();
  }

  // ============================================================================
  // Message Processing
  // ============================================================================

  /**
   * Handle incoming message from connection
   */
  async handleMessage(connection: Connection, rawMessage: string | Buffer): Promise<void> {
    try {
      // Deserialize message
      const deserializeResult = MessageSerializer.deserialize(rawMessage, {
        validate: this.config.validateIncoming,
        strictValidation: this.config.strictValidation,
        throwOnError: this.config.throwOnValidationError,
        decrypt: this.config.encryptionEnabled,
        decryptionKey: this.config.encryptionKey
      });

      if (!deserializeResult.success) {
        throw new ProtocolError(`Failed to deserialize message: ${deserializeResult.error}`);
      }

      const message = deserializeResult.message!;

      // Log warnings if any
      if (deserializeResult.warnings && deserializeResult.warnings.length > 0) {
        console.warn('Message validation warnings:', deserializeResult.warnings);
      }

      // Route message
      const response = await this.router.route(message, connection);

      // Send response if one was generated
      if (response) {
        await this.sendMessage(connection, response);
      }

    } catch (error) {
      await this.handleError(error, connection);
    }
  }

  /**
   * Send message through connection
   */
  async sendMessage(connection: Connection, message: UWBPMessage): Promise<void> {
    try {
      // Validate outgoing message
      if (this.config.validateOutgoing) {
        const validationResult = MessageValidator.validate(message);
        if (!validationResult.valid && this.config.strictValidation) {
          throw new ProtocolError(
            `Outgoing message validation failed: ${ValidationUtils.getValidationSummary(validationResult)}`,
            message.id
          );
        }
      }

      // Serialize message
      const serializeResult = MessageSerializer.serialize(message, {
        validate: this.config.validateOutgoing,
        strictValidation: this.config.strictValidation,
        compress: this.config.compressionEnabled,
        encrypt: this.config.encryptionEnabled,
        encryptionKey: this.config.encryptionKey
      });

      if (!serializeResult.success) {
        throw new ProtocolError(`Failed to serialize message: ${serializeResult.error}`, message.id);
      }

      // Send through connection
      await connection.send(message);

    } catch (error) {
      await this.handleError(error, connection, message);
    }
  }

  // ============================================================================
  // Request/Response Handling
  // ============================================================================

  /**
   * Send request and wait for response
   */
  async sendRequest(
    connection: Connection,
    operation: string,
    data: any = {},
    options: {
      timeout?: number;
      serverId?: string;
    } = {}
  ): Promise<UWBPResponse> {
    // Check request limits
    if (this.activeRequests >= this.config.maxConcurrentRequests) {
      if (this.requestQueue.length >= this.config.requestQueueSize) {
        throw new ProtocolError('Request queue full');
      }
      // Queue the request (simplified implementation)
      throw new ProtocolError('Too many concurrent requests');
    }

    const timeout = Math.min(
      options.timeout || this.config.defaultTimeout,
      this.config.maxTimeout
    );

    const request = MessageFactory.createRequest(operation as any, data, {
      serverId: options.serverId,
      timeout
    });

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        this.activeRequests--;
        reject(new ProtocolError(`Request timeout: ${operation}`, request.id));
      }, timeout);

      // Track pending request
      const pendingRequest: PendingRequest = {
        id: request.id,
        operation,
        timestamp: Date.now(),
        timeout,
        resolve,
        reject,
        timer
      };

      this.pendingRequests.set(request.id, pendingRequest);
      this.activeRequests++;

      // Send request
      this.sendMessage(connection, request).catch(error => {
        clearTimeout(timer);
        this.pendingRequests.delete(request.id);
        this.activeRequests--;
        reject(error);
      });
    });
  }

  /**
   * Handle incoming response
   */
  private async handleResponse(response: UWBPResponse, connection: Connection): Promise<void> {
    const pendingRequest = this.pendingRequests.get(response.requestId);
    if (!pendingRequest) {
      // Response for unknown request - might be late or duplicate
      console.warn(`Received response for unknown request: ${response.requestId}`);
      return;
    }

    // Clear timeout and remove from pending
    clearTimeout(pendingRequest.timer);
    this.pendingRequests.delete(response.requestId);
    this.activeRequests--;

    // Resolve or reject based on response
    if (response.success) {
      pendingRequest.resolve(response);
    } else {
      const error = new ProtocolError(
        response.error || 'Request failed',
        response.requestId
      );
      pendingRequest.reject(error);
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Send event message
   */
  async sendEvent(
    connection: Connection,
    operation: string,
    data: any = {},
    options: {
      serverId?: string;
      eventType?: string;
    } = {}
  ): Promise<void> {
    const event = MessageFactory.createEvent(operation as any, data, options);
    await this.sendMessage(connection, event);
  }

  /**
   * Broadcast event to multiple connections
   */
  async broadcastEvent(
    connections: Connection[],
    operation: string,
    data: any = {},
    options: {
      serverId?: string;
      eventType?: string;
    } = {}
  ): Promise<void> {
    const event = MessageFactory.createEvent(operation as any, data, options);
    
    // Send to all connections in parallel
    const promises = connections.map(connection => 
      this.sendMessage(connection, event).catch(error => {
        console.error(`Failed to send event to ${connection.serverId}:`, error);
      })
    );

    await Promise.allSettled(promises);
  }

  // ============================================================================
  // System Message Handling
  // ============================================================================

  /**
   * Send system message
   */
  async sendSystemMessage(
    connection: Connection,
    operation: string,
    data: any = {},
    options: {
      serverId?: string;
    } = {}
  ): Promise<UWBPSystemMessage | void> {
    const message = MessageFactory.createSystemMessage(operation as any, data, options);
    
    // Send the system message
    await this.sendMessage(connection, message);
    
    // Return the message itself since it's a system message
    return message;
  }

  /**
   * Perform handshake with connection
   */
  async performHandshake(
    connection: Connection,
    capabilities: string[],
    serverType: 'koishi' | 'connector' = 'koishi'
  ): Promise<void> {
    const handshakeData = {
      protocolVersion: '2.0',
      serverType,
      capabilities,
      serverId: connection.serverId
    };

    await this.sendSystemMessage(connection, 'handshake', handshakeData);
  }

  // ============================================================================
  // Handler Registration
  // ============================================================================

  /**
   * Register request handler
   */
  onRequest(operation: string, handler: RequestHandler): void {
    this.router.registerRequestHandler(operation as any, handler);
  }

  /**
   * Register event handler
   */
  onEvent(operation: string, handler: EventHandler): void {
    this.router.registerEventHandler(operation as any, handler);
  }

  /**
   * Register system message handler
   */
  onSystem(operation: string, handler: SystemHandler): void {
    this.router.registerSystemHandler(operation as any, handler);
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private async handleError(
    error: any,
    connection: Connection,
    originalMessage?: UWBPMessage
  ): Promise<void> {
    if (this.config.logErrors) {
      console.error('Protocol handler error:', {
        error: error instanceof Error ? error.message : String(error),
        serverId: connection.serverId,
        messageId: originalMessage?.id,
        operation: originalMessage?.op
      });
    }

    // Send error response for requests
    if (originalMessage && originalMessage.type === 'request') {
      const errorResponse = MessageFactory.createError(
        originalMessage.id,
        originalMessage.op,
        error instanceof Error ? error.message : String(error),
        error instanceof ProtocolError ? error.code : 'HANDLER_ERROR'
      );

      try {
        await this.sendMessage(connection, errorResponse);
      } catch (sendError) {
        console.error('Failed to send error response:', sendError);
      }
    }
  }

  // ============================================================================
  // Default Handlers
  // ============================================================================

  private setupDefaultHandlers(): void {
    // Handle responses
    this.router.registerResponseHandler = (requestId: string, handler: any) => {
      // Override to use our response handling
      this.router.registerResponseHandler(requestId, async (response, connection) => {
        await this.handleResponse(response, connection);
      });
    };

    // Default ping handler
    this.onSystem('ping', async (message, connection) => {
      return MessageFactory.createSystemMessage('pong', {
        timestamp: Date.now(),
        originalId: message.id
      });
    });

    // Default pong handler
    this.onSystem('pong', async (message, connection) => {
      // Update connection last ping time
      if (connection.lastPing !== undefined) {
        connection.lastPing = Date.now() - (message.data?.timestamp || Date.now());
      }
    });

    // Default capabilities handler
    this.onSystem('capabilities', async (message, connection) => {
      // Store connection capabilities
      if (Array.isArray(message.data?.capabilities)) {
        connection.capabilities = message.data.capabilities;
      }
    });
  }

  // ============================================================================
  // Cleanup and Management
  // ============================================================================

  /**
   * Clean up expired requests
   */
  cleanup(): void {
    const now = Date.now();
    const expiredRequests: string[] = [];

    for (const [id, request] of this.pendingRequests) {
      if (now - request.timestamp > request.timeout) {
        expiredRequests.push(id);
      }
    }

    for (const id of expiredRequests) {
      const request = this.pendingRequests.get(id);
      if (request) {
        clearTimeout(request.timer);
        this.pendingRequests.delete(id);
        this.activeRequests--;
        request.reject(new ProtocolError(`Request expired: ${request.operation}`, id));
      }
    }
  }

  /**
   * Get handler statistics
   */
  getStats(): {
    pendingRequests: number;
    activeRequests: number;
    queuedRequests: number;
    routerStats: any;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      routerStats: this.router.getStats()
    };
  }

  /**
   * Shutdown handler
   */
  async shutdown(): Promise<void> {
    // Cancel all pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timer);
      request.reject(new ProtocolError('Handler shutting down', id));
    }

    this.pendingRequests.clear();
    this.requestQueue.length = 0;
    this.activeRequests = 0;
  }
}