/**
 * Monitoring Service - Performance Monitoring and Status Reporting
 *
 * This service implements the performance monitoring and status reporting system
 * for the Minecraft Unified Management and Monitoring System. It handles timed
 * status reporting, performance metrics collection, historical data storage,
 * and alert detection and notification.
 */
import { Context } from 'koishi';
import { MemoryInfo, WorldInfo, ServerStatus, Connection, EventType } from '../types';
import { AuditService } from './audit';
import { EventService } from './event';
export interface MonitoringConfig {
    reportInterval: number;
    historyRetention: number;
    alertThresholds: AlertThresholds;
    enabledMetrics: string[];
    storageConfig: StorageConfig;
}
export interface AlertThresholds {
    tpsLow: number;
    memoryHigh: number;
    diskHigh: number;
    playerFlood: number;
    cpuHigh: number;
    pingHigh: number;
}
export interface StorageConfig {
    maxHistoryEntries: number;
    compressionEnabled: boolean;
    aggregationIntervals: number[];
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
    interval: number;
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
export declare class MonitoringService {
    private ctx;
    private auditService;
    private eventService;
    private config;
    private reportIntervals;
    private serverConnections;
    private historicalData;
    private activeAlerts;
    private stats;
    private logger;
    constructor(ctx: Context, auditService: AuditService, eventService: EventService, config?: Partial<MonitoringConfig>);
    /**
     * Register server for monitoring
     */
    registerServer(serverId: string, connection: Connection): Promise<void>;
    /**
     * Unregister server from monitoring
     */
    unregisterServer(serverId: string): Promise<void>;
    /**
     * Start monitoring for a server
     */
    startMonitoring(serverId: string): Promise<void>;
    /**
     * Stop monitoring for a server
     */
    stopMonitoring(serverId: string): Promise<void>;
    /**
     * Update monitoring configuration
     */
    updateConfig(newConfig: Partial<MonitoringConfig>): Promise<void>;
    /**
     * Collect and report server status
     */
    private collectAndReportStatus;
    /**
     * Request server info from connector
     */
    private requestServerInfo;
    /**
     * Request performance metrics from connector
     */
    private requestPerformanceMetrics;
    /**
     * Determine server status from metrics
     */
    private determineServerStatus;
    /**
     * Store historical data
     */
    private storeHistoricalData;
    /**
     * Get historical data
     */
    getHistoricalData(serverId: string, timeRange: {
        start: Date;
        end: Date;
    }, interval?: number): Promise<HistoricalData>;
    /**
     * Aggregate historical data by interval
     */
    private aggregateHistoricalData;
    /**
     * Calculate average of numbers
     */
    private average;
    /**
     * Check for alerts based on status report
     */
    private checkAlerts;
    /**
     * Send alert
     */
    private sendAlert;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string, userId: string): Promise<void>;
    /**
     * Get active alerts
     */
    getActiveAlerts(serverId?: string): Alert[];
    /**
     * Send status event
     */
    private sendStatusEvent;
    /**
     * Update statistics
     */
    private updateStats;
    /**
     * Get monitoring statistics
     */
    getStats(): MonitoringStats;
    /**
     * Get server performance summary
     */
    getServerPerformanceSummary(serverId: string): Promise<{
        currentStatus: ServerStatusReport | null;
        averageMetrics: {
            tps: number;
            memoryUsage: number;
            cpuUsage: number;
            playerCount: number;
        };
        alertCount: number;
        uptimePercentage: number;
    }>;
    /**
     * Generate alert ID
     */
    private generateAlertId;
    /**
     * Start cleanup task
     */
    private startCleanupTask;
    /**
     * Cleanup old historical data
     */
    private cleanupOldData;
    /**
     * Cleanup old alerts
     */
    private cleanupOldAlerts;
    /**
     * Shutdown monitoring service
     */
    shutdown(): Promise<void>;
    /**
     * Get health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
}
