package com.mochilink.connector.connection;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.config.PluginConfig;
import com.mochilink.connector.protocol.MessageHandler;
import com.mochilink.connector.protocol.UWBPv2Protocol;
import com.mochilink.connector.websocket.MochiWebSocketClient;

import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.scheduler.BukkitTask;

import java.net.URI;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Manages WebSocket connections to the Mochi-Link management server
 * 
 * Handles both forward and reverse connection modes, automatic reconnection with exponential backoff,
 * and message routing using the U-WBP v2 protocol.
 */
public class ConnectionManager {
    
    private final MochiLinkPlugin plugin;
    private final PluginConfig config;
    private final Logger logger;
    
    private MochiWebSocketClient webSocketClient;
    private MessageHandler messageHandler;
    private UWBPv2Protocol protocol;
    
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    
    private BukkitTask heartbeatTask;
    private BukkitTask reconnectTask;
    
    // 重连状态
    private final AtomicInteger currentAttempts = new AtomicInteger(0);
    private final AtomicInteger totalAttempts = new AtomicInteger(0);
    private final AtomicBoolean isReconnecting = new AtomicBoolean(false);
    private final AtomicBoolean reconnectDisabled = new AtomicBoolean(false);
    private final AtomicLong lastAttemptTime = new AtomicLong(0);
    
    // 重连配置
    private final long baseInterval = 5000; // 5秒
    private final int maxAttempts = 10;
    private final double backoffMultiplier = 1.5;
    private final long maxInterval = 60000; // 60秒
    private final boolean disableOnMaxAttempts = true;
    
    public ConnectionManager(MochiLinkPlugin plugin, PluginConfig config) {
        this.plugin = plugin;
        this.config = config;
        this.logger = plugin.getLogger();
        
        // Initialize protocol handler
        this.protocol = new UWBPv2Protocol(plugin);
        this.messageHandler = new MessageHandler(plugin, protocol);
    }
    
    /**
     * Connect to the management server
     */
    public CompletableFuture<Boolean> connect() {
        if (connecting.get()) {
            logger.warning("Connection attempt already in progress");
            return CompletableFuture.completedFuture(false);
        }
        
        if (connected.get()) {
            logger.info("Already connected to management server");
            return CompletableFuture.completedFuture(true);
        }
        
        connecting.set(true);
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Connecting to Mochi-Link management server...");
                
                // Create WebSocket URI
                URI serverUri = createServerUri();
                
                // Create WebSocket client
                webSocketClient = new MochiWebSocketClient(serverUri, this, messageHandler);
                
                // Connect with timeout
                boolean success = webSocketClient.connectBlocking();
                
                if (success) {
                    connected.set(true);
                    resetReconnectionState();
                    
                    // Start heartbeat
                    startHeartbeat();
                    
                    // Note: Authentication is now handled via URL parameters (serverId and token)
                    // The server will authenticate the connection automatically
                    
                    logger.info("Successfully connected to management server");
                    return true;
                } else {
                    logger.warning("Failed to connect to management server");
                    return false;
                }
                
            } catch (Exception e) {
                logger.log(Level.SEVERE, "Connection failed", e);
                
                // 连接失败时触发重连
                if (config.isAutoReconnectEnabled()) {
                    scheduleReconnection();
                }
                
                return false;
            } finally {
                connecting.set(false);
            }
        });
    }
    
    /**
     * Disconnect from the management server
     */
    public void disconnect() {
        logger.info("Disconnecting from management server...");
        
        connected.set(false);
        
        // Stop heartbeat
        stopHeartbeat();
        
        // Cancel reconnection
        cancelReconnection();
        
        // Close WebSocket connection
        if (webSocketClient != null) {
            webSocketClient.close();
            webSocketClient = null;
        }
        
        logger.info("Disconnected from management server");
    }
    
    /**
     * Send message to management server
     */
    public boolean sendMessage(String message) {
        if (!connected.get() || webSocketClient == null) {
            logger.warning("Cannot send message: not connected to management server");
            return false;
        }
        
        try {
            webSocketClient.send(message);
            
            if (config.isVerboseConnection()) {
                logger.info("Sent message: " + message);
            }
            
            return true;
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send message", e);
            return false;
        }
    }
    
    /**
     * Handle connection opened
     */
    public void onConnectionOpened() {
        logger.info("WebSocket connection opened");
        connected.set(true);
    }
    
    /**
     * Handle connection closed
     */
    public void onConnectionClosed(int code, String reason, boolean remote) {
        logger.info(String.format("WebSocket connection closed: code=%d, reason=%s, remote=%s", 
                                code, reason, remote));
        
        connected.set(false);
        stopHeartbeat();
        
        // Schedule reconnection if enabled and not manually disconnected
        if (config.isAutoReconnectEnabled() && remote) {
            scheduleReconnection();
        }
    }
    
    /**
     * Handle connection error
     */
    public void onConnectionError(Exception ex) {
        logger.log(Level.WARNING, "WebSocket connection error", ex);
        
        connected.set(false);
        
        // Schedule reconnection if enabled
        if (config.isAutoReconnectEnabled()) {
            scheduleReconnection();
        }
    }
    
    /**
     * Handle received message
     */
    public void onMessageReceived(String message) {
        if (config.isVerboseConnection()) {
            logger.info("Received message: " + message);
        }
        
        // Process message through protocol handler
        messageHandler.handleMessage(message);
    }
    
    /**
     * Create server URI based on configuration
     */
    private URI createServerUri() {
        try {
            String scheme = config.isForwardSsl() ? "wss" : "ws";
            String host = config.getForwardHost();
            int port = config.getForwardPort();
            String serverId = config.getServerId();
            String token = config.getApiToken();
            
            // Create WebSocket endpoint URL with serverId and token parameters
            String url = String.format("%s://%s:%d/ws?serverId=%s&token=%s", 
                scheme, host, port, 
                java.net.URLEncoder.encode(serverId, "UTF-8"),
                java.net.URLEncoder.encode(token, "UTF-8"));
            
            logger.info("Connecting to: " + scheme + "://" + host + ":" + port + "/ws");
            
            return new URI(url);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create server URI", e);
        }
    }
    
    /**
     * Send authentication message
     */
    private void sendAuthentication() {
        try {
            String authMessage = protocol.createAuthenticationMessage(
                config.getApiToken(),
                config.getServerId()
            );
            
            sendMessage(authMessage);
            logger.info("Authentication message sent");
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send authentication", e);
        }
    }
    
    /**
     * Start heartbeat task
     */
    private void startHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel();
        }
        
        int interval = config.getHeartbeatInterval();
        
        heartbeatTask = new BukkitRunnable() {
            @Override
            public void run() {
                if (connected.get()) {
                    String heartbeatMessage = protocol.createHeartbeatMessage();
                    sendMessage(heartbeatMessage);
                }
            }
        }.runTaskTimerAsynchronously(plugin, interval * 20L, interval * 20L);
        
        logger.info("Heartbeat started with interval: " + interval + " seconds");
    }
    
    /**
     * Stop heartbeat task
     */
    private void stopHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel();
            heartbeatTask = null;
            logger.info("Heartbeat stopped");
        }
    }
    
    /**
     * Schedule reconnection attempt with exponential backoff
     */
    private void scheduleReconnection() {
        // 检查是否已禁用
        if (reconnectDisabled.get()) {
            logger.warning("重连已禁用，跳过重连调度");
            return;
        }
        
        // 检查是否正在重连
        if (isReconnecting.get()) {
            logger.fine("已在重连中，跳过");
            return;
        }
        
        // 检查是否达到最大尝试次数
        if (currentAttempts.get() >= maxAttempts) {
            logger.warning("达到最大重连次数 (" + maxAttempts + ")，停止重连");
            
            // 自动禁用重连
            if (disableOnMaxAttempts) {
                reconnectDisabled.set(true);
                logger.warning("重连已自动禁用");
            }
            
            return;
        }
        
        // 增加尝试计数
        int attempts = currentAttempts.incrementAndGet();
        totalAttempts.incrementAndGet();
        lastAttemptTime.set(System.currentTimeMillis());
        
        // 计算指数退避间隔
        long exponentialInterval = (long) (baseInterval * Math.pow(backoffMultiplier, attempts - 1));
        long nextInterval = Math.min(exponentialInterval, maxInterval);
        
        logger.info(String.format("调度第 %d 次重连，%dms 后执行 (总尝试: %d)", 
            attempts, nextInterval, totalAttempts.get()));
        
        // 标记为重连中
        isReconnecting.set(true);
        
        // 调度重连任务
        reconnectTask = new BukkitRunnable() {
            @Override
            public void run() {
                isReconnecting.set(false);
                
                if (!connected.get()) {
                    logger.info("执行第 " + attempts + " 次重连尝试...");
                    connect().thenAccept(success -> {
                        if (success) {
                            logger.info("重连成功！");
                        }
                    });
                }
            }
        }.runTaskLaterAsynchronously(plugin, nextInterval / 50); // 50ms per tick
    }
    
    /**
     * Cancel reconnection
     */
    private void cancelReconnection() {
        if (reconnectTask != null) {
            reconnectTask.cancel();
            reconnectTask = null;
        }
        isReconnecting.set(false);
    }
    
    /**
     * Reset reconnection state
     */
    private void resetReconnectionState() {
        cancelReconnection();
        currentAttempts.set(0);
        // totalAttempts 和 reconnectDisabled 不重置，用于跟踪生命周期统计
    }
    
    /**
     * Enable reconnection
     */
    public void enableReconnection() {
        if (!reconnectDisabled.get()) {
            logger.fine("重连已经是启用状态");
            return;
        }
        
        reconnectDisabled.set(false);
        currentAttempts.set(0);
        
        logger.info("重连已重新启用");
    }
    
    /**
     * Disable reconnection
     */
    public void disableReconnection() {
        if (reconnectDisabled.get()) {
            logger.fine("重连已经是禁用状态");
            return;
        }
        
        cancelReconnection();
        reconnectDisabled.set(true);
        
        logger.info("重连已手动禁用");
    }
    
    /**
     * Get reconnection status
     */
    public String getReconnectionStatus() {
        return String.format("ReconnectionStatus{reconnecting=%s, attempts=%d, totalAttempts=%d, disabled=%s, lastAttempt=%d}",
            isReconnecting.get(), currentAttempts.get(), totalAttempts.get(), 
            reconnectDisabled.get(), lastAttemptTime.get());
    }
    
    /**
     * Check if connected to management server
     */
    public boolean isConnected() {
        return connected.get() && webSocketClient != null && webSocketClient.isOpen();
    }
    
    /**
     * Check if connection is in progress
     */
    public boolean isConnecting() {
        return connecting.get();
    }
    
    /**
     * Get current reconnection attempts
     */
    public int getReconnectAttempts() {
        return currentAttempts.get();
    }
    
    /**
     * Reset reconnection attempts counter
     */
    public void resetReconnectAttempts() {
        currentAttempts.set(0);
    }
    
    /**
     * Get connection statistics
     */
    public ConnectionStats getConnectionStats() {
        return new ConnectionStats(
            connected.get(),
            connecting.get(),
            currentAttempts.get(),
            totalAttempts.get(),
            reconnectDisabled.get(),
            webSocketClient != null ? webSocketClient.getConnectionTime() : 0
        );
    }
    
    /**
     * Connection statistics data class
     */
    public static class ConnectionStats {
        private final boolean connected;
        private final boolean connecting;
        private final int reconnectAttempts;
        private final int totalAttempts;
        private final boolean reconnectDisabled;
        private final long connectionTime;
        
        public ConnectionStats(boolean connected, boolean connecting, 
                             int reconnectAttempts, int totalAttempts,
                             boolean reconnectDisabled, long connectionTime) {
            this.connected = connected;
            this.connecting = connecting;
            this.reconnectAttempts = reconnectAttempts;
            this.totalAttempts = totalAttempts;
            this.reconnectDisabled = reconnectDisabled;
            this.connectionTime = connectionTime;
        }
        
        public boolean isConnected() { return connected; }
        public boolean isConnecting() { return connecting; }
        public int getReconnectAttempts() { return reconnectAttempts; }
        public int getTotalAttempts() { return totalAttempts; }
        public boolean isReconnectDisabled() { return reconnectDisabled; }
        public long getConnectionTime() { return connectionTime; }
    }
    
    /**
     * Get protocol instance
     */
    public UWBPv2Protocol getProtocol() {
        return protocol;
    }
}
