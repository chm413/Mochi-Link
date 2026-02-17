package com.mochilink.connector;

import com.mochilink.connector.connection.ConnectionManager;
import com.mochilink.connector.config.PluginConfig;
import com.mochilink.connector.handlers.EventHandler;
import com.mochilink.connector.handlers.CommandHandler;
import com.mochilink.connector.integrations.IntegrationManager;
import com.mochilink.connector.monitoring.PerformanceMonitor;
import com.mochilink.connector.commands.MochiLinkCommand;

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.logging.Level;

/**
 * Mochi-Link Connector Plugin for Minecraft Java Edition
 * 
 * This plugin serves as a bridge between Minecraft servers and the Mochi-Link
 * unified management system, implementing the U-WBP v2 protocol for seamless
 * cross-platform server management.
 * 
 * @author chm413
 * @version 1.0.0
 */
public class MochiLinkPlugin extends JavaPlugin {
    
    private static MochiLinkPlugin instance;
    
    // Core components
    private PluginConfig pluginConfig;
    private ConnectionManager connectionManager;
    private EventHandler eventHandler;
    private CommandHandler commandHandler;
    private IntegrationManager integrationManager;
    private PerformanceMonitor performanceMonitor;
    
    // Plugin state
    private boolean isEnabled = false;
    private boolean isConnected = false;
    
    @Override
    public void onEnable() {
        instance = this;
        
        try {
            // Initialize plugin
            initializePlugin();
            
            // Start connection
            startConnection();
            
            isEnabled = true;
            getLogger().info("Mochi-Link Connector has been enabled successfully!");
            getLogger().info("大福连 Java 版连接器已成功启用！");
            
        } catch (Exception e) {
            getLogger().log(Level.SEVERE, "Failed to enable Mochi-Link Connector", e);
            getServer().getPluginManager().disablePlugin(this);
        }
    }
    
    @Override
    public void onDisable() {
        try {
            // Disconnect from management server
            if (connectionManager != null) {
                connectionManager.disconnect();
            }
            
            // Stop performance monitoring
            if (performanceMonitor != null) {
                performanceMonitor.stop();
            }
            
            // Cleanup integrations
            if (integrationManager != null) {
                integrationManager.cleanup();
            }
            
            isEnabled = false;
            isConnected = false;
            
            getLogger().info("Mochi-Link Connector has been disabled.");
            getLogger().info("大福连 Java 版连接器已禁用。");
            
        } catch (Exception e) {
            getLogger().log(Level.WARNING, "Error during plugin disable", e);
        }
    }
    
    /**
     * Initialize plugin components
     */
    private void initializePlugin() {
        getLogger().info("Initializing Mochi-Link Connector...");
        
        // Save default config if not exists
        saveDefaultConfig();
        
        // Load configuration
        pluginConfig = new PluginConfig(this);
        pluginConfig.load();
        
        // Initialize connection manager
        connectionManager = new ConnectionManager(this, pluginConfig);
        
        // Initialize event handler
        eventHandler = new EventHandler(this, connectionManager);
        getServer().getPluginManager().registerEvents(eventHandler, this);
        
        // Initialize command handler
        commandHandler = new CommandHandler(this, connectionManager);
        
        // Register commands
        getCommand("mochilink").setExecutor(new MochiLinkCommand(this));
        getCommand("mlstatus").setExecutor(new MochiLinkCommand(this));
        getCommand("mlreconnect").setExecutor(new MochiLinkCommand(this));
        
        // Initialize integration manager
        integrationManager = new IntegrationManager(this, pluginConfig);
        integrationManager.initialize();
        
        // Initialize performance monitor
        performanceMonitor = new PerformanceMonitor(this, connectionManager);
        
        getLogger().info("Plugin components initialized successfully.");
    }
    
    /**
     * Start connection to management server
     */
    private void startConnection() {
        getLogger().info("Starting connection to Mochi-Link management server...");
        
        // Start connection in async task
        new BukkitRunnable() {
            @Override
            public void run() {
                try {
                    connectionManager.connect();
                    
                    // Start performance monitoring after successful connection
                    if (connectionManager.isConnected()) {
                        performanceMonitor.start();
                        isConnected = true;
                        
                        getLogger().info("Successfully connected to Mochi-Link management server!");
                        getLogger().info("已成功连接到大福连管理服务器！");
                    }
                    
                } catch (Exception e) {
                    getLogger().log(Level.WARNING, "Failed to connect to management server", e);
                    
                    // Schedule reconnection if auto-reconnect is enabled
                    if (pluginConfig.isAutoReconnectEnabled()) {
                        scheduleReconnection();
                    }
                }
            }
        }.runTaskAsynchronously(this);
    }
    
    /**
     * Schedule reconnection attempt
     */
    private void scheduleReconnection() {
        int reconnectInterval = pluginConfig.getReconnectInterval();
        
        new BukkitRunnable() {
            @Override
            public void run() {
                if (!isConnected && isEnabled) {
                    getLogger().info("Attempting to reconnect to management server...");
                    startConnection();
                }
            }
        }.runTaskLaterAsynchronously(this, reconnectInterval * 20L); // Convert seconds to ticks
    }
    
    /**
     * Reconnect to management server
     */
    public void reconnect() {
        getLogger().info("Reconnecting to management server...");
        
        new BukkitRunnable() {
            @Override
            public void run() {
                try {
                    // Disconnect first
                    if (connectionManager.isConnected()) {
                        connectionManager.disconnect();
                        isConnected = false;
                    }
                    
                    // Wait a moment
                    Thread.sleep(1000);
                    
                    // Reconnect
                    connectionManager.connect();
                    
                    if (connectionManager.isConnected()) {
                        isConnected = true;
                        getLogger().info("Reconnection successful!");
                    }
                    
                } catch (Exception e) {
                    getLogger().log(Level.WARNING, "Reconnection failed", e);
                }
            }
        }.runTaskAsynchronously(this);
    }
    
    /**
     * Get plugin instance
     */
    public static MochiLinkPlugin getInstance() {
        return instance;
    }
    
    /**
     * Get plugin configuration
     */
    public PluginConfig getPluginConfig() {
        return pluginConfig;
    }
    
    /**
     * Get connection manager
     */
    public ConnectionManager getConnectionManager() {
        return connectionManager;
    }
    
    /**
     * Get event handler
     */
    public EventHandler getEventHandler() {
        return eventHandler;
    }
    
    /**
     * Get command handler
     */
    public CommandHandler getCommandHandler() {
        return commandHandler;
    }
    
    /**
     * Get integration manager
     */
    public IntegrationManager getIntegrationManager() {
        return integrationManager;
    }
    
    /**
     * Get performance monitor
     */
    public PerformanceMonitor getPerformanceMonitor() {
        return performanceMonitor;
    }
    
    /**
     * Check if plugin is properly enabled
     */
    public boolean isPluginEnabled() {
        return isEnabled;
    }
    
    /**
     * Check if connected to management server
     */
    public boolean isConnectedToManagement() {
        return isConnected && connectionManager != null && connectionManager.isConnected();
    }
    
    /**
     * Get connection status information
     */
    public String getConnectionStatus() {
        if (!isEnabled) {
            return "Plugin Disabled";
        }
        
        if (!isConnected) {
            return "Disconnected";
        }
        
        if (connectionManager != null && connectionManager.isConnected()) {
            return "Connected";
        }
        
        return "Unknown";
    }
}