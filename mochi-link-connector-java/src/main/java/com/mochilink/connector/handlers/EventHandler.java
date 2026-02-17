package com.mochilink.connector.handlers;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.connection.ConnectionManager;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.*;
import org.bukkit.event.server.ServerLoadEvent;
import org.bukkit.event.entity.PlayerDeathEvent;

import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Handles Minecraft server events and forwards them to the management server
 * 
 * Listens for various server events and converts them to U-WBP v2 protocol
 * messages for transmission to the Mochi-Link management system.
 */
public class EventHandler implements Listener {
    
    private final MochiLinkPlugin plugin;
    private final ConnectionManager connectionManager;
    private final Logger logger;
    
    public EventHandler(MochiLinkPlugin plugin, ConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    /**
     * Handle player join events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        if (!plugin.getPluginConfig().isSyncJoinLeave()) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("join_message", event.getJoinMessage());
        eventData.put("first_join", !player.hasPlayedBefore());
        eventData.put("player_count", plugin.getServer().getOnlinePlayers().size());
        
        sendPlayerEvent("player_join", player, eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info(String.format("Player joined: %s (%s)", player.getName(), player.getUniqueId()));
        }
    }
    
    /**
     * Handle player quit events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        if (!plugin.getPluginConfig().isSyncJoinLeave()) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("quit_message", event.getQuitMessage());
        eventData.put("play_time", System.currentTimeMillis() - player.getFirstPlayed());
        eventData.put("player_count", plugin.getServer().getOnlinePlayers().size() - 1);
        
        sendPlayerEvent("player_quit", player, eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info(String.format("Player quit: %s (%s)", player.getName(), player.getUniqueId()));
        }
    }
    
    /**
     * Handle player chat events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        if (!plugin.getPluginConfig().isSyncChat()) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("message", event.getMessage());
        eventData.put("format", event.getFormat());
        eventData.put("cancelled", event.isCancelled());
        
        sendPlayerEvent("player_chat", player, eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info(String.format("Player chat: %s: %s", player.getName(), event.getMessage()));
        }
    }
    
    /**
     * Handle player death events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        if (!plugin.getPluginConfig().isSyncDeath()) {
            return;
        }
        
        Player player = event.getEntity();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("death_message", event.getDeathMessage());
        eventData.put("keep_inventory", event.getKeepInventory());
        eventData.put("keep_level", event.getKeepLevel());
        eventData.put("dropped_exp", event.getDroppedExp());
        
        // Add killer information if available
        if (player.getKiller() != null) {
            eventData.put("killer", player.getKiller().getName());
            eventData.put("killer_uuid", player.getKiller().getUniqueId().toString());
        }
        
        // Add location information
        eventData.put("death_location", Map.of(
            "world", player.getWorld().getName(),
            "x", player.getLocation().getX(),
            "y", player.getLocation().getY(),
            "z", player.getLocation().getZ()
        ));
        
        sendPlayerEvent("player_death", player, eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info(String.format("Player death: %s at %s", player.getName(), player.getLocation()));
        }
    }
    
    /**
     * Handle player advancement events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerAdvancement(PlayerAdvancementDoneEvent event) {
        if (!plugin.getPluginConfig().isSyncAdvancement()) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("advancement", event.getAdvancement().getKey().toString());
        
        sendPlayerEvent("player_advancement", player, eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info(String.format("Player advancement: %s completed %s", 
                      player.getName(), event.getAdvancement().getKey()));
        }
    }
    
    /**
     * Handle player kick events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerKick(PlayerKickEvent event) {
        if (!plugin.getPluginConfig().isSyncJoinLeave()) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("kick_reason", event.getReason());
        eventData.put("leave_message", event.getLeaveMessage());
        eventData.put("cancelled", event.isCancelled());
        
        sendPlayerEvent("player_kick", player, eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info(String.format("Player kicked: %s - %s", player.getName(), event.getReason()));
        }
    }
    
    /**
     * Handle server load events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onServerLoad(ServerLoadEvent event) {
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("load_type", event.getType().toString());
        
        sendServerEvent("server_load", eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info("Server load event: " + event.getType());
        }
    }
    
    /**
     * Send player event to management server
     */
    private void sendPlayerEvent(String eventType, Player player, Map<String, Object> eventData) {
        if (!connectionManager.isConnected()) {
            return;
        }
        
        try {
            // This would need access to the protocol instance
            // For now, we'll just log the event
            logger.info(String.format("Player event: %s for %s", eventType, player.getName()));
            
        } catch (Exception e) {
            logger.warning("Failed to send player event: " + e.getMessage());
        }
    }
    
    /**
     * Send server event to management server
     */
    private void sendServerEvent(String eventType, Map<String, Object> eventData) {
        if (!connectionManager.isConnected()) {
            return;
        }
        
        try {
            // This would need access to the protocol instance
            // For now, we'll just log the event
            logger.info(String.format("Server event: %s", eventType));
            
        } catch (Exception e) {
            logger.warning("Failed to send server event: " + e.getMessage());
        }
    }
}