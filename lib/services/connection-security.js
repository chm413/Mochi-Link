"use strict";
/**
 * Connection Security Manager
 *
 * Implements connection security management including:
 * - WebSocket connection limits and controls
 * - Progressive authentication failure delays
 * - Security event monitoring and alerting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionSecurityManager = void 0;
const events_1 = require("events");
// ============================================================================
// Connection Security Manager
// ============================================================================
class ConnectionSecurityManager extends events_1.EventEmitter {
    constructor(ctx, auditService, config = {}) {
        super();
        this.ctx = ctx;
        // Connection tracking
        this.activeConnections = new Map();
        this.connectionsByIP = new Map();
        this.connectionsByServer = new Map();
        // Authentication failure tracking
        this.authFailures = new Map(); // key: ip:serverId
        // Security monitoring
        this.securityAlerts = new Map();
        this.alertCooldowns = new Map();
        // Statistics
        this.stats = {
            totalConnections: 0,
            rejectedConnections: 0,
            authFailures: 0,
            blockedIPs: 0,
            alertsGenerated: 0
        };
        this.auditService = auditService;
        this.config = this.createDefaultConfig(config);
        this.startMonitoring();
        this.startCleanup();
    }
    // ============================================================================
    // Connection Limit Management
    // ============================================================================
    /**
     * Check if new connection should be allowed
     */
    checkConnectionAllowed(serverId, ip, userAgent) {
        if (!this.config.connectionLimits.enabled) {
            return { allowed: true };
        }
        // Check total connection limit
        if (this.activeConnections.size >= this.config.connectionLimits.maxTotalConnections) {
            this.stats.rejectedConnections++;
            return {
                allowed: false,
                reason: 'Maximum total connections exceeded',
                retryAfter: 60
            };
        }
        // Check per-IP connection limit
        const ipConnections = this.connectionsByIP.get(ip);
        if (ipConnections && ipConnections.size >= this.config.connectionLimits.maxConnectionsPerIP) {
            this.stats.rejectedConnections++;
            this.generateSecurityAlert({
                type: 'connection_limit_exceeded',
                severity: 'medium',
                source: { ip, serverId },
                details: {
                    description: 'IP connection limit exceeded',
                    metrics: { currentConnections: ipConnections.size, limit: this.config.connectionLimits.maxConnectionsPerIP },
                    evidence: { ip, serverId, userAgent }
                }
            });
            return {
                allowed: false,
                reason: 'Maximum connections per IP exceeded',
                retryAfter: 30
            };
        }
        // Check per-server connection limit
        const serverConnections = this.connectionsByServer.get(serverId);
        if (serverConnections && serverConnections.size >= this.config.connectionLimits.maxConnectionsPerServer) {
            this.stats.rejectedConnections++;
            return {
                allowed: false,
                reason: 'Maximum connections per server exceeded',
                retryAfter: 30
            };
        }
        return { allowed: true };
    }
    /**
     * Register new connection
     */
    registerConnection(connectionId, serverId, ip, userAgent) {
        const connectionInfo = {
            id: connectionId,
            serverId,
            ip,
            userAgent,
            connectedAt: new Date(),
            lastActivity: new Date(),
            authenticated: false,
            authFailures: 0
        };
        // Store connection info
        this.activeConnections.set(connectionId, connectionInfo);
        // Update IP tracking
        if (!this.connectionsByIP.has(ip)) {
            this.connectionsByIP.set(ip, new Set());
        }
        this.connectionsByIP.get(ip).add(connectionId);
        // Update server tracking
        if (!this.connectionsByServer.has(serverId)) {
            this.connectionsByServer.set(serverId, new Set());
        }
        this.connectionsByServer.get(serverId).add(connectionId);
        this.stats.totalConnections++;
        // Log connection
        this.auditService.logger.logSuccess('connection_registered', { connectionId, serverId, ip, userAgent }, { serverId });
        this.emit('connectionRegistered', connectionInfo);
    }
    /**
     * Unregister connection
     */
    unregisterConnection(connectionId) {
        const connectionInfo = this.activeConnections.get(connectionId);
        if (!connectionInfo) {
            return;
        }
        // Remove from tracking maps
        this.activeConnections.delete(connectionId);
        const ipConnections = this.connectionsByIP.get(connectionInfo.ip);
        if (ipConnections) {
            ipConnections.delete(connectionId);
            if (ipConnections.size === 0) {
                this.connectionsByIP.delete(connectionInfo.ip);
            }
        }
        const serverConnections = this.connectionsByServer.get(connectionInfo.serverId);
        if (serverConnections) {
            serverConnections.delete(connectionId);
            if (serverConnections.size === 0) {
                this.connectionsByServer.delete(connectionInfo.serverId);
            }
        }
        // Log disconnection
        this.auditService.logger.logSuccess('connection_unregistered', {
            connectionId,
            serverId: connectionInfo.serverId,
            ip: connectionInfo.ip,
            duration: Date.now() - connectionInfo.connectedAt.getTime()
        }, { serverId: connectionInfo.serverId });
        this.emit('connectionUnregistered', connectionInfo);
    }
    /**
     * Update connection activity
     */
    updateConnectionActivity(connectionId) {
        const connectionInfo = this.activeConnections.get(connectionId);
        if (connectionInfo) {
            connectionInfo.lastActivity = new Date();
        }
    }
    /**
     * Mark connection as authenticated
     */
    markConnectionAuthenticated(connectionId) {
        const connectionInfo = this.activeConnections.get(connectionId);
        if (connectionInfo) {
            connectionInfo.authenticated = true;
            this.emit('connectionAuthenticated', connectionInfo);
        }
    }
    // ============================================================================
    // Progressive Authentication Failure Handling
    // ============================================================================
    /**
     * Check if authentication attempt should be allowed
     */
    checkAuthenticationAllowed(serverId, ip) {
        if (!this.config.authFailureHandling.enabled) {
            return { allowed: true };
        }
        const key = `${ip}:${serverId}`;
        const failureRecord = this.authFailures.get(key);
        if (!failureRecord) {
            return { allowed: true };
        }
        // Check if IP is temporarily blocked
        if (failureRecord.blocked && failureRecord.blockUntil && new Date() < failureRecord.blockUntil) {
            return {
                allowed: false,
                reason: 'IP temporarily blocked due to repeated authentication failures',
                retryAfter: Math.ceil((failureRecord.blockUntil.getTime() - Date.now()) / 1000)
            };
        }
        // Check if we need to wait for progressive delay
        if (new Date() < failureRecord.nextAllowedAttempt) {
            return {
                allowed: false,
                reason: 'Authentication attempt too soon after previous failure',
                retryAfter: Math.ceil((failureRecord.nextAllowedAttempt.getTime() - Date.now()) / 1000)
            };
        }
        return { allowed: true };
    }
    /**
     * Record authentication failure
     */
    recordAuthenticationFailure(connectionId, serverId, ip, reason) {
        // Update connection info
        const connectionInfo = this.activeConnections.get(connectionId);
        if (connectionInfo) {
            connectionInfo.authFailures++;
            connectionInfo.lastAuthFailure = new Date();
        }
        // Update failure record
        const key = `${ip}:${serverId}`;
        let failureRecord = this.authFailures.get(key);
        const now = new Date();
        if (!failureRecord) {
            failureRecord = {
                ip,
                serverId,
                failures: 1,
                firstFailure: now,
                lastFailure: now,
                nextAllowedAttempt: this.calculateNextAllowedAttempt(1),
                blocked: false
            };
        }
        else {
            // Check if we should reset the failure count (outside reset window)
            if (now.getTime() - failureRecord.lastFailure.getTime() > this.config.authFailureHandling.resetWindow) {
                failureRecord.failures = 1;
                failureRecord.firstFailure = now;
            }
            else {
                failureRecord.failures++;
            }
            failureRecord.lastFailure = now;
            failureRecord.nextAllowedAttempt = this.calculateNextAllowedAttempt(failureRecord.failures);
            // Check if we should block the IP
            if (failureRecord.failures >= this.config.authFailureHandling.maxFailuresBeforeBlock) {
                failureRecord.blocked = true;
                failureRecord.blockUntil = new Date(now.getTime() + this.config.authFailureHandling.blockDuration);
                this.stats.blockedIPs++;
                this.generateSecurityAlert({
                    type: 'auth_failure_rate',
                    severity: 'high',
                    source: { ip, serverId, connectionId },
                    details: {
                        description: 'IP blocked due to repeated authentication failures',
                        metrics: {
                            failures: failureRecord.failures,
                            timeWindow: now.getTime() - failureRecord.firstFailure.getTime(),
                            blockDuration: this.config.authFailureHandling.blockDuration
                        },
                        evidence: { reason, failureRecord }
                    }
                });
            }
        }
        this.authFailures.set(key, failureRecord);
        this.stats.authFailures++;
        // Log authentication failure
        this.auditService.logger.logFailure('authentication_failure', {
            connectionId,
            serverId,
            ip,
            reason,
            failures: failureRecord.failures,
            blocked: failureRecord.blocked
        }, `Authentication failed: ${reason}`, { serverId });
        this.emit('authenticationFailure', {
            connectionId,
            serverId,
            ip,
            reason,
            failureRecord
        });
    }
    /**
     * Record successful authentication
     */
    recordAuthenticationSuccess(connectionId, serverId, ip) {
        // Clear failure record on successful authentication
        const key = `${ip}:${serverId}`;
        this.authFailures.delete(key);
        // Update connection info
        const connectionInfo = this.activeConnections.get(connectionId);
        if (connectionInfo) {
            connectionInfo.authenticated = true;
            connectionInfo.authFailures = 0;
            connectionInfo.lastAuthFailure = undefined;
        }
        // Log successful authentication
        this.auditService.logger.logSuccess('authentication_success', { connectionId, serverId, ip }, { serverId });
        this.emit('authenticationSuccess', {
            connectionId,
            serverId,
            ip
        });
    }
    /**
     * Calculate next allowed authentication attempt time
     */
    calculateNextAllowedAttempt(failureCount) {
        const delay = Math.min(this.config.authFailureHandling.baseDelay * Math.pow(this.config.authFailureHandling.backoffMultiplier, failureCount - 1), this.config.authFailureHandling.maxDelay);
        return new Date(Date.now() + delay);
    }
    // ============================================================================
    // Security Event Monitoring
    // ============================================================================
    /**
     * Generate security alert
     */
    generateSecurityAlert(alert) {
        const fullAlert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            acknowledged: false,
            ...alert
        };
        // Check alert cooldown
        const cooldownKey = `${alert.type}:${alert.source.ip || 'unknown'}:${alert.source.serverId || 'unknown'}`;
        const lastAlert = this.alertCooldowns.get(cooldownKey);
        if (lastAlert && Date.now() - lastAlert.getTime() < this.config.securityMonitoring.alertCooldown) {
            return fullAlert; // Skip duplicate alert within cooldown period
        }
        this.alertCooldowns.set(cooldownKey, new Date());
        this.securityAlerts.set(fullAlert.id, fullAlert);
        this.stats.alertsGenerated++;
        // Log security alert
        this.auditService.logger.logError('security_alert_generated', {
            alertId: fullAlert.id,
            type: fullAlert.type,
            severity: fullAlert.severity,
            source: fullAlert.source,
            details: fullAlert.details
        }, `Security alert: ${fullAlert.details.description}`, { serverId: fullAlert.source.serverId });
        // Emit alert event
        this.emit('securityAlert', fullAlert);
        // Send alert through configured channels
        if (this.config.alerting.enabled && this.config.alerting.severityLevels[alert.severity]) {
            this.sendAlert(fullAlert);
        }
        return fullAlert;
    }
    /**
     * Send alert through configured channels
     */
    sendAlert(alert) {
        if (this.config.alerting.channels.log) {
            this.ctx.logger('mochi-link:security').warn(`Security Alert [${alert.severity.toUpperCase()}]: ${alert.details.description}`, {
                alertId: alert.id,
                type: alert.type,
                source: alert.source,
                metrics: alert.details.metrics
            });
        }
        if (this.config.alerting.channels.webhook) {
            this.emit('webhookAlert', alert);
        }
        if (this.config.alerting.channels.email) {
            this.emit('emailAlert', alert);
        }
    }
    /**
     * Acknowledge security alert
     */
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.securityAlerts.get(alertId);
        if (!alert) {
            return false;
        }
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = acknowledgedBy;
        this.auditService.logger.logSuccess('security_alert_acknowledged', { alertId, acknowledgedBy }, { serverId: alert.source.serverId });
        this.emit('alertAcknowledged', alert);
        return true;
    }
    // ============================================================================
    // Monitoring and Cleanup
    // ============================================================================
    /**
     * Start security monitoring
     */
    startMonitoring() {
        if (!this.config.securityMonitoring.enabled) {
            return;
        }
        this.monitoringInterval = setInterval(() => {
            this.performSecurityCheck();
        }, this.config.securityMonitoring.monitoringInterval);
    }
    /**
     * Start cleanup processes
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredRecords();
        }, this.config.connectionLimits.cleanupInterval);
    }
    /**
     * Perform security monitoring checks
     */
    performSecurityCheck() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        // Check for connection floods
        const connectionsByIP = new Map();
        for (const connection of this.activeConnections.values()) {
            if (connection.connectedAt.getTime() > oneMinuteAgo) {
                connectionsByIP.set(connection.ip, (connectionsByIP.get(connection.ip) || 0) + 1);
            }
        }
        for (const [ip, count] of connectionsByIP.entries()) {
            if (count > this.config.securityMonitoring.alertThresholds.connectionFlood) {
                this.generateSecurityAlert({
                    type: 'connection_flood',
                    severity: 'high',
                    source: { ip },
                    details: {
                        description: 'Connection flood detected from IP',
                        metrics: { connectionsPerMinute: count, threshold: this.config.securityMonitoring.alertThresholds.connectionFlood },
                        evidence: { ip, timeWindow: '1 minute' }
                    }
                });
            }
        }
        // Check authentication failure rates
        const authFailuresByIP = new Map();
        for (const failureRecord of this.authFailures.values()) {
            if (failureRecord.lastFailure.getTime() > oneMinuteAgo) {
                authFailuresByIP.set(failureRecord.ip, (authFailuresByIP.get(failureRecord.ip) || 0) + 1);
            }
        }
        for (const [ip, count] of authFailuresByIP.entries()) {
            if (count > this.config.securityMonitoring.alertThresholds.authFailureRate) {
                this.generateSecurityAlert({
                    type: 'auth_failure_rate',
                    severity: 'medium',
                    source: { ip },
                    details: {
                        description: 'High authentication failure rate detected',
                        metrics: { failuresPerMinute: count, threshold: this.config.securityMonitoring.alertThresholds.authFailureRate },
                        evidence: { ip, timeWindow: '1 minute' }
                    }
                });
            }
        }
    }
    /**
     * Clean up expired records
     */
    cleanupExpiredRecords() {
        const now = Date.now();
        const cleanupThreshold = now - (24 * 60 * 60 * 1000); // 24 hours
        // Clean up old authentication failure records
        for (const [key, record] of this.authFailures.entries()) {
            if (record.lastFailure.getTime() < cleanupThreshold && !record.blocked) {
                this.authFailures.delete(key);
            }
            else if (record.blocked && record.blockUntil && record.blockUntil.getTime() < now) {
                // Unblock expired blocks
                record.blocked = false;
                record.blockUntil = undefined;
            }
        }
        // Clean up old security alerts (keep for 7 days)
        const alertCleanupThreshold = now - (7 * 24 * 60 * 60 * 1000);
        for (const [alertId, alert] of this.securityAlerts.entries()) {
            if (alert.timestamp.getTime() < alertCleanupThreshold) {
                this.securityAlerts.delete(alertId);
            }
        }
        // Clean up old alert cooldowns
        for (const [key, timestamp] of this.alertCooldowns.entries()) {
            if (timestamp.getTime() < cleanupThreshold) {
                this.alertCooldowns.delete(key);
            }
        }
    }
    // ============================================================================
    // Configuration and Statistics
    // ============================================================================
    /**
     * Create default configuration
     */
    createDefaultConfig(customConfig) {
        const defaultConfig = {
            connectionLimits: {
                enabled: true,
                maxConnectionsPerIP: 10,
                maxConnectionsPerServer: 50,
                maxTotalConnections: 1000,
                connectionTimeout: 30000,
                cleanupInterval: 300000 // 5 minutes
            },
            authFailureHandling: {
                enabled: true,
                baseDelay: 1000, // 1 second
                maxDelay: 300000, // 5 minutes
                backoffMultiplier: 2,
                resetWindow: 3600000, // 1 hour
                maxFailuresBeforeBlock: 5,
                blockDuration: 1800000 // 30 minutes
            },
            securityMonitoring: {
                enabled: true,
                alertThresholds: {
                    connectionFlood: 20,
                    authFailureRate: 10,
                    suspiciousPatterns: 80
                },
                monitoringInterval: 60000, // 1 minute
                alertCooldown: 300000 // 5 minutes
            },
            alerting: {
                enabled: true,
                channels: {
                    email: false,
                    webhook: true,
                    log: true
                },
                severityLevels: {
                    low: false,
                    medium: true,
                    high: true,
                    critical: true
                }
            }
        };
        return this.mergeConfig(defaultConfig, customConfig);
    }
    /**
     * Deep merge configuration objects
     */
    mergeConfig(base, override) {
        const result = { ...base };
        for (const [key, value] of Object.entries(override)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = {
                    ...result[key],
                    ...value
                };
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = this.mergeConfig(this.config, newConfig);
        this.emit('configUpdated', this.config);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get connection security statistics
     */
    getStats() {
        // Calculate connection stats by IP and server
        const connectionsByIP = {};
        const connectionsByServer = {};
        for (const connection of this.activeConnections.values()) {
            connectionsByIP[connection.ip] = (connectionsByIP[connection.ip] || 0) + 1;
            connectionsByServer[connection.serverId] = (connectionsByServer[connection.serverId] || 0) + 1;
        }
        // Calculate alert stats
        const alertsByType = {};
        const alertsBySeverity = {};
        let acknowledgedAlerts = 0;
        for (const alert of this.securityAlerts.values()) {
            alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
            alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
            if (alert.acknowledged) {
                acknowledgedAlerts++;
            }
        }
        return {
            connections: {
                active: this.activeConnections.size,
                total: this.stats.totalConnections,
                rejected: this.stats.rejectedConnections,
                byIP: connectionsByIP,
                byServer: connectionsByServer
            },
            authentication: {
                failures: this.stats.authFailures,
                blockedIPs: this.stats.blockedIPs,
                activeFailureRecords: this.authFailures.size
            },
            alerts: {
                total: this.stats.alertsGenerated,
                active: this.securityAlerts.size,
                acknowledged: acknowledgedAlerts,
                byType: alertsByType,
                bySeverity: alertsBySeverity
            }
        };
    }
    /**
     * Get active connections
     */
    getActiveConnections() {
        return Array.from(this.activeConnections.values());
    }
    /**
     * Get authentication failure records
     */
    getAuthFailureRecords() {
        return Array.from(this.authFailures.values());
    }
    /**
     * Get security alerts
     */
    getSecurityAlerts(filter) {
        let alerts = Array.from(this.securityAlerts.values());
        if (filter) {
            if (filter.type) {
                alerts = alerts.filter(alert => alert.type === filter.type);
            }
            if (filter.severity) {
                alerts = alerts.filter(alert => alert.severity === filter.severity);
            }
            if (filter.acknowledged !== undefined) {
                alerts = alerts.filter(alert => alert.acknowledged === filter.acknowledged);
            }
        }
        return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    // ============================================================================
    // Shutdown
    // ============================================================================
    /**
     * Shutdown connection security manager
     */
    shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.activeConnections.clear();
        this.connectionsByIP.clear();
        this.connectionsByServer.clear();
        this.authFailures.clear();
        this.securityAlerts.clear();
        this.alertCooldowns.clear();
        this.removeAllListeners();
    }
}
exports.ConnectionSecurityManager = ConnectionSecurityManager;
