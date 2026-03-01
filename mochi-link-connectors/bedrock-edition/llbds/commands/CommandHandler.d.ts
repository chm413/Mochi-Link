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
export declare class CommandHandler {
    private connectionManager;
    private config;
    private logger;
    constructor(connectionManager: MochiLinkConnectionManager, config: LLBDSConfig, logger: winston.Logger);
    /**
     * Handle command
     */
    handleCommand(command: string, args: string[]): Promise<string>;
    /**
     * Handle status command
     */
    private handleStatus;
    /**
     * Handle reconnect command
     */
    private handleReconnect;
    /**
     * Handle info command
     */
    private handleInfo;
    /**
     * Handle stats command
     */
    private handleStats;
    /**
     * Handle config command
     */
    private handleConfig;
    /**
     * Show all config values
     */
    private showAllConfig;
    /**
     * Get config value
     */
    private getConfigValue;
    /**
     * Set config value
     */
    private setConfigValue;
    /**
     * Handle reload command
     */
    private handleReload;
    /**
     * Handle subscriptions command
     */
    private handleSubscriptions;
    /**
     * Handle reconnection control command
     */
    private handleReconnectionControl;
    /**
     * Handle help command
     */
    private handleHelp;
    /**
     * Format uptime
     */
    private formatUptime;
}
//# sourceMappingURL=CommandHandler.d.ts.map