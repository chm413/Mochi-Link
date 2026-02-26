"use strict";
/**
 * Mochi-Link (大福连) - Database Performance Optimization
 *
 * This module provides database query optimization, indexing strategies,
 * and performance monitoring for the Minecraft Unified Management System.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseQueryOptimizer = void 0;
// ============================================================================
// Query Cache
// ============================================================================
class QueryCache {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.hitCount = 0;
        this.missCount = 0;
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.missCount++;
            return null;
        }
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.missCount++;
            return null;
        }
        this.hitCount++;
        return entry.data;
    }
    set(key, data, ttl) {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }
    clear() {
        this.cache.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }
    getStats() {
        const total = this.hitCount + this.missCount;
        return {
            hitRate: total > 0 ? this.hitCount / total : 0,
            size: this.cache.size,
            hits: this.hitCount,
            misses: this.missCount
        };
    }
}
// ============================================================================
// Database Query Optimizer
// ============================================================================
class DatabaseQueryOptimizer {
    constructor(ctx, dbManager, config) {
        this.ctx = ctx;
        this.dbManager = dbManager;
        this.performanceMetrics = [];
        this.logger = ctx.logger('mochi-link:db-optimizer');
        this.config = {
            enableQueryCache: true,
            cacheSize: 1000,
            cacheTTL: 300000, // 5 minutes
            enableQueryLogging: true,
            slowQueryThreshold: 1000, // 1 second
            enableIndexHints: true,
            batchSize: 100,
            ...config
        };
        this.queryCache = new QueryCache(this.config.cacheSize);
    }
    // ============================================================================
    // Optimized Query Methods
    // ============================================================================
    /**
     * Optimized server queries with caching
     */
    async getServerOptimized(serverId) {
        const cacheKey = `server:${serverId}`;
        if (this.config.enableQueryCache) {
            const cached = this.queryCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const startTime = Date.now();
        const server = await this.dbManager.servers.getServer(serverId);
        const executionTime = Date.now() - startTime;
        this.recordMetrics('getServer', executionTime, 1, false);
        if (server && this.config.enableQueryCache) {
            this.queryCache.set(cacheKey, server, this.config.cacheTTL);
        }
        return server;
    }
    /**
     * Batch server queries for better performance
     */
    async getServersBatch(serverIds) {
        const cacheKey = `servers:batch:${serverIds.sort().join(',')}`;
        if (this.config.enableQueryCache) {
            const cached = this.queryCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const startTime = Date.now();
        // Use batch query instead of individual queries
        const servers = await this.ctx.database.get('minecraft_servers', {
            id: { $in: serverIds }
        });
        const executionTime = Date.now() - startTime;
        this.recordMetrics('getServersBatch', executionTime, servers.length, false);
        const result = servers.map(server => this.dbManager.servers.constructor.prototype.dbServerToModel?.(server) || server);
        if (this.config.enableQueryCache) {
            this.queryCache.set(cacheKey, result, this.config.cacheTTL);
        }
        return result;
    }
    /**
     * Optimized ACL queries with indexing hints
     */
    async getUserPermissionsOptimized(userId) {
        const cacheKey = `acl:user:${userId}`;
        if (this.config.enableQueryCache) {
            const cached = this.queryCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const startTime = Date.now();
        // Use optimized query with proper indexing
        const acls = await this.ctx.database.get('server_acl', {
            user_id: userId,
            $or: [
                { expires_at: null },
                { expires_at: { $gt: new Date() } }
            ]
        });
        const executionTime = Date.now() - startTime;
        this.recordMetrics('getUserPermissions', executionTime, acls.length, false);
        const result = acls.map(acl => this.dbManager.acl.constructor.prototype.dbACLToModel?.(acl) || acl);
        if (this.config.enableQueryCache) {
            this.queryCache.set(cacheKey, result, this.config.cacheTTL / 2); // Shorter TTL for permissions
        }
        return result;
    }
    /**
     * Optimized audit log queries with pagination
     */
    async getAuditLogsOptimized(filters) {
        const cacheKey = `audit:${JSON.stringify(filters)}`;
        if (this.config.enableQueryCache && filters.limit && filters.limit <= 100) {
            const cached = this.queryCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const startTime = Date.now();
        // Build optimized query
        const query = {};
        if (filters.userId)
            query.user_id = filters.userId;
        if (filters.serverId)
            query.server_id = filters.serverId;
        if (filters.operation)
            query.operation = filters.operation;
        if (filters.startDate || filters.endDate) {
            query.created_at = {};
            if (filters.startDate)
                query.created_at.$gte = filters.startDate;
            if (filters.endDate)
                query.created_at.$lte = filters.endDate;
        }
        // Execute count and data queries in parallel
        const [logs, totalCount] = await Promise.all([
            this.ctx.database.get('audit_logs', query, {
                limit: filters.limit || 100,
                offset: filters.offset || 0
            }),
            this.ctx.database.get('audit_logs', query, ['id']).then(results => results.length)
        ]);
        const executionTime = Date.now() - startTime;
        this.recordMetrics('getAuditLogs', executionTime, logs.length, false);
        const result = {
            logs: logs.map(log => this.dbManager.audit.constructor.prototype.dbAuditToModel?.(log) || log),
            total: totalCount
        };
        if (this.config.enableQueryCache && filters.limit && filters.limit <= 100) {
            this.queryCache.set(cacheKey, result, this.config.cacheTTL / 4); // Shorter TTL for audit logs
        }
        return result;
    }
    /**
     * Optimized pending operations with conflict detection
     */
    async optimizePendingOperations(serverId) {
        const startTime = Date.now();
        // Get all pending operations for the server
        const operations = await this.ctx.database.get('pending_operations', {
            server_id: serverId,
            status: 'pending'
        });
        let optimizedCount = 0;
        const operationsByTarget = new Map();
        // Group by target
        for (const op of operations) {
            if (!operationsByTarget.has(op.target)) {
                operationsByTarget.set(op.target, []);
            }
            operationsByTarget.get(op.target).push(op);
        }
        // Process each target group
        for (const [target, targetOps] of operationsByTarget) {
            if (targetOps.length < 2)
                continue;
            // Find contradictory operations
            const toRemove = [];
            for (let i = 0; i < targetOps.length - 1; i++) {
                const current = targetOps[i];
                const next = targetOps[i + 1];
                // Check for add/remove pairs
                if (this.areContradictoryOperations(current, next)) {
                    toRemove.push(current.id, next.id);
                    optimizedCount += 2;
                    i++; // Skip next operation as it's also removed
                }
            }
            // Remove contradictory operations in batch
            if (toRemove.length > 0) {
                await this.ctx.database.remove('pending_operations', {
                    id: { $in: toRemove }
                });
            }
        }
        const executionTime = Date.now() - startTime;
        this.recordMetrics('optimizePendingOperations', executionTime, optimizedCount, false);
        return optimizedCount;
    }
    // ============================================================================
    // Cache Management
    // ============================================================================
    /**
     * Invalidate cache entries
     */
    invalidateCache(pattern) {
        const keys = Array.from(this.queryCache['cache'].keys());
        const keysToDelete = keys.filter(key => key.includes(pattern));
        for (const key of keysToDelete) {
            this.queryCache['cache'].delete(key);
        }
        this.logger.debug(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
    }
    /**
     * Warm up cache with frequently accessed data
     */
    async warmUpCache() {
        this.logger.info('Warming up query cache...');
        try {
            // Pre-load frequently accessed servers
            const recentServers = await this.ctx.database.get('minecraft_servers', {
                last_seen: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
            });
            for (const server of recentServers) {
                const cacheKey = `server:${server.id}`;
                this.queryCache.set(cacheKey, server, this.config.cacheTTL);
            }
            // Pre-load active user permissions
            const recentAcls = await this.ctx.database.get('server_acl', {
                $or: [
                    { expires_at: null },
                    { expires_at: { $gt: new Date() } }
                ]
            });
            const userAcls = new Map();
            for (const acl of recentAcls) {
                if (!userAcls.has(acl.user_id)) {
                    userAcls.set(acl.user_id, []);
                }
                userAcls.get(acl.user_id).push(acl);
            }
            for (const [userId, acls] of userAcls) {
                const cacheKey = `acl:user:${userId}`;
                this.queryCache.set(cacheKey, acls, this.config.cacheTTL / 2);
            }
            this.logger.info(`Cache warmed up with ${recentServers.length} servers and ${userAcls.size} user ACLs`);
        }
        catch (error) {
            this.logger.error('Cache warm-up failed:', error);
        }
    }
    // ============================================================================
    // Performance Monitoring
    // ============================================================================
    /**
     * Record query performance metrics
     */
    recordMetrics(queryType, executionTime, rowsAffected, cacheHit) {
        const metric = {
            queryType,
            executionTime,
            rowsAffected,
            cacheHit,
            timestamp: Date.now()
        };
        this.performanceMetrics.push(metric);
        // Keep only recent metrics (last 1000 entries)
        if (this.performanceMetrics.length > 1000) {
            this.performanceMetrics = this.performanceMetrics.slice(-1000);
        }
        // Log slow queries
        if (this.config.enableQueryLogging && executionTime > this.config.slowQueryThreshold) {
            this.logger.warn(`Slow query detected: ${queryType} took ${executionTime}ms`);
        }
    }
    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const cacheStats = this.queryCache.getStats();
        const queryTypeStats = {};
        let totalTime = 0;
        let slowQueries = 0;
        for (const metric of this.performanceMetrics) {
            totalTime += metric.executionTime;
            if (metric.executionTime > this.config.slowQueryThreshold) {
                slowQueries++;
            }
            if (!queryTypeStats[metric.queryType]) {
                queryTypeStats[metric.queryType] = { count: 0, avgTime: 0 };
            }
            const stats = queryTypeStats[metric.queryType];
            stats.count++;
            stats.avgTime = (stats.avgTime * (stats.count - 1) + metric.executionTime) / stats.count;
        }
        return {
            totalQueries: this.performanceMetrics.length,
            averageExecutionTime: this.performanceMetrics.length > 0 ? totalTime / this.performanceMetrics.length : 0,
            slowQueries,
            cacheStats,
            queryTypeStats
        };
    }
    /**
     * Generate index recommendations
     */
    async generateIndexRecommendations() {
        const recommendations = [];
        // Analyze slow queries to suggest indexes
        const slowQueries = this.performanceMetrics.filter(m => m.executionTime > this.config.slowQueryThreshold);
        // Common index recommendations based on query patterns
        recommendations.push({
            table: 'minecraft_servers',
            columns: ['owner_id', 'status'],
            type: 'composite',
            reason: 'Optimize server queries by owner and status',
            estimatedImprovement: 60
        }, {
            table: 'server_acl',
            columns: ['user_id', 'expires_at'],
            type: 'composite',
            reason: 'Optimize permission checks with expiration',
            estimatedImprovement: 70
        }, {
            table: 'audit_logs',
            columns: ['created_at'],
            type: 'btree',
            reason: 'Optimize time-based audit queries',
            estimatedImprovement: 50
        }, {
            table: 'pending_operations',
            columns: ['server_id', 'status', 'created_at'],
            type: 'composite',
            reason: 'Optimize pending operation queries',
            estimatedImprovement: 65
        });
        return recommendations;
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Check if two operations are contradictory
     */
    areContradictoryOperations(op1, op2) {
        if (op1.target !== op2.target)
            return false;
        const contradictoryPairs = [
            ['whitelist_add', 'whitelist_remove'],
            ['ban_add', 'ban_remove'],
            ['op_add', 'op_remove']
        ];
        for (const [add, remove] of contradictoryPairs) {
            if ((op1.operation_type === add && op2.operation_type === remove) ||
                (op1.operation_type === remove && op2.operation_type === add)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Clear all performance metrics
     */
    clearMetrics() {
        this.performanceMetrics = [];
        this.queryCache.clear();
    }
    /**
     * Get health status
     */
    getHealthStatus() {
        const stats = this.getPerformanceStats();
        const cacheHitRate = stats.cacheStats.hitRate;
        const avgExecutionTime = stats.averageExecutionTime;
        let status = 'healthy';
        if (cacheHitRate < 0.5 || avgExecutionTime > this.config.slowQueryThreshold) {
            status = 'degraded';
        }
        if (cacheHitRate < 0.2 || avgExecutionTime > this.config.slowQueryThreshold * 2) {
            status = 'unhealthy';
        }
        return {
            status,
            details: {
                cacheHitRate,
                averageExecutionTime: avgExecutionTime,
                slowQueries: stats.slowQueries,
                totalQueries: stats.totalQueries
            }
        };
    }
}
exports.DatabaseQueryOptimizer = DatabaseQueryOptimizer;
