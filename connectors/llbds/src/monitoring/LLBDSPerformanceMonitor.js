"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLBDSPerformanceMonitor = void 0;
/**
 * LLBDS Performance Monitor
 *
 * Monitors LLBDS server performance metrics and system information
 * for transmission to the Mochi-Link management system.
 *
 * @author chm413
 * @version 1.0.0
 */
var LLBDSPerformanceMonitor = /** @class */ (function () {
    function LLBDSPerformanceMonitor(intervalMs) {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.intervalMs = 30000; // 30 seconds
        this.performanceData = {};
        this.lastUpdate = 0;
        if (intervalMs) {
            this.intervalMs = intervalMs;
        }
    }
    /**
     * Start performance monitoring
     */
    LLBDSPerformanceMonitor.prototype.start = function () {
        var _this = this;
        if (this.isMonitoring) {
            return;
        }
        this.isMonitoring = true;
        // Collect initial data
        this.collectPerformanceData();
        // Start periodic collection
        this.monitoringInterval = setInterval(function () {
            _this.collectPerformanceData();
        }, this.intervalMs);
        logger.info('LLBDS performance monitoring started');
        logger.info('LLBDS 性能监控已启动');
    };
    /**
     * Stop performance monitoring
     */
    LLBDSPerformanceMonitor.prototype.stop = function () {
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
    };
    /**
     * Collect current performance data
     */
    LLBDSPerformanceMonitor.prototype.collectPerformanceData = function () {
        var _a;
        try {
            var now = Date.now();
            // Server basic info
            var serverInfo = this.collectServerInfo();
            // Player info
            var playerInfo = this.collectPlayerInfo();
            // System info
            var systemInfo = this.collectSystemInfo();
            // Performance metrics
            var performanceMetrics = this.collectPerformanceMetrics();
            this.performanceData = {
                timestamp: now,
                server: serverInfo,
                players: playerInfo,
                system: systemInfo,
                performance: performanceMetrics,
                uptime: ((_a = process.uptime) === null || _a === void 0 ? void 0 : _a.call(process)) || 0
            };
            this.lastUpdate = now;
            logger.debug('Performance data collected successfully');
        }
        catch (error) {
            logger.error('Failed to collect performance data:', error);
        }
    };
    /**
     * Collect server information
     */
    LLBDSPerformanceMonitor.prototype.collectServerInfo = function () {
        var _a, _b, _c, _d, _e;
        try {
            return {
                version: ((_a = mc === null || mc === void 0 ? void 0 : mc.getBDSVersion) === null || _a === void 0 ? void 0 : _a.call(mc)) || 'Unknown',
                online: true,
                tps: ((_b = mc === null || mc === void 0 ? void 0 : mc.getTPS) === null || _b === void 0 ? void 0 : _b.call(mc)) || 20.0,
                maxPlayers: ((_c = mc === null || mc === void 0 ? void 0 : mc.getMaxPlayers) === null || _c === void 0 ? void 0 : _c.call(mc)) || 20,
                currentPlayers: ((_e = (_d = mc === null || mc === void 0 ? void 0 : mc.getOnlinePlayers) === null || _d === void 0 ? void 0 : _d.call(mc)) === null || _e === void 0 ? void 0 : _e.length) || 0,
                gamemode: 'survival', // LLBDS doesn't provide direct access to default gamemode
                difficulty: 'normal', // LLBDS doesn't provide direct access to difficulty
                worldName: 'Bedrock level' // Default LLBDS world name
            };
        }
        catch (error) {
            logger.error('Failed to collect server info:', error);
            return {
                version: 'Unknown',
                online: false,
                tps: 0,
                maxPlayers: 0,
                currentPlayers: 0
            };
        }
    };
    /**
     * Collect player information
     */
    LLBDSPerformanceMonitor.prototype.collectPlayerInfo = function () {
        var _a, _b;
        try {
            var onlinePlayers = ((_a = mc === null || mc === void 0 ? void 0 : mc.getOnlinePlayers) === null || _a === void 0 ? void 0 : _a.call(mc)) || [];
            var players = onlinePlayers.map(function (player) {
                var _a, _b, _c, _d;
                return ({
                    name: player.name || player.realName || 'Unknown',
                    xuid: player.xuid || '',
                    uuid: player.uuid || '',
                    ip: player.ip || '',
                    device: player.deviceTypeName || 'Unknown',
                    ping: player.avgPing || 0,
                    gamemode: player.gameMode || 'survival',
                    dimension: ((_a = player.pos) === null || _a === void 0 ? void 0 : _a.dimid) || 0,
                    position: {
                        x: Math.round(((_b = player.pos) === null || _b === void 0 ? void 0 : _b.x) || 0),
                        y: Math.round(((_c = player.pos) === null || _c === void 0 ? void 0 : _c.y) || 0),
                        z: Math.round(((_d = player.pos) === null || _d === void 0 ? void 0 : _d.z) || 0)
                    },
                    health: player.health || 20,
                    hunger: player.hunger || 20,
                    experience: player.xpLevel || 0,
                    joinTime: player.joinTime || Date.now()
                });
            });
            return {
                online: players.length,
                max: ((_b = mc === null || mc === void 0 ? void 0 : mc.getMaxPlayers) === null || _b === void 0 ? void 0 : _b.call(mc)) || 20,
                list: players,
                byDevice: this.groupPlayersByDevice(players),
                byGamemode: this.groupPlayersByGamemode(players)
            };
        }
        catch (error) {
            logger.error('Failed to collect player info:', error);
            return {
                online: 0,
                max: 20,
                list: [],
                byDevice: {},
                byGamemode: {}
            };
        }
    };
    /**
     * Collect system information
     */
    LLBDSPerformanceMonitor.prototype.collectSystemInfo = function () {
        var _a, _b, _c, _d, _e;
        try {
            var memoryUsage = ((_a = process.memoryUsage) === null || _a === void 0 ? void 0 : _a.call(process)) || {};
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
                    cores: ((_d = (_c = (_b = require('os')) === null || _b === void 0 ? void 0 : _b.cpus) === null || _c === void 0 ? void 0 : _c.call(_b)) === null || _d === void 0 ? void 0 : _d.length) || 1
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
                uptime: ((_e = process.uptime) === null || _e === void 0 ? void 0 : _e.call(process)) || 0,
                platform: process.platform || 'unknown',
                nodeVersion: process.version || 'unknown'
            };
        }
        catch (error) {
            logger.error('Failed to collect system info:', error);
            return {
                memory: { used: 0, total: 0, max: 0, percentage: 0 },
                cpu: { usage: 0, cores: 1 },
                disk: { used: 0, total: 0, percentage: 0 },
                network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
                uptime: 0
            };
        }
    };
    /**
     * Collect performance metrics
     */
    LLBDSPerformanceMonitor.prototype.collectPerformanceMetrics = function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        try {
            return {
                tps: ((_a = mc === null || mc === void 0 ? void 0 : mc.getTPS) === null || _a === void 0 ? void 0 : _a.call(mc)) || 20.0,
                mspt: ((_b = mc === null || mc === void 0 ? void 0 : mc.getAvgMSPT) === null || _b === void 0 ? void 0 : _b.call(mc)) || 50.0, // Milliseconds per tick
                ticksPerSecond: ((_c = mc === null || mc === void 0 ? void 0 : mc.getTPS) === null || _c === void 0 ? void 0 : _c.call(mc)) || 20.0,
                averageTickTime: ((_d = mc === null || mc === void 0 ? void 0 : mc.getAvgMSPT) === null || _d === void 0 ? void 0 : _d.call(mc)) || 50.0,
                memoryUsage: {
                    heap: ((_f = (_e = process.memoryUsage) === null || _e === void 0 ? void 0 : _e.call(process)) === null || _f === void 0 ? void 0 : _f.heapUsed) || 0,
                    external: ((_h = (_g = process.memoryUsage) === null || _g === void 0 ? void 0 : _g.call(process)) === null || _h === void 0 ? void 0 : _h.external) || 0,
                    rss: ((_k = (_j = process.memoryUsage) === null || _j === void 0 ? void 0 : _j.call(process)) === null || _k === void 0 ? void 0 : _k.rss) || 0
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
        }
        catch (error) {
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
    };
    /**
     * Get CPU usage (approximation)
     */
    LLBDSPerformanceMonitor.prototype.getCPUUsage = function () {
        var _a;
        try {
            // Simple CPU usage approximation based on process CPU time
            var cpuUsage = (_a = process.cpuUsage) === null || _a === void 0 ? void 0 : _a.call(process);
            if (cpuUsage) {
                var totalTime = cpuUsage.user + cpuUsage.system;
                var elapsedTime = process.uptime() * 1000000; // Convert to microseconds
                return Math.min(100, Math.round((totalTime / elapsedTime) * 100));
            }
            return 0;
        }
        catch (error) {
            return 0;
        }
    };
    /**
     * Group players by device type
     */
    LLBDSPerformanceMonitor.prototype.groupPlayersByDevice = function (players) {
        var deviceCounts = {};
        players.forEach(function (player) {
            var device = player.device || 'Unknown';
            deviceCounts[device] = (deviceCounts[device] || 0) + 1;
        });
        return deviceCounts;
    };
    /**
     * Group players by gamemode
     */
    LLBDSPerformanceMonitor.prototype.groupPlayersByGamemode = function (players) {
        var gamemodeCounts = {};
        players.forEach(function (player) {
            var gamemode = player.gamemode || 'survival';
            gamemodeCounts[gamemode] = (gamemodeCounts[gamemode] || 0) + 1;
        });
        return gamemodeCounts;
    };
    /**
     * Get current performance data
     */
    LLBDSPerformanceMonitor.prototype.getPerformanceData = function () {
        return __assign({}, this.performanceData);
    };
    /**
     * Get last update timestamp
     */
    LLBDSPerformanceMonitor.prototype.getLastUpdate = function () {
        return this.lastUpdate;
    };
    /**
     * Check if monitoring is active
     */
    LLBDSPerformanceMonitor.prototype.isActive = function () {
        return this.isMonitoring;
    };
    /**
     * Set monitoring interval
     */
    LLBDSPerformanceMonitor.prototype.setInterval = function (intervalMs) {
        this.intervalMs = intervalMs;
        if (this.isMonitoring) {
            this.stop();
            this.start();
        }
    };
    /**
     * Get monitoring interval
     */
    LLBDSPerformanceMonitor.prototype.getInterval = function () {
        return this.intervalMs;
    };
    /**
     * Force immediate data collection
     */
    LLBDSPerformanceMonitor.prototype.forceUpdate = function () {
        this.collectPerformanceData();
    };
    return LLBDSPerformanceMonitor;
}());
exports.LLBDSPerformanceMonitor = LLBDSPerformanceMonitor;
