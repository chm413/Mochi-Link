/**
 * Mochi-Link (大福连) - Connection Pool and Resource Management
 *
 * This module provides connection pooling, resource management, and
 * performance optimization for WebSocket and database connections.
 */
import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { ConnectionAdapter, ConnectionInfo } from './types';
import { ServerConfig, UWBPMessage, CommandResult } from '../types';
export interface ConnectionPoolConfig {
    minConnections: number;
    maxConnections: number;
    maxIdleConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
    maxLifetime: number;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    maxConcurrentRequests: number;
    requestTimeout: number;
    maxRetries: number;
    retryDelay: number;
    enableMetrics: boolean;
    metricsInterval: number;
}
export interface PoolStatistics {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    pendingRequests: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    connectionUtilization: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}
export declare class ConnectionPool extends EventEmitter {
    private ctx;
    private config;
    private connections;
    private requestQueue;
    private statistics;
    private healthCheckTimer?;
    private metricsTimer?;
    private logger;
    constructor(ctx: Context, config?: Partial<ConnectionPoolConfig>);
    /**
     * Initialize the connection pool
     */
    initialize(): Promise<void>;
    /**
     * Get or create a connection for a server
     */
    getConnection(serverConfig: ServerConfig): Promise<ConnectionAdapter>;
    /**
     * Execute a request with connection pooling
     */
    executeRequest<T>(serverConfig: ServerConfig, request: (adapter: ConnectionAdapter) => Promise<T>): Promise<T>;
    /**
     * Send message through pooled connection
     */
    sendMessage(serverConfig: ServerConfig, message: UWBPMessage): Promise<void>;
    /**
     * Send command through pooled connection
     */
    sendCommand(serverConfig: ServerConfig, command: string): Promise<CommandResult>;
    /**
     * Create a new pooled connection
     */
    private createConnection;
    /**
     * Remove a connection from the pool
     */
    removeConnection(serverId: string): Promise<void>;
    /**
     * Setup event handlers for a pooled connection
     */
    private setupConnectionHandlers;
    /**
     * Process the request queue
     */
    private processQueue;
    /**
     * Process a single request
     */
    private processRequest;
    /**
     * Remove request from queue
     */
    private removeFromQueue;
    /**
     * Start health checking
     */
    private startHealthChecking;
    /**
     * Perform health check on all connections
     */
    private performHealthCheck;
    /**
     * Check health of a single connection
     */
    private checkConnectionHealth;
    /**
     * Clean up expired connections
     */
    private cleanupExpiredConnections;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Update pool statistics
     */
    private updatePoolStatistics;
    /**
     * Determine overall health status
     */
    private determineHealthStatus;
    /**
     * Update average response time
     */
    private updateAverageResponseTime;
    /**
     * Get available request slots
     */
    private getAvailableRequestSlots;
    /**
     * Find an idle connection
     */
    private findIdleConnection;
    /**
     * Check if connection is expired
     */
    private isConnectionExpired;
    /**
     * Get pool statistics
     */
    getStatistics(): PoolStatistics;
    /**
     * Get connection information
     */
    getConnectionInfo(): Map<string, ConnectionInfo>;
    /**
     * Force cleanup of all connections
     */
    cleanup(): Promise<void>;
    /**
     * Get health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    };
}
export declare class ResourceManager {
    private ctx;
    private memoryUsage;
    private cpuUsage;
    private logger;
    constructor(ctx: Context);
    /**
     * Start resource monitoring
     */
    private startResourceMonitoring;
    /**
     * Collect resource metrics
     */
    private collectResourceMetrics;
    /**
     * Get resource statistics
     */
    getResourceStats(): {
        memory: {
            heapUsed: number;
            heapTotal: number;
            external: number;
            rss: number;
        };
        cpu: {
            user: number;
            system: number;
        };
    };
    /**
     * Check if resources are under pressure
     */
    isUnderResourcePressure(): boolean;
}
