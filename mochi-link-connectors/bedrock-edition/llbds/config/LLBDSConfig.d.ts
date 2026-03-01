/**
 * LLBDS Configuration Manager
 *
 * Manages configuration for the LLBDS connector including
 * server settings, network configuration, and security options.
 *
 * @author chm413
 * @version 1.0.0
 */
export declare class LLBDSConfig {
    private config;
    private configPath;
    constructor(configPath?: string);
    /**
     * Load configuration from file
     */
    load(): Promise<void>;
    /**
     * Save configuration to file
     */
    save(): Promise<void>;
    /**
     * Load default configuration
     */
    private loadDefaults;
    getServerId(): string;
    getServerName(): string;
    getHttpPort(): number;
    getExternalServicePort(): number;
    getMochiLinkHost(): string;
    getMochiLinkPort(): number;
    getMochiLinkPath(): string;
    getAuthToken(): string;
    getCommandWhitelist(): string[];
    getCommandBlacklist(): string[];
    isMonitoringEnabled(): boolean;
    getMonitoringInterval(): number;
    getTimeout(): number;
    getRetryAttempts(): number;
    getRetryDelay(): number;
    setServerId(serverId: string): void;
    setAuthToken(token: string): void;
    setMochiLinkConnection(host: string, port: number, path?: string): void;
    /**
     * Get full configuration object
     */
    getConfig(): any;
    /**
     * Update configuration
     */
    updateConfig(updates: any): void;
}
//# sourceMappingURL=LLBDSConfig.d.ts.map