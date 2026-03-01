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
        private final long baseInterval;           // 基础重连间隔(毫秒)
        private final int maxAttempts;             // 最大重连次数
        private final double backoffMultiplier;    // 退避倍数
        private final long maxInterval;            // 最大重连间隔(毫秒)
        private final boolean disableOnMaxAttempts; // 达到上限后自动禁用
        
        public ReconnectionConfig(long baseInterval, int maxAttempts, 
                                 double backoffMultiplier, long maxInterval,
                                 boolean disableOnMaxAttempts) {
            this.baseInterval = baseInterval;
            this.maxAttempts = maxAttempts;
            this.backoffMultiplier = backoffMultiplier;
            this.maxInterval = maxInterval;
            this.disableOnMaxAttempts = disableOnMaxAttempts;
        }
        
        /**
         * 默认配置
         */
        public static ReconnectionConfig defaults() {
            return new ReconnectionConfig(
                5000,    // 5秒基础间隔
                10,      // 最多10次
                1.5,     // 1.5倍增长
                60000,   // 最大60秒
                true     // 自动禁用
            );
        }
        
        /**
         * 开发环境配置（更快重连）
         */
        public static ReconnectionConfig development() {
            return new ReconnectionConfig(
                2000,    // 2秒基础间隔
                5,       // 最多5次
                2.0,     // 2倍增长
                30000,   // 最大30秒
                false    // 不自动禁用
            );
        }
        
        /**
         * 生产环境配置（更保守）
         */
        public static ReconnectionConfig production() {
            return new ReconnectionConfig(
                10000,   // 10秒基础间隔
                15,      // 最多15次
                1.5,     // 1.5倍增长
                120000,  // 最大2分钟
                true     // 自动禁用
            );
        }
    }
    
    /**
     * 重连回调接口
     */
    public interface ReconnectionCallback {
        /**
         * 执行重连操作
         * @return 是否成功连接
         */
        boolean attemptReconnect();
        
        /**
         * 重连失败回调（可选）
         * @param attempts 当前尝试次数
         * @param nextInterval 下次重连间隔
         */
        default void onReconnecting(int attempts, long nextInterval) {}
        
        /**
         * 达到最大尝试次数回调（可选）
         * @param totalAttempts 总尝试次数
         */
        default void onMaxAttemptsReached(int totalAttempts) {}
        
        /**
         * 重连被禁用回调（可选）
         * @param totalAttempts 总尝试次数
         */
        default void onReconnectionDisabled(int totalAttempts) {}
        
        /**
         * 重连被启用回调（可选）
         */
        default void onReconnectionEnabled() {}
    }
    
    /**
     * 构造函数
     */
    public ReconnectionManager(Logger logger, ScheduledExecutorService scheduler,
                              ReconnectionConfig config, ReconnectionCallback callback) {
        this.logger = logger;
        this.scheduler = scheduler;
        this.config = config;
        this.callback = callback;
        this.nextInterval = config.baseInterval;
    }
    
    /**
     * 调度重连
     */
    public void scheduleReconnect() {
        // 检查是否已禁用
        if (disabled.get()) {
            logger.warning("重连已禁用，跳过重连调度");
            callback.onReconnectionDisabled(totalAttempts.get());
            return;
        }
        
        // 检查是否正在重连
        if (isReconnecting.get()) {
            logger.fine("已在重连中，跳过");
            return;
        }
        
        // 检查是否达到最大尝试次数
        if (currentAttempts.get() >= config.maxAttempts) {
            logger.warning(String.format("达到最大重连次数 (%d)，停止重连", config.maxAttempts));
            callback.onMaxAttemptsReached(totalAttempts.get());
            
            // 自动禁用重连
            if (config.disableOnMaxAttempts) {
                disabled.set(true);
                logger.warning("重连已自动禁用");
                callback.onReconnectionDisabled(totalAttempts.get());
            }
            
            return;
        }
        
        // 增加尝试计数
        int attempts = currentAttempts.incrementAndGet();
        totalAttempts.incrementAndGet();
        lastAttemptTime.set(System.currentTimeMillis());
        
        // 计算指数退避间隔
        nextInterval = calculateBackoffInterval(attempts);
        
        logger.info(String.format("调度第 %d 次重连，%d 毫秒后执行 (总尝试: %d)", 
            attempts, nextInterval, totalAttempts.get()));
        
        callback.onReconnecting(attempts, nextInterval);
        
        // 标记为重连中
        isReconnecting.set(true);
        
        // 调度重连任务
        reconnectTask = scheduler.schedule(() -> {
            isReconnecting.set(false);
            
            try {
                logger.info(String.format("执行第 %d 次重连尝试...", attempts));
                boolean success = callback.attemptReconnect();
                
                if (success) {
                    logger.info("重连成功！");
                    reset();
                } else {
                    logger.warning("重连失败，将继续尝试");
                    // 失败后会由连接断开事件再次触发 scheduleReconnect
                }
            } catch (Exception e) {
                logger.severe("重连过程中发生异常: " + e.getMessage());
                // 异常后也会由连接断开事件再次触发 scheduleReconnect
            }
        }, nextInterval, TimeUnit.MILLISECONDS);
    }
    
    /**
     * 计算指数退避间隔
     */
    private long calculateBackoffInterval(int attempts) {
        // 指数退避公式: baseInterval * (multiplier ^ (attempts - 1))
        double exponential = config.baseInterval * Math.pow(config.backoffMultiplier, attempts - 1);
        long interval = (long) exponential;
        
        // 限制在最大间隔内
        return Math.min(interval, config.maxInterval);
    }
    
    /**
     * 取消重连
     */
    public void cancel() {
        if (reconnectTask != null && !reconnectTask.isDone()) {
            reconnectTask.cancel(false);
            reconnectTask = null;
        }
        isReconnecting.set(false);
    }
    
    /**
     * 重置重连状态（连接成功后调用）
     */
    public void reset() {
        cancel();
        currentAttempts.set(0);
        nextInterval = config.baseInterval;
        // 注意: totalAttempts 和 disabled 不重置，用于跟踪生命周期统计
    }
    
    /**
     * 启用重连
     */
    public void enable() {
        if (!disabled.get()) {
            logger.fine("重连已经是启用状态");
            return;
        }
        
        disabled.set(false);
        currentAttempts.set(0);
        nextInterval = config.baseInterval;
        
        logger.info("重连已重新启用");
        callback.onReconnectionEnabled();
    }
    
    /**
     * 禁用重连
     */
    public void disable() {
        if (disabled.get()) {
            logger.fine("重连已经是禁用状态");
            return;
        }
        
        cancel();
        disabled.set(true);
        
        logger.info("重连已手动禁用");
        callback.onReconnectionDisabled(totalAttempts.get());
    }
    
    /**
     * 获取重连状态
     */
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
    
    /**
     * 重连状态信息
     */
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
        
        @Override
        public String toString() {
            return String.format(
                "ReconnectionStatus{reconnecting=%s, attempts=%d/%d, total=%d, nextInterval=%dms, disabled=%s, lastAttempt=%d}",
                isReconnecting, currentAttempts, 
                10, // 假设最大10次，实际应该从config获取
                totalAttempts, nextInterval, disabled, lastAttemptTime
            );
        }
    }
    
    /**
     * 是否已禁用
     */
    public boolean isDisabled() {
        return disabled.get();
    }
    
    /**
     * 是否正在重连
     */
    public boolean isReconnecting() {
        return isReconnecting.get();
    }
    
    /**
     * 获取当前尝试次数
     */
    public int getCurrentAttempts() {
        return currentAttempts.get();
    }
    
    /**
     * 获取总尝试次数
     */
    public int getTotalAttempts() {
        return totalAttempts.get();
    }
}
