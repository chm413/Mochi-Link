package com.mochilink.connector.folia.handlers;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.connection.FoliaConnectionManager;

import com.google.gson.JsonObject;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.*;
import org.bukkit.event.entity.PlayerDeathEvent;

import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Handles Folia server events and forwards them to management server
 * Adapted for Folia's region-based threading model with subscription support
 */
public class FoliaEventHandler implements Listener {
    
    private final MochiLinkFoliaPlugin plugin;
    private final FoliaConnectionManager connectionManager;
    private final Logger logger;
    
    public FoliaEventHandler(MochiLinkFoliaPlugin plugin, FoliaConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    /**
     * Handle player join events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.join")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        // Build event data for filtering
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("join_message", event.getJoinMessage());
        filterData.put("first_join", !player.hasPlayedBefore());
        filterData.put("player_count", plugin.getServer().getOnlinePlayers().size());
        filterData.put("player_name", player.getName());
        filterData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.join", filterData)) {
            return;
        }
        
        // Build U-WBP v2 compliant event message
        JsonObject eventData = new JsonObject();
        
        // Player information
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        
        // Location information
        JsonObject location = new JsonObject();
        location.addProperty("world", player.getWorld().getName());
        location.addProperty("x", player.getLocation().getX());
        location.addProperty("y", player.getLocation().getY());
        location.addProperty("z", player.getLocation().getZ());
        playerInfo.add("location", location);
        
        eventData.add("player", playerInfo);
        
        // Additional event data
        eventData.addProperty("join_message", event.getJoinMessage());
        eventData.addProperty("first_join", !player.hasPlayedBefore());
        eventData.addProperty("player_count", plugin.getServer().getOnlinePlayers().size());
        
        // Send event
        connectionManager.sendEvent("player.join", eventData);
        logger.info("Player joined: " + player.getName());
    }
    
    /**
     * Handle player quit events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.leave")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        // Build filter data
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("quit_message", event.getQuitMessage());
        filterData.put("player_name", player.getName());
        filterData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.leave", filterData)) {
            return;
        }
        
        // Build event message
        JsonObject eventData = new JsonObject();
        
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        
        JsonObject location = new JsonObject();
        location.addProperty("world", player.getWorld().getName());
        location.addProperty("x", player.getLocation().getX());
        location.addProperty("y", player.getLocation().getY());
        location.addProperty("z", player.getLocation().getZ());
        playerInfo.add("location", location);
        
        eventData.add("player", playerInfo);
        eventData.addProperty("quit_message", event.getQuitMessage());
        eventData.addProperty("player_count", plugin.getServer().getOnlinePlayers().size() - 1);
        
        connectionManager.sendEvent("player.leave", eventData);
        logger.info("Player left: " + player.getName());
    }
    
    /**
     * Handle player chat events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        if (event.isCancelled()) {
            return;
        }
        
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.chat")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        // Build filter data
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("message", event.getMessage());
        filterData.put("player_name", player.getName());
        filterData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.chat", filterData)) {
            return;
        }
        
        // Build event message
        JsonObject eventData = new JsonObject();
        
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        
        eventData.add("player", playerInfo);
        eventData.addProperty("message", event.getMessage());
        eventData.addProperty("format", event.getFormat());
        
        connectionManager.sendEvent("player.chat", eventData);
    }
    
    /**
     * Handle player death events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.death")) {
            return;
        }
        
        Player player = event.getEntity();
        
        // Build filter data
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("death_message", event.getDeathMessage());
        filterData.put("player_name", player.getName());
        filterData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.death", filterData)) {
            return;
        }
        
        // Build event message
        JsonObject eventData = new JsonObject();
        
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        
        JsonObject location = new JsonObject();
        location.addProperty("world", player.getWorld().getName());
        location.addProperty("x", player.getLocation().getX());
        location.addProperty("y", player.getLocation().getY());
        location.addProperty("z", player.getLocation().getZ());
        playerInfo.add("location", location);
        
        eventData.add("player", playerInfo);
        eventData.addProperty("death_message", event.getDeathMessage());
        eventData.addProperty("keep_inventory", event.getKeepInventory());
        eventData.addProperty("keep_level", event.getKeepLevel());
        eventData.addProperty("dropped_exp", event.getDroppedExp());
        
        // Add killer information if available
        if (player.getKiller() != null) {
            JsonObject killerInfo = new JsonObject();
            killerInfo.addProperty("id", player.getKiller().getUniqueId().toString());
            killerInfo.addProperty("name", player.getKiller().getName());
            eventData.add("killer", killerInfo);
        }
        
        connectionManager.sendEvent("player.death", eventData);
        logger.info("Player death: " + player.getName());
    }
    
    /**
     * Handle player advancement events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerAdvancement(PlayerAdvancementDoneEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.advancement")) {
            return;
        }
        
        Player player = event.getPlayer();
        String advancement = event.getAdvancement().getKey().toString();
        
        // Build filter data
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("advancement", advancement);
        filterData.put("player_name", player.getName());
        filterData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.advancement", filterData)) {
            return;
        }
        
        // Build event message
        JsonObject eventData = new JsonObject();
        
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        
        eventData.add("player", playerInfo);
        eventData.addProperty("advancement", advancement);
        
        connectionManager.sendEvent("player.advancement", eventData);
        logger.info("Player advancement: " + player.getName() + " - " + advancement);
    }
    
    /**
     * Handle player kick events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerKick(PlayerKickEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.kick")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        // Build filter data
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("kick_reason", event.getReason());
        filterData.put("player_name", player.getName());
        filterData.put("player_uuid", player.getUniqueId().toString());
        filterData.put("cancelled", event.isCancelled());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.kick", filterData)) {
            return;
        }
        
        // Build event message
        JsonObject eventData = new JsonObject();
        
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUniqueId().toString());
        playerInfo.addProperty("name", player.getName());
        playerInfo.addProperty("displayName", player.getDisplayName());
        
        eventData.add("player", playerInfo);
        eventData.addProperty("kick_reason", event.getReason());
        eventData.addProperty("leave_message", event.getLeaveMessage());
        eventData.addProperty("cancelled", event.isCancelled());
        
        connectionManager.sendEvent("player.kick", eventData);
        logger.info("Player kicked: " + player.getName() + " - " + event.getReason());
    }
}
