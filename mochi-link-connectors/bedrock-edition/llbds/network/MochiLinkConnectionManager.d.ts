import { EventEmitter } from 'events';
import * as winston from 'winston';
import { LLBDSConfig } from '../config/LLBDSConfig';
/**
 * Mochi-Link Connection Manager
 *
 * Manages WebSocket connection to the Mochi-Link management system
 * from the external Node.js service.
 *
 * @author chm413
 * @version 1.0.0
 */
export declare class MochiLinkConnectionManager extends EventEmitter {
    private config;
    private logger;
    private ws;
    private _isConnected;
    private _isConnecting;
    private reconnectionManager;
    private heartbeatInterval;
    private connectionTimeout;
    private messageQueue;
    private pendingMessages;
    constructor(config: LLBDSConfig, logger: winston.Logger);
    /**
     * Connect to Mochi-Link management system
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Mochi-Link
     */
    disconnect(): Promise<void>;
    /**
     * Send message to Mochi-Link
     */
    send(message: any): Promise<void>;
    /**
     * Setup WebSocket event handlers
     */
    private setupWebSocketHandlers;
    /**
     * Handle connection open
     */
    private handleConnectionOpen;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Handle system messages
     */
    private handleSystemMessage;
    /**
     * Handle handshake message
     */
    private handleHandshake;
    /**
     * Handle ping message
     */
    private handlePing;
    /**
     * Handle disconnect request
     */
    private handleDisconnectRequest;
    /**
     * Handle connection close
     */
    private handleConnectionClose;
    /**
     * Handle connection error
     */
    private handleConnectionError;
    /**
     * Get reconnection status
     */
    getReconnectionStatus(): import("../common/ReconnectionManager").ReconnectionStatus;
    /**
     * Enable reconnection
     */
    enableReconnection(): void;
    /**
     * Disable reconnection
     */
    disableReconnection(): void;
    /**
     * Start heartbeat
     */
    private startHeartbeat;
    /**
     * Generate unique message ID
     */
    private generateId;
    /**
     * Clear heartbeat interval
     */
    private clearHeartbeat;
    /**
     * Clear connection timeout
     */
    private clearConnectionTimeout;
    /**
     * Send queued messages
     */
    private sendQueuedMessages;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Check if connecting
     */
    isConnecting(): boolean;
    /**
     * Get connection status
     */
    getConnectionStatus(): string;
    /**
     * Get connection statistics
     */
    getConnectionStats(): any;
    /**
     * Reset connection state
     */
    reset(): void;
}
//# sourceMappingURL=MochiLinkConnectionManager.d.ts.map