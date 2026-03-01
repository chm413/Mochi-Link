<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\subscription;

use pocketmine\plugin\PluginLogger;

/**
 * Manages event subscriptions for the PMMP connector
 * 
 * Handles subscription lifecycle, filtering, and matching logic
 * to determine which events should be sent to the management server.
 * 
 * @author chm413
 * @version 1.0.0
 */
class SubscriptionManager {
    
    private PluginLogger $logger;
    /** @var EventSubscription[] */
    private array $subscriptions = [];
    
    public function __construct(PluginLogger $logger) {
        $this->logger = $logger;
    }
    
    /**
     * Add a new subscription
     */
    public function addSubscription(string $subscriptionId, EventSubscription $subscription): void {
        $this->subscriptions[$subscriptionId] = $subscription;
        $this->logger->info(sprintf(
            "Added subscription: %s for events: %s",
            $subscriptionId,
            json_encode($subscription->getEventTypes())
        ));
    }
    
    /**
     * Remove a subscription
     */
    public function removeSubscription(string $subscriptionId): void {
        if (isset($this->subscriptions[$subscriptionId])) {
            unset($this->subscriptions[$subscriptionId]);
            $this->logger->info(sprintf("Removed subscription: %s", $subscriptionId));
        } else {
            $this->logger->warning(sprintf("Subscription not found: %s", $subscriptionId));
        }
    }
    
    /**
     * Check if there are any subscriptions for the given event type
     */
    public function hasSubscription(string $eventType): bool {
        foreach ($this->subscriptions as $subscription) {
            if ($subscription->includesEventType($eventType)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Check if event data matches any subscription filters for the given event type
     */
    public function matchesFilters(string $eventType, array $eventData): bool {
        foreach ($this->subscriptions as $subscription) {
            if ($subscription->includesEventType($eventType) && $subscription->matchesFilters($eventData)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Get a specific subscription by ID
     */
    public function getSubscription(string $subscriptionId): ?EventSubscription {
        return $this->subscriptions[$subscriptionId] ?? null;
    }
    
    /**
     * Get all subscriptions
     */
    public function getAllSubscriptions(): array {
        return array_values($this->subscriptions);
    }
    
    /**
     * Get subscription count
     */
    public function getSubscriptionCount(): int {
        return count($this->subscriptions);
    }
    
    /**
     * Clear all subscriptions
     */
    public function clearAll(): void {
        $count = count($this->subscriptions);
        $this->subscriptions = [];
        $this->logger->info(sprintf("Cleared %d subscriptions", $count));
    }
    
    /**
     * Check if a subscription exists
     */
    public function hasSubscriptionId(string $subscriptionId): bool {
        return isset($this->subscriptions[$subscriptionId]);
    }
}
