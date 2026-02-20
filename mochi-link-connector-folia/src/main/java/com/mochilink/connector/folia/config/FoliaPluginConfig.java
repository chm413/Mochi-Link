package com.mochilink.connector.folia.config;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import org.bukkit.configuration.file.FileConfiguration;

/**
 * Configuration manager for Folia plugin
 * Handles loading and accessing plugin configuration
 */
public class FoliaPluginConfig {
    
    private final MochiLinkFoliaPlugin plugin;
    private FileConfiguration config;
    
    // Server connection settings
    private String serverHost;
    private int serverPort;
    private String serverToken;
    private boolean useSsl;
    
    // Auto-reconnect settings
    private boolean autoReconnectEnabled;
    private int reconnectInterval;
    
    // Performance monitoring settings
    private boolean monitoringEnabled;
    private int reportInterval;
    
    public FoliaPluginConfig(MochiLinkFoliaPlugin plugin) {
        this.plugin = plugin;
    }
    
    /**
     * Load configuration from file
     */
    public void load() {
        plugin.saveDefaultConfig();
        plugin.reloadConfig();
        config = plugin.getConfig();
        
        // Load server connection settings
        serverHost = config.getString("server.host", "localhost");
        serverPort = config.getInt("server.port", 8080);
        serverToken = config.getString("server.token", "");
        useSsl = config.getBoolean("server.use-ssl", false);
        
        // Load auto-reconnect settings
        autoReconnectEnabled = config.getBoolean("auto-reconnect.enabled", true);
        reconnectInterval = config.getInt("auto-reconnect.interval", 30);
        
        // Load performance monitoring settings
        monitoringEnabled = config.getBoolean("performance.monitoring-enabled", true);
        reportInterval = config.getInt("performance.report-interval", 60);
        
        plugin.getLogger().info("Configuration loaded successfully");
    }
    
    // Getters
    public String getServerHost() { return serverHost; }
    public int getServerPort() { return serverPort; }
    public String getServerToken() { return serverToken; }
    public boolean isUseSsl() { return useSsl; }
    public boolean isAutoReconnectEnabled() { return autoReconnectEnabled; }
    public int getReconnectInterval() { return reconnectInterval; }
    public boolean isMonitoringEnabled() { return monitoringEnabled; }
    public int getReportInterval() { return reportInterval; }
    
    /**
     * Get WebSocket URL
     */
    public String getWebSocketUrl() {
        String protocol = useSsl ? "wss" : "ws";
        return String.format("%s://%s:%d/ws", protocol, serverHost, serverPort);
    }
}
