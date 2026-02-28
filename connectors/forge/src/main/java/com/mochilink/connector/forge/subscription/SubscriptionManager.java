package com.mochilink.connector.forge.subscription;

import org.slf4j.Logger;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages event subscriptions for the Forge connector
 * 
 * Handles subscription lifecycle, filtering, and matching logic
 * to determine which events should be sent to the management server.
 */
public class SubscriptionManager {
    
    private final Logger logger;
    private final Map<String, EventSubscription> subscriptions;
    
    public SubscriptionManager(Logger logger) {
        this.logger = logger;
        this.subscriptions = new ConcurrentHashMap<>();
    }
    
    /**
     * Add a new subscription
     */
    public void addSubscription(String subscriptionId, EventSubscription subscription) {
        subscriptions.put(subscriptionId, subscription);
        logger.info("Added subscription: {} for events: {}", subscriptionId, subscription.getEventTypes());
    }
    
    /**
     * Remove a subscription
     */
    public void removeSubscription(String subscriptionId) {
        EventSubscription removed = subscriptions.remove(subscriptionId);
        if (removed != null) {
            logger.info("Removed subscription: {}", subscriptionId);
        } else {
            logger.warn("Subscription not found: {}", subscriptionId);
        }
    }
    
    /**
     * Check if there are any subscriptions for the given event type
     */
    public boolean hasSubscription(String eventType) {
        return subscriptions.values().stream()
            .anyMatch(sub -> sub.includesEventType(eventType));
    }
    
    /**
     * Check if event data matches any subscription filters for the given event type
     */
    public boolean matchesFilters(String eventType, Map<String, Object> eventData) {
        return subscriptions.values().stream()
            .filter(sub -> sub.includesEventType(eventType))
            .anyMatch(sub -> sub.matchesFilters(eventData));
    }
    
    /**
     * Get a specific subscription by ID
     */
    public EventSubscription getSubscription(String subscriptionId) {
        return subscriptions.get(subscriptionId);
    }
    
    /**
     * Get all subscriptions
     */
    public Collection<EventSubscription> getAllSubscriptions() {
        return subscriptions.values();
    }
    
    /**
     * Get subscription count
     */
    public int getSubscriptionCount() {
        return subscriptions.size();
    }
    
    /**
     * Clear all subscriptions
     */
    public void clearAll() {
        int count = subscriptions.size();
        subscriptions.clear();
        logger.info("Cleared {} subscriptions", count);
    }
    
    /**
     * Check if a subscription exists
     */
    public boolean hasSubscriptionId(String subscriptionId) {
        return subscriptions.containsKey(subscriptionId);
    }
}
