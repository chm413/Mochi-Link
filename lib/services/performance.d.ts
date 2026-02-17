/**
 * Mochi-Link (大福连) - Performance Optimization Service
 *
 * This service integrates database optimization, connection pooling, and caching
 * to provide comprehensive performance optimization for the system.
 */
import { Context } from 'koishi';
import { EventEmitter } from 'events';
import { DatabaseManager } from '../database/operations';
export interface PerformanceConfig {
    database: {
        enableQueryCache: boolean;
        cacheSize: number;
        cacheTTL: number;
        slowQueryThreshold: number;
        batchSize: number;
    };
    connectionPool: {
        minConnections: number;
        maxConnections: number;
        maxIdleConnections: number;
        connectionTimeout: number;
        idleTimeout: number;
        maxLifetime: number;
    };
    cache: {
        maxMemorySize: number;
        defaultTTL: number;
        preloadEnabled: boolean;
        preloadInterval: number;
        compressionEnabled: boolean;
    };
    resources: {
        memoryThreshold: number;
        cpuThreshold: number;
        enableAutoOptimization: boolean;
        optimizationInterval: number;
    };
    monitoring: {
        enableMetrics: boolean;
        metricsInterval: number;
        alertThresholds: {
            responseTime: number;
            errorRate: number;
            resourceUsage: number;
        };
    };
}
export interface PerformanceMetrics {
    database: {
        queryCount: number;
        averageQueryTime: number;
        slowQueries: number;
        cacheHitRate: number;
    };
    connections: {
        totalConnections: number;
        activeConnections: number;
        averageResponseTime: number;
        connectionUtilization: number;
    };
    cache: {
        hitRate: number;
        memoryUsage: number;
        totalEntries: number;
        evictionCount: number;
    };
    resources: {
        memoryUsage: number;
        cpuUsage: number;
        heapUtilization: number;
    };
    overall: {
        healthStatus: 'healthy' | 'degraded' | 'unhealthy';
        performanceScore: number;
        recommendations: string[];
    };
}
export declare class PerformanceOptimizationService extends EventEmitter {
    private ctx;
    private dbManager;
    private config;
    private dbOptimizer;
    private connectionPool;
    private cacheService;
    private resourceManager;
    private metricsTimer?;
    private optimizationTimer?;
    private logger;
    constructor(ctx: Context, dbManager: DatabaseManager, config?: Partial<PerformanceConfig>);
    /**
     * Initialize performance optimization components
     */
    private initializeComponents;
    /**
     * Setup event handlers for components
     */
    private setupEventHandlers;
    /**
     * Initialize the performance optimization service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the performance optimization service
     */
    shutdown(): Promise<void>;
    /**
     * Get server with optimization
     */
    getServerOptimized(serverId: string): Promise<any>;
    /**
     * Get user permissions with optimization
     */
    getUserPermissionsOptimized(userId: string): Promise<any[]>;
    /**
     * Get audit logs with optimization
     */
    getAuditLogsOptimized(filters: any): Promise<{
        logs: any[];
        total: number;
    }>;
    /**
     * Execute request through connection pool
     */
    executePooledRequest<T>(serverConfig: any, request: (adapter: any) => Promise<T>): Promise<T>;
    /**
     * Send message through connection pool
     */
    sendPooledMessage(serverConfig: any, message: any): Promise<void>;
    /**
     * Send command through connection pool
     */
    sendPooledCommand(serverConfig: any, command: string): Promise<any>;
    /**
     * Invalidate cache entries by pattern
     */
    invalidateCache(pattern: string): Promise<void>;
    /**
     * Preload frequently accessed data
     */
    preloadData(): Promise<void>;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Collect performance metrics
     */
    private collectMetrics;
    /**
     * Get comprehensive performance metrics
     */
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    /**
     * Check for performance alerts
     */
    private checkPerformanceAlerts;
    /**
     * Start automatic optimization
     */
    private startAutoOptimization;
    /**
     * Perform automatic optimization
     */
    private performAutoOptimization;
    /**
     * Optimize memory usage
     */
    private optimizeMemoryUsage;
    /**
     * Optimize cache performance
     */
    private optimizeCachePerformance;
    /**
     * Optimize database performance
     */
    private optimizeDatabasePerformance;
    /**
     * Calculate overall health status
     */
    private calculateOverallHealth;
    /**
     * Calculate performance score (0-100)
     */
    private calculatePerformanceScore;
    /**
     * Generate performance recommendations
     */
    private generateRecommendations;
    /**
     * Get performance configuration
     */
    getConfig(): PerformanceConfig;
    /**
     * Update performance configuration
     */
    updateConfig(newConfig: Partial<PerformanceConfig>): void;
    /**
     * Get health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
}
