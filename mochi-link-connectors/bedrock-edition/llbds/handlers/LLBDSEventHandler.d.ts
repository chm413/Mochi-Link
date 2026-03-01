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
export declare class LLBDSEventHandler {
    private lseBridge;
    private registeredEvents;
    constructor(lseBridge: LSEBridge);
    /**
     * Register all LLBDS event listeners
     */
    registerEvents(): void;
    /**
     * Unregister all event listeners
     */
    unregisterEvents(): void;
    /**
     * Register player join event
     */
    private registerPlayerJoinEvent;
    /**
     * Register player leave event
     */
    private registerPlayerLeaveEvent;
    /**
     * Register player chat event
     */
    private registerPlayerChatEvent;
    /**
     * Register player death event
     */
    private registerPlayerDeathEvent;
    /**
     * Register server start event
     */
    private registerServerStartEvent;
    /**
     * Register server stop event
     */
    private registerServerStopEvent;
    /**
     * Register block place event
     */
    private registerBlockPlaceEvent;
    /**
     * Register block break event
     */
    private registerBlockBreakEvent;
    /**
     * Forward event to external service
     */
    private forwardEvent;
    /**
     * Get registered events
     */
    getRegisteredEvents(): string[];
    /**
     * Check if event is registered
     */
    isEventRegistered(eventName: string): boolean;
}
//# sourceMappingURL=LLBDSEventHandler.d.ts.map