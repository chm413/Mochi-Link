"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLBDSEventHandler = void 0;
/**
 * LLBDS Event Handler
 *
 * Handles LLBDS server events and forwards them to the external service
 * for transmission to the Mochi-Link management system.
 *
 * @author chm413
 * @version 1.0.0
 */
var LLBDSEventHandler = /** @class */ (function () {
    function LLBDSEventHandler(lseBridge) {
        this.registeredEvents = new Set();
        this.lseBridge = lseBridge;
    }
    /**
     * Register all LLBDS event listeners
     */
    LLBDSEventHandler.prototype.registerEvents = function () {
        try {
            // Player events
            this.registerPlayerJoinEvent();
            this.registerPlayerLeaveEvent();
            this.registerPlayerChatEvent();
            this.registerPlayerDeathEvent();
            // Server events
            this.registerServerStartEvent();
            this.registerServerStopEvent();
            // World events
            this.registerBlockPlaceEvent();
            this.registerBlockBreakEvent();
            logger.info('LLBDS event handlers registered successfully');
            logger.info('LLBDS 事件处理器注册成功');
        }
        catch (error) {
            logger.error('Failed to register LLBDS event handlers:', error);
        }
    };
    /**
     * Unregister all event listeners
     */
    LLBDSEventHandler.prototype.unregisterEvents = function () {
        try {
            // LLBDS doesn't have a direct way to unregister events
            // Events are automatically cleaned up when the plugin is unloaded
            this.registeredEvents.clear();
            logger.info('LLBDS event handlers unregistered');
            logger.info('LLBDS 事件处理器已注销');
        }
        catch (error) {
            logger.error('Failed to unregister LLBDS event handlers:', error);
        }
    };
    /**
     * Register player join event
     */
    LLBDSEventHandler.prototype.registerPlayerJoinEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onJoin', function (player) {
                try {
                    var event_1 = {
                        type: 'player.join',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            playerUUID: player.uuid || '',
                            playerXUID: player.xuid || '',
                            ip: player.ip || '',
                            device: player.deviceTypeName || 'Unknown',
                            joinTime: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_1);
                }
                catch (error) {
                    logger.error('Error handling player join event:', error);
                }
            });
            this.registeredEvents.add('onJoin');
        }
    };
    /**
     * Register player leave event
     */
    LLBDSEventHandler.prototype.registerPlayerLeaveEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onLeft', function (player) {
                try {
                    var event_2 = {
                        type: 'player.leave',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            playerUUID: player.uuid || '',
                            playerXUID: player.xuid || '',
                            leaveTime: Date.now(),
                            reason: 'disconnect'
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_2);
                }
                catch (error) {
                    logger.error('Error handling player leave event:', error);
                }
            });
            this.registeredEvents.add('onLeft');
        }
    };
    /**
     * Register player chat event
     */
    LLBDSEventHandler.prototype.registerPlayerChatEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onChat', function (player, msg) {
                try {
                    var event_3 = {
                        type: 'player.chat',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            message: msg,
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_3);
                }
                catch (error) {
                    logger.error('Error handling player chat event:', error);
                }
            });
            this.registeredEvents.add('onChat');
        }
    };
    /**
     * Register player death event
     */
    LLBDSEventHandler.prototype.registerPlayerDeathEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onPlayerDie', function (player, source) {
                try {
                    var event_4 = {
                        type: 'player.death',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            deathCause: (source === null || source === void 0 ? void 0 : source.type) || 'unknown',
                            deathMessage: "".concat(player.name, " died"),
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_4);
                }
                catch (error) {
                    logger.error('Error handling player death event:', error);
                }
            });
            this.registeredEvents.add('onPlayerDie');
        }
    };
    /**
     * Register server start event
     */
    LLBDSEventHandler.prototype.registerServerStartEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onServerStarted', function () {
                var _a;
                try {
                    var event_5 = {
                        type: 'server.start',
                        data: {
                            serverVersion: ((_a = mc.getBDSVersion) === null || _a === void 0 ? void 0 : _a.call(mc)) || 'Unknown',
                            startTime: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_5);
                }
                catch (error) {
                    logger.error('Error handling server start event:', error);
                }
            });
            this.registeredEvents.add('onServerStarted');
        }
    };
    /**
     * Register server stop event
     */
    LLBDSEventHandler.prototype.registerServerStopEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onServerStop', function () {
                var _a;
                try {
                    var event_6 = {
                        type: 'server.stop',
                        data: {
                            stopTime: Date.now(),
                            uptime: ((_a = process.uptime) === null || _a === void 0 ? void 0 : _a.call(process)) || 0
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_6);
                }
                catch (error) {
                    logger.error('Error handling server stop event:', error);
                }
            });
            this.registeredEvents.add('onServerStop');
        }
    };
    /**
     * Register block place event
     */
    LLBDSEventHandler.prototype.registerBlockPlaceEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onBlockPlaced', function (player, block) {
                var _a, _b, _c, _d;
                try {
                    var event_7 = {
                        type: 'world.block_place',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            blockType: block.type || 'unknown',
                            position: {
                                x: ((_a = block.pos) === null || _a === void 0 ? void 0 : _a.x) || 0,
                                y: ((_b = block.pos) === null || _b === void 0 ? void 0 : _b.y) || 0,
                                z: ((_c = block.pos) === null || _c === void 0 ? void 0 : _c.z) || 0,
                                dimension: ((_d = block.pos) === null || _d === void 0 ? void 0 : _d.dimid) || 0
                            },
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_7);
                }
                catch (error) {
                    logger.error('Error handling block place event:', error);
                }
            });
            this.registeredEvents.add('onBlockPlaced');
        }
    };
    /**
     * Register block break event
     */
    LLBDSEventHandler.prototype.registerBlockBreakEvent = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onBlockDestroyed', function (player, block) {
                var _a, _b, _c, _d;
                try {
                    var event_8 = {
                        type: 'world.block_break',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            blockType: block.type || 'unknown',
                            position: {
                                x: ((_a = block.pos) === null || _a === void 0 ? void 0 : _a.x) || 0,
                                y: ((_b = block.pos) === null || _b === void 0 ? void 0 : _b.y) || 0,
                                z: ((_c = block.pos) === null || _c === void 0 ? void 0 : _c.z) || 0,
                                dimension: ((_d = block.pos) === null || _d === void 0 ? void 0 : _d.dimid) || 0
                            },
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    _this.forwardEvent(event_8);
                }
                catch (error) {
                    logger.error('Error handling block break event:', error);
                }
            });
            this.registeredEvents.add('onBlockDestroyed');
        }
    };
    /**
     * Forward event to external service
     */
    LLBDSEventHandler.prototype.forwardEvent = function (event) {
        try {
            // Forward through LSE bridge to external service
            this.lseBridge.forwardEventToExternal(event);
            logger.debug("Event forwarded: ".concat(event.type));
        }
        catch (error) {
            logger.error('Failed to forward event:', error);
        }
    };
    /**
     * Get registered events
     */
    LLBDSEventHandler.prototype.getRegisteredEvents = function () {
        return Array.from(this.registeredEvents);
    };
    /**
     * Check if event is registered
     */
    LLBDSEventHandler.prototype.isEventRegistered = function (eventName) {
        return this.registeredEvents.has(eventName);
    };
    return LLBDSEventHandler;
}());
exports.LLBDSEventHandler = LLBDSEventHandler;
