package com.mochilink.connector.nukkit.handlers;

import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.connection.NukkitConnectionManager;
import com.google.gson.JsonObject;

import cn.nukkit.Player;
import cn.nukkit.event.EventHandler;
import cn.nukkit.event.EventPriority;
import cn.nukkit.event.Listener;
import cn.nukkit.event.player.*;
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
        Player player = event.getPlayer();
        
        JsonObject data = new JsonObject();
        JsonObject playerObj = new JsonObject();
        playerObj.addProperty("id", player.getUniqueId().toString());
        playerObj.addProperty("name", player.getName());
        playerObj.addProperty("displayName", player.getDisplayName());
        data.add("player", playerObj);
        data.addProperty("firstJoin", !player.hasPlayedBefore());
        
        connectionManager.sendEvent("player.join", data);
        logger.info("Player joined: " + player.getName());
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getUniqueId().toString());
        data.addProperty("playerName", player.getName());
        data.addProperty("reason", "quit");
        
        connectionManager.sendEvent("player.leave", data);
        logger.info("Player left: " + player.getName());
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerChat(PlayerChatEvent event) {
        if (event.isCancelled()) return;
        
        Player player = event.getPlayer();
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getUniqueId().toString());
        data.addProperty("playerName", player.getName());
        data.addProperty("message", event.getMessage());
        
        connectionManager.sendEvent("player.chat", data);
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
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
        
        connectionManager.sendEvent("player.death", data);
        logger.info("Player died: " + player.getName());
    }
}
