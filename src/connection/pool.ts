/**
 * Mochi-Link (大福连) - Connection Pool and Resource Management
 * 
 * This module provides connection pooling, resource management, and
 * performance optimization for WebSocket and database connections.
 */

import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { ConnectionAdapter, ConnectionInfo } from './types';
import { 
  ServerConfig,
  ConnectionMode,
  ConnectionConfig,
  UWBPMessage,
  CommandResult,
  ConnectionError
} from '../types';

// ============================================================================
// Pool Configuration
// ============================================================================

export interface ConnectionPoolConfig {
  // Pool sizing
  minConnections: number;
  maxConnections: number;
  maxIdleConnections: number;
  
  // Timeouts
  connectionTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  
  // Health checking
  healthCheckInterval: number;
  healthCheckTimeout: number;
  
  // Resource limits
  maxConcurrentRequests: number;
  requestTimeout: number;
  
  // Retry configuration
  maxRetries: number;
  retryDelay: number;
  
  // Monitoring
  enableMetrics: boolean;
  metricsInterval: number;
}

// ============================================================================
// Pool Statistics
// ============================================================================

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

// ============================================================================
// Connection Pool Entry
// ============================================================================

interface PooledConnection {
  adapter: ConnectionAdapter;
  serverId: string;
  createdAt: Date;
  lastUsed: Date;
  requestCount: number;
  isHealthy: boolean;
  isIdle: boolean;
  currentRequests: number;
}

// ============================================================================
// Request Queue Entry
// ============================================================================

interface QueuedRequest {
  serverId: string;
  request: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout: NodeJS.Timeout;
}

// ============================================================================
// Connection Pool Implementation
// ============================================================================

export class ConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig;
  private connections = new Map<string, PooledConnection>();
  private requestQueue: QueuedRequest[] = [];
  private statistics: PoolStatistics;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private logger: any;

  constructor(
    private ctx: Context,
    config?: Partial<ConnectionPoolConfig>
  ) {
    super();
    
    this.logger = ctx.logger('mochi-link:connection-pool');
    
    this.config = {
      minConnections: 2,
      maxConnections: 20,
      maxIdleConnections: 5,
      connectionTimeout: 30000,
      idleTimeout: 300000, // 5 minutes
      maxLifetime: 3600000, // 1 hour
      healthCheckInterval: 60000, // 1 minute
      healthCheckTimeout: 5000,
      maxConcurrentRequests: 10,
      requestTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      enableMetrics: true,
      metricsInterval: 60000,
      ...config
    };

    this.statistics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      connectionUtilization: 0,
      healthStatus: 'healthy'
    };

    this.startHealthChecking();
    this.startMetricsCollection();
  }

  // ============================================================================
  // Pool Management
  // ============================================================================

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing connection pool...');
    
    try {
      // Pool will be populated on-demand
      this.logger.info('Connection pool initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Connection pool initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get or create a connection for a server
   */
  async getConnection(serverConfig: ServerConfig): Promise<ConnectionAdapter> {
    const serverId = serverConfig.id;
    
    // Check if we have an existing healthy connection
    const existingConnection = this.connections.get(serverId);
    if (existingConnection && existingConnection.isHealthy && !this.isConnectionExpired(existingConnection)) {
      existingConnection.lastUsed = new Date();
      existingConnection.isIdle = false;
      return existingConnection.adapter;
    }

    // Check pool limits
    if (this.connections.size >= this.config.maxConnections) {
      // Try to find an idle connection to replace
      const idleConnection = this.findIdleConnection();
      if (idleConnection) {
        await this.removeConnection(idleConnection.serverId);
      } else {
        throw new ConnectionError(
          'Connection pool at maximum capacity',
          serverConfig.connectionMode
        );
      }
    }

    // Create new connection
    return await this.createConnection(serverConfig);
  }

  /**
   * Execute a request with connection pooling
   */
  async executeRequest<T>(
    serverConfig: ServerConfig,
    request: (adapter: ConnectionAdapter) => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        serverId: serverConfig.id,
        request: async () => {
          const adapter = await this.getConnection(serverConfig);
          return await request(adapter);
        },
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: setTimeout(() => {
          this.removeFromQueue(queuedRequest);
          reject(new ConnectionError('Request timeout', serverConfig.connectionMode));
        }, this.config.requestTimeout)
      };

      this.requestQueue.push(queuedRequest);
      this.statistics.pendingRequests = this.requestQueue.length;
      
      this.processQueue();
    });
  }

  /**
   * Send message through pooled connection
   */
  async sendMessage(serverConfig: ServerConfig, message: UWBPMessage): Promise<void> {
    return this.executeRequest(serverConfig, async (adapter) => {
      await adapter.sendMessage(message);
    });
  }

  /**
   * Send command through pooled connection
   */
  async sendCommand(serverConfig: ServerConfig, command: string): Promise<CommandResult> {
    return this.executeRequest(serverConfig, async (adapter) => {
      return await adapter.sendCommand(command);
    });
  }

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  /**
   * Create a new pooled connection
   */
  private async createConnection(serverConfig: ServerConfig): Promise<ConnectionAdapter> {
    const startTime = Date.now();
    
    try {
      // Import the connection manager to create adapter
      const { ConnectionModeManager } = await import('./manager');
      const manager = new ConnectionModeManager(this.ctx);
      
      const adapter = await manager.establishConnection(serverConfig);
      
      const pooledConnection: PooledConnection = {
        adapter,
        serverId: serverConfig.id,
        createdAt: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
        isHealthy: true,
        isIdle: false,
        currentRequests: 0
      };

      this.connections.set(serverConfig.id, pooledConnection);
      this.statistics.totalConnections++;
      
      // Set up connection event handlers
      this.setupConnectionHandlers(pooledConnection);
      
      const connectionTime = Date.now() - startTime;
      this.logger.debug(`Created pooled connection for ${serverConfig.id} in ${connectionTime}ms`);
      
      this.emit('connectionCreated', serverConfig.id);
      return adapter;
      
    } catch (error) {
      this.logger.error(`Failed to create connection for ${serverConfig.id}:`, error);
      throw error;
    }
  }

  /**
   * Remove a connection from the pool
   */
  async removeConnection(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    try {
      await connection.adapter.disconnect();
    } catch (error) {
      this.logger.warn(`Error disconnecting ${serverId}:`, error);
    }

    this.connections.delete(serverId);
    this.emit('connectionRemoved', serverId);
    
    this.logger.debug(`Removed connection for ${serverId} from pool`);
  }

  /**
   * Setup event handlers for a pooled connection
   */
  private setupConnectionHandlers(pooledConnection: PooledConnection): void {
    const { adapter } = pooledConnection;

    adapter.on('disconnected', () => {
      pooledConnection.isHealthy = false;
      this.emit('connectionUnhealthy', pooledConnection.serverId);
    });

    adapter.on('error', (error) => {
      pooledConnection.isHealthy = false;
      this.logger.warn(`Connection error for ${pooledConnection.serverId}:`, error);
      this.emit('connectionError', pooledConnection.serverId, error);
    });

    adapter.on('message', (message) => {
      pooledConnection.lastUsed = new Date();
      this.emit('message', pooledConnection.serverId, message);
    });
  }

  // ============================================================================
  // Request Queue Processing
  // ============================================================================

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) {
      return;
    }

    // Find available connections or create new ones
    const availableSlots = this.getAvailableRequestSlots();
    const requestsToProcess = Math.min(availableSlots, this.requestQueue.length);

    for (let i = 0; i < requestsToProcess; i++) {
      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) break;

      this.processRequest(queuedRequest);
    }

    this.statistics.pendingRequests = this.requestQueue.length;
  }

  /**
   * Process a single request
   */
  private async processRequest(queuedRequest: QueuedRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      clearTimeout(queuedRequest.timeout);
      
      const result = await queuedRequest.request();
      const responseTime = Date.now() - startTime;
      
      // Update statistics
      this.statistics.totalRequests++;
      this.statistics.successfulRequests++;
      this.updateAverageResponseTime(responseTime);
      
      queuedRequest.resolve(result);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update statistics
      this.statistics.totalRequests++;
      this.statistics.failedRequests++;
      this.updateAverageResponseTime(responseTime);
      
      queuedRequest.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Remove request from queue
   */
  private removeFromQueue(requestToRemove: QueuedRequest): void {
    const index = this.requestQueue.indexOf(requestToRemove);
    if (index !== -1) {
      this.requestQueue.splice(index, 1);
      this.statistics.pendingRequests = this.requestQueue.length;
    }
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.connections.values()).map(
      connection => this.checkConnectionHealth(connection)
    );

    await Promise.allSettled(healthCheckPromises);
    
    // Clean up expired connections
    await this.cleanupExpiredConnections();
    
    // Update pool statistics
    this.updatePoolStatistics();
  }

  /**
   * Check health of a single connection
   */
  private async checkConnectionHealth(connection: PooledConnection): Promise<void> {
    try {
      const isHealthy = connection.adapter.isHealthy();
      connection.isHealthy = isHealthy;
      
      if (!isHealthy) {
        this.logger.warn(`Connection ${connection.serverId} failed health check`);
        await this.removeConnection(connection.serverId);
      }
      
    } catch (error) {
      this.logger.error(`Health check error for ${connection.serverId}:`, error);
      connection.isHealthy = false;
    }
  }

  /**
   * Clean up expired connections
   */
  private async cleanupExpiredConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [serverId, connection] of this.connections) {
      // Check if connection has exceeded max lifetime
      if (now - connection.createdAt.getTime() > this.config.maxLifetime) {
        connectionsToRemove.push(serverId);
        continue;
      }

      // Check if idle connection has exceeded idle timeout
      if (connection.isIdle && 
          now - connection.lastUsed.getTime() > this.config.idleTimeout) {
        connectionsToRemove.push(serverId);
        continue;
      }
    }

    // Remove expired connections
    for (const serverId of connectionsToRemove) {
      await this.removeConnection(serverId);
    }

    if (connectionsToRemove.length > 0) {
      this.logger.debug(`Cleaned up ${connectionsToRemove.length} expired connections`);
    }
  }

  // ============================================================================
  // Metrics and Statistics
  // ============================================================================

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metricsTimer = setInterval(() => {
      this.updatePoolStatistics();
      this.emit('metricsUpdated', this.statistics);
    }, this.config.metricsInterval);
  }

  /**
   * Update pool statistics
   */
  private updatePoolStatistics(): void {
    const connections = Array.from(this.connections.values());
    
    this.statistics.totalConnections = connections.length;
    this.statistics.activeConnections = connections.filter(c => !c.isIdle).length;
    this.statistics.idleConnections = connections.filter(c => c.isIdle).length;
    
    // Calculate connection utilization
    this.statistics.connectionUtilization = this.config.maxConnections > 0 
      ? this.statistics.activeConnections / this.config.maxConnections 
      : 0;

    // Determine health status
    this.statistics.healthStatus = this.determineHealthStatus();
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const utilization = this.statistics.connectionUtilization;
    const failureRate = this.statistics.totalRequests > 0 
      ? this.statistics.failedRequests / this.statistics.totalRequests 
      : 0;

    if (failureRate > 0.2 || utilization > 0.9) {
      return 'unhealthy';
    }
    
    if (failureRate > 0.1 || utilization > 0.7) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.statistics.totalRequests;
    if (totalRequests === 1) {
      this.statistics.averageResponseTime = responseTime;
    } else {
      this.statistics.averageResponseTime = 
        (this.statistics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get available request slots
   */
  private getAvailableRequestSlots(): number {
    const activeRequests = Array.from(this.connections.values())
      .reduce((total, conn) => total + conn.currentRequests, 0);
    
    return Math.max(0, this.config.maxConcurrentRequests - activeRequests);
  }

  /**
   * Find an idle connection
   */
  private findIdleConnection(): PooledConnection | undefined {
    return Array.from(this.connections.values())
      .find(conn => conn.isIdle && conn.currentRequests === 0);
  }

  /**
   * Check if connection is expired
   */
  private isConnectionExpired(connection: PooledConnection): boolean {
    const now = Date.now();
    return now - connection.createdAt.getTime() > this.config.maxLifetime;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get pool statistics
   */
  getStatistics(): PoolStatistics {
    return { ...this.statistics };
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): Map<string, ConnectionInfo> {
    const info = new Map<string, ConnectionInfo>();
    
    for (const [serverId, connection] of this.connections) {
      info.set(serverId, connection.adapter.getConnectionInfo());
    }
    
    return info;
  }

  /**
   * Force cleanup of all connections
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up connection pool...');

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Clear request queue
    for (const request of this.requestQueue) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool shutting down'));
    }
    this.requestQueue = [];

    // Close all connections
    const disconnectPromises = Array.from(this.connections.keys()).map(serverId =>
      this.removeConnection(serverId)
    );

    await Promise.allSettled(disconnectPromises);
    
    this.connections.clear();
    this.emit('cleanup');
    
    this.logger.info('Connection pool cleanup completed');
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  } {
    return {
      status: this.statistics.healthStatus,
      details: {
        totalConnections: this.statistics.totalConnections,
        activeConnections: this.statistics.activeConnections,
        pendingRequests: this.statistics.pendingRequests,
        connectionUtilization: this.statistics.connectionUtilization,
        averageResponseTime: this.statistics.averageResponseTime,
        successRate: this.statistics.totalRequests > 0 
          ? this.statistics.successfulRequests / this.statistics.totalRequests 
          : 1
      }
    };
  }
}

// ============================================================================
// Resource Manager
// ============================================================================

export class ResourceManager {
  private memoryUsage = new Map<string, number>();
  private cpuUsage = new Map<string, number>();
  private logger: any;

  constructor(private ctx: Context) {
    this.logger = ctx.logger('mochi-link:resource-manager');
    this.startResourceMonitoring();
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      this.collectResourceMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect resource metrics
   */
  private collectResourceMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Store metrics (simplified)
    this.memoryUsage.set('heap', memUsage.heapUsed);
    this.memoryUsage.set('external', memUsage.external);
    this.cpuUsage.set('user', cpuUsage.user);
    this.cpuUsage.set('system', cpuUsage.system);
  }

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
  } {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  /**
   * Check if resources are under pressure
   */
  isUnderResourcePressure(): boolean {
    const memUsage = process.memoryUsage();
    const heapUtilization = memUsage.heapUsed / memUsage.heapTotal;
    
    return heapUtilization > 0.8; // 80% heap utilization threshold
  }
}