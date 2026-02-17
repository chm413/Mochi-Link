/**
 * WebSocket Server Implementation
 *
 * Implements WebSocket server for reverse connection mode where
 * Connector_Bridge connects to Koishi plugin as WebSocket clients.
 */
import { EventEmitter } from 'events';
import { WebSocketConnection } from './connection';
import { AuthenticationManager } from './auth';
export interface WebSocketServerConfig {
    port: number;
    host?: string;
    path?: string;
    ssl?: {
        cert: string;
        key: string;
        ca?: string;
    };
    maxConnections?: number;
    connectionTimeout?: number;
    authenticationRequired?: boolean;
    authenticationTimeout?: number;
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    maxMessageSize?: number;
    messageRateLimit?: {
        windowMs: number;
        maxMessages: number;
    };
}
interface ConnectionInfo {
    connection: WebSocketConnection;
    connectedAt: Date;
    lastActivity: Date;
    messageCount: number;
    authenticated: boolean;
}
export declare class MochiWebSocketServer extends EventEmitter {
    private server;
    private config;
    private connections;
    private authManager;
    private isRunning;
    constructor(authManager: AuthenticationManager, config: WebSocketServerConfig);
    /**
     * Start the WebSocket server
     */
    start(): Promise<void>;
    /**
     * Stop the WebSocket server
     */
    stop(): Promise<void>;
    /**
     * Check if server is running
     */
    isListening(): boolean;
    /**
     * Get all active connections
     */
    getConnections(): WebSocketConnection[];
    /**
     * Get connection by server ID
     */
    getConnection(serverId: string): WebSocketConnection | undefined;
    /**
     * Get connection count
     */
    getConnectionCount(): number;
    /**
     * Get server statistics
     */
    getStats(): {
        isRunning: boolean;
        connectionCount: number;
        totalConnections: number;
        authenticatedConnections: number;
        config: WebSocketServerConfig;
    };
    /**
     * Broadcast message to all authenticated connections
     */
    broadcast(message: any, filter?: (connection: WebSocketConnection) => boolean): Promise<void>;
    /**
     * Broadcast to specific server IDs
     */
    broadcastToServers(message: any, serverIds: string[]): Promise<void>;
    private setupServerHandlers;
    private handleNewConnection;
    private setupConnectionHandlers;
    private initiateAuthentication;
    /**
     * Get connection info for debugging
     */
    getConnectionInfo(serverId: string): ConnectionInfo | undefined;
    /**
     * Force disconnect a connection
     */
    disconnectServer(serverId: string, reason?: string): Promise<void>;
    /**
     * Get server address info
     */
    getAddressInfo(): {
        port: number;
        host: string;
        path: string;
    } | null;
}
export {};
