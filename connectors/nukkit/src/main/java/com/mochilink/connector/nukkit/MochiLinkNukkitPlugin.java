package com.mochilink.connector.nukkit;

import com.mochilink.connector.nukkit.connection.NukkitConnectionManager;
import com.mochilink.connector.nukkit.config.NukkitPluginConfig;
import com.mochilink.connector.nukkit.handlers.NukkitEventHandler;
import com.mochilink.connector.nukkit.handlers.NukkitCommandHandler;
import com.mochilink.connector.nukkit.monitoring.NukkitPerformanceMonitor;
import com.mochilink.connector.nukkit.commands.MochiLinkNukkitCommand;
import com.mochilink.connector.nukkit.subscription.SubscriptionManager;

import cn.nukkit.plugin.PluginBase;
import cn.nukkit.scheduler.AsyncTask;
import cn.nukkit.utils.TextFormat;

/**
 * Mochi-Link Connector Plugin for Nukkit Servers
 * 
 * This plugin provides integration between Nukkit servers and the Mochi-Link
 * unified management system, utilizing Nukkit's event system and command API.
 * 
 * @author chm413
 * @version 1.0.0
 */
public class MochiLinkNukkitPlugin extends PluginBase {
    
    private static MochiLinkNukkitPlugin instance;
    
    // Core components
    private NukkitPluginConfig pluginConfig;
    private NukkitConnectionManager connectionManager;
    private NukkitEventHandler eventHandler;
    private NukkitCommandHandler commandHandler;
    private NukkitPerformanceMonitor performanceMonitor;
    private SubscriptionManager subscriptionManager;
    
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
            getLogger().info(TextFormat.GREEN + "Mochi-Link Nukkit Connector has been enabled successfully!");
            getLogger().info(TextFormat.GREEN + "大福连 Nukkit 版连接器已成功启用！");
            
        } catch (Exception e) {
            getLogger().error("Failed to enable Mochi-Link Nukkit Connector", e);
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
            
            // Clear subscriptions
            if (subscriptionManager != null) {
                subscriptionManager.clearAll();
            }
            
            isEnabled = false;
            isConnected = false;
            
            getLogger().info(TextFormat.YELLOW + "Mochi-Link Nukkit Connector has been disabled.");
            getLogger().info(TextFormat.YELLOW + "大福连 Nukkit 版连接器已禁用。");
            
        } catch (Exception e) {
            getLogger().warning("Error during plugin disable", e);
        }
    }
    
    /**
     * Initialize plugin components
     */
    private void initializePlugin() {
        getLogger().info("Initializing Mochi-Link Nukkit Connector...");
        
        // Save default config if not exists
        saveDefaultConfig();
        
        // Load configuration
        pluginConfig = new NukkitPluginConfig(this);
        pluginConfig.load();
        
        // Initialize subscription manager
        subscriptionManager = new SubscriptionManager(getLogger());
        
        // Initialize connection manager
        connectionManager = new NukkitConnectionManager(this, pluginConfig);
        
        // Initialize event handler
        eventHandler = new NukkitEventHandler(this, connectionManager);
        getServer().getPluginManager().registerEvents(eventHandler, this);
        
        // Initialize command handler
        commandHandler = new NukkitCommandHandler(this, connectionManager);
        
        // Register commands
        getServer().getCommandMap().register("mochilink", new MochiLinkNukkitCommand(this));
        
        // Initialize performance monitor
        performanceMonitor = new NukkitPerformanceMonitor(this, connectionManager);
        
        getLogger().info("Nukkit plugin components initialized successfully.");
    }
    
    /**
     * Start connection to management server
     */
    private void startConnection() {
        getLogger().info("Starting connection to Mochi-Link management server...");
        
        // Start connection in async task
        getServer().getScheduler().scheduleAsyncTask(this, new AsyncTask() {
            @Override
            public void onRun() {
                try {
                    connectionManager.connect();
                    
                    // Start performance monitoring after successful connection
                    if (connectionManager.isConnected()) {
                        performanceMonitor.start();
                        isConnected = true;
                        
                        getLogger().info(TextFormat.GREEN + "Successfully connected to Mochi-Link management server!");
                        getLogger().info(TextFormat.GREEN + "已成功连接到大福连管理服务器！");
                    }
                    
                } catch (Exception e) {
                    getLogger().warning("Failed to connect to management server", e);
                    
                    // Schedule reconnection if auto-reconnect is enabled
                    if (pluginConfig.isAutoReconnectEnabled()) {
                        scheduleReconnection();
                    }
                }
            }
        });
    }
    
    /**
     * Schedule reconnection attempt
     */
    private void scheduleReconnection() {
        int reconnectInterval = pluginConfig.getReconnectInterval();
        
        getServer().getScheduler().scheduleDelayedTask(this, new Runnable() {
            @Override
            public void run() {
                if (!isConnected && isEnabled) {
                    getLogger().info("Attempting to reconnect to management server...");
                    startConnection();
                }
            }
        }, reconnectInterval * 20); // Convert seconds to ticks
    }
    
    /**
     * Reconnect to management server
     */
    public void reconnect() {
        getLogger().info("Reconnecting to management server...");
        
        getServer().getScheduler().scheduleAsyncTask(this, new AsyncTask() {
            @Override
            public void onRun() {
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
                        getLogger().info(TextFormat.GREEN + "Reconnection successful!");
                    }
                    
                } catch (Exception e) {
                    getLogger().warning("Reconnection failed", e);
                }
            }
        });
    }
    
    /**
     * Get plugin instance
     */
    public static MochiLinkNukkitPlugin getInstance() {
        return instance;
    }
    
    /**
     * Get plugin configuration
     */
    public NukkitPluginConfig getPluginConfig() {
        return pluginConfig;
    }
    
    /**
     * Get connection manager
     */
    public NukkitConnectionManager getConnectionManager() {
        return connectionManager;
    }
    
    /**
     * Get event handler
     */
    public NukkitEventHandler getEventHandler() {
        return eventHandler;
    }
    
    /**
     * Get command handler
     */
    public NukkitCommandHandler getCommandHandler() {
        return commandHandler;
    }
    
    /**
     * Get performance monitor
     */
    public NukkitPerformanceMonitor getPerformanceMonitor() {
        return performanceMonitor;
    }
    
    /**
     * Get subscription manager
     */
    public SubscriptionManager getSubscriptionManager() {
        return subscriptionManager;
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
            return "Connected (Nukkit)";
        }
        
        return "Unknown";
    }
    
    /**
     * Reload plugin configuration
     */
    public void reloadPluginConfig() {
        getLogger().info("Reloading plugin configuration...");
        reloadConfig();
        if (pluginConfig != null) {
            pluginConfig = new NukkitPluginConfig(this);
        }
    }
}