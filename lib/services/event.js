"use strict";
/**
 * Event Service - Event Listening and Pushing System
 *
 * This service implements the event listening and pushing mechanism for the
 * Minecraft Unified Management and Monitoring System. It handles standard
 * event types, filtering, subscription, aggregation, and distribution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventService = void 0;
// ============================================================================
// Event Service
// ============================================================================
class EventService {
    constructor(ctx, auditService) {
        this.ctx = ctx;
        this.auditService = auditService;
        this.subscriptions = new Map();
        this.connections = new Map();
        this.listeners = new Map();
        this.aggregations = new Map();
        this.distributionRules = [];
        this.eventQueue = [];
        this.metrics = {
            totalEvents: 0,
            eventsByType: {},
            eventsByServer: {},
            subscriptions: 0,
            activeConnections: 0,
            averageLatency: 0
        };
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
    async subscribe(connection, filter = {}) {
        const subscriptionId = this.generateSubscriptionId();
        const subscription = {
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
        await this.auditService.logger.logSuccess('event.subscribe', {
            subscriptionId,
            connectionId: connection.serverId,
            filter
        }, { serverId: connection.serverId });
        this.logger.info(`Event subscription created: ${subscriptionId} for ${connection.serverId}`);
        return subscription;
    }
    /**
     * Unsubscribe from events
     */
    async unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription not found: ${subscriptionId}`);
        }
        subscription.isActive = false;
        this.subscriptions.delete(subscriptionId);
        this.metrics.subscriptions--;
        // Log unsubscription
        await this.auditService.logger.logSuccess('event.unsubscribe', {
            subscriptionId,
            connectionId: subscription.connectionId
        });
        this.logger.info(`Event subscription removed: ${subscriptionId}`);
    }
    /**
     * Update subscription filter
     */
    async updateSubscription(subscriptionId, newFilter) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription not found: ${subscriptionId}`);
        }
        const oldFilter = subscription.filter;
        subscription.filter = { ...subscription.filter, ...newFilter };
        subscription.lastActivity = new Date();
        // Log filter update
        await this.auditService.logger.logSuccess('event.update_filter', {
            subscriptionId,
            oldFilter,
            newFilter: subscription.filter
        });
        this.logger.info(`Event subscription filter updated: ${subscriptionId}`);
        return subscription;
    }
    // ============================================================================
    // Event Listener Management
    // ============================================================================
    /**
     * Register event listener for a server
     */
    async registerListener(listener) {
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
    async unregisterListener(serverId) {
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
    async handleIncomingEvent(event) {
        return this.handleIncomingEventInternal(event);
    }
    /**
     * Handle incoming event from server (internal implementation)
     */
    async handleIncomingEventInternal(event) {
        try {
            // Update metrics
            this.updateMetrics(event);
            // Add to processing queue
            this.eventQueue.push(event);
            // Update aggregations
            this.updateAggregations(event);
            this.logger.debug(`Event received: ${event.type} from ${event.serverId}`);
        }
        catch (error) {
            this.logger.error('Error handling incoming event:', error);
        }
    }
    /**
     * Process event queue
     */
    async processEventQueue() {
        if (this.eventQueue.length === 0) {
            return;
        }
        const events = this.eventQueue.splice(0, 100); // Process in batches
        for (const event of events) {
            try {
                await this.distributeEvent(event);
            }
            catch (error) {
                this.logger.error(`Error distributing event ${event.type}:`, error);
            }
        }
    }
    /**
     * Distribute event to subscribers
     */
    async distributeEvent(event) {
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
                }
                catch (error) {
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
    async sendEventToConnection(event, connection) {
        const uwbpEvent = {
            type: 'event',
            id: this.generateEventId(),
            op: event.type,
            eventType: event.type,
            data: event,
            timestamp: event.timestamp,
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
    matchesFilter(event, filter) {
        // Server ID filter
        if (filter.serverId && event.serverId !== filter.serverId) {
            return false;
        }
        // Event type filter
        if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
            return false;
        }
        // Player ID filter (for player events)
        if (filter.playerId && 'playerId' in event) {
            if (event.playerId !== filter.playerId) {
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
    updateAggregations(event) {
        const key = `${event.serverId}:${event.type}`;
        let aggregation = this.aggregations.get(key);
        if (!aggregation) {
            aggregation = {
                serverId: event.serverId,
                eventType: event.type,
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
        if (aggregation.count > this.getFloodThreshold(event.type)) {
            this.handleEventFlood(aggregation);
        }
    }
    /**
     * Get flood threshold for event type
     */
    getFloodThreshold(eventType) {
        const thresholds = {
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
    async handleEventFlood(aggregation) {
        const floodEvent = {
            type: 'alert.playerFlood',
            serverId: aggregation.serverId,
            timestamp: Date.now(),
            version: '1.0'
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
    async addDistributionRule(rule) {
        const distributionRule = {
            id: this.generateRuleId(),
            ...rule
        };
        this.distributionRules.push(distributionRule);
        this.distributionRules.sort((a, b) => b.priority - a.priority);
        await this.auditService.logger.logSuccess('event.add_distribution_rule', distributionRule);
        this.logger.info(`Distribution rule added: ${distributionRule.id}`);
        return distributionRule;
    }
    /**
     * Apply distribution rule
     */
    async applyDistributionRule(event, rule) {
        for (const target of rule.targets) {
            try {
                await this.sendToTarget(event, target);
            }
            catch (error) {
                this.logger.error(`Failed to send event to target ${target.type}:`, error);
            }
        }
    }
    /**
     * Send event to target
     */
    async sendToTarget(event, target) {
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
    async storeEventInDatabase(event) {
        // This would integrate with the database service
        // For now, we'll use the audit service
        await this.auditService.logger.logSuccess('event.occurred', event, { serverId: event.serverId });
    }
    // ============================================================================
    // Metrics and Monitoring
    // ============================================================================
    /**
     * Update event metrics
     */
    updateMetrics(event) {
        this.metrics.totalEvents++;
        if (!this.metrics.eventsByType[event.type]) {
            this.metrics.eventsByType[event.type] = 0;
        }
        this.metrics.eventsByType[event.type]++;
        if (!this.metrics.eventsByServer[event.serverId]) {
            this.metrics.eventsByServer[event.serverId] = 0;
        }
        this.metrics.eventsByServer[event.serverId]++;
        this.metrics.activeConnections = this.connections.size;
    }
    /**
     * Update latency metrics
     */
    updateLatencyMetrics(latency) {
        // Simple moving average
        this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (latency * 0.1);
    }
    /**
     * Get event metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get event statistics
     */
    async getEventStatistics(serverId, timeRange) {
        // This is a simplified implementation
        // In a real system, this would query the database
        let events = this.metrics.eventsByType;
        if (serverId) {
            // Filter by server (simplified)
            events = { ...this.metrics.eventsByType };
        }
        const totalEvents = Object.values(events).reduce((sum, count) => sum + count, 0);
        const topEventTypes = Object.entries(events)
            .map(([type, count]) => ({ type: type, count }))
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
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate event ID
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate rule ID
     */
    generateRuleId() {
        return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Start event processing
     */
    startProcessing() {
        this.processingInterval = setInterval(() => {
            this.processEventQueue();
        }, 100); // Process every 100ms
    }
    /**
     * Start cleanup tasks
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSubscriptions();
            this.cleanupOldAggregations();
        }, 60000); // Cleanup every minute
    }
    /**
     * Cleanup inactive subscriptions
     */
    cleanupInactiveSubscriptions() {
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
    cleanupOldAggregations() {
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
    async shutdown() {
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
            }
            catch (error) {
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
    async getHealthStatus() {
        const queueSize = this.eventQueue.length;
        const activeListeners = Array.from(this.listeners.values()).filter(l => l.isActive).length;
        const activeSubscriptions = Array.from(this.subscriptions.values()).filter(s => s.isActive).length;
        let status = 'healthy';
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
exports.EventService = EventService;
