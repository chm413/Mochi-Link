/**
 * Mochi-Link (大福连) - Audit Logging Service
 *
 * This file implements the comprehensive audit logging service that records
 * all management operations with proper filtering and export capabilities.
 */
import { Context } from 'koishi';
import { AuditLog } from '../types';
export interface AuditFilter {
    userId?: string;
    serverId?: string;
    operation?: string;
    result?: 'success' | 'failure' | 'error';
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    limit?: number;
    offset?: number;
}
export interface AuditExportOptions {
    format: 'json' | 'csv' | 'xml';
    filter?: AuditFilter;
    includeHeaders?: boolean;
    dateFormat?: string;
}
export interface AuditStatistics {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    errorOperations: number;
    uniqueUsers: number;
    uniqueServers: number;
    operationsByType: Record<string, number>;
    operationsByResult: Record<string, number>;
    timeRange: {
        earliest: Date | null;
        latest: Date | null;
    };
}
export interface AuditContext {
    userId?: string;
    serverId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
}
export declare class AuditLogger {
    private ctx;
    private auditOps;
    constructor(ctx: Context);
    /**
     * Log a successful operation
     */
    logSuccess(operation: string, operationData: any, context?: AuditContext): Promise<AuditLog>;
    /**
     * Log a failed operation
     */
    logFailure(operation: string, operationData: any, errorMessage: string, context?: AuditContext): Promise<AuditLog>;
    /**
     * Log an error operation
     */
    logError(operation: string, operationData: any, error: Error | string, context?: AuditContext): Promise<AuditLog>;
    /**
     * Log authentication failure
     */
    logAuthFailure(serverId: string, reason: string, context?: AuditContext): Promise<AuditLog>;
    /**
     * Log permission denied
     */
    logPermissionDenied(userId: string, serverId: string, operation: string, context?: AuditContext): Promise<AuditLog>;
    /**
     * Log connection events
     */
    logConnection(serverId: string, event: 'connect' | 'disconnect' | 'reconnect', details?: any, context?: AuditContext): Promise<AuditLog>;
    /**
     * Log server management operations
     */
    logServerOperation(serverId: string, operation: string, operationData: any, result: 'success' | 'failure' | 'error', errorMessage?: string, context?: AuditContext): Promise<AuditLog>;
    /**
     * Log player management operations
     */
    logPlayerOperation(serverId: string, playerId: string, operation: string, operationData: any, result: 'success' | 'failure' | 'error', errorMessage?: string, context?: AuditContext): Promise<AuditLog>;
}
export declare class AuditQueryService {
    private ctx;
    private auditOps;
    constructor(ctx: Context);
    /**
     * Query audit logs with filters
     */
    queryLogs(filter?: AuditFilter): Promise<AuditLog[]>;
    /**
     * Get audit log by ID
     */
    getLogById(logId: number): Promise<AuditLog | null>;
    /**
     * Get recent audit logs
     */
    getRecentLogs(limit?: number): Promise<AuditLog[]>;
    /**
     * Get audit logs for specific user
     */
    getUserLogs(userId: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Get audit logs for specific server
     */
    getServerLogs(serverId: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Get audit logs for specific operation
     */
    getOperationLogs(operation: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Get audit logs within date range
     */
    getLogsInDateRange(startDate: Date, endDate: Date, limit?: number): Promise<AuditLog[]>;
    /**
     * Search audit logs by operation pattern
     */
    searchLogs(searchTerm: string, filter?: Omit<AuditFilter, 'operation'>): Promise<AuditLog[]>;
}
export declare class AuditStatisticsService {
    private ctx;
    private auditOps;
    constructor(ctx: Context);
    /**
     * Get comprehensive audit statistics
     */
    getStatistics(filter?: AuditFilter): Promise<AuditStatistics>;
    /**
     * Get operation frequency statistics
     */
    getOperationFrequency(timeWindow?: 'hour' | 'day' | 'week' | 'month', limit?: number): Promise<Array<{
        period: string;
        count: number;
        operations: Record<string, number>;
    }>>;
}
export declare class AuditExportService {
    private ctx;
    private auditOps;
    constructor(ctx: Context);
    /**
     * Export audit logs in specified format
     */
    exportLogs(options: AuditExportOptions): Promise<string>;
    /**
     * Export as JSON format
     */
    private exportAsJSON;
    /**
     * Export as CSV format
     */
    private exportAsCSV;
    /**
     * Export as XML format
     */
    private exportAsXML;
    /**
     * Format date according to specified format
     */
    private formatDate;
    /**
     * Escape XML special characters
     */
    private escapeXML;
}
export declare class AuditService {
    private ctx;
    logger: AuditLogger;
    query: AuditQueryService;
    statistics: AuditStatisticsService;
    export: AuditExportService;
    constructor(ctx: Context);
    /**
     * Perform audit log maintenance
     */
    performMaintenance(retentionDays: number): Promise<{
        logsRemoved: number;
        oldestLogDate: Date | null;
        newestLogDate: Date | null;
    }>;
    /**
     * Get audit service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: {
            canWrite: boolean;
            canRead: boolean;
            recentLogCount: number;
            oldestLogAge: number | null;
        };
    }>;
}
