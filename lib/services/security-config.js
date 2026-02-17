"use strict";
/**
 * Security Configuration Manager
 *
 * Manages security configuration settings and provides defaults
 * for the SecurityControlService
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityConfigManager = void 0;
class SecurityConfigManager {
    constructor(ctx, customConfig = {}) {
        this.ctx = ctx;
        this.config = this.createDefaultConfig();
        this.updateConfig(customConfig);
    }
    /**
     * Get current security configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update security configuration
     */
    updateConfig(newConfig) {
        this.config = this.mergeConfig(this.config, newConfig);
        this.validateConfig();
    }
    /**
     * Create default security configuration
     */
    createDefaultConfig() {
        return {
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
                    '/api/servers/*/players/*/kick': { requestsPerMinute: 5, burstLimit: 10 },
                    '/api/servers/*/bans': { requestsPerMinute: 10, burstLimit: 15 },
                    '/api/servers/*/whitelist': { requestsPerMinute: 20, burstLimit: 30 }
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
                        sensitiveEndpoints: [
                            '/api/auth',
                            '/api/servers/*/commands',
                            '/api/tokens',
                            '/api/servers/*/bans',
                            '/api/batch/*'
                        ]
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
            }
        };
    }
    /**
     * Deep merge configuration objects
     */
    mergeConfig(base, override) {
        const result = { ...base };
        for (const [key, value] of Object.entries(override)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = {
                    ...result[key],
                    ...value
                };
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    /**
     * Validate security configuration
     */
    validateConfig() {
        const config = this.config;
        // Validate rate limiting configuration
        if (config.rateLimiting.enabled) {
            if (config.rateLimiting.globalLimits.requestsPerMinute <= 0) {
                throw new Error('Global rate limit must be positive');
            }
            if (config.rateLimiting.userLimits.requestsPerMinute <= 0) {
                throw new Error('User rate limit must be positive');
            }
            if (config.rateLimiting.ipLimits.requestsPerMinute <= 0) {
                throw new Error('IP rate limit must be positive');
            }
        }
        // Validate DDoS protection configuration
        if (config.ddosProtection.enabled) {
            if (config.ddosProtection.thresholds.requestsPerSecond <= 0) {
                throw new Error('DDoS threshold must be positive');
            }
            if (config.ddosProtection.blockDuration <= 0) {
                throw new Error('Block duration must be positive');
            }
        }
        // Validate anomaly detection configuration
        if (config.anomalyDetection.enabled) {
            if (config.anomalyDetection.patterns.rapidFireRequests.threshold <= 0) {
                throw new Error('Rapid fire threshold must be positive');
            }
            if (config.anomalyDetection.patterns.rapidFireRequests.timeWindow <= 0) {
                throw new Error('Rapid fire time window must be positive');
            }
        }
        // Validate encryption configuration
        if (config.encryption.enabled) {
            const validSymmetric = ['AES-256-GCM', 'AES-256-CBC'];
            if (!validSymmetric.includes(config.encryption.algorithms.symmetric)) {
                throw new Error(`Invalid symmetric algorithm: ${config.encryption.algorithms.symmetric}`);
            }
            const validAsymmetric = ['RSA-OAEP', 'RSA-PSS'];
            if (!validAsymmetric.includes(config.encryption.algorithms.asymmetric)) {
                throw new Error(`Invalid asymmetric algorithm: ${config.encryption.algorithms.asymmetric}`);
            }
            const validHashing = ['SHA-256', 'SHA-512'];
            if (!validHashing.includes(config.encryption.algorithms.hashing)) {
                throw new Error(`Invalid hashing algorithm: ${config.encryption.algorithms.hashing}`);
            }
        }
        // Validate monitoring configuration
        if (config.monitoring.enabled) {
            if (config.monitoring.reportingInterval <= 0) {
                throw new Error('Reporting interval must be positive');
            }
            if (config.monitoring.alertThresholds.failedAuthAttempts <= 0) {
                throw new Error('Failed auth attempts threshold must be positive');
            }
        }
    }
    /**
     * Get configuration for specific environment
     */
    getEnvironmentConfig(environment) {
        switch (environment) {
            case 'development':
                return {
                    rateLimiting: {
                        ...this.config.rateLimiting,
                        enabled: false // Disable for easier development
                    },
                    ddosProtection: {
                        ...this.config.ddosProtection,
                        enabled: false
                    },
                    anomalyDetection: {
                        ...this.config.anomalyDetection,
                        enabled: false
                    },
                    encryption: {
                        ...this.config.encryption,
                        enabled: false
                    }
                };
            case 'testing':
                return {
                    rateLimiting: {
                        ...this.config.rateLimiting,
                        enabled: true,
                        globalLimits: {
                            requestsPerMinute: 10000, // Higher limits for testing
                            requestsPerHour: 100000,
                            requestsPerDay: 1000000
                        }
                    },
                    ddosProtection: {
                        ...this.config.ddosProtection,
                        enabled: true,
                        thresholds: {
                            requestsPerSecond: 1000, // Higher thresholds for testing
                            concurrentConnections: 1000,
                            failedRequestsPerMinute: 100
                        }
                    },
                    monitoring: {
                        ...this.config.monitoring,
                        enabled: true,
                        reportingInterval: 10 // More frequent reporting for testing
                    }
                };
            case 'production':
                return {
                    rateLimiting: {
                        ...this.config.rateLimiting,
                        enabled: true
                    },
                    ddosProtection: {
                        ...this.config.ddosProtection,
                        enabled: true
                    },
                    anomalyDetection: {
                        ...this.config.anomalyDetection,
                        enabled: true
                    },
                    encryption: {
                        ...this.config.encryption,
                        enabled: true
                    },
                    monitoring: {
                        ...this.config.monitoring,
                        enabled: true
                    }
                };
            default:
                return {};
        }
    }
}
exports.SecurityConfigManager = SecurityConfigManager;
