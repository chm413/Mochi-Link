package com.mochilink.connector.nukkit.handlers;

import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.connection.NukkitConnectionManager;
import com.google.gson.JsonObject;

import cn.nukkit.Player;
import cn.nukkit.event.EventHandler;
import cn.nukkit.event.EventPriority;
import cn.nukkit.event.Listener;
import cn.nukkit.event.player.PlayerJoinEvent;
import cn.nukkit.event.player.PlayerQuitEvent;
import cn.nukkit.event.player.PlayerChatEvent;
import cn.nukkit.event.entity.EntityDamageEvent;
import cn.nukkit.plugin.PluginLogger;

/**
 * Handles Nukkit server events and forwards them to management server
 * Implements U-WBP v2 event protocol
 */
public class NukkitEventHandler implements Listener {
    
    private final MochiLinkNukkitPlugin plugin;
    private final NukkitConnectionManager connectionManager;
    private final PluginLogger logger;
    
    public NukkitEventHandler(MochiLinkNukkitPlugin plugin, NukkitConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.join")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        JsonObject data = new JsonObject();
        JsonObject playerObj = new JsonObject();
        playerObj.addProperty("id", player.getUniqueId().toString());
        playerObj.addProperty("name", player.getName());
        playerObj.addProperty("displayName", player.getDisplayName());
        data.add("player", playerObj);
        data.addProperty("firstJoin", !player.hasPlayedBefore());
        
        // Check filters
        java.util.Map<String, Object> filterData = new java.util.HashMap<>();
        filterData.put("firstJoin", !player.hasPlayedBefore());
        
        if (!plugin.getSubscriptionManager().matchesFilters("player.join", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("player.join", data);
        logger.info("Player joined: " + player.getName());
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.leave")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getUniqueId().toString());
        data.addProperty("playerName", player.getName());
        data.addProperty("reason", "quit");
        
        // Check filters
        java.util.Map<String, Object> filterData = new java.util.HashMap<>();
        filterData.put("reason", "quit");
        
        if (!plugin.getSubscriptionManager().matchesFilters("player.leave", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("player.leave", data);
        logger.info("Player left: " + player.getName());
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerChat(PlayerChatEvent event) {
        if (event.isCancelled()) return;
        
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.chat")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getUniqueId().toString());
        data.addProperty("playerName", player.getName());
        data.addProperty("message", event.getMessage());
        
        // Check filters
        java.util.Map<String, Object> filterData = new java.util.HashMap<>();
        filterData.put("message", event.getMessage());
        
        if (!plugin.getSubscriptionManager().matchesFilters("player.chat", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("player.chat", data);
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.death")) {
            return;
        }
        
        Player player = event.getEntity();
        EntityDamageEvent cause = player.getLastDamageCause();
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getUniqueId().toString());
        data.addProperty("playerName", player.getName());
        data.addProperty("cause", cause != null ? cause.getCause().name() : "UNKNOWN");
        
        JsonObject location = new JsonObject();
        location.addProperty("world", player.getLevel().getName());
        location.addProperty("x", player.getX());
        location.addProperty("y", player.getY());
        location.addProperty("z", player.getZ());
        data.add("location", location);
        
        // Check filters
        java.util.Map<String, Object> filterData = new java.util.HashMap<>();
        filterData.put("cause", cause != null ? cause.getCause().name() : "UNKNOWN");
        
        if (!plugin.getSubscriptionManager().matchesFilters("player.death", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("player.death", data);
        logger.info("Player died: " + player.getName());
    }
}
