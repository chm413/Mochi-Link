/**
 * Mochi-Link External Network Service for LLBDS
 *
 * This service runs as a separate Node.js process to handle all network
 * communication with the Mochi-Link management system, avoiding any
 * performance impact on the Minecraft server core.
 *
 * Architecture:
 * LLBDS Server -> LSE Plugin -> HTTP API -> This Service -> Mochi-Link
 *
 * @author chm413
 * @version 1.0.0
 */
declare class MochiLinkExternalService {
    private app;
    private server;
    private config;
    private connectionManager;
    private performanceMonitor;
    private logger;
    private httpPort;
    private lseBridgePort;
    private isRunning;
    private isConnected;
    private serverData;
    private playerData;
    private performanceData;
    constructor();
    /**
     * Initialize Winston logger
     */
    private initializeLogger;
    /**
     * Initialize Express application
     */
    private initializeExpress;
    /**
     * Setup Express routes
     */
    private setupRoutes;
    /**
     * Start the external service
     */
    start(): Promise<void>;
    /**
     * Start connection to Mochi-Link management system
     */
    private startMochiLinkConnection;
    /**
     * Setup Mochi-Link message handlers
     */
    private setupMochiLinkHandlers;
    /**
     * Handle messages from Mochi-Link
     */
    private handleMochiLinkMessage;
    /**
     * Handle server status request
     */
    private handleServerStatusRequest;
    /**
     * Handle player list request
     */
    private handlePlayerListRequest;
    /**
     * Handle command execute request
     */
    private handleCommandExecuteRequest;
    /**
     * Handle performance request
     */
    private handlePerformanceRequest;
    /**
     * Execute command on LLBDS server via LSE bridge
     */
    private executeCommandOnServer;
    /**
     * Forward event to Mochi-Link
     */
    private forwardEventToMochiLink;
    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring;
    /**
     * Start periodic tasks
     */
    private startPeriodicTasks;
    /**
     * Clean up old data
     */
    private cleanupOldData;
    /**
     * Shutdown the service
     */
    shutdown(): Promise<void>;
}
export { MochiLinkExternalService };
//# sourceMappingURL=external-service.d.ts.map