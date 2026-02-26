package com.mochilink.connector.nukkit.connection;

import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.config.NukkitPluginConfig;
import com.mochilink.connector.nukkit.protocol.UWBPMessage;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.util.concurrent.atomic.AtomicBoolean;
import cn.nukkit.plugin.PluginLogger;
import cn.nukkit.scheduler.TaskHandler;

/**
 * Manages WebSocket connection to Mochi-Link management server for Nukkit
 * Implements U-WBP v2 protocol
 */
public class NukkitConnectionManager {
    
    private final MochiLinkNukkitPlugin plugin;
    private final NukkitPluginConfig config;
    private final PluginLogger logger;
    private final Gson gson;
    
    private WebSocketClient wsClient;
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    private TaskHandler heartbeatTask;
    private TaskHandler reconnectTask;
    
    public NukkitConnectionManager(MochiLinkNukkitPlugin plugin, NukkitPluginConfig config) {
        this.plugin = plugin;
        this.config = config;
        this.logger = plugin.getLogger();
        this.gson = new Gson();
    }
    
    /**
     * Connect to management server
     */
    public void connect() {
        if (connecting.get() || connected.get()) {
            logger.warning("Already connected or connecting");
            return;
        }
        
        connecting.set(true);
        
        try {
            String wsUrl = config.getWebSocketUrl();
            logger.info("Connecting to: " + wsUrl);
            
            URI serverUri = new URI(wsUrl);
            
            wsClient = new WebSocketClient(serverUri) {
                @Override
                public void onOpen(ServerHandshake handshake) {
                    logger.info("WebSocket connection opened");
                    connected.set(true);
                    connecting.set(false);
                    
                    // Send handshake message
                    sendHandshake();
                    
                    // Start heartbeat
                    startHeartbeat();
                }
                
                @Override
                public void onMessage(String message) {
                    handleMessage(message);
                }
                
                @Override
                public void onClose(int code, String reason, boolean remote) {
                    logger.info("WebSocket connection closed: " + reason);
                    connected.set(false);
                    stopHeartbeat();
                    
                    // Auto reconnect
                    if (remote) {
                        scheduleReconnect();
                    }
                }
                
                @Override
                public void onError(Exception ex) {
                    logger.error("WebSocket error", ex);
                    connected.set(false);
                }
            };
            
            wsClient.connect();
            
        } catch (Exception e) {
            logger.error("Failed to connect", e);
            connected.set(false);
            connecting.set(false);
        }
    }
    
    /**
     * Send handshake message (U-WBP v2)
     */
    private void sendHandshake() {
        if (wsClient == null || !wsClient.isOpen()) {
            return;
        }
        
        JsonObject handshake = new JsonObject();
        handshake.addProperty("type", "system");
        handshake.addProperty("id", generateId());
        handshake.addProperty("op", "handshake");
        handshake.addProperty("timestamp", System.currentTimeMillis());
        handshake.addProperty("version", "2.0");
        handshake.addProperty("systemOp", "handshake");
        
        JsonObject data = new JsonObject();
        data.addProperty("protocolVersion", "2.0");
        data.addProperty("serverType", "connector");
        data.addProperty("serverId", plugin.getServer().getServerUniqueId().toString());
        
        JsonObject serverInfo = new JsonObject();
        serverInfo.addProperty("name", plugin.getServer().getName());
        serverInfo.addProperty("version", plugin.getServer().getVersion());
        serverInfo.addProperty("coreType", "Bedrock");
        serverInfo.addProperty("coreName", "Nukkit");
        data.add("serverInfo", serverInfo);
        
        handshake.add("data", data);
        
        wsClient.send(handshake.toString());
        logger.info("Handshake sent: " + handshake.toString());
    }
    
    /**
     * Disconnect from management server
     */
    public void disconnect() {
        if (!connected.get()) {
            return;
        }
        
        try {
            // Send disconnect message
            sendDisconnect("Plugin disabled");
            
            stopHeartbeat();
            
            if (wsClient != null) {
                wsClient.close();
                wsClient = null;
            }
            
            connected.set(false);
            logger.info("Disconnected from management server");
            
        } catch (Exception e) {
            logger.warning("Error during disconnect", e);
        }
    }
    
    /**
     * Send disconnect message (U-WBP v2)
     */
    private void sendDisconnect(String reason) {
        if (wsClient == null || !wsClient.isOpen()) {
            return;
        }
        
        JsonObject disconnect = new JsonObject();
        disconnect.addProperty("type", "system");
        disconnect.addProperty("id", generateId());
        disconnect.addProperty("op", "disconnect");
        disconnect.addProperty("timestamp", System.currentTimeMillis());
        disconnect.addProperty("version", "2.0");
        disconnect.addProperty("systemOp", "disconnect");
        
        JsonObject data = new JsonObject();
        data.addProperty("reason", reason);
        disconnect.add("data", data);
        
        wsClient.send(disconnect.toString());
        logger.info("Disconnect sent: " + disconnect.toString());
    }
    
    /**
     * Check if connected
     */
    public boolean isConnected() {
        return connected.get();
    }
    
    /**
     * Send event message (U-WBP v2)
     */
    public void sendEvent(String eventOp, JsonObject eventData) {
        if (!connected.get() || wsClient == null) {
            logger.warning("Cannot send event: not connected");
            return;
        }
        
        JsonObject event = new JsonObject();
        event.addProperty("type", "event");
        event.addProperty("id", generateId());
        event.addProperty("op", eventOp);
        event.addProperty("timestamp", System.currentTimeMillis());
        event.addProperty("version", "2.0");
        event.addProperty("eventType", eventOp);
        event.add("data", eventData);
        
        wsClient.send(event.toString());
        logger.debug("Sending event: " + event.toString());
    }
    
    /**
     * Send message to management server
     */
    public void sendMessage(String message) {
        if (!connected.get() || wsClient == null) {
            logger.warning("Cannot send message: not connected");
            return;
        }
        
        wsClient.send(message);
        logger.debug("Sending message: " + message);
    }
    
    /**
     * Handle received message
     */
    private void handleMessage(String message) {
        try {
            JsonObject json = gson.fromJson(message, JsonObject.class);
            String type = json.get("type").getAsString();
            
            if ("request".equals(type)) {
                // Handle request
                logger.debug("Received request: " + message);
            } else if ("system".equals(type)) {
                // Handle system message
                logger.debug("Received system message: " + message);
            }
        } catch (Exception e) {
            logger.error("Failed to handle message", e);
        }
    }
    
    /**
     * Start heartbeat task
     */
    private void startHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel();
        }
        
        heartbeatTask = plugin.getServer().getScheduler().scheduleRepeatingTask(plugin, new Runnable() {
            @Override
            public void run() {
                if (connected.get()) {
                    JsonObject ping = new JsonObject();
                    ping.addProperty("type", "system");
                    ping.addProperty("id", generateId());
                    ping.addProperty("op", "ping");
                    ping.addProperty("timestamp", System.currentTimeMillis());
                    ping.addProperty("version", "2.0");
                    ping.addProperty("systemOp", "ping");
                    
                    sendMessage(ping.toString());
                }
            }
        }, 20 * 30);
    }
    
    /**
     * Stop heartbeat task
     */
    private void stopHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel();
            heartbeatTask = null;
        }
    }
    
    /**
     * Schedule reconnection
     */
    private void scheduleReconnect() {
        if (reconnectTask != null) {
            reconnectTask.cancel();
        }
        
        reconnectTask = plugin.getServer().getScheduler().scheduleDelayedTask(plugin, new Runnable() {
            @Override
            public void run() {
                logger.info("Attempting to reconnect...");
                connect();
            }
        }, 20 * 10);
    }
    
    /**
     * Generate unique message ID
     */
    private String generateId() {
        return System.currentTimeMillis() + "-" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }
}
