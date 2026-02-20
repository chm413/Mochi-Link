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
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Manages WebSocket connections to the Mochi-Link management server
 * 
 * Handles both forward and reverse connection modes, automatic reconnection,
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
    
    private int reconnectAttempts = 0;
    
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
                    reconnectAttempts = 0;
                    
                    // Start heartbeat
                    startHeartbeat();
                    
                    // Send authentication message
                    sendAuthentication();
                    
                    logger.info("Successfully connected to management server");
                    return true;
                } else {
                    logger.warning("Failed to connect to management server");
                    return false;
                }
                
            } catch (Exception e) {
                logger.log(Level.SEVERE, "Connection failed", e);
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
        
        // Stop reconnect task
        if (reconnectTask != null) {
            reconnectTask.cancel();
            reconnectTask = null;
        }
        
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
            
            // Create WebSocket endpoint URL
            String url = String.format("%s://%s:%d/ws/minecraft", scheme, host, port);
            
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
     * Schedule reconnection attempt
     */
    private void scheduleReconnection() {
        // Check max reconnect attempts
        int maxAttempts = config.getMaxReconnectAttempts();
        if (maxAttempts > 0 && reconnectAttempts >= maxAttempts) {
            logger.warning("Maximum reconnection attempts reached. Giving up.");
            return;
        }
        
        reconnectAttempts++;
        int interval = config.getReconnectInterval();
        
        logger.info(String.format("Scheduling reconnection attempt #%d in %d seconds", 
                                reconnectAttempts, interval));
        
        reconnectTask = new BukkitRunnable() {
            @Override
            public void run() {
                if (!connected.get()) {
                    logger.info("Attempting reconnection...");
                    connect();
                }
            }
        }.runTaskLaterAsynchronously(plugin, interval * 20L);
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
        return reconnectAttempts;
    }
    
    /**
     * Reset reconnection attempts counter
     */
    public void resetReconnectAttempts() {
        reconnectAttempts = 0;
    }
    
    /**
     * Get connection statistics
     */
    public ConnectionStats getConnectionStats() {
        return new ConnectionStats(
            connected.get(),
            connecting.get(),
            reconnectAttempts,
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
        private final long connectionTime;
        
        public ConnectionStats(boolean connected, boolean connecting, 
                             int reconnectAttempts, long connectionTime) {
            this.connected = connected;
            this.connecting = connecting;
            this.reconnectAttempts = reconnectAttempts;
            this.connectionTime = connectionTime;
        }
        
        public boolean isConnected() { return connected; }
        public boolean isConnecting() { return connecting; }
        public int getReconnectAttempts() { return reconnectAttempts; }
        public long getConnectionTime() { return connectionTime; }
    }
}