/**
 * LLBDS Performance Monitor
 *
 * Monitors LLBDS server performance metrics and system information
 * for transmission to the Mochi-Link management system.
 *
 * @author chm413
 * @version 1.0.0
 */
export declare class LLBDSPerformanceMonitor {
    private isMonitoring;
    private monitoringInterval;
    private intervalMs;
    private performanceData;
    private lastUpdate;
    constructor(intervalMs?: number);
    /**
     * Start performance monitoring
     */
    start(): void;
    /**
     * Stop performance monitoring
     */
    stop(): void;
    /**
     * Collect current performance data
     */
    private collectPerformanceData;
    /**
     * Collect server information
     */
    private collectServerInfo;
    /**
     * Collect player information
     */
    private collectPlayerInfo;
    /**
     * Collect system information
     */
    private collectSystemInfo;
    /**
     * Collect performance metrics
     */
    private collectPerformanceMetrics;
    /**
     * Get CPU usage (approximation)
     */
    private getCPUUsage;
    /**
     * Group players by device type
     */
    private groupPlayersByDevice;
    /**
     * Group players by gamemode
     */
    private groupPlayersByGamemode;
    /**
     * Get current performance data
     */
    getPerformanceData(): any;
    /**
     * Get last update timestamp
     */
    getLastUpdate(): number;
    /**
     * Check if monitoring is active
     */
    isActive(): boolean;
    /**
     * Set monitoring interval
     */
    setInterval(intervalMs: number): void;
    /**
     * Get monitoring interval
     */
    getInterval(): number;
    /**
     * Force immediate data collection
     */
    forceUpdate(): void;
}
//# sourceMappingURL=LLBDSPerformanceMonitor.d.ts.map