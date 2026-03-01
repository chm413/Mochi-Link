package com.mochilink.connector.fabric.handlers;

import com.mochilink.connector.fabric.MochiLinkFabricMod;
import com.mochilink.connector.fabric.connection.FabricConnectionManager;
import com.google.gson.JsonObject;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.minecraft.server.network.ServerPlayerEntity;
import org.slf4j.Logger;

import java.util.HashMap;
import java.util.Map;

/**
 * Handles Fabric server events and forwards them to management server
 * Implements U-WBP v2 event protocol
 */
public class FabricEventHandler {
    
    private final MochiLinkFabricMod mod;
    private final FabricConnectionManager connectionManager;
    private final Logger logger;
    
    public FabricEventHandler(MochiLinkFabricMod mod, FabricConnectionManager connectionManager) {
        this.mod = mod;
        this.connectionManager = connectionManager;
        this.logger = MochiLinkFabricMod.getLogger();
        
        registerEvents();
    }
    
    /**
     * Register all event listeners
     */
    private void registerEvents() {
        // Player join event
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            onPlayerJoin(handler.getPlayer());
        });
        
        // Player disconnect event
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            onPlayerLeave(handler.getPlayer());
        });
        
        // Chat message event
        ServerMessageEvents.CHAT_MESSAGE.register((message, sender, params) -> {
            onPlayerChat(sender, message.getContent().getString());
        });
        
        // Server started event
        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            mod.setServer(server);
            onServerStarted();
        });
        
        // Server stopping event
        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            onServerStopping();
            mod.setServer(null);
        });
    }
    
    /**
     * Handle player join event
     */
    private void onPlayerJoin(ServerPlayerEntity player) {
        // Check subscription
        if (!mod.getSubscriptionManager().hasSubscription("player.join")) {
            return;
        }
        
        JsonObject data = new JsonObject();
        
        // Player info
        JsonObject playerInfo = new JsonObject();
        playerInfo.addProperty("id", player.getUuidAsString());
        playerInfo.addProperty("name", player.getName().getString());
        playerInfo.addProperty("displayName", player.getDisplayName().getString());
        data.add("player", playerInfo);
        
        // Additional data
        data.addProperty("firstJoin", false); // Fabric doesn't easily track this
        
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
    private void onPlayerLeave(ServerPlayerEntity player) {
        // Check subscription
        if (!mod.getSubscriptionManager().hasSubscription("player.leave")) {
            return;
        }
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getUuidAsString());
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
    private void onPlayerChat(ServerPlayerEntity player, String message) {
        // Check subscription
        if (!mod.getSubscriptionManager().hasSubscription("player.chat")) {
            return;
        }
        
        JsonObject data = new JsonObject();
        data.addProperty("playerId", player.getUuidAsString());
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
    private void onServerStarted() {
        // Check subscription
        if (!mod.getSubscriptionManager().hasSubscription("server.start")) {
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
    private void onServerStopping() {
        // Check subscription
        if (!mod.getSubscriptionManager().hasSubscription("server.stop")) {
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
    }
}
