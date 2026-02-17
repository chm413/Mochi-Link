"use strict";
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
exports.LSEBridge = void 0;
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
var LSEBridge = /** @class */ (function () {
    function LSEBridge(port, config) {
        this.server = null;
        this._isRunning = false;
        // Event callbacks
        this.eventCallbacks = new Map();
        // Command queue for external service
        this.commandQueue = [];
        this.commandResults = new Map();
        this.httpPort = port;
        this.config = config;
    }
    /**
     * Start the LSE bridge HTTP server
     */
    LSEBridge.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    // Use LLBDS's built-in HTTP server if available, otherwise create minimal server
                    if (typeof HttpServer !== 'undefined') {
                        // Use LLBDS HttpServer
                        this.server = new HttpServer();
                        this.setupLLBDSRoutes();
                        this.server.listen(this.httpPort);
                    }
                    else {
                        // Fallback to Node.js http module (if available in LSE environment)
                        this.setupFallbackServer();
                    }
                    this._isRunning = true;
                    logger.info("LSE Bridge started on port ".concat(this.httpPort));
                    logger.info("LSE \u6865\u63A5\u5668\u5DF2\u5728\u7AEF\uFFFD?".concat(this.httpPort, " \u542F\u52A8"));
                }
                catch (error) {
                    logger.error('Failed to start LSE Bridge:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Setup routes for LLBDS HttpServer
     */
    LSEBridge.prototype.setupLLBDSRoutes = function () {
        var _this = this;
        if (!this.server)
            return;
        // Health check
        this.server.onGet('/health', function (req, res) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                service: 'lse-bridge',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            }));
        });
        // Server status
        this.server.onGet('/api/server/status', function (req, res) {
            var status = _this.getServerStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: status }));
        });
        // Player list
        this.server.onGet('/api/players', function (req, res) {
            var players = _this.getPlayerList();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: players }));
        });
        // Command execution
        this.server.onPost('/api/commands/execute', function (req, res) {
            try {
                var body = JSON.parse(req.body || '{}');
                var result = _this.executeCommand(body.command);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    result: result,
                    timestamp: new Date().toISOString()
                }));
            }
            catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });
        // Event forwarding endpoint
        this.server.onPost('/api/events/forward', function (req, res) {
            try {
                var event_1 = JSON.parse(req.body || '{}');
                _this.forwardEventToExternal(event_1);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            }
            catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });
    };
    /**
     * Setup fallback HTTP server (if LLBDS HttpServer not available)
     */
    LSEBridge.prototype.setupFallbackServer = function () {
        // Minimal HTTP server implementation using LLBDS network capabilities
        // This is a simplified version that works within LSE constraints
        logger.warn('LLBDS HttpServer not available, using fallback implementation');
        logger.warn('LLBDS HttpServer 不可用，使用备用实现');
        // Create a simple request handler using LLBDS network events
        this.setupNetworkEventHandlers();
    };
    /**
     * Setup network event handlers for fallback communication
     */
    LSEBridge.prototype.setupNetworkEventHandlers = function () {
        // Use LLBDS event system for communication if HTTP server not available
        // This is a workaround for environments where HTTP server is not accessible
        var _this = this;
        try {
            // Listen for network events from external service
            if (typeof mc !== 'undefined' && mc.listen) {
                mc.listen('onServerCmd', function (cmd) {
                    if (cmd.startsWith('mochilink:')) {
                        _this.handleNetworkCommand(cmd.substring(10));
                    }
                });
            }
            this._isRunning = true;
            logger.info('LSE Bridge fallback communication initialized');
            logger.info('LSE 桥接器备用通信已初始化');
        }
        catch (error) {
            logger.error('Failed to setup fallback communication:', error);
            throw error;
        }
    };
    /**
     * Handle network commands (fallback method)
     */
    LSEBridge.prototype.handleNetworkCommand = function (command) {
        try {
            var parts = command.split(':');
            var action = parts[0];
            var data = parts.slice(1).join(':');
            switch (action) {
                case 'status':
                    this.sendNetworkResponse('status', this.getServerStatus());
                    break;
                case 'players':
                    this.sendNetworkResponse('players', this.getPlayerList());
                    break;
                case 'execute':
                    var result = this.executeCommand(data);
                    this.sendNetworkResponse('execute', result);
                    break;
                default:
                    logger.warn('Unknown network command:', action);
            }
        }
        catch (error) {
            logger.error('Failed to handle network command:', error);
        }
    };
    /**
     * Send network response (fallback method)
     */
    LSEBridge.prototype.sendNetworkResponse = function (type, data) {
        try {
            // Use LLBDS logging or file system to communicate back
            var response = {
                type: type,
                data: data,
                timestamp: new Date().toISOString()
            };
            // Write to a temporary file that external service can read
            var fs = require('fs');
            var path = "./temp/lse-response-".concat(Date.now(), ".json");
            fs.writeFileSync(path, JSON.stringify(response));
            logger.debug("Network response written to ".concat(path));
        }
        catch (error) {
            logger.error('Failed to send network response:', error);
        }
    };
    /**
     * Get current server status
     */
    LSEBridge.prototype.getServerStatus = function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        try {
            var status_1 = {
                online: true,
                version: ((_a = mc === null || mc === void 0 ? void 0 : mc.getBDSVersion) === null || _a === void 0 ? void 0 : _a.call(mc)) || 'Unknown',
                players: {
                    online: ((_c = (_b = mc === null || mc === void 0 ? void 0 : mc.getOnlinePlayers) === null || _b === void 0 ? void 0 : _b.call(mc)) === null || _c === void 0 ? void 0 : _c.length) || 0,
                    max: ((_d = mc === null || mc === void 0 ? void 0 : mc.getMaxPlayers) === null || _d === void 0 ? void 0 : _d.call(mc)) || 20
                },
                tps: ((_e = mc === null || mc === void 0 ? void 0 : mc.getTPS) === null || _e === void 0 ? void 0 : _e.call(mc)) || 20.0,
                memory: {
                    used: ((_g = (_f = process.memoryUsage) === null || _f === void 0 ? void 0 : _f.call(process)) === null || _g === void 0 ? void 0 : _g.heapUsed) || 0,
                    total: ((_j = (_h = process.memoryUsage) === null || _h === void 0 ? void 0 : _h.call(process)) === null || _j === void 0 ? void 0 : _j.heapTotal) || 0
                },
                uptime: ((_k = process.uptime) === null || _k === void 0 ? void 0 : _k.call(process)) || 0,
                timestamp: new Date().toISOString()
            };
            return status_1;
        }
        catch (error) {
            logger.error('Failed to get server status:', error);
            return {
                online: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };
    /**
     * Get current player list
     */
    LSEBridge.prototype.getPlayerList = function () {
        var _a;
        try {
            var players = ((_a = mc === null || mc === void 0 ? void 0 : mc.getOnlinePlayers) === null || _a === void 0 ? void 0 : _a.call(mc)) || [];
            return players.map(function (player) { return ({
                name: player.name || player.realName || 'Unknown',
                xuid: player.xuid || '',
                uuid: player.uuid || '',
                ip: player.ip || '',
                device: player.deviceTypeName || 'Unknown',
                ping: player.avgPing || 0,
                joinTime: player.joinTime || Date.now(),
                online: true
            }); });
        }
        catch (error) {
            logger.error('Failed to get player list:', error);
            return [];
        }
    };
    /**
     * Execute command on server
     */
    LSEBridge.prototype.executeCommand = function (command) {
        try {
            if (!command || typeof command !== 'string') {
                throw new Error('Invalid command');
            }
            // Check command whitelist/blacklist
            if (!this.isCommandAllowed(command)) {
                throw new Error('Command not allowed');
            }
            // Execute command using LLBDS API
            var result = '';
            if (mc === null || mc === void 0 ? void 0 : mc.runcmd) {
                result = mc.runcmd(command);
            }
            else if (mc === null || mc === void 0 ? void 0 : mc.runcmdEx) {
                var cmdResult = mc.runcmdEx(command);
                result = cmdResult.output || '';
            }
            else {
                throw new Error('Command execution not available');
            }
            return {
                command: command,
                output: result,
                success: true,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            logger.error('Failed to execute command:', error);
            return {
                command: command,
                output: '',
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    };
    /**
     * Check if command is allowed
     */
    LSEBridge.prototype.isCommandAllowed = function (command) {
        var whitelist = this.config.getCommandWhitelist();
        var blacklist = this.config.getCommandBlacklist();
        // Check blacklist first
        for (var _i = 0, blacklist_1 = blacklist; _i < blacklist_1.length; _i++) {
            var blocked = blacklist_1[_i];
            if (command.toLowerCase().startsWith(blocked.toLowerCase())) {
                return false;
            }
        }
        // If whitelist is empty, allow all (except blacklisted)
        if (whitelist.length === 0) {
            return true;
        }
        // Check whitelist
        for (var _a = 0, whitelist_1 = whitelist; _a < whitelist_1.length; _a++) {
            var allowed = whitelist_1[_a];
            if (command.toLowerCase().startsWith(allowed.toLowerCase())) {
                return true;
            }
        }
        return false;
    };
    /**
     * Forward event to external service
     */
    LSEBridge.prototype.forwardEventToExternal = function (event) {
        try {
            // Send event to external service via HTTP
            this.sendToExternalService('/api/events/forward', event);
        }
        catch (error) {
            logger.error('Failed to forward event to external service:', error);
        }
    };
    /**
     * Send data to external service
     */
    LSEBridge.prototype.sendToExternalService = function (endpoint, data) {
        try {
            // Use LLBDS network capabilities to send HTTP request
            if (typeof network !== 'undefined' && network.httpPost) {
                var externalPort = this.config.getExternalServicePort();
                var url = "http://localhost:".concat(externalPort).concat(endpoint);
                network.httpPost(url, JSON.stringify(data), {
                    'Content-Type': 'application/json'
                });
            }
            else {
                // Fallback: write to file for external service to pick up
                var fs = require('fs');
                var filename = "./temp/external-".concat(Date.now(), ".json");
                fs.writeFileSync(filename, JSON.stringify({
                    endpoint: endpoint,
                    data: data,
                    timestamp: new Date().toISOString()
                }));
            }
        }
        catch (error) {
            logger.error('Failed to send data to external service:', error);
        }
    };
    /**
     * Register event callback
     */
    LSEBridge.prototype.on = function (event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    };
    /**
     * Emit event
     */
    LSEBridge.prototype.emit = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(function (callback) {
                try {
                    callback.apply(void 0, args);
                }
                catch (error) {
                    logger.error("Error in event callback for ".concat(event, ":"), error);
                }
            });
        }
    };
    /**
     * Stop the LSE bridge
     */
    LSEBridge.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    this._isRunning = false;
                    if (this.server && this.server.close) {
                        this.server.close();
                    }
                    logger.info('LSE Bridge stopped');
                    logger.info('LSE 桥接器已停止');
                }
                catch (error) {
                    logger.error('Failed to stop LSE Bridge:', error);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check if bridge is running
     */
    LSEBridge.prototype.isRunning = function () {
        return this._isRunning;
    };
    /**
     * Get bridge port
     */
    LSEBridge.prototype.getPort = function () {
        return this.httpPort;
    };
    return LSEBridge;
}());
exports.LSEBridge = LSEBridge;
