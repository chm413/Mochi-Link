import { LSEBridge } from '../bridge/LSEBridge';

/**
 * LLBDS Command Handler
 * 
 * Handles command registration and execution for LLBDS server
 * integration with the Mochi-Link management system.
 * 
 * @author chm413
 * @version 1.0.0
 */
export class LLBDSCommandHandler {
    private lseBridge: LSEBridge;
    private registeredCommands: Set<string> = new Set();
    
    constructor(lseBridge: LSEBridge) {
        this.lseBridge = lseBridge;
    }
    
    /**
     * Register all LLBDS commands
     */
    public registerCommands(): void {
        try {
            // Register main Mochi-Link command
            this.registerMochiLinkCommand();
            
            // Register utility commands
            this.registerStatusCommand();
            this.registerReloadCommand();
            
            logger.info('LLBDS command handlers registered successfully');
            logger.info('LLBDS 命令处理器注册成功');
            
        } catch (error) {
            logger.error('Failed to register LLBDS command handlers:', error);
        }
    }
    
    /**
     * Unregister all commands
     */
    public unregisterCommands(): void {
        try {
            // LLBDS doesn't have a direct way to unregister commands
            // Commands are automatically cleaned up when the plugin is unloaded
            this.registeredCommands.clear();
            
            logger.info('LLBDS command handlers unregistered');
            logger.info('LLBDS 命令处理器已注销');
            
        } catch (error) {
            logger.error('Failed to unregister LLBDS command handlers:', error);
        }
    }
    
    /**
     * Register main Mochi-Link command
     */
    private registerMochiLinkCommand(): void {
        if (typeof mc !== 'undefined' && mc.regPlayerCmd) {
            mc.regPlayerCmd('mochilink', 'Mochi-Link connector management', (player: any, args: string[]) => {
                try {
                    if (args.length === 0) {
                        this.sendHelpMessage(player);
                        return;
                    }
                    
                    const subCommand = args[0].toLowerCase();
                    
                    switch (subCommand) {
                        case 'status':
                            this.handleStatusCommand(player);
                            break;
                            
                        case 'reload':
                            this.handleReloadCommand(player);
                            break;
                            
                        case 'connect':
                            this.handleConnectCommand(player);
                            break;
                            
                        case 'disconnect':
                            this.handleDisconnectCommand(player);
                            break;
                            
                        case 'info':
                            this.handleInfoCommand(player);
                            break;
                            
                        default:
                            player.tell('§c未知的子命令。使用 /mochilink help 查看帮助。');
                            break;
                    }
                    
                } catch (error) {
                    logger.error('Error handling mochilink command:', error);
                    player.tell('§c命令执行时发生错误。');
                }
            });
            
            this.registeredCommands.add('mochilink');
        }
        
        // Also register console command
        if (typeof mc !== 'undefined' && mc.regConsoleCmd) {
            mc.regConsoleCmd('mochilink', 'Mochi-Link connector management', (args: string[]) => {
                try {
                    if (args.length === 0) {
                        logger.info('Mochi-Link Console Commands:');
                        logger.info('  mochilink status - Show connection status');
                        logger.info('  mochilink reload - Reload configuration');
                        logger.info('  mochilink connect - Connect to Mochi-Link');
                        logger.info('  mochilink disconnect - Disconnect from Mochi-Link');
                        return;
                    }
                    
                    const subCommand = args[0].toLowerCase();
                    
                    switch (subCommand) {
                        case 'status':
                            this.handleConsoleStatusCommand();
                            break;
                            
                        case 'reload':
                            this.handleConsoleReloadCommand();
                            break;
                            
                        case 'connect':
                            this.handleConsoleConnectCommand();
                            break;
                            
                        case 'disconnect':
                            this.handleConsoleDisconnectCommand();
                            break;
                            
                        default:
                            logger.info('Unknown subcommand. Use /mochilink for help.');
                            break;
                    }
                    
                } catch (error) {
                    logger.error('Error handling console mochilink command:', error);
                }
            });
        }
    }
    
    /**
     * Register status command
     */
    private registerStatusCommand(): void {
        if (typeof mc !== 'undefined' && mc.regPlayerCmd) {
            mc.regPlayerCmd('mlstatus', 'Show Mochi-Link connection status', (player: any) => {
                this.handleStatusCommand(player);
            });
            
            this.registeredCommands.add('mlstatus');
        }
    }
    
    /**
     * Register reload command
     */
    private registerReloadCommand(): void {
        if (typeof mc !== 'undefined' && mc.regPlayerCmd) {
            mc.regPlayerCmd('mlreload', 'Reload Mochi-Link configuration', (player: any) => {
                if (!player.isOP()) {
                    player.tell('§c你没有权限执行此命令。');
                    return;
                }
                
                this.handleReloadCommand(player);
            });
            
            this.registeredCommands.add('mlreload');
        }
    }
    
    /**
     * Send help message to player
     */
    private sendHelpMessage(player: any): void {
        player.tell('§6=== Mochi-Link 连接器帮助 ===');
        player.tell('§e/mochilink status §7- 显示连接状态');
        player.tell('§e/mochilink reload §7- 重载配置 (需要OP权限)');
        player.tell('§e/mochilink connect §7- 连接到大福连系统');
        player.tell('§e/mochilink disconnect §7- 断开连接');
        player.tell('§e/mochilink info §7- 显示连接器信息');
    }
    
    /**
     * Handle status command
     */
    private handleStatusCommand(player: any): void {
        try {
            const status = this.lseBridge.isRunning() ? '§a已连接' : '§c未连接';
            const port = this.lseBridge.getPort();
            
            player.tell('§6=== Mochi-Link 状态 ===');
            player.tell(`§7LSE桥接器状态: ${status}`);
            player.tell(`§7HTTP端口: §e${port}`);
            player.tell(`§7服务器时间: §e${new Date().toLocaleString()}`);
            
        } catch (error) {
            logger.error('Error handling status command:', error);
            player.tell('§c获取状态信息时发生错误。');
        }
    }
    
    /**
     * Handle reload command
     */
    private handleReloadCommand(player: any): void {
        try {
            if (!player.isOP()) {
                player.tell('§c你没有权限执行此命令。');
                return;
            }
            
            player.tell('§e正在重载Mochi-Link配置...');
            
            // Trigger configuration reload through LSE bridge
            this.lseBridge.emit('reload-config');
            
            player.tell('§a配置重载完成！');
            
        } catch (error) {
            logger.error('Error handling reload command:', error);
            player.tell('§c重载配置时发生错误。');
        }
    }
    
    /**
     * Handle connect command
     */
    private handleConnectCommand(player: any): void {
        try {
            if (this.lseBridge.isRunning()) {
                player.tell('§e已经连接到Mochi-Link系统。');
                return;
            }
            
            player.tell('§e正在连接到Mochi-Link系统...');
            
            // Trigger connection through LSE bridge
            this.lseBridge.emit('connect');
            
            setTimeout(() => {
                if (this.lseBridge.isRunning()) {
                    player.tell('§a成功连接到Mochi-Link系统！');
                } else {
                    player.tell('§c连接失败，请检查配置和网络。');
                }
            }, 3000);
            
        } catch (error) {
            logger.error('Error handling connect command:', error);
            player.tell('§c连接时发生错误。');
        }
    }
    
    /**
     * Handle disconnect command
     */
    private handleDisconnectCommand(player: any): void {
        try {
            if (!this.lseBridge.isRunning()) {
                player.tell('§e当前未连接到Mochi-Link系统。');
                return;
            }
            
            player.tell('§e正在断开与Mochi-Link系统的连接...');
            
            // Trigger disconnection through LSE bridge
            this.lseBridge.emit('disconnect');
            
            player.tell('§a已断开与Mochi-Link系统的连接。');
            
        } catch (error) {
            logger.error('Error handling disconnect command:', error);
            player.tell('§c断开连接时发生错误。');
        }
    }
    
    /**
     * Handle info command
     */
    private handleInfoCommand(player: any): void {
        try {
            player.tell('§6=== Mochi-Link 连接器信息 ===');
            player.tell('§7版本: §e1.0.0');
            player.tell('§7作者: §echm413');
            player.tell('§7服务器类型: §eLLBDS');
            player.tell('§7协议版本: §eU-WBP v2.0');
            player.tell('§7LSE桥接器端口: §e' + this.lseBridge.getPort());
            
        } catch (error) {
            logger.error('Error handling info command:', error);
            player.tell('§c获取信息时发生错误。');
        }
    }
    
    // Console command handlers
    private handleConsoleStatusCommand(): void {
        try {
            const status = this.lseBridge.isRunning() ? 'Connected' : 'Disconnected';
            const port = this.lseBridge.getPort();
            
            logger.info('=== Mochi-Link Status ===');
            logger.info(`LSE Bridge Status: ${status}`);
            logger.info(`HTTP Port: ${port}`);
            logger.info(`Server Time: ${new Date().toLocaleString()}`);
            
        } catch (error) {
            logger.error('Error handling console status command:', error);
        }
    }
    
    private handleConsoleReloadCommand(): void {
        try {
            logger.info('Reloading Mochi-Link configuration...');
            
            // Trigger configuration reload through LSE bridge
            this.lseBridge.emit('reload-config');
            
            logger.info('Configuration reloaded successfully!');
            
        } catch (error) {
            logger.error('Error handling console reload command:', error);
        }
    }
    
    private handleConsoleConnectCommand(): void {
        try {
            if (this.lseBridge.isRunning()) {
                logger.info('Already connected to Mochi-Link system.');
                return;
            }
            
            logger.info('Connecting to Mochi-Link system...');
            
            // Trigger connection through LSE bridge
            this.lseBridge.emit('connect');
            
        } catch (error) {
            logger.error('Error handling console connect command:', error);
        }
    }
    
    private handleConsoleDisconnectCommand(): void {
        try {
            if (!this.lseBridge.isRunning()) {
                logger.info('Not currently connected to Mochi-Link system.');
                return;
            }
            
            logger.info('Disconnecting from Mochi-Link system...');
            
            // Trigger disconnection through LSE bridge
            this.lseBridge.emit('disconnect');
            
            logger.info('Disconnected from Mochi-Link system.');
            
        } catch (error) {
            logger.error('Error handling console disconnect command:', error);
        }
    }
    
    /**
     * Get registered commands
     */
    public getRegisteredCommands(): string[] {
        return Array.from(this.registeredCommands);
    }
    
    /**
     * Check if command is registered
     */
    public isCommandRegistered(commandName: string): boolean {
        return this.registeredCommands.has(commandName);
    }
}