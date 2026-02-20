/**
 * WebSocket Connection Manager
 *
 * Central manager for WebSocket connections, handling both server and client
 * modes, connection lifecycle, authentication, and heartbeat management.
 */
import { EventEmitter } from 'events';
import { WebSocketServerConfig } from './server';
import { MochiWebSocketClient } from './client';
import { WebSocketConnection } from './connection';
import { TokenManager } from './auth';
import { HeartbeatConfig } from './heartbeat';
import { ProtocolHandler } from '../protocol/handler';
import { ConnectionSecurityConfig } from '../services/connection-security';
import { UWBPMessage, ServerConfig } from '../types';
export interface ConnectionManagerConfig {
    server?: WebSocketServerConfig;
    heartbeat?: Partial<HeartbeatConfig>;
    maxConnections?: number;
    connectionTimeout?: number;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    protocolHandler?: ProtocolHandler;
    authenticationRequired?: boolean;
    encryptionEnabled?: boolean;
    connectionSecurity?: Partial<ConnectionSecurityConfig>;
}
interface ConnectionEntry {
    connection: WebSocketConnection;
    mode: 'server' | 'client';
    config: ServerConfig;
    client?: MochiWebSocketClient;
    connectedAt: Date;
    lastActivity: Date;
    authenticated: boolean;
    capabilities: string[];
}
export declare class WebSocketConnectionManager extends EventEmitter {
    private config;
    private server?;
    private authManager;
    private heartbeatManager;
    private protocolHandler;
    private connectionSecurityManager?;
    private connections;
    private clients;
    private isRunning;
    constructor(tokenManager: TokenManager, config?: ConnectionManagerConfig, auditService?: any);
    /**
     * Start the connection manager
     */
    start(): Promise<void>;
    /**
     * Stop the connection manager
     */
    stop(): Promise<void>;
    /**
     * Check if manager is running
     */
    isActive(): boolean;
    /**
     * Connect to a server (forward connection mode)
     */
    connectToServer(serverConfig: ServerConfig): Promise<WebSocketConnection>;
    /**
     * Disconnect from a server
     */
    disconnectFromServer(serverId: string, reason?: string): Promise<void>;
    /**
     * Get connection by server ID
     */
    getConnection(serverId: string): WebSocketConnection | undefined;
    /**
     * Get all active connections
     */
    getConnections(): WebSocketConnection[];
    /**
     * Get connections by filter
     */
    getConnectionsByFilter(filter: (entry: ConnectionEntry) => boolean): WebSocketConnection[];
    /**
     * Send message to specific server
     */
    sendMessage(serverId: string, message: UWBPMessage): Promise<void>;
    /**
     * Broadcast message to all connected servers
     */
    broadcastMessage(message: UWBPMessage, filter?: (connection: WebSocketConnection) => boolean): Promise<void>;
    /**
     * Send request and wait for response
     */
    sendRequest(serverId: string, operation: string, data?: any, options?: {
        timeout?: number;
    }): Promise<any>;
    /**
     * Get connection statistics
     */
    getStats(): {
        isRunning: boolean;
        totalConnections: number;
        serverConnections: number;
        clientConnections: number;
        authenticatedConnections: number;
        serverStats?: any;
        heartbeatStats: any;
        protocolStats: any;
        connectionSecurityStats?: any;
    };
    /**
     * Get connection info for debugging
     */
    getConnectionInfo(serverId: string): any;
    private setupManagerHandlers;
    private setupConnectionSecurityHandlers;
    private setupServerHandlers;
    private setupClientHandlers;
    private registerConnection;
    private unregisterConnection;
    private handleIncomingMessage;
    private handleReconnectionRequired;
    private buildWebSocketURL;
    private getAuthToken;
}
export {};
