/**
 * WebSocket Connection Implementation
 *
 * Implements the Connection interface for WebSocket connections,
 * providing message sending, connection management, and state tracking.
 */
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Connection, UWBPMessage, ConnectionMode } from '../types';
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'closing';
export interface ConnectionStats {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    lastActivity: number;
    connectionTime: number;
    errors: number;
}
export declare class WebSocketConnection extends EventEmitter implements Connection {
    readonly serverId: string;
    readonly mode: ConnectionMode;
    capabilities: string[];
    lastPing?: number;
    private ws;
    private _status;
    private stats;
    private messageQueue;
    private isAuthenticated;
    private authToken?;
    private encryptionEnabled;
    private encryptionKey?;
    constructor(ws: WebSocket, serverId: string, mode?: ConnectionMode, options?: {
        authToken?: string;
        encryptionEnabled?: boolean;
        encryptionKey?: string;
    });
    get status(): 'connected' | 'disconnected' | 'connecting' | 'error';
    send(message: UWBPMessage): Promise<void>;
    close(code?: number, reason?: string): Promise<void>;
    /**
     * Check if connection is ready for communication
     */
    isReady(): boolean;
    /**
     * Get connection statistics
     */
    getStats(): ConnectionStats;
    /**
     * Set authentication status
     */
    setAuthenticated(authenticated: boolean, token?: string): void;
    /**
     * Update capabilities
     */
    updateCapabilities(capabilities: string[]): void;
    /**
     * Enable/disable encryption
     */
    setEncryption(enabled: boolean, key?: string): void;
    private setupWebSocketHandlers;
    private handleIncomingMessage;
    private sendRaw;
    private processMessageQueue;
    /**
     * Get connection info for debugging
     */
    getConnectionInfo(): {
        serverId: string;
        status: ConnectionState;
        mode: ConnectionMode;
        isAuthenticated: boolean;
        capabilities: string[];
        stats: ConnectionStats;
        queuedMessages: number;
    };
    /**
     * Ping the connection
     */
    ping(data?: Buffer): void;
    /**
     * Check if WebSocket is alive
     */
    isAlive(): boolean;
}
