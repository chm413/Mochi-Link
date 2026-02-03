/**
 * Mochi-Link (大福连) - Audit Logging Service
 * 
 * This file implements the comprehensive audit logging service that records
 * all management operations with proper filtering and export capabilities.
 */

import { Context } from 'koishi';
import { AuditOperations } from '../database/operations';
import { AuditLog } from '../types';

// ============================================================================
// Audit Service Types
// ============================================================================

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

// ============================================================================
// Audit Logger Class
// ============================================================================

export class AuditLogger {
  private auditOps: AuditOperations;

  constructor(private ctx: Context) {
    this.auditOps = new AuditOperations(ctx);
  }

  /**
   * Log a successful operation
   */
  async logSuccess(
    operation: string,
    operationData: any,
    context: AuditContext = {}
  ): Promise<AuditLog> {
    return this.auditOps.logOperation(
      context.userId,
      context.serverId,
      operation,
      operationData,
      'success',
      undefined,
      context.ipAddress,
      context.userAgent
    );
  }

  /**
   * Log a failed operation
   */
  async logFailure(
    operation: string,
    operationData: any,
    errorMessage: string,
    context: AuditContext = {}
  ): Promise<AuditLog> {
    return this.auditOps.logOperation(
      context.userId,
      context.serverId,
      operation,
      operationData,
      'failure',
      errorMessage,
      context.ipAddress,
      context.userAgent
    );
  }

  /**
   * Log an error operation
   */
  async logError(
    operation: string,
    operationData: any,
    error: Error | string,
    context: AuditContext = {}
  ): Promise<AuditLog> {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.auditOps.logOperation(
      context.userId,
      context.serverId,
      operation,
      operationData,
      'error',
      errorMessage,
      context.ipAddress,
      context.userAgent
    );
  }

  /**
   * Log authentication failure
   */
  async logAuthFailure(
    serverId: string,
    reason: string,
    context: AuditContext = {}
  ): Promise<AuditLog> {
    return this.logFailure(
      'auth.failure',
      { serverId, reason },
      `Authentication failed: ${reason}`,
      { ...context, serverId }
    );
  }

  /**
   * Log permission denied
   */
  async logPermissionDenied(
    userId: string,
    serverId: string,
    operation: string,
    context: AuditContext = {}
  ): Promise<AuditLog> {
    return this.logFailure(
      'permission.denied',
      { userId, serverId, operation },
      `Permission denied for operation: ${operation}`,
      { ...context, userId, serverId }
    );
  }

  /**
   * Log connection events
   */
  async logConnection(
    serverId: string,
    event: 'connect' | 'disconnect' | 'reconnect',
    details: any = {},
    context: AuditContext = {}
  ): Promise<AuditLog> {
    return this.logSuccess(
      `connection.${event}`,
      { serverId, ...details },
      { ...context, serverId }
    );
  }

  /**
   * Log server management operations
   */
  async logServerOperation(
    serverId: string,
    operation: string,
    operationData: any,
    result: 'success' | 'failure' | 'error',
    errorMessage?: string,
    context: AuditContext = {}
  ): Promise<AuditLog> {
    return this.auditOps.logOperation(
      context.userId,
      serverId,
      `server.${operation}`,
      operationData,
      result,
      errorMessage,
      context.ipAddress,
      context.userAgent
    );
  }

  /**
   * Log player management operations
   */
  async logPlayerOperation(
    serverId: string,
    playerId: string,
    operation: string,
    operationData: any,
    result: 'success' | 'failure' | 'error',
    errorMessage?: string,
    context: AuditContext = {}
  ): Promise<AuditLog> {
    return this.auditOps.logOperation(
      context.userId,
      serverId,
      `player.${operation}`,
      { playerId, ...operationData },
      result,
      errorMessage,
      context.ipAddress,
      context.userAgent
    );
  }
}

// ============================================================================
// Audit Query Service
// ============================================================================

export class AuditQueryService {
  private auditOps: AuditOperations;

  constructor(private ctx: Context) {
    this.auditOps = new AuditOperations(ctx);
  }

  /**
   * Query audit logs with filters
   */
  async queryLogs(filter: AuditFilter = {}): Promise<AuditLog[]> {
    return this.auditOps.getAuditLogs(filter);
  }

  /**
   * Get audit log by ID
   */
  async getLogById(logId: number): Promise<AuditLog | null> {
    return this.auditOps.getAuditLog(logId);
  }

  /**
   * Get recent audit logs
   */
  async getRecentLogs(limit: number = 100): Promise<AuditLog[]> {
    return this.auditOps.getAuditLogs({ limit });
  }

  /**
   * Get audit logs for specific user
   */
  async getUserLogs(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditOps.getAuditLogs({ userId, limit });
  }

  /**
   * Get audit logs for specific server
   */
  async getServerLogs(serverId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditOps.getAuditLogs({ serverId, limit });
  }

  /**
   * Get audit logs for specific operation
   */
  async getOperationLogs(operation: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditOps.getAuditLogs({ operation, limit });
  }

  /**
   * Get audit logs within date range
   */
  async getLogsInDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<AuditLog[]> {
    return this.auditOps.getAuditLogs({ startDate, endDate, limit });
  }

  /**
   * Search audit logs by operation pattern
   */
  async searchLogs(
    searchTerm: string,
    filter: Omit<AuditFilter, 'operation'> = {}
  ): Promise<AuditLog[]> {
    // This is a simplified search - in a real implementation,
    // you might want to use database-specific search features
    const allLogs = await this.auditOps.getAuditLogs(filter);
    return allLogs.filter(log => 
      log.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.operationData).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
}

// ============================================================================
// Audit Statistics Service
// ============================================================================

export class AuditStatisticsService {
  private auditOps: AuditOperations;

  constructor(private ctx: Context) {
    this.auditOps = new AuditOperations(ctx);
  }

  /**
   * Get comprehensive audit statistics
   */
  async getStatistics(filter: AuditFilter = {}): Promise<AuditStatistics> {
    const logs = await this.auditOps.getAuditLogs({
      ...filter,
      limit: 10000 // Get a large sample for statistics
    });

    const stats: AuditStatistics = {
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

    const uniqueUsers = new Set<string>();
    const uniqueServers = new Set<string>();

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
  async getOperationFrequency(
    timeWindow: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit: number = 30
  ): Promise<Array<{ period: string; count: number; operations: Record<string, number> }>> {
    const now = new Date();
    const periods: Array<{ period: string; count: number; operations: Record<string, number> }> = [];

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

      const operations: Record<string, number> = {};
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

// ============================================================================
// Audit Export Service
// ============================================================================

export class AuditExportService {
  private auditOps: AuditOperations;

  constructor(private ctx: Context) {
    this.auditOps = new AuditOperations(ctx);
  }

  /**
   * Export audit logs in specified format
   */
  async exportLogs(options: AuditExportOptions): Promise<string> {
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
  private exportAsJSON(logs: AuditLog[], options: AuditExportOptions): string {
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
  private exportAsCSV(logs: AuditLog[], options: AuditExportOptions): string {
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
  private exportAsXML(logs: AuditLog[], options: AuditExportOptions): string {
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
  private formatDate(date: Date, format?: string): string {
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
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// ============================================================================
// Main Audit Service
// ============================================================================

export class AuditService {
  public logger: AuditLogger;
  public query: AuditQueryService;
  public statistics: AuditStatisticsService;
  public export: AuditExportService;

  constructor(private ctx: Context) {
    this.logger = new AuditLogger(ctx);
    this.query = new AuditQueryService(ctx);
    this.statistics = new AuditStatisticsService(ctx);
    this.export = new AuditExportService(ctx);
  }

  /**
   * Perform audit log maintenance
   */
  async performMaintenance(retentionDays: number): Promise<{
    logsRemoved: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
  }> {
    const auditOps = new AuditOperations(this.ctx);
    
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
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      canWrite: boolean;
      canRead: boolean;
      recentLogCount: number;
      oldestLogAge: number | null;
    };
  }> {
    try {
      // Test write capability
      const testLog = await this.logger.logSuccess(
        'health.check',
        { timestamp: Date.now() },
        { userId: 'system' }
      );

      // Test read capability
      const recentLogs = await this.query.getRecentLogs(10);
      const canRead = recentLogs.length >= 0;
      const canWrite = testLog.id > 0;

      // Calculate oldest log age
      let oldestLogAge: number | null = null;
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
    } catch (error) {
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