package com.mochilink.connector.protocol;

import com.mochilink.connector.MochiLinkPlugin;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.time.Instant;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Implementation of the Unified WebSocket Bridge Protocol v2 (U-WBP v2)
 * 
 * Handles message serialization, deserialization, and protocol-specific
 * message formatting for communication with the Mochi-Link management server.
 */
public class UWBPv2Protocol {
    
    private final MochiLinkPlugin plugin;
    private final Logger logger;
    private final Gson gson;
    
    // Protocol constants
    public static final String PROTOCOL_VERSION = "2.0";
    public static final String MESSAGE_TYPE_AUTH = "auth";
    public static final String MESSAGE_TYPE_HEARTBEAT = "heartbeat";
    public static final String MESSAGE_TYPE_EVENT = "event";
    public static final String MESSAGE_TYPE_REQUEST = "request";  // U-WBP v2 standard
    public static final String MESSAGE_TYPE_COMMAND = "command";  // Legacy support
    public static final String MESSAGE_TYPE_RESPONSE = "response";
    public static final String MESSAGE_TYPE_STATUS = "status";
    
    public UWBPv2Protocol(MochiLinkPlugin plugin) {
        this.plugin = plugin;
        this.logger = plugin.getLogger();
        this.gson = new Gson();
    }
    
    /**
     * Create authentication message
     */
    public String createAuthenticationMessage(String token, String serverId) {
        JsonObject message = new JsonObject();
        message.addProperty("type", MESSAGE_TYPE_AUTH);
        message.addProperty("version", PROTOCOL_VERSION);
        message.addProperty("timestamp", System.currentTimeMillis());
        
        JsonObject data = new JsonObject();
        data.addProperty("token", token);
        data.addProperty("server_id", serverId);
        data.addProperty("server_type", "minecraft_java");
        data.addProperty("plugin_version", plugin.getDescription().getVersion());
        data.addProperty("minecraft_version", Bukkit.getVersion());
        data.addProperty("online_players", Bukkit.getOnlinePlayers().size());
        data.addProperty("max_players", Bukkit.getMaxPlayers());
        
        message.add("data", data);
        
        return gson.toJson(message);
    }
    
    /**
     * Create heartbeat message
     */
    public String createHeartbeatMessage() {
        JsonObject message = new JsonObject();
        message.addProperty("type", MESSAGE_TYPE_HEARTBEAT);
        message.addProperty("version", PROTOCOL_VERSION);
        message.addProperty("timestamp", System.currentTimeMillis());
        
        JsonObject data = new JsonObject();
        data.addProperty("online_players", Bukkit.getOnlinePlayers().size());
        data.addProperty("tps", getTPS());
        data.addProperty("memory_used", getUsedMemory());
        data.addProperty("memory_max", getMaxMemory());
        
        message.add("data", data);
        
        return gson.toJson(message);
    }
    
    /**
     * Create player event message (U-WBP v2 compliant)
     */
    public String createPlayerEventMessage(String eventType, Player player, Map<String, Object> eventData) {
        JsonObject message = new JsonObject();
        message.addProperty("type", MESSAGE_TYPE_EVENT);
        message.addProperty("id", generateId());
        message.addProperty("op", eventType);
        message.addProperty("timestamp", Instant.now().toString());  // ISO 8601 format
        message.addProperty("version", "2.0.0");
        message.addProperty("serverId", plugin.getPluginConfig().getServerId());
        
        JsonObject data = new JsonObject();
        
        // Player information
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        
        // Location information
        JsonObject location = new JsonObject();
        location.addProperty("world", player.getWorld().getName());
        location.addProperty("x", player.getLocation().getX());
        location.addProperty("y", player.getLocation().getY());
        location.addProperty("z", player.getLocation().getZ());
        playerInfo.add("location", location);
        
        data.add("player", playerInfo);
        
        // Additional event data (merge into data, not nested)
        if (eventData != null && !eventData.isEmpty()) {
            for (Map.Entry<String, Object> entry : eventData.entrySet()) {
                data.add(entry.getKey(), gson.toJsonTree(entry.getValue()));
            }
        }
        
        message.add("data", data);
        
        return gson.toJson(message);
    }
    
    /**
     * Create server event message (U-WBP v2 compliant)
     */
    public String createServerEventMessage(String eventType, Map<String, Object> eventData) {
        JsonObject message = new JsonObject();
        message.addProperty("type", MESSAGE_TYPE_EVENT);
        message.addProperty("id", generateId());
        message.addProperty("op", eventType);
        message.addProperty("timestamp", Instant.now().toString());  // ISO 8601 format
        message.addProperty("version", "2.0.0");
        message.addProperty("serverId", plugin.getPluginConfig().getServerId());
        
        JsonObject data = new JsonObject();
        
        // Server information
        JsonObject serverInfo = new JsonObject();
        serverInfo.addProperty("online_players", Bukkit.getOnlinePlayers().size());
        serverInfo.addProperty("max_players", Bukkit.getMaxPlayers());
        serverInfo.addProperty("tps", getTPS());
        serverInfo.addProperty("memory_used", getUsedMemory());
        serverInfo.addProperty("memory_max", getMaxMemory());
        serverInfo.addProperty("version", Bukkit.getVersion());
        
        data.add("server", serverInfo);
        
        // Additional event data (merge into data, not nested)
        if (eventData != null && !eventData.isEmpty()) {
            for (Map.Entry<String, Object> entry : eventData.entrySet()) {
                data.add(entry.getKey(), gson.toJsonTree(entry.getValue()));
            }
        }
        
        message.add("data", data);
        
        return gson.toJson(message);
    }
    
    /**
     * Create command response message (U-WBP v2 compliant)
     */
    public String createCommandResponseMessage(String requestId, boolean success, String output, String error) {
        JsonObject message = new JsonObject();
        message.addProperty("type", MESSAGE_TYPE_RESPONSE);
        message.addProperty("id", requestId);  // Top-level id field per U-WBP v2
        message.addProperty("version", PROTOCOL_VERSION);
        message.addProperty("timestamp", System.currentTimeMillis());
        
        JsonObject data = new JsonObject();
        data.addProperty("success", success);
        data.addProperty("output", output != null ? output : "");
        data.addProperty("error", error != null ? error : "");
        data.addProperty("execution_time", System.currentTimeMillis());
        
        // Backward compatibility: also include command_id in data
        if (requestId != null) {
            data.addProperty("command_id", requestId);
        }
        
        message.add("data", data);
        
        return gson.toJson(message);
    }
    
    /**
     * Create generic response message (U-WBP v2 compliant)
     */
    public String createResponseMessage(String requestId, String op, String dataJson) {
        JsonObject message = new JsonObject();
        message.addProperty("type", MESSAGE_TYPE_RESPONSE);
        message.addProperty("id", requestId);
        message.addProperty("op", op);
        message.addProperty("version", PROTOCOL_VERSION);
        message.addProperty("timestamp", System.currentTimeMillis());
        
        // Parse data JSON string to JsonObject
        try {
            JsonObject data = JsonParser.parseString(dataJson).getAsJsonObject();
            message.add("data", data);
        } catch (Exception e) {
            // If parsing fails, create a simple data object
            JsonObject data = new JsonObject();
            data.addProperty("message", dataJson);
            message.add("data", data);
        }
        
        return gson.toJson(message);
    }
    
    /**
     * Create status message
     */
    public String createStatusMessage(String status, String message) {
        JsonObject messageObj = new JsonObject();
        messageObj.addProperty("type", MESSAGE_TYPE_STATUS);
        messageObj.addProperty("version", PROTOCOL_VERSION);
        messageObj.addProperty("timestamp", System.currentTimeMillis());
        
        JsonObject data = new JsonObject();
        data.addProperty("status", status);
        data.addProperty("message", message);
        data.addProperty("server_id", plugin.getPluginConfig().getServerId());
        
        messageObj.add("data", data);
        
        return gson.toJson(messageObj);
    }
    
    /**
     * Parse incoming message
     */
    public ProtocolMessage parseMessage(String messageJson) {
        try {
            JsonObject json = JsonParser.parseString(messageJson).getAsJsonObject();
            
            String type = json.get("type").getAsString();
            String id = json.has("id") ? json.get("id").getAsString() : null;
            String op = json.has("op") ? json.get("op").getAsString() : null;
            String version = json.has("version") ? json.get("version").getAsString() : "1.0";
            long timestamp = json.has("timestamp") ? json.get("timestamp").getAsLong() : System.currentTimeMillis();
            JsonObject data = json.has("data") ? json.getAsJsonObject("data") : new JsonObject();
            
            return new ProtocolMessage(type, id, op, version, timestamp, data);
            
        } catch (Exception e) {
            logger.warning("Failed to parse protocol message: " + e.getMessage());
            return null;
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
     * Get server TPS (approximation)
     */
    private double getTPS() {
        try {
            // Use reflection to get TPS from server
            Object server = Bukkit.getServer();
            Object minecraftServer = server.getClass().getMethod("getServer").invoke(server);
            double[] tps = (double[]) minecraftServer.getClass().getField("recentTps").get(minecraftServer);
            return Math.min(20.0, tps[0]);
        } catch (Exception e) {
            // Fallback to 20.0 if reflection fails
            return 20.0;
        }
    }
    
    /**
     * Get used memory in MB
     */
    private long getUsedMemory() {
        Runtime runtime = Runtime.getRuntime();
        return (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
    }
    
    /**
     * Get max memory in MB
     */
    private long getMaxMemory() {
        return Runtime.getRuntime().maxMemory() / 1024 / 1024;
    }
    
    /**
     * Protocol message data class
     */
    public static class ProtocolMessage {
        private final String type;
        private final String id;
        private final String op;
        private final String version;
        private final long timestamp;
        private final JsonObject data;
        
        public ProtocolMessage(String type, String id, String op, String version, long timestamp, JsonObject data) {
            this.type = type;
            this.id = id;
            this.op = op;
            this.version = version;
            this.timestamp = timestamp;
            this.data = data;
        }
        
        public String getType() { return type; }
        public String getId() { return id; }
        public String getOp() { return op; }
        public String getVersion() { return version; }
        public long getTimestamp() { return timestamp; }
        public JsonObject getData() { return data; }
        
        public boolean isType(String messageType) {
            return messageType.equals(type);
        }
        
        public String getDataString(String key) {
            return data.has(key) ? data.get(key).getAsString() : null;
        }
        
        public int getDataInt(String key, int defaultValue) {
            return data.has(key) ? data.get(key).getAsInt() : defaultValue;
        }
        
        public boolean getDataBoolean(String key, boolean defaultValue) {
            return data.has(key) ? data.get(key).getAsBoolean() : defaultValue;
        }
    }
}
