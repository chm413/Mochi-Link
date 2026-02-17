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
exports.MochiLinkLLBDSPlugin = void 0;
var LLBDSConfig_1 = require("./config/LLBDSConfig");
var LSEBridge_1 = require("./bridge/LSEBridge");
var LLBDSEventHandler_1 = require("./handlers/LLBDSEventHandler");
var LLBDSCommandHandler_1 = require("./handlers/LLBDSCommandHandler");
/**
 * Mochi-Link Connector Plugin for LLBDS (LiteLoaderBDS) with LSE
 *
 * This plugin provides integration between LLBDS servers and the Mochi-Link
 * unified management system, utilizing LSE (LiteLoaderBDS Script Engine) as
 * the bridge and Node.js external network service for communication.
 *
 * Architecture:
 * LLBDS Server <-> LSE Plugin <-> HTTP API <-> Node.js External Service <-> Mochi-Link
 *
 * @author chm413
 * @version 1.0.0
 */
// Plugin information
var PLUGIN_NAME = 'MochiLinkConnectorLLBDS';
var PLUGIN_VERSION = '1.0.0';
var PLUGIN_AUTHOR = 'chm413';
// Global plugin instance
var pluginInstance = null;
/**
 * LSE Plugin entry point - called when LLBDS loads the plugin
 * This runs inside the LLBDS process and should be lightweight
 */
function main() {
    try {
        // Initialize lightweight LSE plugin
        pluginInstance = new MochiLinkLLBDSPlugin();
        pluginInstance.initialize();
        logger.info("".concat(PLUGIN_NAME, " v").concat(PLUGIN_VERSION, " LSE Bridge initialized!"));
        logger.info("\u5927\u798F\u8FDE LLBDS LSE \u6865\u63A5\u5668 v".concat(PLUGIN_VERSION, " \u5DF2\u521D\u59CB\u5316\uFF01"));
    }
    catch (error) {
        logger.error("Failed to initialize ".concat(PLUGIN_NAME, " LSE Bridge:"), error);
    }
}
/**
 * Plugin cleanup - called when LLBDS unloads the plugin
 */
function cleanup() {
    try {
        if (pluginInstance) {
            pluginInstance.cleanup();
            pluginInstance = null;
        }
        logger.info("".concat(PLUGIN_NAME, " LSE Bridge has been unloaded."));
        logger.info("\u5927\u798F\u8FDE LLBDS LSE \u6865\u63A5\u5668\u5DF2\u5378\u8F7D\u3002");
    }
    catch (error) {
        logger.error("Error during ".concat(PLUGIN_NAME, " LSE Bridge cleanup:"), error);
    }
}
// Export for LSE
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        main: main,
        cleanup: cleanup,
        PLUGIN_NAME: PLUGIN_NAME,
        PLUGIN_VERSION: PLUGIN_VERSION,
        PLUGIN_AUTHOR: PLUGIN_AUTHOR
    };
}
/**
 * LLBDS LSE Plugin Class (Lightweight Bridge)
 * This class runs inside the LLBDS process and provides minimal overhead
 */
var MochiLinkLLBDSPlugin = /** @class */ (function () {
    function MochiLinkLLBDSPlugin() {
        this.isEnabled = false;
        this.httpPort = 25580; // Default HTTP API port
        this.config = new LLBDSConfig_1.LLBDSConfig();
    }
    /**
     * Initialize the lightweight LSE plugin
     */
    MochiLinkLLBDSPlugin.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        logger.info('Initializing Mochi-Link LLBDS LSE Bridge...');
                        logger.info('正在初始化大福连 LLBDS LSE 桥接器...');
                        // Load configuration
                        return [4 /*yield*/, this.config.load()];
                    case 1:
                        // Load configuration
                        _a.sent();
                        this.httpPort = this.config.getHttpPort();
                        // Initialize LSE bridge (lightweight HTTP server for communication)
                        this.lseBridge = new LSEBridge_1.LSEBridge(this.httpPort, this.config);
                        return [4 /*yield*/, this.lseBridge.start()];
                    case 2:
                        _a.sent();
                        // Initialize event handler (registers LSE event listeners)
                        this.eventHandler = new LLBDSEventHandler_1.LLBDSEventHandler(this.lseBridge);
                        this.eventHandler.registerEvents();
                        // Initialize command handler (registers LSE command handlers)
                        this.commandHandler = new LLBDSCommandHandler_1.LLBDSCommandHandler(this.lseBridge);
                        this.commandHandler.registerCommands();
                        // Start external Node.js service
                        return [4 /*yield*/, this.startExternalService()];
                    case 3:
                        // Start external Node.js service
                        _a.sent();
                        this.isEnabled = true;
                        logger.info('Mochi-Link LLBDS LSE Bridge initialized successfully!');
                        logger.info('大福连 LLBDS LSE 桥接器初始化成功！');
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        logger.error('Failed to initialize Mochi-Link LLBDS LSE Bridge:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Start external Node.js service
     */
    MochiLinkLLBDSPlugin.prototype.startExternalService = function () {
        return __awaiter(this, void 0, void 0, function () {
            var isRunning, spawn, path, servicePath, serviceProcess, isStarted, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, this.checkExternalService()];
                    case 1:
                        isRunning = _a.sent();
                        if (!!isRunning) return [3 /*break*/, 4];
                        logger.info('Starting external Node.js service...');
                        logger.info('正在启动外部Node.js服务...');
                        spawn = require('child_process').spawn;
                        path = require('path');
                        servicePath = path.join(__dirname, '../external-service.js');
                        serviceProcess = spawn('node', [servicePath], {
                            detached: true,
                            stdio: 'ignore',
                            cwd: path.dirname(servicePath)
                        });
                        serviceProcess.unref();
                        // Wait for service to start
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 3000); })];
                    case 2:
                        // Wait for service to start
                        _a.sent();
                        return [4 /*yield*/, this.checkExternalService()];
                    case 3:
                        isStarted = _a.sent();
                        if (isStarted) {
                            logger.info('External Node.js service started successfully!');
                            logger.info('外部Node.js服务启动成功！');
                        }
                        else {
                            throw new Error('Failed to start external Node.js service');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        logger.info('External Node.js service is already running');
                        logger.info('外部Node.js服务已在运行');
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_2 = _a.sent();
                        logger.warn('Failed to start external service:', error_2);
                        logger.warn('启动外部服务失败:', error_2);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if external service is running
     */
    MochiLinkLLBDSPlugin.prototype.checkExternalService = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fetch_1, response, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        fetch_1 = require('node-fetch');
                        return [4 /*yield*/, fetch_1("http://localhost:".concat(this.httpPort + 1, "/health"), {
                                timeout: 5000
                            })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.ok];
                    case 2:
                        error_3 = _a.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Cleanup plugin resources
     */
    MochiLinkLLBDSPlugin.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fetch_2, error_4, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        if (!this.lseBridge) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.lseBridge.stop()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // Cleanup event handlers
                        if (this.eventHandler) {
                            this.eventHandler.unregisterEvents();
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        fetch_2 = require('node-fetch');
                        return [4 /*yield*/, fetch_2("http://localhost:".concat(this.httpPort + 1, "/shutdown"), {
                                method: 'POST',
                                timeout: 5000
                            })];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _a.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        this.isEnabled = false;
                        logger.info('Mochi-Link LLBDS LSE Bridge cleanup completed.');
                        logger.info('大福连 LLBDS LSE 桥接器清理完成。');
                        return [3 /*break*/, 8];
                    case 7:
                        error_5 = _a.sent();
                        logger.error('Error during LSE Bridge cleanup:', error_5);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get plugin configuration
     */
    MochiLinkLLBDSPlugin.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * Get LSE bridge
     */
    MochiLinkLLBDSPlugin.prototype.getLSEBridge = function () {
        return this.lseBridge;
    };
    /**
     * Get event handler
     */
    MochiLinkLLBDSPlugin.prototype.getEventHandler = function () {
        return this.eventHandler;
    };
    /**
     * Get command handler
     */
    MochiLinkLLBDSPlugin.prototype.getCommandHandler = function () {
        return this.commandHandler;
    };
    /**
     * Check if plugin is enabled
     */
    MochiLinkLLBDSPlugin.prototype.isPluginEnabled = function () {
        return this.isEnabled;
    };
    /**
     * Get connection status
     */
    MochiLinkLLBDSPlugin.prototype.getConnectionStatus = function () {
        if (!this.isEnabled) {
            return 'LSE Bridge Disabled';
        }
        if (this.lseBridge && this.lseBridge.isRunning()) {
            return 'LSE Bridge Active';
        }
        return 'Unknown';
    };
    return MochiLinkLLBDSPlugin;
}());
exports.MochiLinkLLBDSPlugin = MochiLinkLLBDSPlugin;
