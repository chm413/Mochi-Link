package com.mochilink.connector.common;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Logger;

/**
 * 通用重连管理器 - 实现指数退避重连机制
 * 
 * 特性:
 * - 指数退避算法
 * - 重连次数上限
 * - 达到上限后自动禁用
 * - 手动启用/禁用控制
 * 
 * @author Mochi-Link Team
 * @version 2.1.0
 */
public class ReconnectionManager {
    
    private final Logger logger;
    private final ScheduledExecutorService scheduler;
    private final ReconnectionConfig config;
    private final ReconnectionCallback callback;
    
    // 重连状态
    private final AtomicInteger currentAttempts = new AtomicInteger(0);
    private final AtomicInteger totalAttempts = new AtomicInteger(0);
    private final AtomicBoolean isReconnecting = new AtomicBoolean(false);
    private final AtomicBoolean disabled = new AtomicBoolean(false);
    private final AtomicLong lastAttemptTime = new AtomicLong(0);
    
    private ScheduledFuture<?> reconnectTask;
    private long nextInterval;
    
    /**
     * 重连配置
     */
    public static class ReconnectionConfig {
        private final long baseInterval;
        private final int maxAttempts;
        private final double backoffMultiplier;
        private final long maxInterval;
        private final boolean disableOnMaxAttempts;
        
        public ReconnectionConfig(long baseInterval, int maxAttempts, 
                                 double backoffMultiplier, long maxInterval,
                                 boolean disableOnMaxAttempts) {
            this.baseInterval = baseInterval;
            this.maxAttempts = maxAttempts;
            this.backoffMultiplier = backoffMultiplier;
            this.maxInterval = maxInterval;
            this.disableOnMaxAttempts = disableOnMaxAttempts;
        }
        
        public static ReconnectionConfig defaults() {
            return new ReconnectionConfig(5000, 10, 1.5, 60000, true);
        }
        
        public static ReconnectionConfig development() {
            return new ReconnectionConfig(2000, 5, 2.0, 30000, false);
        }
        
        public static ReconnectionConfig production() {
            return new ReconnectionConfig(10000, 15, 1.5, 120000, true);
        }
    }
    
    /**
     * 重连回调接口
     */
    public interface ReconnectionCallback {
        boolean attemptReconnect();
        default void onReconnecting(int attempts, long nextInterval) {}
        default void onMaxAttemptsReached(int totalAttempts) {}
        default void onReconnectionDisabled(int totalAttempts) {}
        default void onReconnectionEnabled() {}
    }
    
    public ReconnectionManager(Logger logger, ScheduledExecutorService scheduler,
                              ReconnectionConfig config, ReconnectionCallback callback) {
        this.logger = logger;
        this.scheduler = scheduler;
        this.config = config;
        this.callback = callback;
        this.nextInterval = config.baseInterval;
    }
    
    public void scheduleReconnect() {
        if (disabled.get()) {
            logger.warning("重连已禁用，跳过重连调度");
            callback.onReconnectionDisabled(totalAttempts.get());
            return;
        }
        
        if (isReconnecting.get()) {
            return;
        }
        
        if (currentAttempts.get() >= config.maxAttempts) {
            logger.warning(String.format("达到最大重连次数 (%d)，停止重连", config.maxAttempts));
            callback.onMaxAttemptsReached(totalAttempts.get());
            
            if (config.disableOnMaxAttempts) {
                disabled.set(true);
                logger.warning("重连已自动禁用");
                callback.onReconnectionDisabled(totalAttempts.get());
            }
            return;
        }
        
        int attempts = currentAttempts.incrementAndGet();
        totalAttempts.incrementAndGet();
        lastAttemptTime.set(System.currentTimeMillis());
        
        nextInterval = calculateBackoffInterval(attempts);
        
        logger.info(String.format("调度第 %d 次重连，%d 毫秒后执行", attempts, nextInterval));
        callback.onReconnecting(attempts, nextInterval);
        
        isReconnecting.set(true);
        
        reconnectTask = scheduler.schedule(() -> {
            isReconnecting.set(false);
            try {
                boolean success = callback.attemptReconnect();
                if (success) {
                    reset();
                }
            } catch (Exception e) {
                logger.severe("重连异常: " + e.getMessage());
            }
        }, nextInterval, TimeUnit.MILLISECONDS);
    }
    
    private long calculateBackoffInterval(int attempts) {
        double exponential = config.baseInterval * Math.pow(config.backoffMultiplier, attempts - 1);
        return Math.min((long) exponential, config.maxInterval);
    }
    
    public void cancel() {
        if (reconnectTask != null && !reconnectTask.isDone()) {
            reconnectTask.cancel(false);
            reconnectTask = null;
        }
        isReconnecting.set(false);
    }
    
    public void reset() {
        cancel();
        currentAttempts.set(0);
        nextInterval = config.baseInterval;
    }
    
    public void enable() {
        if (!disabled.get()) return;
        disabled.set(false);
        currentAttempts.set(0);
        nextInterval = config.baseInterval;
        logger.info("重连已重新启用");
        callback.onReconnectionEnabled();
    }
    
    public void disable() {
        if (disabled.get()) return;
        cancel();
        disabled.set(true);
        logger.info("重连已手动禁用");
        callback.onReconnectionDisabled(totalAttempts.get());
    }
    
    public ReconnectionStatus getStatus() {
        return new ReconnectionStatus(
            isReconnecting.get(),
            currentAttempts.get(),
            totalAttempts.get(),
            nextInterval,
            disabled.get(),
            lastAttemptTime.get()
        );
    }
    
    public static class ReconnectionStatus {
        public final boolean isReconnecting;
        public final int currentAttempts;
        public final int totalAttempts;
        public final long nextInterval;
        public final boolean disabled;
        public final long lastAttemptTime;
        
        public ReconnectionStatus(boolean isReconnecting, int currentAttempts, 
                                 int totalAttempts, long nextInterval,
                                 boolean disabled, long lastAttemptTime) {
            this.isReconnecting = isReconnecting;
            this.currentAttempts = currentAttempts;
            this.totalAttempts = totalAttempts;
            this.nextInterval = nextInterval;
            this.disabled = disabled;
            this.lastAttemptTime = lastAttemptTime;
        }
    }
    
    public boolean isDisabled() { return disabled.get(); }
    public boolean isReconnecting() { return isReconnecting.get(); }
    public int getCurrentAttempts() { return currentAttempts.get(); }
    public int getTotalAttempts() { return totalAttempts.get(); }
}
