package com.mochilink.connector.monitoring;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.connection.ConnectionManager;

import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.scheduler.BukkitTask;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Monitors server performance and sends statistics to management server
 * 
 * Collects TPS, memory usage, player count, and other performance metrics
 * and transmits them periodically to the Mochi-Link management system.
 */
public class PerformanceMonitor {
    
    private final MochiLinkPlugin plugin;
    private final ConnectionManager connectionManager;
    private final Logger logger;
    
    private BukkitTask monitoringTask;
    private boolean isRunning = false;
    
    // Performance tracking
    private long lastTickTime = System.currentTimeMillis();
    private double currentTPS = 20.0;
    
    public PerformanceMonitor(MochiLinkPlugin plugin, ConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    /**
     * Start performance monitoring
     */
    public void start() {
        if (isRunning) {
            logger.warning("Performance monitor is already running");
            return;
        }
        
        int interval = plugin.getPluginConfig().getPerformanceCollectionInterval();
        
        monitoringTask = new BukkitRunnable() {
            @Override
            public void run() {
                collectAndSendMetrics();
            }
        }.runTaskTimerAsynchronously(plugin, 20L, interval * 20L);
        
        isRunning = true;
        logger.info("Performance monitoring started with interval: " + interval + " seconds");
    }
    
    /**
     * Stop performance monitoring
     */
    public void stop() {
        if (monitoringTask != null) {
            monitoringTask.cancel();
            monitoringTask = null;
        }
        
        isRunning = false;
        logger.info("Performance monitoring stopped");
    }
    
    /**
     * Collect and send performance metrics
     */
    private void collectAndSendMetrics() {
        if (!connectionManager.isConnected()) {
            return;
        }
        
        try {
            Map<String, Object> metrics = collectMetrics();
            
            // For now, just log the metrics collection
            // In a full implementation, this would send via the protocol
            logger.info("Performance metrics collected: " + metrics.size() + " metrics");
            
        } catch (Exception e) {
            logger.warning("Failed to collect/send performance metrics: " + e.getMessage());
        }
    }
    
    /**
     * Collect all performance metrics
     */
    private Map<String, Object> collectMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        // Server basic info
        metrics.put("timestamp", System.currentTimeMillis());
        metrics.put("online_players", Bukkit.getOnlinePlayers().size());
        metrics.put("max_players", Bukkit.getMaxPlayers());
        
        // TPS monitoring
        if (plugin.getPluginConfig().isEnableTpsMonitoring()) {
            metrics.put("tps", getCurrentTPS());
        }
        
        // Memory monitoring
        if (plugin.getPluginConfig().isEnableMemoryMonitoring()) {
            Map<String, Object> memoryStats = getMemoryStats();
            metrics.put("memory", memoryStats);
        }
        
        // Player count monitoring
        if (plugin.getPluginConfig().isEnablePlayerCountMonitoring()) {
            Map<String, Object> playerStats = getPlayerStats();
            metrics.put("players", playerStats);
        }
        
        // World information
        metrics.put("worlds", getWorldStats());
        
        // Plugin information
        metrics.put("plugins", getPluginStats());
        
        return metrics;
    }
    
    /**
     * Get current TPS (approximation)
     */
    private double getCurrentTPS() {
        try {
            // Try to get TPS using reflection
            Object server = Bukkit.getServer();
            Object minecraftServer = server.getClass().getMethod("getServer").invoke(server);
            double[] tps = (double[]) minecraftServer.getClass().getField("recentTps").get(minecraftServer);
            return Math.min(20.0, tps[0]);
        } catch (Exception e) {
            // Fallback calculation
            long currentTime = System.currentTimeMillis();
            long timeDiff = currentTime - lastTickTime;
            lastTickTime = currentTime;
            
            if (timeDiff > 0) {
                currentTPS = Math.min(20.0, 1000.0 / timeDiff * 20.0);
            }
            
            return currentTPS;
        }
    }
    
    /**
     * Get memory statistics
     */
    private Map<String, Object> getMemoryStats() {
        Map<String, Object> memoryStats = new HashMap<>();
        
        Runtime runtime = Runtime.getRuntime();
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        
        // JVM memory
        long maxMemory = runtime.maxMemory();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;
        
        memoryStats.put("max_mb", maxMemory / 1024 / 1024);
        memoryStats.put("total_mb", totalMemory / 1024 / 1024);
        memoryStats.put("used_mb", usedMemory / 1024 / 1024);
        memoryStats.put("free_mb", freeMemory / 1024 / 1024);
        memoryStats.put("usage_percent", (double) usedMemory / maxMemory * 100);
        
        // Heap memory
        MemoryUsage heapMemory = memoryBean.getHeapMemoryUsage();
        Map<String, Object> heapStats = new HashMap<>();
        heapStats.put("used_mb", heapMemory.getUsed() / 1024 / 1024);
        heapStats.put("max_mb", heapMemory.getMax() / 1024 / 1024);
        heapStats.put("committed_mb", heapMemory.getCommitted() / 1024 / 1024);
        memoryStats.put("heap", heapStats);
        
        // Non-heap memory
        MemoryUsage nonHeapMemory = memoryBean.getNonHeapMemoryUsage();
        Map<String, Object> nonHeapStats = new HashMap<>();
        nonHeapStats.put("used_mb", nonHeapMemory.getUsed() / 1024 / 1024);
        nonHeapStats.put("max_mb", nonHeapMemory.getMax() / 1024 / 1024);
        nonHeapStats.put("committed_mb", nonHeapMemory.getCommitted() / 1024 / 1024);
        memoryStats.put("non_heap", nonHeapStats);
        
        return memoryStats;
    }
    
    /**
     * Get player statistics
     */
    private Map<String, Object> getPlayerStats() {
        Map<String, Object> playerStats = new HashMap<>();
        
        playerStats.put("online", Bukkit.getOnlinePlayers().size());
        playerStats.put("max", Bukkit.getMaxPlayers());
        playerStats.put("banned", Bukkit.getBannedPlayers().size());
        playerStats.put("whitelisted", Bukkit.getWhitelistedPlayers().size());
        
        return playerStats;
    }
    
    /**
     * Get world statistics
     */
    private Map<String, Object> getWorldStats() {
        Map<String, Object> worldStats = new HashMap<>();
        
        worldStats.put("count", Bukkit.getWorlds().size());
        
        Map<String, Object> worlds = new HashMap<>();
        Bukkit.getWorlds().forEach(world -> {
            Map<String, Object> worldInfo = new HashMap<>();
            worldInfo.put("players", world.getPlayers().size());
            worldInfo.put("entities", world.getEntities().size());
            worldInfo.put("chunks", world.getLoadedChunks().length);
            worldInfo.put("environment", world.getEnvironment().toString());
            worlds.put(world.getName(), worldInfo);
        });
        
        worldStats.put("details", worlds);
        
        return worldStats;
    }
    
    /**
     * Get plugin statistics
     */
    private Map<String, Object> getPluginStats() {
        Map<String, Object> pluginStats = new HashMap<>();
        
        pluginStats.put("total", Bukkit.getPluginManager().getPlugins().length);
        pluginStats.put("enabled", (int) java.util.Arrays.stream(Bukkit.getPluginManager().getPlugins())
            .filter(org.bukkit.plugin.Plugin::isEnabled)
            .count());
        
        return pluginStats;
    }
    
    /**
     * Check if monitoring is running
     */
    public boolean isRunning() {
        return isRunning;
    }
    
    /**
     * Get current performance snapshot
     */
    public Map<String, Object> getCurrentMetrics() {
        return collectMetrics();
    }
}