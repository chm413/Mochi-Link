/**
 * Connection Security Manager
 *
 * Implements connection security management including:
 * - WebSocket connection limits and controls
 * - Progressive authentication failure delays
 * - Security event monitoring and alerting
 */
import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { AuditService } from './audit';
export interface ConnectionSecurityConfig {
    connectionLimits: {
        enabled: boolean;
        maxConnectionsPerIP: number;
        maxConnectionsPerServer: number;
        maxTotalConnections: number;
        connectionTimeout: number;
        cleanupInterval: number;
    };
    authFailureHandling: {
        enabled: boolean;
        baseDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
        resetWindow: number;
        maxFailuresBeforeBlock: number;
        blockDuration: number;
    };
    securityMonitoring: {
        enabled: boolean;
        alertThresholds: {
            connectionFlood: number;
            authFailureRate: number;
            suspiciousPatterns: number;
        };
        monitoringInterval: number;
        alertCooldown: number;
    };
    alerting: {
        enabled: boolean;
        channels: {
            email: boolean;
            webhook: boolean;
            log: boolean;
        };
        severityLevels: {
            low: boolean;
            medium: boolean;
            high: boolean;
            critical: boolean;
        };
    };
}
export interface ConnectionInfo {
    id: string;
    serverId: string;
    ip: string;
    userAgent?: string;
    connectedAt: Date;
    lastActivity: Date;
    authenticated: boolean;
    authFailures: number;
    lastAuthFailure?: Date;
}
export interface AuthFailureRecord {
    ip: string;
    serverId: string;
    failures: number;
    firstFailure: Date;
    lastFailure: Date;
    nextAllowedAttempt: Date;
    blocked: boolean;
    blockUntil?: Date;
}
export interface SecurityAlert {
    id: string;
    type: 'connection_flood' | 'auth_failure_rate' | 'suspicious_pattern' | 'connection_limit_exceeded';
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    source: {
        ip?: string;
        serverId?: string;
        connectionId?: string;
    };
    details: {
        description: string;
        metrics: any;
        evidence: any;
    };
    acknowledged: boolean;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
}
export declare class ConnectionSecurityManager extends EventEmitter {
    private ctx;
    private config;
    private auditService;
    private activeConnections;
    private connectionsByIP;
    private connectionsByServer;
    private authFailures;
    private securityAlerts;
    private alertCooldowns;
    private monitoringInterval?;
    private cleanupInterval?;
    private stats;
    constructor(ctx: Context, auditService: AuditService, config?: Partial<ConnectionSecurityConfig>);
    /**
     * Check if new connection should be allowed
     */
    checkConnectionAllowed(serverId: string, ip: string, userAgent?: string): {
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
    };
    /**
     * Register new connection
     */
    registerConnection(connectionId: string, serverId: string, ip: string, userAgent?: string): void;
    /**
     * Unregister connection
     */
    unregisterConnection(connectionId: string): void;
    /**
     * Update connection activity
     */
    updateConnectionActivity(connectionId: string): void;
    /**
     * Mark connection as authenticated
     */
    markConnectionAuthenticated(connectionId: string): void;
    /**
     * Check if authentication attempt should be allowed
     */
    checkAuthenticationAllowed(serverId: string, ip: string): {
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
    };
    /**
     * Record authentication failure
     */
    recordAuthenticationFailure(connectionId: string, serverId: string, ip: string, reason: string): void;
    /**
     * Record successful authentication
     */
    recordAuthenticationSuccess(connectionId: string, serverId: string, ip: string): void;
    /**
     * Calculate next allowed authentication attempt time
     */
    private calculateNextAllowedAttempt;
    /**
     * Generate security alert
     */
    private generateSecurityAlert;
    /**
     * Send alert through configured channels
     */
    private sendAlert;
    /**
     * Acknowledge security alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean;
    /**
     * Start security monitoring
     */
    private startMonitoring;
    /**
     * Start cleanup processes
     */
    private startCleanup;
    /**
     * Perform security monitoring checks
     */
    private performSecurityCheck;
    /**
     * Clean up expired records
     */
    private cleanupExpiredRecords;
    /**
     * Create default configuration
     */
    private createDefaultConfig;
    /**
     * Deep merge configuration objects
     */
    private mergeConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ConnectionSecurityConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): ConnectionSecurityConfig;
    /**
     * Get connection security statistics
     */
    getStats(): {
        connections: {
            active: number;
            total: number;
            rejected: number;
            byIP: Record<string, number>;
            byServer: Record<string, number>;
        };
        authentication: {
            failures: number;
            blockedIPs: number;
            activeFailureRecords: number;
        };
        alerts: {
            total: number;
            active: number;
            acknowledged: number;
            byType: Record<string, number>;
            bySeverity: Record<string, number>;
        };
    };
    /**
     * Get active connections
     */
    getActiveConnections(): ConnectionInfo[];
    /**
     * Get authentication failure records
     */
    getAuthFailureRecords(): AuthFailureRecord[];
    /**
     * Get security alerts
     */
    getSecurityAlerts(filter?: {
        type?: string;
        severity?: string;
        acknowledged?: boolean;
    }): SecurityAlert[];
    /**
     * Shutdown connection security manager
     */
    shutdown(): void;
}
