"use strict";
/**
 * Mochi-Link (大福连) - Caching Service and Data Preloading
 *
 * This module provides comprehensive caching mechanisms, data preloading,
 * and cache management for the Minecraft Unified Management System.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const events_1 = require("events");
// ============================================================================
// Multi-Level Cache System
// ============================================================================
class CacheService extends events_1.EventEmitter {
    constructor(ctx, config) {
        super();
        this.ctx = ctx;
        this.memoryCache = new Map();
        this.logger = ctx.logger('mochi-link:cache');
        this.config = {
            maxMemorySize: 100 * 1024 * 1024, // 100MB
            defaultTTL: 300000, // 5 minutes
            cleanupInterval: 60000, // 1 minute
            evictionPolicy: 'lru',
            compressionEnabled: true,
            persistToDisk: false,
            preloadEnabled: true,
            preloadInterval: 300000, // 5 minutes
            preloadBatchSize: 50,
            maxConcurrentOperations: 10,
            operationTimeout: 30000,
            ...config
        };
        this.statistics = {
            totalEntries: 0,
            memoryUsage: 0,
            hitCount: 0,
            missCount: 0,
            hitRate: 0,
            evictionCount: 0,
            preloadCount: 0,
            compressionRatio: 0
        };
        this.startCleanupTimer();
        this.startPreloadTimer();
    }
    // ============================================================================
    // Core Cache Operations
    // ============================================================================
    /**
     * Get value from cache
     */
    async get(key) {
        const entry = this.memoryCache.get(key);
        if (!entry) {
            this.statistics.missCount++;
            this.updateHitRate();
            return null;
        }
        // Check if entry has expired
        if (this.isExpired(entry)) {
            this.memoryCache.delete(key);
            this.statistics.missCount++;
            this.updateHitRate();
            return null;
        }
        // Update access statistics
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        this.statistics.hitCount++;
        this.updateHitRate();
        // Decompress if needed
        let value = entry.value;
        if (entry.compressed && this.config.compressionEnabled) {
            value = await this.decompress(value);
        }
        return value;
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl) {
        const entryTTL = ttl || this.config.defaultTTL;
        const now = Date.now();
        // Calculate entry size
        const serializedValue = JSON.stringify(value);
        let entryValue = value;
        let compressed = false;
        let size = Buffer.byteLength(serializedValue, 'utf8');
        // Compress if enabled and beneficial
        if (this.config.compressionEnabled && size > 1024) {
            const compressedValue = await this.compress(serializedValue);
            if (compressedValue.length < size * 0.8) { // Only use if 20% smaller
                entryValue = compressedValue;
                compressed = true;
                size = compressedValue.length;
            }
        }
        const entry = {
            key,
            value: entryValue,
            ttl: entryTTL,
            createdAt: now,
            lastAccessed: now,
            accessCount: 0,
            size,
            compressed
        };
        // Check if we need to evict entries
        await this.ensureCapacity(size);
        // Store the entry
        this.memoryCache.set(key, entry);
        this.updateStatistics();
        this.emit('set', key, size);
    }
    /**
     * Delete value from cache
     */
    async delete(key) {
        const deleted = this.memoryCache.delete(key);
        if (deleted) {
            this.updateStatistics();
            this.emit('delete', key);
        }
        return deleted;
    }
    /**
     * Check if key exists in cache
     */
    has(key) {
        const entry = this.memoryCache.get(key);
        return entry !== undefined && !this.isExpired(entry);
    }
    /**
     * Clear all cache entries
     */
    async clear() {
        this.memoryCache.clear();
        this.updateStatistics();
        this.emit('clear');
    }
    // ============================================================================
    // Batch Operations
    // ============================================================================
    /**
     * Get multiple values from cache
     */
    async getMultiple(keys) {
        const results = new Map();
        const promises = keys.map(async (key) => {
            const value = await this.get(key);
            if (value !== null) {
                results.set(key, value);
            }
        });
        await Promise.all(promises);
        return results;
    }
    /**
     * Set multiple values in cache
     */
    async setMultiple(entries, ttl) {
        const promises = Array.from(entries.entries()).map(([key, value]) => this.set(key, value, ttl));
        await Promise.all(promises);
    }
    /**
     * Delete multiple keys from cache
     */
    async deleteMultiple(keys) {
        let deletedCount = 0;
        for (const key of keys) {
            if (await this.delete(key)) {
                deletedCount++;
            }
        }
        return deletedCount;
    }
    // ============================================================================
    // Pattern-Based Operations
    // ============================================================================
    /**
     * Get keys matching a pattern
     */
    getKeysByPattern(pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(this.memoryCache.keys()).filter(key => regex.test(key));
    }
    /**
     * Delete keys matching a pattern
     */
    async deleteByPattern(pattern) {
        const keys = this.getKeysByPattern(pattern);
        return await this.deleteMultiple(keys);
    }
    /**
     * Get values by pattern
     */
    async getByPattern(pattern) {
        const keys = this.getKeysByPattern(pattern);
        return await this.getMultiple(keys);
    }
    // ============================================================================
    // Data Preloading
    // ============================================================================
    /**
     * Preload frequently accessed data
     */
    async preloadData() {
        if (!this.config.preloadEnabled) {
            return;
        }
        this.logger.debug('Starting data preload...');
        try {
            // Preload server configurations
            await this.preloadServerConfigs();
            // Preload user permissions
            await this.preloadUserPermissions();
            // Preload player information
            await this.preloadPlayerInfo();
            // Preload monitoring data
            await this.preloadMonitoringData();
            this.statistics.preloadCount++;
            this.logger.debug('Data preload completed successfully');
        }
        catch (error) {
            this.logger.error('Data preload failed:', error);
        }
    }
    /**
     * Preload server configurations
     */
    async preloadServerConfigs() {
        try {
            // Get recently active servers
            const recentServers = await this.ctx.database.get('minecraft_servers', {
                last_seen: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
            });
            for (const server of recentServers.slice(0, this.config.preloadBatchSize)) {
                const cacheKey = `server:config:${server.id}`;
                await this.set(cacheKey, server, this.config.defaultTTL);
            }
            this.logger.debug(`Preloaded ${recentServers.length} server configurations`);
        }
        catch (error) {
            this.logger.error('Failed to preload server configs:', error);
        }
    }
    /**
     * Preload user permissions
     */
    async preloadUserPermissions() {
        try {
            // Get active user permissions
            const activeACLs = await this.ctx.database.get('server_acl', {
                $or: [
                    { expires_at: null },
                    { expires_at: { $gt: new Date() } }
                ]
            });
            // Group by user
            const userPermissions = new Map();
            for (const acl of activeACLs) {
                if (!userPermissions.has(acl.user_id)) {
                    userPermissions.set(acl.user_id, []);
                }
                userPermissions.get(acl.user_id).push(acl);
            }
            // Cache user permissions
            let count = 0;
            for (const [userId, permissions] of userPermissions) {
                if (count >= this.config.preloadBatchSize)
                    break;
                const cacheKey = `user:permissions:${userId}`;
                await this.set(cacheKey, permissions, this.config.defaultTTL / 2);
                count++;
            }
            this.logger.debug(`Preloaded permissions for ${count} users`);
        }
        catch (error) {
            this.logger.error('Failed to preload user permissions:', error);
        }
    }
    /**
     * Preload player information
     */
    async preloadPlayerInfo() {
        try {
            // Get recently seen players
            const recentPlayers = await this.ctx.database.get('player_cache', {
                last_seen: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
            }, {
                limit: this.config.preloadBatchSize
            });
            for (const player of recentPlayers) {
                const cacheKey = `player:info:${player.uuid || player.name}`;
                await this.set(cacheKey, player, this.config.defaultTTL);
            }
            this.logger.debug(`Preloaded ${recentPlayers.length} player records`);
        }
        catch (error) {
            this.logger.error('Failed to preload player info:', error);
        }
    }
    /**
     * Preload monitoring data
     */
    async preloadMonitoringData() {
        try {
            // This would preload recent monitoring metrics
            // For now, we'll just log that it would happen
            this.logger.debug('Monitoring data preload would happen here');
        }
        catch (error) {
            this.logger.error('Failed to preload monitoring data:', error);
        }
    }
    // ============================================================================
    // Cache Management
    // ============================================================================
    /**
     * Ensure cache has enough capacity
     */
    async ensureCapacity(requiredSize) {
        const currentSize = this.getCurrentMemoryUsage();
        if (currentSize + requiredSize <= this.config.maxMemorySize) {
            return;
        }
        // Need to evict entries
        const targetSize = this.config.maxMemorySize * 0.8; // Target 80% capacity
        const sizeToFree = currentSize + requiredSize - targetSize;
        await this.evictEntries(sizeToFree);
    }
    /**
     * Evict entries based on configured policy
     */
    async evictEntries(sizeToFree) {
        const entries = Array.from(this.memoryCache.entries());
        let freedSize = 0;
        let evictedCount = 0;
        // Sort entries based on eviction policy
        switch (this.config.evictionPolicy) {
            case 'lru':
                entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
                break;
            case 'lfu':
                entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
                break;
            case 'ttl':
                entries.sort(([, a], [, b]) => (a.createdAt + a.ttl) - (b.createdAt + b.ttl));
                break;
        }
        // Evict entries until we've freed enough space
        for (const [key, entry] of entries) {
            if (freedSize >= sizeToFree) {
                break;
            }
            this.memoryCache.delete(key);
            freedSize += entry.size;
            evictedCount++;
        }
        this.statistics.evictionCount += evictedCount;
        this.logger.debug(`Evicted ${evictedCount} entries, freed ${freedSize} bytes`);
    }
    /**
     * Clean up expired entries
     */
    cleanupExpiredEntries() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, entry] of this.memoryCache.entries()) {
            if (this.isExpired(entry)) {
                this.memoryCache.delete(key);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            this.updateStatistics();
            this.logger.debug(`Cleaned up ${cleanedCount} expired entries`);
        }
    }
    // ============================================================================
    // Compression
    // ============================================================================
    /**
     * Compress data
     */
    async compress(data) {
        // Simple compression using zlib (would use more sophisticated compression in production)
        const zlib = await Promise.resolve().then(() => __importStar(require('zlib')));
        return new Promise((resolve, reject) => {
            zlib.gzip(Buffer.from(data, 'utf8'), (err, compressed) => {
                if (err)
                    reject(err);
                else
                    resolve(compressed);
            });
        });
    }
    /**
     * Decompress data
     */
    async decompress(data) {
        const zlib = await Promise.resolve().then(() => __importStar(require('zlib')));
        return new Promise((resolve, reject) => {
            zlib.gunzip(data, (err, decompressed) => {
                if (err)
                    reject(err);
                else {
                    try {
                        resolve(JSON.parse(decompressed.toString('utf8')));
                    }
                    catch (parseErr) {
                        reject(parseErr);
                    }
                }
            });
        });
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Check if entry is expired
     */
    isExpired(entry) {
        return Date.now() - entry.createdAt > entry.ttl;
    }
    /**
     * Get current memory usage
     */
    getCurrentMemoryUsage() {
        let totalSize = 0;
        for (const entry of this.memoryCache.values()) {
            totalSize += entry.size;
        }
        return totalSize;
    }
    /**
     * Update cache statistics
     */
    updateStatistics() {
        this.statistics.totalEntries = this.memoryCache.size;
        this.statistics.memoryUsage = this.getCurrentMemoryUsage();
        this.updateHitRate();
        this.updateCompressionRatio();
    }
    /**
     * Update hit rate
     */
    updateHitRate() {
        const total = this.statistics.hitCount + this.statistics.missCount;
        this.statistics.hitRate = total > 0 ? this.statistics.hitCount / total : 0;
    }
    /**
     * Update compression ratio
     */
    updateCompressionRatio() {
        let compressedSize = 0;
        let uncompressedSize = 0;
        for (const entry of this.memoryCache.values()) {
            if (entry.compressed) {
                compressedSize += entry.size;
                // Estimate original size (this is simplified)
                uncompressedSize += entry.size * 2;
            }
        }
        this.statistics.compressionRatio = uncompressedSize > 0
            ? 1 - (compressedSize / uncompressedSize)
            : 0;
    }
    // ============================================================================
    // Timer Management
    // ============================================================================
    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredEntries();
        }, this.config.cleanupInterval);
    }
    /**
     * Start preload timer
     */
    startPreloadTimer() {
        if (!this.config.preloadEnabled) {
            return;
        }
        this.preloadTimer = setInterval(() => {
            this.preloadData();
        }, this.config.preloadInterval);
        // Initial preload
        setTimeout(() => {
            this.preloadData();
        }, 5000); // Wait 5 seconds after startup
    }
    // ============================================================================
    // Public API
    // ============================================================================
    /**
     * Get cache statistics
     */
    getStatistics() {
        this.updateStatistics();
        return { ...this.statistics };
    }
    /**
     * Get cache configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update cache configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        // Restart timers if intervals changed
        if (newConfig.cleanupInterval && this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.startCleanupTimer();
        }
        if (newConfig.preloadInterval && this.preloadTimer) {
            clearInterval(this.preloadTimer);
            this.startPreloadTimer();
        }
    }
    /**
     * Get health status
     */
    getHealthStatus() {
        const stats = this.getStatistics();
        const memoryUtilization = stats.memoryUsage / this.config.maxMemorySize;
        let status = 'healthy';
        if (stats.hitRate < 0.5 || memoryUtilization > 0.9) {
            status = 'degraded';
        }
        if (stats.hitRate < 0.2 || memoryUtilization > 0.95) {
            status = 'unhealthy';
        }
        return {
            status,
            details: {
                hitRate: stats.hitRate,
                memoryUtilization,
                totalEntries: stats.totalEntries,
                evictionCount: stats.evictionCount
            }
        };
    }
    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        this.logger.info('Shutting down cache service...');
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        if (this.preloadTimer) {
            clearInterval(this.preloadTimer);
        }
        await this.clear();
        this.logger.info('Cache service shutdown completed');
    }
}
exports.CacheService = CacheService;
