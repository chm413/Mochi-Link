package com.mochilink.connector.forge;

import com.mochilink.connector.forge.config.ForgeModConfig;
import com.mochilink.connector.forge.connection.ForgeConnectionManager;
import com.mochilink.connector.forge.subscription.SubscriptionManager;
import com.mochilink.connector.forge.handlers.ForgeEventHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Mochi-Link Connector Mod for Forge
 * 
 * This mod provides integration between Forge servers and the Mochi-Link
 * unified management system, implementing U-WBP v2 protocol.
 * 
 * @author chm413
 * @version 1.0.0
 */
public class MochiLinkForgeMod {
    
    public static final String MOD_ID = "mochilink";
    public static final String MOD_NAME = "Mochi-Link Connector";
    public static final String VERSION = "1.0.0";
    
    private static final Logger LOGGER = LoggerFactory.getLogger(MOD_NAME);
    private static MochiLinkForgeMod instance;
    
    private ForgeModConfig config;
    private ForgeConnectionManager connectionManager;
    private SubscriptionManager subscriptionManager;
    private ForgeEventHandler eventHandler;
    private com.mochilink.connector.forge.protocol.ForgeMessageHandler messageHandler;
    private net.minecraft.server.MinecraftServer server;
    private boolean initialized = false;
    
    public void onInitialize() {
        instance = this;
        
        LOGGER.info("Initializing {} v{}", MOD_NAME, VERSION);
        
        try {
            // Load configuration
            config = new ForgeModConfig();
            config.load();
            
            // Initialize subscription manager
            subscriptionManager = new SubscriptionManager(LOGGER);
            
            // Initialize connection manager
            connectionManager = new ForgeConnectionManager(this, config);
            
            // Initialize message handler
            messageHandler = new com.mochilink.connector.forge.protocol.ForgeMessageHandler(this, connectionManager);
            
            // Initialize event handler
            eventHandler = new ForgeEventHandler(this, connectionManager);
            
            // Connect to management server
            connectionManager.connect();
            
            initialized = true;
            LOGGER.info("{} initialized successfully!", MOD_NAME);
            
        } catch (Exception e) {
            LOGGER.error("Failed to initialize {}", MOD_NAME, e);
        }
    }
    
    public void onShutdown() {
        LOGGER.info("Shutting down {}...", MOD_NAME);
        
        // Clear subscriptions
        if (subscriptionManager != null) {
            subscriptionManager.clearAll();
        }
        
        if (connectionManager != null) {
            connectionManager.disconnect();
        }
        
        LOGGER.info("{} shut down successfully.", MOD_NAME);
    }
    
    public static MochiLinkForgeMod getInstance() {
        return instance;
    }
    
    public ForgeModConfig getConfig() {
        return config;
    }
    
    public ForgeConnectionManager getConnectionManager() {
        return connectionManager;
    }
    
    public SubscriptionManager getSubscriptionManager() {
        return subscriptionManager;
    }
    
    public ForgeEventHandler getEventHandler() {
        return eventHandler;
    }
    
    public com.mochilink.connector.forge.protocol.ForgeMessageHandler getMessageHandler() {
        return messageHandler;
    }
    
    public net.minecraft.server.MinecraftServer getServer() {
        return server;
    }
    
    public void setServer(net.minecraft.server.MinecraftServer server) {
        this.server = server;
    }
    
    public boolean isInitialized() {
        return initialized;
    }
    
    public static Logger getLogger() {
        return LOGGER;
    }
    
    /**
     * Check if connected to management server
     */
    public boolean isConnectedToManagement() {
        return connectionManager != null && connectionManager.isConnected();
    }
    
    /**
     * Get connection status
     */
    public String getConnectionStatus() {
        if (connectionManager == null) {
            return "Not initialized";
        }
        return connectionManager.isConnected() ? "Connected" : "Disconnected";
    }
    
    /**
     * Check if mod is enabled
     */
    public boolean isModEnabled() {
        return initialized;
    }
    
    /**
     * Reconnect to management server
     */
    public void reconnect() {
        if (connectionManager != null) {
            LOGGER.info("Reconnecting to management server...");
            connectionManager.disconnect();
            connectionManager.connect();
        }
    }
    
    /**
     * Reload configuration
     */
    public void reloadConfig() {
        if (config != null) {
            LOGGER.info("Reloading configuration...");
            config.load();
        }
    }
}
