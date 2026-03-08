package com.mochilink.connector.nukkit.utils;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class RateLimiter {
    
    private final int maxRequestsPerSecond;
    private final ConcurrentHashMap<String, RequestCounter> counters;
    
    public RateLimiter(int maxRequestsPerSecond) {
        this.maxRequestsPerSecond = maxRequestsPerSecond;
        this.counters = new ConcurrentHashMap<>();
    }
    
    public boolean tryAcquire(String key) {
        long currentSecond = System.currentTimeMillis() / 1000;
        
        RequestCounter counter = counters.computeIfAbsent(key, k -> new RequestCounter());
        
        if (counter.getSecond() != currentSecond) {
            counter.reset(currentSecond);
        }
        
        if (counter.getCount() >= maxRequestsPerSecond) {
            return false;
        }
        
        counter.increment();
        return true;
    }
    
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
    
    public void clear() {
        counters.clear();
    }
    
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
