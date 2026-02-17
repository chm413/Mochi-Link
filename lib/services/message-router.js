"use strict";
/**
 * Mochi-Link (大福连) - Message Routing Service
 *
 * This service handles message routing between chat groups and Minecraft servers
 * based on the configured bindings and routing rules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRouter = void 0;
const events_1 = require("events");
// ============================================================================
// Message Router Service
// ============================================================================
class MessageRouter extends events_1.EventEmitter {
    constructor(ctx, bindingManager, eventService) {
        super();
        this.ctx = ctx;
        this.bindingManager = bindingManager;
        this.eventService = eventService;
        this.logger = this.ctx.logger('mochi-link:message-router');
        this.routingStats = {
            messagesRouted24h: 0,
            eventsRouted24h: 0,
            routingErrors24h: 0,
            activeRoutes: 0,
            messagesByGroup: {},
            messagesByServer: {}
        };
        // ============================================================================
        // Rate Limiting
        // ============================================================================
        this.rateLimitCache = new Map();
        this.setupEventListeners();
    }
    // ============================================================================
    // Message Routing
    // ============================================================================
    /**
     * Route a message from a group to bound servers
     */
    async routeGroupMessage(message) {
        this.logger.debug(`Routing message from group ${message.groupId}: ${message.content}`);
        try {
            // Get chat bindings for this group
            const serverIds = await this.bindingManager.getGroupServers(message.groupId, 'chat');
            if (serverIds.length === 0) {
                this.logger.debug(`No chat bindings found for group ${message.groupId}`);
                return;
            }
            // Process message for each bound server
            for (const serverId of serverIds) {
                try {
                    await this.processGroupToServerMessage(message, serverId);
                    this.routingStats.messagesRouted24h++;
                    this.routingStats.messagesByGroup[message.groupId] =
                        (this.routingStats.messagesByGroup[message.groupId] || 0) + 1;
                }
                catch (error) {
                    this.logger.error(`Failed to route message to server ${serverId}:`, error);
                    this.routingStats.routingErrors24h++;
                }
            }
            // Update binding activity
            for (const serverId of serverIds) {
                await this.bindingManager.updateBindingActivity(message.groupId, serverId, 'chat');
            }
        }
        catch (error) {
            this.logger.error('Failed to route group message:', error);
            this.routingStats.routingErrors24h++;
        }
    }
    /**
     * Route a server event to bound groups
     */
    async routeServerEvent(event) {
        this.logger.debug(`Routing event from server ${event.serverId}: ${event.eventType}`);
        try {
            // Get event bindings for this server
            const groupIds = await this.bindingManager.getServerGroups(event.serverId, 'event');
            if (groupIds.length === 0) {
                this.logger.debug(`No event bindings found for server ${event.serverId}`);
                return;
            }
            // Process event for each bound group
            for (const groupId of groupIds) {
                try {
                    await this.processServerToGroupEvent(event, groupId);
                    this.routingStats.eventsRouted24h++;
                    this.routingStats.messagesByServer[event.serverId] =
                        (this.routingStats.messagesByServer[event.serverId] || 0) + 1;
                }
                catch (error) {
                    this.logger.error(`Failed to route event to group ${groupId}:`, error);
                    this.routingStats.routingErrors24h++;
                }
            }
            // Update binding activity
            for (const groupId of groupIds) {
                await this.bindingManager.updateBindingActivity(groupId, event.serverId, 'event');
            }
        }
        catch (error) {
            this.logger.error('Failed to route server event:', error);
            this.routingStats.routingErrors24h++;
        }
    }
    // ============================================================================
    // Message Processing
    // ============================================================================
    /**
     * Process a message from group to server
     */
    async processGroupToServerMessage(message, serverId) {
        // Get binding configuration
        const bindings = await this.bindingManager.queryBindings({
            groupId: message.groupId,
            serverId: serverId,
            bindingType: 'chat'
        });
        if (bindings.bindings.length === 0) {
            return;
        }
        const binding = bindings.bindings[0];
        const chatConfig = binding.config.chat;
        if (!chatConfig?.enabled) {
            return;
        }
        // Apply message filters
        let processedContent = message.content;
        if (chatConfig.filterRules) {
            processedContent = this.applyMessageFilters(processedContent, chatConfig.filterRules);
            if (processedContent === null) {
                // Message was blocked
                return;
            }
        }
        // Check rate limiting
        if (chatConfig.rateLimiting) {
            const allowed = await this.checkRateLimit(message.groupId, serverId, chatConfig.rateLimiting);
            if (!allowed) {
                this.logger.debug(`Rate limit exceeded for group ${message.groupId} -> server ${serverId}`);
                return;
            }
        }
        // Format message
        const formattedMessage = this.formatMessage(processedContent, message, chatConfig.messageFormat);
        // Send to server (this would integrate with the command service)
        const outgoingMessage = {
            serverId,
            content: formattedMessage,
            format: 'chat',
            metadata: {
                originalGroupId: message.groupId,
                originalUserId: message.userId,
                originalUserName: message.userName,
                timestamp: message.timestamp
            }
        };
        // Emit event for other services to handle
        this.emit('outgoing-message', outgoingMessage);
        this.logger.debug(`Routed message to server ${serverId}: ${formattedMessage}`);
    }
    /**
     * Process an event from server to group
     */
    async processServerToGroupEvent(event, groupId) {
        // Get binding configuration
        const bindings = await this.bindingManager.queryBindings({
            groupId: groupId,
            serverId: event.serverId,
            bindingType: 'event'
        });
        if (bindings.bindings.length === 0) {
            return;
        }
        const binding = bindings.bindings[0];
        const eventConfig = binding.config.event;
        if (!eventConfig?.enabled) {
            return;
        }
        // Check if event type is allowed
        if (!eventConfig.eventTypes.includes(event.eventType)) {
            return;
        }
        // Apply event filters
        if (eventConfig.filters) {
            const allowed = this.applyEventFilters(event, eventConfig.filters);
            if (!allowed) {
                return;
            }
        }
        // Format event message
        const formattedMessage = this.formatEventMessage(event, eventConfig.format);
        // Send to group
        const groupMessage = {
            groupId,
            content: formattedMessage,
            format: eventConfig.format,
            metadata: {
                serverId: event.serverId,
                eventType: event.eventType,
                timestamp: event.timestamp
            }
        };
        // Emit event for other services to handle
        this.emit('group-message', groupMessage);
        this.logger.debug(`Routed event to group ${groupId}: ${formattedMessage}`);
    }
    // ============================================================================
    // Message Filtering and Formatting
    // ============================================================================
    /**
     * Apply message filters to content
     */
    applyMessageFilters(content, filters) {
        let processedContent = content;
        for (const filter of filters) {
            if (processedContent === null)
                break; // Already blocked
            switch (filter.type) {
                case 'regex':
                    const regex = new RegExp(filter.pattern, 'gi');
                    if (filter.action === 'block' && regex.test(processedContent)) {
                        return null; // Block message
                    }
                    else if (filter.action === 'transform' && filter.replacement) {
                        processedContent = processedContent.replace(regex, filter.replacement);
                    }
                    break;
                case 'keyword':
                    const keywords = filter.pattern.split(',').map(k => k.trim().toLowerCase());
                    const contentLower = processedContent.toLowerCase();
                    const hasKeyword = keywords.some(keyword => contentLower.includes(keyword));
                    if (filter.action === 'block' && hasKeyword) {
                        return null; // Block message
                    }
                    else if (filter.action === 'transform' && hasKeyword && filter.replacement) {
                        keywords.forEach(keyword => {
                            const keywordRegex = new RegExp(keyword, 'gi');
                            processedContent = processedContent.replace(keywordRegex, filter.replacement);
                        });
                    }
                    break;
                case 'length':
                    const maxLength = parseInt(filter.pattern);
                    if (filter.action === 'block' && processedContent.length > maxLength) {
                        return null; // Block message
                    }
                    else if (filter.action === 'transform' && processedContent.length > maxLength) {
                        processedContent = processedContent.substring(0, maxLength) + '...';
                    }
                    break;
            }
        }
        return processedContent;
    }
    /**
     * Apply event filters
     */
    applyEventFilters(event, filters) {
        for (const filter of filters) {
            if (filter.eventType === event.eventType) {
                if (filter.conditions) {
                    // Apply conditions (simplified implementation)
                    // In a full implementation, this would be more sophisticated
                    return true;
                }
                if (filter.action === 'block') {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Format message for server
     */
    formatMessage(content, message, format) {
        if (!format) {
            return `[${message.userName}] ${content}`;
        }
        return format
            .replace('{username}', message.userName)
            .replace('{content}', content)
            .replace('{group}', message.groupId)
            .replace('{time}', new Date(message.timestamp).toLocaleTimeString());
    }
    /**
     * Format event message for group
     */
    formatEventMessage(event, format) {
        if (!format) {
            return `[${event.serverId}] ${event.eventType}: ${JSON.stringify(event.data)}`;
        }
        let formatted = format
            .replace('{server}', event.serverId)
            .replace('{event}', event.eventType)
            .replace('{time}', new Date(event.timestamp).toLocaleTimeString());
        // Replace data fields
        if (event.data && typeof event.data === 'object') {
            Object.keys(event.data).forEach(key => {
                formatted = formatted.replace(`{${key}}`, String(event.data[key]));
            });
        }
        return formatted;
    }
    /**
     * Check rate limit for group-server pair
     */
    async checkRateLimit(groupId, serverId, config) {
        const key = `${groupId}:${serverId}`;
        const now = Date.now();
        const current = this.rateLimitCache.get(key);
        if (!current || now > current.resetTime) {
            // Reset or initialize
            this.rateLimitCache.set(key, {
                count: 1,
                resetTime: now + config.windowMs
            });
            return true;
        }
        if (current.count >= config.maxMessages) {
            return false; // Rate limit exceeded
        }
        current.count++;
        return true;
    }
    // ============================================================================
    // Event Listeners
    // ============================================================================
    /**
     * Setup event listeners for incoming messages and events
     */
    setupEventListeners() {
        // The message router will be used by other services
        // They can listen to our events and send us messages through method calls
        // Set up integration with event service for server events
        this.setupEventServiceIntegration();
    }
    /**
     * Setup integration with event service
     */
    setupEventServiceIntegration() {
        // We'll provide a method for the event service to call when events occur
        // This is a more direct integration approach
    }
    /**
     * Handle incoming group message (called by external services)
     */
    async handleGroupMessage(message) {
        await this.routeGroupMessage(message);
    }
    /**
     * Handle incoming server event (called by event service)
     */
    async handleServerEvent(event) {
        await this.routeServerEvent(event);
    }
    // ============================================================================
    // Statistics and Monitoring
    // ============================================================================
    /**
     * Get routing statistics
     */
    getRoutingStats() {
        return { ...this.routingStats };
    }
    /**
     * Reset statistics (called daily)
     */
    resetDailyStats() {
        this.routingStats.messagesRouted24h = 0;
        this.routingStats.eventsRouted24h = 0;
        this.routingStats.routingErrors24h = 0;
        this.routingStats.messagesByGroup = {};
        this.routingStats.messagesByServer = {};
    }
    /**
     * Update active routes count
     */
    async updateActiveRoutesCount() {
        const stats = await this.bindingManager.getBindingStats();
        this.routingStats.activeRoutes = stats.activeBindings;
    }
    // ============================================================================
    // Health Check and Cleanup
    // ============================================================================
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            await this.updateActiveRoutesCount();
            const errorRate = this.routingStats.routingErrors24h /
                Math.max(this.routingStats.messagesRouted24h + this.routingStats.eventsRouted24h, 1);
            const status = errorRate > 0.1 ? 'degraded' : 'healthy';
            return {
                status,
                details: {
                    activeRoutes: this.routingStats.activeRoutes,
                    messagesRouted24h: this.routingStats.messagesRouted24h,
                    eventsRouted24h: this.routingStats.eventsRouted24h,
                    errorRate: errorRate,
                    rateLimitCacheSize: this.rateLimitCache.size
                }
            };
        }
        catch (error) {
            this.logger.error('Health check failed:', error);
            return {
                status: 'unhealthy',
                details: { error: error.message }
            };
        }
    }
    /**
     * Cleanup service resources
     */
    async cleanup() {
        this.logger.info('Cleaning up message router...');
        this.rateLimitCache.clear();
    }
}
exports.MessageRouter = MessageRouter;
