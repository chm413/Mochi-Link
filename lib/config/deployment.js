"use strict";
/**
 * Deployment Configuration Management
 *
 * This module handles deployment configuration, environment setup,
 * and configuration validation for the Mochi-Link system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationUtils = exports.EnvironmentDetector = exports.DeploymentConfigManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
// ============================================================================
// Default Configurations
// ============================================================================
const DEFAULT_CONFIGS = {
    development: {
        environment: 'development',
        version: '1.0.0-dev',
        buildTime: new Date().toISOString(),
        services: {
            websocket: {
                enabled: true,
                port: 8080,
                host: '127.0.0.1',
                ssl: {
                    enabled: false
                }
            },
            http: {
                enabled: true,
                port: 8081,
                host: '127.0.0.1',
                cors: true
            },
            database: {
                prefix: 'mochi_dev_',
                connectionTimeout: 10000,
                queryTimeout: 5000
            }
        },
        security: {
            tokenExpiry: 3600, // 1 hour
            maxConnections: 50,
            rateLimiting: {
                enabled: false,
                windowMs: 60000,
                maxRequests: 1000
            },
            encryption: {
                enabled: false,
                algorithm: 'AES-256-GCM'
            }
        },
        monitoring: {
            enabled: true,
            reportInterval: 30,
            historyRetention: 7,
            healthCheck: {
                interval: 30000,
                timeout: 5000
            },
            metrics: {
                enabled: true,
                interval: 60000,
                retention: 7
            }
        },
        logging: {
            level: 'debug',
            auditRetention: 30,
            fileLogging: {
                enabled: false
            }
        },
        performance: {
            caching: {
                enabled: true,
                maxSize: 100,
                ttl: 300
            },
            connectionPool: {
                enabled: false,
                minConnections: 1,
                maxConnections: 5,
                idleTimeout: 30000
            },
            optimization: {
                enabled: false,
                queryCache: true,
                compression: false
            }
        }
    },
    staging: {
        environment: 'staging',
        version: '1.0.0-staging',
        buildTime: new Date().toISOString(),
        services: {
            websocket: {
                enabled: true,
                port: 8080,
                host: '0.0.0.0',
                ssl: {
                    enabled: true,
                    certPath: '/etc/ssl/certs/mochi-link.crt',
                    keyPath: '/etc/ssl/private/mochi-link.key'
                }
            },
            http: {
                enabled: true,
                port: 8081,
                host: '0.0.0.0',
                cors: true
            },
            database: {
                prefix: 'mochi_staging_',
                connectionTimeout: 15000,
                queryTimeout: 10000
            }
        },
        security: {
            tokenExpiry: 86400, // 24 hours
            maxConnections: 100,
            rateLimiting: {
                enabled: true,
                windowMs: 60000,
                maxRequests: 500
            },
            encryption: {
                enabled: true,
                algorithm: 'AES-256-GCM'
            }
        },
        monitoring: {
            enabled: true,
            reportInterval: 30,
            historyRetention: 30,
            healthCheck: {
                interval: 30000,
                timeout: 5000
            },
            metrics: {
                enabled: true,
                interval: 60000,
                retention: 30
            }
        },
        logging: {
            level: 'info',
            auditRetention: 90,
            fileLogging: {
                enabled: true,
                path: '/var/log/mochi-link',
                maxSize: '100MB',
                maxFiles: 10
            }
        },
        performance: {
            caching: {
                enabled: true,
                maxSize: 500,
                ttl: 600
            },
            connectionPool: {
                enabled: true,
                minConnections: 2,
                maxConnections: 10,
                idleTimeout: 60000
            },
            optimization: {
                enabled: true,
                queryCache: true,
                compression: true
            }
        }
    },
    production: {
        environment: 'production',
        version: '1.0.0',
        buildTime: new Date().toISOString(),
        services: {
            websocket: {
                enabled: true,
                port: 8080,
                host: '0.0.0.0',
                ssl: {
                    enabled: true,
                    certPath: '/etc/ssl/certs/mochi-link.crt',
                    keyPath: '/etc/ssl/private/mochi-link.key'
                }
            },
            http: {
                enabled: true,
                port: 8081,
                host: '0.0.0.0',
                cors: false
            },
            database: {
                prefix: 'mochi_',
                connectionTimeout: 30000,
                queryTimeout: 15000
            }
        },
        security: {
            tokenExpiry: 86400, // 24 hours
            maxConnections: 500,
            rateLimiting: {
                enabled: true,
                windowMs: 60000,
                maxRequests: 100
            },
            encryption: {
                enabled: true,
                algorithm: 'AES-256-GCM'
            }
        },
        monitoring: {
            enabled: true,
            reportInterval: 30,
            historyRetention: 90,
            healthCheck: {
                interval: 30000,
                timeout: 5000
            },
            metrics: {
                enabled: true,
                interval: 60000,
                retention: 90
            }
        },
        logging: {
            level: 'warn',
            auditRetention: 365,
            fileLogging: {
                enabled: true,
                path: '/var/log/mochi-link',
                maxSize: '500MB',
                maxFiles: 20
            }
        },
        performance: {
            caching: {
                enabled: true,
                maxSize: 1000,
                ttl: 1800
            },
            connectionPool: {
                enabled: true,
                minConnections: 5,
                maxConnections: 50,
                idleTimeout: 300000
            },
            optimization: {
                enabled: true,
                queryCache: true,
                compression: true
            }
        }
    }
};
// ============================================================================
// Configuration Manager
// ============================================================================
class DeploymentConfigManager {
    constructor(configPath = './config/deployment.json') {
        this.configPath = configPath;
    }
    /**
     * Load configuration for the specified environment
     */
    loadConfig(environment) {
        // Try to load from file first
        const fileConfig = this.loadConfigFromFile();
        // Merge with default configuration
        const defaultConfig = DEFAULT_CONFIGS[environment];
        this.currentConfig = this.mergeConfigs(defaultConfig, fileConfig);
        // Validate configuration
        this.validateConfig(this.currentConfig);
        return this.currentConfig;
    }
    /**
     * Save current configuration to file
     */
    saveConfig(config) {
        this.ensureConfigDirectory();
        const configJson = JSON.stringify(config, null, 2);
        (0, fs_1.writeFileSync)(this.configPath, configJson, 'utf8');
        this.currentConfig = config;
    }
    /**
     * Get current configuration
     */
    getCurrentConfig() {
        return this.currentConfig;
    }
    /**
     * Convert deployment config to plugin config
     */
    toPluginConfig(deploymentConfig) {
        return {
            websocket: {
                port: deploymentConfig.services.websocket.port,
                host: deploymentConfig.services.websocket.host,
                ssl: deploymentConfig.services.websocket.ssl?.enabled ? {
                    cert: deploymentConfig.services.websocket.ssl.certPath || '',
                    key: deploymentConfig.services.websocket.ssl.keyPath || ''
                } : undefined
            },
            http: deploymentConfig.services.http.enabled ? {
                port: deploymentConfig.services.http.port,
                host: deploymentConfig.services.http.host,
                cors: deploymentConfig.services.http.cors
            } : undefined,
            database: {
                prefix: deploymentConfig.services.database.prefix
            },
            security: {
                tokenExpiry: deploymentConfig.security.tokenExpiry,
                maxConnections: deploymentConfig.security.maxConnections,
                rateLimiting: {
                    windowMs: deploymentConfig.security.rateLimiting.windowMs,
                    maxRequests: deploymentConfig.security.rateLimiting.maxRequests
                }
            },
            monitoring: {
                reportInterval: deploymentConfig.monitoring.reportInterval,
                historyRetention: deploymentConfig.monitoring.historyRetention
            },
            logging: {
                level: deploymentConfig.logging.level,
                auditRetention: deploymentConfig.logging.auditRetention
            }
        };
    }
    /**
     * Generate configuration template
     */
    generateTemplate(environment) {
        const config = DEFAULT_CONFIGS[environment];
        return JSON.stringify(config, null, 2);
    }
    /**
     * Validate configuration
     */
    validateConfig(config) {
        const errors = [];
        // Validate ports
        if (config.services.websocket.port < 1 || config.services.websocket.port > 65535) {
            errors.push('WebSocket port must be between 1 and 65535');
        }
        if (config.services.http.enabled &&
            (config.services.http.port < 1 || config.services.http.port > 65535)) {
            errors.push('HTTP port must be between 1 and 65535');
        }
        // Validate SSL configuration
        if (config.services.websocket.ssl?.enabled) {
            if (!config.services.websocket.ssl.certPath) {
                errors.push('SSL certificate path is required when SSL is enabled');
            }
            if (!config.services.websocket.ssl.keyPath) {
                errors.push('SSL private key path is required when SSL is enabled');
            }
        }
        // Validate security settings
        if (config.security.tokenExpiry < 60) {
            errors.push('Token expiry must be at least 60 seconds');
        }
        if (config.security.maxConnections < 1) {
            errors.push('Maximum connections must be at least 1');
        }
        // Validate monitoring settings
        if (config.monitoring.reportInterval < 10) {
            errors.push('Report interval must be at least 10 seconds');
        }
        if (config.monitoring.historyRetention < 1) {
            errors.push('History retention must be at least 1 day');
        }
        // Validate performance settings
        if (config.performance.caching.maxSize < 10) {
            errors.push('Cache max size must be at least 10');
        }
        if (config.performance.connectionPool.enabled) {
            if (config.performance.connectionPool.minConnections < 1) {
                errors.push('Minimum connections must be at least 1');
            }
            if (config.performance.connectionPool.maxConnections < config.performance.connectionPool.minConnections) {
                errors.push('Maximum connections must be greater than or equal to minimum connections');
            }
        }
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    loadConfigFromFile() {
        if (!(0, fs_1.existsSync)(this.configPath)) {
            return {};
        }
        try {
            const configData = (0, fs_1.readFileSync)(this.configPath, 'utf8');
            return JSON.parse(configData);
        }
        catch (error) {
            console.warn(`Failed to load config from ${this.configPath}:`, error);
            return {};
        }
    }
    mergeConfigs(defaultConfig, fileConfig) {
        return this.deepMerge(defaultConfig, fileConfig);
    }
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    }
    ensureConfigDirectory() {
        const dir = (0, path_1.dirname)(this.configPath);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
    }
}
exports.DeploymentConfigManager = DeploymentConfigManager;
// ============================================================================
// Environment Detection
// ============================================================================
class EnvironmentDetector {
    /**
     * Detect current environment from various sources
     */
    static detectEnvironment() {
        // Check NODE_ENV first
        const nodeEnv = process.env.NODE_ENV?.toLowerCase();
        if (nodeEnv === 'production')
            return 'production';
        if (nodeEnv === 'staging')
            return 'staging';
        if (nodeEnv === 'development')
            return 'development';
        // Check MOCHI_ENV
        const mochiEnv = process.env.MOCHI_ENV?.toLowerCase();
        if (mochiEnv === 'production')
            return 'production';
        if (mochiEnv === 'staging')
            return 'staging';
        if (mochiEnv === 'development')
            return 'development';
        // Check for production indicators
        if (process.env.PM2_HOME || process.env.DOCKER_CONTAINER) {
            return 'production';
        }
        // Default to development
        return 'development';
    }
    /**
     * Check if running in Docker
     */
    static isDocker() {
        return !!process.env.DOCKER_CONTAINER || (0, fs_1.existsSync)('/.dockerenv');
    }
    /**
     * Check if running with PM2
     */
    static isPM2() {
        return !!process.env.PM2_HOME;
    }
    /**
     * Get deployment info
     */
    static getDeploymentInfo() {
        return {
            environment: this.detectEnvironment(),
            isDocker: this.isDocker(),
            isPM2: this.isPM2(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };
    }
}
exports.EnvironmentDetector = EnvironmentDetector;
// ============================================================================
// Configuration Utilities
// ============================================================================
class ConfigurationUtils {
    /**
     * Generate environment-specific configuration
     */
    static generateConfig(environment) {
        const config = { ...DEFAULT_CONFIGS[environment] };
        config.buildTime = new Date().toISOString();
        return config;
    }
    /**
     * Override configuration with environment variables
     */
    static applyEnvironmentOverrides(config) {
        const overrideConfig = { ...config };
        // WebSocket overrides
        if (process.env.MOCHI_WS_PORT) {
            overrideConfig.services.websocket.port = parseInt(process.env.MOCHI_WS_PORT);
        }
        if (process.env.MOCHI_WS_HOST) {
            overrideConfig.services.websocket.host = process.env.MOCHI_WS_HOST;
        }
        // HTTP overrides
        if (process.env.MOCHI_HTTP_PORT) {
            overrideConfig.services.http.port = parseInt(process.env.MOCHI_HTTP_PORT);
        }
        if (process.env.MOCHI_HTTP_HOST) {
            overrideConfig.services.http.host = process.env.MOCHI_HTTP_HOST;
        }
        // Database overrides
        if (process.env.MOCHI_DB_PREFIX) {
            overrideConfig.services.database.prefix = process.env.MOCHI_DB_PREFIX;
        }
        // Security overrides
        if (process.env.MOCHI_TOKEN_EXPIRY) {
            overrideConfig.security.tokenExpiry = parseInt(process.env.MOCHI_TOKEN_EXPIRY);
        }
        if (process.env.MOCHI_MAX_CONNECTIONS) {
            overrideConfig.security.maxConnections = parseInt(process.env.MOCHI_MAX_CONNECTIONS);
        }
        // Logging overrides
        if (process.env.MOCHI_LOG_LEVEL) {
            overrideConfig.logging.level = process.env.MOCHI_LOG_LEVEL;
        }
        return overrideConfig;
    }
    /**
     * Validate environment variables
     */
    static validateEnvironmentVariables() {
        const errors = [];
        // Check required environment variables for production
        if (EnvironmentDetector.detectEnvironment() === 'production') {
            const required = [
                'MOCHI_WS_PORT',
                'MOCHI_HTTP_PORT',
                'MOCHI_DB_PREFIX'
            ];
            for (const envVar of required) {
                if (!process.env[envVar]) {
                    errors.push(`Required environment variable ${envVar} is not set`);
                }
            }
        }
        // Validate port numbers
        const portVars = ['MOCHI_WS_PORT', 'MOCHI_HTTP_PORT'];
        for (const portVar of portVars) {
            if (process.env[portVar]) {
                const port = parseInt(process.env[portVar]);
                if (isNaN(port) || port < 1 || port > 65535) {
                    errors.push(`${portVar} must be a valid port number (1-65535)`);
                }
            }
        }
        // Validate log level
        if (process.env.MOCHI_LOG_LEVEL) {
            const validLevels = ['debug', 'info', 'warn', 'error'];
            if (!validLevels.includes(process.env.MOCHI_LOG_LEVEL)) {
                errors.push(`MOCHI_LOG_LEVEL must be one of: ${validLevels.join(', ')}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
exports.ConfigurationUtils = ConfigurationUtils;
