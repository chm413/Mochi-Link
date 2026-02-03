/**
 * Error Handling and Recovery Service
 * 
 * Provides comprehensive error handling, connection recovery, and business logic
 * error management for the Mochi-Link system.
 */

import { EventEmitter } from 'events';
import { Context } from 'koishi';
import {
  ConnectionError,
  AuthenticationError,
  ProtocolError,
  ServerUnavailableError,
  MaintenanceError,
  PermissionDeniedError,
  MochiLinkError,
  ConnectionMode,
  ServerConfig,
  UWBPMessage
} from '../types';
import { AuditService } from './audit';
import { BusinessErrorHandler } from './business-error-handler';

// ============================================================================
// Error Handler Configuration
// ============================================================================

export interface ErrorHandlerConfig {
  // Reconnection settings
  maxRetryAttempts: number;
  baseRetryInterval: number;
  maxRetryInterval: number;
  exponentialBackoffMultiplier: number;
  jitterEnabled: boolean;
  
  // Connection quality assessment
  connectionQualityThreshold: number;
  failureRateThreshold: number;
  latencyThreshold: number;
  
  // Failover settings
  enableFailover: boolean;
  failoverModes: ConnectionMode[];
  failoverDelay: number;
  
  // Alert settings
  enableAlerts: boolean;
  alertThresholds: {
    connectionFailures: number;
    authFailures: number;
    protocolErrors: number;
  };
}

// ============================================================================
// Error Types and Contexts
// ============================================================================

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'connection' | 'authentication' | 'protocol' | 'business' | 'system';
export type RecoveryAction = 'retry' | 'failover' | 'alert' | 'ignore' | 'escalate';

export interface ErrorContext {
  serverId: string;
  timestamp: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryCount: number;
  lastRetryAt?: number;
  recoveryActions: RecoveryAction[];
  metadata: Record<string, any>;
}

export interface ConnectionQuality {
  serverId: string;
  score: number; // 0-100
  latency: number;
  successRate: number;
  failureCount: number;
  lastFailure?: Date;
  connectionStability: number;
}

// ============================================================================
// Exponential Backoff Manager
// ============================================================================

export class ExponentialBackoffManager {
  private retryAttempts = new Map<string, number>();
  private lastRetryTimes = new Map<string, number>();
  
  constructor(private config: ErrorHandlerConfig) {}

  /**
   * Calculate next retry delay with exponential backoff
   */
  calculateDelay(key: string): number {
    const attempts = this.retryAttempts.get(key) || 0;
    const baseDelay = this.config.baseRetryInterval;
    const multiplier = this.config.exponentialBackoffMultiplier;
    
    // Calculate exponential delay
    let delay = Math.min(
      baseDelay * Math.pow(multiplier, attempts),
      this.config.maxRetryInterval
    );
    
    // Add jitter if enabled
    if (this.config.jitterEnabled) {
      const jitter = delay * 0.1 * Math.random();
      delay += jitter;
    }
    
    return Math.floor(delay);
  }

  /**
   * Record retry attempt
   */
  recordAttempt(key: string): void {
    const current = this.retryAttempts.get(key) || 0;
    this.retryAttempts.set(key, current + 1);
    this.lastRetryTimes.set(key, Date.now());
  }

  /**
   * Reset retry counter on success
   */
  reset(key: string): void {
    this.retryAttempts.delete(key);
    this.lastRetryTimes.delete(key);
  }

  /**
   * Check if max attempts reached
   */
  hasExceededMaxAttempts(key: string): boolean {
    const attempts = this.retryAttempts.get(key) || 0;
    return attempts >= this.config.maxRetryAttempts;
  }

  /**
   * Get current retry count
   */
  getRetryCount(key: string): number {
    return this.retryAttempts.get(key) || 0;
  }
}

// ============================================================================
// Connection Quality Monitor
// ============================================================================

export class ConnectionQualityMonitor {
  private qualityMetrics = new Map<string, ConnectionQuality>();
  private latencyHistory = new Map<string, number[]>();
  private failureHistory = new Map<string, Date[]>();
  
  constructor(private config: ErrorHandlerConfig) {}

  /**
   * Record connection success
   */
  recordSuccess(serverId: string, latency: number): void {
    this.updateLatencyHistory(serverId, latency);
    this.updateQualityScore(serverId);
  }

  /**
   * Record connection failure
   */
  recordFailure(serverId: string, error: Error): void {
    const now = new Date();
    const failures = this.failureHistory.get(serverId) || [];
    failures.push(now);
    
    // Keep only recent failures (last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentFailures = failures.filter(f => f > oneHourAgo);
    this.failureHistory.set(serverId, recentFailures);
    
    this.updateQualityScore(serverId);
  }

  /**
   * Get connection quality for server
   */
  getQuality(serverId: string): ConnectionQuality {
    return this.qualityMetrics.get(serverId) || {
      serverId,
      score: 100,
      latency: 0,
      successRate: 1.0,
      failureCount: 0,
      connectionStability: 1.0
    };
  }

  /**
   * Check if connection quality is acceptable
   */
  isQualityAcceptable(serverId: string): boolean {
    const quality = this.getQuality(serverId);
    return quality.score >= this.config.connectionQualityThreshold;
  }

  private updateLatencyHistory(serverId: string, latency: number): void {
    const history = this.latencyHistory.get(serverId) || [];
    history.push(latency);
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
    
    this.latencyHistory.set(serverId, history);
  }

  private updateQualityScore(serverId: string): void {
    const latencyHistory = this.latencyHistory.get(serverId) || [];
    const failureHistory = this.failureHistory.get(serverId) || [];
    
    // Calculate average latency
    const avgLatency = latencyHistory.length > 0
      ? latencyHistory.reduce((sum, l) => sum + l, 0) / latencyHistory.length
      : 0;
    
    // Calculate success rate (based on recent activity)
    const successCount = latencyHistory.length;
    const failureCount = failureHistory.length;
    const totalAttempts = successCount + failureCount;
    const successRate = totalAttempts > 0 ? successCount / totalAttempts : 1.0;
    
    // Calculate stability (consistency of latency)
    let stability = 1.0;
    if (latencyHistory.length > 1) {
      const variance = this.calculateVariance(latencyHistory);
      stability = Math.max(0, 1 - (variance / 1000)); // Normalize variance
    }
    
    // Calculate overall score
    let score = 100;
    
    // Penalize high latency
    if (avgLatency > this.config.latencyThreshold) {
      score -= Math.min(50, (avgLatency - this.config.latencyThreshold) / 10);
    }
    
    // Penalize low success rate
    score *= successRate;
    
    // Penalize instability
    score *= stability;
    
    // Update metrics
    this.qualityMetrics.set(serverId, {
      serverId,
      score: Math.max(0, Math.floor(score)),
      latency: avgLatency,
      successRate,
      failureCount: failureHistory.length,
      lastFailure: failureHistory.length > 0 ? failureHistory[failureHistory.length - 1] : undefined,
      connectionStability: stability
    });
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }
}

// ============================================================================
// Main Error Handler Service
// ============================================================================

export class ErrorHandlingService extends EventEmitter {
  private config: ErrorHandlerConfig;
  private backoffManager: ExponentialBackoffManager;
  private qualityMonitor: ConnectionQualityMonitor;
  private errorContexts = new Map<string, ErrorContext>();
  private auditService: AuditService;
  private businessErrorHandler: BusinessErrorHandler;
  private testMode = false; // Add test mode flag
  
  constructor(
    private ctx: Context,
    auditService: AuditService,
    config: Partial<ErrorHandlerConfig> = {}
  ) {
    super();
    this.setMaxListeners(50); // Increase max listeners for testing
    
    this.config = {
      maxRetryAttempts: 5,
      baseRetryInterval: 1000,
      maxRetryInterval: 30000,
      exponentialBackoffMultiplier: 2,
      jitterEnabled: true,
      connectionQualityThreshold: 70,
      failureRateThreshold: 0.2,
      latencyThreshold: 1000,
      enableFailover: true,
      failoverModes: ['plugin', 'rcon', 'terminal'],
      failoverDelay: 5000,
      enableAlerts: true,
      alertThresholds: {
        connectionFailures: 3,
        authFailures: 2,
        protocolErrors: 5
      },
      ...config
    };
    
    this.backoffManager = new ExponentialBackoffManager(this.config);
    this.qualityMonitor = new ConnectionQualityMonitor(this.config);
    this.auditService = auditService;
    this.businessErrorHandler = new BusinessErrorHandler(ctx, auditService);
    
    // Set up business error handler event forwarding
    this.setupBusinessErrorHandlerEvents();
  }

  // ============================================================================
  // Connection Error Handling
  // ============================================================================

  /**
   * Handle connection failure with automatic retry and failover
   */
  async handleConnectionFailure(
    serverId: string,
    error: ConnectionError,
    serverConfig: ServerConfig
  ): Promise<void> {
    const logger = this.ctx.logger('mochi-link:error-handler');
    
    // Record failure in quality monitor
    this.qualityMonitor.recordFailure(serverId, error);
    
    // Create or update error context
    const context = this.getOrCreateErrorContext(serverId, 'connection', 'high');
    context.retryCount++;
    context.metadata.lastError = error.message;
    context.metadata.errorCode = error.code;
    
    // Log the error
    await this.auditService.logger.logError(
      'connection_failed',
      {
        error: error.message,
        retryCount: context.retryCount,
        connectionMode: serverConfig.connectionMode
      },
      error,
      { serverId }
    );
    
    logger.error(`Connection failed for ${serverId}: ${error.message} (attempt ${context.retryCount})`);
    
    // Check if we should attempt recovery
    if (this.shouldAttemptRecovery(context)) {
      await this.scheduleRecovery(serverId, context, serverConfig);
    } else {
      // Max attempts reached, try failover or alert
      await this.handleMaxAttemptsReached(serverId, context, serverConfig);
    }
    
    this.emit('connectionFailure', serverId, error, context);
  }

  /**
   * Handle authentication failure
   */
  async handleAuthenticationFailure(
    serverId: string,
    error: AuthenticationError,
    reason: string
  ): Promise<void> {
    const logger = this.ctx.logger('mochi-link:error-handler');
    
    // Create error context
    const context = this.getOrCreateErrorContext(serverId, 'authentication', 'high');
    context.retryCount++;
    context.metadata.reason = reason;
    context.metadata.lastError = error.message;
    
    // Log authentication failure
    await this.auditService.logger.logAuthFailure(serverId, reason);
    
    logger.error(`Authentication failed for ${serverId}: ${reason}`);
    
    // Handle specific authentication failures
    switch (reason) {
      case 'token_expired':
        // Request token refresh
        this.emit('tokenRefreshRequired', serverId);
        break;
        
      case 'invalid_token':
      case 'token_revoked':
        // Disable auto-reconnect, requires manual intervention
        context.recoveryActions = ['alert', 'escalate'];
        this.emit('authenticationCritical', serverId, reason);
        break;
        
      case 'ip_not_whitelisted':
        // Check if IP whitelist needs updating
        this.emit('ipWhitelistUpdateRequired', serverId);
        break;
        
      default:
        // Generic auth failure
        if (context.retryCount >= this.config.alertThresholds.authFailures) {
          this.emit('authenticationAlert', serverId, error);
        }
    }
    
    this.emit('authenticationFailure', serverId, error, context);
  }

  /**
   * Handle protocol errors
   */
  async handleProtocolError(
    serverId: string,
    error: ProtocolError,
    message?: UWBPMessage
  ): Promise<void> {
    const logger = this.ctx.logger('mochi-link:error-handler');
    
    // Create error context
    const severity = this.mapProtocolSeverity(error.severity);
    const context = this.getOrCreateErrorContext(serverId, 'protocol', severity);
    context.retryCount++;
    context.metadata.messageId = error.messageId;
    context.metadata.severity = error.severity;
    context.metadata.lastError = error.message;
    
    // Log protocol error
    await this.auditService.logger.logError(
      'protocol_error',
      {
        error: error.message,
        messageId: error.messageId,
        severity: error.severity,
        message: message ? JSON.stringify(message) : undefined
      },
      error,
      { serverId }
    );
    
    logger.error(`Protocol error for ${serverId}: ${error.message} (severity: ${error.severity})`);
    
    // Handle based on severity
    switch (error.severity) {
      case 'critical':
        // Critical errors require immediate disconnection and reconnection
        this.emit('criticalProtocolError', serverId, error);
        await this.scheduleRecovery(serverId, context);
        break;
        
      case 'major':
        // Major errors may require connection reset
        if (context.retryCount >= 3) {
          this.emit('majorProtocolError', serverId, error);
          await this.scheduleRecovery(serverId, context);
        }
        break;
        
      case 'minor':
        // Minor errors are logged but don't trigger recovery
        if (context.retryCount >= this.config.alertThresholds.protocolErrors) {
          this.emit('protocolErrorAlert', serverId, error);
        }
        break;
    }
    
    this.emit('protocolError', serverId, error, context);
  }

  // ============================================================================
  // Business Logic Error Handling
  // ============================================================================

  /**
   * Handle permission denied errors
   */
  async handlePermissionDenied(
    userId: string,
    serverId: string,
    operation: string,
    error: PermissionDeniedError
  ): Promise<void> {
    // Delegate to business error handler
    await this.businessErrorHandler.handlePermissionDenied(userId, serverId, operation, error);
  }

  /**
   * Handle server unavailable errors
   */
  async handleServerUnavailable(
    serverId: string,
    operation: string,
    operationData: any,
    error: ServerUnavailableError
  ): Promise<void> {
    // Delegate to business error handler
    await this.businessErrorHandler.handleServerUnavailable(serverId, operation, operationData, error);
  }

  /**
   * Handle data synchronization conflicts
   */
  async handleSyncConflict(
    serverId: string,
    conflictType: string,
    conflictData: any
  ): Promise<void> {
    const conflict = {
      type: conflictType as any,
      serverId,
      conflictData,
      timestamp: new Date(),
      severity: 'medium' as const
    };
    
    const resolution = await this.businessErrorHandler.handleSyncConflict(conflict);
    this.emit('syncConflictResolved', serverId, conflictType, resolution);
  }

  /**
   * Set up business error handler event forwarding
   */
  private setupBusinessErrorHandlerEvents(): void {
    // Forward business error events
    this.businessErrorHandler.on('permissionDenied', (...args) => {
      this.emit('permissionDenied', ...args);
    });
    
    this.businessErrorHandler.on('serverUnavailable', (...args) => {
      this.emit('serverUnavailable', ...args);
    });
    
    this.businessErrorHandler.on('operationCached', (...args) => {
      this.emit('operationCached', ...args);
    });
    
    this.businessErrorHandler.on('syncConflictResolved', (...args) => {
      this.emit('syncConflictResolved', ...args);
    });
    
    this.businessErrorHandler.on('maintenanceScheduled', (...args) => {
      this.emit('maintenanceScheduled', ...args);
    });
    
    this.businessErrorHandler.on('degradationSuccessful', (...args) => {
      this.emit('degradationSuccessful', ...args);
    });
    
    this.businessErrorHandler.on('degradationFailed', (...args) => {
      this.emit('degradationFailed', ...args);
    });
  }

  // ============================================================================
  // Recovery and Failover
  // ============================================================================

  /**
   * Enable test mode (disables async scheduling)
   */
  setTestMode(enabled: boolean): void {
    this.testMode = enabled;
  }

  /**
   * Schedule connection recovery with exponential backoff
   */
  private async scheduleRecovery(
    serverId: string,
    context: ErrorContext,
    serverConfig?: ServerConfig
  ): Promise<void> {
    const delay = this.backoffManager.calculateDelay(serverId);
    const logger = this.ctx.logger('mochi-link:error-handler');
    
    logger.info(`Scheduling recovery for ${serverId} in ${delay}ms (attempt ${context.retryCount})`);
    
    // In test mode, emit event immediately instead of scheduling
    if (this.testMode) {
      this.backoffManager.recordAttempt(serverId);
      this.emit('recoveryAttempt', serverId, context.retryCount);
      this.emit('retryConnection', serverId);
      return;
    }
    
    setTimeout(async () => {
      try {
        this.backoffManager.recordAttempt(serverId);
        this.emit('recoveryAttempt', serverId, context.retryCount);
        
        // If we have server config, check if failover is needed
        if (serverConfig && !this.qualityMonitor.isQualityAcceptable(serverId)) {
          await this.attemptFailover(serverId, serverConfig);
        } else {
          this.emit('retryConnection', serverId);
        }
        
      } catch (error) {
        logger.error(`Recovery attempt failed for ${serverId}:`, error);
        context.retryCount++;
        
        if (this.shouldAttemptRecovery(context)) {
          await this.scheduleRecovery(serverId, context, serverConfig);
        } else {
          await this.handleMaxAttemptsReached(serverId, context, serverConfig);
        }
      }
    }, delay);
  }

  /**
   * Attempt connection mode failover
   */
  private async attemptFailover(serverId: string, serverConfig: ServerConfig): Promise<void> {
    if (!this.config.enableFailover) {
      return;
    }
    
    const logger = this.ctx.logger('mochi-link:error-handler');
    const currentMode = serverConfig.connectionMode;
    const availableModes = this.config.failoverModes.filter(mode => mode !== currentMode);
    
    if (availableModes.length === 0) {
      logger.warn(`No failover modes available for ${serverId}`);
      return;
    }
    
    // Try each available mode
    for (const mode of availableModes) {
      logger.info(`Attempting failover for ${serverId} from ${currentMode} to ${mode}`);
      
      try {
        this.emit('failoverAttempt', serverId, currentMode, mode);
        
        // Wait for failover delay
        await new Promise(resolve => setTimeout(resolve, this.config.failoverDelay));
        
        // The actual failover will be handled by the connection manager
        // We just emit the event here
        this.emit('failoverRequired', serverId, mode);
        break;
        
      } catch (error) {
        logger.error(`Failover to ${mode} failed for ${serverId}:`, error);
        continue;
      }
    }
  }

  /**
   * Handle max retry attempts reached
   */
  private async handleMaxAttemptsReached(
    serverId: string,
    context: ErrorContext,
    serverConfig?: ServerConfig
  ): Promise<void> {
    const logger = this.ctx.logger('mochi-link:error-handler');
    
    logger.error(`Max retry attempts reached for ${serverId}`);
    
    // Try failover if available and enabled
    if (serverConfig && this.config.enableFailover) {
      await this.attemptFailover(serverId, serverConfig);
    } else {
      // Send critical alert
      this.emit('connectionFailed', serverId, context);
      
      if (this.config.enableAlerts) {
        this.emit('criticalAlert', serverId, 'Max retry attempts reached', context);
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getOrCreateErrorContext(
    key: string,
    category: ErrorCategory,
    severity: ErrorSeverity
  ): ErrorContext {
    let context = this.errorContexts.get(key);
    
    if (!context) {
      context = {
        serverId: key,
        timestamp: Date.now(),
        category,
        severity,
        retryCount: 0,
        recoveryActions: [],
        metadata: {}
      };
      this.errorContexts.set(key, context);
    }
    
    return context;
  }

  private shouldAttemptRecovery(context: ErrorContext): boolean {
    return context.retryCount < this.config.maxRetryAttempts;
  }

  private mapProtocolSeverity(severity: string): ErrorSeverity {
    switch (severity) {
      case 'critical': return 'critical';
      case 'major': return 'high';
      case 'minor': return 'medium';
      default: return 'low';
    }
  }

  /**
   * Get business error statistics
   */
  getBusinessErrorStats(): any {
    return this.businessErrorHandler.getStats();
  }

  /**
   * Get cached operations for server
   */
  getCachedOperations(serverId: string): any[] {
    return this.businessErrorHandler.getCachedOperations(serverId);
  }

  /**
   * Set planned maintenance for server
   */
  async setPlannedMaintenance(serverId: string, maintenance: any): Promise<void> {
    await this.businessErrorHandler.setPlannedMaintenance(serverId, maintenance);
  }

  /**
   * Clear planned maintenance for server
   */
  async clearPlannedMaintenance(serverId: string): Promise<void> {
    await this.businessErrorHandler.clearPlannedMaintenance(serverId);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Record successful connection
   */
  recordConnectionSuccess(serverId: string, latency: number): void {
    this.qualityMonitor.recordSuccess(serverId, latency);
    this.backoffManager.reset(serverId);
    
    // Clear error context on success
    this.errorContexts.delete(serverId);
  }

  /**
   * Get connection quality for server
   */
  getConnectionQuality(serverId: string): ConnectionQuality {
    return this.qualityMonitor.getQuality(serverId);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    activeContexts: number;
  } {
    const contexts = Array.from(this.errorContexts.values());
    
    const stats = {
      totalErrors: contexts.reduce((sum, ctx) => sum + ctx.retryCount, 0),
      errorsByCategory: {
        connection: 0,
        authentication: 0,
        protocol: 0,
        business: 0,
        system: 0
      } as Record<ErrorCategory, number>,
      errorsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      } as Record<ErrorSeverity, number>,
      activeContexts: contexts.length
    };
    
    for (const context of contexts) {
      stats.errorsByCategory[context.category] += context.retryCount;
      stats.errorsBySeverity[context.severity] += context.retryCount;
    }
    
    return stats;
  }

  /**
   * Clear error context for server
   */
  clearErrorContext(serverId: string): void {
    this.errorContexts.delete(serverId);
    this.backoffManager.reset(serverId);
  }

  /**
   * Shutdown error handler
   */
  shutdown(): void {
    this.errorContexts.clear();
    this.businessErrorHandler.shutdown();
    this.removeAllListeners();
  }
}