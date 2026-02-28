package com.mochilink.connector.folia.connection;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.config.FoliaPluginConfig;
import com.mochilink.connector.folia.subscription.EventSubscription;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Manages WebSocket connection to Mochi-Link management server for Folia
 * Handles connection lifecycle, message routing, and event subscription with real WebSocket implementation
 */
public class FoliaConnectionManager {
    
    private final MochiLinkFoliaPlugin plugin;
    private final FoliaPluginConfig config;
    private final Logger logger;
    private final Gson gson;
    
    private WebSocketClient wsClient;
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    
    public FoliaConnectionManager(MochiLinkFoliaPlugin plugin, FoliaPluginConfig config) {
        this.plugin = plugin;
        this.config = config;
        this.logger = plugin.getLogger();
        this.gson = new Gson();
    }
    
    /**
     * Connect to management server with real WebSocket
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
                    connected.set(true);
                    connecting.set(false);
                    logger.info("WebSocket connection established");
                    logger.info("Connected to Mochi-Link management server");
                    
                    // Send handshake message
                    sendHandshake();
                }
                
                @Override
                public void onMessage(String message) {
                    logger.fine("Received message: " + message);
                    handleMessage(message);
                }
                
                @Override
                public void onClose(int code, String reason, boolean remote) {
                    connected.set(false);
                    connecting.set(false);
                    logger.warning("WebSocket connection closed: " + reason + " (code: " + code + ")");
                    
                    // Auto-reconnect if enabled
                    if (config.isAutoReconnectEnabled() && plugin.isEnabled()) {
                        scheduleReconnect();
                    }
                }
                
                @Override
                public void onError(Exception ex) {
                    logger.log(Level.SEVERE, "WebSocket error", ex);
                    connected.set(false);
                    connecting.set(false);
                }
            };
            
            wsClient.connect();
            
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Failed to connect", e);
            connected.set(false);
            connecting.set(false);
        }
    }
    
    /**
     * Send handshake message (U-WBP v2)
     */
    private void sendHandshake() {
        try {
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
            data.addProperty("serverId", config.getServerId());
            
            JsonObject serverInfo = new JsonObject();
            serverInfo.addProperty("name", plugin.getServer().getName());
            serverInfo.addProperty("version", plugin.getServer().getVersion());
            serverInfo.addProperty("coreType", "Java");
            serverInfo.addProperty("coreName", "Folia");
            data.add("serverInfo", serverInfo);
            
            handshake.add("data", data);
            
            sendMessage(handshake.toString());
            logger.info("Handshake sent to management server");
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send handshake", e);
        }
    }
    
    /**
     * Handle incoming message
     */
    private void handleMessage(String message) {
        try {
            JsonObject json = gson.fromJson(message, JsonObject.class);
            String type = json.get("type").getAsString();
            String op = json.has("op") ? json.get("op").getAsString() : "";
            
            logger.fine("Handling message: type=" + type + ", op=" + op);
            
            // Handle different message types
            switch (type) {
                case "request":
                    handleRequest(json);
                    break;
                case "system":
                    handleSystemMessage(json);
                    break;
                default:
                    logger.fine("Unhandled message type: " + type);
            }
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to handle message", e);
        }
    }
    
    /**
     * Handle request message
     */
    private void handleRequest(JsonObject request) {
        String op = request.get("op").getAsString();
        String requestId = request.has("id") ? request.get("id").getAsString() : generateId();
        
        logger.info("Received request: " + op);
        
        switch (op) {
            case "event.subscribe":
                handleEventSubscribe(request, requestId);
                break;
            case "event.unsubscribe":
                handleEventUnsubscribe(request, requestId);
                break;
            case "command.execute":
                // Delegate to command handler if needed
                logger.info("Command execution requested");
                break;
            default:
                logger.warning("Unknown operation: " + op);
                sendErrorResponse(requestId, op, "Unknown operation: " + op);
                break;
        }
    }
    
    /**
     * Handle event subscribe request
     */
    private void handleEventSubscribe(JsonObject request, String requestId) {
        try {
            JsonObject data = request.has("data") ? request.getAsJsonObject("data") : new JsonObject();
            String serverId = data.has("serverId") ? data.get("serverId").getAsString() : null;
            List<String> eventTypes = new ArrayList<>();
            
            if (data.has("eventTypes")) {
                JsonArray types = data.getAsJsonArray("eventTypes");
                for (int i = 0; i < types.size(); i++) {
                    eventTypes.add(types.get(i).getAsString());
                }
            }
            
            // Parse filters
            Map<String, Object> filters = new HashMap<>();
            if (data.has("filters")) {
                JsonObject filtersObj = data.getAsJsonObject("filters");
                for (String key : filtersObj.keySet()) {
                    filters.put(key, filtersObj.get(key).getAsString());
                }
            }
            
            // Create subscription
            String subscriptionId = generateSubscriptionId();
            EventSubscription subscription = new EventSubscription(
                subscriptionId,
                eventTypes,
                filters,
                System.currentTimeMillis()
            );
            
            // Add to subscription manager
            plugin.getSubscriptionManager().addSubscription(subscriptionId, subscription);
            
            // Send success response
            JsonObject response = new JsonObject();
            response.addProperty("type", "response");
            response.addProperty("id", requestId);
            response.addProperty("op", "event.subscribe");
            response.addProperty("timestamp", System.currentTimeMillis());
            response.addProperty("version", "2.0");
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("subscriptionId", subscriptionId);
            if (serverId != null) {
                responseData.addProperty("serverId", serverId);
            }
            responseData.add("eventTypes", gson.toJsonTree(eventTypes));
            responseData.addProperty("message", "Successfully subscribed to events");
            response.add("data", responseData);
            
            sendMessage(response.toString());
            logger.info("Event subscription created: " + subscriptionId + " for events: " + eventTypes);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to handle event subscription", e);
            sendErrorResponse(requestId, "event.subscribe", e.getMessage());
        }
    }
    
    /**
     * Handle event unsubscribe request
     */
    private void handleEventUnsubscribe(JsonObject request, String requestId) {
        try {
            JsonObject data = request.has("data") ? request.getAsJsonObject("data") : new JsonObject();
            String subscriptionId = data.get("subscriptionId").getAsString();
            
            // Remove subscription
            plugin.getSubscriptionManager().removeSubscription(subscriptionId);
            
            // Send success response
            JsonObject response = new JsonObject();
            response.addProperty("type", "response");
            response.addProperty("id", requestId);
            response.addProperty("op", "event.unsubscribe");
            response.addProperty("timestamp", System.currentTimeMillis());
            response.addProperty("version", "2.0");
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("subscriptionId", subscriptionId);
            responseData.addProperty("message", "Successfully unsubscribed from events");
            response.add("data", responseData);
            
            sendMessage(response.toString());
            logger.info("Event subscription removed: " + subscriptionId);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to handle event unsubscription", e);
            sendErrorResponse(requestId, "event.unsubscribe", e.getMessage());
        }
    }
    
    /**
     * Send error response
     */
    private void sendErrorResponse(String requestId, String op, String errorMessage) {
        try {
            JsonObject response = new JsonObject();
            response.addProperty("type", "response");
            response.addProperty("id", requestId);
            response.addProperty("op", op);
            response.addProperty("timestamp", System.currentTimeMillis());
            response.addProperty("version", "2.0");
            
            JsonObject data = new JsonObject();
            data.addProperty("success", false);
            data.addProperty("error", errorMessage);
            response.add("data", data);
            
            sendMessage(response.toString());
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send error response", e);
        }
    }
    
    /**
     * Handle system message
     */
    private void handleSystemMessage(JsonObject message) {
        String op = message.has("systemOp") ? message.get("systemOp").getAsString() : "";
        logger.info("Received system message: " + op);
        
        if ("ping".equals(op)) {
            sendPong();
        }
    }
    
    /**
     * Send pong response
     */
    private void sendPong() {
        JsonObject pong = new JsonObject();
        pong.addProperty("type", "system");
        pong.addProperty("id", generateId());
        pong.addProperty("op", "pong");
        pong.addProperty("timestamp", System.currentTimeMillis());
        pong.addProperty("version", "2.0");
        pong.addProperty("systemOp", "pong");
        
        sendMessage(pong.toString());
    }
    
    /**
     * Schedule reconnection
     */
    private void scheduleReconnect() {
        int interval = config.getReconnectInterval();
        logger.info("Scheduling reconnection in " + interval + " seconds");
        
        plugin.getServer().getAsyncScheduler().runDelayed(
            plugin,
            (task) -> {
                if (!connected.get() && plugin.isEnabled()) {
                    logger.info("Attempting to reconnect...");
                    connect();
                }
            },
            interval,
            java.util.concurrent.TimeUnit.SECONDS
        );
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
            JsonObject disconnect = new JsonObject();
            disconnect.addProperty("type", "system");
            disconnect.addProperty("id", generateId());
            disconnect.addProperty("op", "disconnect");
            disconnect.addProperty("timestamp", System.currentTimeMillis());
            disconnect.addProperty("version", "2.0");
            disconnect.addProperty("systemOp", "disconnect");
            
            JsonObject data = new JsonObject();
            data.addProperty("reason", "Plugin disabled");
            disconnect.add("data", data);
            
            sendMessage(disconnect.toString());
            
            // Close WebSocket connection
            if (wsClient != null && wsClient.isOpen()) {
                wsClient.close();
            }
            
            connected.set(false);
            logger.info("Disconnected from management server");
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error during disconnect", e);
        }
    }
    
    /**
     * Check if connected
     */
    public boolean isConnected() {
        return connected.get() && wsClient != null && wsClient.isOpen();
    }
    
    /**
     * Send message to management server
     */
    public void sendMessage(String message) {
        if (!connected.get() || wsClient == null || !wsClient.isOpen()) {
            logger.warning("Cannot send message: not connected");
            return;
        }
        
        try {
            wsClient.send(message);
            logger.fine("Sent message: " + message);
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send message", e);
        }
    }
    
    /**
     * Send event message (U-WBP v2)
     */
    public void sendEvent(String eventOp, JsonObject eventData) {
        if (!isConnected()) {
            logger.warning("Cannot send event: not connected");
            return;
        }
        
        try {
            JsonObject event = new JsonObject();
            event.addProperty("type", "event");
            event.addProperty("id", generateId());
            event.addProperty("op", eventOp);
            event.addProperty("timestamp", java.time.Instant.now().toString());  // ISO 8601
            event.addProperty("version", "2.0.0");
            event.addProperty("serverId", config.getServerId());
            event.add("data", eventData);
            
            sendMessage(event.toString());
            logger.fine("Sent event: " + eventOp);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send event", e);
        }
    }
    
    /**
     * Generate unique message ID
     */
    private String generateId() {
        return "msg_" + System.currentTimeMillis() + "_" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }
    
    /**
     * Generate unique subscription ID
     */
    private String generateSubscriptionId() {
        return "sub_" + System.currentTimeMillis() + "_" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }
}
