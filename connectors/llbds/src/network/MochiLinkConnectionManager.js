"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MochiLinkConnectionManager = void 0;
var WebSocket = require("ws");
var events_1 = require("events");
/**
 * Mochi-Link Connection Manager
 *
 * Manages WebSocket connection to the Mochi-Link management system
 * from the external Node.js service.
 *
 * @author chm413
 * @version 1.0.0
 */
var MochiLinkConnectionManager = /** @class */ (function (_super) {
    __extends(MochiLinkConnectionManager, _super);
    function MochiLinkConnectionManager(config, logger) {
        var _this = _super.call(this) || this;
        _this.ws = null;
        _this._isConnected = false;
        _this._isConnecting = false;
        _this.reconnectAttempts = 0;
        _this.maxReconnectAttempts = 10;
        _this.reconnectDelay = 5000;
        _this.heartbeatInterval = null;
        _this.connectionTimeout = null;
        _this.messageQueue = [];
        _this.pendingMessages = new Map();
        _this.config = config;
        _this.logger = logger;
        _this.maxReconnectAttempts = config.getRetryAttempts();
        _this.reconnectDelay = config.getRetryDelay();
        return _this;
    }
    /**
     * Connect to Mochi-Link management system
     */
    MochiLinkConnectionManager.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var host, port, path, serverId, wsUrl;
            var _this = this;
            return __generator(this, function (_a) {
                if (this.isConnected || this.isConnecting) {
                    return [2 /*return*/];
                }
                this._isConnecting = true;
                try {
                    host = this.config.getMochiLinkHost();
                    port = this.config.getMochiLinkPort();
                    path = this.config.getMochiLinkPath();
                    serverId = this.config.getServerId();
                    wsUrl = "ws://".concat(host, ":").concat(port).concat(path, "?serverId=").concat(encodeURIComponent(serverId));
                    this.logger.info("Connecting to Mochi-Link at ".concat(wsUrl, "..."));
                    this.ws = new WebSocket(wsUrl, {
                        headers: {
                            'X-Server-Id': serverId,
                            'X-Server-Type': 'LLBDS',
                            'X-Protocol-Version': '2.0',
                            'Authorization': "Bearer ".concat(this.config.getAuthToken())
                        },
                        handshakeTimeout: this.config.getTimeout()
                    });
                    this.setupWebSocketHandlers();
                    // Set connection timeout
                    this.connectionTimeout = setTimeout(function () {
                        if (!_this.isConnected) {
                            _this.logger.error('Connection timeout');
                            _this.handleConnectionError(new Error('Connection timeout'));
                        }
                    }, this.config.getTimeout());
                }
                catch (error) {
                    this._isConnecting = false;
                    this.logger.error('Failed to initiate connection:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Disconnect from Mochi-Link
     */
    MochiLinkConnectionManager.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.logger.info('Disconnecting from Mochi-Link...');
                // Clear intervals and timeouts
                this.clearHeartbeat();
                this.clearConnectionTimeout();
                // Close WebSocket connection
                if (this.ws) {
                    this.ws.close(1000, 'Normal closure');
                    this.ws = null;
                }
                this._isConnected = false;
                this._isConnecting = false;
                this.reconnectAttempts = 0;
                this.emit('disconnect');
                return [2 /*return*/];
            });
        });
    };
    /**
     * Send message to Mochi-Link
     */
    MochiLinkConnectionManager.prototype.send = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var messageStr;
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.isConnected || !this.ws) {
                    // Queue message for later sending
                    this.messageQueue.push(message);
                    this.logger.debug('Message queued (not connected):', message.type || 'unknown');
                    return [2 /*return*/];
                }
                try {
                    messageStr = JSON.stringify(message);
                    this.ws.send(messageStr);
                    this.logger.debug('Message sent:', message.type || 'unknown');
                    // Track pending messages that expect responses
                    if (message.id && message.type !== 'response') {
                        this.pendingMessages.set(message.id, {
                            message: message,
                            timestamp: Date.now()
                        });
                        // Clean up pending message after timeout
                        setTimeout(function () {
                            _this.pendingMessages.delete(message.id);
                        }, 30000);
                    }
                }
                catch (error) {
                    this.logger.error('Failed to send message:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Setup WebSocket event handlers
     */
    MochiLinkConnectionManager.prototype.setupWebSocketHandlers = function () {
        var _this = this;
        if (!this.ws)
            return;
        this.ws.on('open', function () {
            _this.handleConnectionOpen();
        });
        this.ws.on('message', function (data) {
            _this.handleMessage(data);
        });
        this.ws.on('close', function (code, reason) {
            _this.handleConnectionClose(code, reason);
        });
        this.ws.on('error', function (error) {
            _this.handleConnectionError(error);
        });
        this.ws.on('ping', function (data) {
            var _a;
            (_a = _this.ws) === null || _a === void 0 ? void 0 : _a.pong(data);
        });
        this.ws.on('pong', function () {
            _this.logger.debug('Received pong from server');
        });
    };
    /**
     * Handle connection open
     */
    MochiLinkConnectionManager.prototype.handleConnectionOpen = function () {
        this.logger.info('Connected to Mochi-Link management system!');
        this._isConnected = true;
        this._isConnecting = false;
        this.reconnectAttempts = 0;
        this.clearConnectionTimeout();
        this.startHeartbeat();
        // Send queued messages
        this.sendQueuedMessages();
        this.emit('connect');
    };
    /**
     * Handle incoming message
     */
    MochiLinkConnectionManager.prototype.handleMessage = function (data) {
        try {
            var message = JSON.parse(data.toString());
            this.logger.debug('Received message:', message.type || 'unknown');
            // Handle system messages
            if (message.type === 'system') {
                this.handleSystemMessage(message);
                return;
            }
            // Handle responses to pending messages
            if (message.type === 'response' && message.id) {
                var pending_1 = this.pendingMessages.get(message.id);
                if (pending_1) {
                    this.pendingMessages.delete(message.id);
                    this.emit('response', message, pending_1.message);
                    return;
                }
            }
            // Emit message for handling by external service
            this.emit('message', message);
        }
        catch (error) {
            this.logger.error('Failed to parse incoming message:', error);
        }
    };
    /**
     * Handle system messages
     */
    MochiLinkConnectionManager.prototype.handleSystemMessage = function (message) {
        switch (message.systemOp || message.op) {
            case 'handshake':
                this.handleHandshake(message);
                break;
            case 'ping':
                this.handlePing(message);
                break;
            case 'disconnect':
                this.handleDisconnectRequest(message);
                break;
            default:
                this.logger.warn('Unknown system message:', message.systemOp || message.op);
        }
    };
    /**
     * Handle handshake message
     */
    MochiLinkConnectionManager.prototype.handleHandshake = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        response = {
                            type: 'system',
                            id: message.id,
                            op: 'handshake_response',
                            data: {
                                serverId: this.config.getServerId(),
                                serverName: this.config.getServerName(),
                                serverType: 'LLBDS',
                                protocolVersion: '2.0',
                                capabilities: [
                                    'player_management',
                                    'command_execution',
                                    'performance_monitoring',
                                    'event_streaming',
                                    'whitelist_management',
                                    'ban_management'
                                ],
                                authentication: {
                                    token: this.config.getAuthToken()
                                }
                            },
                            timestamp: Date.now(),
                            version: '2.0',
                            systemOp: 'handshake_response'
                        };
                        return [4 /*yield*/, this.send(response)];
                    case 1:
                        _a.sent();
                        this.logger.info('Handshake completed successfully');
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        this.logger.error('Failed to handle handshake:', error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle ping message
     */
    MochiLinkConnectionManager.prototype.handlePing = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        response = {
                            type: 'system',
                            id: message.id,
                            op: 'pong',
                            data: {
                                timestamp: Date.now(),
                                serverId: this.config.getServerId()
                            },
                            timestamp: Date.now(),
                            version: '2.0',
                            systemOp: 'pong'
                        };
                        return [4 /*yield*/, this.send(response)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        this.logger.error('Failed to handle ping:', error_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle disconnect request
     */
    MochiLinkConnectionManager.prototype.handleDisconnectRequest = function (message) {
        this.logger.info('Received disconnect request from server');
        this.disconnect();
    };
    /**
     * Handle connection close
     */
    MochiLinkConnectionManager.prototype.handleConnectionClose = function (code, reason) {
        this.logger.warn("Connection closed: ".concat(code, " - ").concat(reason));
        this._isConnected = false;
        this._isConnecting = false;
        this.clearHeartbeat();
        this.clearConnectionTimeout();
        this.emit('disconnect', code, reason);
        // Attempt reconnection if not a normal closure
        if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    };
    /**
     * Handle connection error
     */
    MochiLinkConnectionManager.prototype.handleConnectionError = function (error) {
        this.logger.error('WebSocket connection error:', error);
        this._isConnected = false;
        this._isConnecting = false;
        this.clearHeartbeat();
        this.clearConnectionTimeout();
        this.emit('error', error);
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    };
    /**
     * Schedule reconnection attempt
     */
    MochiLinkConnectionManager.prototype.scheduleReconnect = function () {
        var _this = this;
        this.reconnectAttempts++;
        var delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        this.logger.info("Scheduling reconnection attempt ".concat(this.reconnectAttempts, "/").concat(this.maxReconnectAttempts, " in ").concat(delay, "ms"));
        setTimeout(function () {
            if (!_this.isConnected && !_this.isConnecting) {
                _this.connect().catch(function (error) {
                    _this.logger.error('Reconnection attempt failed:', error);
                });
            }
        }, delay);
    };
    /**
     * Start heartbeat
     */
    MochiLinkConnectionManager.prototype.startHeartbeat = function () {
        var _this = this;
        this.clearHeartbeat();
        this.heartbeatInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var heartbeat, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isConnected) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        heartbeat = {
                            type: 'heartbeat',
                            timestamp: Date.now(),
                            serverId: this.config.getServerId()
                        };
                        return [4 /*yield*/, this.send(heartbeat)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        this.logger.error('Failed to send heartbeat:', error_3);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); }, 30000); // 30 seconds
    };
    /**
     * Clear heartbeat interval
     */
    MochiLinkConnectionManager.prototype.clearHeartbeat = function () {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    };
    /**
     * Clear connection timeout
     */
    MochiLinkConnectionManager.prototype.clearConnectionTimeout = function () {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    };
    /**
     * Send queued messages
     */
    MochiLinkConnectionManager.prototype.sendQueuedMessages = function () {
        return __awaiter(this, void 0, void 0, function () {
            var messages, _i, messages_1, message, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.messageQueue.length === 0) {
                            return [2 /*return*/];
                        }
                        this.logger.info("Sending ".concat(this.messageQueue.length, " queued messages"));
                        messages = __spreadArray([], this.messageQueue, true);
                        this.messageQueue = [];
                        _i = 0, messages_1 = messages;
                        _a.label = 1;
                    case 1:
                        if (!(_i < messages_1.length)) return [3 /*break*/, 6];
                        message = messages_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.send(message)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_4 = _a.sent();
                        this.logger.error('Failed to send queued message:', error_4);
                        // Re-queue failed message
                        this.messageQueue.push(message);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if connected
     */
    MochiLinkConnectionManager.prototype.isConnected = function () {
        return this._isConnected;
    };
    /**
     * Check if connecting
     */
    MochiLinkConnectionManager.prototype.isConnecting = function () {
        return this._isConnecting;
    };
    /**
     * Get connection status
     */
    MochiLinkConnectionManager.prototype.getConnectionStatus = function () {
        if (this.isConnected) {
            return 'connected';
        }
        else if (this.isConnecting) {
            return 'connecting';
        }
        else {
            return 'disconnected';
        }
    };
    /**
     * Get connection statistics
     */
    MochiLinkConnectionManager.prototype.getConnectionStats = function () {
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            queuedMessages: this.messageQueue.length,
            pendingMessages: this.pendingMessages.size,
            lastConnectTime: this.isConnected ? Date.now() : null
        };
    };
    /**
     * Reset connection state
     */
    MochiLinkConnectionManager.prototype.reset = function () {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.messageQueue = [];
        this.pendingMessages.clear();
    };
    return MochiLinkConnectionManager;
}(events_1.EventEmitter));
exports.MochiLinkConnectionManager = MochiLinkConnectionManager;
