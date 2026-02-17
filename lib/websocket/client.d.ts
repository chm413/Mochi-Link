/**
 * WebSocket Client Implementation
 *
 * Implements WebSocket client for forward connection mode where
 * Koishi plugin connects to Connector_Bridge as WebSocket client.
 */
import { EventEmitter } from 'events';
import { WebSocketConnection } from './connection';
import { AuthenticationManager } from './auth';
export interface WebSocketClientConfig {
    url: string;
    serverId: string;
    authToken?: string;
    authMethod?: 'token' | 'certificate';
    ssl?: {
        rejectUnauthorized?: boolean;
        cert?: string;
        key?: string;
        ca?: string;
    };
    connectionTimeout?: number;
    authenticationTimeout?: number;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    reconnectBackoffMultiplier?: number;
    maxReconnectInterval?: number;
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    protocolVersion?: string;
    capabilities?: string[];
    headers?: Record<string, string>;
}
export declare class MochiWebSocketClient extends EventEmitter {
    private config;
    private connection?;
    private authManager;
    private reconnectionState;
    private isConnecting;
    private isShuttingDown;
    constructor(authManager: AuthenticationManager, config: WebSocketClientConfig);
    /**
     * Connect to WebSocket server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from WebSocket server
     */
    disconnect(reason?: string): Promise<void>;
    /**
     * Check if client is connected
     */
    isConnected(): boolean;
    /**
     * Get current connection
     */
    getConnection(): WebSocketConnection | undefined;
    /**
     * Send message through connection
     */
    send(message: any): Promise<void>;
    /**
     * Enable/disable auto-reconnection
     */
    setAutoReconnect(enabled: boolean): void;
    /**
     * Manually trigger reconnection
     */
    reconnect(): Promise<void>;
    /**
     * Get reconnection status
     */
    getReconnectionStatus(): {
        isReconnecting: boolean;
        attempts: number;
        nextAttemptIn?: number;
        lastError?: string;
    };
    /**
     * Get client statistics
     */
    getStats(): {
        isConnected: boolean;
        serverId: string;
        connectionStats?: any;
        reconnectionStats: {
            attempts: number;
            isReconnecting: boolean;
            autoReconnectEnabled: boolean;
        };
    };
    private establishConnection;
    private setupConnectionHandlers;
    private setupOngoingHandlers;
    private performHandshake;
    private scheduleReconnection;
    private cancelReconnection;
    private resetReconnectionState;
}
