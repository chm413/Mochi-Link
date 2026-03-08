package com.mochilink.connector.fabric.utils;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Simple rate limiter for request throttling
 */
public class RateLimiter {
    
    private final int maxRequestsPerSecond;
    private final ConcurrentHashMap<String, RequestCounter> counters;
    
    public RateLimiter(int maxRequestsPerSecond) {
        this.maxRequestsPerSecond = maxRequestsPerSecond;
        this.counters = new ConcurrentHashMap<>();
    }
    
    /**
     * Check if request is allowed
     * @param key Identifier for the rate limit (e.g., operation name or client ID)
     * @return true if request is allowed, false if rate limit exceeded
     */
    public boolean tryAcquire(String key) {
        long currentSecond = System.currentTimeMillis() / 1000;
        
        RequestCounter counter = counters.computeIfAbsent(key, k -> new RequestCounter());
        
        // Reset counter if we're in a new second
        if (counter.getSecond() != currentSecond) {
            counter.reset(currentSecond);
        }
        
        // Check if we've exceeded the limit
        if (counter.getCount() >= maxRequestsPerSecond) {
            return false;
        }
        
        // Increment and allow
        counter.increment();
        return true;
    }
    
    /**
     * Get current request count for a key
     */
    public int getCurrentCount(String key) {
        RequestCounter counter = counters.get(key);
        if (counter == null) {
            return 0;
        }
        
        long currentSecond = System.currentTimeMillis() / 1000;
        if (counter.getSecond() != currentSecond) {
            return 0;
        }
        
        return counter.getCount();
    }
    
    /**
     * Clear all counters
     */
    public void clear() {
        counters.clear();
    }
    
    /**
     * Request counter for a specific key
     */
    private static class RequestCounter {
        private final AtomicLong second;
        private final AtomicLong count;
        
        public RequestCounter() {
            this.second = new AtomicLong(System.currentTimeMillis() / 1000);
            this.count = new AtomicLong(0);
        }
        
        public long getSecond() {
            return second.get();
        }
        
        public int getCount() {
            return (int) count.get();
        }
        
        public void reset(long newSecond) {
            second.set(newSecond);
            count.set(0);
        }
        
        public void increment() {
            count.incrementAndGet();
        }
    }
}
