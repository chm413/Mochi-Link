package com.mochilink.connector.fabric.connection;

import com.mochilink.connector.fabric.MochiLinkFabricMod;
import com.mochilink.connector.fabric.config.FabricModConfig;
import com.google.gson.JsonObject;
import org.slf4j.Logger;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Manages WebSocket connection to Mochi-Link management server for Fabric
 * Implements U-WBP v2 protocol
 */
public class FabricConnectionManager {
    
    private final MochiLinkFabricMod mod;
    private final FabricModConfig config;
    private final Logger logger;
    
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    
    public FabricConnectionManager(MochiLinkFabricMod mod, FabricModConfig config) {
        this.mod = mod;
        this.config = config;
        this.logger = MochiLinkFabricMod.getLogger();
    }
    
    public void connect() {
        if (connecting.get() || connected.get()) {
            logger.warn("Already connected or connecting");
            return;
        }
        
        connecting.set(true);
        
        try {
            String wsUrl = config.getWebSocketUrl();
            logger.info("Connecting to: {}", wsUrl);
            
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
        
        JsonObject serverInfo = new JsonObject();
        serverInfo.addProperty("name", "Fabric Server");
        serverInfo.addProperty("version", MochiLinkFabricMod.VERSION);
        serverInfo.addProperty("coreType", "Java");
        serverInfo.addProperty("coreName", "Fabric");
        data.add("serverInfo", serverInfo);
        
        handshake.add("data", data);
        
        logger.info("Handshake sent: {}", handshake.toString());
    }
    
    public void disconnect() {
        if (!connected.get()) {
            return;
        }
        
        try {
            sendDisconnect("Mod disabled");
            connected.set(false);
            logger.info("Disconnected from management server");
            
        } catch (Exception e) {
            logger.warn("Error during disconnect", e);
        }
    }
    
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
        
        logger.info("Disconnect sent: {}", disconnect.toString());
    }
    
    public boolean isConnected() {
        return connected.get();
    }
    
    public void sendEvent(String eventOp, JsonObject eventData) {
        if (!connected.get()) {
            logger.warn("Cannot send event: not connected");
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
        
        logger.debug("Sending event: {}", event.toString());
    }
    
    private String generateId() {
        return System.currentTimeMillis() + "-" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }
}
