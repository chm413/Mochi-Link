import { LLBDSConfig } from './config/LLBDSConfig';
import { LSEBridge } from './bridge/LSEBridge';
import { LLBDSEventHandler } from './handlers/LLBDSEventHandler';
import { LLBDSCommandHandler } from './handlers/LLBDSCommandHandler';
/**
 * LLBDS LSE Plugin Class (Lightweight Bridge)
 * This class runs inside the LLBDS process and provides minimal overhead
 */
export declare class MochiLinkLLBDSPlugin {
    private lseBridge;
    private eventHandler;
    private commandHandler;
    private config;
    private isEnabled;
    private httpPort;
    constructor();
    /**
     * Initialize the lightweight LSE plugin
     */
    initialize(): Promise<void>;
    /**
     * Start external Node.js service
     */
    private startExternalService;
    /**
     * Check if external service is running
     */
    private checkExternalService;
    /**
     * Cleanup plugin resources
     */
    cleanup(): Promise<void>;
    /**
     * Get plugin configuration
     */
    getConfig(): LLBDSConfig;
    /**
     * Get LSE bridge
     */
    getLSEBridge(): LSEBridge;
    /**
     * Get event handler
     */
    getEventHandler(): LLBDSEventHandler;
    /**
     * Get command handler
     */
    getCommandHandler(): LLBDSCommandHandler;
    /**
     * Check if plugin is enabled
     */
    isPluginEnabled(): boolean;
    /**
     * Get connection status
     */
    getConnectionStatus(): string;
}
//# sourceMappingURL=index.d.ts.map