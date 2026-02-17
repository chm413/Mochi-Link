"use strict";
/**
 * System Integration Service
 *
 * This service handles the integration of all components and services,
 * providing centralized system management, health monitoring, and configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemIntegrationService = void 0;
const events_1 = require("events");
const index_1 = require("./index");
const manager_1 = require("../websocket/manager");
const server_1 = require("../http/server");
const operations_1 = require("../database/operations");
// ============================================================================
// System Integration Service
// ============================================================================
class SystemIntegrationService extends events_1.EventEmitter {
    constructor(ctx, pluginConfig, config = {}) {
        super();
        this.ctx = ctx;
        this.pluginConfig = pluginConfig;
        this.components = new Map();
        this.isInitialized = false;
        this.isShuttingDown = false;
        this.startTime = Date.now();
        this.logger = ctx.logger('system-integration');
        this.config = {
            startupOrder: [
                'database',
                'services',
                'websocket',
                'http'
            ],
            healthCheck: {
                interval: 30000, // 30 seconds
                timeout: 5000, // 5 seconds
                retries: 3
            },
            shutdown: {
                timeout: 30000, // 30 seconds
                forceTimeout: 60000 // 60 seconds
            },
            monitoring: {
                enabled: true,
                metricsInterval: 60000, // 1 minute
                alertThresholds: {
                    memoryUsage: 85, // 85%
                    cpuUsage: 80, // 80%
                    responseTime: 5000, // 5 seconds
                    errorRate: 5 // 5%
                }
            },
            ...config
        };
        this.setupComponentDefinitions();
    }
    // ============================================================================
    // System Lifecycle
    // ============================================================================
    /**
     * Initialize the entire system
     */
    async initialize() {
        if (this.isInitialized) {
            throw new Error('System is already initialized');
        }
        this.logger.info('Starting system initialization...');
        try {
            // Initialize components in order
            for (const componentName of this.config.startupOrder) {
                await this.initializeComponent(componentName);
            }
            // Start health monitoring
            this.startHealthMonitoring();
            // Start metrics collection
            if (this.config.monitoring.enabled) {
                this.startMetricsCollection();
            }
            this.isInitialized = true;
            this.logger.info('System initialization completed successfully');
            this.emit('initialized');
        }
        catch (error) {
            this.logger.error('System initialization failed:', error);
            await this.cleanup();
            throw error;
        }
    }
    /**
     * Shutdown the entire system gracefully
     */
    async shutdown() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        this.logger.info('Starting system shutdown...');
        try {
            // Stop monitoring
            this.stopHealthMonitoring();
            this.stopMetricsCollection();
            // Shutdown components in reverse order
            const shutdownOrder = [...this.config.startupOrder].reverse();
            for (const componentName of shutdownOrder) {
                await this.shutdownComponent(componentName);
            }
            this.isInitialized = false;
            this.logger.info('System shutdown completed');
            this.emit('shutdown');
        }
        catch (error) {
            this.logger.error('Error during system shutdown:', error);
            throw error;
        }
        finally {
            this.isShuttingDown = false;
        }
    }
    /**
     * Force shutdown (emergency stop)
     */
    async forceShutdown() {
        this.logger.warn('Force shutdown initiated');
        // Stop all intervals immediately
        this.stopHealthMonitoring();
        this.stopMetricsCollection();
        // Force stop all components
        const promises = Array.from(this.components.keys()).map(name => this.forceStopComponent(name));
        await Promise.allSettled(promises);
        this.isInitialized = false;
        this.isShuttingDown = false;
        this.emit('forceShutdown');
    }
    // ============================================================================
    // Component Management
    // ============================================================================
    /**
     * Initialize a specific component
     */
    async initializeComponent(componentName) {
        const component = this.components.get(componentName);
        if (!component) {
            throw new Error(`Unknown component: ${componentName}`);
        }
        this.logger.info(`Initializing component: ${componentName}`);
        component.status = 'starting';
        component.errorCount = 0;
        try {
            switch (componentName) {
                case 'database':
                    await this.initializeDatabase();
                    break;
                case 'services':
                    await this.initializeServices();
                    break;
                case 'websocket':
                    await this.initializeWebSocket();
                    break;
                case 'http':
                    await this.initializeHTTP();
                    break;
                default:
                    throw new Error(`No initialization handler for component: ${componentName}`);
            }
            component.status = 'running';
            component.startedAt = new Date();
            component.healthStatus = 'healthy';
            this.logger.info(`Component initialized successfully: ${componentName}`);
            this.emit('componentStarted', componentName);
        }
        catch (error) {
            component.status = 'error';
            component.lastError = error instanceof Error ? error : new Error(String(error));
            component.errorCount++;
            this.logger.error(`Failed to initialize component ${componentName}:`, error);
            this.emit('componentError', componentName, error);
            throw error;
        }
    }
    /**
     * Shutdown a specific component
     */
    async shutdownComponent(componentName) {
        const component = this.components.get(componentName);
        if (!component || component.status !== 'running') {
            return;
        }
        this.logger.info(`Shutting down component: ${componentName}`);
        component.status = 'stopping';
        try {
            switch (componentName) {
                case 'http':
                    await this.shutdownHTTP();
                    break;
                case 'websocket':
                    await this.shutdownWebSocket();
                    break;
                case 'services':
                    await this.shutdownServices();
                    break;
                case 'database':
                    await this.shutdownDatabase();
                    break;
            }
            component.status = 'stopped';
            this.logger.info(`Component shutdown completed: ${componentName}`);
            this.emit('componentStopped', componentName);
        }
        catch (error) {
            component.status = 'error';
            component.lastError = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Error shutting down component ${componentName}:`, error);
            this.emit('componentError', componentName, error);
        }
    }
    /**
     * Force stop a component
     */
    async forceStopComponent(componentName) {
        const component = this.components.get(componentName);
        if (!component) {
            return;
        }
        try {
            await Promise.race([
                this.shutdownComponent(componentName),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Force stop timeout')), 5000))
            ]);
        }
        catch (error) {
            this.logger.warn(`Force stopped component ${componentName}:`, error);
            component.status = 'stopped';
        }
    }
    // ============================================================================
    // Component Initialization Handlers
    // ============================================================================
    async initializeDatabase() {
        // Database should already be initialized by the main plugin
        // We just need to get a reference to it
        this.databaseManager = new operations_1.DatabaseManager(this.ctx);
        // Test database connection - simplified for now
        try {
            // Simple test - try to access the database
            await this.ctx.database.get('user', {});
        }
        catch (error) {
            throw new Error(`Database connection test failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async initializeServices() {
        this.serviceManager = new index_1.ServiceManager(this.ctx);
        await this.serviceManager.initialize();
    }
    async initializeWebSocket() {
        if (!this.serviceManager) {
            throw new Error('Services must be initialized before WebSocket');
        }
        const tokenManager = this.serviceManager.token;
        this.websocketManager = new manager_1.WebSocketConnectionManager(tokenManager, {
            server: {
                port: this.pluginConfig.websocket.port,
                host: this.pluginConfig.websocket.host,
                ssl: this.pluginConfig.websocket.ssl,
                maxConnections: this.pluginConfig.security.maxConnections,
                authenticationRequired: true,
                heartbeatInterval: 30000,
                heartbeatTimeout: 5000
            },
            maxConnections: this.pluginConfig.security.maxConnections,
            autoReconnect: true,
            reconnectInterval: 5000,
            maxReconnectAttempts: 10
        }, this.serviceManager.audit // Pass audit service for connection security
        );
        await this.websocketManager.start();
    }
    async initializeHTTP() {
        if (!this.serviceManager) {
            throw new Error('Services must be initialized before HTTP');
        }
        if (this.pluginConfig.http) {
            this.httpServer = new server_1.HTTPServer(this.ctx, this.pluginConfig.http, this.serviceManager);
            await this.httpServer.start();
        }
    }
    // ============================================================================
    // Component Shutdown Handlers
    // ============================================================================
    async shutdownHTTP() {
        if (this.httpServer) {
            await this.httpServer.stop();
            this.httpServer = undefined;
        }
    }
    async shutdownWebSocket() {
        if (this.websocketManager) {
            await this.websocketManager.stop();
            this.websocketManager = undefined;
        }
    }
    async shutdownServices() {
        if (this.serviceManager) {
            await this.serviceManager.cleanup();
            this.serviceManager = undefined;
        }
    }
    async shutdownDatabase() {
        // Database cleanup is handled by Koishi
        this.databaseManager = undefined;
    }
    // ============================================================================
    // Health Monitoring
    // ============================================================================
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(() => this.performHealthCheck(), this.config.healthCheck.interval);
    }
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }
    async performHealthCheck() {
        try {
            for (const [name, component] of this.components) {
                if (component.status === 'running') {
                    await this.checkComponentHealth(name, component);
                }
            }
            this.emit('healthCheckCompleted');
        }
        catch (error) {
            this.logger.error('Health check failed:', error);
            this.emit('healthCheckError', error);
        }
    }
    async checkComponentHealth(name, component) {
        try {
            let isHealthy = true;
            let responseTime = 0;
            const startTime = Date.now();
            switch (name) {
                case 'database':
                    if (this.databaseManager) {
                        await this.databaseManager.testConnection();
                    }
                    break;
                case 'services':
                    if (this.serviceManager) {
                        const health = await this.serviceManager.getHealthStatus();
                        isHealthy = health.status !== 'unhealthy';
                    }
                    break;
                case 'websocket':
                    if (this.websocketManager) {
                        isHealthy = this.websocketManager.isActive();
                    }
                    break;
                case 'http':
                    if (this.httpServer) {
                        isHealthy = this.httpServer.isListening();
                    }
                    break;
            }
            responseTime = Date.now() - startTime;
            component.lastHealthCheck = new Date();
            // Update health status based on response time and thresholds
            if (!isHealthy) {
                component.healthStatus = 'unhealthy';
            }
            else if (responseTime > this.config.monitoring.alertThresholds.responseTime) {
                component.healthStatus = 'degraded';
            }
            else {
                component.healthStatus = 'healthy';
            }
            // Reset error count on successful health check
            if (isHealthy) {
                component.errorCount = 0;
            }
        }
        catch (error) {
            component.healthStatus = 'unhealthy';
            component.lastError = error instanceof Error ? error : new Error(String(error));
            component.errorCount++;
            this.logger.warn(`Health check failed for ${name}:`, error);
            this.emit('componentHealthError', name, error);
        }
    }
    // ============================================================================
    // Metrics Collection
    // ============================================================================
    startMetricsCollection() {
        this.metricsInterval = setInterval(() => this.collectMetrics(), this.config.monitoring.metricsInterval);
    }
    stopMetricsCollection() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = undefined;
        }
    }
    async collectMetrics() {
        try {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            this.currentMetrics = {
                timestamp: Date.now(),
                uptime: Date.now() - this.startTime,
                memoryUsage: {
                    used: memUsage.heapUsed,
                    total: memUsage.heapTotal,
                    percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
                },
                cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
                connections: {
                    websocket: this.websocketManager?.getStats().totalConnections || 0,
                    http: 0, // HTTP connections are transient
                    database: 1 // Assuming single database connection
                },
                performance: {
                    avgResponseTime: 0, // Would be calculated from actual metrics
                    requestsPerMinute: 0, // Would be calculated from actual metrics
                    errorRate: 0 // Would be calculated from actual metrics
                },
                services: {}
            };
            // Collect service-specific metrics
            if (this.serviceManager) {
                const serviceHealth = await this.serviceManager.getHealthStatus();
                for (const [serviceName, health] of Object.entries(serviceHealth.services)) {
                    this.currentMetrics.services[serviceName] = {
                        status: health.status,
                        responseTime: 0, // Would be measured
                        errorCount: 0 // Would be tracked
                    };
                }
            }
            // Check for alert conditions
            this.checkAlertThresholds();
            this.emit('metricsCollected', this.currentMetrics);
        }
        catch (error) {
            this.logger.error('Metrics collection failed:', error);
            this.emit('metricsError', error);
        }
    }
    checkAlertThresholds() {
        if (!this.currentMetrics)
            return;
        const thresholds = this.config.monitoring.alertThresholds;
        const metrics = this.currentMetrics;
        // Memory usage alert
        if (metrics.memoryUsage.percentage > thresholds.memoryUsage) {
            this.emit('alert', {
                type: 'memory',
                severity: 'warning',
                message: `Memory usage is ${metrics.memoryUsage.percentage.toFixed(1)}% (threshold: ${thresholds.memoryUsage}%)`,
                value: metrics.memoryUsage.percentage,
                threshold: thresholds.memoryUsage
            });
        }
        // CPU usage alert
        if (metrics.cpuUsage > thresholds.cpuUsage) {
            this.emit('alert', {
                type: 'cpu',
                severity: 'warning',
                message: `CPU usage is ${metrics.cpuUsage.toFixed(1)}% (threshold: ${thresholds.cpuUsage}%)`,
                value: metrics.cpuUsage,
                threshold: thresholds.cpuUsage
            });
        }
        // Response time alert
        if (metrics.performance.avgResponseTime > thresholds.responseTime) {
            this.emit('alert', {
                type: 'response_time',
                severity: 'warning',
                message: `Average response time is ${metrics.performance.avgResponseTime}ms (threshold: ${thresholds.responseTime}ms)`,
                value: metrics.performance.avgResponseTime,
                threshold: thresholds.responseTime
            });
        }
        // Error rate alert
        if (metrics.performance.errorRate > thresholds.errorRate) {
            this.emit('alert', {
                type: 'error_rate',
                severity: 'critical',
                message: `Error rate is ${metrics.performance.errorRate}% (threshold: ${thresholds.errorRate}%)`,
                value: metrics.performance.errorRate,
                threshold: thresholds.errorRate
            });
        }
    }
    // ============================================================================
    // Public API
    // ============================================================================
    /**
     * Get overall system health
     */
    async getSystemHealth() {
        const services = [];
        for (const [name, component] of this.components) {
            services.push({
                name,
                status: component.healthStatus,
                details: {
                    status: component.status,
                    startedAt: component.startedAt,
                    lastHealthCheck: component.lastHealthCheck,
                    errorCount: component.errorCount,
                    lastError: component.lastError?.message
                }
            });
        }
        // Determine overall status
        const hasUnhealthy = services.some(s => s.status === 'unhealthy');
        const hasDegraded = services.some(s => s.status === 'degraded');
        let overallStatus;
        if (hasUnhealthy) {
            overallStatus = 'unhealthy';
        }
        else if (hasDegraded) {
            overallStatus = 'degraded';
        }
        else {
            overallStatus = 'healthy';
        }
        return {
            status: overallStatus,
            services,
            uptime: Date.now() - this.startTime,
            version: '1.0.0'
        };
    }
    /**
     * Get current system metrics
     */
    getCurrentMetrics() {
        return this.currentMetrics;
    }
    /**
     * Get system statistics
     */
    getSystemStats() {
        const stats = {
            initialized: this.isInitialized,
            uptime: Date.now() - this.startTime,
            components: Object.fromEntries(Array.from(this.components.entries()).map(([name, component]) => [
                name,
                {
                    status: component.status,
                    healthStatus: component.healthStatus,
                    startedAt: component.startedAt,
                    errorCount: component.errorCount
                }
            ])),
            metrics: this.currentMetrics
        };
        // Add component-specific stats
        if (this.websocketManager) {
            stats.websocket = this.websocketManager.getStats();
        }
        if (this.httpServer) {
            stats.http = {
                listening: this.httpServer.isListening(),
                address: this.httpServer.getAddress()
            };
        }
        return stats;
    }
    /**
     * Get service manager instance
     */
    getServiceManager() {
        return this.serviceManager;
    }
    /**
     * Get WebSocket manager instance
     */
    getWebSocketManager() {
        return this.websocketManager;
    }
    /**
     * Get HTTP server instance
     */
    getHTTPServer() {
        return this.httpServer;
    }
    /**
     * Check if system is ready
     */
    isReady() {
        return this.isInitialized && !this.isShuttingDown;
    }
    /**
     * Get database manager instance (for external access)
     */
    getDatabaseManager() {
        return this.databaseManager;
    }
    // ============================================================================
    // Private Helpers
    // ============================================================================
    setupComponentDefinitions() {
        const components = [
            {
                name: 'database',
                dependencies: [],
                dependents: ['services']
            },
            {
                name: 'services',
                dependencies: ['database'],
                dependents: ['websocket', 'http']
            },
            {
                name: 'websocket',
                dependencies: ['services'],
                dependents: []
            },
            {
                name: 'http',
                dependencies: ['services'],
                dependents: []
            }
        ];
        for (const comp of components) {
            this.components.set(comp.name, {
                name: comp.name,
                status: 'stopped',
                healthStatus: 'healthy',
                errorCount: 0,
                dependencies: comp.dependencies,
                dependents: comp.dependents
            });
        }
    }
    async cleanup() {
        this.stopHealthMonitoring();
        this.stopMetricsCollection();
        // Reset component states
        for (const component of this.components.values()) {
            component.status = 'stopped';
            component.healthStatus = 'healthy';
            component.errorCount = 0;
            component.lastError = undefined;
        }
    }
}
exports.SystemIntegrationService = SystemIntegrationService;
// Export for module compatibility
exports.default = SystemIntegrationService;
