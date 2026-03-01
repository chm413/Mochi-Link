import { MochiLinkConnectionManager } from '../network/MochiLinkConnectionManager';
import { LLBDSConfig } from '../config/LLBDSConfig';
import * as winston from 'winston';

/**
 * Command Handler for LLBDS
 * 
 * Handles console commands and HTTP API requests for managing the connector.
 * 
 * @author chm413
 * @version 2.1.0
 */
export class CommandHandler {
    private connectionManager: MochiLinkConnectionManager;
    private config: LLBDSConfig;
    private logger: winston.Logger;
    
    constructor(connectionManager: MochiLinkConnectionManager, config: LLBDSConfig, logger: winston.Logger) {
        this.connectionManager = connectionManager;
        this.config = config;
        this.logger = logger;
    }
    
    /**
     * Handle command
     */
    public async handleCommand(command: string, args: string[]): Promise<string> {
        const subcommand = command.toLowerCase();
        
        switch (subcommand) {
            case 'status':
                return this.handleStatus();
                
            case 'reconnect':
            case 'retry':
                return this.handleReconnect();
                
            case 'info':
                return this.handleInfo();
                
            case 'stats':
                return this.handleStats();
                
            case 'config':
                return this.handleConfig(args);
                
            case 'reload':
                return this.handleReload();
                
            case 'subscriptions':
            case 'subs':
                return this.handleSubscriptions();
                
            case 'reconnection':
            case 'recon':
                return this.handleReconnectionControl(args);
                
            case 'help':
                return this.handleHelp();
                
            default:
                return `Unknown command: ${subcommand}\n${this.handleHelp()}`;
        }
    }
    
    /**
     * Handle status command
     */
    private handleStatus(): string {
        const connected = this.connectionManager.isConnected();
        const status = this.connectionManager.getConnectionStatus();
        const stats = this.connectionManager.getConnectionStats();
        
        let output = '=== MochiLink LLBDS Status ===\n';
        output += `Service: Running\n`;
        output += `Connection: ${connected ? 'Connected' : 'Disconnected'} (${status})\n`;
        output += `Queued Messages: ${stats.queuedMessages}\n`;
        output += `Pending Messages: ${stats.pendingMessages}\n`;
        
        if (stats.reconnectAttempts !== undefined) {
            output += `Reconnect Attempts: ${stats.reconnectAttempts}/${stats.totalReconnectAttempts}\n`;
            output += `Reconnection: ${stats.reconnectionDisabled ? 'Disabled' : 'Enabled'}\n`;
        }
        
        return output;
    }
    
    /**
     * Handle reconnect command
     */
    private handleReconnect(): string {
        this.logger.info('Manual reconnection requested');
        
        // 如果重连被禁用，先启用它
        const reconStatus = this.connectionManager.getReconnectionStatus();
        if (reconStatus.disabled) {
            this.connectionManager.enableReconnection();
            this.logger.info('Reconnection re-enabled');
        }
        
        this.connectionManager.connect();
        
        return 'Reconnecting to Mochi-Link management server...\nReconnection initiated!';
    }
    
    /**
     * Handle info command
     */
    private handleInfo(): string {
        let output = '=== MochiLink LLBDS Info ===\n';
        output += `Version: 2.1.0\n`;
        output += `Protocol: U-WBP v2.0\n`;
        output += `Server Type: LLBDS\n`;
        output += `Server ID: ${this.config.getServerId()}\n`;
        output += `Server Name: ${this.config.getServerName()}\n`;
        output += `Management Host: ${this.config.getMochiLinkHost()}:${this.config.getMochiLinkPort()}\n`;
        output += `Auto Reconnect: ${this.config.getRetryAttempts() > 0 ? 'Enabled' : 'Disabled'}\n`;
        output += `Max Retry Attempts: ${this.config.getRetryAttempts()}\n`;
        
        return output;
    }
    
    /**
     * Handle stats command
     */
    private handleStats(): string {
        const stats = this.connectionManager.getConnectionStats();
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        let output = '=== Service Statistics ===\n';
        output += `Connection: ${stats.connected ? 'Connected' : 'Disconnected'}\n`;
        output += `Queued Messages: ${stats.queuedMessages}\n`;
        output += `Pending Messages: ${stats.pendingMessages}\n`;
        output += `Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB\n`;
        output += `Uptime: ${this.formatUptime(uptime)}\n`;
        
        return output;
    }
    
    /**
     * Handle config command
     */
    private handleConfig(args: string[]): string {
        if (args.length === 0) {
            return 'Usage: config <get|set> [key] [value]';
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'get':
                if (args.length === 1) {
                    return this.showAllConfig();
                } else {
                    return this.getConfigValue(args[1]);
                }
                
            case 'set':
                if (args.length < 3) {
                    return 'Usage: config set <key> <value>';
                }
                return this.setConfigValue(args[1], args[2]);
                
            default:
                return `Unknown config action: ${action}\nAvailable actions: get, set`;
        }
    }
    
    /**
     * Show all config values
     */
    private showAllConfig(): string {
        let output = '=== MochiLink Configuration ===\n';
        output += `server-id: ${this.config.getServerId()}\n`;
        output += `server-name: ${this.config.getServerName()}\n`;
        output += `host: ${this.config.getMochiLinkHost()}\n`;
        output += `port: ${this.config.getMochiLinkPort()}\n`;
        output += `retry-attempts: ${this.config.getRetryAttempts()}\n`;
        output += `retry-delay: ${this.config.getRetryDelay()}ms\n`;
        
        return output;
    }
    
    /**
     * Get config value
     */
    private getConfigValue(key: string): string {
        const value = (this.config as any)[key];
        
        if (value === undefined) {
            return `Unknown config key: ${key}`;
        }
        
        return `${key}: ${value}`;
    }
    
    /**
     * Set config value
     */
    private setConfigValue(key: string, value: string): string {
        return `Setting ${key} to ${value}...\nNote: Config changes require service restart to take effect\nPlease edit config.json manually and restart the service`;
    }
    
    /**
     * Handle reload command
     */
    private handleReload(): string {
        return 'Reloading configuration...\nNote: LLBDS connector requires service restart to reload configuration\nPlease restart the service manually';
    }
    
    /**
     * Handle subscriptions command
     */
    private handleSubscriptions(): string {
        // LLBDS doesn't have a subscription manager in the same way
        // This would need to be implemented based on the actual architecture
        return '=== Active Event Subscriptions ===\nSubscription management not available in LLBDS connector\nSubscriptions are managed by the management server';
    }
    
    /**
     * Handle reconnection control command
     */
    private handleReconnectionControl(args: string[]): string {
        if (args.length === 0) {
            // 显示重连状态
            const status = this.connectionManager.getReconnectionStatus();
            
            let output = '=== Reconnection Status ===\n';
            output += `Enabled: ${status.disabled ? 'No' : 'Yes'}\n`;
            output += `Currently Reconnecting: ${status.isReconnecting ? 'Yes' : 'No'}\n`;
            output += `Current Attempts: ${status.currentAttempts}\n`;
            output += `Total Attempts: ${status.totalAttempts}\n`;
            output += `Next Interval: ${status.nextInterval}ms\n`;
            
            if (status.lastAttemptTime > 0) {
                output += `Last Attempt: ${new Date(status.lastAttemptTime).toLocaleString()}\n`;
            }
            
            return output;
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'enable':
                this.connectionManager.enableReconnection();
                return 'Reconnection enabled!';
                
            case 'disable':
                this.connectionManager.disableReconnection();
                return 'Reconnection disabled!';
                
            case 'status':
                return this.handleReconnectionControl([]);
                
            default:
                return `Unknown action: ${action}\nAvailable actions: enable, disable, status`;
        }
    }
    
    /**
     * Handle help command
     */
    private handleHelp(): string {
        let output = '=== MochiLink LLBDS Commands ===\n';
        output += 'status - Check connection status\n';
        output += 'reconnect - Manually retry connection\n';
        output += 'info - Show service information\n';
        output += 'stats - Show service statistics\n';
        output += 'config <get|set> - Manage configuration\n';
        output += 'reload - Reload configuration (requires restart)\n';
        output += 'subscriptions - List event subscriptions\n';
        output += 'reconnection <enable|disable|status> - Control reconnection\n';
        output += 'help - Show this help message\n';
        
        return output;
    }
    
    /**
     * Format uptime
     */
    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }
}
