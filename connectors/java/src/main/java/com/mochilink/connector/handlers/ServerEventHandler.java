package com.mochilink.connector.handlers;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.connection.ConnectionManager;
import com.mochilink.connector.protocol.UWBPv2Protocol;

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
 * 
 * Now includes subscription checking to only send events that are subscribed to.
 */
public class ServerEventHandler implements Listener {
    
    private final MochiLinkPlugin plugin;
    private final ConnectionManager connectionManager;
    private final Logger logger;
    
    public ServerEventHandler(MochiLinkPlugin plugin, ConnectionManager connectionManager) {
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
        
        // Check if there are any subscriptions for this event type
        if (!plugin.getSubscriptionManager().hasSubscription("player.join")) {
            return;  // No subscriptions, don't send
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("join_message", event.getJoinMessage());
        eventData.put("first_join", !player.hasPlayedBefore());
        eventData.put("player_count", plugin.getServer().getOnlinePlayers().size());
        eventData.put("player_name", player.getName());
        eventData.put("player_uuid", player.getUniqueId().toString());
        
        // Check if event data matches subscription filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.join", eventData)) {
            return;  // Doesn't match filters
        }
        
        sendPlayerEvent("player.join", player, eventData);
        
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
        
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.leave")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("quit_message", event.getQuitMessage());
        eventData.put("play_time", System.currentTimeMillis() - player.getFirstPlayed());
        eventData.put("player_count", plugin.getServer().getOnlinePlayers().size() - 1);
        eventData.put("player_name", player.getName());
        eventData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.leave", eventData)) {
            return;
        }
        
        sendPlayerEvent("player.leave", player, eventData);
        
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
        
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.chat")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("message", event.getMessage());
        eventData.put("format", event.getFormat());
        eventData.put("cancelled", event.isCancelled());
        eventData.put("player_name", player.getName());
        eventData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.chat", eventData)) {
            return;
        }
        
        sendPlayerEvent("player.chat", player, eventData);
        
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
        
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.death")) {
            return;
        }
        
        Player player = event.getEntity();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("death_message", event.getDeathMessage());
        eventData.put("keep_inventory", event.getKeepInventory());
        eventData.put("keep_level", event.getKeepLevel());
        eventData.put("dropped_exp", event.getDroppedExp());
        eventData.put("player_name", player.getName());
        eventData.put("player_uuid", player.getUniqueId().toString());
        
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
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.death", eventData)) {
            return;
        }
        
        sendPlayerEvent("player.death", player, eventData);
        
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
        
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.advancement")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("advancement", event.getAdvancement().getKey().toString());
        eventData.put("player_name", player.getName());
        eventData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.advancement", eventData)) {
            return;
        }
        
        sendPlayerEvent("player.advancement", player, eventData);
        
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
        
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("player.kick")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("kick_reason", event.getReason());
        eventData.put("leave_message", event.getLeaveMessage());
        eventData.put("cancelled", event.isCancelled());
        eventData.put("player_name", player.getName());
        eventData.put("player_uuid", player.getUniqueId().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.kick", eventData)) {
            return;
        }
        
        sendPlayerEvent("player.kick", player, eventData);
        
        if (plugin.getPluginConfig().isLogEvents()) {
            logger.info(String.format("Player kicked: %s - %s", player.getName(), event.getReason()));
        }
    }
    
    /**
     * Handle server load events
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onServerLoad(ServerLoadEvent event) {
        // Check subscription
        if (!plugin.getSubscriptionManager().hasSubscription("server.load")) {
            return;
        }
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("load_type", event.getType().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("server.load", eventData)) {
            return;
        }
        
        sendServerEvent("server.load", eventData);
        
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
            // Get protocol instance from connection manager
            UWBPv2Protocol protocol = connectionManager.getProtocol();
            if (protocol == null) {
                logger.warning("Protocol instance not available");
                return;
            }
            
            String message = protocol.createPlayerEventMessage(eventType, player, eventData);
            connectionManager.sendMessage(message);
            
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
            // Get protocol instance from connection manager
            UWBPv2Protocol protocol = connectionManager.getProtocol();
            if (protocol == null) {
                logger.warning("Protocol instance not available");
                return;
            }
            
            String message = protocol.createServerEventMessage(eventType, eventData);
            connectionManager.sendMessage(message);
            
        } catch (Exception e) {
            logger.warning("Failed to send server event: " + e.getMessage());
        }
    }
}
