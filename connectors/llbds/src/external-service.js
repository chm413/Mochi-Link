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
exports.MochiLinkExternalService = void 0;
var express = require("express");
var cors = require("cors");
var helmet = require("helmet");
var compression = require("compression");
var cron = require("node-cron");
var winston = require("winston");
var http_1 = require("http");
var LLBDSConfig_1 = require("./config/LLBDSConfig");
var MochiLinkConnectionManager_1 = require("./network/MochiLinkConnectionManager");
var ExternalPerformanceMonitor_1 = require("./monitoring/ExternalPerformanceMonitor");
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
var MochiLinkExternalService = /** @class */ (function () {
    function MochiLinkExternalService() {
        this.httpPort = 25581; // External service HTTP port
        this.lseBridgePort = 25580; // LSE bridge port
        this.isRunning = false;
        this.isConnected = false;
        // Data caches
        this.serverData = {};
        this.playerData = new Map();
        this.performanceData = {};
        this.initializeLogger();
        this.initializeExpress();
        this.config = new LLBDSConfig_1.LLBDSConfig();
    }
    /**
     * Initialize Winston logger
     */
    MochiLinkExternalService.prototype.initializeLogger = function () {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'mochi-link-external-service' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/external-service-error.log',
                    level: 'error'
                }),
                new winston.transports.File({
                    filename: 'logs/external-service.log'
                }),
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                })
            ]
        });
    };
    /**
     * Initialize Express application
     */
    MochiLinkExternalService.prototype.initializeExpress = function () {
        this.app = express();
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: ['http://localhost:25580'], // Only allow LSE bridge
            credentials: true
        }));
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        // Setup routes
        this.setupRoutes();
    };
    /**
     * Setup Express routes
     */
    MochiLinkExternalService.prototype.setupRoutes = function () {
        var _this = this;
        // Health check endpoint
        this.app.get('/health', function (req, res) {
            res.json({
                status: 'ok',
                service: 'mochi-link-external-service',
                version: '1.0.0',
                uptime: process.uptime(),
                connected: _this.isConnected,
                timestamp: new Date().toISOString()
            });
        });
        // Server data endpoints
        this.app.get('/api/server/status', function (req, res) {
            res.json({
                success: true,
                data: _this.serverData
            });
        });
        this.app.post('/api/server/update', function (req, res) {
            try {
                _this.serverData = __assign(__assign({}, _this.serverData), req.body);
                _this.logger.debug('Server data updated:', req.body);
                res.json({ success: true });
            }
            catch (error) {
                _this.logger.error('Failed to update server data:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // Player data endpoints
        this.app.get('/api/players', function (req, res) {
            res.json({
                success: true,
                data: Array.from(_this.playerData.values())
            });
        });
        this.app.post('/api/players/update', function (req, res) {
            try {
                var _a = req.body, playerId = _a.playerId, data = _a.data;
                _this.playerData.set(playerId, __assign(__assign({}, _this.playerData.get(playerId)), data));
                _this.logger.debug("Player data updated for ".concat(playerId, ":"), data);
                res.json({ success: true });
            }
            catch (error) {
                _this.logger.error('Failed to update player data:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
        this.app.delete('/api/players/:playerId', function (req, res) {
            try {
                var playerId = req.params.playerId;
                _this.playerData.delete(playerId);
                _this.logger.debug("Player data removed for ".concat(playerId));
                res.json({ success: true });
            }
            catch (error) {
                _this.logger.error('Failed to remove player data:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // Event forwarding endpoint
        this.app.post('/api/events/forward', function (req, res) {
            try {
                var event_1 = req.body;
                _this.forwardEventToMochiLink(event_1);
                res.json({ success: true });
            }
            catch (error) {
                _this.logger.error('Failed to forward event:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // Command execution endpoint
        this.app.post('/api/commands/execute', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
            var _a, command, _b, timeout, result, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        _a = req.body, command = _a.command, _b = _a.timeout, timeout = _b === void 0 ? 30000 : _b;
                        return [4 /*yield*/, this.executeCommandOnServer(command, timeout)];
                    case 1:
                        result = _c.sent();
                        res.json({ success: true, result: result });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _c.sent();
                        this.logger.error('Failed to execute command:', error_1);
                        res.status(500).json({ success: false, error: error_1.message });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        // Performance data endpoint
        this.app.get('/api/performance', function (req, res) {
            res.json({
                success: true,
                data: _this.performanceData
            });
        });
        // Shutdown endpoint
        this.app.post('/shutdown', function (req, res) {
            res.json({ success: true, message: 'Shutting down...' });
            setTimeout(function () {
                _this.shutdown();
            }, 1000);
        });
    };
    /**
     * Start the external service
     */
    MochiLinkExternalService.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        this.logger.info('Starting Mochi-Link External Service...');
                        this.logger.info('正在启动大福连外部服务...');
                        // Load configuration
                        return [4 /*yield*/, this.config.load()];
                    case 1:
                        // Load configuration
                        _a.sent();
                        this.httpPort = this.config.getExternalServicePort();
                        this.lseBridgePort = this.config.getHttpPort();
                        // Start HTTP server
                        this.server = (0, http_1.createServer)(this.app);
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                _this.server.listen(_this.httpPort, function (error) {
                                    if (error) {
                                        reject(error);
                                    }
                                    else {
                                        resolve();
                                    }
                                });
                            })];
                    case 2:
                        _a.sent();
                        // Initialize connection manager
                        this.connectionManager = new MochiLinkConnectionManager_1.MochiLinkConnectionManager(this.config, this.logger);
                        // Initialize performance monitor
                        this.performanceMonitor = new ExternalPerformanceMonitor_1.ExternalPerformanceMonitor(this.logger);
                        // Start connection to Mochi-Link
                        return [4 /*yield*/, this.startMochiLinkConnection()];
                    case 3:
                        // Start connection to Mochi-Link
                        _a.sent();
                        // Start performance monitoring
                        this.startPerformanceMonitoring();
                        // Start periodic tasks
                        this.startPeriodicTasks();
                        this.isRunning = true;
                        this.logger.info("External service started on port ".concat(this.httpPort));
                        this.logger.info("\u5916\u90E8\u670D\u52A1\u5DF2\u5728\u7AEF\u53E3 ".concat(this.httpPort, " \u542F\u52A8"));
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        this.logger.error('Failed to start external service:', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Start connection to Mochi-Link management system
     */
    MochiLinkExternalService.prototype.startMochiLinkConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.logger.info('Connecting to Mochi-Link management system...');
                        return [4 /*yield*/, this.connectionManager.connect()];
                    case 1:
                        _a.sent();
                        if (this.connectionManager.isConnected()) {
                            this.isConnected = true;
                            this.logger.info('Successfully connected to Mochi-Link management system!');
                            this.logger.info('已成功连接到大福连管理系统！');
                            // Setup message handlers
                            this.setupMochiLinkHandlers();
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        this.logger.warn('Failed to connect to Mochi-Link:', error_3);
                        // Schedule reconnection
                        setTimeout(function () {
                            if (_this.isRunning) {
                                _this.startMochiLinkConnection();
                            }
                        }, 30000);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Setup Mochi-Link message handlers
     */
    MochiLinkExternalService.prototype.setupMochiLinkHandlers = function () {
        var _this = this;
        this.connectionManager.on('message', function (message) {
            _this.handleMochiLinkMessage(message);
        });
        this.connectionManager.on('disconnect', function () {
            _this.isConnected = false;
            _this.logger.warn('Disconnected from Mochi-Link management system');
            // Schedule reconnection
            setTimeout(function () {
                if (_this.isRunning) {
                    _this.startMochiLinkConnection();
                }
            }, 30000);
        });
        this.connectionManager.on('error', function (error) {
            _this.logger.error('Mochi-Link connection error:', error);
        });
    };
    /**
     * Handle messages from Mochi-Link
     */
    MochiLinkExternalService.prototype.handleMochiLinkMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 11, , 12]);
                        this.logger.debug('Received message from Mochi-Link:', message);
                        _a = message.op;
                        switch (_a) {
                            case 'server.status': return [3 /*break*/, 1];
                            case 'player.list': return [3 /*break*/, 3];
                            case 'command.execute': return [3 /*break*/, 5];
                            case 'performance.get': return [3 /*break*/, 7];
                        }
                        return [3 /*break*/, 9];
                    case 1: return [4 /*yield*/, this.handleServerStatusRequest(message)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 3: return [4 /*yield*/, this.handlePlayerListRequest(message)];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 5: return [4 /*yield*/, this.handleCommandExecuteRequest(message)];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 7: return [4 /*yield*/, this.handlePerformanceRequest(message)];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        this.logger.warn('Unknown message operation:', message.op);
                        _b.label = 10;
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_4 = _b.sent();
                        this.logger.error('Failed to handle Mochi-Link message:', error_4);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle server status request
     */
    MochiLinkExternalService.prototype.handleServerStatusRequest = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = {
                            type: 'response',
                            id: message.id,
                            success: true,
                            data: __assign(__assign({}, this.serverData), { players: Array.from(this.playerData.values()), performance: this.performanceData, timestamp: new Date().toISOString() })
                        };
                        return [4 /*yield*/, this.connectionManager.send(response)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle player list request
     */
    MochiLinkExternalService.prototype.handlePlayerListRequest = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = {
                            type: 'response',
                            id: message.id,
                            success: true,
                            data: {
                                players: Array.from(this.playerData.values()),
                                count: this.playerData.size,
                                timestamp: new Date().toISOString()
                            }
                        };
                        return [4 /*yield*/, this.connectionManager.send(response)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle command execute request
     */
    MochiLinkExternalService.prototype.handleCommandExecuteRequest = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, command, _b, timeout, result, response, error_5, response;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 3, , 5]);
                        _a = message.data, command = _a.command, _b = _a.timeout, timeout = _b === void 0 ? 30000 : _b;
                        return [4 /*yield*/, this.executeCommandOnServer(command, timeout)];
                    case 1:
                        result = _c.sent();
                        response = {
                            type: 'response',
                            id: message.id,
                            success: true,
                            data: {
                                command: command,
                                result: result,
                                timestamp: new Date().toISOString()
                            }
                        };
                        return [4 /*yield*/, this.connectionManager.send(response)];
                    case 2:
                        _c.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        error_5 = _c.sent();
                        response = {
                            type: 'response',
                            id: message.id,
                            success: false,
                            error: error_5.message,
                            timestamp: new Date().toISOString()
                        };
                        return [4 /*yield*/, this.connectionManager.send(response)];
                    case 4:
                        _c.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle performance request
     */
    MochiLinkExternalService.prototype.handlePerformanceRequest = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = {
                            type: 'response',
                            id: message.id,
                            success: true,
                            data: __assign(__assign({}, this.performanceData), { timestamp: new Date().toISOString() })
                        };
                        return [4 /*yield*/, this.connectionManager.send(response)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute command on LLBDS server via LSE bridge
     */
    MochiLinkExternalService.prototype.executeCommandOnServer = function (command, timeout) {
        return __awaiter(this, void 0, void 0, function () {
            var fetch_1, response, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        fetch_1 = require('node-fetch');
                        return [4 /*yield*/, fetch_1("http://localhost:".concat(this.lseBridgePort, "/api/commands/execute"), {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ command: command, timeout: timeout }),
                                timeout: timeout
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Command execution failed: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_6 = _a.sent();
                        this.logger.error('Failed to execute command on server:', error_6);
                        throw error_6;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Forward event to Mochi-Link
     */
    MochiLinkExternalService.prototype.forwardEventToMochiLink = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var message, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isConnected) {
                            this.logger.warn('Cannot forward event: not connected to Mochi-Link');
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        message = {
                            type: 'event',
                            event: event.type,
                            data: event.data,
                            timestamp: new Date().toISOString(),
                            serverId: this.config.getServerId()
                        };
                        return [4 /*yield*/, this.connectionManager.send(message)];
                    case 2:
                        _a.sent();
                        this.logger.debug('Event forwarded to Mochi-Link:', event.type);
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _a.sent();
                        this.logger.error('Failed to forward event to Mochi-Link:', error_7);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Start performance monitoring
     */
    MochiLinkExternalService.prototype.startPerformanceMonitoring = function () {
        var _this = this;
        // Monitor system performance every 30 seconds
        cron.schedule('*/30 * * * * *', function () { return __awaiter(_this, void 0, void 0, function () {
            var systemInfo, message, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.performanceMonitor.collectSystemInfo()];
                    case 1:
                        systemInfo = _a.sent();
                        this.performanceData = __assign(__assign({}, this.performanceData), { system: systemInfo, timestamp: new Date().toISOString() });
                        if (!this.isConnected) return [3 /*break*/, 3];
                        message = {
                            type: 'event',
                            event: 'performance.update',
                            data: this.performanceData,
                            timestamp: new Date().toISOString(),
                            serverId: this.config.getServerId()
                        };
                        return [4 /*yield*/, this.connectionManager.send(message)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_8 = _a.sent();
                        this.logger.error('Failed to collect performance data:', error_8);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); });
    };
    /**
     * Start periodic tasks
     */
    MochiLinkExternalService.prototype.startPeriodicTasks = function () {
        var _this = this;
        // Heartbeat every 30 seconds
        cron.schedule('*/30 * * * * *', function () { return __awaiter(_this, void 0, void 0, function () {
            var message, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isConnected) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        message = {
                            type: 'heartbeat',
                            timestamp: new Date().toISOString(),
                            serverId: this.config.getServerId()
                        };
                        return [4 /*yield*/, this.connectionManager.send(message)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_9 = _a.sent();
                        this.logger.error('Failed to send heartbeat:', error_9);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        // Clean up old data every 5 minutes
        cron.schedule('*/5 * * * *', function () {
            _this.cleanupOldData();
        });
    };
    /**
     * Clean up old data
     */
    MochiLinkExternalService.prototype.cleanupOldData = function () {
        try {
            // Remove offline players older than 1 hour
            var oneHourAgo = Date.now() - (60 * 60 * 1000);
            var entries = Array.from(this.playerData.entries());
            for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                var _a = entries_1[_i], playerId = _a[0], playerData = _a[1];
                if (playerData.lastSeen && playerData.lastSeen < oneHourAgo && !playerData.online) {
                    this.playerData.delete(playerId);
                    this.logger.debug("Cleaned up old player data for ".concat(playerId));
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to clean up old data:', error);
        }
    };
    /**
     * Shutdown the service
     */
    MochiLinkExternalService.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_10;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        this.logger.info('Shutting down Mochi-Link External Service...');
                        this.isRunning = false;
                        if (!this.connectionManager) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.connectionManager.disconnect()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!this.server) return [3 /*break*/, 4];
                        return [4 /*yield*/, new Promise(function (resolve) {
                                _this.server.close(function () {
                                    resolve();
                                });
                            })];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        this.logger.info('Mochi-Link External Service shutdown completed');
                        process.exit(0);
                        return [3 /*break*/, 6];
                    case 5:
                        error_10 = _a.sent();
                        this.logger.error('Error during shutdown:', error_10);
                        process.exit(1);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return MochiLinkExternalService;
}());
exports.MochiLinkExternalService = MochiLinkExternalService;
// Handle process signals
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\nReceived SIGINT, shutting down gracefully...');
                if (!service) return [3 /*break*/, 2];
                return [4 /*yield*/, service.shutdown()];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); });
process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\nReceived SIGTERM, shutting down gracefully...');
                if (!service) return [3 /*break*/, 2];
                return [4 /*yield*/, service.shutdown()];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); });
// Start the service
var service;
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var error_11;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    service = new MochiLinkExternalService();
                    return [4 /*yield*/, service.start()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_11 = _a.sent();
                    console.error('Failed to start Mochi-Link External Service:', error_11);
                    process.exit(1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Auto-start if running directly
if (require.main === module) {
    main();
}
