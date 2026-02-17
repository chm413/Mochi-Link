/**
 * Event Service - Event Listening and Pushing System
 *
 * This service implements the event listening and pushing mechanism for the
 * Minecraft Unified Management and Monitoring System. It handles standard
 * event types, filtering, subscription, aggregation, and distribution.
 */
import { Context } from 'koishi';
import { EventType, BaseEvent, Connection } from '../types';
import { AuditService } from './audit';
export interface EventFilter {
    serverId?: string;
    eventTypes?: EventType[];
    playerId?: string;
    timeRange?: {
        start: Date;
        end: Date;
    };
    severity?: 'low' | 'medium' | 'high' | 'critical';
}
export interface EventSubscription {
    id: string;
    connectionId: string;
    serverId?: string;
    filter: EventFilter;
    createdAt: Date;
    lastActivity: Date;
    isActive: boolean;
}
export interface EventAggregation {
    serverId: string;
    eventType: EventType;
    count: number;
    timeWindow: number;
    lastReset: Date;
}
export interface EventDistributionRule {
    id: string;
    name: string;
    filter: EventFilter;
    targets: EventTarget[];
    enabled: boolean;
    priority: number;
}
export interface EventTarget {
    type: 'connection' | 'webhook' | 'database' | 'log';
    config: any;
}
export interface EventMetrics {
    totalEvents: number;
    eventsByType: Record<EventType, number>;
    eventsByServer: Record<string, number>;
    subscriptions: number;
    activeConnections: number;
    averageLatency: number;
}
export interface EventListener {
    serverId: string;
    eventTypes: EventType[];
    isActive: boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    onEvent(callback: (event: BaseEvent) => void): void;
    removeEventListener(callback: (event: BaseEvent) => void): void;
}
export declare class EventService {
    private ctx;
    private auditService;
    private subscriptions;
    private connections;
    private listeners;
    private aggregations;
    private distributionRules;
    private eventQueue;
    private metrics;
    private processingInterval?;
    private cleanupInterval?;
    private logger;
    constructor(ctx: Context, auditService: AuditService);
    /**
     * Subscribe to events with filter
     */
    subscribe(connection: Connection, filter?: EventFilter): Promise<EventSubscription>;
    /**
     * Unsubscribe from events
     */
    unsubscribe(subscriptionId: string): Promise<void>;
    /**
     * Update subscription filter
     */
    updateSubscription(subscriptionId: string, newFilter: EventFilter): Promise<EventSubscription>;
    /**
     * Register event listener for a server
     */
    registerListener(listener: EventListener): Promise<void>;
    /**
     * Unregister event listener
     */
    unregisterListener(serverId: string): Promise<void>;
    /**
     * Handle incoming event from server (public method for testing)
     */
    handleIncomingEvent(event: BaseEvent): Promise<void>;
    /**
     * Handle incoming event from server (internal implementation)
     */
    private handleIncomingEventInternal;
    /**
     * Process event queue
     */
    private processEventQueue;
    /**
     * Distribute event to subscribers
     */
    private distributeEvent;
    /**
     * Send event to connection
     */
    private sendEventToConnection;
    /**
     * Check if event matches filter
     */
    private matchesFilter;
    /**
     * Update event aggregations
     */
    private updateAggregations;
    /**
     * Get flood threshold for event type
     */
    private getFloodThreshold;
    /**
     * Handle event flood
     */
    private handleEventFlood;
    /**
     * Add distribution rule
     */
    addDistributionRule(rule: Omit<EventDistributionRule, 'id'>): Promise<EventDistributionRule>;
    /**
     * Apply distribution rule
     */
    private applyDistributionRule;
    /**
     * Send event to target
     */
    private sendToTarget;
    /**
     * Store event in database
     */
    private storeEventInDatabase;
    /**
     * Update event metrics
     */
    private updateMetrics;
    /**
     * Update latency metrics
     */
    private updateLatencyMetrics;
    /**
     * Get event metrics
     */
    getMetrics(): EventMetrics;
    /**
     * Get event statistics
     */
    getEventStatistics(serverId?: string, timeRange?: {
        start: Date;
        end: Date;
    }): Promise<{
        totalEvents: number;
        eventsByType: Record<EventType, number>;
        averageEventsPerMinute: number;
        topEventTypes: Array<{
            type: EventType;
            count: number;
        }>;
    }>;
    /**
     * Generate subscription ID
     */
    private generateSubscriptionId;
    /**
     * Generate event ID
     */
    private generateEventId;
    /**
     * Generate rule ID
     */
    private generateRuleId;
    /**
     * Start event processing
     */
    private startProcessing;
    /**
     * Start cleanup tasks
     */
    private startCleanup;
    /**
     * Cleanup inactive subscriptions
     */
    private cleanupInactiveSubscriptions;
    /**
     * Cleanup old aggregations
     */
    private cleanupOldAggregations;
    /**
     * Shutdown event service
     */
    shutdown(): Promise<void>;
    /**
     * Get health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
}
