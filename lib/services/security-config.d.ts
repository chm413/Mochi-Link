/**
 * Security Configuration Manager
 *
 * Manages security configuration settings and provides defaults
 * for the SecurityControlService
 */
import { Context } from 'koishi';
import { SecurityConfig } from './security';
export declare class SecurityConfigManager {
    private ctx;
    private config;
    constructor(ctx: Context, customConfig?: Partial<SecurityConfig>);
    /**
     * Get current security configuration
     */
    getConfig(): SecurityConfig;
    /**
     * Update security configuration
     */
    updateConfig(newConfig: Partial<SecurityConfig>): void;
    /**
     * Create default security configuration
     */
    private createDefaultConfig;
    /**
     * Deep merge configuration objects
     */
    private mergeConfig;
    /**
     * Validate security configuration
     */
    private validateConfig;
    /**
     * Get configuration for specific environment
     */
    getEnvironmentConfig(environment: 'development' | 'production' | 'testing'): Partial<SecurityConfig>;
}
