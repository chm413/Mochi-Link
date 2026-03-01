package com.mochilink.connector.folia;

import com.mochilink.connector.folia.connection.FoliaConnectionManager;
import com.mochilink.connector.folia.config.FoliaPluginConfig;
import com.mochilink.connector.folia.handlers.FoliaEventHandler;
import com.mochilink.connector.folia.handlers.FoliaCommandHandler;
import com.mochilink.connector.folia.monitoring.FoliaPerformanceMonitor;
import com.mochilink.connector.folia.commands.MochiLinkFoliaCommand;
import com.mochilink.connector.folia.subscription.SubscriptionManager;

import org.bukkit.plugin.java.JavaPlugin;
import io.papermc.paper.threadedregions.scheduler.ScheduledTask;

import java.util.logging.Level;

/**
 * Mochi-Link Connector Plugin for Folia Servers
 * 
 * This plugin is specifically designed for Folia servers, utilizing Folia's
 * region-based threading system for optimal performance in multi-threaded
 * server environments.
 * 
 * @author chm413
 * @version 1.0.0
 */
public class MochiLinkFoliaPlugin extends JavaPlugin {
    
    private static MochiLinkFoliaPlugin instance;
    
    // Core components
    private FoliaPluginConfig pluginConfig;
    private FoliaConnectionManager connectionManager;
    private FoliaEventHandler eventHandler;
    private FoliaCommandHandler commandHandler;
    private FoliaPerformanceMonitor performanceMonitor;
    private SubscriptionManager subscriptionManager;
    private com.mochilink.connector.folia.protocol.FoliaMessageHandler messageHandler;
    
    // Plugin state
    private boolean isEnabled = false;
    private boolean isConnected = false;
    private long startTime;
    
    // Folia-specific scheduler task
    private ScheduledTask connectionTask;
    
    @Override
    public void onEnable() {
        instance = this;
        startTime = System.currentTimeMillis();
        
        try {
            // Initialize plugin
            initializePlugin();
            
            // Start connection using Folia's async scheduler
            startFoliaConnection();
            
            isEnabled = true;
            getLogger().info("Mochi-Link Folia Connector has been enabled successfully!");
            getLogger().info("大福连 Folia 版连接器已成功启用！");
            
        } catch (Exception e) {
            getLogger().log(Level.SEVERE, "Failed to enable Mochi-Link Folia Connector", e);
            getServer().getPluginManager().disablePlugin(this);
        }
    }
    
    @Override
    public void onDisable() {
        try {
            // Cancel Folia tasks
            if (connectionTask != null && !connectionTask.isCancelled()) {
                connectionTask.cancel();
            }
            
            // Disconnect from management server
            if (connectionManager != null) {
                connectionManager.disconnect();
            }
            
            // Stop performance monitoring
            if (performanceMonitor != null) {
                performanceMonitor.stop();
            }
            
            // Clear subscriptions
            if (subscriptionManager != null) {
                subscriptionManager.clearAll();
            }
            
            isEnabled = false;
            isConnected = false;
            
            getLogger().info("Mochi-Link Folia Connector has been disabled.");
            getLogger().info("大福连 Folia 版连接器已禁用。");
            
        } catch (Exception e) {
            getLogger().log(Level.WARNING, "Error during plugin disable", e);
        }
    }
    
    /**
     * Initialize plugin components for Folia
     */
    private void initializePlugin() {
        getLogger().info("Initializing Mochi-Link Folia Connector...");
        
        // Save default config if not exists
        saveDefaultConfig();
        
        // Load configuration
        pluginConfig = new FoliaPluginConfig(this);
        pluginConfig.load();
        
        // Initialize subscription manager
        subscriptionManager = new SubscriptionManager(getLogger());
        
        // Initialize Folia-specific connection manager
        connectionManager = new FoliaConnectionManager(this, pluginConfig);
        
        // Initialize message handler
        messageHandler = new com.mochilink.connector.folia.protocol.FoliaMessageHandler(this, connectionManager);
        
        // Initialize Folia-specific event handler
        eventHandler = new FoliaEventHandler(this, connectionManager);
        getServer().getPluginManager().registerEvents(eventHandler, this);
        
        // Initialize Folia-specific command handler
        commandHandler = new FoliaCommandHandler(this, connectionManager);
        
        // Register commands
        getCommand("mochilink").setExecutor(new MochiLinkFoliaCommand(this));
        getCommand("mlstatus").setExecutor(new MochiLinkFoliaCommand(this));
        getCommand("mlreconnect").setExecutor(new MochiLinkFoliaCommand(this));
        
        // Initialize Folia-specific performance monitor
        performanceMonitor = new FoliaPerformanceMonitor(this, connectionManager);
        
        getLogger().info("Folia plugin components initialized successfully.");
    }
    
    /**
     * Start connection using Folia's async scheduler
     */
    private void startFoliaConnection() {
        getLogger().info("Starting connection to Mochi-Link management server using Folia scheduler...");
        
        // Use Folia's async scheduler for connection
        connectionTask = getServer().getAsyncScheduler().runNow(this, (task) -> {
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
                    scheduleFoliaReconnection();
                }
            }
        });
    }
    
    /**
     * Schedule reconnection attempt using Folia scheduler
     */
    private void scheduleFoliaReconnection() {
        int reconnectInterval = pluginConfig.getReconnectInterval();
        
        getServer().getAsyncScheduler().runDelayed(
            this,
            (task) -> {
                if (!isConnected && isEnabled) {
                    getLogger().info("Attempting to reconnect to management server...");
                    startFoliaConnection();
                }
            },
            reconnectInterval,
            java.util.concurrent.TimeUnit.SECONDS
        );
    }
    
    /**
     * Reconnect to management server using Folia scheduler
     */
    public void reconnect() {
        getLogger().info("Reconnecting to management server using Folia scheduler...");
        
        getServer().getAsyncScheduler().runNow(this, (task) -> {
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
        });
    }
    
    /**
     * Get plugin instance
     */
    public static MochiLinkFoliaPlugin getInstance() {
        return instance;
    }
    
    /**
     * Get plugin configuration
     */
    public FoliaPluginConfig getPluginConfig() {
        return pluginConfig;
    }
    
    /**
     * Get connection manager
     */
    public FoliaConnectionManager getConnectionManager() {
        return connectionManager;
    }
    
    /**
     * Get event handler
     */
    public FoliaEventHandler getEventHandler() {
        return eventHandler;
    }
    
    /**
     * Get command handler
     */
    public FoliaCommandHandler getCommandHandler() {
        return commandHandler;
    }
    
    /**
     * Get performance monitor
     */
    public FoliaPerformanceMonitor getPerformanceMonitor() {
        return performanceMonitor;
    }
    
    /**
     * Get subscription manager
     */
    public SubscriptionManager getSubscriptionManager() {
        return subscriptionManager;
    }
    
    /**
     * Get message handler
     */
    public com.mochilink.connector.folia.protocol.FoliaMessageHandler getMessageHandler() {
        return messageHandler;
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
            return "Connected (Folia)";
        }
        
        return "Unknown";
    }
    
    /**
     * Get plugin start time
     */
    public long getStartTime() {
        return startTime;
    }
}
