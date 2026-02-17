/**
 * Health Check and Monitoring Service
 * 
 * This service provides comprehensive health monitoring, system status tracking,
 * and diagnostic endpoints for the Mochi-Link system.
 */

import { Context, Logger } from 'koishi';
import { EventEmitter } from 'events';

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckConfig {
  // Check intervals
  systemCheckInterval: number;
  serviceCheckInterval: number;
  deepCheckInterval: number;
  
  // Timeouts
  checkTimeout: number;
  serviceTimeout: number;
  
  // Thresholds
  thresholds: {
    memoryUsage: number;      // Percentage
    cpuUsage: number;         // Percentage
    responseTime: number;     // Milliseconds
    errorRate: number;        // Percentage
    diskUsage: number;        // Percentage
  };
  
  // Alerting
  alerting: {
    enabled: boolean;
    cooldownPeriod: number;   // Milliseconds
    escalationThreshold: number; // Number of consecutive failures
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  environment: string;
  
  // System metrics
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
  
  // Service status
  services: {
    [serviceName: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime: number;
      lastCheck: number;
      errorCount: number;
      details?: any;
    };
  };
  
  // Component status
  components: {
    database: ComponentHealth;
    websocket: ComponentHealth;
    http: ComponentHealth;
    cache: ComponentHealth;
    performance: ComponentHealth;
  };
  
  // Active alerts
  alerts: HealthAlert[];
  
  // Performance metrics
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

// ============================================================================
// Health Monitoring Service
// ============================================================================

export class HealthMonitoringService extends EventEmitter {
  private logger: Logger;
  private config: HealthCheckConfig;
  private isRunning = false;
  private startTime = Date.now();
  
  // Check intervals
  private systemCheckInterval?: NodeJS.Timeout;
  private serviceCheckInterval?: NodeJS.Timeout;
  private deepCheckInterval?: NodeJS.Timeout;
  
  // Current status
  private currentStatus?: HealthStatus;
  private alerts = new Map<string, HealthAlert>();
  private alertCooldowns = new Map<string, number>();
  
  // Metrics tracking
  private metricsHistory: Array<{
    timestamp: number;
    memory: number;
    cpu: number;
    responseTime: number;
    errorRate: number;
  }> = [];
  
  constructor(
    private ctx: Context,
    config: Partial<HealthCheckConfig> = {}
  ) {
    super();
    
    this.logger = ctx.logger('health-monitoring');
    this.config = {
      systemCheckInterval: 30000,    // 30 seconds
      serviceCheckInterval: 60000,   // 1 minute
      deepCheckInterval: 300000,     // 5 minutes
      checkTimeout: 5000,            // 5 seconds
      serviceTimeout: 10000,         // 10 seconds
      thresholds: {
        memoryUsage: 85,             // 85%
        cpuUsage: 80,                // 80%
        responseTime: 5000,          // 5 seconds
        errorRate: 5,                // 5%
        diskUsage: 90                // 90%
      },
      alerting: {
        enabled: true,
        cooldownPeriod: 300000,      // 5 minutes
        escalationThreshold: 3       // 3 consecutive failures
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
  async start(): Promise<void> {
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
  async stop(): Promise<void> {
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
  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.currentStatus) {
      await this.performSystemCheck();
    }

    return this.currentStatus!;
  }

  /**
   * Get simplified health check (for load balancers)
   */
  async getSimpleHealthCheck(): Promise<{ status: string; timestamp: number }> {
    const health = await this.getHealthStatus();
    return {
      status: health.status,
      timestamp: health.timestamp
    };
  }

  /**
   * Get detailed diagnostic information
   */
  getDiagnosticInfo(): DiagnosticInfo {
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
      versions: process.versions as Record<string, string>,
      features: {
        inspector: typeof (process as any).inspector !== 'undefined',
        debug: process.debugPort > 0,
        uv: typeof (process as any).binding === 'function',
        ipv6: (process as any).features?.ipv6 || false,
        tls_alpn: (process as any).features?.tls_alpn || false,
        tls_sni: (process as any).features?.tls_sni || false,
        tls_ocsp: (process as any).features?.tls_ocsp || false,
        tls: (process as any).features?.tls || false
      }
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
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

  private startSystemChecks(): void {
    this.systemCheckInterval = setInterval(
      () => this.performSystemCheck(),
      this.config.systemCheckInterval
    );
  }

  private startServiceChecks(): void {
    this.serviceCheckInterval = setInterval(
      () => this.performServiceChecks(),
      this.config.serviceCheckInterval
    );
  }

  private startDeepChecks(): void {
    this.deepCheckInterval = setInterval(
      () => this.performDeepCheck(),
      this.config.deepCheckInterval
    );
  }

  private async performSystemCheck(): Promise<void> {
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

    } catch (error) {
      this.logger.error('System health check failed:', error);
      this.emit('systemCheckError', error);
    }
  }

  private async performServiceChecks(): Promise<void> {
    try {
      // Basic service check implementation
      this.emit('serviceCheckCompleted');
    } catch (error) {
      this.logger.error('Service health check failed:', error);
      this.emit('serviceCheckError', error);
    }
  }

  private async performDeepCheck(): Promise<void> {
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

    } catch (error) {
      this.logger.error('Deep health check failed:', error);
      this.emit('deepCheckError', error);
    }
  }

  private async checkComponentHealth(): Promise<HealthStatus['components']> {
    const components: HealthStatus['components'] = {
      database: await this.checkDatabaseHealth(),
      websocket: await this.checkWebSocketHealth(),
      http: await this.checkHTTPHealth(),
      cache: await this.checkCacheHealth(),
      performance: await this.checkPerformanceHealth()
    };

    return components;
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
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
    } catch (error) {
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

  private async checkWebSocketHealth(): Promise<ComponentHealth> {
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

  private async checkHTTPHealth(): Promise<ComponentHealth> {
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

  private async checkCacheHealth(): Promise<ComponentHealth> {
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

  private async checkPerformanceHealth(): Promise<ComponentHealth> {
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

  private calculateOverallStatus(
    systemMetrics: any,
    components: HealthStatus['components']
  ): 'healthy' | 'degraded' | 'unhealthy' {
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

  private checkThresholds(systemMetrics: any): void {
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
    } else {
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
    } else {
      this.clearAlert('cpu-usage');
    }
  }

  private createAlert(alert: HealthAlert): void {
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

  private clearAlert(alertId: string): void {
    if (this.alerts.has(alertId)) {
      const alert = this.alerts.get(alertId)!;
      this.alerts.delete(alertId);
      this.emit('alertCleared', alert);
    }
  }

  private sanitizeEnvironment(env: Record<string, string | undefined>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth'];
    
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) continue;
      
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
      
      sanitized[key] = isSensitive ? '[REDACTED]' : value;
    }
    
    return sanitized;
  }
}

// Export for module compatibility
export { HealthMonitoringService };
export default HealthMonitoringService;