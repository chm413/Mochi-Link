package com.mochilink.connector.nukkit.protocol;

import com.google.gson.JsonObject;

/**
 * U-WBP v2 Protocol Message
 * Unified WebSocket Bridge Protocol version 2.0
 */
public class UWBPMessage {
    
    public static final String VERSION = "2.0";
    public static final String PROTOCOL_NAME = "U-WBP";
    
    private String type;
    private String id;
    private String op;
    private JsonObject data;
    private long timestamp;
    private String version;
    private String serverId;
    
    public UWBPMessage(String type, String op, JsonObject data) {
        this.type = type;
        this.id = generateId();
        this.op = op;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
        this.version = VERSION;
    }
    
    // Getters and setters
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getOp() { return op; }
    public void setOp(String op) { this.op = op; }
    
    public JsonObject getData() { return data; }
    public void setData(JsonObject data) { this.data = data; }
    
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
    
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    
    public String getServerId() { return serverId; }
    public void setServerId(String serverId) { this.serverId = serverId; }
    
    private static String generateId() {
        return System.currentTimeMillis() + "-" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }
}
