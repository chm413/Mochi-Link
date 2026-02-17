/**
 * System Integration Service
 *
 * This service handles the integration of all components and services,
 * providing centralized system management, health monitoring, and configuration.
 */
import { Context } from 'koishi';
import { EventEmitter } from 'events';
import { PluginConfig, SystemHealth } from '../types';
import { ServiceManager } from './index';
import { WebSocketConnectionManager } from '../websocket/manager';
import { HTTPServer } from '../http/server';
import { DatabaseManager } from '../database/operations';
export interface SystemIntegrationConfig {
    startupOrder: string[];
    healthCheck: {
        interval: number;
        timeout: number;
        retries: number;
    };
    shutdown: {
        timeout: number;
        forceTimeout: number;
    };
    monitoring: {
        enabled: boolean;
        metricsInterval: number;
        alertThresholds: {
            memoryUsage: number;
            cpuUsage: number;
            responseTime: number;
            errorRate: number;
        };
    };
}
interface SystemMetrics {
    timestamp: number;
    uptime: number;
    memoryUsage: {
        used: number;
        total: number;
        percentage: number;
    };
    cpuUsage: number;
    connections: {
        websocket: number;
        http: number;
        database: number;
    };
    performance: {
        avgResponseTime: number;
        requestsPerMinute: number;
        errorRate: number;
    };
    services: {
        [serviceName: string]: {
            status: string;
            responseTime: number;
            errorCount: number;
        };
    };
}
export declare class SystemIntegrationService extends EventEmitter {
    private ctx;
    private pluginConfig;
    private logger;
    private config;
    private components;
    private isInitialized;
    private isShuttingDown;
    private startTime;
    private healthCheckInterval?;
    private metricsInterval?;
    private currentMetrics?;
    private serviceManager?;
    private websocketManager?;
    private httpServer?;
    private databaseManager?;
    constructor(ctx: Context, pluginConfig: PluginConfig, config?: Partial<SystemIntegrationConfig>);
    /**
     * Initialize the entire system
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the entire system gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Force shutdown (emergency stop)
     */
    forceShutdown(): Promise<void>;
    /**
     * Initialize a specific component
     */
    private initializeComponent;
    /**
     * Shutdown a specific component
     */
    private shutdownComponent;
    /**
     * Force stop a component
     */
    private forceStopComponent;
    private initializeDatabase;
    private initializeServices;
    private initializeWebSocket;
    private initializeHTTP;
    private shutdownHTTP;
    private shutdownWebSocket;
    private shutdownServices;
    private shutdownDatabase;
    private startHealthMonitoring;
    private stopHealthMonitoring;
    private performHealthCheck;
    private checkComponentHealth;
    private startMetricsCollection;
    private stopMetricsCollection;
    private collectMetrics;
    private checkAlertThresholds;
    /**
     * Get overall system health
     */
    getSystemHealth(): Promise<SystemHealth>;
    /**
     * Get current system metrics
     */
    getCurrentMetrics(): SystemMetrics | undefined;
    /**
     * Get system statistics
     */
    getSystemStats(): any;
    /**
     * Get service manager instance
     */
    getServiceManager(): ServiceManager | undefined;
    /**
     * Get WebSocket manager instance
     */
    getWebSocketManager(): WebSocketConnectionManager | undefined;
    /**
     * Get HTTP server instance
     */
    getHTTPServer(): HTTPServer | undefined;
    /**
     * Check if system is ready
     */
    isReady(): boolean;
    /**
     * Get database manager instance (for external access)
     */
    getDatabaseManager(): DatabaseManager | undefined;
    private setupComponentDefinitions;
    private cleanup;
}
export default SystemIntegrationService;
