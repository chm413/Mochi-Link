import * as winston from 'winston';
/**
 * External Performance Monitor
 *
 * Monitors system performance from the external Node.js service
 * to provide comprehensive system metrics without impacting LLBDS performance.
 *
 * @author chm413
 * @version 1.0.0
 */
export declare class ExternalPerformanceMonitor {
    private logger;
    private isMonitoring;
    private monitoringInterval;
    private intervalMs;
    private systemData;
    private lastUpdate;
    constructor(logger: winston.Logger, intervalMs?: number);
    /**
     * Start system monitoring
     */
    start(): Promise<void>;
    /**
     * Stop system monitoring
     */
    stop(): void;
    /**
     * Collect comprehensive system information
     */
    collectSystemInfo(): Promise<any>;
    /**
     * Get CPU information
     */
    private getCPUInfo;
    /**
     * Get CPU temperature
     */
    private getCPUTemperature;
    /**
     * Get memory information
     */
    private getMemoryInfo;
    /**
     * Get disk information
     */
    private getDiskInfo;
    /**
     * Get network information
     */
    private getNetworkInfo;
    /**
     * Get process information
     */
    private getProcessInfo;
    /**
     * Get OS information
     */
    private getOSInfo;
    /**
     * Get system load information
     */
    private getLoadInfo;
    /**
     * Get current system data
     */
    getSystemData(): any;
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
    forceUpdate(): Promise<any>;
}
//# sourceMappingURL=ExternalPerformanceMonitor.d.ts.map