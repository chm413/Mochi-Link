/**
 * LLBDS Performance Monitor
 * 
 * Monitors LLBDS server performance metrics and system information
 * for transmission to the Mochi-Link management system.
 * 
 * @author chm413
 * @version 1.0.0
 */
export class LLBDSPerformanceMonitor {
    private isMonitoring: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private intervalMs: number = 30000; // 30 seconds
    
    private performanceData: any = {};
    private lastUpdate: number = 0;
    
    constructor(intervalMs?: number) {
        if (intervalMs) {
            this.intervalMs = intervalMs;
        }
    }
    
    /**
     * Start performance monitoring
     */
    public start(): void {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        
        // Collect initial data
        this.collectPerformanceData();
        
        // Start periodic collection
        this.monitoringInterval = setInterval(() => {
            this.collectPerformanceData();
        }, this.intervalMs);
        
        logger.info('LLBDS performance monitoring started');
        logger.info('LLBDS 性能监控已启动');
    }
    
    /**
     * Stop performance monitoring
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
        
        logger.info('LLBDS performance monitoring stopped');
        logger.info('LLBDS 性能监控已停止');
    }
    
    /**
     * Collect current performance data
     */
    private collectPerformanceData(): void {
        try {
            const now = Date.now();
            
            // Server basic info
            const serverInfo = this.collectServerInfo();
            
            // Player info
            const playerInfo = this.collectPlayerInfo();
            
            // System info
            const systemInfo = this.collectSystemInfo();
            
            // Performance metrics
            const performanceMetrics = this.collectPerformanceMetrics();
            
            this.performanceData = {
                timestamp: now,
                server: serverInfo,
                players: playerInfo,
                system: systemInfo,
                performance: performanceMetrics,
                uptime: process.uptime?.() || 0
            };
            
            this.lastUpdate = now;
            
            logger.debug('Performance data collected successfully');
            
        } catch (error) {
            logger.error('Failed to collect performance data:', error);
        }
    }
    
    /**
     * Collect server information
     */
    private collectServerInfo(): any {
        try {
            return {
                version: mc?.getBDSVersion?.() || 'Unknown',
                online: true,
                tps: mc?.getTPS?.() || 20.0,
                maxPlayers: mc?.getMaxPlayers?.() || 20,
                currentPlayers: mc?.getOnlinePlayers?.()?.length || 0,
                gamemode: 'survival', // LLBDS doesn't provide direct access to default gamemode
                difficulty: 'normal', // LLBDS doesn't provide direct access to difficulty
                worldName: 'Bedrock level' // Default LLBDS world name
            };
        } catch (error) {
            logger.error('Failed to collect server info:', error);
            return {
                version: 'Unknown',
                online: false,
                tps: 0,
                maxPlayers: 0,
                currentPlayers: 0
            };
        }
    }
    
    /**
     * Collect player information
     */
    private collectPlayerInfo(): any {
        try {
            const onlinePlayers = mc?.getOnlinePlayers?.() || [];
            
            const players = onlinePlayers.map((player: any) => ({
                name: player.name || player.realName || 'Unknown',
                xuid: player.xuid || '',
                uuid: player.uuid || '',
                ip: player.ip || '',
                device: player.deviceTypeName || 'Unknown',
                ping: player.avgPing || 0,
                gamemode: player.gameMode || 'survival',
                dimension: player.pos?.dimid || 0,
                position: {
                    x: Math.round(player.pos?.x || 0),
                    y: Math.round(player.pos?.y || 0),
                    z: Math.round(player.pos?.z || 0)
                },
                health: player.health || 20,
                hunger: player.hunger || 20,
                experience: player.xpLevel || 0,
                joinTime: player.joinTime || Date.now()
            }));
            
            return {
                online: players.length,
                max: mc?.getMaxPlayers?.() || 20,
                list: players,
                byDevice: this.groupPlayersByDevice(players),
                byGamemode: this.groupPlayersByGamemode(players)
            };
            
        } catch (error) {
            logger.error('Failed to collect player info:', error);
            return {
                online: 0,
                max: 20,
                list: [],
                byDevice: {},
                byGamemode: {}
            };
        }
    }
    
    /**
     * Collect system information
     */
    private collectSystemInfo(): any {
        try {
            const memoryUsage: any = process.memoryUsage?.() || {};
            
            return {
                memory: {
                    used: Math.round((memoryUsage.heapUsed || 0) / 1024 / 1024), // MB
                    total: Math.round((memoryUsage.heapTotal || 0) / 1024 / 1024), // MB
                    max: Math.round((memoryUsage.heapTotal || 0) / 1024 / 1024), // MB (approximation)
                    percentage: memoryUsage.heapTotal ? 
                        Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) : 0
                },
                cpu: {
                    usage: this.getCPUUsage(),
                    cores: require('os')?.cpus?.()?.length || 1
                },
                disk: {
                    used: 0, // LLBDS doesn't provide direct disk usage
                    total: 0,
                    percentage: 0
                },
                network: {
                    bytesIn: 0, // LLBDS doesn't provide network stats
                    bytesOut: 0,
                    packetsIn: 0,
                    packetsOut: 0
                },
                uptime: process.uptime?.() || 0,
                platform: process.platform || 'unknown',
                nodeVersion: process.version || 'unknown'
            };
            
        } catch (error) {
            logger.error('Failed to collect system info:', error);
            return {
                memory: { used: 0, total: 0, max: 0, percentage: 0 },
                cpu: { usage: 0, cores: 1 },
                disk: { used: 0, total: 0, percentage: 0 },
                network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
                uptime: 0
            };
        }
    }
    
    /**
     * Collect performance metrics
     */
    private collectPerformanceMetrics(): any {
        try {
            return {
                tps: mc?.getTPS?.() || 20.0,
                mspt: mc?.getAvgMSPT?.() || 50.0, // Milliseconds per tick
                ticksPerSecond: mc?.getTPS?.() || 20.0,
                averageTickTime: mc?.getAvgMSPT?.() || 50.0,
                memoryUsage: {
                    heap: process.memoryUsage?.()?.heapUsed || 0,
                    external: process.memoryUsage?.()?.external || 0,
                    rss: process.memoryUsage?.()?.rss || 0
                },
                gcStats: {
                    collections: 0, // Not available in LLBDS
                    time: 0
                },
                eventLoop: {
                    lag: 0, // Not directly available
                    utilization: 0
                }
            };
            
        } catch (error) {
            logger.error('Failed to collect performance metrics:', error);
            return {
                tps: 0,
                mspt: 0,
                ticksPerSecond: 0,
                averageTickTime: 0,
                memoryUsage: { heap: 0, external: 0, rss: 0 },
                gcStats: { collections: 0, time: 0 },
                eventLoop: { lag: 0, utilization: 0 }
            };
        }
    }
    
    /**
     * Get CPU usage (approximation)
     */
    private getCPUUsage(): number {
        try {
            // Simple CPU usage approximation based on process CPU time
            const cpuUsage = process.cpuUsage?.();
            if (cpuUsage) {
                const totalTime = cpuUsage.user + cpuUsage.system;
                const elapsedTime = process.uptime() * 1000000; // Convert to microseconds
                return Math.min(100, Math.round((totalTime / elapsedTime) * 100));
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Group players by device type
     */
    private groupPlayersByDevice(players: any[]): Record<string, number> {
        const deviceCounts: Record<string, number> = {};
        
        players.forEach(player => {
            const device = player.device || 'Unknown';
            deviceCounts[device] = (deviceCounts[device] || 0) + 1;
        });
        
        return deviceCounts;
    }
    
    /**
     * Group players by gamemode
     */
    private groupPlayersByGamemode(players: any[]): Record<string, number> {
        const gamemodeCounts: Record<string, number> = {};
        
        players.forEach(player => {
            const gamemode = player.gamemode || 'survival';
            gamemodeCounts[gamemode] = (gamemodeCounts[gamemode] || 0) + 1;
        });
        
        return gamemodeCounts;
    }
    
    /**
     * Get current performance data
     */
    public getPerformanceData(): any {
        return { ...this.performanceData };
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
    public forceUpdate(): void {
        this.collectPerformanceData();
    }
}