package com.mochilink.connector.fabric;

import com.mochilink.connector.fabric.connection.FabricConnectionManager;
import com.mochilink.connector.fabric.config.FabricModConfig;
import com.mochilink.connector.fabric.handlers.FabricEventHandler;
import com.mochilink.connector.fabric.handlers.FabricCommandHandler;
import com.mochilink.connector.fabric.monitoring.FabricPerformanceMonitor;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.MinecraftServer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/**
 * Mochi-Link Connector Mod for Fabric Servers
 * 
 * This mod provides integration between Fabric servers and the Mochi-Link
 * unified management system, utilizing Fabric's event system and command API.
 * 
 * @author chm413
 * @version 1.0.0
 */
public class MochiLinkFabricMod implements DedicatedServerModInitializer {
    
    public static final String MOD_ID = "mochi-link-connector-fabric";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    
    private static MochiLinkFabricMod instance;
    private static MinecraftServer server;
    
    // Core components
    private FabricModConfig modConfig;
    private FabricConnectionManager connectionManager;
    private FabricEventHandler eventHandler;
    private FabricCommandHandler commandHandler;
    private FabricPerformanceMonitor performanceMonitor;
    
    // Fabric-specific executor
    private ScheduledExecutorService executor;
    
    // Mod state
    private boolean isEnabled = false;
    private boolean isConnected = false;
    
    @Override
    public void onInitializeServer() {
        instance = this;
        executor = Executors.newScheduledThreadPool(2);
        
        LOGGER.info("Initializing Mochi-Link Fabric Connector...");
        LOGGER.info("正在初始化大福连 Fabric 版连接器...");
        
        // Register server lifecycle events
        ServerLifecycleEvents.SERVER_STARTING.register(this::onServerStarting);
        ServerLifecycleEvents.SERVER_STARTED.register(this::onServerStarted);
        ServerLifecycleEvents.SERVER_STOPPING.register(this::onServerStopping);
        
        // Register player connection events
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            if (eventHandler != null) {
                eventHandler.onPlayerJoin(handler.getPlayer());
            }
        });
        
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            if (eventHandler != null) {
                eventHandler.onPlayerLeave(handler.getPlayer());
            }
        });
        
        // Register commands
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            if (commandHandler != null) {
                commandHandler.registerCommands(dispatcher);
            }
        });
        
        LOGGER.info("Mochi-Link Fabric Connector initialized successfully!");
        LOGGER.info("大福连 Fabric 版连接器初始化成功！");
    }
    
    /**
     * Called when server is starting
     */
    private void onServerStarting(MinecraftServer server) {
        MochiLinkFabricMod.server = server;
        
        try {
            // Initialize components
            initializeComponents();
            
        } catch (Exception e) {
            LOGGER.error("Failed to initialize Mochi-Link Fabric components", e);
        }
    }
    
    /**
     * Called when server has started
     */
    private void onServerStarted(MinecraftServer server) {
        try {
            // Start connection
            startConnection();
            
            isEnabled = true;
            LOGGER.info("Mochi-Link Fabric Connector has been enabled successfully!");
            LOGGER.info("大福连 Fabric 版连接器已成功启用！");
            
        } catch (Exception e) {
            LOGGER.error("Failed to start Mochi-Link Fabric connection", e);
        }
    }
    
    /**
     * Called when server is stopping
     */
    private void onServerStopping(MinecraftServer server) {
        try {
            // Disconnect from management server
            if (connectionManager != null) {
                connectionManager.disconnect();
            }
            
            // Stop performance monitoring
            if (performanceMonitor != null) {
                performanceMonitor.stop();
            }
            
            // Shutdown executor
            if (executor != null && !executor.isShutdown()) {
                executor.shutdown();
            }
            
            isEnabled = false;
            isConnected = false;
            
            LOGGER.info("Mochi-Link Fabric Connector has been disabled.");
            LOGGER.info("大福连 Fabric 版连接器已禁用。");
            
        } catch (Exception e) {
            LOGGER.warn("Error during mod disable", e);
        }
    }
    
    /**
     * Initialize mod components
     */
    private void initializeComponents() {
        LOGGER.info("Initializing Mochi-Link Fabric components...");
        
        // Load configuration
        modConfig = new FabricModConfig();
        modConfig.load();
        
        // Initialize Fabric-specific connection manager
        connectionManager = new FabricConnectionManager(this, modConfig);
        
        // Initialize Fabric-specific event handler
        eventHandler = new FabricEventHandler(this, connectionManager);
        
        // Initialize Fabric-specific command handler
        commandHandler = new FabricCommandHandler(this, connectionManager);
        
        // Initialize Fabric-specific performance monitor
        performanceMonitor = new FabricPerformanceMonitor(this, connectionManager);
        
        LOGGER.info("Fabric mod components initialized successfully.");
    }
    
    /**
     * Start connection to management server
     */
    private void startConnection() {
        LOGGER.info("Starting connection to Mochi-Link management server...");
        
        // Start connection asynchronously
        CompletableFuture.runAsync(() -> {
            try {
                connectionManager.connect();
                
                // Start performance monitoring after successful connection
                if (connectionManager.isConnected()) {
                    performanceMonitor.start();
                    isConnected = true;
                    
                    LOGGER.info("Successfully connected to Mochi-Link management server!");
                    LOGGER.info("已成功连接到大福连管理服务器！");
                }
                
            } catch (Exception e) {
                LOGGER.warn("Failed to connect to management server", e);
                
                // Schedule reconnection if auto-reconnect is enabled
                if (modConfig.isAutoReconnectEnabled()) {
                    scheduleReconnection();
                }
            }
        }, executor);
    }
    
    /**
     * Schedule reconnection attempt
     */
    private void scheduleReconnection() {
        int reconnectInterval = modConfig.getReconnectInterval();
        
        executor.schedule(() -> {
            if (!isConnected && isEnabled) {
                LOGGER.info("Attempting to reconnect to management server...");
                startConnection();
            }
        }, reconnectInterval, java.util.concurrent.TimeUnit.SECONDS);
    }
    
    /**
     * Reconnect to management server
     */
    public void reconnect() {
        LOGGER.info("Reconnecting to management server...");
        
        CompletableFuture.runAsync(() -> {
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
                    LOGGER.info("Reconnection successful!");
                }
                
            } catch (Exception e) {
                LOGGER.warn("Reconnection failed", e);
            }
        }, executor);
    }
    
    /**
     * Get mod instance
     */
    public static MochiLinkFabricMod getInstance() {
        return instance;
    }
    
    /**
     * Get Minecraft server instance
     */
    public static MinecraftServer getServer() {
        return server;
    }
    
    /**
     * Get mod configuration
     */
    public FabricModConfig getModConfig() {
        return modConfig;
    }
    
    /**
     * Get connection manager
     */
    public FabricConnectionManager getConnectionManager() {
        return connectionManager;
    }
    
    /**
     * Get event handler
     */
    public FabricEventHandler getEventHandler() {
        return eventHandler;
    }
    
    /**
     * Get command handler
     */
    public FabricCommandHandler getCommandHandler() {
        return commandHandler;
    }
    
    /**
     * Get performance monitor
     */
    public FabricPerformanceMonitor getPerformanceMonitor() {
        return performanceMonitor;
    }
    
    /**
     * Get executor service
     */
    public ScheduledExecutorService getExecutor() {
        return executor;
    }
    
    /**
     * Check if mod is properly enabled
     */
    public boolean isModEnabled() {
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
            return "Mod Disabled";
        }
        
        if (!isConnected) {
            return "Disconnected";
        }
        
        if (connectionManager != null && connectionManager.isConnected()) {
            return "Connected (Fabric)";
        }
        
        return "Unknown";
    }
}