package com.mochilink.connector.handlers;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.connection.ConnectionManager;
import com.mochilink.connector.protocol.UWBPv2Protocol;

import org.bukkit.entity.Player;
import org.bukkit.Statistic;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerKickEvent;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.event.server.ServerLoadEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.entity.EntityDamageEvent;

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
        eventData.put("joinMessage", event.getJoinMessage());
        eventData.put("firstJoin", !player.hasPlayedBefore());
        eventData.put("playerCount", plugin.getServer().getOnlinePlayers().size());
        
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
        eventData.put("quitMessage", event.getQuitMessage());
        eventData.put("playTime", getPlayTimeMillis(player));
        eventData.put("playerCount", Math.max(0, plugin.getServer().getOnlinePlayers().size() - 1));
        eventData.put("playerId", player.getUniqueId().toString());
        eventData.put("playerName", player.getName());
        eventData.put("reason", "quit");
        
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
        eventData.put("playerId", player.getUniqueId().toString());
        eventData.put("playerName", player.getName());
        
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
        eventData.put("deathMessage", event.getDeathMessage());
        eventData.put("keepInventory", event.getKeepInventory());
        eventData.put("keepLevel", event.getKeepLevel());
        eventData.put("droppedExp", event.getDroppedExp());
        eventData.put("playerId", player.getUniqueId().toString());
        eventData.put("playerName", player.getName());
        EntityDamageEvent lastDamage = player.getLastDamageCause();
        eventData.put("cause", lastDamage == null
            ? "unknown"
            : lastDamage.getCause().name().toLowerCase());
        
        // Add killer information if available
        if (player.getKiller() != null) {
            eventData.put("killer", player.getKiller().getName());
            eventData.put("killerId", player.getKiller().getUniqueId().toString());
        }
        
        // Add location information
        eventData.put("location", Map.of(
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
        eventData.put("playerId", player.getUniqueId().toString());
        eventData.put("playerName", player.getName());
        
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
        
        // A kick is represented by the canonical player.leave event.
        if (!plugin.getSubscriptionManager().hasSubscription("player.leave")) {
            return;
        }
        
        Player player = event.getPlayer();
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("kickReason", event.getReason());
        eventData.put("leaveMessage", event.getLeaveMessage());
        eventData.put("cancelled", event.isCancelled());
        eventData.put("playerId", player.getUniqueId().toString());
        eventData.put("playerName", player.getName());
        eventData.put("reason", "kick");
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("player.leave", eventData)) {
            return;
        }
        
        // U-WBP has no player.kick event; represent a kick as a leave with a
        // canonical reason while retaining the source event in the payload.
        eventData.put("sourceEvent", "player.kick");
        sendPlayerEvent("player.leave", player, eventData);
        
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
        if (!plugin.getSubscriptionManager().hasSubscription("server.status")) {
            return;
        }
        
        Map<String, Object> eventData = new HashMap<>();
        eventData.put("loadType", event.getType().toString());
        
        // Check filters
        if (!plugin.getSubscriptionManager().matchesFilters("server.status", eventData)) {
            return;
        }
        
        // U-WBP has no server.load event; publish the canonical status event.
        eventData.put("sourceEvent", "server.load");
        eventData.put("status", "online");
        sendServerEvent("server.status", eventData);
        
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

    /** Bukkit exposes total played ticks; convert the documented value to milliseconds. */
    private long getPlayTimeMillis(Player player) {
        try {
            return Math.max(0L, (long) player.getStatistic(Statistic.PLAY_ONE_MINUTE) * 50L);
        } catch (RuntimeException ignored) {
            return 0L;
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
