"use strict";
/**
 * Mochi-Link (大福连) - Audit Logging Service
 *
 * This file implements the comprehensive audit logging service that records
 * all management operations with proper filtering and export capabilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = exports.AuditExportService = exports.AuditStatisticsService = exports.AuditQueryService = exports.AuditLogger = void 0;
const operations_1 = require("../database/operations");
// ============================================================================
// Audit Logger Class
// ============================================================================
class AuditLogger {
    constructor(ctx) {
        this.ctx = ctx;
        this.auditOps = new operations_1.AuditOperations(ctx);
    }
    /**
     * Log a successful operation
     */
    async logSuccess(operation, operationData, context = {}) {
        return this.auditOps.logOperation(context.userId, context.serverId, operation, operationData, 'success', undefined, context.ipAddress, context.userAgent);
    }
    /**
     * Log a failed operation
     */
    async logFailure(operation, operationData, errorMessage, context = {}) {
        return this.auditOps.logOperation(context.userId, context.serverId, operation, operationData, 'failure', errorMessage, context.ipAddress, context.userAgent);
    }
    /**
     * Log an error operation
     */
    async logError(operation, operationData, error, context = {}) {
        const errorMessage = error instanceof Error ? error.message : error;
        return this.auditOps.logOperation(context.userId, context.serverId, operation, operationData, 'error', errorMessage, context.ipAddress, context.userAgent);
    }
    /**
     * Log authentication failure
     */
    async logAuthFailure(serverId, reason, context = {}) {
        return this.logFailure('auth.failure', { serverId, reason }, `Authentication failed: ${reason}`, { ...context, serverId });
    }
    /**
     * Log permission denied
     */
    async logPermissionDenied(userId, serverId, operation, context = {}) {
        return this.logFailure('permission.denied', { userId, serverId, operation }, `Permission denied for operation: ${operation}`, { ...context, userId, serverId });
    }
    /**
     * Log connection events
     */
    async logConnection(serverId, event, details = {}, context = {}) {
        return this.logSuccess(`connection.${event}`, { serverId, ...details }, { ...context, serverId });
    }
    /**
     * Log server management operations
     */
    async logServerOperation(serverId, operation, operationData, result, errorMessage, context = {}) {
        return this.auditOps.logOperation(context.userId, serverId, `server.${operation}`, operationData, result, errorMessage, context.ipAddress, context.userAgent);
    }
    /**
     * Log player management operations
     */
    async logPlayerOperation(serverId, playerId, operation, operationData, result, errorMessage, context = {}) {
        return this.auditOps.logOperation(context.userId, serverId, `player.${operation}`, { playerId, ...operationData }, result, errorMessage, context.ipAddress, context.userAgent);
    }
}
exports.AuditLogger = AuditLogger;
// ============================================================================
// Audit Query Service
// ============================================================================
class AuditQueryService {
    constructor(ctx) {
        this.ctx = ctx;
        this.auditOps = new operations_1.AuditOperations(ctx);
    }
    /**
     * Query audit logs with filters
     */
    async queryLogs(filter = {}) {
        return this.auditOps.getAuditLogs(filter);
    }
    /**
     * Get audit log by ID
     */
    async getLogById(logId) {
        return this.auditOps.getAuditLog(logId);
    }
    /**
     * Get recent audit logs
     */
    async getRecentLogs(limit = 100) {
        return this.auditOps.getAuditLogs({ limit });
    }
    /**
     * Get audit logs for specific user
     */
    async getUserLogs(userId, limit = 100) {
        return this.auditOps.getAuditLogs({ userId, limit });
    }
    /**
     * Get audit logs for specific server
     */
    async getServerLogs(serverId, limit = 100) {
        return this.auditOps.getAuditLogs({ serverId, limit });
    }
    /**
     * Get audit logs for specific operation
     */
    async getOperationLogs(operation, limit = 100) {
        return this.auditOps.getAuditLogs({ operation, limit });
    }
    /**
     * Get audit logs within date range
     */
    async getLogsInDateRange(startDate, endDate, limit = 1000) {
        return this.auditOps.getAuditLogs({ startDate, endDate, limit });
    }
    /**
     * Search audit logs by operation pattern
     */
    async searchLogs(searchTerm, filter = {}) {
        // This is a simplified search - in a real implementation,
        // you might want to use database-specific search features
        const allLogs = await this.auditOps.getAuditLogs(filter);
        return allLogs.filter(log => log.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
            JSON.stringify(log.operationData).toLowerCase().includes(searchTerm.toLowerCase()));
    }
}
exports.AuditQueryService = AuditQueryService;
// ============================================================================
// Audit Statistics Service
// ============================================================================
class AuditStatisticsService {
    constructor(ctx) {
        this.ctx = ctx;
        this.auditOps = new operations_1.AuditOperations(ctx);
    }
    /**
     * Get comprehensive audit statistics
     */
    async getStatistics(filter = {}) {
        const logs = await this.auditOps.getAuditLogs({
            ...filter,
            limit: 10000 // Get a large sample for statistics
        });
        const stats = {
            totalOperations: logs.length,
            successfulOperations: 0,
            failedOperations: 0,
            errorOperations: 0,
            uniqueUsers: 0, // Will be calculated later
            uniqueServers: 0, // Will be calculated later
            operationsByType: {},
            operationsByResult: {},
            timeRange: {
                earliest: null,
                latest: null
            }
        };
        const uniqueUsers = new Set();
        const uniqueServers = new Set();
        for (const log of logs) {
            // Count by result
            switch (log.result) {
                case 'success':
                    stats.successfulOperations++;
                    break;
                case 'failure':
                    stats.failedOperations++;
                    break;
                case 'error':
                    stats.errorOperations++;
                    break;
            }
            // Track unique users and servers
            if (log.userId) {
                uniqueUsers.add(log.userId);
            }
            if (log.serverId) {
                uniqueServers.add(log.serverId);
            }
            // Count by operation type
            stats.operationsByType[log.operation] = (stats.operationsByType[log.operation] || 0) + 1;
            stats.operationsByResult[log.result] = (stats.operationsByResult[log.result] || 0) + 1;
            // Track time range
            if (!stats.timeRange.earliest || log.createdAt < stats.timeRange.earliest) {
                stats.timeRange.earliest = log.createdAt;
            }
            if (!stats.timeRange.latest || log.createdAt > stats.timeRange.latest) {
                stats.timeRange.latest = log.createdAt;
            }
        }
        // Convert Sets to numbers
        return {
            ...stats,
            uniqueUsers: uniqueUsers.size,
            uniqueServers: uniqueServers.size
        };
    }
    /**
     * Get operation frequency statistics
     */
    async getOperationFrequency(timeWindow = 'day', limit = 30) {
        const now = new Date();
        const periods = [];
        for (let i = 0; i < limit; i++) {
            const endDate = new Date(now);
            const startDate = new Date(now);
            switch (timeWindow) {
                case 'hour':
                    endDate.setHours(endDate.getHours() - i);
                    startDate.setHours(startDate.getHours() - i - 1);
                    break;
                case 'day':
                    endDate.setDate(endDate.getDate() - i);
                    startDate.setDate(startDate.getDate() - i - 1);
                    break;
                case 'week':
                    endDate.setDate(endDate.getDate() - i * 7);
                    startDate.setDate(startDate.getDate() - (i + 1) * 7);
                    break;
                case 'month':
                    endDate.setMonth(endDate.getMonth() - i);
                    startDate.setMonth(startDate.getMonth() - i - 1);
                    break;
            }
            const logs = await this.auditOps.getAuditLogs({
                startDate,
                endDate,
                limit: 10000
            });
            const operations = {};
            for (const log of logs) {
                operations[log.operation] = (operations[log.operation] || 0) + 1;
            }
            periods.push({
                period: startDate.toISOString().split('T')[0],
                count: logs.length,
                operations
            });
        }
        return periods.reverse();
    }
}
exports.AuditStatisticsService = AuditStatisticsService;
// ============================================================================
// Audit Export Service
// ============================================================================
class AuditExportService {
    constructor(ctx) {
        this.ctx = ctx;
        this.auditOps = new operations_1.AuditOperations(ctx);
    }
    /**
     * Export audit logs in specified format
     */
    async exportLogs(options) {
        const logs = await this.auditOps.getAuditLogs(options.filter || {});
        switch (options.format) {
            case 'json':
                return this.exportAsJSON(logs, options);
            case 'csv':
                return this.exportAsCSV(logs, options);
            case 'xml':
                return this.exportAsXML(logs, options);
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
    }
    /**
     * Export as JSON format
     */
    exportAsJSON(logs, options) {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                totalRecords: logs.length,
                filter: options.filter || {},
                format: 'json'
            },
            logs: logs.map(log => ({
                id: log.id,
                userId: log.userId,
                serverId: log.serverId,
                operation: log.operation,
                operationData: log.operationData,
                result: log.result,
                errorMessage: log.errorMessage,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                createdAt: this.formatDate(log.createdAt, options.dateFormat)
            }))
        };
        return JSON.stringify(exportData, null, 2);
    }
    /**
     * Export as CSV format
     */
    exportAsCSV(logs, options) {
        const headers = [
            'ID', 'User ID', 'Server ID', 'Operation', 'Operation Data',
            'Result', 'Error Message', 'IP Address', 'User Agent', 'Created At'
        ];
        const rows = logs.map(log => [
            log.id.toString(),
            log.userId || '',
            log.serverId || '',
            log.operation,
            JSON.stringify(log.operationData),
            log.result,
            log.errorMessage || '',
            log.ipAddress || '',
            log.userAgent || '',
            this.formatDate(log.createdAt, options.dateFormat)
        ]);
        const csvContent = [];
        if (options.includeHeaders !== false) {
            csvContent.push(headers.join(','));
        }
        for (const row of rows) {
            csvContent.push(row.map(field => `"${field.replace(/"/g, '""')}"`).join(','));
        }
        return csvContent.join('\n');
    }
    /**
     * Export as XML format
     */
    exportAsXML(logs, options) {
        const xmlLines = ['<?xml version="1.0" encoding="UTF-8"?>'];
        xmlLines.push('<audit_logs>');
        xmlLines.push(`  <metadata>`);
        xmlLines.push(`    <export_date>${new Date().toISOString()}</export_date>`);
        xmlLines.push(`    <total_records>${logs.length}</total_records>`);
        xmlLines.push(`    <format>xml</format>`);
        xmlLines.push(`  </metadata>`);
        xmlLines.push(`  <logs>`);
        for (const log of logs) {
            xmlLines.push(`    <log id="${log.id}">`);
            xmlLines.push(`      <user_id>${this.escapeXML(log.userId || '')}</user_id>`);
            xmlLines.push(`      <server_id>${this.escapeXML(log.serverId || '')}</server_id>`);
            xmlLines.push(`      <operation>${this.escapeXML(log.operation)}</operation>`);
            xmlLines.push(`      <operation_data>${this.escapeXML(JSON.stringify(log.operationData))}</operation_data>`);
            xmlLines.push(`      <result>${this.escapeXML(log.result)}</result>`);
            xmlLines.push(`      <error_message>${this.escapeXML(log.errorMessage || '')}</error_message>`);
            xmlLines.push(`      <ip_address>${this.escapeXML(log.ipAddress || '')}</ip_address>`);
            xmlLines.push(`      <user_agent>${this.escapeXML(log.userAgent || '')}</user_agent>`);
            xmlLines.push(`      <created_at>${this.formatDate(log.createdAt, options.dateFormat)}</created_at>`);
            xmlLines.push(`    </log>`);
        }
        xmlLines.push(`  </logs>`);
        xmlLines.push('</audit_logs>');
        return xmlLines.join('\n');
    }
    /**
     * Format date according to specified format
     */
    formatDate(date, format) {
        if (!format) {
            return date.toISOString();
        }
        switch (format) {
            case 'iso':
                return date.toISOString();
            case 'local':
                return date.toLocaleString();
            case 'date':
                return date.toISOString().split('T')[0];
            case 'datetime':
                return date.toISOString().replace('T', ' ').split('.')[0];
            default:
                return date.toISOString();
        }
    }
    /**
     * Escape XML special characters
     */
    escapeXML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
exports.AuditExportService = AuditExportService;
// ============================================================================
// Main Audit Service
// ============================================================================
class AuditService {
    constructor(ctx) {
        this.ctx = ctx;
        this.logger = new AuditLogger(ctx);
        this.query = new AuditQueryService(ctx);
        this.statistics = new AuditStatisticsService(ctx);
        this.export = new AuditExportService(ctx);
    }
    /**
     * Perform audit log maintenance
     */
    async performMaintenance(retentionDays) {
        const auditOps = new operations_1.AuditOperations(this.ctx);
        // Get statistics before cleanup
        const recentLogs = await auditOps.getAuditLogs({ limit: 1 });
        const oldestLogs = await auditOps.getAuditLogs({ limit: 1, offset: 0 });
        // Perform cleanup
        const logsRemoved = await auditOps.cleanupOldLogs(retentionDays);
        return {
            logsRemoved,
            oldestLogDate: oldestLogs.length > 0 ? oldestLogs[0].createdAt : null,
            newestLogDate: recentLogs.length > 0 ? recentLogs[0].createdAt : null
        };
    }
    /**
     * Get audit service health status
     */
    async getHealthStatus() {
        try {
            // Test write capability
            const testLog = await this.logger.logSuccess('health.check', { timestamp: Date.now() }, { userId: 'system' });
            // Test read capability
            const recentLogs = await this.query.getRecentLogs(10);
            const canRead = recentLogs.length >= 0;
            const canWrite = testLog.id > 0;
            // Calculate oldest log age
            let oldestLogAge = null;
            if (recentLogs.length > 0) {
                const oldestLog = recentLogs[recentLogs.length - 1];
                oldestLogAge = Date.now() - oldestLog.createdAt.getTime();
            }
            const status = canRead && canWrite ? 'healthy' : 'degraded';
            return {
                status,
                details: {
                    canWrite,
                    canRead,
                    recentLogCount: recentLogs.length,
                    oldestLogAge
                }
            };
        }
        catch (error) {
            this.ctx.logger('mochi-link:audit').error('Audit health check failed:', error);
            return {
                status: 'unhealthy',
                details: {
                    canWrite: false,
                    canRead: false,
                    recentLogCount: 0,
                    oldestLogAge: null
                }
            };
        }
    }
}
exports.AuditService = AuditService;
