import * as fs from 'fs';
import * as path from 'path';

/**
 * LLBDS Configuration Manager
 * 
 * Manages configuration for the LLBDS connector including
 * server settings, network configuration, and security options.
 * 
 * @author chm413
 * @version 1.0.0
 */
export class LLBDSConfig {
    private config: any = {};
    private configPath: string;
    
    constructor(configPath?: string) {
        this.configPath = configPath || './config/llbds-config.json';
        this.loadDefaults();
    }
    
    /**
     * Load configuration from file
     */
    public async load(): Promise<void> {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const fileConfig = JSON.parse(configData);
                this.config = { ...this.config, ...fileConfig };
            } else {
                // Create default config file
                await this.save();
            }
        } catch (error) {
            console.warn('Failed to load LLBDS config, using defaults:', error);
        }
    }
    
    /**
     * Save configuration to file
     */
    public async save(): Promise<void> {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Failed to save LLBDS config:', error);
        }
    }
    
    /**
     * Load default configuration
     */
    private loadDefaults(): void {
        this.config = {
            server: {
                id: 'llbds-server-1',
                name: 'LLBDS Server',
                description: 'LiteLoaderBDS Server managed by Mochi-Link'
            },
            network: {
                httpPort: 25580,
                externalServicePort: 25581,
                mochiLinkHost: 'localhost',
                mochiLinkPort: 8080,
                mochiLinkPath: '/ws',
                ssl: false,
                timeout: 30000,
                retryAttempts: 5,
                retryDelay: 5000
            },
            authentication: {
                token: '',
                serverId: '',
                encryptionKey: ''
            },
            commands: {
                whitelist: [
                    'list',
                    'say',
                    'tell',
                    'time',
                    'weather',
                    'tp',
                    'gamemode',
                    'give',
                    'effect',
                    'summon',
                    'kill',
                    'kick',
                    'ban',
                    'pardon',
                    'whitelist',
                    'op',
                    'deop'
                ],
                blacklist: [
                    'stop',
                    'restart',
                    'reload',
                    'save-all',
                    'save-off',
                    'save-on'
                ]
            },
            monitoring: {
                enabled: true,
                interval: 30000,
                collectSystemInfo: true,
                collectPlayerInfo: true,
                collectPerformanceInfo: true
            },
            logging: {
                level: 'info',
                file: './logs/llbds-connector.log',
                maxSize: '10MB',
                maxFiles: 5
            }
        };
    }
    
    // Getter methods
    public getServerId(): string {
        return this.config.server?.id || 'llbds-server-1';
    }
    
    public getServerName(): string {
        return this.config.server?.name || 'LLBDS Server';
    }
    
    public getHttpPort(): number {
        return this.config.network?.httpPort || 25580;
    }
    
    public getExternalServicePort(): number {
        return this.config.network?.externalServicePort || 25581;
    }
    
    public getMochiLinkHost(): string {
        return this.config.network?.mochiLinkHost || 'localhost';
    }
    
    public getMochiLinkPort(): number {
        return this.config.network?.mochiLinkPort || 8080;
    }
    
    public getMochiLinkPath(): string {
        return this.config.network?.mochiLinkPath || '/ws';
    }
    
    public getAuthToken(): string {
        return this.config.authentication?.token || '';
    }
    
    public getCommandWhitelist(): string[] {
        return this.config.commands?.whitelist || [];
    }
    
    public getCommandBlacklist(): string[] {
        return this.config.commands?.blacklist || [];
    }
    
    public isMonitoringEnabled(): boolean {
        return this.config.monitoring?.enabled !== false;
    }
    
    public getMonitoringInterval(): number {
        return this.config.monitoring?.interval || 30000;
    }
    
    public getTimeout(): number {
        return this.config.network?.timeout || 30000;
    }
    
    public getRetryAttempts(): number {
        return this.config.network?.retryAttempts || 5;
    }
    
    public getRetryDelay(): number {
        return this.config.network?.retryDelay || 5000;
    }
    
    // Setter methods
    public setServerId(serverId: string): void {
        if (!this.config.server) this.config.server = {};
        this.config.server.id = serverId;
    }
    
    public setAuthToken(token: string): void {
        if (!this.config.authentication) this.config.authentication = {};
        this.config.authentication.token = token;
    }
    
    public setMochiLinkConnection(host: string, port: number, path?: string): void {
        if (!this.config.network) this.config.network = {};
        this.config.network.mochiLinkHost = host;
        this.config.network.mochiLinkPort = port;
        if (path) this.config.network.mochiLinkPath = path;
    }
    
    /**
     * Get full configuration object
     */
    public getConfig(): any {
        return { ...this.config };
    }
    
    /**
     * Update configuration
     */
    public updateConfig(updates: any): void {
        this.config = { ...this.config, ...updates };
    }
}