package com.mochilink.connector.forge.handlers;

import com.mochilink.connector.forge.MochiLinkForgeMod;
import com.mochilink.connector.forge.connection.ForgeConnectionManager;
import com.google.gson.JsonObject;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.ServerChatEvent;
import net.minecraftforge.event.server.ServerStartedEvent;
import net.minecraftforge.event.server.ServerStoppingEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraft.server.level.ServerPlayer;
import org.slf4j.Logger;

import java.util.HashMap;
import java.util.Map;

/**
 * Handles Forge server events and forwards them to management server
 * Implements U-WBP v2 event protocol
 */
@Mod.EventBusSubscriber(modid = MochiLinkForgeMod.MOD_ID)
public class ForgeEventHandler {
    
    private static MochiLinkForgeMod mod;
    private static ForgeConnectionManager connectionManager;
    private static Logger logger;
    
    public ForgeEventHandler(MochiLinkForgeMod mod, ForgeConnectionManager connectionManager) {
        ForgeEventHandler.mod = mod;
        ForgeEventHandler.connectionManager = connectionManager;
        ForgeEventHandler.logger = MochiLinkForgeMod.getLogger();
    }
    
    /**
     * Handle player join event
     */
    @SubscribeEvent
    public static void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event) {
        if (mod == null || !mod.getSubscriptionManager().hasSubscription("player.join")) {
            return;
        }
        
        ServerPlayer player = (ServerPlayer) event.getEntity();
        
        JsonObject data = new JsonObject();
        
        // Player info
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getStringUUID());
        playerInfo.addProperty("name", player.getName().getString());
        playerInfo.addProperty("displayName", player.getDisplayName().getString());
        data.add("player", playerInfo);
        
        // Additional data
        data.addProperty("firstJoin", false); // Forge doesn't easily track this
        
        // Check filters
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("firstJoin", false);
        
        if (!mod.getSubscriptionManager().matchesFilters("player.join", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("player.join", data);
        logger.info("Player joined: {}", player.getName().getString());
    }
    
    /**
     * Handle player leave event
     */
    @SubscribeEvent
    public static void onPlayerLeave(PlayerEvent.PlayerLoggedOutEvent event) {
        if (mod == null || !mod.getSubscriptionManager().hasSubscription("player.leave")) {
            return;
        }
        
        ServerPlayer player = (ServerPlayer) event.getEntity();
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getStringUUID());
        data.addProperty("playerName", player.getName().getString());
        data.addProperty("reason", "disconnect");
        
        // Check filters
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("reason", "disconnect");
        
        if (!mod.getSubscriptionManager().matchesFilters("player.leave", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("player.leave", data);
        logger.info("Player left: {}", player.getName().getString());
    }
    
    /**
     * Handle player chat event
     */
    @SubscribeEvent
    public static void onPlayerChat(ServerChatEvent event) {
        if (mod == null || !mod.getSubscriptionManager().hasSubscription("player.chat")) {
            return;
        }
        
        ServerPlayer player = event.getPlayer();
        String message = event.getMessage().getString();
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getStringUUID());
        data.addProperty("playerName", player.getName().getString());
        data.addProperty("message", message);
        
        // Check filters
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("message", message);
        
        if (!mod.getSubscriptionManager().matchesFilters("player.chat", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("player.chat", data);
    }
    
    /**
     * Handle server started event
     */
    @SubscribeEvent
    public static void onServerStarted(ServerStartedEvent event) {
        // Set server instance
        if (mod != null) {
            mod.setServer(event.getServer());
        }
        
        if (mod == null || !mod.getSubscriptionManager().hasSubscription("server.start")) {
            return;
        }
        
        JsonObject data = new JsonObject();
        data.addProperty("status", "started");
        
        // Check filters
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("status", "started");
        
        if (!mod.getSubscriptionManager().matchesFilters("server.start", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("server.start", data);
        logger.info("Server started event sent");
    }
    
    /**
     * Handle server stopping event
     */
    @SubscribeEvent
    public static void onServerStopping(ServerStoppingEvent event) {
        if (mod == null || !mod.getSubscriptionManager().hasSubscription("server.stop")) {
            return;
        }
        
        JsonObject data = new JsonObject();
        data.addProperty("status", "stopping");
        
        // Check filters
        Map<String, Object> filterData = new HashMap<>();
        filterData.put("status", "stopping");
        
        if (!mod.getSubscriptionManager().matchesFilters("server.stop", filterData)) {
            return;
        }
        
        connectionManager.sendEvent("server.stop", data);
        logger.info("Server stopping event sent");
        
        // Clear server instance
        if (mod != null) {
            mod.setServer(null);
        }
    }
}
