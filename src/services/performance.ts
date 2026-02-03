/**
 * Mochi-Link (大福连) - Performance Optimization Service
 * 
 * This service integrates database optimization, connection pooling, and caching
 * to provide comprehensive performance optimization for the system.
 */

import { Context } from 'koishi';
import { EventEmitter } from 'events';
import { DatabaseQueryOptimizer } from '../database/optimization';
import { ConnectionPool, ResourceManager } from '../connection/pool';
import { CacheService } from './cache';
import { DatabaseManager } from '../database/operations';

// ============================================================================
// Performance Configuration
// ============================================================================

export interface PerformanceConfig {
  // Database optimization
  database: {
    enableQueryCache: boolean;
    cacheSize: number;
    cacheTTL: number;
    slowQueryThreshold: number;
    batchSize: number;
  };
  
  // Connection pooling
  connectionPool: {
    minConnections: number;
    maxConnections: number;
    maxIdleConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
    maxLifetime: number;
  };
  
  // Caching
  cache: {
    maxMemorySize: number;
    defaultTTL: number;
    preloadEnabled: boolean;
    preloadInterval: number;
    compressionEnabled: boolean;
  };
  
  // Resource management
  resources: {
    memoryThreshold: number; // percentage
    cpuThreshold: number; // percentage
    enableAutoOptimization: boolean;
    optimizationInterval: number;
  };
  
  // Monitoring
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

// ============================================================================
// Performance Metrics
// ============================================================================

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
    performanceScore: number; // 0-100
    recommendations: string[];
  };
}

// ============================================================================
// Performance Optimization Service
// ============================================================================

export class PerformanceOptimizationService extends EventEmitter {
  private config: PerformanceConfig;
  private dbOptimizer!: DatabaseQueryOptimizer;
  private connectionPool!: ConnectionPool;
  private cacheService!: CacheService;
  private resourceManager!: ResourceManager;
  private metricsTimer?: NodeJS.Timeout;
  private optimizationTimer?: NodeJS.Timeout;
  private logger: any;

  constructor(
    private ctx: Context,
    private dbManager: DatabaseManager,
    config?: Partial<PerformanceConfig>
  ) {
    super();
    
    this.logger = ctx.logger('mochi-link:performance');
    
    this.config = {
      database: {
        enableQueryCache: true,
        cacheSize: 1000,
        cacheTTL: 300000, // 5 minutes
        slowQueryThreshold: 1000, // 1 second
        batchSize: 100
      },
      connectionPool: {
        minConnections: 2,
        maxConnections: 20,
        maxIdleConnections: 5,
        connectionTimeout: 30000,
        idleTimeout: 300000, // 5 minutes
        maxLifetime: 3600000 // 1 hour
      },
      cache: {
        maxMemorySize: 100 * 1024 * 1024, // 100MB
        defaultTTL: 300000, // 5 minutes
        preloadEnabled: true,
        preloadInterval: 300000, // 5 minutes
        compressionEnabled: true
      },
      resources: {
        memoryThreshold: 80, // 80%
        cpuThreshold: 80, // 80%
        enableAutoOptimization: true,
        optimizationInterval: 600000 // 10 minutes
      },
      monitoring: {
        enableMetrics: true,
        metricsInterval: 60000, // 1 minute
        alertThresholds: {
          responseTime: 5000, // 5 seconds
          errorRate: 0.1, // 10%
          resourceUsage: 0.9 // 90%
        }
      },
      ...config
    };

    this.initializeComponents();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize performance optimization components
   */
  private initializeComponents(): void {
    // Initialize database optimizer
    this.dbOptimizer = new DatabaseQueryOptimizer(this.ctx, this.dbManager, {
      enableQueryCache: this.config.database.enableQueryCache,
      cacheSize: this.config.database.cacheSize,
      cacheTTL: this.config.database.cacheTTL,
      slowQueryThreshold: this.config.database.slowQueryThreshold,
      batchSize: this.config.database.batchSize
    });

    // Initialize connection pool
    this.connectionPool = new ConnectionPool(this.ctx, {
      minConnections: this.config.connectionPool.minConnections,
      maxConnections: this.config.connectionPool.maxConnections,
      maxIdleConnections: this.config.connectionPool.maxIdleConnections,
      connectionTimeout: this.config.connectionPool.connectionTimeout,
      idleTimeout: this.config.connectionPool.idleTimeout,
      maxLifetime: this.config.connectionPool.maxLifetime
    });

    // Initialize cache service
    this.cacheService = new CacheService(this.ctx, {
      maxMemorySize: this.config.cache.maxMemorySize,
      defaultTTL: this.config.cache.defaultTTL,
      preloadEnabled: this.config.cache.preloadEnabled,
      preloadInterval: this.config.cache.preloadInterval,
      compressionEnabled: this.config.cache.compressionEnabled
    });

    // Initialize resource manager
    this.resourceManager = new ResourceManager(this.ctx);

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for components
   */
  private setupEventHandlers(): void {
    // Database optimizer events (if it extends EventEmitter)
    // this.dbOptimizer.on('slowQuery', (queryType: string, executionTime: number) => {
    //   this.logger.warn(`Slow query detected: ${queryType} (${executionTime}ms)`);
    //   this.emit('slowQuery', queryType, executionTime);
    // });

    // Connection pool events
    this.connectionPool.on('connectionCreated', (serverId: string) => {
      this.logger.debug(`Connection created for ${serverId}`);
    });

    this.connectionPool.on('connectionError', (serverId: string, error: Error) => {
      this.logger.error(`Connection error for ${serverId}:`, error);
      this.emit('connectionError', serverId, error);
    });

    // Cache service events
    this.cacheService.on('set', (key: string, size: number) => {
      this.logger.debug(`Cache entry set: ${key} (${size} bytes)`);
    });

    this.cacheService.on('clear', () => {
      this.logger.info('Cache cleared');
    });
  }

  // ============================================================================
  // Service Lifecycle
  // ============================================================================

  /**
   * Initialize the performance optimization service
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing performance optimization service...');

    try {
      // Initialize connection pool
      await this.connectionPool.initialize();

      // Warm up caches
      await this.cacheService.preloadData();
      await this.dbOptimizer.warmUpCache();

      // Start monitoring and optimization
      this.startMetricsCollection();
      this.startAutoOptimization();

      this.logger.info('Performance optimization service initialized successfully');
      this.emit('initialized');

    } catch (error) {
      this.logger.error('Performance optimization service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown the performance optimization service
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down performance optimization service...');

    // Stop timers
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }

    // Shutdown components
    await Promise.allSettled([
      this.connectionPool.cleanup(),
      this.cacheService.shutdown()
    ]);

    this.logger.info('Performance optimization service shutdown completed');
    this.emit('shutdown');
  }

  // ============================================================================
  // Optimized Database Operations
  // ============================================================================

  /**
   * Get server with optimization
   */
  async getServerOptimized(serverId: string): Promise<any> {
    // Try cache first
    const cached = await this.cacheService.get(`server:${serverId}`);
    if (cached) {
      return cached;
    }

    // Use optimized database query
    const server = await this.dbOptimizer.getServerOptimized(serverId);
    
    // Cache the result
    if (server) {
      await this.cacheService.set(`server:${serverId}`, server, this.config.cache.defaultTTL);
    }

    return server;
  }

  /**
   * Get user permissions with optimization
   */
  async getUserPermissionsOptimized(userId: string): Promise<any[]> {
    // Try cache first
    const cached = await this.cacheService.get<any[]>(`permissions:${userId}`);
    if (cached) {
      return cached;
    }

    // Use optimized database query
    const permissions = await this.dbOptimizer.getUserPermissionsOptimized(userId);
    
    // Cache the result with shorter TTL for permissions
    await this.cacheService.set(`permissions:${userId}`, permissions, this.config.cache.defaultTTL / 2);

    return permissions;
  }

  /**
   * Get audit logs with optimization
   */
  async getAuditLogsOptimized(filters: any): Promise<{ logs: any[]; total: number }> {
    const cacheKey = `audit:${JSON.stringify(filters)}`;
    
    // Try cache for small result sets
    if (filters.limit && filters.limit <= 50) {
      const cached = await this.cacheService.get<{ logs: any[]; total: number }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Use optimized database query
    const result = await this.dbOptimizer.getAuditLogsOptimized(filters);
    
    // Cache small result sets
    if (filters.limit && filters.limit <= 50) {
      await this.cacheService.set(cacheKey, result, this.config.cache.defaultTTL / 4);
    }

    return result;
  }

  // ============================================================================
  // Connection Pool Integration
  // ============================================================================

  /**
   * Execute request through connection pool
   */
  async executePooledRequest<T>(
    serverConfig: any,
    request: (adapter: any) => Promise<T>
  ): Promise<T> {
    return await this.connectionPool.executeRequest(serverConfig, request);
  }

  /**
   * Send message through connection pool
   */
  async sendPooledMessage(serverConfig: any, message: any): Promise<void> {
    return await this.connectionPool.sendMessage(serverConfig, message);
  }

  /**
   * Send command through connection pool
   */
  async sendPooledCommand(serverConfig: any, command: string): Promise<any> {
    return await this.connectionPool.sendCommand(serverConfig, command);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate cache entries by pattern
   */
  async invalidateCache(pattern: string): Promise<void> {
    await this.cacheService.deleteByPattern(pattern);
    this.dbOptimizer.invalidateCache(pattern);
  }

  /**
   * Preload frequently accessed data
   */
  async preloadData(): Promise<void> {
    await Promise.all([
      this.cacheService.preloadData(),
      this.dbOptimizer.warmUpCache()
    ]);
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.monitoring.enableMetrics) {
      return;
    }

    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();
      
      // Check for performance issues
      await this.checkPerformanceAlerts(metrics);
      
      // Emit metrics event
      this.emit('metricsCollected', metrics);
      
    } catch (error) {
      this.logger.error('Failed to collect performance metrics:', error);
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const dbStats = this.dbOptimizer.getPerformanceStats();
    const poolStats = this.connectionPool.getStatistics();
    const cacheStats = this.cacheService.getStatistics();
    const resourceStats = this.resourceManager.getResourceStats();

    const metrics: PerformanceMetrics = {
      database: {
        queryCount: dbStats.totalQueries,
        averageQueryTime: dbStats.averageExecutionTime,
        slowQueries: dbStats.slowQueries,
        cacheHitRate: dbStats.cacheStats.hitRate
      },
      connections: {
        totalConnections: poolStats.totalConnections,
        activeConnections: poolStats.activeConnections,
        averageResponseTime: poolStats.averageResponseTime,
        connectionUtilization: poolStats.connectionUtilization
      },
      cache: {
        hitRate: cacheStats.hitRate,
        memoryUsage: cacheStats.memoryUsage,
        totalEntries: cacheStats.totalEntries,
        evictionCount: cacheStats.evictionCount
      },
      resources: {
        memoryUsage: resourceStats.memory.heapUsed,
        cpuUsage: resourceStats.cpu.user + resourceStats.cpu.system,
        heapUtilization: resourceStats.memory.heapUsed / resourceStats.memory.heapTotal
      },
      overall: {
        healthStatus: this.calculateOverallHealth(dbStats, poolStats, cacheStats),
        performanceScore: this.calculatePerformanceScore(dbStats, poolStats, cacheStats),
        recommendations: this.generateRecommendations(dbStats, poolStats, cacheStats)
      }
    };

    return metrics;
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(metrics: PerformanceMetrics): Promise<void> {
    const alerts: string[] = [];

    // Check response time
    if (metrics.database.averageQueryTime > this.config.monitoring.alertThresholds.responseTime) {
      alerts.push(`High database response time: ${metrics.database.averageQueryTime}ms`);
    }

    if (metrics.connections.averageResponseTime > this.config.monitoring.alertThresholds.responseTime) {
      alerts.push(`High connection response time: ${metrics.connections.averageResponseTime}ms`);
    }

    // Check resource usage
    if (metrics.resources.heapUtilization > this.config.monitoring.alertThresholds.resourceUsage) {
      alerts.push(`High memory usage: ${(metrics.resources.heapUtilization * 100).toFixed(1)}%`);
    }

    // Check cache performance
    if (metrics.cache.hitRate < 0.5) {
      alerts.push(`Low cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
    }

    // Emit alerts
    for (const alert of alerts) {
      this.logger.warn(`Performance alert: ${alert}`);
      this.emit('performanceAlert', alert);
    }
  }

  // ============================================================================
  // Auto-Optimization
  // ============================================================================

  /**
   * Start automatic optimization
   */
  private startAutoOptimization(): void {
    if (!this.config.resources.enableAutoOptimization) {
      return;
    }

    this.optimizationTimer = setInterval(() => {
      this.performAutoOptimization();
    }, this.config.resources.optimizationInterval);
  }

  /**
   * Perform automatic optimization
   */
  private async performAutoOptimization(): Promise<void> {
    this.logger.debug('Performing automatic optimization...');

    try {
      const metrics = await this.getPerformanceMetrics();
      
      // Optimize based on current metrics
      if (metrics.resources.heapUtilization > this.config.resources.memoryThreshold / 100) {
        await this.optimizeMemoryUsage();
      }

      if (metrics.cache.hitRate < 0.6) {
        await this.optimizeCachePerformance();
      }

      if (metrics.database.slowQueries > 10) {
        await this.optimizeDatabasePerformance();
      }

      this.logger.debug('Automatic optimization completed');

    } catch (error) {
      this.logger.error('Automatic optimization failed:', error);
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemoryUsage(): Promise<void> {
    this.logger.info('Optimizing memory usage...');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear old cache entries
    await this.cacheService.deleteByPattern('temp:*');
    
    // Optimize pending operations
    const servers = await this.dbManager.servers.getAllServers();
    for (const server of servers.slice(0, 10)) { // Limit to prevent overload
      await this.dbOptimizer.optimizePendingOperations(server.id);
    }
  }

  /**
   * Optimize cache performance
   */
  private async optimizeCachePerformance(): Promise<void> {
    this.logger.info('Optimizing cache performance...');

    // Preload frequently accessed data
    await this.preloadData();
    
    // Update cache configuration for better hit rates
    this.cacheService.updateConfig({
      defaultTTL: this.config.cache.defaultTTL * 1.5 // Increase TTL
    });
  }

  /**
   * Optimize database performance
   */
  private async optimizeDatabasePerformance(): Promise<void> {
    this.logger.info('Optimizing database performance...');

    // Clear query cache to force fresh queries
    this.dbOptimizer.clearMetrics();
    
    // Generate and log index recommendations
    const recommendations = await this.dbOptimizer.generateIndexRecommendations();
    for (const rec of recommendations) {
      this.logger.info(`Index recommendation: ${rec.table}.${rec.columns.join(',')} - ${rec.reason}`);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate overall health status
   */
  private calculateOverallHealth(dbStats: any, poolStats: any, cacheStats: any): 'healthy' | 'degraded' | 'unhealthy' {
    const dbHealth = dbStats.cacheStats.hitRate > 0.6 && dbStats.averageExecutionTime < 1000;
    const poolHealth = poolStats.connectionUtilization < 0.8 && poolStats.averageResponseTime < 5000;
    const cacheHealth = cacheStats.hitRate > 0.5;

    if (dbHealth && poolHealth && cacheHealth) {
      return 'healthy';
    } else if (!dbHealth || !poolHealth || !cacheHealth) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(dbStats: any, poolStats: any, cacheStats: any): number {
    let score = 100;

    // Database performance (40% weight)
    const dbScore = Math.min(100, (dbStats.cacheStats.hitRate * 100) - (dbStats.averageExecutionTime / 10));
    score = score * 0.6 + dbScore * 0.4;

    // Connection performance (30% weight)
    const connScore = Math.min(100, 100 - (poolStats.connectionUtilization * 50) - (poolStats.averageResponseTime / 100));
    score = score * 0.7 + connScore * 0.3;

    // Cache performance (30% weight)
    const cacheScore = cacheStats.hitRate * 100;
    score = score * 0.7 + cacheScore * 0.3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(dbStats: any, poolStats: any, cacheStats: any): string[] {
    const recommendations: string[] = [];

    if (dbStats.cacheStats.hitRate < 0.6) {
      recommendations.push('Consider increasing database query cache size');
    }

    if (dbStats.averageExecutionTime > 1000) {
      recommendations.push('Review slow queries and consider adding database indexes');
    }

    if (poolStats.connectionUtilization > 0.8) {
      recommendations.push('Consider increasing connection pool size');
    }

    if (cacheStats.hitRate < 0.5) {
      recommendations.push('Review cache TTL settings and preloading strategy');
    }

    if (cacheStats.evictionCount > 100) {
      recommendations.push('Consider increasing cache memory allocation');
    }

    return recommendations;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get performance configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update performance configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    // Deep merge the configuration
    if (newConfig.database) {
      this.config.database = { ...this.config.database, ...newConfig.database };
    }
    if (newConfig.connectionPool) {
      this.config.connectionPool = { ...this.config.connectionPool, ...newConfig.connectionPool };
    }
    if (newConfig.cache) {
      this.config.cache = { ...this.config.cache, ...newConfig.cache };
    }
    if (newConfig.resources) {
      this.config.resources = { ...this.config.resources, ...newConfig.resources };
    }
    if (newConfig.monitoring) {
      this.config.monitoring = { ...this.config.monitoring, ...newConfig.monitoring };
    }
    
    // Update component configurations
    if (newConfig.cache) {
      this.cacheService.updateConfig(newConfig.cache);
    }
    
    this.emit('configUpdated', this.config);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const metrics = await this.getPerformanceMetrics();
    
    return {
      status: metrics.overall.healthStatus,
      details: {
        performanceScore: metrics.overall.performanceScore,
        databaseHealth: this.dbOptimizer.getHealthStatus(),
        connectionPoolHealth: this.connectionPool.getHealthStatus(),
        cacheHealth: this.cacheService.getHealthStatus(),
        recommendations: metrics.overall.recommendations
      }
    };
  }
}