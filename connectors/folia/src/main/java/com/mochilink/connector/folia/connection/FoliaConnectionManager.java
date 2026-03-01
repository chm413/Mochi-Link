package com.mochilink.connector.folia.connection;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.config.FoliaPluginConfig;
import com.mochilink.connector.folia.subscription.EventSubscription;
import com.mochilink.connector.common.ReconnectionManager;

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
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Manages WebSocket connection to Mochi-Link management server for Folia
 * Handles connection lifecycle, message routing, and event subscription with exponential backoff reconnection
 */
public class FoliaConnectionManager {
    
    private final MochiLinkFoliaPlugin plugin;
    private final FoliaPluginConfig config;
    private final Logger logger;
    private final Gson gson;
    
    private WebSocketClient wsClient;
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    
    // 重连管理器
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final ReconnectionManager reconnectionManager;
    
    public FoliaConnectionManager(MochiLinkFoliaPlugin plugin, FoliaPluginConfig config) {
        this.plugin = plugin;
        this.config = config;
        this.logger = plugin.getLogger();
        this.gson = new Gson();
        
        // 初始化重连管理器
        ReconnectionManager.ReconnectionConfig reconnectConfig = 
            ReconnectionManager.ReconnectionConfig.defaults();
        
        this.reconnectionManager = new ReconnectionManager(
            logger,
            scheduler,
            reconnectConfig,
            new ReconnectionManager.ReconnectionCallback() {
                @Override
                public boolean attemptReconnect() {
                    connect();
                    return connected.get();
                }
                
                @Override
                public void onReconnecting(int attempts, long nextInterval) {
                    logger.info(String.format("第 %d 次重连，%dms 后执行", attempts, nextInterval));
                }
                
                @Override
                public void onMaxAttemptsReached(int totalAttempts) {
                    logger.warning(String.format("达到最大重连次数，总尝试: %d", totalAttempts));
                }
                
                @Override
                public void onReconnectionDisabled(int totalAttempts) {
                    logger.warning(String.format("重连已禁用，总尝试: %d", totalAttempts));
                }
                
                @Override
                public void onReconnectionEnabled() {
                    logger.info("重连已重新启用");
                }
            }
        );
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
                    
                    // 重置重连状态
                    reconnectionManager.reset();
                    
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
                    
                    // 使用重连管理器进行自动重连
                    if (config.isAutoReconnectEnabled() && plugin.isEnabled()) {
                        reconnectionManager.scheduleReconnect();
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
            
            // 连接失败时触发重连
            if (config.isAutoReconnectEnabled() && plugin.isEnabled()) {
                reconnectionManager.scheduleReconnect();
            }
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
        JsonObject data = request.has("data") ? request.getAsJsonObject("data") : new JsonObject();
        
        logger.info("Received request: " + op);
        
        // Get message handler
        com.mochilink.connector.folia.protocol.FoliaMessageHandler messageHandler = 
            plugin.getMessageHandler();
        
        if (messageHandler == null) {
            logger.warning("Message handler not initialized");
            sendErrorResponse(requestId, op, "Message handler not available");
            return;
        }
        
        JsonObject response = null;
        
        switch (op) {
            case "player.list":
                response = messageHandler.handlePlayerList(requestId);
                break;
            case "player.info":
                String playerId = data.has("playerId") ? data.get("playerId").getAsString() : null;
                response = messageHandler.handlePlayerInfo(requestId, playerId);
                break;
            case "player.kick":
                String kickPlayerId = data.has("playerId") ? data.get("playerId").getAsString() : null;
                String kickReason = data.has("reason") ? data.get("reason").getAsString() : null;
                response = messageHandler.handlePlayerKick(requestId, kickPlayerId, kickReason);
                break;
            case "player.message":
                String msgPlayerId = data.has("playerId") ? data.get("playerId").getAsString() : null;
                String message = data.has("message") ? data.get("message").getAsString() : null;
                response = messageHandler.handlePlayerMessage(requestId, msgPlayerId, message);
                break;
            case "whitelist.list":
                response = messageHandler.handleWhitelistList(requestId);
                break;
            case "whitelist.add":
                String addPlayerName = data.has("playerName") ? data.get("playerName").getAsString() : null;
                String addPlayerId = data.has("playerId") ? data.get("playerId").getAsString() : null;
                response = messageHandler.handleWhitelistAdd(requestId, addPlayerName, addPlayerId);
                break;
            case "whitelist.remove":
                String removePlayerName = data.has("playerName") ? data.get("playerName").getAsString() : null;
                String removePlayerId = data.has("playerId") ? data.get("playerId").getAsString() : null;
                response = messageHandler.handleWhitelistRemove(requestId, removePlayerName, removePlayerId);
                break;
            case "command.execute":
                String command = data.has("command") ? data.get("command").getAsString() : null;
                response = messageHandler.handleCommandExecute(requestId, command);
                break;
            case "server.info":
                response = messageHandler.handleServerInfo(requestId);
                break;
            case "server.status":
                response = messageHandler.handleServerStatus(requestId);
                break;
            case "server.restart":
                int restartDelay = data.has("delay") ? data.get("delay").getAsInt() : 10;
                response = messageHandler.handleServerRestart(requestId, restartDelay);
                break;
            case "server.stop":
                int stopDelay = data.has("delay") ? data.get("delay").getAsInt() : 10;
                response = messageHandler.handleServerStop(requestId, stopDelay);
                break;
            case "event.subscribe":
                handleEventSubscribe(request, requestId);
                return; // Event subscribe handles its own response
            case "event.unsubscribe":
                handleEventUnsubscribe(request, requestId);
                return; // Event unsubscribe handles its own response
            default:
                logger.warning("Unknown operation: " + op);
                sendErrorResponse(requestId, op, "Unknown operation: " + op);
                return;
        }
        
        // Send response if available
        if (response != null) {
            sendMessage(response.toString());
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
     * Disconnect from management server
     */
    public void disconnect() {
        if (!connected.get()) {
            return;
        }
        
        try {
            // 取消重连
            reconnectionManager.cancel();
            
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
            
            // 关闭调度器
            scheduler.shutdown();
            
            connected.set(false);
            logger.info("Disconnected from management server");
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error during disconnect", e);
        }
    }
    
    /**
     * 获取重连状态
     */
    public ReconnectionManager.ReconnectionStatus getReconnectionStatus() {
        return reconnectionManager.getStatus();
    }
    
    /**
     * 启用重连
     */
    public void enableReconnection() {
        reconnectionManager.enable();
    }
    
    /**
     * 禁用重连
     */
    public void disableReconnection() {
        reconnectionManager.disable();
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
