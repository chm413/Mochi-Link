package com.mochilink.connector.nukkit.connection;

import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.config.NukkitPluginConfig;
import com.mochilink.connector.nukkit.protocol.UWBPMessage;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.net.URI;
import java.util.concurrent.atomic.AtomicBoolean;
import cn.nukkit.plugin.PluginLogger;

/**
 * Manages WebSocket connection to Mochi-Link management server for Nukkit
 * Implements U-WBP v2 protocol
 */
public class NukkitConnectionManager {
    
    private final MochiLinkNukkitPlugin plugin;
    private final NukkitPluginConfig config;
    private final PluginLogger logger;
    private final Gson gson;
    
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    
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
            
            // Send handshake message
            sendHandshake();
            
            connected.set(true);
            connecting.set(false);
            
            logger.info("Connected to Mochi-Link management server");
            
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
        if (!connected.get()) {
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
        
        logger.debug("Sending event: " + event.toString());
    }
    
    /**
     * Send message to management server
     */
    public void sendMessage(String message) {
        if (!connected.get()) {
            logger.warning("Cannot send message: not connected");
            return;
        }
        
        logger.debug("Sending message: " + message);
    }
    
    /**
     * Generate unique message ID
     */
    private String generateId() {
        return System.currentTimeMillis() + "-" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }
}
