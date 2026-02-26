/**
 * Mochi-Link (����) - Caching Service and Data Preloading
 *
 * This module provides comprehensive caching mechanisms, data preloading,
 * and cache management for the Minecraft Unified Management System.
 */
import { Context } from 'koishi';
import { EventEmitter } from 'events';
export interface CacheConfig {
    maxMemorySize: number;
    defaultTTL: number;
    cleanupInterval: number;
    evictionPolicy: 'lru' | 'lfu' | 'ttl';
    compressionEnabled: boolean;
    persistToDisk: boolean;
    preloadEnabled: boolean;
    preloadInterval: number;
    preloadBatchSize: number;
    maxConcurrentOperations: number;
    operationTimeout: number;
}
export interface CacheStatistics {
    totalEntries: number;
    memoryUsage: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    evictionCount: number;
    preloadCount: number;
    compressionRatio: number;
}
export declare class CacheService extends EventEmitter {
    private ctx;
    private config;
    private memoryCache;
    private statistics;
    private cleanupTimer?;
    private preloadTimer?;
    private logger;
    constructor(ctx: Context, config?: Partial<CacheConfig>);
    /**
     * Get value from cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set value in cache
     */
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    /**
     * Delete value from cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Check if key exists in cache
     */
    has(key: string): boolean;
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    /**
     * Get multiple values from cache
     */
    getMultiple<T>(keys: string[]): Promise<Map<string, T>>;
    /**
     * Set multiple values in cache
     */
    setMultiple<T>(entries: Map<string, T>, ttl?: number): Promise<void>;
    /**
     * Delete multiple keys from cache
     */
    deleteMultiple(keys: string[]): Promise<number>;
    /**
     * Get keys matching a pattern
     */
    getKeysByPattern(pattern: string): string[];
    /**
     * Delete keys matching a pattern
     */
    deleteByPattern(pattern: string): Promise<number>;
    /**
     * Get values by pattern
     */
    getByPattern<T>(pattern: string): Promise<Map<string, T>>;
    /**
     * Preload frequently accessed data
     */
    preloadData(): Promise<void>;
    /**
     * Preload server configurations
     */
    private preloadServerConfigs;
    /**
     * Preload user permissions
     */
    private preloadUserPermissions;
    /**
     * Preload player information
     */
    private preloadPlayerInfo;
    /**
     * Preload monitoring data
     */
    private preloadMonitoringData;
    /**
     * Ensure cache has enough capacity
     */
    private ensureCapacity;
    /**
     * Evict entries based on configured policy
     */
    private evictEntries;
    /**
     * Clean up expired entries
     */
    private cleanupExpiredEntries;
    /**
     * Compress data
     */
    private compress;
    /**
     * Decompress data
     */
    private decompress;
    /**
     * Check if entry is expired
     */
    private isExpired;
    /**
     * Get current memory usage
     */
    private getCurrentMemoryUsage;
    /**
     * Update cache statistics
     */
    private updateStatistics;
    /**
     * Update hit rate
     */
    private updateHitRate;
    /**
     * Update compression ratio
     */
    private updateCompressionRatio;
    /**
     * Start cleanup timer
     */
    private startCleanupTimer;
    /**
     * Start preload timer
     */
    private startPreloadTimer;
    /**
     * Get cache statistics
     */
    getStatistics(): CacheStatistics;
    /**
     * Get cache configuration
     */
    getConfig(): CacheConfig;
    /**
     * Update cache configuration
     */
    updateConfig(newConfig: Partial<CacheConfig>): void;
    /**
     * Get health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    };
    /**
     * Cleanup and shutdown
     */
    shutdown(): Promise<void>;
}
