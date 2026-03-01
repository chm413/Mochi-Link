<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\subscription;

/**
 * Represents an event subscription with filtering capabilities
 * 
 * Stores subscription information including event types, filters,
 * and metadata for managing event delivery.
 * 
 * @author chm413
 * @version 1.0.0
 */
class EventSubscription {
    
    private string $id;
    private array $eventTypes;
    private array $filters;
    private int $createdAt;
    
    public function __construct(string $id, array $eventTypes, array $filters, int $createdAt) {
        $this->id = $id;
        $this->eventTypes = $eventTypes;
        $this->filters = $filters;
        $this->createdAt = $createdAt;
    }
    
    /**
     * Check if this subscription includes the given event type
     */
    public function includesEventType(string $eventType): bool {
        return in_array($eventType, $this->eventTypes, true);
    }
    
    /**
     * Check if event data matches the subscription filters
     */
    public function matchesFilters(array $eventData): bool {
        // No filters means accept all
        if (empty($this->filters)) {
            return true;
        }
        
        // Check each filter condition
        foreach ($this->filters as $key => $expectedValue) {
            // If filter key doesn't exist in event data, filter doesn't match
            if (!isset($eventData[$key])) {
                return false;
            }
            
            $actualValue = $eventData[$key];
            
            // Compare values
            if ($actualValue !== $expectedValue) {
                return false;
            }
        }
        
        return true;
    }
    
    // Getters
    public function getId(): string {
        return $this->id;
    }
    
    public function getEventTypes(): array {
        return $this->eventTypes;
    }
    
    public function getFilters(): array {
        return $this->filters;
    }
    
    public function getCreatedAt(): int {
        return $this->createdAt;
    }
    
    public function __toString(): string {
        return sprintf(
            "EventSubscription{id='%s', eventTypes=%s, filters=%s}",
            $this->id,
            json_encode($this->eventTypes),
            json_encode($this->filters)
        );
    }
}
