import { LSEBridge } from '../bridge/LSEBridge';

/**
 * LLBDS Event Handler
 * 
 * Handles LLBDS server events and forwards them to the external service
 * for transmission to the Mochi-Link management system.
 * 
 * @author chm413
 * @version 1.0.0
 */
export class LLBDSEventHandler {
    private lseBridge: LSEBridge;
    private registeredEvents: Set<string> = new Set();
    
    constructor(lseBridge: LSEBridge) {
        this.lseBridge = lseBridge;
    }
    
    /**
     * Register all LLBDS event listeners
     */
    public registerEvents(): void {
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
            
        } catch (error) {
            logger.error('Failed to register LLBDS event handlers:', error);
        }
    }
    
    /**
     * Unregister all event listeners
     */
    public unregisterEvents(): void {
        try {
            // LLBDS doesn't have a direct way to unregister events
            // Events are automatically cleaned up when the plugin is unloaded
            this.registeredEvents.clear();
            
            logger.info('LLBDS event handlers unregistered');
            logger.info('LLBDS 事件处理器已注销');
            
        } catch (error) {
            logger.error('Failed to unregister LLBDS event handlers:', error);
        }
    }
    
    /**
     * Register player join event
     */
    private registerPlayerJoinEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onJoin', (player: any) => {
                try {
                    const event = {
                        type: 'player.join',
                        data: {
                            player: this.toPlayer(player),
                            firstJoin: false,
                            joinMessage: `${player.name || player.realName || 'Player'} joined the game`
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling player join event:', error);
                }
            });
            
            this.registeredEvents.add('onJoin');
        }
    }
    
    /**
     * Register player leave event
     */
    private registerPlayerLeaveEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onLeft', (player: any) => {
                try {
                    const event = {
                        type: 'player.leave',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            reason: 'disconnect',
                            leaveMessage: `${player.name || player.realName || 'Player'} left the game`,
                            playTime: typeof player.joinTime === 'number'
                                ? Math.max(0, Date.now() - player.joinTime)
                                : 0
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling player leave event:', error);
                }
            });
            
            this.registeredEvents.add('onLeft');
        }
    }
    
    /**
     * Register player chat event
     */
    private registerPlayerChatEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onChat', (player: any, msg: string) => {
                try {
                    const event = {
                        type: 'player.chat',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            message: msg,
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling player chat event:', error);
                }
            });
            
            this.registeredEvents.add('onChat');
        }
    }
    
    /**
     * Register player death event
     */
    private registerPlayerDeathEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onPlayerDie', (player: any, source: any) => {
                try {
                    const event = {
                        type: 'player.death',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            cause: source?.type || 'unknown',
                            deathMessage: `${player.name} died`,
                            location: {
                                x: Number(player.pos?.x || 0),
                                y: Number(player.pos?.y || 0),
                                z: Number(player.pos?.z || 0),
                                ...(player.pos?.dimid !== undefined ? { dimension: Number(player.pos.dimid) } : {})
                            },
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling player death event:', error);
                }
            });
            
            this.registeredEvents.add('onPlayerDie');
        }
    }
    
    /**
     * Register server start event
     */
    private registerServerStartEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onServerStarted', () => {
                try {
                    const event = {
                        type: 'server.start',
                        data: {
                            status: 'online',
                            version: mc.getBDSVersion?.() || 'Unknown'
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling server start event:', error);
                }
            });
            
            this.registeredEvents.add('onServerStarted');
        }
    }
    
    /**
     * Register server stop event
     */
    private registerServerStopEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onServerStop', () => {
                try {
                    const event = {
                        type: 'server.stop',
                        data: {
                            status: 'offline',
                            uptime: process.uptime?.() || 0
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling server stop event:', error);
                }
            });
            
            this.registeredEvents.add('onServerStop');
        }
    }
    
    /**
     * Register block place event
     */
    private registerBlockPlaceEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onBlockPlaced', (player: any, block: any) => {
                try {
                    const event = {
                        type: 'world.block_place',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            blockType: block.type || 'unknown',
                            position: {
                                x: block.pos?.x || 0,
                                y: block.pos?.y || 0,
                                z: block.pos?.z || 0,
                                dimension: block.pos?.dimid || 0
                            },
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling block place event:', error);
                }
            });
            
            this.registeredEvents.add('onBlockPlaced');
        }
    }
    
    /**
     * Register block break event
     */
    private registerBlockBreakEvent(): void {
        if (typeof mc !== 'undefined' && mc.listen) {
            mc.listen('onBlockDestroyed', (player: any, block: any) => {
                try {
                    const event = {
                        type: 'world.block_break',
                        data: {
                            playerId: player.xuid || player.uuid || player.name,
                            playerName: player.name || player.realName,
                            blockType: block.type || 'unknown',
                            position: {
                                x: block.pos?.x || 0,
                                y: block.pos?.y || 0,
                                z: block.pos?.z || 0,
                                dimension: block.pos?.dimid || 0
                            },
                            timestamp: Date.now()
                        },
                        timestamp: Date.now()
                    };
                    
                    this.forwardEvent(event);
                    
                } catch (error) {
                    logger.error('Error handling block break event:', error);
                }
            });
            
            this.registeredEvents.add('onBlockDestroyed');
        }
    }
    
    /**
     * Forward event to external service
     */
    private forwardEvent(event: any): void {
        try {
            // Forward through LSE bridge to external service
            this.lseBridge.forwardEventToExternal(event);
            
            logger.debug(`Event forwarded: ${event.type}`);
            
        } catch (error) {
            logger.error('Failed to forward event:', error);
        }
    }

    /** Convert an LLBDS player object to the required U-WBP Player shape. */
    private toPlayer(player: any): Record<string, any> {
        const name = String(player?.name || player?.realName || 'unknown');
        const position = player?.pos || player?.position || {};
        return {
            id: String(player?.xuid || player?.uuid || name),
            name,
            displayName: String(player?.realName || player?.name || name),
            world: String(player?.level?.name || player?.world?.name || player?.dimension || 'unknown'),
            position: {
                x: Number(position.x || 0),
                y: Number(position.y || 0),
                z: Number(position.z || 0),
                ...(position.yaw !== undefined ? { yaw: Number(position.yaw) } : {}),
                ...(position.pitch !== undefined ? { pitch: Number(position.pitch) } : {})
            },
            ping: Math.max(0, Number(player?.avgPing ?? player?.ping ?? 0)),
            isOp: Boolean(player?.isOP ?? player?.isOp ?? false),
            permissions: Array.isArray(player?.permissions) ? player.permissions.map(String) : [],
            edition: 'Bedrock',
            ...(player?.deviceTypeName ? { deviceType: String(player.deviceTypeName) } : {})
        };
    }
    
    /**
     * Get registered events
     */
    public getRegisteredEvents(): string[] {
        return Array.from(this.registeredEvents);
    }
    
    /**
     * Check if event is registered
     */
    public isEventRegistered(eventName: string): boolean {
        return this.registeredEvents.has(eventName);
    }
}
