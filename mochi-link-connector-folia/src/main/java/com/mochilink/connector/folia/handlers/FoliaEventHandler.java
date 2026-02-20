package com.mochilink.connector.folia.handlers;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.connection.FoliaConnectionManager;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.*;
import org.bukkit.event.entity.PlayerDeathEvent;

import java.util.logging.Logger;

/**
 * Handles Folia server events and forwards them to management server
 * Adapted for Folia's region-based threading model
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
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        String message = String.format("Player %s joined the server", player.getName());
        connectionManager.sendMessage(message);
        logger.info(message);
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        String message = String.format("Player %s left the server", player.getName());
        connectionManager.sendMessage(message);
        logger.info(message);
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        if (event.isCancelled()) return;
        
        Player player = event.getPlayer();
        String chatMessage = event.getMessage();
        String message = String.format("Player %s: %s", player.getName(), chatMessage);
        connectionManager.sendMessage(message);
    }
    
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player player = event.getEntity();
        String deathMessage = event.getDeathMessage();
        String message = String.format("Player death: %s", deathMessage);
        connectionManager.sendMessage(message);
        logger.info(message);
    }
}
