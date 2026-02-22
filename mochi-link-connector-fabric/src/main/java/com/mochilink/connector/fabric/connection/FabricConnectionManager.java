package com.mochilink.connector.fabric.connection;

import com.mochilink.connector.fabric.MochiLinkFabricMod;
import com.mochilink.connector.fabric.config.FabricModConfig;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;

import java.net.URI;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Manages WebSocket connection to Mochi-Link management server for Fabric
 * Implements U-WBP v2 protocol
 */
public class FabricConnectionManager {
    
    private final MochiLinkFabricMod mod;
    private final FabricModConfig config;
    private final Logger logger;
    private final Gson gson;
    
    private WebSocketClient wsClient;
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private ScheduledFuture<?> heartbeatTask;
    private ScheduledFuture<?> reconnectTask;
    
    public FabricConnectionManager(MochiLinkFabricMod mod, FabricModConfig config) {
        this.mod = mod;
        this.config = config;
        this.logger = MochiLinkFabricMod.getLogger();
        this.gson = new Gson();
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
                    logger.info("WebSocket connection closed: {}", reason);
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
        
        JsonObject serverInfo = new JsonObject();
        serverInfo.addProperty("name", "Fabric Server");
        serverInfo.addProperty("version", MochiLinkFabricMod.VERSION);
        serverInfo.addProperty("coreType", "Java");
        serverInfo.addProperty("coreName", "Fabric");
        data.add("serverInfo", serverInfo);
        
        handshake.add("data", data);
        
        wsClient.send(handshake.toString());
        logger.info("Handshake sent: {}", handshake.toString());
    }
    
    public void disconnect() {
        if (!connected.get()) {
            return;
        }
        
        try {
            sendDisconnect("Mod disabled");
            
            stopHeartbeat();
            scheduler.shutdown();
            
            if (wsClient != null) {
                wsClient.close();
                wsClient = null;
            }
            
            connected.set(false);
            logger.info("Disconnected from management server");
            
        } catch (Exception e) {
            logger.warn("Error during disconnect", e);
        }
    }
    
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
        logger.info("Disconnect sent: {}", disconnect.toString());
    }
    
    public boolean isConnected() {
        return connected.get();
    }
    
    public void sendEvent(String eventOp, JsonObject eventData) {
        if (!connected.get() || wsClient == null) {
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
        
        wsClient.send(event.toString());
        logger.debug("Sending event: {}", event.toString());
    }
    
    private void handleMessage(String message) {
        try {
            JsonObject json = gson.fromJson(message, JsonObject.class);
            String type = json.get("type").getAsString();
            
            if ("request".equals(type)) {
                logger.debug("Received request: {}", message);
            } else if ("system".equals(type)) {
                logger.debug("Received system message: {}", message);
            }
        } catch (Exception e) {
            logger.error("Failed to handle message", e);
        }
    }
    
    private void startHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel(false);
        }
        
        heartbeatTask = scheduler.scheduleAtFixedRate(() -> {
            if (connected.get() && wsClient != null) {
                JsonObject ping = new JsonObject();
                ping.addProperty("type", "system");
                ping.addProperty("id", generateId());
                ping.addProperty("op", "ping");
                ping.addProperty("timestamp", System.currentTimeMillis());
                ping.addProperty("version", "2.0");
                ping.addProperty("systemOp", "ping");
                
                wsClient.send(ping.toString());
            }
        }, 30, 30, TimeUnit.SECONDS);
    }
    
    private void stopHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel(false);
            heartbeatTask = null;
        }
    }
    
    private void scheduleReconnect() {
        if (reconnectTask != null) {
            reconnectTask.cancel(false);
        }
        
        reconnectTask = scheduler.schedule(() -> {
            logger.info("Attempting to reconnect...");
            connect();
        }, 10, TimeUnit.SECONDS);
    }
    
    private String generateId() {
        return System.currentTimeMillis() + "-" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }
}
