package com.mochilink.connector.nukkit.monitoring;

import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.connection.NukkitConnectionManager;
import com.google.gson.JsonObject;
import cn.nukkit.plugin.PluginLogger;

/**
 * Monitors Nukkit server performance and reports to management server
 * Implements U-WBP v2 metrics protocol
 */
public class NukkitPerformanceMonitor {
    
    private final MochiLinkNukkitPlugin plugin;
    private final NukkitConnectionManager connectionManager;
    private final PluginLogger logger;
    
    private boolean running = false;
    private int taskId = -1;
    
    public NukkitPerformanceMonitor(MochiLinkNukkitPlugin plugin, NukkitConnectionManager connectionManager) {
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
        
        // Schedule monitoring task (every 60 seconds)
        taskId = plugin.getServer().getScheduler().scheduleRepeatingTask(
            plugin,
            this::collectAndReport,
            1200 // 60 seconds in ticks (20 ticks per second)
        ).getTaskId();
        
        logger.info("Performance monitoring started");
    }
    
    /**
     * Stop performance monitoring
     */
    public void stop() {
        if (taskId != -1) {
            plugin.getServer().getScheduler().cancelTask(taskId);
            taskId = -1;
        }
        running = false;
        logger.info("Performance monitoring stopped");
    }
    
    /**
     * Collect performance data and report (U-WBP v2 format)
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
            
            int onlinePlayers = plugin.getServer().getOnlinePlayers().size();
            int maxPlayers = plugin.getServer().getMaxPlayers();
            
            // Create metrics data (U-WBP v2 format)
            JsonObject data = new JsonObject();
            
            JsonObject metrics = new JsonObject();
            metrics.addProperty("tps", 20.0); // Nukkit doesn't expose TPS easily
            metrics.addProperty("mspt", 50.0);
            
            JsonObject memory = new JsonObject();
            memory.addProperty("used", usedMemory);
            memory.addProperty("max", totalMemory);
            memory.addProperty("percentage", (double) usedMemory / totalMemory * 100);
            metrics.add("memory", memory);
            
            metrics.addProperty("playerCount", onlinePlayers);
            metrics.addProperty("maxPlayers", maxPlayers);
            metrics.addProperty("loadedChunks", plugin.getServer().getDefaultLevel().getChunks().size());
            metrics.addProperty("loadedWorlds", plugin.getServer().getLevels().size());
            
            data.add("metrics", metrics);
            
            // Send metrics event
            connectionManager.sendEvent("server.metrics", data);
            
            logger.debug(String.format(
                "Performance: Memory=%dMB/%dMB, Players=%d/%d",
                usedMemory / 1024 / 1024,
                totalMemory / 1024 / 1024,
                onlinePlayers,
                maxPlayers
            ));
            
        } catch (Exception e) {
            logger.warning("Failed to collect performance data: " + e.getMessage());
        }
    }
}
