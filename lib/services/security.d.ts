/**
 * Security Control Service
 *
 * Provides comprehensive security control mechanisms including:
 * - Advanced API rate limiting and DDoS protection
 * - Suspicious activity detection and automatic blocking
 * - Communication encryption and secure transport
 * - Security event monitoring and alerting
 */
import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { AuditService } from './audit';
import { UWBPMessage, EncryptionConfig } from '../types';
export interface SecurityConfig {
    rateLimiting: {
        enabled: boolean;
        globalLimits: {
            requestsPerMinute: number;
            requestsPerHour: number;
            requestsPerDay: number;
        };
        endpointLimits: Record<string, {
            requestsPerMinute: number;
            burstLimit: number;
        }>;
        userLimits: {
            requestsPerMinute: number;
            requestsPerHour: number;
        };
        ipLimits: {
            requestsPerMinute: number;
            requestsPerHour: number;
            maxConcurrentConnections: number;
        };
    };
    ddosProtection: {
        enabled: boolean;
        thresholds: {
            requestsPerSecond: number;
            concurrentConnections: number;
            failedRequestsPerMinute: number;
        };
        blockDuration: number;
        whitelistedIPs: string[];
        emergencyMode: {
            enabled: boolean;
            triggerThreshold: number;
            restrictionLevel: 'moderate' | 'strict' | 'emergency';
        };
    };
    anomalyDetection: {
        enabled: boolean;
        patterns: {
            rapidFireRequests: {
                threshold: number;
                timeWindow: number;
            };
            unusualEndpointAccess: {
                enabled: boolean;
                sensitiveEndpoints: string[];
            };
            geolocationAnomalies: {
                enabled: boolean;
                maxDistanceKm: number;
            };
            behaviorAnalysis: {
                enabled: boolean;
                learningPeriod: number;
            };
        };
        actions: {
            temporaryBlock: boolean;
            requireAdditionalAuth: boolean;
            alertAdministrators: boolean;
            logDetailed: boolean;
        };
    };
    encryption: {
        enabled: boolean;
        algorithms: {
            symmetric: 'AES-256-GCM' | 'AES-256-CBC';
            asymmetric: 'RSA-OAEP' | 'RSA-PSS';
            hashing: 'SHA-256' | 'SHA-512';
        };
        keyRotation: {
            enabled: boolean;
            intervalDays: number;
        };
        tlsConfig: {
            minVersion: string;
            cipherSuites: string[];
            requireClientCerts: boolean;
        };
    };
    monitoring: {
        enabled: boolean;
        alertThresholds: {
            failedAuthAttempts: number;
            suspiciousActivityScore: number;
            encryptionFailures: number;
        };
        reportingInterval: number;
    };
}
export interface SecurityThreat {
    id: string;
    type: 'rate_limit_exceeded' | 'ddos_attack' | 'suspicious_activity' | 'encryption_failure' | 'auth_anomaly';
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: {
        ip: string;
        userId?: string;
        serverId?: string;
        userAgent?: string;
        geolocation?: {
            country: string;
            city: string;
            coordinates: [number, number];
        };
    };
    details: {
        description: string;
        evidence: any;
        riskScore: number;
        confidence: number;
    };
    timestamp: Date;
    status: 'detected' | 'investigating' | 'mitigated' | 'resolved' | 'false_positive';
    actions: SecurityAction[];
}
export interface SecurityAction {
    type: 'block_ip' | 'block_user' | 'rate_limit' | 'require_auth' | 'alert' | 'log';
    parameters: any;
    timestamp: Date;
    duration?: number;
    automatic: boolean;
}
export interface RateLimitEntry {
    count: number;
    resetTime: number;
    blocked: boolean;
    blockUntil?: number;
}
export interface SuspiciousActivityProfile {
    userId?: string;
    ip: string;
    riskScore: number;
    patterns: {
        requestFrequency: number[];
        endpointAccess: Record<string, number>;
        timePatterns: number[];
        geolocationHistory: Array<{
            location: [number, number];
            timestamp: Date;
        }>;
    };
    lastActivity: Date;
    flags: string[];
}
export declare class AdvancedRateLimitManager {
    private config;
    private globalLimits;
    private endpointLimits;
    private userLimits;
    private ipLimits;
    private concurrentConnections;
    private emergencyMode;
    constructor(config: SecurityConfig['rateLimiting']);
    /**
     * Check if request should be allowed
     */
    checkRequest(ip: string, userId?: string, endpoint?: string, userAgent?: string): {
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
        limits: {
            global: RateLimitEntry;
            endpoint?: RateLimitEntry;
            user?: RateLimitEntry;
            ip: RateLimitEntry;
        };
    };
    /**
     * Record a connection
     */
    recordConnection(ip: string): void;
    /**
     * Record a disconnection
     */
    recordDisconnection(ip: string): void;
    /**
     * Enable emergency mode (stricter limits)
     */
    setEmergencyMode(enabled: boolean): void;
    private checkLimit;
    private getIPLimit;
    private cleanupExpiredEntries;
    /**
     * Get rate limiting statistics
     */
    getStats(): {
        totalEntries: number;
        blockedIPs: number;
        concurrentConnections: number;
        emergencyMode: boolean;
    };
}
export declare class DDoSProtectionManager extends EventEmitter {
    private config;
    private requestCounts;
    private blockedIPs;
    private emergencyMode;
    private emergencyModeUntil;
    constructor(config: SecurityConfig['ddosProtection']);
    /**
     * Check if request should be allowed (DDoS protection)
     */
    checkRequest(ip: string, timestamp?: number): {
        allowed: boolean;
        reason?: string;
        blockUntil?: number;
        emergencyMode: boolean;
    };
    /**
     * Record failed request for DDoS analysis
     */
    recordFailedRequest(ip: string, timestamp?: number): void;
    /**
     * Manually block an IP address
     */
    blockIP(ip: string, duration?: number): void;
    /**
     * Unblock an IP address
     */
    unblockIP(ip: string): void;
    /**
     * Enable/disable emergency mode
     */
    setEmergencyMode(enabled: boolean, duration?: number): void;
    private recordRequest;
    private cleanupOldRequests;
    private checkEmergencyMode;
    /**
     * Get DDoS protection statistics
     */
    getStats(): {
        blockedIPs: number;
        emergencyMode: boolean;
        requestsPerMinute: number;
        topRequesters: Array<{
            ip: string;
            requests: number;
        }>;
    };
}
export declare class SecurityControlService extends EventEmitter {
    private ctx;
    private config;
    private rateLimitManager;
    private ddosProtectionManager;
    private suspiciousActivityProfiles;
    private securityThreats;
    private encryptionKeys;
    private auditService;
    constructor(ctx: Context, auditService: AuditService, config?: Partial<SecurityConfig>);
    /**
     * Check if API request should be allowed
     */
    checkAPIRequest(ip: string, userId?: string, endpoint?: string, userAgent?: string): {
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
        securityHeaders: Record<string, string>;
    };
    /**
     * Record successful API request
     */
    recordAPISuccess(ip: string, userId?: string, endpoint?: string): void;
    /**
     * Record failed API request
     */
    recordAPIFailure(ip: string, userId?: string, endpoint?: string, reason?: string): void;
    /**
     * Check for suspicious activity patterns
     */
    private checkSuspiciousActivity;
    /**
     * Update activity profile for user/IP
     */
    private updateActivityProfile;
    /**
     * Get or create activity profile
     */
    private getOrCreateActivityProfile;
    /**
     * Calculate risk score for activity profile
     */
    private calculateRiskScore;
    /**
     * Encrypt message for secure transport
     */
    encryptMessage(message: UWBPMessage, serverId: string): Promise<{
        encrypted: string;
        algorithm: string;
        keyId: string;
    }>;
    /**
     * Decrypt message from secure transport
     */
    decryptMessage(encryptedData: string, serverId: string, algorithm: string): Promise<UWBPMessage>;
    /**
     * Generate encryption key for server
     */
    generateEncryptionKey(serverId: string): Promise<EncryptionConfig>;
    /**
     * Rotate encryption key for server
     */
    rotateEncryptionKey(serverId: string): Promise<EncryptionConfig>;
    /**
     * Create security threat record
     */
    private createSecurityThreat;
    /**
     * Determine appropriate security actions for threat
     */
    private determineSecurityActions;
    /**
     * Execute security action
     */
    private executeSecurityAction;
    /**
     * Handle authentication failure
     */
    private handleAuthenticationFailure;
    /**
     * Get security headers for HTTP responses
     */
    private getSecurityHeaders;
    /**
     * Generate key ID for encryption key
     */
    private generateKeyId;
    /**
     * Set up event handlers
     */
    private setupEventHandlers;
    /**
     * Start security monitoring
     */
    private startSecurityMonitoring;
    /**
     * Generate security report
     */
    private generateSecurityReport;
    /**
     * Clean up old activity profiles
     */
    private cleanupOldProfiles;
    /**
     * Rotate all encryption keys
     */
    private rotateAllEncryptionKeys;
    /**
     * Get threats by type
     */
    private getThreatsByType;
    /**
     * Get threats by severity
     */
    private getThreatsBySeverity;
    /**
     * Get security statistics
     */
    getSecurityStats(): {
        rateLimiting: any;
        ddosProtection: any;
        threats: any;
        encryption: any;
    };
    /**
     * Get security threat by ID
     */
    getSecurityThreat(threatId: string): SecurityThreat | undefined;
    /**
     * Get all security threats
     */
    getAllSecurityThreats(): SecurityThreat[];
    /**
     * Update security configuration
     */
    updateConfig(newConfig: Partial<SecurityConfig>): void;
    /**
     * Shutdown security service
     */
    shutdown(): void;
}
