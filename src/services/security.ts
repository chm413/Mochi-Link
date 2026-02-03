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
import { createHash, createHmac, randomBytes, createCipher, createDecipher } from 'crypto';
import { AuditService } from './audit';
import { 
  MochiLinkError,
  APIToken,
  UWBPMessage,
  EncryptionConfig
} from '../types';

// ============================================================================
// Security Types and Interfaces
// ============================================================================

export interface SecurityConfig {
  // Rate limiting configuration
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
  
  // DDoS protection configuration
  ddosProtection: {
    enabled: boolean;
    thresholds: {
      requestsPerSecond: number;
      concurrentConnections: number;
      failedRequestsPerMinute: number;
    };
    blockDuration: number; // in seconds
    whitelistedIPs: string[];
    emergencyMode: {
      enabled: boolean;
      triggerThreshold: number;
      restrictionLevel: 'moderate' | 'strict' | 'emergency';
    };
  };
  
  // Suspicious activity detection
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
        learningPeriod: number; // in days
      };
    };
    actions: {
      temporaryBlock: boolean;
      requireAdditionalAuth: boolean;
      alertAdministrators: boolean;
      logDetailed: boolean;
    };
  };
  
  // Encryption configuration
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
  
  // Security monitoring
  monitoring: {
    enabled: boolean;
    alertThresholds: {
      failedAuthAttempts: number;
      suspiciousActivityScore: number;
      encryptionFailures: number;
    };
    reportingInterval: number; // in seconds
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
  duration?: number; // in seconds
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

// ============================================================================
// Rate Limiting Manager
// ============================================================================

export class AdvancedRateLimitManager {
  private globalLimits = new Map<string, RateLimitEntry>();
  private endpointLimits = new Map<string, RateLimitEntry>();
  private userLimits = new Map<string, RateLimitEntry>();
  private ipLimits = new Map<string, RateLimitEntry>();
  private concurrentConnections = new Map<string, number>();
  private emergencyMode = false;
  
  constructor(private config: SecurityConfig['rateLimiting']) {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
  }

  /**
   * Check if request should be allowed
   */
  checkRequest(
    ip: string,
    userId?: string,
    endpoint?: string,
    userAgent?: string
  ): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    limits: {
      global: RateLimitEntry;
      endpoint?: RateLimitEntry;
      user?: RateLimitEntry;
      ip: RateLimitEntry;
    };
  } {
    const now = Date.now();
    
    // Check global limits
    const globalKey = 'global';
    const globalLimit = this.checkLimit(
      this.globalLimits,
      globalKey,
      this.config.globalLimits.requestsPerMinute,
      60000,
      now
    );
    
    if (!globalLimit.allowed) {
      return {
        allowed: false,
        reason: 'Global rate limit exceeded',
        retryAfter: globalLimit.retryAfter,
        limits: { global: globalLimit.entry, ip: this.getIPLimit(ip) }
      };
    }
    
    // Check IP limits
    const ipLimit = this.checkLimit(
      this.ipLimits,
      ip,
      this.config.ipLimits.requestsPerMinute,
      60000,
      now
    );
    
    if (!ipLimit.allowed) {
      return {
        allowed: false,
        reason: 'IP rate limit exceeded',
        retryAfter: ipLimit.retryAfter,
        limits: { global: globalLimit.entry, ip: ipLimit.entry }
      };
    }
    
    // Check concurrent connections for IP
    const concurrent = this.concurrentConnections.get(ip) || 0;
    if (concurrent >= this.config.ipLimits.maxConcurrentConnections) {
      return {
        allowed: false,
        reason: 'Too many concurrent connections',
        limits: { global: globalLimit.entry, ip: ipLimit.entry }
      };
    }
    
    // Check user limits if user is authenticated
    let userLimit: RateLimitEntry | undefined;
    if (userId) {
      const userLimitResult = this.checkLimit(
        this.userLimits,
        userId,
        this.config.userLimits.requestsPerMinute,
        60000,
        now
      );
      
      userLimit = userLimitResult.entry;
      
      if (!userLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'User rate limit exceeded',
          retryAfter: userLimitResult.retryAfter,
          limits: { global: globalLimit.entry, user: userLimit, ip: ipLimit.entry }
        };
      }
    }
    
    // Check endpoint-specific limits
    let endpointLimit: RateLimitEntry | undefined;
    if (endpoint && this.config.endpointLimits[endpoint]) {
      const endpointConfig = this.config.endpointLimits[endpoint];
      const endpointKey = `${endpoint}:${ip}`;
      
      const endpointLimitResult = this.checkLimit(
        this.endpointLimits,
        endpointKey,
        endpointConfig.requestsPerMinute,
        60000,
        now
      );
      
      endpointLimit = endpointLimitResult.entry;
      
      if (!endpointLimitResult.allowed) {
        return {
          allowed: false,
          reason: `Endpoint rate limit exceeded for ${endpoint}`,
          retryAfter: endpointLimitResult.retryAfter,
          limits: { global: globalLimit.entry, endpoint: endpointLimit, user: userLimit, ip: ipLimit.entry }
        };
      }
    }
    
    return {
      allowed: true,
      limits: {
        global: globalLimit.entry,
        endpoint: endpointLimit,
        user: userLimit,
        ip: ipLimit.entry
      }
    };
  }

  /**
   * Record a connection
   */
  recordConnection(ip: string): void {
    const current = this.concurrentConnections.get(ip) || 0;
    this.concurrentConnections.set(ip, current + 1);
  }

  /**
   * Record a disconnection
   */
  recordDisconnection(ip: string): void {
    const current = this.concurrentConnections.get(ip) || 0;
    if (current > 0) {
      this.concurrentConnections.set(ip, current - 1);
    }
  }

  /**
   * Enable emergency mode (stricter limits)
   */
  setEmergencyMode(enabled: boolean): void {
    this.emergencyMode = enabled;
  }

  private checkLimit(
    limitMap: Map<string, RateLimitEntry>,
    key: string,
    maxRequests: number,
    windowMs: number,
    now: number
  ): {
    allowed: boolean;
    retryAfter?: number;
    entry: RateLimitEntry;
  } {
    let entry = limitMap.get(key);
    const windowStart = now - windowMs;
    
    if (!entry || entry.resetTime <= windowStart) {
      // Create new entry or reset expired entry
      entry = {
        count: 1,
        resetTime: now + windowMs,
        blocked: false
      };
      limitMap.set(key, entry);
      return { allowed: true, entry };
    }
    
    // Check if currently blocked
    if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.blockUntil - now) / 1000),
        entry
      };
    }
    
    // Clear block if expired
    if (entry.blocked && entry.blockUntil && now >= entry.blockUntil) {
      entry.blocked = false;
      entry.blockUntil = undefined;
      entry.count = 0;
      entry.resetTime = now + windowMs;
    }
    
    if (entry.count >= maxRequests) {
      // Apply emergency mode multiplier
      const effectiveLimit = this.emergencyMode ? Math.floor(maxRequests * 0.5) : maxRequests;
      
      if (entry.count >= effectiveLimit) {
        return {
          allowed: false,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          entry
        };
      }
    }
    
    entry.count++;
    return { allowed: true, entry };
  }

  private getIPLimit(ip: string): RateLimitEntry {
    return this.ipLimits.get(ip) || {
      count: 0,
      resetTime: Date.now() + 60000,
      blocked: false
    };
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    // Clean up expired entries from all maps
    [this.globalLimits, this.endpointLimits, this.userLimits, this.ipLimits].forEach(map => {
      for (const [key, entry] of map.entries()) {
        if (entry.resetTime <= now && !entry.blocked) {
          map.delete(key);
        }
      }
    });
    
    // Clean up zero concurrent connections
    for (const [ip, count] of this.concurrentConnections.entries()) {
      if (count <= 0) {
        this.concurrentConnections.delete(ip);
      }
    }
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): {
    totalEntries: number;
    blockedIPs: number;
    concurrentConnections: number;
    emergencyMode: boolean;
  } {
    let blockedIPs = 0;
    for (const entry of this.ipLimits.values()) {
      if (entry.blocked) blockedIPs++;
    }
    
    const totalConnections = Array.from(this.concurrentConnections.values())
      .reduce((sum, count) => sum + count, 0);
    
    return {
      totalEntries: this.ipLimits.size + this.userLimits.size + this.endpointLimits.size,
      blockedIPs,
      concurrentConnections: totalConnections,
      emergencyMode: this.emergencyMode
    };
  }
}

// ============================================================================
// DDoS Protection Manager
// ============================================================================

export class DDoSProtectionManager extends EventEmitter {
  private requestCounts = new Map<string, number[]>();
  private blockedIPs = new Map<string, number>(); // IP -> block until timestamp
  private emergencyMode = false;
  private emergencyModeUntil = 0;
  
  constructor(private config: SecurityConfig['ddosProtection']) {
    super();
    
    // Clean up old request counts every 10 seconds
    setInterval(() => {
      this.cleanupOldRequests();
    }, 10000);
    
    // Check for emergency mode triggers every 30 seconds
    setInterval(() => {
      this.checkEmergencyMode();
    }, 30000);
  }

  /**
   * Check if request should be allowed (DDoS protection)
   */
  checkRequest(ip: string, timestamp: number = Date.now()): {
    allowed: boolean;
    reason?: string;
    blockUntil?: number;
    emergencyMode: boolean;
  } {
    // Check if IP is whitelisted
    if (this.config.whitelistedIPs.includes(ip)) {
      return { allowed: true, emergencyMode: this.emergencyMode };
    }
    
    // Check if IP is currently blocked
    const blockUntil = this.blockedIPs.get(ip);
    if (blockUntil && timestamp < blockUntil) {
      return {
        allowed: false,
        reason: 'IP temporarily blocked due to suspicious activity',
        blockUntil,
        emergencyMode: this.emergencyMode
      };
    }
    
    // Remove expired blocks
    if (blockUntil && timestamp >= blockUntil) {
      this.blockedIPs.delete(ip);
    }
    
    // Record request
    this.recordRequest(ip, timestamp);
    
    // Check request rate
    const requests = this.requestCounts.get(ip) || [];
    const recentRequests = requests.filter(t => timestamp - t < 1000); // Last second
    
    if (recentRequests.length > this.config.thresholds.requestsPerSecond) {
      // Block IP
      const blockUntil = timestamp + (this.config.blockDuration * 1000);
      this.blockedIPs.set(ip, blockUntil);
      
      this.emit('ddosDetected', {
        ip,
        requestsPerSecond: recentRequests.length,
        blockUntil: new Date(blockUntil)
      });
      
      return {
        allowed: false,
        reason: 'Request rate exceeded - potential DDoS attack',
        blockUntil,
        emergencyMode: this.emergencyMode
      };
    }
    
    return { allowed: true, emergencyMode: this.emergencyMode };
  }

  /**
   * Record failed request for DDoS analysis
   */
  recordFailedRequest(ip: string, timestamp: number = Date.now()): void {
    // Track failed requests separately for pattern analysis
    const key = `failed:${ip}`;
    const requests = this.requestCounts.get(key) || [];
    requests.push(timestamp);
    this.requestCounts.set(key, requests);
    
    // Check for excessive failed requests
    const recentFailed = requests.filter(t => timestamp - t < 60000); // Last minute
    if (recentFailed.length > this.config.thresholds.failedRequestsPerMinute) {
      const blockUntil = timestamp + (this.config.blockDuration * 1000);
      this.blockedIPs.set(ip, blockUntil);
      
      this.emit('suspiciousActivity', {
        ip,
        type: 'excessive_failed_requests',
        failedRequests: recentFailed.length,
        blockUntil: new Date(blockUntil)
      });
    }
  }

  /**
   * Manually block an IP address
   */
  blockIP(ip: string, duration: number = this.config.blockDuration): void {
    const blockUntil = Date.now() + (duration * 1000);
    this.blockedIPs.set(ip, blockUntil);
    
    this.emit('ipBlocked', {
      ip,
      duration,
      blockUntil: new Date(blockUntil),
      manual: true
    });
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): void {
    const wasBlocked = this.blockedIPs.has(ip);
    this.blockedIPs.delete(ip);
    
    if (wasBlocked) {
      this.emit('ipUnblocked', { ip, manual: true });
    }
  }

  /**
   * Enable/disable emergency mode
   */
  setEmergencyMode(enabled: boolean, duration?: number): void {
    this.emergencyMode = enabled;
    
    if (enabled && duration) {
      this.emergencyModeUntil = Date.now() + (duration * 1000);
    } else if (!enabled) {
      this.emergencyModeUntil = 0;
    }
    
    this.emit('emergencyModeChanged', { enabled, until: this.emergencyModeUntil });
  }

  private recordRequest(ip: string, timestamp: number): void {
    const requests = this.requestCounts.get(ip) || [];
    requests.push(timestamp);
    this.requestCounts.set(ip, requests);
  }

  private cleanupOldRequests(): void {
    const cutoff = Date.now() - 300000; // Keep 5 minutes of history
    
    for (const [key, requests] of this.requestCounts.entries()) {
      const recentRequests = requests.filter(t => t > cutoff);
      if (recentRequests.length === 0) {
        this.requestCounts.delete(key);
      } else {
        this.requestCounts.set(key, recentRequests);
      }
    }
    
    // Clean up expired blocks
    const now = Date.now();
    for (const [ip, blockUntil] of this.blockedIPs.entries()) {
      if (blockUntil <= now) {
        this.blockedIPs.delete(ip);
        this.emit('ipUnblocked', { ip, manual: false });
      }
    }
  }

  private checkEmergencyMode(): void {
    if (!this.config.emergencyMode.enabled) return;
    
    // Check if emergency mode should be disabled
    if (this.emergencyMode && this.emergencyModeUntil > 0 && Date.now() > this.emergencyModeUntil) {
      this.setEmergencyMode(false);
      return;
    }
    
    // Check if emergency mode should be triggered
    if (!this.emergencyMode) {
      const now = Date.now();
      const recentRequests = Array.from(this.requestCounts.values())
        .flat()
        .filter(t => now - t < 60000); // Last minute
      
      if (recentRequests.length > this.config.emergencyMode.triggerThreshold) {
        this.setEmergencyMode(true, 300); // 5 minutes
        this.emit('emergencyModeTriggered', {
          requestsPerMinute: recentRequests.length,
          threshold: this.config.emergencyMode.triggerThreshold
        });
      }
    }
  }

  /**
   * Get DDoS protection statistics
   */
  getStats(): {
    blockedIPs: number;
    emergencyMode: boolean;
    requestsPerMinute: number;
    topRequesters: Array<{ ip: string; requests: number }>;
  } {
    const now = Date.now();
    const recentRequests = new Map<string, number>();
    
    // Count recent requests per IP
    for (const [ip, requests] of this.requestCounts.entries()) {
      if (!ip.startsWith('failed:')) {
        const recent = requests.filter(t => now - t < 60000);
        if (recent.length > 0) {
          recentRequests.set(ip, recent.length);
        }
      }
    }
    
    // Get top requesters
    const topRequesters = Array.from(recentRequests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, requests]) => ({ ip, requests }));
    
    const totalRequests = Array.from(recentRequests.values())
      .reduce((sum, count) => sum + count, 0);
    
    return {
      blockedIPs: this.blockedIPs.size,
      emergencyMode: this.emergencyMode,
      requestsPerMinute: totalRequests,
      topRequesters
    };
  }
}

// ============================================================================
// Main Security Control Service
// ============================================================================

export class SecurityControlService extends EventEmitter {
  private config: SecurityConfig;
  private rateLimitManager: AdvancedRateLimitManager;
  private ddosProtectionManager: DDoSProtectionManager;
  private suspiciousActivityProfiles = new Map<string, SuspiciousActivityProfile>();
  private securityThreats = new Map<string, SecurityThreat>();
  private encryptionKeys = new Map<string, EncryptionConfig>();
  private auditService: AuditService;
  
  constructor(
    private ctx: Context,
    auditService: AuditService,
    config: Partial<SecurityConfig> = {}
  ) {
    super();
    
    this.auditService = auditService;
    
    // Default security configuration
    this.config = {
      rateLimiting: {
        enabled: true,
        globalLimits: {
          requestsPerMinute: 1000,
          requestsPerHour: 10000,
          requestsPerDay: 100000
        },
        endpointLimits: {
          '/api/auth': { requestsPerMinute: 10, burstLimit: 20 },
          '/api/servers/*/commands': { requestsPerMinute: 30, burstLimit: 50 },
          '/api/servers/*/players/*/kick': { requestsPerMinute: 5, burstLimit: 10 }
        },
        userLimits: {
          requestsPerMinute: 100,
          requestsPerHour: 1000
        },
        ipLimits: {
          requestsPerMinute: 200,
          requestsPerHour: 2000,
          maxConcurrentConnections: 10
        }
      },
      ddosProtection: {
        enabled: true,
        thresholds: {
          requestsPerSecond: 50,
          concurrentConnections: 100,
          failedRequestsPerMinute: 20
        },
        blockDuration: 300, // 5 minutes
        whitelistedIPs: ['127.0.0.1', '::1'],
        emergencyMode: {
          enabled: true,
          triggerThreshold: 5000,
          restrictionLevel: 'moderate'
        }
      },
      anomalyDetection: {
        enabled: true,
        patterns: {
          rapidFireRequests: {
            threshold: 100,
            timeWindow: 60000
          },
          unusualEndpointAccess: {
            enabled: true,
            sensitiveEndpoints: ['/api/auth', '/api/servers/*/commands', '/api/tokens']
          },
          geolocationAnomalies: {
            enabled: false, // Requires geolocation service
            maxDistanceKm: 1000
          },
          behaviorAnalysis: {
            enabled: true,
            learningPeriod: 7
          }
        },
        actions: {
          temporaryBlock: true,
          requireAdditionalAuth: true,
          alertAdministrators: true,
          logDetailed: true
        }
      },
      encryption: {
        enabled: true,
        algorithms: {
          symmetric: 'AES-256-GCM',
          asymmetric: 'RSA-OAEP',
          hashing: 'SHA-256'
        },
        keyRotation: {
          enabled: true,
          intervalDays: 30
        },
        tlsConfig: {
          minVersion: 'TLSv1.2',
          cipherSuites: [
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-SHA384',
            'ECDHE-RSA-AES128-SHA256'
          ],
          requireClientCerts: false
        }
      },
      monitoring: {
        enabled: true,
        alertThresholds: {
          failedAuthAttempts: 5,
          suspiciousActivityScore: 80,
          encryptionFailures: 3
        },
        reportingInterval: 300 // 5 minutes
      },
      ...config
    };
    
    // Initialize managers
    this.rateLimitManager = new AdvancedRateLimitManager(this.config.rateLimiting);
    this.ddosProtectionManager = new DDoSProtectionManager(this.config.ddosProtection);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Start monitoring
    if (this.config.monitoring.enabled) {
      this.startSecurityMonitoring();
    }
  }

  // ============================================================================
  // API Rate Limiting and Protection
  // ============================================================================

  /**
   * Check if API request should be allowed
   */
  checkAPIRequest(
    ip: string,
    userId?: string,
    endpoint?: string,
    userAgent?: string
  ): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    securityHeaders: Record<string, string>;
  } {
    // Check DDoS protection first
    const ddosCheck = this.ddosProtectionManager.checkRequest(ip);
    if (!ddosCheck.allowed) {
      return {
        allowed: false,
        reason: ddosCheck.reason,
        retryAfter: ddosCheck.blockUntil ? Math.ceil((ddosCheck.blockUntil - Date.now()) / 1000) : undefined,
        securityHeaders: this.getSecurityHeaders(ddosCheck.emergencyMode)
      };
    }
    
    // Check rate limits
    const rateLimitCheck = this.rateLimitManager.checkRequest(ip, userId, endpoint, userAgent);
    if (!rateLimitCheck.allowed) {
      // Record failed request for DDoS analysis
      this.ddosProtectionManager.recordFailedRequest(ip);
      
      return {
        allowed: false,
        reason: rateLimitCheck.reason,
        retryAfter: rateLimitCheck.retryAfter,
        securityHeaders: this.getSecurityHeaders(ddosCheck.emergencyMode, rateLimitCheck.limits)
      };
    }
    
    // Check for suspicious activity
    if (this.config.anomalyDetection.enabled) {
      const suspiciousCheck = this.checkSuspiciousActivity(ip, userId, endpoint, userAgent);
      if (!suspiciousCheck.allowed) {
        return {
          allowed: false,
          reason: suspiciousCheck.reason,
          securityHeaders: this.getSecurityHeaders(ddosCheck.emergencyMode)
        };
      }
    }
    
    return {
      allowed: true,
      securityHeaders: this.getSecurityHeaders(ddosCheck.emergencyMode, rateLimitCheck.limits)
    };
  }

  /**
   * Record successful API request
   */
  recordAPISuccess(ip: string, userId?: string, endpoint?: string): void {
    // Update activity profiles for anomaly detection
    if (this.config.anomalyDetection.enabled) {
      this.updateActivityProfile(ip, true, userId, endpoint);
    }
  }

  /**
   * Record failed API request
   */
  recordAPIFailure(ip: string, userId?: string, endpoint?: string, reason?: string): void {
    // Record for DDoS protection
    this.ddosProtectionManager.recordFailedRequest(ip);
    
    // Update activity profiles
    if (this.config.anomalyDetection.enabled) {
      this.updateActivityProfile(ip, false, userId, endpoint);
    }
    
    // Check for authentication failures
    if (reason === 'authentication_failed' && userId) {
      this.handleAuthenticationFailure(ip, userId);
    }
  }

  // ============================================================================
  // Suspicious Activity Detection
  // ============================================================================

  /**
   * Check for suspicious activity patterns
   */
  private checkSuspiciousActivity(
    ip: string,
    userId?: string,
    endpoint?: string,
    userAgent?: string
  ): { allowed: boolean; reason?: string } {
    const profile = this.getOrCreateActivityProfile(ip, userId);
    
    // Check rapid fire requests
    const now = Date.now();
    const recentRequests = profile.patterns.requestFrequency.filter(
      t => now - t < this.config.anomalyDetection.patterns.rapidFireRequests.timeWindow
    );
    
    if (recentRequests.length > this.config.anomalyDetection.patterns.rapidFireRequests.threshold) {
      this.createSecurityThreat({
        type: 'suspicious_activity',
        severity: 'medium',
        source: { ip, userId, userAgent },
        details: {
          description: 'Rapid fire requests detected',
          evidence: { requestCount: recentRequests.length, timeWindow: this.config.anomalyDetection.patterns.rapidFireRequests.timeWindow },
          riskScore: 60,
          confidence: 0.8
        }
      });
      
      return { allowed: false, reason: 'Suspicious activity detected - rapid fire requests' };
    }
    
    // Check unusual endpoint access
    if (endpoint && this.config.anomalyDetection.patterns.unusualEndpointAccess.enabled) {
      const isSensitive = this.config.anomalyDetection.patterns.unusualEndpointAccess.sensitiveEndpoints
        .some(pattern => endpoint.match(pattern.replace('*', '.*')));
      
      if (isSensitive) {
        const endpointAccess = profile.patterns.endpointAccess[endpoint] || 0;
        if (endpointAccess === 0) {
          // First time accessing sensitive endpoint
          this.createSecurityThreat({
            type: 'suspicious_activity',
            severity: 'low',
            source: { ip, userId, userAgent },
            details: {
              description: 'First-time access to sensitive endpoint',
              evidence: { endpoint, previousAccess: endpointAccess },
              riskScore: 30,
              confidence: 0.6
            }
          });
        }
      }
    }
    
    return { allowed: true };
  }

  /**
   * Update activity profile for user/IP
   */
  private updateActivityProfile(
    ip: string,
    success: boolean,
    userId?: string,
    endpoint?: string
  ): void {
    const profile = this.getOrCreateActivityProfile(ip, userId);
    const now = Date.now();
    
    // Update request frequency
    profile.patterns.requestFrequency.push(now);
    
    // Keep only recent requests (last hour)
    profile.patterns.requestFrequency = profile.patterns.requestFrequency
      .filter(t => now - t < 3600000);
    
    // Update endpoint access
    if (endpoint) {
      profile.patterns.endpointAccess[endpoint] = (profile.patterns.endpointAccess[endpoint] || 0) + 1;
    }
    
    // Update time patterns (hour of day)
    const hour = new Date(now).getHours();
    profile.patterns.timePatterns[hour] = (profile.patterns.timePatterns[hour] || 0) + 1;
    
    // Update last activity
    profile.lastActivity = new Date(now);
    
    // Calculate risk score
    profile.riskScore = this.calculateRiskScore(profile);
    
    // Check if risk score exceeds threshold
    if (profile.riskScore > this.config.monitoring.alertThresholds.suspiciousActivityScore) {
      this.createSecurityThreat({
        type: 'suspicious_activity',
        severity: 'high',
        source: { ip, userId },
        details: {
          description: 'High risk score detected',
          evidence: { riskScore: profile.riskScore, profile },
          riskScore: profile.riskScore,
          confidence: 0.9
        }
      });
    }
  }

  /**
   * Get or create activity profile
   */
  private getOrCreateActivityProfile(ip: string, userId?: string): SuspiciousActivityProfile {
    const key = userId ? `user:${userId}` : `ip:${ip}`;
    let profile = this.suspiciousActivityProfiles.get(key);
    
    if (!profile) {
      profile = {
        userId,
        ip,
        riskScore: 0,
        patterns: {
          requestFrequency: [],
          endpointAccess: {},
          timePatterns: new Array(24).fill(0),
          geolocationHistory: []
        },
        lastActivity: new Date(),
        flags: []
      };
      this.suspiciousActivityProfiles.set(key, profile);
    }
    
    return profile;
  }

  /**
   * Calculate risk score for activity profile
   */
  private calculateRiskScore(profile: SuspiciousActivityProfile): number {
    let score = 0;
    const now = Date.now();
    
    // Request frequency score (0-40 points)
    const recentRequests = profile.patterns.requestFrequency.filter(t => now - t < 3600000);
    const requestRate = recentRequests.length / 60; // requests per minute
    score += Math.min(40, requestRate * 2);
    
    // Endpoint diversity score (0-20 points)
    const endpointCount = Object.keys(profile.patterns.endpointAccess).length;
    if (endpointCount > 20) score += 20;
    else if (endpointCount > 10) score += 10;
    
    // Time pattern score (0-20 points)
    const activeHours = profile.patterns.timePatterns.filter(count => count > 0).length;
    if (activeHours > 20) score += 20; // Active almost 24/7
    else if (activeHours < 3) score += 10; // Very limited activity window
    
    // Flags score (0-20 points)
    score += profile.flags.length * 5;
    
    return Math.min(100, score);
  }

  // ============================================================================
  // Communication Encryption
  // ============================================================================

  /**
   * Encrypt message for secure transport
   */
  async encryptMessage(message: UWBPMessage, serverId: string): Promise<{
    encrypted: string;
    algorithm: string;
    keyId: string;
  }> {
    if (!this.config.encryption.enabled) {
      throw new MochiLinkError('Encryption is disabled', 'ENCRYPTION_DISABLED');
    }
    
    const encryptionConfig = this.encryptionKeys.get(serverId);
    if (!encryptionConfig) {
      throw new MochiLinkError('No encryption key found for server', 'ENCRYPTION_KEY_NOT_FOUND');
    }
    
    try {
      const messageStr = JSON.stringify(message);
      const algorithm = this.config.encryption.algorithms.symmetric;
      
      if (algorithm === 'AES-256-GCM') {
        const iv = randomBytes(16);
        const cipher = createCipher('aes-256-gcm', Buffer.from(encryptionConfig.key!, 'hex'));
        
        let encrypted = cipher.update(messageStr, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = (cipher as any).getAuthTag();
        const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
        
        return {
          encrypted: result,
          algorithm,
          keyId: this.generateKeyId(serverId)
        };
      }
      
      throw new MochiLinkError('Unsupported encryption algorithm', 'UNSUPPORTED_ALGORITHM');
      
    } catch (error) {
      await this.auditService.logger.logError(
        'encryption_failed',
        { serverId, algorithm: this.config.encryption.algorithms.symmetric },
        error as Error,
        { serverId }
      );
      
      throw new MochiLinkError(
        'Message encryption failed',
        'ENCRYPTION_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Decrypt message from secure transport
   */
  async decryptMessage(encryptedData: string, serverId: string, algorithm: string): Promise<UWBPMessage> {
    if (!this.config.encryption.enabled) {
      throw new MochiLinkError('Encryption is disabled', 'ENCRYPTION_DISABLED');
    }
    
    const encryptionConfig = this.encryptionKeys.get(serverId);
    if (!encryptionConfig) {
      throw new MochiLinkError('No encryption key found for server', 'ENCRYPTION_KEY_NOT_FOUND');
    }
    
    try {
      if (algorithm === 'AES-256-GCM') {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
          throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        
        const decipher = createDecipher('aes-256-gcm', Buffer.from(encryptionConfig.key!, 'hex'));
        (decipher as any).setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
      }
      
      throw new MochiLinkError('Unsupported decryption algorithm', 'UNSUPPORTED_ALGORITHM');
      
    } catch (error) {
      await this.auditService.logger.logError(
        'decryption_failed',
        { serverId, algorithm },
        error as Error,
        { serverId }
      );
      
      throw new MochiLinkError(
        'Message decryption failed',
        'DECRYPTION_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Generate encryption key for server
   */
  async generateEncryptionKey(serverId: string): Promise<EncryptionConfig> {
    const key = randomBytes(32).toString('hex'); // 256-bit key
    const iv = randomBytes(16).toString('hex');
    
    const config: EncryptionConfig = {
      algorithm: 'AES-256-GCM',
      key,
      iv
    };
    
    this.encryptionKeys.set(serverId, config);
    
    // Log key generation
    await this.auditService.logger.logError(
      'encryption_key_generated',
      { serverId, algorithm: config.algorithm },
      new Error('Key generated successfully'),
      { serverId }
    );
    
    return config;
  }

  /**
   * Rotate encryption key for server
   */
  async rotateEncryptionKey(serverId: string): Promise<EncryptionConfig> {
    const oldConfig = this.encryptionKeys.get(serverId);
    const newConfig = await this.generateEncryptionKey(serverId);
    
    // Log key rotation
    await this.auditService.logger.logError(
      'encryption_key_rotated',
      { serverId, oldKeyId: oldConfig ? this.generateKeyId(serverId) : undefined },
      new Error('Key rotated successfully'),
      { serverId }
    );
    
    this.emit('encryptionKeyRotated', serverId, newConfig);
    
    return newConfig;
  }

  // ============================================================================
  // Security Event Management
  // ============================================================================

  /**
   * Create security threat record
   */
  private createSecurityThreat(threat: Omit<SecurityThreat, 'id' | 'timestamp' | 'status' | 'actions'>): SecurityThreat {
    const id = randomBytes(16).toString('hex');
    const fullThreat: SecurityThreat = {
      id,
      timestamp: new Date(),
      status: 'detected',
      actions: [],
      ...threat
    };
    
    this.securityThreats.set(id, fullThreat);
    
    // Determine and execute automatic actions
    const actions = this.determineSecurityActions(fullThreat);
    for (const action of actions) {
      this.executeSecurityAction(fullThreat, action);
    }
    
    // Log security threat
    this.auditService.logger.logError(
      fullThreat.type,
      {
        threatId: id,
        severity: fullThreat.severity,
        source: fullThreat.source,
        details: fullThreat.details
      },
      new Error(`Security threat detected: ${fullThreat.details.description}`),
      { serverId: fullThreat.source.serverId }
    );
    
    this.emit('securityThreat', fullThreat);
    
    return fullThreat;
  }

  /**
   * Determine appropriate security actions for threat
   */
  private determineSecurityActions(threat: SecurityThreat): SecurityAction[] {
    const actions: SecurityAction[] = [];
    const config = this.config.anomalyDetection.actions;
    
    // Always log detailed information
    if (config.logDetailed) {
      actions.push({
        type: 'log',
        parameters: { threat },
        timestamp: new Date(),
        automatic: true
      });
    }
    
    // Alert administrators for high/critical threats
    if (config.alertAdministrators && ['high', 'critical'].includes(threat.severity)) {
      actions.push({
        type: 'alert',
        parameters: { threat },
        timestamp: new Date(),
        automatic: true
      });
    }
    
    // Temporary block for medium/high/critical threats
    if (config.temporaryBlock && ['medium', 'high', 'critical'].includes(threat.severity)) {
      const duration = threat.severity === 'critical' ? 3600 : threat.severity === 'high' ? 1800 : 900;
      actions.push({
        type: 'block_ip',
        parameters: { ip: threat.source.ip, duration },
        timestamp: new Date(),
        duration,
        automatic: true
      });
    }
    
    // Require additional authentication for suspicious users
    if (config.requireAdditionalAuth && threat.source.userId && threat.severity !== 'low') {
      actions.push({
        type: 'require_auth',
        parameters: { userId: threat.source.userId },
        timestamp: new Date(),
        automatic: true
      });
    }
    
    return actions;
  }

  /**
   * Execute security action
   */
  private executeSecurityAction(threat: SecurityThreat, action: SecurityAction): void {
    switch (action.type) {
      case 'block_ip':
        this.ddosProtectionManager.blockIP(action.parameters.ip, action.parameters.duration);
        break;
        
      case 'block_user':
        // This would integrate with user management system
        this.emit('blockUser', action.parameters.userId, action.duration);
        break;
        
      case 'rate_limit':
        // Apply additional rate limiting
        this.emit('applyRateLimit', action.parameters);
        break;
        
      case 'require_auth':
        // Flag user for additional authentication
        this.emit('requireAdditionalAuth', action.parameters.userId);
        break;
        
      case 'alert':
        // Send alert to administrators
        this.emit('securityAlert', threat, action);
        break;
        
      case 'log':
        // Additional detailed logging is handled by audit service
        break;
    }
    
    threat.actions.push(action);
  }

  // ============================================================================
  // Authentication Failure Handling
  // ============================================================================

  /**
   * Handle authentication failure
   */
  private handleAuthenticationFailure(ip: string, userId: string): void {
    const profile = this.getOrCreateActivityProfile(ip, userId);
    profile.flags.push('auth_failure');
    
    // Count recent auth failures
    const authFailures = profile.flags.filter(flag => flag === 'auth_failure').length;
    
    if (authFailures >= this.config.monitoring.alertThresholds.failedAuthAttempts) {
      this.createSecurityThreat({
        type: 'auth_anomaly',
        severity: 'high',
        source: { ip, userId },
        details: {
          description: 'Multiple authentication failures detected',
          evidence: { failureCount: authFailures },
          riskScore: 80,
          confidence: 0.9
        }
      });
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get security headers for HTTP responses
   */
  private getSecurityHeaders(
    emergencyMode: boolean,
    rateLimits?: any
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
      'X-Emergency-Mode': emergencyMode ? 'true' : 'false'
    };
    
    if (rateLimits) {
      headers['X-RateLimit-Limit'] = rateLimits.ip.count.toString();
      headers['X-RateLimit-Remaining'] = Math.max(0, 
        this.config.rateLimiting.ipLimits.requestsPerMinute - rateLimits.ip.count
      ).toString();
      headers['X-RateLimit-Reset'] = Math.ceil(rateLimits.ip.resetTime / 1000).toString();
    }
    
    return headers;
  }

  /**
   * Generate key ID for encryption key
   */
  private generateKeyId(serverId: string): string {
    return createHash('sha256').update(`${serverId}:${Date.now()}`).digest('hex').substring(0, 16);
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // DDoS protection events
    this.ddosProtectionManager.on('ddosDetected', (event) => {
      this.createSecurityThreat({
        type: 'ddos_attack',
        severity: 'critical',
        source: { ip: event.ip },
        details: {
          description: 'DDoS attack detected',
          evidence: { requestsPerSecond: event.requestsPerSecond },
          riskScore: 100,
          confidence: 0.95
        }
      });
    });
    
    this.ddosProtectionManager.on('suspiciousActivity', (event) => {
      this.createSecurityThreat({
        type: 'suspicious_activity',
        severity: 'medium',
        source: { ip: event.ip },
        details: {
          description: event.type,
          evidence: event,
          riskScore: 60,
          confidence: 0.8
        }
      });
    });
  }

  /**
   * Start security monitoring
   */
  private startSecurityMonitoring(): void {
    setInterval(() => {
      this.generateSecurityReport();
    }, this.config.monitoring.reportingInterval * 1000);
    
    // Clean up old activity profiles every hour
    setInterval(() => {
      this.cleanupOldProfiles();
    }, 3600000);
    
    // Rotate encryption keys if enabled
    if (this.config.encryption.keyRotation.enabled) {
      const intervalMs = Math.min(this.config.encryption.keyRotation.intervalDays * 24 * 3600000, 2147483647);
      setInterval(() => {
        this.rotateAllEncryptionKeys();
      }, intervalMs);
    }
  }

  /**
   * Generate security report
   */
  private generateSecurityReport(): void {
    const rateLimitStats = this.rateLimitManager.getStats();
    const ddosStats = this.ddosProtectionManager.getStats();
    const threatCount = this.securityThreats.size;
    const activeProfiles = this.suspiciousActivityProfiles.size;
    
    const report = {
      timestamp: new Date(),
      rateLimiting: rateLimitStats,
      ddosProtection: ddosStats,
      threats: {
        total: threatCount,
        byType: this.getThreatsByType(),
        bySeverity: this.getThreatsBySeverity()
      },
      activityProfiles: activeProfiles,
      encryption: {
        keysManaged: this.encryptionKeys.size
      }
    };
    
    this.emit('securityReport', report);
  }

  /**
   * Clean up old activity profiles
   */
  private cleanupOldProfiles(): void {
    const cutoff = Date.now() - (7 * 24 * 3600000); // 7 days
    
    for (const [key, profile] of this.suspiciousActivityProfiles.entries()) {
      if (profile.lastActivity.getTime() < cutoff) {
        this.suspiciousActivityProfiles.delete(key);
      }
    }
  }

  /**
   * Rotate all encryption keys
   */
  private async rotateAllEncryptionKeys(): Promise<void> {
    for (const serverId of this.encryptionKeys.keys()) {
      try {
        await this.rotateEncryptionKey(serverId);
      } catch (error) {
        this.ctx.logger('mochi-link:security').error(`Failed to rotate key for ${serverId}:`, error);
      }
    }
  }

  /**
   * Get threats by type
   */
  private getThreatsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const threat of this.securityThreats.values()) {
      counts[threat.type] = (counts[threat.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Get threats by severity
   */
  private getThreatsBySeverity(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const threat of this.securityThreats.values()) {
      counts[threat.severity] = (counts[threat.severity] || 0) + 1;
    }
    return counts;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    rateLimiting: any;
    ddosProtection: any;
    threats: any;
    encryption: any;
  } {
    return {
      rateLimiting: this.rateLimitManager.getStats(),
      ddosProtection: this.ddosProtectionManager.getStats(),
      threats: {
        total: this.securityThreats.size,
        byType: this.getThreatsByType(),
        bySeverity: this.getThreatsBySeverity()
      },
      encryption: {
        keysManaged: this.encryptionKeys.size,
        enabled: this.config.encryption.enabled
      }
    };
  }

  /**
   * Get security threat by ID
   */
  getSecurityThreat(threatId: string): SecurityThreat | undefined {
    return this.securityThreats.get(threatId);
  }

  /**
   * Get all security threats
   */
  getAllSecurityThreats(): SecurityThreat[] {
    return Array.from(this.securityThreats.values());
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize managers if needed
    if (newConfig.rateLimiting) {
      this.rateLimitManager = new AdvancedRateLimitManager(this.config.rateLimiting);
    }
    
    if (newConfig.ddosProtection) {
      this.ddosProtectionManager = new DDoSProtectionManager(this.config.ddosProtection);
      this.setupEventHandlers();
    }
    
    this.emit('configUpdated', this.config);
  }

  /**
   * Shutdown security service
   */
  shutdown(): void {
    this.removeAllListeners();
    this.ddosProtectionManager.removeAllListeners();
    this.securityThreats.clear();
    this.suspiciousActivityProfiles.clear();
    this.encryptionKeys.clear();
  }
}