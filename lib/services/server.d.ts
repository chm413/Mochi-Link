/**
 * Mochi-Link (大福连) - Server Configuration Management Service
 *
 * This service handles server registration, configuration management,
 * status tracking, and multi-server concurrent management.
 */
import { Context } from 'koishi';
import { ServerConfig, ConnectionConfig, ConnectionMode, CoreType, ServerStatus } from '../types';
import { BaseConnectorBridge } from '../bridge/base';
import { DatabaseManager } from '../database/operations';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
import { TokenManager } from './token';
import { PluginIntegrationService } from './plugin-integration';
export interface ServerRegistrationOptions {
    name: string;
    coreType: CoreType;
    coreName: string;
    coreVersion: string;
    connectionMode: ConnectionMode;
    connectionConfig: ConnectionConfig;
    ownerId: string;
    tags?: string[];
    autoConnect?: boolean;
}
export interface ServerUpdateOptions {
    name?: string;
    coreName?: string;
    coreVersion?: string;
    connectionMode?: ConnectionMode;
    connectionConfig?: ConnectionConfig;
    tags?: string[];
}
export interface ServerStatusInfo {
    serverId: string;
    status: ServerStatus;
    lastSeen?: Date;
    connectionMode: ConnectionMode;
    uptime?: number;
    playerCount?: number;
    tps?: number;
    memoryUsage?: {
        used: number;
        max: number;
        percentage: number;
    };
}
export interface ServerSummary {
    id: string;
    name: string;
    coreType: CoreType;
    coreName: string;
    status: ServerStatus;
    ownerId: string;
    tags: string[];
    lastSeen?: Date;
    playerCount?: number;
}
export declare class ServerManager {
    private ctx;
    private db;
    private audit;
    private permission;
    private token;
    private pluginIntegration?;
    private connections;
    private bridges;
    private statusCache;
    private reconnectTimers;
    private connectionManager;
    constructor(ctx: Context, db: DatabaseManager, audit: AuditService, permission: PermissionManager, token: TokenManager, pluginIntegration?: PluginIntegrationService);
    /**
     * Register a new server
     */
    registerServer(options: ServerRegistrationOptions, operatorId: string, ipAddress?: string): Promise<ServerConfig>;
    /**
     * Get server configuration by ID
     */
    getServer(serverId: string): Promise<ServerConfig | null>;
    /**
     * Get all servers
     */
    getAllServers(): Promise<ServerConfig[]>;
    /**
     * Get servers by owner
     */
    getServersByOwner(ownerId: string): Promise<ServerConfig[]>;
    /**
     * Get server summaries (lightweight view)
     */
    getServerSummaries(userId?: string): Promise<ServerSummary[]>;
    /**
     * Update server configuration
     */
    updateServer(serverId: string, updates: ServerUpdateOptions, operatorId: string, ipAddress?: string): Promise<ServerConfig>;
    /**
     * Delete server
     */
    deleteServer(serverId: string, operatorId: string, ipAddress?: string): Promise<boolean>;
    /**
     * Get server status information
     */
    getServerStatus(serverId: string): ServerStatusInfo | null;
    /**
     * Get all server statuses
     */
    getAllServerStatuses(): Map<string, ServerStatusInfo>;
    /**
     * Update server status
     */
    updateServerStatus(serverId: string, status: ServerStatus, additionalInfo?: Partial<ServerStatusInfo>): Promise<void>;
    /**
     * Check if server is online
     */
    isServerOnline(serverId: string): boolean;
    /**
     * Get online servers count
     */
    getOnlineServersCount(): number;
    /**
     * Execute operation on multiple servers concurrently
     */
    executeOnMultipleServers<T>(serverIds: string[], operation: (serverId: string) => Promise<T>, options?: {
        maxConcurrency?: number;
        continueOnError?: boolean;
        timeout?: number;
    }): Promise<Map<string, {
        success: boolean;
        result?: T;
        error?: Error;
    }>>;
    /**
     * Broadcast command to multiple servers
     */
    broadcastCommand(serverIds: string[], command: string, operatorId: string, options?: {
        maxConcurrency?: number;
        timeout?: number;
    }): Promise<Map<string, {
        success: boolean;
        output?: string[];
        error?: Error;
    }>>;
    /**
     * Get health status of all servers
     */
    getSystemHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        totalServers: number;
        onlineServers: number;
        offlineServers: number;
        errorServers: number;
        details: ServerStatusInfo[];
    }>;
    /**
     * Connect to a server
     */
    connectServer(serverId: string): Promise<void>;
    /**
     * Disconnect from a server
     */
    disconnectServer(serverId: string): Promise<void>;
    /**
     * Switch connection mode for a server
     */
    switchConnectionMode(serverId: string, newMode: ConnectionMode, newConfig?: ConnectionConfig, operatorId?: string, ipAddress?: string): Promise<void>;
    /**
     * Get connection information for a server
     */
    getConnectionInfo(serverId: string): any;
    /**
     * Get all connection information
     */
    getAllConnectionInfo(): Map<string, any>;
    /**
     * Schedule connection attempt
     */
    private scheduleConnection;
    /**
     * Clear reconnect timer for server
     */
    private clearReconnectTimer;
    /**
     * Generate unique server ID
     */
    private generateServerId;
    /**
     * Validate connection configuration
     */
    private validateConnectionConfig;
    /**
     * Extract IP addresses from connection configuration for token whitelist
     */
    private extractIPFromConnectionConfig;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Get bridge instance for a server
     */
    getBridge(serverId: string): BaseConnectorBridge | null;
    /**
     * Create a bridge for a WebSocket connection
     */
    createWebSocketBridge(serverId: string, connection: any): Promise<void>;
    /**
     * Remove bridge for a server
     */
    removeBridge(serverId: string): Promise<void>;
    /**
     * Set up plugin integration for a server bridge
     */
    setupPluginIntegration(serverId: string, bridge: BaseConnectorBridge): Promise<void>;
    /**
     * Clean up plugin integration for a server
     */
    cleanupPluginIntegration(serverId: string): Promise<void>;
    /**
     * Create a bridge wrapper around a connection for backward compatibility
     */
    private createBridgeWrapper;
    /**
     * Setup connection manager event handlers
     */
    private setupConnectionManagerHandlers;
    /**
     * Create a Connection wrapper for backward compatibility
     */
    private createConnectionWrapper;
}
