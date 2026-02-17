/**
 * Connection Mode Manager
 *
 * Central manager for handling different connection modes, dynamic switching,
 * connection state management, and error recovery mechanisms.
 */
import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { ConnectionAdapter, ConnectionInfo } from './types';
import { ServerConfig, ConnectionMode, ConnectionConfig, UWBPMessage, CommandResult } from '../types';
export interface ConnectionManagerConfig {
    maxRetryAttempts?: number;
    retryInterval?: number;
    exponentialBackoff?: boolean;
    healthCheckInterval?: number;
    healthCheckTimeout?: number;
    autoSwitchOnFailure?: boolean;
    preferredModeOrder?: ConnectionMode[];
    enableMetrics?: boolean;
    metricsInterval?: number;
}
export declare class ConnectionModeManager extends EventEmitter {
    private config;
    private connections;
    private ctx;
    constructor(ctx: Context, config?: ConnectionManagerConfig);
    /**
     * Establish connection to a server
     */
    establishConnection(serverConfig: ServerConfig): Promise<ConnectionAdapter>;
    /**
     * Disconnect from a server
     */
    disconnectServer(serverId: string): Promise<void>;
    /**
     * Remove connection completely
     */
    removeConnection(serverId: string): Promise<void>;
    /**
     * Switch connection mode for a server
     */
    switchConnectionMode(serverId: string, newMode: ConnectionMode, newConfig?: ConnectionConfig): Promise<void>;
    /**
     * Get connection adapter for a server
     */
    getConnection(serverId: string): ConnectionAdapter | undefined;
    /**
     * Get connection information
     */
    getConnectionInfo(serverId: string): ConnectionInfo | undefined;
    /**
     * Get all connection information
     */
    getAllConnectionInfo(): Map<string, ConnectionInfo>;
    /**
     * Check if server is connected
     */
    isConnected(serverId: string): boolean;
    /**
     * Get connection status
     */
    getConnectionStatus(serverId: string): string | undefined;
    /**
     * Send message to server
     */
    sendMessage(serverId: string, message: UWBPMessage): Promise<void>;
    /**
     * Send command to server
     */
    sendCommand(serverId: string, command: string): Promise<CommandResult>;
    private attemptModeSwitch;
    private scheduleReconnect;
    private startHealthCheck;
    private createAdapter;
    private setupAdapterHandlers;
    private getAvailableModes;
    private extractModeConfig;
    private clearTimers;
    /**
     * Get connection statistics
     */
    getStats(): {
        totalConnections: number;
        connectedCount: number;
        disconnectedCount: number;
        errorCount: number;
        modeDistribution: Record<ConnectionMode, number>;
        healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    };
    /**
     * Cleanup all connections
     */
    cleanup(): Promise<void>;
}
