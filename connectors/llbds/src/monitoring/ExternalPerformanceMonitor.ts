import * as si from 'systeminformation';
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
export class ExternalPerformanceMonitor {
    private logger: winston.Logger;
    private isMonitoring: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private intervalMs: number = 30000; // 30 seconds
    
    private systemData: any = {};
    private lastUpdate: number = 0;
    
    constructor(logger: winston.Logger, intervalMs?: number) {
        this.logger = logger;
        if (intervalMs) {
            this.intervalMs = intervalMs;
        }
    }
    
    /**
     * Start system monitoring
     */
    public async start(): Promise<void> {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        
        // Collect initial data
        await this.collectSystemInfo();
        
        // Start periodic collection
        this.monitoringInterval = setInterval(async () => {
            await this.collectSystemInfo();
        }, this.intervalMs);
        
        this.logger.info('External performance monitoring started');
    }
    
    /**
     * Stop system monitoring
     */
    public stop(): void {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.logger.info('External performance monitoring stopped');
    }
    
    /**
     * Collect comprehensive system information
     */
    public async collectSystemInfo(): Promise<any> {
        try {
            const now = Date.now();
            
            // Collect system information in parallel
            const [
                cpu,
                memory,
                disk,
                network,
                processes,
                osInfo,
                load
            ] = await Promise.all([
                this.getCPUInfo(),
                this.getMemoryInfo(),
                this.getDiskInfo(),
                this.getNetworkInfo(),
                this.getProcessInfo(),
                this.getOSInfo(),
                this.getLoadInfo()
            ]);
            
            this.systemData = {
                timestamp: now,
                cpu,
                memory,
                disk,
                network,
                processes,
                os: osInfo,
                load,
                uptime: process.uptime()
            };
            
            this.lastUpdate = now;
            
            this.logger.debug('System information collected successfully');
            
            return this.systemData;
            
        } catch (error) {
            this.logger.error('Failed to collect system information:', error);
            return this.systemData;
        }
    }
    
    /**
     * Get CPU information
     */
    private async getCPUInfo(): Promise<any> {
        try {
            const [cpuInfo, currentLoad] = await Promise.all([
                si.cpu(),
                si.currentLoad()
            ]);
            
            return {
                manufacturer: cpuInfo.manufacturer || 'Unknown',
                brand: cpuInfo.brand || 'Unknown',
                speed: cpuInfo.speed || 0,
                cores: cpuInfo.cores || 1,
                physicalCores: cpuInfo.physicalCores || 1,
                processors: cpuInfo.processors || 1,
                usage: {
                    total: Math.round(currentLoad.currentLoad || 0),
                    user: Math.round(currentLoad.currentLoadUser || 0),
                    system: Math.round(currentLoad.currentLoadSystem || 0),
                    idle: Math.round(currentLoad.currentLoadIdle || 0)
                },
                temperature: await this.getCPUTemperature()
            };
        } catch (error) {
            this.logger.error('Failed to get CPU info:', error);
            return {
                manufacturer: 'Unknown',
                brand: 'Unknown',
                speed: 0,
                cores: 1,
                usage: { total: 0, user: 0, system: 0, idle: 100 },
                temperature: 0
            };
        }
    }
    
    /**
     * Get CPU temperature
     */
    private async getCPUTemperature(): Promise<number> {
        try {
            const temp = await si.cpuTemperature();
            return Math.round(temp.main || 0);
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Get memory information
     */
    private async getMemoryInfo(): Promise<any> {
        try {
            const memory = await si.mem();
            
            return {
                total: Math.round(memory.total / 1024 / 1024), // MB
                used: Math.round(memory.used / 1024 / 1024), // MB
                free: Math.round(memory.free / 1024 / 1024), // MB
                available: Math.round(memory.available / 1024 / 1024), // MB
                percentage: Math.round((memory.used / memory.total) * 100),
                swap: {
                    total: Math.round(memory.swaptotal / 1024 / 1024), // MB
                    used: Math.round(memory.swapused / 1024 / 1024), // MB
                    free: Math.round(memory.swapfree / 1024 / 1024), // MB
                    percentage: memory.swaptotal > 0 ? 
                        Math.round((memory.swapused / memory.swaptotal) * 100) : 0
                }
            };
        } catch (error) {
            this.logger.error('Failed to get memory info:', error);
            return {
                total: 0,
                used: 0,
                free: 0,
                available: 0,
                percentage: 0,
                swap: { total: 0, used: 0, free: 0, percentage: 0 }
            };
        }
    }
    
    /**
     * Get disk information
     */
    private async getDiskInfo(): Promise<any> {
        try {
            const disks = await si.fsSize();
            
            const diskInfo = disks.map(disk => ({
                filesystem: disk.fs || 'Unknown',
                type: disk.type || 'Unknown',
                mount: disk.mount || '/',
                size: Math.round(disk.size / 1024 / 1024 / 1024), // GB
                used: Math.round(disk.used / 1024 / 1024 / 1024), // GB
                available: Math.round(disk.available / 1024 / 1024 / 1024), // GB
                percentage: Math.round(disk.use || 0)
            }));
            
            // Calculate totals
            const totalSize = diskInfo.reduce((sum, disk) => sum + disk.size, 0);
            const totalUsed = diskInfo.reduce((sum, disk) => sum + disk.used, 0);
            const totalAvailable = diskInfo.reduce((sum, disk) => sum + disk.available, 0);
            
            return {
                disks: diskInfo,
                total: {
                    size: totalSize,
                    used: totalUsed,
                    available: totalAvailable,
                    percentage: totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0
                }
            };
        } catch (error) {
            this.logger.error('Failed to get disk info:', error);
            return {
                disks: [],
                total: { size: 0, used: 0, available: 0, percentage: 0 }
            };
        }
    }
    
    /**
     * Get network information
     */
    private async getNetworkInfo(): Promise<any> {
        try {
            const [interfaces, stats] = await Promise.all([
                si.networkInterfaces(),
                si.networkStats()
            ]);
            
            const networkInterfaces = interfaces.map(iface => ({
                name: iface.iface || 'Unknown',
                type: iface.type || 'Unknown',
                speed: iface.speed || 0,
                ip4: iface.ip4 || '',
                ip6: iface.ip6 || '',
                mac: iface.mac || '',
                internal: iface.internal || false,
                virtual: iface.virtual || false,
                operstate: iface.operstate || 'unknown'
            }));
            
            const networkStats = stats.map(stat => ({
                interface: stat.iface || 'Unknown',
                bytesReceived: stat.rx_bytes || 0,
                bytesSent: stat.tx_bytes || 0,
                packetsReceived: stat.rx_sec || 0,
                packetsSent: stat.tx_sec || 0,
                errorsReceived: stat.rx_errors || 0,
                errorsSent: stat.tx_errors || 0,
                droppedReceived: stat.rx_dropped || 0,
                droppedSent: stat.tx_dropped || 0
            }));
            
            return {
                interfaces: networkInterfaces,
                stats: networkStats
            };
        } catch (error) {
            this.logger.error('Failed to get network info:', error);
            return {
                interfaces: [],
                stats: []
            };
        }
    }
    
    /**
     * Get process information
     */
    private async getProcessInfo(): Promise<any> {
        try {
            const processes = await si.processes();
            
            // Get top processes by CPU and memory usage
            const topCPU = processes.list
                .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
                .slice(0, 10)
                .map(proc => ({
                    pid: proc.pid || 0,
                    name: proc.name || 'Unknown',
                    cpu: Math.round(proc.cpu || 0),
                    memory: Math.round((proc.mem || 0) * 10) / 10,
                    memoryMB: Math.round((proc.memRss || 0) / 1024 / 1024),
                    command: proc.command || ''
                }));
            
            const topMemory = processes.list
                .sort((a, b) => (b.mem || 0) - (a.mem || 0))
                .slice(0, 10)
                .map(proc => ({
                    pid: proc.pid || 0,
                    name: proc.name || 'Unknown',
                    cpu: Math.round(proc.cpu || 0),
                    memory: Math.round((proc.mem || 0) * 10) / 10,
                    memoryMB: Math.round((proc.memRss || 0) / 1024 / 1024),
                    command: proc.command || ''
                }));
            
            return {
                total: processes.all || 0,
                running: processes.running || 0,
                blocked: processes.blocked || 0,
                sleeping: processes.sleeping || 0,
                topCPU,
                topMemory
            };
        } catch (error) {
            this.logger.error('Failed to get process info:', error);
            return {
                total: 0,
                running: 0,
                blocked: 0,
                sleeping: 0,
                topCPU: [],
                topMemory: []
            };
        }
    }
    
    /**
     * Get OS information
     */
    private async getOSInfo(): Promise<any> {
        try {
            const osInfo = await si.osInfo();
            
            return {
                platform: osInfo.platform || 'Unknown',
                distro: osInfo.distro || 'Unknown',
                release: osInfo.release || 'Unknown',
                codename: osInfo.codename || '',
                kernel: osInfo.kernel || 'Unknown',
                arch: osInfo.arch || 'Unknown',
                hostname: osInfo.hostname || 'Unknown',
                logofile: osInfo.logofile || '',
                build: osInfo.build || '',
                servicepack: osInfo.servicepack || ''
            };
        } catch (error) {
            this.logger.error('Failed to get OS info:', error);
            return {
                platform: process.platform || 'Unknown',
                distro: 'Unknown',
                release: 'Unknown',
                arch: process.arch || 'Unknown',
                hostname: require('os').hostname() || 'Unknown'
            };
        }
    }
    
    /**
     * Get system load information
     */
    private async getLoadInfo(): Promise<any> {
        try {
            const load = await si.currentLoad();
            
            return {
                avgload: load.avgLoad || 0,
                currentload: Math.round(load.currentLoad || 0),
                currentload_user: Math.round(load.currentLoadUser || 0),
                currentload_system: Math.round(load.currentLoadSystem || 0),
                currentload_nice: Math.round(load.currentLoadNice || 0),
                currentload_idle: Math.round(load.currentLoadIdle || 0),
                raw_currentload: load.rawCurrentLoad || 0,
                raw_currentload_user: load.rawCurrentLoadUser || 0,
                raw_currentload_system: load.rawCurrentLoadSystem || 0,
                raw_currentload_nice: load.rawCurrentLoadNice || 0,
                raw_currentload_idle: load.rawCurrentLoadIdle || 0
            };
        } catch (error) {
            this.logger.error('Failed to get load info:', error);
            return {
                avgload: 0,
                currentload: 0,
                currentload_user: 0,
                currentload_system: 0,
                currentload_idle: 100
            };
        }
    }
    
    /**
     * Get current system data
     */
    public getSystemData(): any {
        return { ...this.systemData };
    }
    
    /**
     * Get last update timestamp
     */
    public getLastUpdate(): number {
        return this.lastUpdate;
    }
    
    /**
     * Check if monitoring is active
     */
    public isActive(): boolean {
        return this.isMonitoring;
    }
    
    /**
     * Set monitoring interval
     */
    public setInterval(intervalMs: number): void {
        this.intervalMs = intervalMs;
        
        if (this.isMonitoring) {
            this.stop();
            this.start();
        }
    }
    
    /**
     * Get monitoring interval
     */
    public getInterval(): number {
        return this.intervalMs;
    }
    
    /**
     * Force immediate data collection
     */
    public async forceUpdate(): Promise<any> {
        return await this.collectSystemInfo();
    }
}

