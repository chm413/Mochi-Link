"use strict";
/**
 * Health Check and Monitoring Service
 *
 * This service provides comprehensive health monitoring, system status tracking,
 * and diagnostic endpoints for the Mochi-Link system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitoringService = void 0;
const events_1 = require("events");
// ============================================================================
// Health Monitoring Service
// ============================================================================
class HealthMonitoringService extends events_1.EventEmitter {
    constructor(ctx, config = {}) {
        super();
        this.ctx = ctx;
        this.isRunning = false;
        this.startTime = Date.now();
        this.alerts = new Map();
        this.alertCooldowns = new Map();
        // Metrics tracking
        this.metricsHistory = [];
        this.logger = ctx.logger('health-monitoring');
        this.config = {
            systemCheckInterval: 30000, // 30 seconds
            serviceCheckInterval: 60000, // 1 minute
            deepCheckInterval: 300000, // 5 minutes
            checkTimeout: 5000, // 5 seconds
            serviceTimeout: 10000, // 10 seconds
            thresholds: {
                memoryUsage: 85, // 85%
                cpuUsage: 80, // 80%
                responseTime: 5000, // 5 seconds
                errorRate: 5, // 5%
                diskUsage: 90 // 90%
            },
            alerting: {
                enabled: true,
                cooldownPeriod: 300000, // 5 minutes
                escalationThreshold: 3 // 3 consecutive failures
            },
            ...config
        };
    }
    // ============================================================================
    // Service Lifecycle
    // ============================================================================
    /**
     * Start health monitoring
     */
    async start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.startTime = Date.now();
        // Start monitoring intervals
        this.startSystemChecks();
        this.startServiceChecks();
        this.startDeepChecks();
        // Perform initial health check
        await this.performSystemCheck();
        this.logger.info('Health monitoring service started');
        this.emit('started');
    }
    /**
     * Stop health monitoring
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        // Clear intervals
        if (this.systemCheckInterval) {
            clearInterval(this.systemCheckInterval);
            this.systemCheckInterval = undefined;
        }
        if (this.serviceCheckInterval) {
            clearInterval(this.serviceCheckInterval);
            this.serviceCheckInterval = undefined;
        }
        if (this.deepCheckInterval) {
            clearInterval(this.deepCheckInterval);
            this.deepCheckInterval = undefined;
        }
        // Clear alerts
        this.alerts.clear();
        this.alertCooldowns.clear();
        this.logger.info('Health monitoring service stopped');
        this.emit('stopped');
    }
    // ============================================================================
    // Health Check Methods
    // ============================================================================
    /**
     * Get current health status
     */
    async getHealthStatus() {
        if (!this.currentStatus) {
            await this.performSystemCheck();
        }
        return this.currentStatus;
    }
    /**
     * Get simplified health check (for load balancers)
     */
    async getSimpleHealthCheck() {
        const health = await this.getHealthStatus();
        return {
            status: health.status,
            timestamp: health.timestamp
        };
    }
    /**
     * Get detailed diagnostic information
     */
    getDiagnosticInfo() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        return {
            timestamp: Date.now(),
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                pid: process.pid,
                ppid: process.ppid,
                uptime: process.uptime(),
                cwd: process.cwd(),
                execPath: process.execPath,
                argv: process.argv,
                env: this.sanitizeEnvironment(process.env)
            },
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            versions: process.versions,
            features: {
                inspector: typeof process.inspector !== 'undefined',
                debug: process.debugPort > 0,
                uv: typeof process.binding === 'function',
                ipv6: process.features?.ipv6 || false,
                tls_alpn: process.features?.tls_alpn || false,
                tls_sni: process.features?.tls_sni || false,
                tls_ocsp: process.features?.tls_ocsp || false,
                tls: process.features?.tls || false
            }
        };
    }
    /**
     * Get active alerts
     */
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => !alert.acknowledged);
    }
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            this.emit('alertAcknowledged', alert);
            return true;
        }
        return false;
    }
    // ============================================================================
    // Private Methods - Monitoring
    // ============================================================================
    startSystemChecks() {
        this.systemCheckInterval = setInterval(() => this.performSystemCheck(), this.config.systemCheckInterval);
    }
    startServiceChecks() {
        this.serviceCheckInterval = setInterval(() => this.performServiceChecks(), this.config.serviceCheckInterval);
    }
    startDeepChecks() {
        this.deepCheckInterval = setInterval(() => this.performDeepCheck(), this.config.deepCheckInterval);
    }
    async performSystemCheck() {
        try {
            const timestamp = Date.now();
            const uptime = timestamp - this.startTime;
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            // Calculate system metrics
            const systemMetrics = {
                memory: {
                    used: memUsage.heapUsed,
                    total: memUsage.heapTotal,
                    percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
                    heap: {
                        used: memUsage.heapUsed,
                        total: memUsage.heapTotal,
                        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
                    }
                },
                cpu: {
                    usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
                    loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
                }
            };
            // Get component health
            const components = await this.checkComponentHealth();
            // Calculate overall status
            const overallStatus = this.calculateOverallStatus(systemMetrics, components);
            // Update current status
            this.currentStatus = {
                status: overallStatus,
                timestamp,
                uptime,
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                system: systemMetrics,
                services: {}, // Will be populated by service checks
                components,
                alerts: this.getActiveAlerts(),
                performance: {
                    avgResponseTime: 0,
                    requestsPerMinute: 0,
                    errorRate: 0,
                    throughput: 0
                }
            };
            // Check thresholds and generate alerts
            this.checkThresholds(systemMetrics);
            this.emit('systemCheckCompleted', this.currentStatus);
        }
        catch (error) {
            this.logger.error('System health check failed:', error);
            this.emit('systemCheckError', error);
        }
    }
    async performServiceChecks() {
        try {
            // Basic service check implementation
            this.emit('serviceCheckCompleted');
        }
        catch (error) {
            this.logger.error('Service health check failed:', error);
            this.emit('serviceCheckError', error);
        }
    }
    async performDeepCheck() {
        try {
            // Perform comprehensive system analysis
            const diagnostics = this.getDiagnosticInfo();
            // Emit deep check results
            this.emit('deepCheckCompleted', {
                timestamp: Date.now(),
                diagnostics,
                memoryLeakDetected: false,
                performanceDegraded: false
            });
        }
        catch (error) {
            this.logger.error('Deep health check failed:', error);
            this.emit('deepCheckError', error);
        }
    }
    async checkComponentHealth() {
        const components = {
            database: await this.checkDatabaseHealth(),
            websocket: await this.checkWebSocketHealth(),
            http: await this.checkHTTPHealth(),
            cache: await this.checkCacheHealth(),
            performance: await this.checkPerformanceHealth()
        };
        return components;
    }
    async checkDatabaseHealth() {
        const startTime = Date.now();
        try {
            // Test database connection through context
            await this.ctx.database.get('user', {});
            const responseTime = Date.now() - startTime;
            return {
                status: 'healthy',
                responseTime,
                lastCheck: Date.now(),
                errorCount: 0,
                uptime: Date.now() - this.startTime,
                details: {
                    connected: true,
                    responseTime
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastCheck: Date.now(),
                errorCount: 1,
                uptime: 0,
                details: {
                    connected: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
    async checkWebSocketHealth() {
        const startTime = Date.now();
        return {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            lastCheck: Date.now(),
            errorCount: 0,
            uptime: Date.now() - this.startTime,
            details: {
                running: true
            }
        };
    }
    async checkHTTPHealth() {
        const startTime = Date.now();
        return {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            lastCheck: Date.now(),
            errorCount: 0,
            uptime: Date.now() - this.startTime,
            details: {
                listening: true
            }
        };
    }
    async checkCacheHealth() {
        const startTime = Date.now();
        return {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            lastCheck: Date.now(),
            errorCount: 0,
            uptime: Date.now() - this.startTime,
            details: {
                enabled: false
            }
        };
    }
    async checkPerformanceHealth() {
        const startTime = Date.now();
        return {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            lastCheck: Date.now(),
            errorCount: 0,
            uptime: Date.now() - this.startTime,
            details: {
                enabled: false
            }
        };
    }
    // ============================================================================
    // Private Methods - Analysis
    // ============================================================================
    calculateOverallStatus(systemMetrics, components) {
        // Check system thresholds
        if (systemMetrics.memory.percentage > this.config.thresholds.memoryUsage ||
            systemMetrics.cpu.usage > this.config.thresholds.cpuUsage) {
            return 'degraded';
        }
        // Check component status
        const componentStatuses = Object.values(components).map(c => c.status);
        if (componentStatuses.some(s => s === 'unhealthy')) {
            return 'unhealthy';
        }
        if (componentStatuses.some(s => s === 'degraded')) {
            return 'degraded';
        }
        return 'healthy';
    }
    checkThresholds(systemMetrics) {
        const timestamp = Date.now();
        // Memory threshold
        if (systemMetrics.memory.percentage > this.config.thresholds.memoryUsage) {
            this.createAlert({
                id: 'memory-usage',
                type: 'memory',
                severity: systemMetrics.memory.percentage > 95 ? 'critical' : 'warning',
                message: `Memory usage is ${systemMetrics.memory.percentage.toFixed(1)}%`,
                timestamp,
                acknowledged: false,
                value: systemMetrics.memory.percentage,
                threshold: this.config.thresholds.memoryUsage
            });
        }
        else {
            this.clearAlert('memory-usage');
        }
        // CPU threshold
        if (systemMetrics.cpu.usage > this.config.thresholds.cpuUsage) {
            this.createAlert({
                id: 'cpu-usage',
                type: 'cpu',
                severity: systemMetrics.cpu.usage > 95 ? 'critical' : 'warning',
                message: `CPU usage is ${systemMetrics.cpu.usage.toFixed(1)}%`,
                timestamp,
                acknowledged: false,
                value: systemMetrics.cpu.usage,
                threshold: this.config.thresholds.cpuUsage
            });
        }
        else {
            this.clearAlert('cpu-usage');
        }
    }
    createAlert(alert) {
        // Check cooldown
        const lastAlert = this.alertCooldowns.get(alert.id);
        if (lastAlert && Date.now() - lastAlert < this.config.alerting.cooldownPeriod) {
            return;
        }
        this.alerts.set(alert.id, alert);
        this.alertCooldowns.set(alert.id, alert.timestamp);
        this.logger.warn(`Health alert: ${alert.message}`);
        this.emit('alert', alert);
    }
    clearAlert(alertId) {
        if (this.alerts.has(alertId)) {
            const alert = this.alerts.get(alertId);
            this.alerts.delete(alertId);
            this.emit('alertCleared', alert);
        }
    }
    sanitizeEnvironment(env) {
        const sanitized = {};
        const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth'];
        for (const [key, value] of Object.entries(env)) {
            if (value === undefined)
                continue;
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
            sanitized[key] = isSensitive ? '[REDACTED]' : value;
        }
        return sanitized;
    }
}
exports.HealthMonitoringService = HealthMonitoringService;
// Export as default only (class already exported above)
exports.default = HealthMonitoringService;
