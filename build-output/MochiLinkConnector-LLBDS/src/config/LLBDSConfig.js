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
exports.LLBDSConfig = void 0;
var fs = require("fs");
var path = require("path");
/**
 * LLBDS Configuration Manager
 *
 * Manages configuration for the LLBDS connector including
 * server settings, network configuration, and security options.
 *
 * @author chm413
 * @version 1.0.0
 */
var LLBDSConfig = /** @class */ (function () {
    function LLBDSConfig(configPath) {
        this.config = {};
        this.configPath = configPath || './config/llbds-config.json';
        this.loadDefaults();
    }
    /**
     * Load configuration from file
     */
    LLBDSConfig.prototype.load = function () {
        return __awaiter(this, void 0, void 0, function () {
            var configData, fileConfig, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        if (!fs.existsSync(this.configPath)) return [3 /*break*/, 1];
                        configData = fs.readFileSync(this.configPath, 'utf8');
                        fileConfig = JSON.parse(configData);
                        this.config = __assign(__assign({}, this.config), fileConfig);
                        return [3 /*break*/, 3];
                    case 1: 
                    // Create default config file
                    return [4 /*yield*/, this.save()];
                    case 2:
                        // Create default config file
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.warn('Failed to load LLBDS config, using defaults:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save configuration to file
     */
    LLBDSConfig.prototype.save = function () {
        return __awaiter(this, void 0, void 0, function () {
            var configDir;
            return __generator(this, function (_a) {
                try {
                    configDir = path.dirname(this.configPath);
                    if (!fs.existsSync(configDir)) {
                        fs.mkdirSync(configDir, { recursive: true });
                    }
                    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
                }
                catch (error) {
                    console.error('Failed to save LLBDS config:', error);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Load default configuration
     */
    LLBDSConfig.prototype.loadDefaults = function () {
        this.config = {
            server: {
                id: 'llbds-server-1',
                name: 'LLBDS Server',
                description: 'LiteLoaderBDS Server managed by Mochi-Link'
            },
            network: {
                httpPort: 25580,
                externalServicePort: 25581,
                mochiLinkHost: 'localhost',
                mochiLinkPort: 8080,
                mochiLinkPath: '/ws',
                ssl: false,
                timeout: 30000,
                retryAttempts: 5,
                retryDelay: 5000
            },
            authentication: {
                token: '',
                serverId: '',
                encryptionKey: ''
            },
            commands: {
                whitelist: [
                    'list',
                    'say',
                    'tell',
                    'time',
                    'weather',
                    'tp',
                    'gamemode',
                    'give',
                    'effect',
                    'summon',
                    'kill',
                    'kick',
                    'ban',
                    'pardon',
                    'whitelist',
                    'op',
                    'deop'
                ],
                blacklist: [
                    'stop',
                    'restart',
                    'reload',
                    'save-all',
                    'save-off',
                    'save-on'
                ]
            },
            monitoring: {
                enabled: true,
                interval: 30000,
                collectSystemInfo: true,
                collectPlayerInfo: true,
                collectPerformanceInfo: true
            },
            logging: {
                level: 'info',
                file: './logs/llbds-connector.log',
                maxSize: '10MB',
                maxFiles: 5
            }
        };
    };
    // Getter methods
    LLBDSConfig.prototype.getServerId = function () {
        var _a;
        return ((_a = this.config.server) === null || _a === void 0 ? void 0 : _a.id) || 'llbds-server-1';
    };
    LLBDSConfig.prototype.getServerName = function () {
        var _a;
        return ((_a = this.config.server) === null || _a === void 0 ? void 0 : _a.name) || 'LLBDS Server';
    };
    LLBDSConfig.prototype.getHttpPort = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.httpPort) || 25580;
    };
    LLBDSConfig.prototype.getExternalServicePort = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.externalServicePort) || 25581;
    };
    LLBDSConfig.prototype.getMochiLinkHost = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.mochiLinkHost) || 'localhost';
    };
    LLBDSConfig.prototype.getMochiLinkPort = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.mochiLinkPort) || 8080;
    };
    LLBDSConfig.prototype.getMochiLinkPath = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.mochiLinkPath) || '/ws';
    };
    LLBDSConfig.prototype.getAuthToken = function () {
        var _a;
        return ((_a = this.config.authentication) === null || _a === void 0 ? void 0 : _a.token) || '';
    };
    LLBDSConfig.prototype.getCommandWhitelist = function () {
        var _a;
        return ((_a = this.config.commands) === null || _a === void 0 ? void 0 : _a.whitelist) || [];
    };
    LLBDSConfig.prototype.getCommandBlacklist = function () {
        var _a;
        return ((_a = this.config.commands) === null || _a === void 0 ? void 0 : _a.blacklist) || [];
    };
    LLBDSConfig.prototype.isMonitoringEnabled = function () {
        var _a;
        return ((_a = this.config.monitoring) === null || _a === void 0 ? void 0 : _a.enabled) !== false;
    };
    LLBDSConfig.prototype.getMonitoringInterval = function () {
        var _a;
        return ((_a = this.config.monitoring) === null || _a === void 0 ? void 0 : _a.interval) || 30000;
    };
    LLBDSConfig.prototype.getTimeout = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.timeout) || 30000;
    };
    LLBDSConfig.prototype.getRetryAttempts = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.retryAttempts) || 5;
    };
    LLBDSConfig.prototype.getRetryDelay = function () {
        var _a;
        return ((_a = this.config.network) === null || _a === void 0 ? void 0 : _a.retryDelay) || 5000;
    };
    // Setter methods
    LLBDSConfig.prototype.setServerId = function (serverId) {
        if (!this.config.server)
            this.config.server = {};
        this.config.server.id = serverId;
    };
    LLBDSConfig.prototype.setAuthToken = function (token) {
        if (!this.config.authentication)
            this.config.authentication = {};
        this.config.authentication.token = token;
    };
    LLBDSConfig.prototype.setMochiLinkConnection = function (host, port, path) {
        if (!this.config.network)
            this.config.network = {};
        this.config.network.mochiLinkHost = host;
        this.config.network.mochiLinkPort = port;
        if (path)
            this.config.network.mochiLinkPath = path;
    };
    /**
     * Get full configuration object
     */
    LLBDSConfig.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    /**
     * Update configuration
     */
    LLBDSConfig.prototype.updateConfig = function (updates) {
        this.config = __assign(__assign({}, this.config), updates);
    };
    return LLBDSConfig;
}());
exports.LLBDSConfig = LLBDSConfig;
