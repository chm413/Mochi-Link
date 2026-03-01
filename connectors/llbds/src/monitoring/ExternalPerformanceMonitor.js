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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalPerformanceMonitor = void 0;
var si = require("systeminformation");
/**
 * External Performance Monitor
 *
 * Monitors system performance from the external Node.js service
 * to provide comprehensive system metrics without impacting LLBDS performance.
 *
 * @author chm413
 * @version 1.0.0
 */
var ExternalPerformanceMonitor = /** @class */ (function () {
    function ExternalPerformanceMonitor(logger, intervalMs) {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.intervalMs = 30000; // 30 seconds
        this.systemData = {};
        this.lastUpdate = 0;
        this.logger = logger;
        if (intervalMs) {
            this.intervalMs = intervalMs;
        }
    }
    /**
     * Start system monitoring
     */
    ExternalPerformanceMonitor.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isMonitoring) {
                            return [2 /*return*/];
                        }
                        this.isMonitoring = true;
                        // Collect initial data
                        return [4 /*yield*/, this.collectSystemInfo()];
                    case 1:
                        // Collect initial data
                        _a.sent();
                        // Start periodic collection
                        this.monitoringInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.collectSystemInfo()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }, this.intervalMs);
                        this.logger.info('External performance monitoring started');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stop system monitoring
     */
    ExternalPerformanceMonitor.prototype.stop = function () {
        if (!this.isMonitoring) {
            return;
        }
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.logger.info('External performance monitoring stopped');
    };
    /**
     * Collect comprehensive system information
     */
    ExternalPerformanceMonitor.prototype.collectSystemInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, _a, cpu, memory, disk, network_1, processes, osInfo, load, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        now = Date.now();
                        return [4 /*yield*/, Promise.all([
                                this.getCPUInfo(),
                                this.getMemoryInfo(),
                                this.getDiskInfo(),
                                this.getNetworkInfo(),
                                this.getProcessInfo(),
                                this.getOSInfo(),
                                this.getLoadInfo()
                            ])];
                    case 1:
                        _a = _b.sent(), cpu = _a[0], memory = _a[1], disk = _a[2], network_1 = _a[3], processes = _a[4], osInfo = _a[5], load = _a[6];
                        this.systemData = {
                            timestamp: now,
                            cpu: cpu,
                            memory: memory,
                            disk: disk,
                            network: network_1,
                            processes: processes,
                            os: osInfo,
                            load: load,
                            uptime: process.uptime()
                        };
                        this.lastUpdate = now;
                        this.logger.debug('System information collected successfully');
                        return [2 /*return*/, this.systemData];
                    case 2:
                        error_1 = _b.sent();
                        this.logger.error('Failed to collect system information:', error_1);
                        return [2 /*return*/, this.systemData];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get CPU information
     */
    ExternalPerformanceMonitor.prototype.getCPUInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, cpuInfo, currentLoad, error_2;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, Promise.all([
                                si.cpu(),
                                si.currentLoad()
                            ])];
                    case 1:
                        _a = _c.sent(), cpuInfo = _a[0], currentLoad = _a[1];
                        _b = {
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
                            }
                        };
                        return [4 /*yield*/, this.getCPUTemperature()];
                    case 2: return [2 /*return*/, (_b.temperature = _c.sent(),
                            _b)];
                    case 3:
                        error_2 = _c.sent();
                        this.logger.error('Failed to get CPU info:', error_2);
                        return [2 /*return*/, {
                                manufacturer: 'Unknown',
                                brand: 'Unknown',
                                speed: 0,
                                cores: 1,
                                usage: { total: 0, user: 0, system: 0, idle: 100 },
                                temperature: 0
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get CPU temperature
     */
    ExternalPerformanceMonitor.prototype.getCPUTemperature = function () {
        return __awaiter(this, void 0, void 0, function () {
            var temp, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, si.cpuTemperature()];
                    case 1:
                        temp = _a.sent();
                        return [2 /*return*/, Math.round(temp.main || 0)];
                    case 2:
                        error_3 = _a.sent();
                        return [2 /*return*/, 0];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get memory information
     */
    ExternalPerformanceMonitor.prototype.getMemoryInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var memory, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, si.mem()];
                    case 1:
                        memory = _a.sent();
                        return [2 /*return*/, {
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
                            }];
                    case 2:
                        error_4 = _a.sent();
                        this.logger.error('Failed to get memory info:', error_4);
                        return [2 /*return*/, {
                                total: 0,
                                used: 0,
                                free: 0,
                                available: 0,
                                percentage: 0,
                                swap: { total: 0, used: 0, free: 0, percentage: 0 }
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get disk information
     */
    ExternalPerformanceMonitor.prototype.getDiskInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var disks, diskInfo, totalSize, totalUsed, totalAvailable, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, si.fsSize()];
                    case 1:
                        disks = _a.sent();
                        diskInfo = disks.map(function (disk) { return ({
                            filesystem: disk.fs || 'Unknown',
                            type: disk.type || 'Unknown',
                            mount: disk.mount || '/',
                            size: Math.round(disk.size / 1024 / 1024 / 1024), // GB
                            used: Math.round(disk.used / 1024 / 1024 / 1024), // GB
                            available: Math.round(disk.available / 1024 / 1024 / 1024), // GB
                            percentage: Math.round(disk.use || 0)
                        }); });
                        totalSize = diskInfo.reduce(function (sum, disk) { return sum + disk.size; }, 0);
                        totalUsed = diskInfo.reduce(function (sum, disk) { return sum + disk.used; }, 0);
                        totalAvailable = diskInfo.reduce(function (sum, disk) { return sum + disk.available; }, 0);
                        return [2 /*return*/, {
                                disks: diskInfo,
                                total: {
                                    size: totalSize,
                                    used: totalUsed,
                                    available: totalAvailable,
                                    percentage: totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0
                                }
                            }];
                    case 2:
                        error_5 = _a.sent();
                        this.logger.error('Failed to get disk info:', error_5);
                        return [2 /*return*/, {
                                disks: [],
                                total: { size: 0, used: 0, available: 0, percentage: 0 }
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get network information
     */
    ExternalPerformanceMonitor.prototype.getNetworkInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, interfaces, stats, networkInterfaces, networkStats, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.all([
                                si.networkInterfaces(),
                                si.networkStats()
                            ])];
                    case 1:
                        _a = _b.sent(), interfaces = _a[0], stats = _a[1];
                        networkInterfaces = interfaces.map(function (iface) { return ({
                            name: iface.iface || 'Unknown',
                            type: iface.type || 'Unknown',
                            speed: iface.speed || 0,
                            ip4: iface.ip4 || '',
                            ip6: iface.ip6 || '',
                            mac: iface.mac || '',
                            internal: iface.internal || false,
                            virtual: iface.virtual || false,
                            operstate: iface.operstate || 'unknown'
                        }); });
                        networkStats = stats.map(function (stat) { return ({
                            interface: stat.iface || 'Unknown',
                            bytesReceived: stat.rx_bytes || 0,
                            bytesSent: stat.tx_bytes || 0,
                            packetsReceived: stat.rx_sec || 0,
                            packetsSent: stat.tx_sec || 0,
                            errorsReceived: stat.rx_errors || 0,
                            errorsSent: stat.tx_errors || 0,
                            droppedReceived: stat.rx_dropped || 0,
                            droppedSent: stat.tx_dropped || 0
                        }); });
                        return [2 /*return*/, {
                                interfaces: networkInterfaces,
                                stats: networkStats
                            }];
                    case 2:
                        error_6 = _b.sent();
                        this.logger.error('Failed to get network info:', error_6);
                        return [2 /*return*/, {
                                interfaces: [],
                                stats: []
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get process information
     */
    ExternalPerformanceMonitor.prototype.getProcessInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var processes, topCPU, topMemory, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, si.processes()];
                    case 1:
                        processes = _a.sent();
                        topCPU = processes.list
                            .sort(function (a, b) { return (b.cpu || 0) - (a.cpu || 0); })
                            .slice(0, 10)
                            .map(function (proc) { return ({
                            pid: proc.pid || 0,
                            name: proc.name || 'Unknown',
                            cpu: Math.round(proc.cpu || 0),
                            memory: Math.round((proc.mem || 0) * 10) / 10,
                            memoryMB: Math.round((proc.memRss || 0) / 1024 / 1024),
                            command: proc.command || ''
                        }); });
                        topMemory = processes.list
                            .sort(function (a, b) { return (b.mem || 0) - (a.mem || 0); })
                            .slice(0, 10)
                            .map(function (proc) { return ({
                            pid: proc.pid || 0,
                            name: proc.name || 'Unknown',
                            cpu: Math.round(proc.cpu || 0),
                            memory: Math.round((proc.mem || 0) * 10) / 10,
                            memoryMB: Math.round((proc.memRss || 0) / 1024 / 1024),
                            command: proc.command || ''
                        }); });
                        return [2 /*return*/, {
                                total: processes.all || 0,
                                running: processes.running || 0,
                                blocked: processes.blocked || 0,
                                sleeping: processes.sleeping || 0,
                                topCPU: topCPU,
                                topMemory: topMemory
                            }];
                    case 2:
                        error_7 = _a.sent();
                        this.logger.error('Failed to get process info:', error_7);
                        return [2 /*return*/, {
                                total: 0,
                                running: 0,
                                blocked: 0,
                                sleeping: 0,
                                topCPU: [],
                                topMemory: []
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get OS information
     */
    ExternalPerformanceMonitor.prototype.getOSInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var osInfo, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, si.osInfo()];
                    case 1:
                        osInfo = _a.sent();
                        return [2 /*return*/, {
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
                            }];
                    case 2:
                        error_8 = _a.sent();
                        this.logger.error('Failed to get OS info:', error_8);
                        return [2 /*return*/, {
                                platform: process.platform || 'Unknown',
                                distro: 'Unknown',
                                release: 'Unknown',
                                arch: process.arch || 'Unknown',
                                hostname: require('os').hostname() || 'Unknown'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get system load information
     */
    ExternalPerformanceMonitor.prototype.getLoadInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var load, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, si.currentLoad()];
                    case 1:
                        load = _a.sent();
                        return [2 /*return*/, {
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
                            }];
                    case 2:
                        error_9 = _a.sent();
                        this.logger.error('Failed to get load info:', error_9);
                        return [2 /*return*/, {
                                avgload: 0,
                                currentload: 0,
                                currentload_user: 0,
                                currentload_system: 0,
                                currentload_idle: 100
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current system data
     */
    ExternalPerformanceMonitor.prototype.getSystemData = function () {
        return __assign({}, this.systemData);
    };
    /**
     * Get last update timestamp
     */
    ExternalPerformanceMonitor.prototype.getLastUpdate = function () {
        return this.lastUpdate;
    };
    /**
     * Check if monitoring is active
     */
    ExternalPerformanceMonitor.prototype.isActive = function () {
        return this.isMonitoring;
    };
    /**
     * Set monitoring interval
     */
    ExternalPerformanceMonitor.prototype.setInterval = function (intervalMs) {
        this.intervalMs = intervalMs;
        if (this.isMonitoring) {
            this.stop();
            this.start();
        }
    };
    /**
     * Get monitoring interval
     */
    ExternalPerformanceMonitor.prototype.getInterval = function () {
        return this.intervalMs;
    };
    /**
     * Force immediate data collection
     */
    ExternalPerformanceMonitor.prototype.forceUpdate = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collectSystemInfo()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return ExternalPerformanceMonitor;
}());
exports.ExternalPerformanceMonitor = ExternalPerformanceMonitor;
