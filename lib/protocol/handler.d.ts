/**
 * U-WBP v2 Protocol Handler
 *
 * Main protocol handler that coordinates message processing, validation,
 * routing, and response handling for the U-WBP v2 protocol.
 */
import { UWBPMessage, UWBPResponse, UWBPSystemMessage, Connection } from '../types';
import { MessageRouter, RequestHandler, EventHandler, SystemHandler } from './router';
export interface ProtocolHandlerConfig {
    validateIncoming: boolean;
    validateOutgoing: boolean;
    strictValidation: boolean;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    encryptionKey?: string;
    defaultTimeout: number;
    maxTimeout: number;
    throwOnValidationError: boolean;
    logErrors: boolean;
    maxConcurrentRequests: number;
    requestQueueSize: number;
}
export declare class ProtocolHandler {
    private router;
    private config;
    private pendingRequests;
    private requestQueue;
    private activeRequests;
    constructor(router?: MessageRouter, config?: Partial<ProtocolHandlerConfig>);
    /**
     * Handle incoming message from connection
     */
    handleMessage(connection: Connection, rawMessage: string | Buffer): Promise<void>;
    /**
     * Send message through connection
     */
    sendMessage(connection: Connection, message: UWBPMessage): Promise<void>;
    /**
     * Send request and wait for response
     */
    sendRequest(connection: Connection, operation: string, data?: any, options?: {
        timeout?: number;
        serverId?: string;
    }): Promise<UWBPResponse>;
    /**
     * Handle incoming response
     */
    private handleResponse;
    /**
     * Send event message
     */
    sendEvent(connection: Connection, operation: string, data?: any, options?: {
        serverId?: string;
        eventType?: string;
    }): Promise<void>;
    /**
     * Broadcast event to multiple connections
     */
    broadcastEvent(connections: Connection[], operation: string, data?: any, options?: {
        serverId?: string;
        eventType?: string;
    }): Promise<void>;
    /**
     * Send system message
     */
    sendSystemMessage(connection: Connection, operation: string, data?: any, options?: {
        serverId?: string;
    }): Promise<UWBPSystemMessage | void>;
    /**
     * Perform handshake with connection
     */
    performHandshake(connection: Connection, capabilities: string[], serverType?: 'koishi' | 'connector'): Promise<void>;
    /**
     * Register request handler
     */
    onRequest(operation: string, handler: RequestHandler): void;
    /**
     * Register event handler
     */
    onEvent(operation: string, handler: EventHandler): void;
    /**
     * Register system message handler
     */
    onSystem(operation: string, handler: SystemHandler): void;
    private handleError;
    private setupDefaultHandlers;
    /**
     * Clean up expired requests
     */
    cleanup(): void;
    /**
     * Get handler statistics
     */
    getStats(): {
        pendingRequests: number;
        activeRequests: number;
        queuedRequests: number;
        routerStats: any;
    };
    /**
     * Shutdown handler
     */
    shutdown(): Promise<void>;
}
