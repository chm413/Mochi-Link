package com.mochilink.connector.forge;

import com.mochilink.connector.forge.connection.ForgeConnectionManager;
import com.mochilink.connector.forge.config.ForgeModConfig;
import com.mochilink.connector.forge.handlers.ForgeEventHandler;
import com.mochilink.connector.forge.handlers.ForgeCommandHandler;
import com.mochilink.connector.forge.monitoring.ForgePerformanceMonitor;

import net.minecraft.server.MinecraftServer;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.server.ServerStartedEvent;
import net.minecraftforge.event.server.ServerStartingEvent;
import net.minecraftforge.event.server.ServerStoppingEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLDedicatedServerSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/**
 * Mochi-Link Connector Mod for Forge Servers
 * 
 * This mod provides integration between Forge servers and the Mochi-Link
 * unified management system, utilizing Forge's event system and command API.
 * 
 * @author chm413
 * @version 1.0.0
 */
@Mod("mochi-link-connector-forge")
public class MochiLinkForgeMod {
    
    public static final String MOD_ID = "mochi-link-connector-forge";
    public static final Logger LOGGER = LogManager.getLogger(MOD_ID);
    
    private static MochiLinkForgeMod instance;
    private static MinecraftServer server;
    
    // Core components
    private ForgeModConfig modConfig;
    private ForgeConnectionManager connectionManager;
    private ForgeEventHandler eventHandler;
    private ForgeCommandHandler commandHandler;
    private ForgePerformanceMonitor performanceMonitor;
    
    // Forge-specific executor
    private ScheduledExecutorService executor;
    
    // Mod state
    private boolean isEnabled = false;
    private boolean isConnected = false;
    
    public MochiLinkForgeMod() {
        instance = this;
        executor = Executors.newScheduledThreadPool(2);
        
        LOGGER.info("Initializing Mochi-Link Forge Connector...");
        LOGGER.info("正在初始化大福连 Forge 版连接器...");
        
        // Register ourselves for server and other game events we are interested in
        MinecraftForge.EVENT_BUS.register(this);
        
        // Register the setup method for modloading
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::setup);
        
        LOGGER.info("Mochi-Link Forge Connector initialized successfully!");
        LOGGER.info("大福连 Forge 版连接器初始化成功！");
    }
    
    private void setup(final FMLDedicatedServerSetupEvent event) {
        // Some preinit code
        LOGGER.info("Mochi-Link Forge Connector setup phase...");
    }
    
    @SubscribeEvent
    public void onServerStarting(ServerStartingEvent event) {
        server = event.getServer();
        
        try {
            // Initialize components
            initializeComponents();
            
        } catch (Exception e) {
            LOGGER.error("Failed to initialize Mochi-Link Forge components", e);
        }
    }
    
    @SubscribeEvent
    public void onServerStarted(ServerStartedEvent event) {
        try {
            // Start connection
            startConnection();
            
            isEnabled = true;
            LOGGER.info("Mochi-Link Forge Connector has been enabled successfully!");
            LOGGER.info("大福连 Forge 版连接器已成功启用！");
            
        } catch (Exception e) {
            LOGGER.error("Failed to start Mochi-Link Forge connection", e);
        }
    }
    
    @SubscribeEvent
    public void onServerStopping(ServerStoppingEvent event) {
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
            
            LOGGER.info("Mochi-Link Forge Connector has been disabled.");
            LOGGER.info("大福连 Forge 版连接器已禁用。");
            
        } catch (Exception e) {
            LOGGER.warn("Error during mod disable", e);
        }
    }
    
    @SubscribeEvent
    public void onRegisterCommands(RegisterCommandsEvent event) {
        if (commandHandler != null) {
            commandHandler.registerCommands(event.getDispatcher());
        }
    }
    
    @SubscribeEvent
    public void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event) {
        if (eventHandler != null) {
            eventHandler.onPlayerJoin(event.getEntity());
        }
    }
    
    @SubscribeEvent
    public void onPlayerLeave(PlayerEvent.PlayerLoggedOutEvent event) {
        if (eventHandler != null) {
            eventHandler.onPlayerLeave(event.getEntity());
        }
    }
    
    /**
     * Initialize mod components
     */
    private void initializeComponents() {
        LOGGER.info("Initializing Mochi-Link Forge components...");
        
        // Load configuration
        modConfig = new ForgeModConfig();
        modConfig.load();
        
        // Initialize Forge-specific connection manager
        connectionManager = new ForgeConnectionManager(this, modConfig);
        
        // Initialize Forge-specific event handler
        eventHandler = new ForgeEventHandler(this, connectionManager);
        
        // Initialize Forge-specific command handler
        commandHandler = new ForgeCommandHandler(this, connectionManager);
        
        // Initialize Forge-specific performance monitor
        performanceMonitor = new ForgePerformanceMonitor(this, connectionManager);
        
        LOGGER.info("Forge mod components initialized successfully.");
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
    public static MochiLinkForgeMod getInstance() {
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
    public ForgeModConfig getModConfig() {
        return modConfig;
    }
    
    /**
     * Get connection manager
     */
    public ForgeConnectionManager getConnectionManager() {
        return connectionManager;
    }
    
    /**
     * Get event handler
     */
    public ForgeEventHandler getEventHandler() {
        return eventHandler;
    }
    
    /**
     * Get command handler
     */
    public ForgeCommandHandler getCommandHandler() {
        return commandHandler;
    }
    
    /**
     * Get performance monitor
     */
    public ForgePerformanceMonitor getPerformanceMonitor() {
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
            return "Connected (Forge)";
        }
        
        return "Unknown";
    }
}