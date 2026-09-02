package com.mochilink.connector.protocol;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mochilink.connector.MochiLinkPlugin;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Map;
import java.util.logging.Logger;

/**
 * U-WBP v2 message codec used by the Java connector.
 *
 * New messages use the canonical envelope documented by the Koishi plugin:
 * every message has its own id, numeric epoch-millisecond timestamp and
 * version 2.0. Responses carry a separate top-level requestId. Legacy type
 * names and ISO timestamps remain readable so older servers can be upgraded
 * without a flag day.
 */
public class UWBPv2Protocol {

    private final MochiLinkPlugin plugin;
    private final Logger logger;
    private final Gson gson;

    public static final String PROTOCOL_VERSION = "2.0";
    public static final String MESSAGE_TYPE_AUTH = "auth";            // legacy input
    public static final String MESSAGE_TYPE_HEARTBEAT = "heartbeat";  // legacy input
    public static final String MESSAGE_TYPE_EVENT = "event";
    public static final String MESSAGE_TYPE_REQUEST = "request";
    public static final String MESSAGE_TYPE_COMMAND = "command";      // legacy input
    public static final String MESSAGE_TYPE_RESPONSE = "response";
    public static final String MESSAGE_TYPE_STATUS = "status";        // legacy input
    public static final String MESSAGE_TYPE_SYSTEM = "system";

    private static final String[] DECLARED_CAPABILITIES = new String[] {
        "player_management", "command_execution", "performance_monitoring",
        "event_streaming", "whitelist_management", "server_control"
    };

    public UWBPv2Protocol(MochiLinkPlugin plugin) {
        this.plugin = plugin;
        this.logger = plugin.getLogger();
        this.gson = new Gson();
    }

    /** Build a canonical token-auth handshake for challenge/manual clients. */
    public String createAuthenticationMessage(String token, String serverId) {
        JsonObject data = createAuthenticationData(token, serverId, "token");
        return createSystemMessage("handshake", data, serverId);
    }

    /** Build the HMAC challenge response used when no token was sent in the upgrade request. */
    public String createChallengeAuthenticationMessage(String token, String serverId,
                                                       String challenge, long challengeTimestamp,
                                                       String requestId) {
        JsonObject data = createAuthenticationData(token, serverId, "challenge");
        data.addProperty("challenge", challenge);
        data.addProperty("challengeTimestamp", challengeTimestamp);
        data.addProperty("challengeResponse", hmacSha256(
            token, challenge + ":" + token + ":" + challengeTimestamp));
        return createSystemMessage("handshake", data, serverId, requestId);
    }

    private JsonObject createAuthenticationData(String token, String serverId, String method) {
        JsonObject data = new JsonObject();
        data.addProperty("serverId", serverId);
        data.addProperty("serverName", serverId);
        data.addProperty("serverType", "Java");
        data.addProperty("protocolVersion", PROTOCOL_VERSION);
        data.add("capabilities", gson.toJsonTree(DECLARED_CAPABILITIES));

        JsonObject authentication = new JsonObject();
        authentication.addProperty("token", token);
        authentication.addProperty("method", method);
        data.add("authentication", authentication);

        JsonObject serverInfo = new JsonObject();
        serverInfo.addProperty("name", serverId);
        serverInfo.addProperty("version", getBukkitVersion());
        serverInfo.addProperty("coreType", "Java");
        serverInfo.addProperty("coreName", "Bukkit");
        data.add("serverInfo", serverInfo);

        return data;
    }

    public String[] getDeclaredCapabilities() {
        return DECLARED_CAPABILITIES.clone();
    }

    /** Build the canonical application heartbeat (system.ping). */
    public String createHeartbeatMessage() {
        JsonObject data = new JsonObject();
        String serverId = plugin.getPluginConfig().getServerId();
        data.addProperty("serverId", serverId);
        data.addProperty("onlinePlayers", Bukkit.getOnlinePlayers().size());
        data.addProperty("tps", getTPS());
        data.addProperty("memoryUsed", getUsedMemory());
        data.addProperty("memoryMax", getMaxMemory());
        return createSystemMessage("ping", data, serverId);
    }

    /** Create a canonical event message. */
    public String createPlayerEventMessage(String eventType, Player player, Map<String, Object> eventData) {
        JsonObject data = new JsonObject();
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        playerInfo.addProperty("world", player.getWorld().getName());

        JsonObject location = new JsonObject();
        location.addProperty("x", player.getLocation().getX());
        location.addProperty("y", player.getLocation().getY());
        location.addProperty("z", player.getLocation().getZ());
        location.addProperty("yaw", player.getLocation().getYaw());
        location.addProperty("pitch", player.getLocation().getPitch());
        // The unified Player contract calls this field `position`.
        playerInfo.add("position", location);
        playerInfo.addProperty("ping", getPlayerPing(player));
        playerInfo.addProperty("isOp", player.isOp());
        playerInfo.add("permissions", gson.toJsonTree(player.getEffectivePermissions().stream()
            .map(permission -> permission.getPermission())
            .toArray(String[]::new)));
        playerInfo.addProperty("edition", "Java");
        data.add("player", playerInfo);
        merge(data, eventData);
        String normalizedType = normalizeEventType(eventType);
        if (!normalizedType.equals(eventType)) {
            data.addProperty("sourceEvent", eventType);
        }
        return createEnvelope(MESSAGE_TYPE_EVENT, normalizedType, data,
            plugin.getPluginConfig().getServerId());
    }

    /** Create a canonical server event message. */
    public String createServerEventMessage(String eventType, Map<String, Object> eventData) {
        JsonObject data = new JsonObject();
        JsonObject serverInfo = new JsonObject();
        serverInfo.addProperty("onlinePlayers", Bukkit.getOnlinePlayers().size());
        serverInfo.addProperty("maxPlayers", Bukkit.getMaxPlayers());
        serverInfo.addProperty("tps", getTPS());
        serverInfo.addProperty("memoryUsed", getUsedMemory());
        serverInfo.addProperty("memoryMax", getMaxMemory());
        serverInfo.addProperty("version", Bukkit.getVersion());
        data.add("server", serverInfo);
        merge(data, eventData);
        String normalizedType = normalizeEventType(eventType);
        if (!normalizedType.equals(eventType)) {
            data.addProperty("sourceEvent", eventType);
        }
        return createEnvelope(MESSAGE_TYPE_EVENT, normalizedType, data,
            plugin.getPluginConfig().getServerId());
    }

    private String normalizeEventType(String eventType) {
        if (eventType == null) return "server.logLine";
        switch (eventType) {
            case "player.join":
            case "player.leave":
            case "player.chat":
            case "player.death":
            case "player.advancement":
            case "player.move":
            case "server.status":
            case "server.logLine":
            case "server.metrics":
            case "alert.tpsLow":
            case "alert.memoryHigh":
            case "alert.playerFlood":
            case "alert.diskSpace":
            case "alert.connectionLost":
                return eventType;
            case "player.kick":
            case "player.quit":
                return "player.leave";
            case "server.load":
            case "server.ready":
            case "server.start":
            case "server.stop":
                return "server.status";
            case "performance.update":
                return "server.metrics";
            default:
                return "server.logLine";
        }
    }

    /**
     * Create a command response. The old overload reports an unknown elapsed
     * time as zero; callers that execute asynchronously should use the
     * elapsed-time overload.
     */
    public String createCommandResponseMessage(String requestId, boolean success,
                                               String output, String error) {
        return createCommandResponseMessage(requestId, success, output, error, 0L);
    }

    public String createCommandResponseMessage(String requestId, boolean success,
                                               String output, String error,
                                               long executionTime) {
        JsonObject data = new JsonObject();
        data.addProperty("output", output != null ? output : "");
        data.addProperty("executionTime", Math.max(0L, executionTime));
        // Keep the old spelling inside data for clients that still read it.
        data.addProperty("execution_time", Math.max(0L, executionTime));
        if (requestId != null) {
            data.addProperty("commandId", requestId);
            data.addProperty("command_id", requestId);
        }
        return createResponseEnvelope(requestId, "command.execute", data, success, error,
            plugin.getPluginConfig().getServerId());
    }

    /** Create a response from a JSON object, with a fresh response id. */
    public String createResponseMessage(String requestId, String op, String dataJson) {
        JsonObject data;
        try {
            JsonElement parsed = JsonParser.parseString(dataJson == null ? "{}" : dataJson);
            data = parsed.isJsonObject() ? parsed.getAsJsonObject() : new JsonObject();
        } catch (Exception e) {
            data = new JsonObject();
            data.addProperty("message", dataJson == null ? "" : dataJson);
        }
        boolean success = !data.has("success") || data.get("success").getAsBoolean();
        String error = data.has("error") && !data.get("error").isJsonNull()
            ? data.get("error").getAsString() : null;
        data.remove("success");
        data.remove("error");
        return createResponseEnvelope(requestId, op, data, success, error,
            plugin.getPluginConfig().getServerId());
    }

    /** Create a response with structured data. */
    public String createResponseMessage(String requestId, String op, JsonObject data,
                                        boolean success, String error) {
        JsonObject payload = data == null ? new JsonObject() : data.deepCopy();
        return createResponseEnvelope(requestId, op, payload, success, error,
            plugin.getPluginConfig().getServerId());
    }

    /** Legacy status helper now emits a canonical system message. */
    public String createStatusMessage(String status, String message) {
        JsonObject data = new JsonObject();
        data.addProperty("status", status);
        data.addProperty("message", message == null ? "" : message);
        return createSystemMessage("pong".equalsIgnoreCase(status) ? "pong" : "status",
            data, plugin.getPluginConfig().getServerId());
    }

    /** Build a system message with both op and systemOp for compatibility. */
    public String createSystemMessage(String systemOp, JsonObject data, String serverId) {
        return createEnvelope(MESSAGE_TYPE_SYSTEM, systemOp, data, serverId, systemOp);
    }

    /** Build a correlated system response such as pong or challenge handshake. */
    public String createSystemMessage(String systemOp, JsonObject data, String serverId,
                                      String requestId) {
        return createEnvelope(MESSAGE_TYPE_SYSTEM, systemOp, data, serverId, systemOp, requestId);
    }

    /** Parse canonical messages and tolerate legacy ISO timestamps. */
    public ProtocolMessage parseMessage(String messageJson) {
        try {
            JsonObject json = JsonParser.parseString(messageJson).getAsJsonObject();
            String type = requiredString(json, "type");
            String id = json.has("id") && !json.get("id").isJsonNull()
                ? json.get("id").getAsString() : null;
            String op = json.has("op") && !json.get("op").isJsonNull()
                ? json.get("op").getAsString() : null;
            String version = json.has("version") ? json.get("version").getAsString() : "1.0";
            long timestamp = parseTimestamp(json.get("timestamp"));
            JsonObject data = json.has("data") && json.get("data").isJsonObject()
                ? json.getAsJsonObject("data") : new JsonObject();
            String requestId = json.has("requestId") && !json.get("requestId").isJsonNull()
                ? json.get("requestId").getAsString() : null;
            Boolean success = json.has("success") && !json.get("success").isJsonNull()
                ? json.get("success").getAsBoolean() : null;
            String error = json.has("error") && !json.get("error").isJsonNull()
                ? json.get("error").getAsString() : null;
            String systemOp = json.has("systemOp") && !json.get("systemOp").isJsonNull()
                ? json.get("systemOp").getAsString() : null;
            return new ProtocolMessage(type, id, op, version, timestamp, data,
                requestId, success, error, systemOp);
        } catch (Exception e) {
            logger.warning("Failed to parse protocol message: " + e.getMessage());
            return null;
        }
    }

    private String createResponseEnvelope(String requestId, String op, JsonObject data,
                                          boolean success, String error, String serverId) {
        JsonObject message = new JsonObject();
        message.addProperty("type", MESSAGE_TYPE_RESPONSE);
        message.addProperty("id", generateId());
        if (requestId != null) message.addProperty("requestId", requestId);
        message.addProperty("op", op == null ? "response" : op);
        message.addProperty("success", success);
        if (error != null && !error.isEmpty()) message.addProperty("error", error);
        message.add("data", data == null ? new JsonObject() : data);
        addCommonFields(message, serverId);
        return gson.toJson(message);
    }

    private String createEnvelope(String type, String op, JsonObject data, String serverId) {
        return createEnvelope(type, op, data, serverId, null);
    }

    private String createEnvelope(String type, String op, JsonObject data, String serverId,
                                  String systemOp) {
        return createEnvelope(type, op, data, serverId, systemOp, null);
    }

    private String createEnvelope(String type, String op, JsonObject data, String serverId,
                                  String systemOp, String requestId) {
        JsonObject message = new JsonObject();
        message.addProperty("type", type);
        message.addProperty("id", generateId());
        message.addProperty("op", op == null ? type : op);
        if (systemOp != null) message.addProperty("systemOp", systemOp);
        if (requestId != null) message.addProperty("requestId", requestId);
        if (MESSAGE_TYPE_EVENT.equals(type)) {
            message.addProperty("eventType", op == null ? type : op);
        }
        message.add("data", data == null ? new JsonObject() : data);
        addCommonFields(message, serverId);
        return gson.toJson(message);
    }

    private void addCommonFields(JsonObject message, String serverId) {
        message.addProperty("timestamp", System.currentTimeMillis());
        message.addProperty("version", PROTOCOL_VERSION);
        if (serverId != null) message.addProperty("serverId", serverId);
    }

    private void merge(JsonObject target, Map<String, Object> values) {
        if (values == null) return;
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            target.add(entry.getKey(), gson.toJsonTree(entry.getValue()));
        }
    }

    private String requiredString(JsonObject object, String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            throw new IllegalArgumentException("Missing " + key);
        }
        return object.get(key).getAsString();
    }

    private long parseTimestamp(JsonElement timestamp) {
        if (timestamp == null || timestamp.isJsonNull()) return System.currentTimeMillis();
        if (timestamp.isJsonPrimitive() && timestamp.getAsJsonPrimitive().isNumber()) {
            return timestamp.getAsLong();
        }
        // ISO-8601 is read-only compatibility; all builders above emit numbers.
        return Instant.parse(timestamp.getAsString()).toEpochMilli();
    }

    private String generateId() {
        return "msg_" + System.currentTimeMillis() + "_" +
            Long.toHexString(Double.doubleToLongBits(Math.random()));
    }

    private String hmacSha256(String key, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder output = new StringBuilder(digest.length * 2);
            for (byte item : digest) {
                output.append(String.format("%02x", item & 0xff));
            }
            return output.toString();
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", error);
        }
    }

    private double getTPS() {
        try {
            Object server = Bukkit.getServer();
            Object minecraftServer = server.getClass().getMethod("getServer").invoke(server);
            double[] tps = (double[]) minecraftServer.getClass().getField("recentTps").get(minecraftServer);
            return Math.min(20.0, tps[0]);
        } catch (Exception e) {
            // A missing implementation is unavailable data, not a healthy
            // 20 TPS sample.
            return 0.0;
        }
    }

    private String getBukkitVersion() {
        try {
            return Bukkit.getVersion();
        } catch (RuntimeException error) {
            return "unknown";
        }
    }

    private long getUsedMemory() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }

    private long getMaxMemory() {
        return Runtime.getRuntime().maxMemory();
    }

    private int getPlayerPing(Player player) {
        try {
            return Math.max(0, player.getPing());
        } catch (NoSuchMethodError | UnsupportedOperationException e) {
            return 0;
        }
    }

    /** Parsed protocol message. */
    public static class ProtocolMessage {
        private final String type;
        private final String id;
        private final String op;
        private final String version;
        private final long timestamp;
        private final JsonObject data;
        private final String requestId;
        private final Boolean success;
        private final String error;
        private final String systemOp;

        public ProtocolMessage(String type, String id, String op, String version,
                               long timestamp, JsonObject data) {
            this(type, id, op, version, timestamp, data, null, null, null, null);
        }

        public ProtocolMessage(String type, String id, String op, String version,
                               long timestamp, JsonObject data, String requestId,
                               Boolean success, String error, String systemOp) {
            this.type = type;
            this.id = id;
            this.op = op;
            this.version = version;
            this.timestamp = timestamp;
            this.data = data == null ? new JsonObject() : data;
            this.requestId = requestId;
            this.success = success;
            this.error = error;
            this.systemOp = systemOp;
        }

        public String getType() { return type; }
        public String getId() { return id; }
        public String getOp() { return op; }
        public String getVersion() { return version; }
        public long getTimestamp() { return timestamp; }
        public JsonObject getData() { return data; }
        public String getRequestId() { return requestId; }
        public Boolean getSuccess() { return success; }
        public String getError() { return error; }
        public String getSystemOp() { return systemOp; }

        public boolean isType(String messageType) { return messageType.equals(type); }

        public String getDataString(String key) {
            return data.has(key) && !data.get(key).isJsonNull() ? data.get(key).getAsString() : null;
        }

        public int getDataInt(String key, int defaultValue) {
            return data.has(key) && !data.get(key).isJsonNull() ? data.get(key).getAsInt() : defaultValue;
        }

        public boolean getDataBoolean(String key, boolean defaultValue) {
            return data.has(key) && !data.get(key).isJsonNull() ? data.get(key).getAsBoolean() : defaultValue;
        }
    }
}
