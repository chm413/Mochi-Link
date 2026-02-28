package com.mochilink.connector.subscription;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Represents an event subscription with filtering capabilities
 * 
 * Stores subscription information including event types, filters,
 * and metadata for managing event delivery.
 */
public class EventSubscription {
    
    private final String id;
    private final List<String> eventTypes;
    private final Map<String, Object> filters;
    private final long createdAt;
    
    public EventSubscription(String id, List<String> eventTypes, Map<String, Object> filters, long createdAt) {
        this.id = id;
        this.eventTypes = eventTypes;
        this.filters = filters;
        this.createdAt = createdAt;
    }
    
    /**
     * Check if this subscription includes the given event type
     */
    public boolean includesEventType(String eventType) {
        return eventTypes.contains(eventType);
    }
    
    /**
     * Check if event data matches the subscription filters
     */
    public boolean matchesFilters(Map<String, Object> eventData) {
        // No filters means accept all
        if (filters == null || filters.isEmpty()) {
            return true;
        }
        
        // Check each filter condition
        for (Map.Entry<String, Object> filter : filters.entrySet()) {
            String key = filter.getKey();
            Object expectedValue = filter.getValue();
            
            // Get actual value from event data
            Object actualValue = eventData.get(key);
            
            // If filter key doesn't exist in event data, filter doesn't match
            if (actualValue == null) {
                return false;
            }
            
            // Compare values
            if (!Objects.equals(actualValue, expectedValue)) {
                return false;
            }
        }
        
        return true;
    }
    
    // Getters
    public String getId() {
        return id;
    }
    
    public List<String> getEventTypes() {
        return eventTypes;
    }
    
    public Map<String, Object> getFilters() {
        return filters;
    }
    
    public long getCreatedAt() {
        return createdAt;
    }
    
    @Override
    public String toString() {
        return String.format("EventSubscription{id='%s', eventTypes=%s, filters=%s}", 
                           id, eventTypes, filters);
    }
}
