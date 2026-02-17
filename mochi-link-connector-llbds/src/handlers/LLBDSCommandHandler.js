"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLBDSCommandHandler = void 0;
/**
 * LLBDS Command Handler
 *
 * Handles command registration and execution for LLBDS server
 * integration with the Mochi-Link management system.
 *
 * @author chm413
 * @version 1.0.0
 */
var LLBDSCommandHandler = /** @class */ (function () {
    function LLBDSCommandHandler(lseBridge) {
        this.registeredCommands = new Set();
        this.lseBridge = lseBridge;
    }
    /**
     * Register all LLBDS commands
     */
    LLBDSCommandHandler.prototype.registerCommands = function () {
        try {
            // Register main Mochi-Link command
            this.registerMochiLinkCommand();
            // Register utility commands
            this.registerStatusCommand();
            this.registerReloadCommand();
            logger.info('LLBDS command handlers registered successfully');
            logger.info('LLBDS 命令处理器注册成功');
        }
        catch (error) {
            logger.error('Failed to register LLBDS command handlers:', error);
        }
    };
    /**
     * Unregister all commands
     */
    LLBDSCommandHandler.prototype.unregisterCommands = function () {
        try {
            // LLBDS doesn't have a direct way to unregister commands
            // Commands are automatically cleaned up when the plugin is unloaded
            this.registeredCommands.clear();
            logger.info('LLBDS command handlers unregistered');
            logger.info('LLBDS 命令处理器已注销');
        }
        catch (error) {
            logger.error('Failed to unregister LLBDS command handlers:', error);
        }
    };
    /**
     * Register main Mochi-Link command
     */
    LLBDSCommandHandler.prototype.registerMochiLinkCommand = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.regPlayerCmd) {
            mc.regPlayerCmd('mochilink', 'Mochi-Link connector management', function (player, args) {
                try {
                    if (args.length === 0) {
                        _this.sendHelpMessage(player);
                        return;
                    }
                    var subCommand = args[0].toLowerCase();
                    switch (subCommand) {
                        case 'status':
                            _this.handleStatusCommand(player);
                            break;
                        case 'reload':
                            _this.handleReloadCommand(player);
                            break;
                        case 'connect':
                            _this.handleConnectCommand(player);
                            break;
                        case 'disconnect':
                            _this.handleDisconnectCommand(player);
                            break;
                        case 'info':
                            _this.handleInfoCommand(player);
                            break;
                        default:
                            player.tell('§c未知的子命令。使用 /mochilink help 查看帮助。');
                            break;
                    }
                }
                catch (error) {
                    logger.error('Error handling mochilink command:', error);
                    player.tell('§c命令执行时发生错误。');
                }
            });
            this.registeredCommands.add('mochilink');
        }
        // Also register console command
        if (typeof mc !== 'undefined' && mc.regConsoleCmd) {
            mc.regConsoleCmd('mochilink', 'Mochi-Link connector management', function (args) {
                try {
                    if (args.length === 0) {
                        logger.info('Mochi-Link Console Commands:');
                        logger.info('  mochilink status - Show connection status');
                        logger.info('  mochilink reload - Reload configuration');
                        logger.info('  mochilink connect - Connect to Mochi-Link');
                        logger.info('  mochilink disconnect - Disconnect from Mochi-Link');
                        return;
                    }
                    var subCommand = args[0].toLowerCase();
                    switch (subCommand) {
                        case 'status':
                            _this.handleConsoleStatusCommand();
                            break;
                        case 'reload':
                            _this.handleConsoleReloadCommand();
                            break;
                        case 'connect':
                            _this.handleConsoleConnectCommand();
                            break;
                        case 'disconnect':
                            _this.handleConsoleDisconnectCommand();
                            break;
                        default:
                            logger.info('Unknown subcommand. Use /mochilink for help.');
                            break;
                    }
                }
                catch (error) {
                    logger.error('Error handling console mochilink command:', error);
                }
            });
        }
    };
    /**
     * Register status command
     */
    LLBDSCommandHandler.prototype.registerStatusCommand = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.regPlayerCmd) {
            mc.regPlayerCmd('mlstatus', 'Show Mochi-Link connection status', function (player) {
                _this.handleStatusCommand(player);
            });
            this.registeredCommands.add('mlstatus');
        }
    };
    /**
     * Register reload command
     */
    LLBDSCommandHandler.prototype.registerReloadCommand = function () {
        var _this = this;
        if (typeof mc !== 'undefined' && mc.regPlayerCmd) {
            mc.regPlayerCmd('mlreload', 'Reload Mochi-Link configuration', function (player) {
                if (!player.isOP()) {
                    player.tell('§c你没有权限执行此命令。');
                    return;
                }
                _this.handleReloadCommand(player);
            });
            this.registeredCommands.add('mlreload');
        }
    };
    /**
     * Send help message to player
     */
    LLBDSCommandHandler.prototype.sendHelpMessage = function (player) {
        player.tell('§6=== Mochi-Link 连接器帮助 ===');
        player.tell('§e/mochilink status §7- 显示连接状态');
        player.tell('§e/mochilink reload §7- 重载配置 (需要OP权限)');
        player.tell('§e/mochilink connect §7- 连接到大福连系统');
        player.tell('§e/mochilink disconnect §7- 断开连接');
        player.tell('§e/mochilink info §7- 显示连接器信息');
    };
    /**
     * Handle status command
     */
    LLBDSCommandHandler.prototype.handleStatusCommand = function (player) {
        try {
            var status_1 = this.lseBridge.isRunning() ? '§a已连接' : '§c未连接';
            var port = this.lseBridge.getPort();
            player.tell('§6=== Mochi-Link 状态 ===');
            player.tell("\u00A77LSE\u6865\u63A5\u5668\u72B6\u6001: ".concat(status_1));
            player.tell("\u00A77HTTP\u7AEF\u53E3: \u00A7e".concat(port));
            player.tell("\u00A77\u670D\u52A1\u5668\u65F6\u95F4: \u00A7e".concat(new Date().toLocaleString()));
        }
        catch (error) {
            logger.error('Error handling status command:', error);
            player.tell('§c获取状态信息时发生错误。');
        }
    };
    /**
     * Handle reload command
     */
    LLBDSCommandHandler.prototype.handleReloadCommand = function (player) {
        try {
            if (!player.isOP()) {
                player.tell('§c你没有权限执行此命令。');
                return;
            }
            player.tell('§e正在重载Mochi-Link配置...');
            // Trigger configuration reload through LSE bridge
            this.lseBridge.emit('reload-config');
            player.tell('§a配置重载完成！');
        }
        catch (error) {
            logger.error('Error handling reload command:', error);
            player.tell('§c重载配置时发生错误。');
        }
    };
    /**
     * Handle connect command
     */
    LLBDSCommandHandler.prototype.handleConnectCommand = function (player) {
        var _this = this;
        try {
            if (this.lseBridge.isRunning()) {
                player.tell('§e已经连接到Mochi-Link系统。');
                return;
            }
            player.tell('§e正在连接到Mochi-Link系统...');
            // Trigger connection through LSE bridge
            this.lseBridge.emit('connect');
            setTimeout(function () {
                if (_this.lseBridge.isRunning()) {
                    player.tell('§a成功连接到Mochi-Link系统！');
                }
                else {
                    player.tell('§c连接失败，请检查配置和网络。');
                }
            }, 3000);
        }
        catch (error) {
            logger.error('Error handling connect command:', error);
            player.tell('§c连接时发生错误。');
        }
    };
    /**
     * Handle disconnect command
     */
    LLBDSCommandHandler.prototype.handleDisconnectCommand = function (player) {
        try {
            if (!this.lseBridge.isRunning()) {
                player.tell('§e当前未连接到Mochi-Link系统。');
                return;
            }
            player.tell('§e正在断开与Mochi-Link系统的连接...');
            // Trigger disconnection through LSE bridge
            this.lseBridge.emit('disconnect');
            player.tell('§a已断开与Mochi-Link系统的连接。');
        }
        catch (error) {
            logger.error('Error handling disconnect command:', error);
            player.tell('§c断开连接时发生错误。');
        }
    };
    /**
     * Handle info command
     */
    LLBDSCommandHandler.prototype.handleInfoCommand = function (player) {
        try {
            player.tell('§6=== Mochi-Link 连接器信息 ===');
            player.tell('§7版本: §e1.0.0');
            player.tell('§7作者: §echm413');
            player.tell('§7服务器类型: §eLLBDS');
            player.tell('§7协议版本: §eU-WBP v2.0');
            player.tell('§7LSE桥接器端口: §e' + this.lseBridge.getPort());
        }
        catch (error) {
            logger.error('Error handling info command:', error);
            player.tell('§c获取信息时发生错误。');
        }
    };
    // Console command handlers
    LLBDSCommandHandler.prototype.handleConsoleStatusCommand = function () {
        try {
            var status_2 = this.lseBridge.isRunning() ? 'Connected' : 'Disconnected';
            var port = this.lseBridge.getPort();
            logger.info('=== Mochi-Link Status ===');
            logger.info("LSE Bridge Status: ".concat(status_2));
            logger.info("HTTP Port: ".concat(port));
            logger.info("Server Time: ".concat(new Date().toLocaleString()));
        }
        catch (error) {
            logger.error('Error handling console status command:', error);
        }
    };
    LLBDSCommandHandler.prototype.handleConsoleReloadCommand = function () {
        try {
            logger.info('Reloading Mochi-Link configuration...');
            // Trigger configuration reload through LSE bridge
            this.lseBridge.emit('reload-config');
            logger.info('Configuration reloaded successfully!');
        }
        catch (error) {
            logger.error('Error handling console reload command:', error);
        }
    };
    LLBDSCommandHandler.prototype.handleConsoleConnectCommand = function () {
        try {
            if (this.lseBridge.isRunning()) {
                logger.info('Already connected to Mochi-Link system.');
                return;
            }
            logger.info('Connecting to Mochi-Link system...');
            // Trigger connection through LSE bridge
            this.lseBridge.emit('connect');
        }
        catch (error) {
            logger.error('Error handling console connect command:', error);
        }
    };
    LLBDSCommandHandler.prototype.handleConsoleDisconnectCommand = function () {
        try {
            if (!this.lseBridge.isRunning()) {
                logger.info('Not currently connected to Mochi-Link system.');
                return;
            }
            logger.info('Disconnecting from Mochi-Link system...');
            // Trigger disconnection through LSE bridge
            this.lseBridge.emit('disconnect');
            logger.info('Disconnected from Mochi-Link system.');
        }
        catch (error) {
            logger.error('Error handling console disconnect command:', error);
        }
    };
    /**
     * Get registered commands
     */
    LLBDSCommandHandler.prototype.getRegisteredCommands = function () {
        return Array.from(this.registeredCommands);
    };
    /**
     * Check if command is registered
     */
    LLBDSCommandHandler.prototype.isCommandRegistered = function (commandName) {
        return this.registeredCommands.has(commandName);
    };
    return LLBDSCommandHandler;
}());
exports.LLBDSCommandHandler = LLBDSCommandHandler;
