package com.mochilink.connector.config;

import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;
import java.util.logging.Level;

/**
 * Configuration manager for Mochi-Link Connector
 * 
 * Handles loading and accessing plugin configuration values
 * with proper defaults and validation.
 */
public class PluginConfig {
    
    private final JavaPlugin plugin;
    private FileConfiguration config;
    
    // Connection settings
    private String connectionMode;
    private String forwardHost;
    private int forwardPort;
    private boolean forwardSsl;
    private int reversePort;
    private String reverseBindAddress;
    private boolean reverseSsl;
    
    // Connection options
    private boolean autoReconnect;
    private int reconnectInterval;
    private int maxReconnectAttempts;
    private int connectTimeout;
    private int heartbeatInterval;
    
    // Authentication
    private String apiToken;
    private String serverId;
    private boolean ipWhitelistEnabled;
    
    // Features
    private List<String> enabledModules;
    private boolean syncJoinLeave;
    private boolean syncChat;
    private boolean syncDeath;
    private boolean syncAdvancement;
    
    // Command execution
    private boolean allowConsoleCommands;
    private int commandTimeout;
    private List<String> commandBlacklist;
    
    // Performance monitoring
    private int performanceCollectionInterval;
    private boolean enableTpsMonitoring;
    private boolean enableMemoryMonitoring;
    private boolean enablePlayerCountMonitoring;
    
    // Logging
    private String logLevel;
    private boolean verboseConnection;
    private boolean logEvents;
    private boolean logCommands;
    
    // Security
    private boolean enableEncryption;
    private String encryptionAlgorithm;
    private boolean verifyMessageIntegrity;
    private List<String> allowedManagementIps;
    
    // Debug
    private boolean debugEnabled;
    private boolean saveDebugLogs;
    private String debugLogFile;
    
    public PluginConfig(JavaPlugin plugin) {
        this.plugin = plugin;
    }
    
    /**
     * Load configuration from config.yml
     */
    public void load() {
        plugin.reloadConfig();
        config = plugin.getConfig();
        
        try {
            loadConnectionSettings();
            loadAuthenticationSettings();
            loadFeatureSettings();
            loadPerformanceSettings();
            loadLoggingSettings();
            loadSecuritySettings();
            loadDebugSettings();
            
            plugin.getLogger().info("Configuration loaded successfully.");
            
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to load configuration", e);
            throw new RuntimeException("Configuration loading failed", e);
        }
    }
    
    private void loadConnectionSettings() {
        connectionMode = config.getString("connection.mode", "forward");
        
        // Forward connection settings
        forwardHost = config.getString("connection.forward.host", "127.0.0.1");
        forwardPort = config.getInt("connection.forward.port", 8080);
        forwardSsl = config.getBoolean("connection.forward.ssl", false);
        
        // Reverse connection settings
        reversePort = config.getInt("connection.reverse.port", 25566);
        reverseBindAddress = config.getString("connection.reverse.bind_address", "0.0.0.0");
        reverseSsl = config.getBoolean("connection.reverse.ssl", false);
        
        // Connection options
        autoReconnect = config.getBoolean("connection.options.auto_reconnect", true);
        reconnectInterval = config.getInt("connection.options.reconnect_interval", 30);
        maxReconnectAttempts = config.getInt("connection.options.max_reconnect_attempts", -1);
        connectTimeout = config.getInt("connection.options.connect_timeout", 10000);
        heartbeatInterval = config.getInt("connection.options.heartbeat_interval", 30);
    }
    
    private void loadAuthenticationSettings() {
        apiToken = config.getString("authentication.token", "your-api-token-here");
        serverId = config.getString("authentication.server_id", "my-minecraft-server");
        ipWhitelistEnabled = config.getBoolean("authentication.ip_whitelist_enabled", false);
        
        // Validate required settings
        if ("your-api-token-here".equals(apiToken)) {
            plugin.getLogger().warning("API token is not configured! Please set authentication.token in config.yml");
        }
        
        if ("my-minecraft-server".equals(serverId)) {
            plugin.getLogger().warning("Server ID is not configured! Please set authentication.server_id in config.yml");
        }
    }
    
    private void loadFeatureSettings() {
        enabledModules = config.getStringList("features.enabled_modules");
        
        // Player management
        syncJoinLeave = config.getBoolean("features.player_management.sync_join_leave", true);
        syncChat = config.getBoolean("features.player_management.sync_chat", true);
        syncDeath = config.getBoolean("features.player_management.sync_death", true);
        syncAdvancement = config.getBoolean("features.player_management.sync_advancement", true);
        
        // Command execution
        allowConsoleCommands = config.getBoolean("features.command_execution.allow_console_commands", true);
        commandTimeout = config.getInt("features.command_execution.command_timeout", 30);
        commandBlacklist = config.getStringList("features.command_execution.command_blacklist");
    }
    
    private void loadPerformanceSettings() {
        performanceCollectionInterval = config.getInt("features.performance_stats.collection_interval", 60);
        enableTpsMonitoring = config.getBoolean("features.performance_stats.enable_tps_monitoring", true);
        enableMemoryMonitoring = config.getBoolean("features.performance_stats.enable_memory_monitoring", true);
        enablePlayerCountMonitoring = config.getBoolean("features.performance_stats.enable_player_count_monitoring", true);
    }
    
    private void loadLoggingSettings() {
        logLevel = config.getString("logging.level", "INFO");
        verboseConnection = config.getBoolean("logging.verbose_connection", false);
        logEvents = config.getBoolean("logging.log_events", true);
        logCommands = config.getBoolean("logging.log_commands", true);
    }
    
    private void loadSecuritySettings() {
        enableEncryption = config.getBoolean("security.enable_encryption", false);
        encryptionAlgorithm = config.getString("security.encryption_algorithm", "AES-256-GCM");
        verifyMessageIntegrity = config.getBoolean("security.verify_message_integrity", true);
        allowedManagementIps = config.getStringList("security.allowed_management_ips");
    }
    
    private void loadDebugSettings() {
        debugEnabled = config.getBoolean("debug.enabled", false);
        saveDebugLogs = config.getBoolean("debug.save_debug_logs", false);
        debugLogFile = config.getString("debug.debug_log_file", "plugins/MochiLinkConnector/debug.log");
    }
    
    // Getters for connection settings
    public String getConnectionMode() { return connectionMode; }
    public String getForwardHost() { return forwardHost; }
    public int getForwardPort() { return forwardPort; }
    public boolean isForwardSsl() { return forwardSsl; }
    public int getReversePort() { return reversePort; }
    public String getReverseBindAddress() { return reverseBindAddress; }
    public boolean isReverseSsl() { return reverseSsl; }
    
    // Getters for connection options
    public boolean isAutoReconnectEnabled() { return autoReconnect; }
    public int getReconnectInterval() { return reconnectInterval; }
    public int getMaxReconnectAttempts() { return maxReconnectAttempts; }
    public int getConnectTimeout() { return connectTimeout; }
    public int getHeartbeatInterval() { return heartbeatInterval; }
    
    // Getters for authentication
    public String getApiToken() { return apiToken; }
    public String getServerId() { return serverId; }
    public boolean isIpWhitelistEnabled() { return ipWhitelistEnabled; }
    
    // Getters for features
    public List<String> getEnabledModules() { return enabledModules; }
    public boolean isSyncJoinLeave() { return syncJoinLeave; }
    public boolean isSyncChat() { return syncChat; }
    public boolean isSyncDeath() { return syncDeath; }
    public boolean isSyncAdvancement() { return syncAdvancement; }
    
    // Getters for command execution
    public boolean isAllowConsoleCommands() { return allowConsoleCommands; }
    public int getCommandTimeout() { return commandTimeout; }
    public List<String> getCommandBlacklist() { return commandBlacklist; }
    
    // Getters for performance
    public int getPerformanceCollectionInterval() { return performanceCollectionInterval; }
    public boolean isEnableTpsMonitoring() { return enableTpsMonitoring; }
    public boolean isEnableMemoryMonitoring() { return enableMemoryMonitoring; }
    public boolean isEnablePlayerCountMonitoring() { return enablePlayerCountMonitoring; }
    
    // Getters for logging
    public String getLogLevel() { return logLevel; }
    public boolean isVerboseConnection() { return verboseConnection; }
    public boolean isLogEvents() { return logEvents; }
    public boolean isLogCommands() { return logCommands; }
    
    // Getters for security
    public boolean isEnableEncryption() { return enableEncryption; }
    public String getEncryptionAlgorithm() { return encryptionAlgorithm; }
    public boolean isVerifyMessageIntegrity() { return verifyMessageIntegrity; }
    public List<String> getAllowedManagementIps() { return allowedManagementIps; }
    
    // Getters for debug
    public boolean isDebugEnabled() { return debugEnabled; }
    public boolean isSaveDebugLogs() { return saveDebugLogs; }
    public String getDebugLogFile() { return debugLogFile; }
    
    /**
     * Check if a module is enabled
     */
    public boolean isModuleEnabled(String moduleName) {
        return enabledModules.contains(moduleName);
    }
    
    /**
     * Check if a command is blacklisted
     */
    public boolean isCommandBlacklisted(String command) {
        return commandBlacklist.contains(command.toLowerCase());
    }
    
    /**
     * Check if forward connection mode is enabled
     */
    public boolean isForwardMode() {
        return "forward".equalsIgnoreCase(connectionMode);
    }
    
    /**
     * Check if reverse connection mode is enabled
     */
    public boolean isReverseMode() {
        return "reverse".equalsIgnoreCase(connectionMode);
    }
}