/**
 * Mochi-Link (大福连) - Message Routing Service
 *
 * This service handles message routing between chat groups and Minecraft servers
 * based on the configured bindings and routing rules.
 */
import { Context } from 'koishi';
import { BindingManager } from './binding';
import { EventService } from './event';
import { EventEmitter } from 'events';
export interface IncomingMessage {
    groupId: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
    messageId?: string;
    replyTo?: string;
}
export interface OutgoingMessage {
    serverId: string;
    content: string;
    format: 'chat' | 'broadcast' | 'command';
    metadata?: {
        originalGroupId: string;
        originalUserId: string;
        originalUserName: string;
        timestamp: number;
    };
}
export interface ServerEvent {
    serverId: string;
    eventType: string;
    data: any;
    timestamp: string;
}
export interface GroupMessage {
    groupId: string;
    content: string;
    format?: string;
    metadata?: {
        serverId: string;
        eventType: string;
        timestamp: string | number;
    };
}
export interface RoutingStats {
    messagesRouted24h: number;
    eventsRouted24h: number;
    routingErrors24h: number;
    activeRoutes: number;
    messagesByGroup: Record<string, number>;
    messagesByServer: Record<string, number>;
}
export declare class MessageRouter extends EventEmitter {
    private ctx;
    private bindingManager;
    private eventService;
    private logger;
    private routingStats;
    constructor(ctx: Context, bindingManager: BindingManager, eventService: EventService);
    /**
     * Route a message from a group to bound servers
     */
    routeGroupMessage(message: IncomingMessage): Promise<void>;
    /**
     * Route a server event to bound groups
     */
    routeServerEvent(event: ServerEvent): Promise<void>;
    /**
     * Process a message from group to server
     */
    private processGroupToServerMessage;
    /**
     * Process an event from server to group
     */
    private processServerToGroupEvent;
    /**
     * Apply message filters to content
     */
    private applyMessageFilters;
    /**
     * Apply event filters
     */
    private applyEventFilters;
    /**
     * Format message for server
     */
    private formatMessage;
    /**
     * Format event message for group
     */
    private formatEventMessage;
    private rateLimitCache;
    /**
     * Check rate limit for group-server pair
     */
    private checkRateLimit;
    /**
     * Setup event listeners for incoming messages and events
     */
    private setupEventListeners;
    /**
     * Setup integration with event service
     */
    private setupEventServiceIntegration;
    /**
     * Handle incoming group message (called by external services)
     */
    handleGroupMessage(message: IncomingMessage): Promise<void>;
    /**
     * Handle incoming server event (called by event service)
     */
    handleServerEvent(event: ServerEvent): Promise<void>;
    /**
     * Get routing statistics
     */
    getRoutingStats(): RoutingStats;
    /**
     * Reset statistics (called daily)
     */
    resetDailyStats(): void;
    /**
     * Update active routes count
     */
    updateActiveRoutesCount(): Promise<void>;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
    /**
     * Cleanup service resources
     */
    cleanup(): Promise<void>;
}
