package com.mochilink.connector.folia.protocol;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.connection.FoliaConnectionManager;
import io.papermc.paper.threadedregions.scheduler.ScheduledTask;
import org.bukkit.entity.Player;

import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Folia Message Handler
 * Handles all incoming messages and operations for Folia servers
 */
public class FoliaMessageHandler {
    
    private final MochiLinkFoliaPlugin plugin;
    private final FoliaConnectionManager connectionManager;
    private final Logger logger;
    
    public FoliaMessageHandler(MochiLinkFoliaPlugin plugin, FoliaConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    /**
     * Handle player list operation
     */
    public JsonObject handlePlayerList(String requestId) {
        try {
            JsonArray playersArray = new JsonArray();
            
            for (Player player : plugin.getServer().getOnlinePlayers()) {
                JsonObject playerObj = new JsonObject();
                playerObj.addProperty("id", player.getUniqueId().toString());
                playerObj.addProperty("name", player.getName());
                playerObj.addProperty("displayName", player.getDisplayName());
                playerObj.addProperty("world", player.getWorld().getName());
                
                JsonObject position = new JsonObject();
                position.addProperty("x", player.getLocation().getX());
                position.addProperty("y", player.getLocation().getY());
                position.addProperty("z", player.getLocation().getZ());
                playerObj.add("position", position);
                
                playerObj.addProperty("ping", player.getPing());
                playerObj.addProperty("isOp", player.isOp());
                playerObj.addProperty("health", player.getHealth());
                playerObj.addProperty("foodLevel", player.getFoodLevel());
                playerObj.addProperty("gameMode", player.getGameMode().name());
                
                playersArray.add(playerObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("players", playersArray);
            responseData.addProperty("online", playersArray.size());
            responseData.addProperty("max", plugin.getServer().getMaxPlayers());
            
            return createSuccessResponse(requestId, "player.list", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get player list", e);
            return createErrorResponse(requestId, "player.list", e.getMessage());
        }
    }
    
    /**
     * Handle player info operation
     */
    public JsonObject handlePlayerInfo(String requestId, String playerId) {
        try {
            Player player = plugin.getServer().getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.info", "Player not found");
            }
            
            JsonObject playerInfo = new JsonObject();
            playerInfo.addProperty("id", player.getUniqueId().toString());
            playerInfo.addProperty("name", player.getName());
            playerInfo.addProperty("displayName", player.getDisplayName());
            playerInfo.addProperty("world", player.getWorld().getName());
            
            JsonObject position = new JsonObject();
            position.addProperty("x", player.getLocation().getX());
            position.addProperty("y", player.getLocation().getY());
            position.addProperty("z", player.getLocation().getZ());
            playerInfo.add("position", position);
            
            playerInfo.addProperty("ping", player.getPing());
            playerInfo.addProperty("isOp", player.isOp());
            playerInfo.addProperty("health", player.getHealth());
            playerInfo.addProperty("maxHealth", player.getMaxHealth());
            playerInfo.addProperty("foodLevel", player.getFoodLevel());
            playerInfo.addProperty("level", player.getLevel());
            playerInfo.addProperty("exp", player.getExp());
            playerInfo.addProperty("gameMode", player.getGameMode().name());
            playerInfo.addProperty("isFlying", player.isFlying());
            playerInfo.addProperty("isSneaking", player.isSneaking());
            playerInfo.addProperty("isSprinting", player.isSprinting());
            playerInfo.addProperty("address", player.getAddress() != null ? player.getAddress().getHostString() : "unknown");
            
            JsonObject responseData = new JsonObject();
            responseData.add("player", playerInfo);
            
            return createSuccessResponse(requestId, "player.info", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get player info", e);
            return createErrorResponse(requestId, "player.info", e.getMessage());
        }
    }
    
    /**
     * Handle player kick operation
     */
    public JsonObject handlePlayerKick(String requestId, String playerId, String reason) {
        if (reason == null || reason.isEmpty()) {
            reason = "Kicked by administrator";
        }
        
        try {
            Player player = plugin.getServer().getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.kick", "Player not found");
            }
            
            String playerName = player.getName();
            final String kickReason = reason;
            
            // Kick on player's region thread
            player.getScheduler().run(plugin, (ScheduledTask task) -> {
                player.kick(net.kyori.adventure.text.Component.text(kickReason));
            }, null);
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            responseData.addProperty("reason", kickReason);
            
            return createSuccessResponse(requestId, "player.kick", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to kick player", e);
            return createErrorResponse(requestId, "player.kick", e.getMessage());
        }
    }
    
    /**
     * Handle player message operation
     */
    public JsonObject handlePlayerMessage(String requestId, String playerId, String message) {
        if (message == null || message.isEmpty()) {
            return createErrorResponse(requestId, "player.message", "Missing message parameter");
        }
        
        try {
            Player player = plugin.getServer().getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.message", "Player not found");
            }
            
            String playerName = player.getName();
            
            // Send message on player's region thread
            player.getScheduler().run(plugin, (ScheduledTask task) -> {
                player.sendMessage(message);
            }, null);
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "player.message", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send message to player", e);
            return createErrorResponse(requestId, "player.message", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist list operation
     */
    public JsonObject handleWhitelistList(String requestId) {
        try {
            JsonArray whitelistArray = new JsonArray();
            
            for (org.bukkit.OfflinePlayer player : plugin.getServer().getWhitelistedPlayers()) {
                JsonObject playerObj = new JsonObject();
                playerObj.addProperty("id", player.getUniqueId().toString());
                playerObj.addProperty("name", player.getName());
                whitelistArray.add(playerObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("whitelist", whitelistArray);
            responseData.addProperty("enabled", plugin.getServer().hasWhitelist());
            responseData.addProperty("count", whitelistArray.size());
            
            return createSuccessResponse(requestId, "whitelist.list", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get whitelist", e);
            return createErrorResponse(requestId, "whitelist.list", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist add operation
     */
    public JsonObject handleWhitelistAdd(String requestId, String playerName, String playerId) {
        try {
            org.bukkit.OfflinePlayer player;
            
            if (playerId != null && !playerId.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(UUID.fromString(playerId));
            } else if (playerName != null && !playerName.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(playerName);
            } else {
                return createErrorResponse(requestId, "whitelist.add", "Missing playerName or playerId parameter");
            }
            
            player.setWhitelisted(true);
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", player.getName());
            responseData.addProperty("playerId", player.getUniqueId().toString());
            
            return createSuccessResponse(requestId, "whitelist.add", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to add to whitelist", e);
            return createErrorResponse(requestId, "whitelist.add", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist remove operation
     */
    public JsonObject handleWhitelistRemove(String requestId, String playerName, String playerId) {
        try {
            org.bukkit.OfflinePlayer player;
            
            if (playerId != null && !playerId.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(UUID.fromString(playerId));
            } else if (playerName != null && !playerName.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(playerName);
            } else {
                return createErrorResponse(requestId, "whitelist.remove", "Missing playerName or playerId parameter");
            }
            
            player.setWhitelisted(false);
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", player.getName());
            responseData.addProperty("playerId", player.getUniqueId().toString());
            
            return createSuccessResponse(requestId, "whitelist.remove", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to remove from whitelist", e);
            return createErrorResponse(requestId, "whitelist.remove", e.getMessage());
        }
    }
    
    /**
     * Handle server info operation
     */
    public JsonObject handleServerInfo(String requestId) {
        try {
            JsonObject serverInfo = new JsonObject();
            serverInfo.addProperty("serverId", plugin.getPluginConfig().getServerId());
            serverInfo.addProperty("name", plugin.getPluginConfig().getServerName());
            serverInfo.addProperty("version", plugin.getServer().getVersion());
            serverInfo.addProperty("bukkitVersion", plugin.getServer().getBukkitVersion());
            serverInfo.addProperty("coreType", "Java");
            serverInfo.addProperty("coreName", "Folia");
            serverInfo.addProperty("maxPlayers", plugin.getServer().getMaxPlayers());
            serverInfo.addProperty("onlinePlayers", plugin.getServer().getOnlinePlayers().size());
            serverInfo.addProperty("port", plugin.getServer().getPort());
            serverInfo.addProperty("ip", plugin.getServer().getIp());
            serverInfo.addProperty("motd", plugin.getServer().getMotd());
            serverInfo.addProperty("whitelistEnabled", plugin.getServer().hasWhitelist());
            serverInfo.addProperty("onlineMode", plugin.getServer().getOnlineMode());
            
            JsonArray worldsArray = new JsonArray();
            for (org.bukkit.World world : plugin.getServer().getWorlds()) {
                JsonObject worldObj = new JsonObject();
                worldObj.addProperty("name", world.getName());
                worldObj.addProperty("environment", world.getEnvironment().name());
                worldObj.addProperty("difficulty", world.getDifficulty().name());
                worldObj.addProperty("playerCount", world.getPlayers().size());
                worldsArray.add(worldObj);
            }
            serverInfo.add("worlds", worldsArray);
            
            JsonObject responseData = new JsonObject();
            responseData.add("info", serverInfo);
            
            return createSuccessResponse(requestId, "server.info", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get server info", e);
            return createErrorResponse(requestId, "server.info", e.getMessage());
        }
    }
    
    /**
     * Handle server status operation
     */
    public JsonObject handleServerStatus(String requestId) {
        try {
            JsonObject statusData = new JsonObject();
            statusData.addProperty("status", "online");
            statusData.addProperty("uptime", System.currentTimeMillis() - plugin.getServer().getStartTime());
            
            JsonObject playersData = new JsonObject();
            playersData.addProperty("online", plugin.getServer().getOnlinePlayers().size());
            playersData.addProperty("max", plugin.getServer().getMaxPlayers());
            statusData.add("players", playersData);
            
            JsonObject performanceData = new JsonObject();
            performanceData.addProperty("tps", plugin.getServer().getTPS()[0]);
            
            Runtime runtime = Runtime.getRuntime();
            long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
            long maxMemory = runtime.maxMemory() / 1024 / 1024;
            performanceData.addProperty("memoryUsage", usedMemory);
            performanceData.addProperty("memoryMax", maxMemory);
            performanceData.addProperty("memoryPercent", (double) usedMemory / maxMemory * 100);
            statusData.add("performance", performanceData);
            
            JsonObject responseData = new JsonObject();
            responseData.add("status", statusData);
            
            return createSuccessResponse(requestId, "server.status", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get server status", e);
            return createErrorResponse(requestId, "server.status", e.getMessage());
        }
    }
    
    /**
     * Handle server restart operation
     */
    public JsonObject handleServerRestart(String requestId, int delay) {
        try {
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will restart in " + delay + " seconds");
            
            // Broadcast to all players
            final String broadcastMessage = "§c[Mochi-Link] Server will restart in " + delay + " seconds!";
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                plugin.getServer().broadcast(net.kyori.adventure.text.Component.text(broadcastMessage));
            });
            
            // Schedule restart
            plugin.getServer().getGlobalRegionScheduler().runDelayed(plugin, (ScheduledTask task) -> {
                try {
                    plugin.getServer().spigot().restart();
                } catch (Exception e) {
                    logger.log(Level.SEVERE, "Failed to restart server", e);
                    plugin.getServer().shutdown();
                }
            }, delay * 20L);
            
            return createSuccessResponse(requestId, "server.restart", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to restart server", e);
            return createErrorResponse(requestId, "server.restart", e.getMessage());
        }
    }
    
    /**
     * Handle server stop operation
     */
    public JsonObject handleServerStop(String requestId, int delay) {
        try {
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will stop in " + delay + " seconds");
            
            // Broadcast to all players
            final String broadcastMessage = "§c[Mochi-Link] Server will stop in " + delay + " seconds!";
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                plugin.getServer().broadcast(net.kyori.adventure.text.Component.text(broadcastMessage));
            });
            
            // Schedule stop
            plugin.getServer().getGlobalRegionScheduler().runDelayed(plugin, (ScheduledTask task) -> {
                plugin.getServer().shutdown();
            }, delay * 20L);
            
            return createSuccessResponse(requestId, "server.stop", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to stop server", e);
            return createErrorResponse(requestId, "server.stop", e.getMessage());
        }
    }
    
    /**
     * Create success response
     */
    private JsonObject createSuccessResponse(String requestId, String op, JsonObject data) {
        JsonObject response = new JsonObject();
        response.addProperty("type", "response");
        response.addProperty("id", requestId);
        response.addProperty("op", op);
        response.addProperty("timestamp", java.time.Instant.now().toString());
        response.addProperty("version", "2.0");
        response.add("data", data);
        return response;
    }
    
    /**
     * Create error response
     */
    private JsonObject createErrorResponse(String requestId, String op, String error) {
        JsonObject response = new JsonObject();
        response.addProperty("type", "response");
        response.addProperty("id", requestId);
        response.addProperty("op", op);
        response.addProperty("timestamp", java.time.Instant.now().toString());
        response.addProperty("version", "2.0");
        
        JsonObject data = new JsonObject();
        data.addProperty("success", false);
        data.addProperty("error", error);
        response.add("data", data);
        
        return response;
    }
}
