"use strict";
/**
 * Mochi-Link (大福连) - Connection Pool and Resource Management
 *
 * This module provides connection pooling, resource management, and
 * performance optimization for WebSocket and database connections.
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
exports.ResourceManager = exports.ConnectionPool = void 0;
const events_1 = require("events");
const types_1 = require("../types");
// ============================================================================
// Connection Pool Implementation
// ============================================================================
class ConnectionPool extends events_1.EventEmitter {
    constructor(ctx, config) {
        super();
        this.ctx = ctx;
        this.connections = new Map();
        this.requestQueue = [];
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
    async initialize() {
        this.logger.info('Initializing connection pool...');
        try {
            // Pool will be populated on-demand
            this.logger.info('Connection pool initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            this.logger.error('Connection pool initialization failed:', error);
            throw error;
        }
    }
    /**
     * Get or create a connection for a server
     */
    async getConnection(serverConfig) {
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
            }
            else {
                throw new types_1.ConnectionError('Connection pool at maximum capacity', serverConfig.connectionMode);
            }
        }
        // Create new connection
        return await this.createConnection(serverConfig);
    }
    /**
     * Execute a request with connection pooling
     */
    async executeRequest(serverConfig, request) {
        return new Promise((resolve, reject) => {
            const queuedRequest = {
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
                    reject(new types_1.ConnectionError('Request timeout', serverConfig.connectionMode));
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
    async sendMessage(serverConfig, message) {
        return this.executeRequest(serverConfig, async (adapter) => {
            await adapter.sendMessage(message);
        });
    }
    /**
     * Send command through pooled connection
     */
    async sendCommand(serverConfig, command) {
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
    async createConnection(serverConfig) {
        const startTime = Date.now();
        try {
            // Import the connection manager to create adapter
            const { ConnectionModeManager } = await Promise.resolve().then(() => __importStar(require('./manager')));
            const manager = new ConnectionModeManager(this.ctx);
            const adapter = await manager.establishConnection(serverConfig);
            const pooledConnection = {
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
        }
        catch (error) {
            this.logger.error(`Failed to create connection for ${serverConfig.id}:`, error);
            throw error;
        }
    }
    /**
     * Remove a connection from the pool
     */
    async removeConnection(serverId) {
        const connection = this.connections.get(serverId);
        if (!connection) {
            return;
        }
        try {
            await connection.adapter.disconnect();
        }
        catch (error) {
            this.logger.warn(`Error disconnecting ${serverId}:`, error);
        }
        this.connections.delete(serverId);
        this.emit('connectionRemoved', serverId);
        this.logger.debug(`Removed connection for ${serverId} from pool`);
    }
    /**
     * Setup event handlers for a pooled connection
     */
    setupConnectionHandlers(pooledConnection) {
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
    async processQueue() {
        if (this.requestQueue.length === 0) {
            return;
        }
        // Find available connections or create new ones
        const availableSlots = this.getAvailableRequestSlots();
        const requestsToProcess = Math.min(availableSlots, this.requestQueue.length);
        for (let i = 0; i < requestsToProcess; i++) {
            const queuedRequest = this.requestQueue.shift();
            if (!queuedRequest)
                break;
            this.processRequest(queuedRequest);
        }
        this.statistics.pendingRequests = this.requestQueue.length;
    }
    /**
     * Process a single request
     */
    async processRequest(queuedRequest) {
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
        }
        catch (error) {
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
    removeFromQueue(requestToRemove) {
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
    startHealthChecking() {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }
    /**
     * Perform health check on all connections
     */
    async performHealthCheck() {
        const healthCheckPromises = Array.from(this.connections.values()).map(connection => this.checkConnectionHealth(connection));
        await Promise.allSettled(healthCheckPromises);
        // Clean up expired connections
        await this.cleanupExpiredConnections();
        // Update pool statistics
        this.updatePoolStatistics();
    }
    /**
     * Check health of a single connection
     */
    async checkConnectionHealth(connection) {
        try {
            const isHealthy = connection.adapter.isHealthy();
            connection.isHealthy = isHealthy;
            if (!isHealthy) {
                this.logger.warn(`Connection ${connection.serverId} failed health check`);
                await this.removeConnection(connection.serverId);
            }
        }
        catch (error) {
            this.logger.error(`Health check error for ${connection.serverId}:`, error);
            connection.isHealthy = false;
        }
    }
    /**
     * Clean up expired connections
     */
    async cleanupExpiredConnections() {
        const now = Date.now();
        const connectionsToRemove = [];
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
    startMetricsCollection() {
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
    updatePoolStatistics() {
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
    determineHealthStatus() {
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
    updateAverageResponseTime(responseTime) {
        const totalRequests = this.statistics.totalRequests;
        if (totalRequests === 1) {
            this.statistics.averageResponseTime = responseTime;
        }
        else {
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
    getAvailableRequestSlots() {
        const activeRequests = Array.from(this.connections.values())
            .reduce((total, conn) => total + conn.currentRequests, 0);
        return Math.max(0, this.config.maxConcurrentRequests - activeRequests);
    }
    /**
     * Find an idle connection
     */
    findIdleConnection() {
        return Array.from(this.connections.values())
            .find(conn => conn.isIdle && conn.currentRequests === 0);
    }
    /**
     * Check if connection is expired
     */
    isConnectionExpired(connection) {
        const now = Date.now();
        return now - connection.createdAt.getTime() > this.config.maxLifetime;
    }
    // ============================================================================
    // Public API
    // ============================================================================
    /**
     * Get pool statistics
     */
    getStatistics() {
        return { ...this.statistics };
    }
    /**
     * Get connection information
     */
    getConnectionInfo() {
        const info = new Map();
        for (const [serverId, connection] of this.connections) {
            info.set(serverId, connection.adapter.getConnectionInfo());
        }
        return info;
    }
    /**
     * Force cleanup of all connections
     */
    async cleanup() {
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
        const disconnectPromises = Array.from(this.connections.keys()).map(serverId => this.removeConnection(serverId));
        await Promise.allSettled(disconnectPromises);
        this.connections.clear();
        this.emit('cleanup');
        this.logger.info('Connection pool cleanup completed');
    }
    /**
     * Get health status
     */
    getHealthStatus() {
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
exports.ConnectionPool = ConnectionPool;
// ============================================================================
// Resource Manager
// ============================================================================
class ResourceManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.memoryUsage = new Map();
        this.cpuUsage = new Map();
        this.logger = ctx.logger('mochi-link:resource-manager');
        this.startResourceMonitoring();
    }
    /**
     * Start resource monitoring
     */
    startResourceMonitoring() {
        setInterval(() => {
            this.collectResourceMetrics();
        }, 30000); // Every 30 seconds
    }
    /**
     * Collect resource metrics
     */
    collectResourceMetrics() {
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
    getResourceStats() {
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
    isUnderResourcePressure() {
        const memUsage = process.memoryUsage();
        const heapUtilization = memUsage.heapUsed / memUsage.heapTotal;
        return heapUtilization > 0.8; // 80% heap utilization threshold
    }
}
exports.ResourceManager = ResourceManager;
