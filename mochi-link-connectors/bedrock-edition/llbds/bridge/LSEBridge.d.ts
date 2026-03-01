import { LLBDSConfig } from '../config/LLBDSConfig';
/**
 * LSE Bridge - Lightweight HTTP API Bridge
 *
 * This class runs inside the LLBDS process and provides a minimal HTTP API
 * for communication with the external Node.js service. It's designed to have
 * minimal performance impact on the Minecraft server.
 *
 * @author chm413
 * @version 1.0.0
 */
export declare class LSEBridge {
    private httpPort;
    private config;
    private server;
    private _isRunning;
    private eventCallbacks;
    private commandQueue;
    private commandResults;
    constructor(port: number, config: LLBDSConfig);
    /**
     * Start the LSE bridge HTTP server
     */
    start(): Promise<void>;
    /**
     * Setup routes for LLBDS HttpServer
     */
    private setupLLBDSRoutes;
    /**
     * Setup fallback HTTP server (if LLBDS HttpServer not available)
     */
    private setupFallbackServer;
    /**
     * Setup network event handlers for fallback communication
     */
    private setupNetworkEventHandlers;
    /**
     * Handle network commands (fallback method)
     */
    private handleNetworkCommand;
    /**
     * Send network response (fallback method)
     */
    private sendNetworkResponse;
    /**
     * Get current server status
     */
    private getServerStatus;
    /**
     * Get current player list
     */
    private getPlayerList;
    /**
     * Execute command on server
     */
    private executeCommand;
    /**
     * Check if command is allowed
     */
    private isCommandAllowed;
    /**
     * Forward event to external service
     */
    forwardEventToExternal(event: any): void;
    /**
     * Send data to external service
     */
    private sendToExternalService;
    /**
     * Register event callback
     */
    on(event: string, callback: Function): void;
    /**
     * Emit event
     */
    emit(event: string, ...args: any[]): void;
    /**
     * Stop the LSE bridge
     */
    stop(): Promise<void>;
    /**
     * Check if bridge is running
     */
    isRunning(): boolean;
    /**
     * Get bridge port
     */
    getPort(): number;
}
//# sourceMappingURL=LSEBridge.d.ts.map