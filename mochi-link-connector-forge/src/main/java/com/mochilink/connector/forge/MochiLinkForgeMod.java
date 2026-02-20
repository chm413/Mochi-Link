package com.mochilink.connector.forge;

import com.mochilink.connector.forge.config.ForgeModConfig;
import com.mochilink.connector.forge.connection.ForgeConnectionManager;
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
    private boolean initialized = false;
    
    public void onInitialize() {
        instance = this;
        
        LOGGER.info("Initializing {} v{}", MOD_NAME, VERSION);
        
        try {
            // Load configuration
            config = new ForgeModConfig();
            config.load();
            
            // Initialize connection manager
            connectionManager = new ForgeConnectionManager(this, config);
            
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
    
    public boolean isInitialized() {
        return initialized;
    }
    
    public static Logger getLogger() {
        return LOGGER;
    }
}
