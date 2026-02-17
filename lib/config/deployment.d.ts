/**
 * Deployment Configuration Management
 *
 * This module handles deployment configuration, environment setup,
 * and configuration validation for the Mochi-Link system.
 */
import { PluginConfig } from '../types';
export type DeploymentEnvironment = 'development' | 'staging' | 'production';
export interface DeploymentConfig {
    environment: DeploymentEnvironment;
    version: string;
    buildTime: string;
    services: {
        websocket: {
            enabled: boolean;
            port: number;
            host: string;
            ssl?: {
                enabled: boolean;
                certPath?: string;
                keyPath?: string;
            };
        };
        http: {
            enabled: boolean;
            port: number;
            host: string;
            cors: boolean;
        };
        database: {
            prefix: string;
            connectionTimeout: number;
            queryTimeout: number;
        };
    };
    security: {
        tokenExpiry: number;
        maxConnections: number;
        rateLimiting: {
            enabled: boolean;
            windowMs: number;
            maxRequests: number;
        };
        encryption: {
            enabled: boolean;
            algorithm: string;
        };
    };
    monitoring: {
        enabled: boolean;
        reportInterval: number;
        historyRetention: number;
        healthCheck: {
            interval: number;
            timeout: number;
        };
        metrics: {
            enabled: boolean;
            interval: number;
            retention: number;
        };
    };
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        auditRetention: number;
        fileLogging: {
            enabled: boolean;
            path?: string;
            maxSize?: string;
            maxFiles?: number;
        };
    };
    performance: {
        caching: {
            enabled: boolean;
            maxSize: number;
            ttl: number;
        };
        connectionPool: {
            enabled: boolean;
            minConnections: number;
            maxConnections: number;
            idleTimeout: number;
        };
        optimization: {
            enabled: boolean;
            queryCache: boolean;
            compression: boolean;
        };
    };
}
export declare class DeploymentConfigManager {
    private currentConfig?;
    private configPath;
    constructor(configPath?: string);
    /**
     * Load configuration for the specified environment
     */
    loadConfig(environment: DeploymentEnvironment): DeploymentConfig;
    /**
     * Save current configuration to file
     */
    saveConfig(config: DeploymentConfig): void;
    /**
     * Get current configuration
     */
    getCurrentConfig(): DeploymentConfig | undefined;
    /**
     * Convert deployment config to plugin config
     */
    toPluginConfig(deploymentConfig: DeploymentConfig): PluginConfig;
    /**
     * Generate configuration template
     */
    generateTemplate(environment: DeploymentEnvironment): string;
    /**
     * Validate configuration
     */
    validateConfig(config: DeploymentConfig): void;
    private loadConfigFromFile;
    private mergeConfigs;
    private deepMerge;
    private ensureConfigDirectory;
}
export declare class EnvironmentDetector {
    /**
     * Detect current environment from various sources
     */
    static detectEnvironment(): DeploymentEnvironment;
    /**
     * Check if running in Docker
     */
    static isDocker(): boolean;
    /**
     * Check if running with PM2
     */
    static isPM2(): boolean;
    /**
     * Get deployment info
     */
    static getDeploymentInfo(): {
        environment: DeploymentEnvironment;
        isDocker: boolean;
        isPM2: boolean;
        nodeVersion: string;
        platform: string;
        arch: string;
    };
}
export declare class ConfigurationUtils {
    /**
     * Generate environment-specific configuration
     */
    static generateConfig(environment: DeploymentEnvironment): DeploymentConfig;
    /**
     * Override configuration with environment variables
     */
    static applyEnvironmentOverrides(config: DeploymentConfig): DeploymentConfig;
    /**
     * Validate environment variables
     */
    static validateEnvironmentVariables(): {
        valid: boolean;
        errors: string[];
    };
}
