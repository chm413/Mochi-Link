/**
 * Health Check and Monitoring Service
 *
 * This service provides comprehensive health monitoring, system status tracking,
 * and diagnostic endpoints for the Mochi-Link system.
 */
import { Context } from 'koishi';
import { EventEmitter } from 'events';
export interface HealthCheckConfig {
    systemCheckInterval: number;
    serviceCheckInterval: number;
    deepCheckInterval: number;
    checkTimeout: number;
    serviceTimeout: number;
    thresholds: {
        memoryUsage: number;
        cpuUsage: number;
        responseTime: number;
        errorRate: number;
        diskUsage: number;
    };
    alerting: {
        enabled: boolean;
        cooldownPeriod: number;
        escalationThreshold: number;
    };
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    uptime: number;
    version: string;
    environment: string;
    system: {
        memory: {
            used: number;
            total: number;
            percentage: number;
            heap: {
                used: number;
                total: number;
                percentage: number;
            };
        };
        cpu: {
            usage: number;
            loadAverage: number[];
        };
        disk?: {
            used: number;
            total: number;
            percentage: number;
        };
        network?: {
            connections: number;
            bytesIn: number;
            bytesOut: number;
        };
    };
    services: {
        [serviceName: string]: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            responseTime: number;
            lastCheck: number;
            errorCount: number;
            details?: any;
        };
    };
    components: {
        database: ComponentHealth;
        websocket: ComponentHealth;
        http: ComponentHealth;
        cache: ComponentHealth;
        performance: ComponentHealth;
    };
    alerts: HealthAlert[];
    performance: {
        avgResponseTime: number;
        requestsPerMinute: number;
        errorRate: number;
        throughput: number;
    };
}
export interface ComponentHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    lastCheck: number;
    errorCount: number;
    uptime: number;
    details: any;
}
export interface HealthAlert {
    id: string;
    type: 'memory' | 'cpu' | 'disk' | 'response_time' | 'error_rate' | 'service' | 'component';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: number;
    acknowledged: boolean;
    value?: number;
    threshold?: number;
    component?: string;
    service?: string;
}
export interface DiagnosticInfo {
    timestamp: number;
    system: {
        nodeVersion: string;
        platform: string;
        arch: string;
        pid: number;
        ppid: number;
        uptime: number;
        cwd: string;
        execPath: string;
        argv: string[];
        env: Record<string, string>;
    };
    memory: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
    };
    cpu: {
        user: number;
        system: number;
    };
    versions: Record<string, string>;
    features: {
        inspector: boolean;
        debug: boolean;
        uv: boolean;
        ipv6: boolean;
        tls_alpn: boolean;
        tls_sni: boolean;
        tls_ocsp: boolean;
        tls: boolean;
    };
}
export declare class HealthMonitoringService extends EventEmitter {
    private ctx;
    private logger;
    private config;
    private isRunning;
    private startTime;
    private systemCheckInterval?;
    private serviceCheckInterval?;
    private deepCheckInterval?;
    private currentStatus?;
    private alerts;
    private alertCooldowns;
    private metricsHistory;
    constructor(ctx: Context, config?: Partial<HealthCheckConfig>);
    /**
     * Start health monitoring
     */
    start(): Promise<void>;
    /**
     * Stop health monitoring
     */
    stop(): Promise<void>;
    /**
     * Get current health status
     */
    getHealthStatus(): Promise<HealthStatus>;
    /**
     * Get simplified health check (for load balancers)
     */
    getSimpleHealthCheck(): Promise<{
        status: string;
        timestamp: number;
    }>;
    /**
     * Get detailed diagnostic information
     */
    getDiagnosticInfo(): DiagnosticInfo;
    /**
     * Get active alerts
     */
    getActiveAlerts(): HealthAlert[];
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): boolean;
    private startSystemChecks;
    private startServiceChecks;
    private startDeepChecks;
    private performSystemCheck;
    private performServiceChecks;
    private performDeepCheck;
    private checkComponentHealth;
    private checkDatabaseHealth;
    private checkWebSocketHealth;
    private checkHTTPHealth;
    private checkCacheHealth;
    private checkPerformanceHealth;
    private calculateOverallStatus;
    private checkThresholds;
    private createAlert;
    private clearAlert;
    private sanitizeEnvironment;
}
export default HealthMonitoringService;
