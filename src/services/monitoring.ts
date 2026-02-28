/**
 * Monitoring Service - Performance Monitoring and Status Reporting
 * 
 * This service implements the performance monitoring and status reporting system
 * for the Minecraft Unified Management and Monitoring System. It handles timed
 * status reporting, performance metrics collection, historical data storage,
 * and alert detection and notification.
 */

import { Context } from 'koishi';
import { 
  ServerInfo,
  PerformanceMetrics,
  MemoryInfo,
  DiskInfo,
  WorldInfo,
  ServerStatus,
  Connection,
  BaseEvent,
  EventType
} from '../types';
import { AuditService } from './audit';
import { EventService } from './event';

// ============================================================================
// Monitoring Types
// ============================================================================

export interface MonitoringConfig {
  reportInterval: number; // in milliseconds
  historyRetention: number; // in days
  alertThresholds: AlertThresholds;
  enabledMetrics: string[];
  storageConfig: StorageConfig;
}

export interface AlertThresholds {
  tpsLow: number;
  memoryHigh: number; // percentage
  diskHigh: number; // percentage
  playerFlood: number; // players per minute
  cpuHigh: number; // percentage
  pingHigh: number; // milliseconds
}

export interface StorageConfig {
  maxHistoryEntries: number;
  compressionEnabled: boolean;
  aggregationIntervals: number[]; // in minutes
}

export interface ServerStatusReport {
  serverId: string;
  timestamp: number;
  status: ServerStatus;
  uptime: number;
  playerCount: number;
  maxPlayers: number;
  tps: number;
  memoryUsage: MemoryInfo;
  cpuUsage: number;
  ping: number;
  worldInfo: WorldInfo[];
  version: string;
}

export interface HistoricalData {
  serverId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  interval: number; // in minutes
  metrics: HistoricalMetric[];
}

export interface HistoricalMetric {
  timestamp: number;
  tps: number;
  playerCount: number;
  memoryUsage: number;
  cpuUsage: number;
  ping: number;
}

export interface Alert {
  id: string;
  serverId: string;
  type: EventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

export interface MonitoringStats {
  totalReports: number;
  reportsByServer: Record<string, number>;
  averageReportInterval: number;
  alertsGenerated: number;
  alertsByType: Record<EventType, number>;
  dataStorageUsage: number;
}

// ============================================================================
// Monitoring Service
// ============================================================================

export class MonitoringService {
  private config: MonitoringConfig;
  private reportIntervals = new Map<string, NodeJS.Timeout>();
  private serverConnections = new Map<string, Connection>();
  private historicalData = new Map<string, HistoricalMetric[]>();
  private activeAlerts = new Map<string, Alert>();
  private stats: MonitoringStats = {
    totalReports: 0,
    reportsByServer: {},
    averageReportInterval: 0,
    alertsGenerated: 0,
    alertsByType: {} as Record<EventType, number>,
    dataStorageUsage: 0
  };
  private logger: any;

  constructor(
    private ctx: Context,
    private auditService: AuditService,
    private eventService: EventService,
    config?: Partial<MonitoringConfig>
  ) {
    this.logger = ctx.logger('mochi-link:monitoring');
    
    this.config = {
      reportInterval: 30000, // 30 seconds
      historyRetention: 7, // 7 days
      alertThresholds: {
        tpsLow: 15.0,
        memoryHigh: 85.0,
        diskHigh: 90.0,
        playerFlood: 20,
        cpuHigh: 80.0,
        pingHigh: 200
      },
      enabledMetrics: ['tps', 'memory', 'cpu', 'players', 'ping'],
      storageConfig: {
        maxHistoryEntries: 10000,
        compressionEnabled: true,
        aggregationIntervals: [1, 5, 15, 60] // 1min, 5min, 15min, 1hour
      },
      ...config
    };

    this.startCleanupTask();
  }

  // ============================================================================
  // Server Registration and Management
  // ============================================================================

  /**
   * Register server for monitoring
   */
  async registerServer(serverId: string, connection: Connection): Promise<void> {
    this.serverConnections.set(serverId, connection);
    
    // Initialize historical data storage
    if (!this.historicalData.has(serverId)) {
      this.historicalData.set(serverId, []);
    }

    // Initialize stats
    if (!this.stats.reportsByServer[serverId]) {
      this.stats.reportsByServer[serverId] = 0;
    }

    // Start monitoring
    await this.startMonitoring(serverId);

    await this.auditService.logger.logSuccess(
      'monitoring.register_server',
      { serverId },
      { serverId }
    );

    this.logger.info(`Server registered for monitoring: ${serverId}`);
  }

  /**
   * Unregister server from monitoring
   */
  async unregisterServer(serverId: string): Promise<void> {
    // Stop monitoring
    await this.stopMonitoring(serverId);

    // Remove from collections
    this.serverConnections.delete(serverId);
    
    // Keep historical data for retention period
    // (actual cleanup happens in cleanup task)

    await this.auditService.logger.logSuccess(
      'monitoring.unregister_server',
      { serverId },
      { serverId }
    );

    this.logger.info(`Server unregistered from monitoring: ${serverId}`);
  }

  // ============================================================================
  // Monitoring Control
  // ============================================================================

  /**
   * Start monitoring for a server
   */
  async startMonitoring(serverId: string): Promise<void> {
    // Stop existing monitoring if any
    await this.stopMonitoring(serverId);

    // Start periodic status reporting
    const interval = setInterval(async () => {
      try {
        await this.collectAndReportStatus(serverId);
      } catch (error) {
        this.logger.error(`Error collecting status for ${serverId}:`, error);
      }
    }, this.config.reportInterval);

    this.reportIntervals.set(serverId, interval);
    this.logger.info(`Monitoring started for server: ${serverId}`);
  }

  /**
   * Stop monitoring for a server
   */
  async stopMonitoring(serverId: string): Promise<void> {
    const interval = this.reportIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.reportIntervals.delete(serverId);
      this.logger.info(`Monitoring stopped for server: ${serverId}`);
    }
  }

  /**
   * Update monitoring configuration
   */
  async updateConfig(newConfig: Partial<MonitoringConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart monitoring if report interval changed
    if (newConfig.reportInterval && newConfig.reportInterval !== oldConfig.reportInterval) {
      for (const serverId of this.serverConnections.keys()) {
        await this.startMonitoring(serverId);
      }
    }

    await this.auditService.logger.logSuccess(
      'monitoring.update_config',
      { oldConfig, newConfig: this.config }
    );

    this.logger.info('Monitoring configuration updated');
  }

  // ============================================================================
  // Status Collection and Reporting
  // ============================================================================

  /**
   * Collect and report server status
   */
  private async collectAndReportStatus(serverId: string): Promise<void> {
    const connection = this.serverConnections.get(serverId);
    if (!connection || connection.status !== 'connected') {
      this.logger.debug(`Skipping status collection for disconnected server: ${serverId}`);
      return;
    }

    try {
      // Request server info from connector
      const serverInfo = await this.requestServerInfo(connection);
      const performanceMetrics = await this.requestPerformanceMetrics(connection);

      // Create status report
      const statusReport: ServerStatusReport = {
        serverId,
        timestamp: Date.now(),
        status: this.determineServerStatus(serverInfo, performanceMetrics),
        uptime: serverInfo.uptime,
        playerCount: serverInfo.onlinePlayers,
        maxPlayers: serverInfo.maxPlayers,
        tps: serverInfo.tps,
        memoryUsage: serverInfo.memoryUsage,
        cpuUsage: performanceMetrics.cpuUsage,
        ping: performanceMetrics.ping,
        worldInfo: serverInfo.worldInfo,
        version: serverInfo.version
      };

      // Store historical data
      await this.storeHistoricalData(statusReport);

      // Check for alerts
      await this.checkAlerts(statusReport);

      // Update statistics
      this.updateStats(statusReport);

      // Send status event
      await this.sendStatusEvent(statusReport);

      this.logger.debug(`Status collected for ${serverId}: TPS=${statusReport.tps}, Players=${statusReport.playerCount}`);

    } catch (error) {
      this.logger.error(`Failed to collect status for ${serverId}:`, error);
      
      // Send error alert
      await this.sendAlert(serverId, 'server.status', 'high', 'Status collection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Request server info from connector
   */
  private async requestServerInfo(connection: Connection): Promise<ServerInfo> {
    // This would send a request to the connector bridge
    // For now, we'll simulate the response
    return {
      serverId: connection.serverId,
      name: `Server ${connection.serverId}`,
      version: '1.20.1',
      coreType: 'Java',
      coreName: 'Paper',
      maxPlayers: 20,
      onlinePlayers: Math.floor(Math.random() * 20),
      uptime: Date.now() - (Math.random() * 86400000), // Random uptime up to 24h
      tps: 20.0 - (Math.random() * 5), // Random TPS between 15-20
      memoryUsage: {
        used: Math.floor(Math.random() * 4000),
        max: 4096,
        free: 0,
        percentage: 0
      },
      worldInfo: [
        {
          name: 'world',
          dimension: 'overworld',
          playerCount: Math.floor(Math.random() * 10),
          loadedChunks: Math.floor(Math.random() * 1000)
        }
      ]
    };
  }

  /**
   * Request performance metrics from connector
   */
  private async requestPerformanceMetrics(connection: Connection): Promise<PerformanceMetrics> {
    // This would send a request to the connector bridge
    // For now, we'll simulate the response
    return {
      serverId: connection.serverId,
      timestamp: Date.now(),
      tps: 20.0 - (Math.random() * 5),
      cpuUsage: Math.random() * 100,
      memoryUsage: {
        used: Math.floor(Math.random() * 4000),
        max: 4096,
        free: 0,
        percentage: 0
      },
      playerCount: Math.floor(Math.random() * 20),
      ping: Math.floor(Math.random() * 100),
      diskUsage: {
        used: Math.floor(Math.random() * 50000),
        total: 100000,
        free: 0,
        percentage: 0
      }
    };
  }

  /**
   * Determine server status from metrics
   */
  private determineServerStatus(serverInfo: ServerInfo, metrics: PerformanceMetrics): ServerStatus {
    if (serverInfo.tps < this.config.alertThresholds.tpsLow) {
      return 'error';
    }
    if (metrics.memoryUsage.percentage > this.config.alertThresholds.memoryHigh) {
      return 'error';
    }
    if (metrics.cpuUsage > this.config.alertThresholds.cpuHigh) {
      return 'error';
    }
    return 'online';
  }

  // ============================================================================
  // Historical Data Management
  // ============================================================================

  /**
   * Store historical data
   */
  private async storeHistoricalData(report: ServerStatusReport): Promise<void> {
    const historicalMetric: HistoricalMetric = {
      timestamp: report.timestamp,
      tps: report.tps,
      playerCount: report.playerCount,
      memoryUsage: report.memoryUsage.percentage,
      cpuUsage: report.cpuUsage,
      ping: report.ping
    };

    let history = this.historicalData.get(report.serverId) || [];
    history.push(historicalMetric);

    // Limit history size
    if (history.length > this.config.storageConfig.maxHistoryEntries) {
      history = history.slice(-this.config.storageConfig.maxHistoryEntries);
    }

    this.historicalData.set(report.serverId, history);
  }

  /**
   * Get historical data
   */
  async getHistoricalData(
    serverId: string,
    timeRange: { start: Date; end: Date },
    interval: number = 1
  ): Promise<HistoricalData> {
    const history = this.historicalData.get(serverId) || [];
    
    // Filter by time range
    const filteredHistory = history.filter(metric => 
      metric.timestamp >= timeRange.start.getTime() && 
      metric.timestamp <= timeRange.end.getTime()
    );

    // Aggregate by interval if needed
    const aggregatedHistory = this.aggregateHistoricalData(filteredHistory, interval);

    return {
      serverId,
      timeRange,
      interval,
      metrics: aggregatedHistory
    };
  }

  /**
   * Aggregate historical data by interval
   */
  private aggregateHistoricalData(
    metrics: HistoricalMetric[],
    intervalMinutes: number
  ): HistoricalMetric[] {
    if (intervalMinutes <= 1) {
      return metrics;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const aggregated: HistoricalMetric[] = [];
    const buckets = new Map<number, HistoricalMetric[]>();

    // Group metrics into time buckets
    for (const metric of metrics) {
      const bucketTime = Math.floor(metric.timestamp / intervalMs) * intervalMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(metric);
    }

    // Aggregate each bucket
    for (const [bucketTime, bucketMetrics] of buckets) {
      const aggregatedMetric: HistoricalMetric = {
        timestamp: bucketTime,
        tps: this.average(bucketMetrics.map(m => m.tps)),
        playerCount: Math.round(this.average(bucketMetrics.map(m => m.playerCount))),
        memoryUsage: this.average(bucketMetrics.map(m => m.memoryUsage)),
        cpuUsage: this.average(bucketMetrics.map(m => m.cpuUsage)),
        ping: this.average(bucketMetrics.map(m => m.ping))
      };
      aggregated.push(aggregatedMetric);
    }

    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate average of numbers
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  // ============================================================================
  // Alert Detection and Management
  // ============================================================================

  /**
   * Check for alerts based on status report
   */
  private async checkAlerts(report: ServerStatusReport): Promise<void> {
    const alerts: Array<{ type: EventType; severity: Alert['severity']; message: string; data: any }> = [];

    // TPS low alert
    if (report.tps < this.config.alertThresholds.tpsLow) {
      alerts.push({
        type: 'alert.tpsLow',
        severity: report.tps < 10 ? 'critical' : 'high',
        message: `Low TPS detected: ${report.tps.toFixed(2)}`,
        data: { tps: report.tps, threshold: this.config.alertThresholds.tpsLow }
      });
    }

    // Memory high alert
    if (report.memoryUsage.percentage > this.config.alertThresholds.memoryHigh) {
      alerts.push({
        type: 'alert.memoryHigh',
        severity: report.memoryUsage.percentage > 95 ? 'critical' : 'high',
        message: `High memory usage: ${report.memoryUsage.percentage.toFixed(1)}%`,
        data: { memoryUsage: report.memoryUsage, threshold: this.config.alertThresholds.memoryHigh }
      });
    }

    // CPU high alert
    if (report.cpuUsage > this.config.alertThresholds.cpuHigh) {
      alerts.push({
        type: 'alert.memoryHigh', // Reusing memory high for CPU (would need separate type)
        severity: report.cpuUsage > 95 ? 'critical' : 'high',
        message: `High CPU usage: ${report.cpuUsage.toFixed(1)}%`,
        data: { cpuUsage: report.cpuUsage, threshold: this.config.alertThresholds.cpuHigh }
      });
    }

    // Send alerts
    for (const alertData of alerts) {
      await this.sendAlert(
        report.serverId,
        alertData.type,
        alertData.severity,
        alertData.message,
        alertData.data
      );
    }
  }

  /**
   * Send alert
   */
  private async sendAlert(
    serverId: string,
    type: EventType,
    severity: Alert['severity'],
    message: string,
    data: any
  ): Promise<void> {
    const alertId = this.generateAlertId();
    
    const alert: Alert = {
      id: alertId,
      serverId,
      type,
      severity,
      message,
      data,
      timestamp: Date.now(),
      acknowledged: false
    };

    // Store alert
    this.activeAlerts.set(alertId, alert);

    // Update statistics
    this.stats.alertsGenerated++;
    if (!this.stats.alertsByType[type]) {
      this.stats.alertsByType[type] = 0;
    }
    this.stats.alertsByType[type]++;

    // Send alert event
    const alertEvent: BaseEvent = {
      type,
      serverId,
      timestamp: new Date(alert.timestamp).toISOString(),
      version: '1.0'
    };

    // Send through event service
    await this.eventService.handleIncomingEvent(alertEvent);

    // Log alert
    await this.auditService.logger.logSuccess(
      'monitoring.alert_generated',
      alert,
      { serverId }
    );

    this.logger.warn(`Alert generated: ${type} for ${serverId} - ${message}`);
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = Date.now();

    await this.auditService.logger.logSuccess(
      'monitoring.alert_acknowledged',
      { alertId, acknowledgedAt: alert.acknowledgedAt },
      { userId, serverId: alert.serverId }
    );

    this.logger.info(`Alert acknowledged: ${alertId} by ${userId}`);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(serverId?: string): Alert[] {
    const alerts = Array.from(this.activeAlerts.values());
    
    if (serverId) {
      return alerts.filter(alert => alert.serverId === serverId && !alert.acknowledged);
    }
    
    return alerts.filter(alert => !alert.acknowledged);
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Send status event
   */
  private async sendStatusEvent(report: ServerStatusReport): Promise<void> {
    const statusEvent: BaseEvent = {
      type: 'server.status',
      serverId: report.serverId,
      timestamp: new Date(report.timestamp).toISOString(),
      version: '1.0'
    };

    // This would normally be handled by the event service
    // For now, we'll just log it
    this.logger.debug(`Status event: ${report.serverId} - ${report.status}`);
  }

  // ============================================================================
  // Statistics and Metrics
  // ============================================================================

  /**
   * Update statistics
   */
  private updateStats(report: ServerStatusReport): void {
    this.stats.totalReports++;
    this.stats.reportsByServer[report.serverId]++;
    
    // Update average report interval (simplified)
    this.stats.averageReportInterval = this.config.reportInterval;
    
    // Update data storage usage (simplified)
    this.stats.dataStorageUsage = Array.from(this.historicalData.values())
      .reduce((total, history) => total + history.length, 0);
  }

  /**
   * Get monitoring statistics
   */
  getStats(): MonitoringStats {
    return { ...this.stats };
  }

  /**
   * Get server performance summary
   */
  async getServerPerformanceSummary(serverId: string): Promise<{
    currentStatus: ServerStatusReport | null;
    averageMetrics: {
      tps: number;
      memoryUsage: number;
      cpuUsage: number;
      playerCount: number;
    };
    alertCount: number;
    uptimePercentage: number;
  }> {
    const history = this.historicalData.get(serverId) || [];
    const recentHistory = history.slice(-100); // Last 100 reports
    
    const averageMetrics = {
      tps: this.average(recentHistory.map(h => h.tps)),
      memoryUsage: this.average(recentHistory.map(h => h.memoryUsage)),
      cpuUsage: this.average(recentHistory.map(h => h.cpuUsage)),
      playerCount: this.average(recentHistory.map(h => h.playerCount))
    };

    const alertCount = Array.from(this.activeAlerts.values())
      .filter(alert => alert.serverId === serverId).length;

    // Simplified uptime calculation
    const uptimePercentage = 95.0; // Would calculate from actual data

    return {
      currentStatus: null, // Would get from latest report
      averageMetrics,
      alertCount,
      uptimePercentage
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanupOldData();
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Cleanup old historical data
   */
  private cleanupOldData(): void {
    const retentionMs = this.config.historyRetention * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    for (const [serverId, history] of this.historicalData) {
      const filteredHistory = history.filter(metric => metric.timestamp > cutoffTime);
      this.historicalData.set(serverId, filteredHistory);
    }

    this.logger.debug('Historical data cleanup completed');
  }

  /**
   * Cleanup old alerts
   */
  private cleanupOldAlerts(): void {
    const alertRetentionMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoffTime = Date.now() - alertRetentionMs;

    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.acknowledged && alert.acknowledgedAt && alert.acknowledgedAt < cutoffTime) {
        this.activeAlerts.delete(alertId);
      }
    }

    this.logger.debug('Alert cleanup completed');
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Shutdown monitoring service
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down monitoring service...');

    // Stop all monitoring intervals
    for (const [serverId, interval] of this.reportIntervals) {
      clearInterval(interval);
    }

    this.reportIntervals.clear();
    this.serverConnections.clear();

    this.logger.info('Monitoring service shutdown complete');
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const activeMonitoring = this.reportIntervals.size;
    const totalHistoryEntries = Array.from(this.historicalData.values())
      .reduce((total, history) => total + history.length, 0);
    const activeAlertCount = this.getActiveAlerts().length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (activeAlertCount > 10) {
      status = 'degraded';
    }
    if (activeAlertCount > 50) {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        activeMonitoring,
        totalHistoryEntries,
        activeAlertCount,
        totalReports: this.stats.totalReports,
        averageReportInterval: this.stats.averageReportInterval
      }
    };
  }
}