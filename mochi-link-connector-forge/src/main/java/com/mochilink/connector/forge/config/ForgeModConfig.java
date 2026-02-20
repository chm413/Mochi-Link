package com.mochilink.connector.forge.config;

/**
 * Configuration manager for Forge mod
 */
public class ForgeModConfig {
    
    private String serverHost = "localhost";
    private int serverPort = 8080;
    private String serverToken = "";
    private boolean useSsl = false;
    
    private boolean autoReconnectEnabled = true;
    private int reconnectInterval = 30;
    
    private boolean monitoringEnabled = true;
    private int reportInterval = 60;
    
    public void load() {
        // TODO: Load from config file
    }
    
    public String getServerHost() { return serverHost; }
    public int getServerPort() { return serverPort; }
    public String getServerToken() { return serverToken; }
    public boolean isUseSsl() { return useSsl; }
    public boolean isAutoReconnectEnabled() { return autoReconnectEnabled; }
    public int getReconnectInterval() { return reconnectInterval; }
    public boolean isMonitoringEnabled() { return monitoringEnabled; }
    public int getReportInterval() { return reportInterval; }
    
    public String getWebSocketUrl() {
        String protocol = useSsl ? "wss" : "ws";
        return String.format("%s://%s:%d/ws", protocol, serverHost, serverPort);
    }
}
