package com.mochilink.connector.folia.monitoring;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.connection.FoliaConnectionManager;
import com.google.gson.JsonObject;

import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

/**
 * Monitors Folia server performance and reports to management server
 * Adapted for Folia's multi-threaded architecture
 */
public class FoliaPerformanceMonitor {
    
    private final MochiLinkFoliaPlugin plugin;
    private final FoliaConnectionManager connectionManager;
    private final Logger logger;
    
    private boolean running = false;
    
    public FoliaPerformanceMonitor(MochiLinkFoliaPlugin plugin, FoliaConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    /**
     * Start performance monitoring
     */
    public void start() {
        if (running) {
            return;
        }
        
        running = true;
        
        // Schedule monitoring task using Folia's async scheduler
        plugin.getServer().getAsyncScheduler().runAtFixedRate(
            plugin,
            (task) -> collectAndReport(),
            1,
            60,
            TimeUnit.SECONDS
        );
        
        logger.info("Performance monitoring started");
    }
    
    /**
     * Stop performance monitoring
     */
    public void stop() {
        running = false;
        logger.info("Performance monitoring stopped");
    }
    
    /**
     * Collect performance data and report
     */
    private void collectAndReport() {
        if (!running || !connectionManager.isConnected()) {
            return;
        }
        
        try {
            // Collect performance metrics
            Runtime runtime = Runtime.getRuntime();
            long totalMemory = runtime.totalMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            long maxMemory = runtime.maxMemory();
            
            int onlinePlayers = plugin.getServer().getOnlinePlayers().size();
            int maxPlayers = plugin.getServer().getMaxPlayers();
            
            // Create standard U-WBP v2 event format
            JsonObject eventData = new JsonObject();
            
            // Memory metrics
            JsonObject memory = new JsonObject();
            memory.addProperty("used", usedMemory / 1024 / 1024);  // MB
            memory.addProperty("total", totalMemory / 1024 / 1024);  // MB
            memory.addProperty("free", freeMemory / 1024 / 1024);  // MB
            memory.addProperty("max", maxMemory / 1024 / 1024);  // MB
            memory.addProperty("percent", (double) usedMemory / totalMemory * 100);
            eventData.add("memory", memory);
            
            // Player metrics
            eventData.addProperty("onlinePlayers", onlinePlayers);
            eventData.addProperty("maxPlayers", maxPlayers);
            eventData.addProperty("playerPercent", (double) onlinePlayers / maxPlayers * 100);
            
            // Send as standard event
            connectionManager.sendEvent("server.metrics", eventData);
            
            logger.fine(String.format(
                "Performance metrics sent: Memory=%dMB/%dMB (%.1f%%), Players=%d/%d",
                usedMemory / 1024 / 1024,
                totalMemory / 1024 / 1024,
                (double) usedMemory / totalMemory * 100,
                onlinePlayers,
                maxPlayers
            ));
            
        } catch (Exception e) {
            logger.warning("Failed to collect performance data: " + e.getMessage());
        }
    }
}
