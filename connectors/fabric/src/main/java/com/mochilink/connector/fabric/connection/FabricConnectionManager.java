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
        handshake.addProperty("type", "request");
        handshake.addProperty("id", generateId());
        handshake.addProperty("op", "system.handshake");
        handshake.addProperty("timestamp", System.currentTimeMillis());
        handshake.addProperty("version", "2.0");
        
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
        logger.info("Handshake sent");
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
        disconnect.addProperty("type", "request");
        disconnect.addProperty("id", generateId());
        disconnect.addProperty("op", "system.disconnect");
        disconnect.addProperty("timestamp", System.currentTimeMillis());
        disconnect.addProperty("version", "2.0");
        
        JsonObject data = new JsonObject();
        data.addProperty("reason", reason);
        disconnect.add("data", data);
        
        wsClient.send(disconnect.toString());
        logger.info("Disconnect sent");
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
        event.add("data", eventData);
        
        wsClient.send(event.toString());
        logger.debug("Sending event: {}", eventOp);
    }
    
    private void handleMessage(String message) {
        try {
            JsonObject json = gson.fromJson(message, JsonObject.class);
            String type = json.get("type").getAsString();
            
            if ("request".equals(type)) {
                handleRequest(json);
            } else if ("system".equals(type)) {
                logger.debug("Received system message: {}", message);
            }
        } catch (Exception e) {
            logger.error("Failed to handle message", e);
        }
    }
    
    /**
     * Handle request message
     */
    private void handleRequest(JsonObject request) {
        String op = request.get("op").getAsString();
        String requestId = request.get("id").getAsString();
        
        switch (op) {
            case "event.subscribe":
                handleEventSubscribe(request, requestId);
                break;
            case "event.unsubscribe":
                handleEventUnsubscribe(request, requestId);
                break;
            default:
                logger.debug("Unhandled request operation: {}", op);
                break;
        }
    }
    
    /**
     * Handle event subscription request
     */
    private void handleEventSubscribe(JsonObject request, String requestId) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            
            // Generate subscription ID
            String subscriptionId = "sub_" + System.currentTimeMillis();
            
            // Extract event types
            java.util.List<String> eventTypes = new java.util.ArrayList<>();
            if (data.has("eventTypes")) {
                data.getAsJsonArray("eventTypes").forEach(e -> eventTypes.add(e.getAsString()));
            }
            
            // Extract filters
            java.util.Map<String, Object> filters = new java.util.HashMap<>();
            if (data.has("filters")) {
                JsonObject filtersObj = data.getAsJsonObject("filters");
                filtersObj.entrySet().forEach(entry -> {
                    if (entry.getValue().isJsonPrimitive()) {
                        filters.put(entry.getKey(), entry.getValue().getAsString());
                    }
                });
            }
            
            // Create subscription
            com.mochilink.connector.fabric.subscription.EventSubscription subscription = 
                new com.mochilink.connector.fabric.subscription.EventSubscription(
                    subscriptionId,
                    eventTypes,
                    filters,
                    System.currentTimeMillis()
                );
            
            // Add to subscription manager
            mod.getSubscriptionManager().addSubscription(subscriptionId, subscription);
            
            // Send success response
            JsonObject response = new JsonObject();
            response.addProperty("type", "response");
            response.addProperty("id", requestId);
            response.addProperty("op", "event.subscribe");
            response.addProperty("timestamp", System.currentTimeMillis());
            response.addProperty("version", "2.0");
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("subscriptionId", subscriptionId);
            responseData.addProperty("success", true);
            response.add("data", responseData);
            
            if (wsClient != null && wsClient.isOpen()) {
                wsClient.send(response.toString());
            }
            logger.info("Event subscription created: {}", subscriptionId);
            
        } catch (Exception e) {
            logger.warn("Failed to handle event subscription: {}", e.getMessage());
            sendErrorResponse(requestId, "event.subscribe", e.getMessage());
        }
    }
    
    /**
     * Handle event unsubscription request
     */
    private void handleEventUnsubscribe(JsonObject request, String requestId) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            String subscriptionId = data.get("subscriptionId").getAsString();
            
            // Remove subscription
            mod.getSubscriptionManager().removeSubscription(subscriptionId);
            
            // Send success response
            JsonObject response = new JsonObject();
            response.addProperty("type", "response");
            response.addProperty("id", requestId);
            response.addProperty("op", "event.unsubscribe");
            response.addProperty("timestamp", System.currentTimeMillis());
            response.addProperty("version", "2.0");
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            response.add("data", responseData);
            
            if (wsClient != null && wsClient.isOpen()) {
                wsClient.send(response.toString());
            }
            logger.info("Event subscription removed: {}", subscriptionId);
            
        } catch (Exception e) {
            logger.warn("Failed to handle event unsubscription: {}", e.getMessage());
            sendErrorResponse(requestId, "event.unsubscribe", e.getMessage());
        }
    }
    
    /**
     * Send error response
     */
    private void sendErrorResponse(String requestId, String op, String errorMessage) {
        JsonObject response = new JsonObject();
        response.addProperty("type", "error");
        response.addProperty("id", requestId);
        response.addProperty("op", op);
        response.addProperty("timestamp", System.currentTimeMillis());
        response.addProperty("version", "2.0");
        
        JsonObject error = new JsonObject();
        error.addProperty("code", "OPERATION_FAILED");
        error.addProperty("message", errorMessage);
        response.add("error", error);
        
        if (wsClient != null && wsClient.isOpen()) {
            wsClient.send(response.toString());
        }
    }
    
    private void startHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel(false);
        }
        
        heartbeatTask = scheduler.scheduleAtFixedRate(() -> {
            if (connected.get() && wsClient != null) {
                JsonObject ping = new JsonObject();
                ping.addProperty("type", "request");
                ping.addProperty("id", generateId());
                ping.addProperty("op", "system.ping");
                ping.addProperty("timestamp", System.currentTimeMillis());
                ping.addProperty("version", "2.0");
                
                JsonObject data = new JsonObject();
                ping.add("data", data);
                
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
