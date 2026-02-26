/**
 * Mochi-Link (大福连) - Database Performance Optimization
 *
 * This module provides database query optimization, indexing strategies,
 * and performance monitoring for the Minecraft Unified Management System.
 */
import { Context } from 'koishi';
import { DatabaseManager } from './operations';
export interface QueryOptimizationConfig {
    enableQueryCache: boolean;
    cacheSize: number;
    cacheTTL: number;
    enableQueryLogging: boolean;
    slowQueryThreshold: number;
    enableIndexHints: boolean;
    batchSize: number;
}
export interface QueryPerformanceMetrics {
    queryType: string;
    executionTime: number;
    rowsAffected: number;
    cacheHit: boolean;
    timestamp: number;
}
export interface IndexRecommendation {
    table: string;
    columns: string[];
    type: 'btree' | 'hash' | 'composite';
    reason: string;
    estimatedImprovement: number;
}
export declare class DatabaseQueryOptimizer {
    private ctx;
    private dbManager;
    private config;
    private queryCache;
    private performanceMetrics;
    private logger;
    constructor(ctx: Context, dbManager: DatabaseManager, config?: Partial<QueryOptimizationConfig>);
    /**
     * Optimized server queries with caching
     */
    getServerOptimized(serverId: string): Promise<any>;
    /**
     * Batch server queries for better performance
     */
    getServersBatch(serverIds: string[]): Promise<any[]>;
    /**
     * Optimized ACL queries with indexing hints
     */
    getUserPermissionsOptimized(userId: string): Promise<any[]>;
    /**
     * Optimized audit log queries with pagination
     */
    getAuditLogsOptimized(filters: {
        userId?: string;
        serverId?: string;
        operation?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: any[];
        total: number;
    }>;
    /**
     * Optimized pending operations with conflict detection
     */
    optimizePendingOperations(serverId: string): Promise<number>;
    /**
     * Invalidate cache entries
     */
    invalidateCache(pattern: string): void;
    /**
     * Warm up cache with frequently accessed data
     */
    warmUpCache(): Promise<void>;
    /**
     * Record query performance metrics
     */
    private recordMetrics;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        totalQueries: number;
        averageExecutionTime: number;
        slowQueries: number;
        cacheStats: any;
        queryTypeStats: Record<string, {
            count: number;
            avgTime: number;
        }>;
    };
    /**
     * Generate index recommendations
     */
    generateIndexRecommendations(): Promise<IndexRecommendation[]>;
    /**
     * Check if two operations are contradictory
     */
    private areContradictoryOperations;
    /**
     * Clear all performance metrics
     */
    clearMetrics(): void;
    /**
     * Get health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    };
}
