/**
 * Event Service - Event Listening and Pushing System
 * 
 * This service implements the event listening and pushing mechanism for the
 * Minecraft Unified Management and Monitoring System. It handles standard
 * event types, filtering, subscription, aggregation, and distribution.
 */

import { Context } from 'koishi';
import { 
  EventType, 
  BaseEvent, 
  PlayerJoinEvent, 
  PlayerLeaveEvent, 
  PlayerChatEvent, 
  ServerStatusEvent,
  UWBPEvent,
  Connection,
  AuditLog
} from '../types';
import { AuditService } from './audit';

// ============================================================================
// Event System Types
// ============================================================================

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
  timeWindow: number; // in milliseconds
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

// ============================================================================
// Event Listener Interface
// ============================================================================

export interface EventListener {
  serverId: string;
  eventTypes: EventType[];
  isActive: boolean;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  onEvent(callback: (event: BaseEvent) => void): void;
  removeEventListener(callback: (event: BaseEvent) => void): void;
}

// ============================================================================
// Event Service
// ============================================================================

export class EventService {
  private subscriptions = new Map<string, EventSubscription>();
  private connections = new Map<string, Connection>();
  private listeners = new Map<string, EventListener>();
  private aggregations = new Map<string, EventAggregation>();
  private distributionRules: EventDistributionRule[] = [];
  private eventQueue: BaseEvent[] = [];
  private metrics: EventMetrics = {
    totalEvents: 0,
    eventsByType: {} as Record<EventType, number>,
    eventsByServer: {},
    subscriptions: 0,
    activeConnections: 0,
    averageLatency: 0
  };
  private processingInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private logger: any;

  constructor(
    private ctx: Context,
    private auditService: AuditService
  ) {
    this.logger = ctx.logger('mochi-link:event');
    this.startProcessing();
    this.startCleanup();
  }

  // ============================================================================
  // Event Subscription Management
  // ============================================================================

  /**
   * Subscribe to events with filter
   */
  async subscribe(
    connection: Connection,
    filter: EventFilter = {}
  ): Promise<EventSubscription> {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      connectionId: connection.serverId,
      serverId: filter.serverId,
      filter,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.connections.set(connection.serverId, connection);
    this.metrics.subscriptions++;

    // Log subscription
    await this.auditService.logger.logSuccess(
      'event.subscribe',
      {
        subscriptionId,
        connectionId: connection.serverId,
        filter
      },
      { serverId: connection.serverId }
    );

    this.logger.info(`Event subscription created: ${subscriptionId} for ${connection.serverId}`);
    return subscription;
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.isActive = false;
    this.subscriptions.delete(subscriptionId);
    this.metrics.subscriptions--;

    // Log unsubscription
    await this.auditService.logger.logSuccess(
      'event.unsubscribe',
      {
        subscriptionId,
        connectionId: subscription.connectionId
      }
    );

    this.logger.info(`Event subscription removed: ${subscriptionId}`);
  }

  /**
   * Update subscription filter
   */
  async updateSubscription(
    subscriptionId: string,
    newFilter: EventFilter
  ): Promise<EventSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const oldFilter = subscription.filter;
    subscription.filter = { ...subscription.filter, ...newFilter };
    subscription.lastActivity = new Date();

    // Log filter update
    await this.auditService.logger.logSuccess(
      'event.update_filter',
      {
        subscriptionId,
        oldFilter,
        newFilter: subscription.filter
      }
    );

    this.logger.info(`Event subscription filter updated: ${subscriptionId}`);
    return subscription;
  }

  /**
   * Get all subscriptions for a connection
   */
  async getSubscriptionsForConnection(connectionId: string): Promise<EventSubscription[]> {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.connectionId === connectionId);
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<EventSubscription | undefined> {
    return this.subscriptions.get(subscriptionId);
  }

  // ============================================================================
  // Event Listener Management
  // ============================================================================

  /**
   * Register event listener for a server
   */
  async registerListener(listener: EventListener): Promise<void> {
    this.listeners.set(listener.serverId, listener);
    
    // Set up event callback
    listener.onEvent((event) => {
      this.handleIncomingEventInternal(event);
    });

    await listener.start();
    
    this.logger.info(`Event listener registered for server: ${listener.serverId}`);
  }

  /**
   * Unregister event listener
   */
  async unregisterListener(serverId: string): Promise<void> {
    const listener = this.listeners.get(serverId);
    if (listener) {
      await listener.stop();
      this.listeners.delete(serverId);
      this.logger.info(`Event listener unregistered for server: ${serverId}`);
    }
  }

  // ============================================================================
  // Event Processing
  // ============================================================================

  /**
   * Handle incoming event from server (public method for testing)
   */
  async handleIncomingEvent(event: BaseEvent): Promise<void> {
    return this.handleIncomingEventInternal(event);
  }

  /**
   * Handle incoming event from server (internal implementation)
   */
  private async handleIncomingEventInternal(event: BaseEvent): Promise<void> {
    try {
      // Update metrics
      this.updateMetrics(event);

      // Add to processing queue
      this.eventQueue.push(event);

      // Update aggregations
      this.updateAggregations(event);

      this.logger.debug(`Event received: ${event.type} from ${event.serverId}`);
    } catch (error) {
      this.logger.error('Error handling incoming event:', error);
    }
  }

  /**
   * Process event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = this.eventQueue.splice(0, 100); // Process in batches
    
    for (const event of events) {
      try {
        await this.distributeEvent(event);
      } catch (error) {
        this.logger.error(`Error distributing event ${event.type}:`, error);
      }
    }
  }

  /**
   * Distribute event to subscribers
   */
  private async distributeEvent(event: BaseEvent): Promise<void> {
    const startTime = Date.now();
    let distributionCount = 0;

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.isActive && this.matchesFilter(event, sub.filter));

    // Distribute to subscribers
    for (const subscription of matchingSubscriptions) {
      const connection = this.connections.get(subscription.connectionId);
      if (connection && connection.status === 'connected') {
        try {
          await this.sendEventToConnection(event, connection);
          subscription.lastActivity = new Date();
          distributionCount++;
        } catch (error) {
          this.logger.error(`Failed to send event to ${subscription.connectionId}:`, error);
        }
      }
    }

    // Apply distribution rules
    for (const rule of this.distributionRules) {
      if (rule.enabled && this.matchesFilter(event, rule.filter)) {
        await this.applyDistributionRule(event, rule);
        distributionCount++;
      }
    }

    // Update latency metrics
    const latency = Date.now() - startTime;
    this.updateLatencyMetrics(latency);

    this.logger.debug(`Event distributed to ${distributionCount} targets in ${latency}ms`);
  }

  /**
   * Send event to connection
   */
  private async sendEventToConnection(event: BaseEvent, connection: Connection): Promise<void> {
    // 提取事件业务数据，排除元数据字段
    const { type, serverId, timestamp, version, ...eventData } = event as any;
    
    const uwbpEvent: UWBPEvent = {
      type: 'event',
      id: this.generateEventId(),
      op: event.type,
      eventType: event.type,
      data: eventData,  // 只包含业务数据，避免重复
      timestamp: event.timestamp,  // 已经是 ISO 8601 字符串
      serverId: event.serverId,
      version: event.version
    };

    await connection.send(uwbpEvent);
  }

  // ============================================================================
  // Event Filtering
  // ============================================================================

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: BaseEvent, filter: EventFilter): boolean {
    // Server ID filter
    if (filter.serverId && event.serverId !== filter.serverId) {
      return false;
    }

    // Event type filter
    if (filter.eventTypes && !filter.eventTypes.includes(event.type as EventType)) {
      return false;
    }

    // Player ID filter (for player events)
    if (filter.playerId && 'playerId' in event) {
      if ((event as any).playerId !== filter.playerId) {
        return false;
      }
    }

    // Time range filter
    if (filter.timeRange) {
      const eventTime = new Date(event.timestamp);
      if (eventTime < filter.timeRange.start || eventTime > filter.timeRange.end) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // Event Aggregation
  // ============================================================================

  /**
   * Update event aggregations
   */
  private updateAggregations(event: BaseEvent): void {
    const key = `${event.serverId}:${event.type}`;
    let aggregation = this.aggregations.get(key);

    if (!aggregation) {
      aggregation = {
        serverId: event.serverId,
        eventType: event.type as EventType,
        count: 0,
        timeWindow: 60000, // 1 minute
        lastReset: new Date()
      };
      this.aggregations.set(key, aggregation);
    }

    // Reset if time window exceeded
    const now = new Date();
    if (now.getTime() - aggregation.lastReset.getTime() > aggregation.timeWindow) {
      aggregation.count = 0;
      aggregation.lastReset = now;
    }

    aggregation.count++;

    // Check for flood detection
    if (aggregation.count > this.getFloodThreshold(event.type as EventType)) {
      this.handleEventFlood(aggregation);
    }
  }

  /**
   * Get flood threshold for event type
   */
  private getFloodThreshold(eventType: EventType): number {
    const thresholds: Record<EventType, number> = {
      'player.join': 10,
      'player.leave': 10,
      'player.chat': 50,
      'player.death': 20,
      'player.advancement': 30,
      'server.status': 5,
      'server.logLine': 100,
      'alert.tpsLow': 3,
      'alert.memoryHigh': 3,
      'alert.playerFlood': 1
    };

    return thresholds[eventType] || 20;
  }

  /**
   * Handle event flood
   */
  private async handleEventFlood(aggregation: EventAggregation): Promise<void> {
    const floodEvent: BaseEvent = {
      type: 'alert.playerFlood' as EventType,
      serverId: aggregation.serverId,
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };

    // Add flood event to queue
    this.eventQueue.push(floodEvent);

    this.logger.warn(`Event flood detected: ${aggregation.eventType} on ${aggregation.serverId} (${aggregation.count} events)`);
  }

  // ============================================================================
  // Distribution Rules
  // ============================================================================

  /**
   * Add distribution rule
   */
  async addDistributionRule(rule: Omit<EventDistributionRule, 'id'>): Promise<EventDistributionRule> {
    const distributionRule: EventDistributionRule = {
      id: this.generateRuleId(),
      ...rule
    };

    this.distributionRules.push(distributionRule);
    this.distributionRules.sort((a, b) => b.priority - a.priority);

    await this.auditService.logger.logSuccess(
      'event.add_distribution_rule',
      distributionRule
    );

    this.logger.info(`Distribution rule added: ${distributionRule.id}`);
    return distributionRule;
  }

  /**
   * Apply distribution rule
   */
  private async applyDistributionRule(event: BaseEvent, rule: EventDistributionRule): Promise<void> {
    for (const target of rule.targets) {
      try {
        await this.sendToTarget(event, target);
      } catch (error) {
        this.logger.error(`Failed to send event to target ${target.type}:`, error);
      }
    }
  }

  /**
   * Send event to target
   */
  private async sendToTarget(event: BaseEvent, target: EventTarget): Promise<void> {
    switch (target.type) {
      case 'database':
        // Store event in database
        await this.storeEventInDatabase(event);
        break;
      
      case 'log':
        // Log event
        this.logger.info(`Event: ${event.type} from ${event.serverId}`, event);
        break;
      
      case 'webhook':
        // Send to webhook (implementation would depend on HTTP client)
        this.logger.debug(`Would send event to webhook: ${target.config.url}`);
        break;
      
      default:
        this.logger.warn(`Unknown target type: ${target.type}`);
    }
  }

  /**
   * Store event in database
   */
  private async storeEventInDatabase(event: BaseEvent): Promise<void> {
    // This would integrate with the database service
    // For now, we'll use the audit service
    await this.auditService.logger.logSuccess(
      'event.occurred',
      event,
      { serverId: event.serverId }
    );
  }

  // ============================================================================
  // Metrics and Monitoring
  // ============================================================================

  /**
   * Update event metrics
   */
  private updateMetrics(event: BaseEvent): void {
    this.metrics.totalEvents++;
    
    if (!this.metrics.eventsByType[event.type as EventType]) {
      this.metrics.eventsByType[event.type as EventType] = 0;
    }
    this.metrics.eventsByType[event.type as EventType]++;
    
    if (!this.metrics.eventsByServer[event.serverId]) {
      this.metrics.eventsByServer[event.serverId] = 0;
    }
    this.metrics.eventsByServer[event.serverId]++;
    
    this.metrics.activeConnections = this.connections.size;
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    // Simple moving average
    this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (latency * 0.1);
  }

  /**
   * Get event metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get event statistics
   */
  async getEventStatistics(serverId?: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalEvents: number;
    eventsByType: Record<EventType, number>;
    averageEventsPerMinute: number;
    topEventTypes: Array<{ type: EventType; count: number }>;
  }> {
    // This is a simplified implementation
    // In a real system, this would query the database
    
    let events = this.metrics.eventsByType;
    if (serverId) {
      // Filter by server (simplified)
      events = { ...this.metrics.eventsByType };
    }

    const totalEvents = Object.values(events).reduce((sum, count) => sum + count, 0);
    const topEventTypes = Object.entries(events)
      .map(([type, count]) => ({ type: type as EventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents,
      eventsByType: events,
      averageEventsPerMinute: totalEvents / 60, // Simplified calculation
      topEventTypes
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate rule ID
   */
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start event processing
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processEventQueue();
    }, 100); // Process every 100ms
  }

  /**
   * Start cleanup tasks
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSubscriptions();
      this.cleanupOldAggregations();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup inactive subscriptions
   */
  private cleanupInactiveSubscriptions(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [id, subscription] of this.subscriptions) {
      if (now.getTime() - subscription.lastActivity.getTime() > inactiveThreshold) {
        const connection = this.connections.get(subscription.connectionId);
        if (!connection || connection.status !== 'connected') {
          this.subscriptions.delete(id);
          this.metrics.subscriptions--;
          this.logger.debug(`Cleaned up inactive subscription: ${id}`);
        }
      }
    }
  }

  /**
   * Cleanup old aggregations
   */
  private cleanupOldAggregations(): void {
    const now = new Date();
    const cleanupThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [key, aggregation] of this.aggregations) {
      if (now.getTime() - aggregation.lastReset.getTime() > cleanupThreshold) {
        this.aggregations.delete(key);
      }
    }
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Shutdown event service
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down event service...');

    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop all listeners
    for (const [serverId, listener] of this.listeners) {
      try {
        await listener.stop();
      } catch (error) {
        this.logger.error(`Error stopping listener for ${serverId}:`, error);
      }
    }

    // Process remaining events
    await this.processEventQueue();

    // Clear collections
    this.subscriptions.clear();
    this.connections.clear();
    this.listeners.clear();
    this.aggregations.clear();
    this.eventQueue.length = 0;

    this.logger.info('Event service shutdown complete');
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const queueSize = this.eventQueue.length;
    const activeListeners = Array.from(this.listeners.values()).filter(l => l.isActive).length;
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(s => s.isActive).length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (queueSize > 1000) {
      status = 'degraded';
    }
    if (queueSize > 5000) {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        queueSize,
        activeListeners,
        activeSubscriptions,
        totalEvents: this.metrics.totalEvents,
        averageLatency: this.metrics.averageLatency
      }
    };
  }
}