/**
 * Error Handling and Recovery Service
 *
 * Provides comprehensive error handling, connection recovery, and business logic
 * error management for the Mochi-Link system.
 */
import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { ConnectionError, AuthenticationError, ProtocolError, ServerUnavailableError, PermissionDeniedError, ConnectionMode, ServerConfig, UWBPMessage } from '../types';
import { AuditService } from './audit';
export interface ErrorHandlerConfig {
    maxRetryAttempts: number;
    baseRetryInterval: number;
    maxRetryInterval: number;
    exponentialBackoffMultiplier: number;
    jitterEnabled: boolean;
    connectionQualityThreshold: number;
    failureRateThreshold: number;
    latencyThreshold: number;
    enableFailover: boolean;
    failoverModes: ConnectionMode[];
    failoverDelay: number;
    enableAlerts: boolean;
    alertThresholds: {
        connectionFailures: number;
        authFailures: number;
        protocolErrors: number;
    };
}
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
    score: number;
    latency: number;
    successRate: number;
    failureCount: number;
    lastFailure?: Date;
    connectionStability: number;
}
export declare class ExponentialBackoffManager {
    private config;
    private retryAttempts;
    private lastRetryTimes;
    constructor(config: ErrorHandlerConfig);
    /**
     * Calculate next retry delay with exponential backoff
     */
    calculateDelay(key: string): number;
    /**
     * Record retry attempt
     */
    recordAttempt(key: string): void;
    /**
     * Reset retry counter on success
     */
    reset(key: string): void;
    /**
     * Check if max attempts reached
     */
    hasExceededMaxAttempts(key: string): boolean;
    /**
     * Get current retry count
     */
    getRetryCount(key: string): number;
}
export declare class ConnectionQualityMonitor {
    private config;
    private qualityMetrics;
    private latencyHistory;
    private failureHistory;
    constructor(config: ErrorHandlerConfig);
    /**
     * Record connection success
     */
    recordSuccess(serverId: string, latency: number): void;
    /**
     * Record connection failure
     */
    recordFailure(serverId: string, error: Error): void;
    /**
     * Get connection quality for server
     */
    getQuality(serverId: string): ConnectionQuality;
    /**
     * Check if connection quality is acceptable
     */
    isQualityAcceptable(serverId: string): boolean;
    private updateLatencyHistory;
    private updateQualityScore;
    private calculateVariance;
}
export declare class ErrorHandlingService extends EventEmitter {
    private ctx;
    private config;
    private backoffManager;
    private qualityMonitor;
    private errorContexts;
    private auditService;
    private businessErrorHandler;
    private testMode;
    constructor(ctx: Context, auditService: AuditService, config?: Partial<ErrorHandlerConfig>);
    /**
     * Handle connection failure with automatic retry and failover
     */
    handleConnectionFailure(serverId: string, error: ConnectionError, serverConfig: ServerConfig): Promise<void>;
    /**
     * Handle authentication failure
     */
    handleAuthenticationFailure(serverId: string, error: AuthenticationError, reason: string): Promise<void>;
    /**
     * Handle protocol errors
     */
    handleProtocolError(serverId: string, error: ProtocolError, message?: UWBPMessage): Promise<void>;
    /**
     * Handle permission denied errors
     */
    handlePermissionDenied(userId: string, serverId: string, operation: string, error: PermissionDeniedError): Promise<void>;
    /**
     * Handle server unavailable errors
     */
    handleServerUnavailable(serverId: string, operation: string, operationData: any, error: ServerUnavailableError): Promise<void>;
    /**
     * Handle data synchronization conflicts
     */
    handleSyncConflict(serverId: string, conflictType: string, conflictData: any): Promise<void>;
    /**
     * Set up business error handler event forwarding
     */
    private setupBusinessErrorHandlerEvents;
    /**
     * Enable test mode (disables async scheduling)
     */
    setTestMode(enabled: boolean): void;
    /**
     * Schedule connection recovery with exponential backoff
     */
    private scheduleRecovery;
    /**
     * Attempt connection mode failover
     */
    private attemptFailover;
    /**
     * Handle max retry attempts reached
     */
    private handleMaxAttemptsReached;
    private getOrCreateErrorContext;
    private shouldAttemptRecovery;
    private mapProtocolSeverity;
    /**
     * Get business error statistics
     */
    getBusinessErrorStats(): any;
    /**
     * Get cached operations for server
     */
    getCachedOperations(serverId: string): any[];
    /**
     * Set planned maintenance for server
     */
    setPlannedMaintenance(serverId: string, maintenance: any): Promise<void>;
    /**
     * Clear planned maintenance for server
     */
    clearPlannedMaintenance(serverId: string): Promise<void>;
    /**
     * Record successful connection
     */
    recordConnectionSuccess(serverId: string, latency: number): void;
    /**
     * Get connection quality for server
     */
    getConnectionQuality(serverId: string): ConnectionQuality;
    /**
     * Get error statistics
     */
    getErrorStats(): {
        totalErrors: number;
        errorsByCategory: Record<ErrorCategory, number>;
        errorsBySeverity: Record<ErrorSeverity, number>;
        activeContexts: number;
    };
    /**
     * Clear error context for server
     */
    clearErrorContext(serverId: string): void;
    /**
     * Shutdown error handler
     */
    shutdown(): void;
}
