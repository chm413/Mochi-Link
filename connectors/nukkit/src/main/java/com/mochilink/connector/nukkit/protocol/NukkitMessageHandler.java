package com.mochilink.connector.nukkit.protocol;

import cn.nukkit.Player;
import cn.nukkit.Server;
import cn.nukkit.level.Level;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.connection.NukkitConnectionManager;

import java.util.UUID;
import java.util.logging.Level as LogLevel;
import java.util.logging.Logger;

/**
 * Nukkit Message Handler
 * Handles all incoming messages and operations for Nukkit servers
 */
public class NukkitMessageHandler {
    
    private final MochiLinkNukkitPlugin plugin;
    private final NukkitConnectionManager connectionManager;
    private final Server server;
    private final Logger logger;
    
    public NukkitMessageHandler(MochiLinkNukkitPlugin plugin, NukkitConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.server = plugin.getServer();
        this.logger = plugin.getLogger();
    }
    
    /**
     * Handle player list operation
     */
    public JsonObject handlePlayerList(String requestId) {
        try {
            JsonArray playersArray = new JsonArray();
            
            for (Player player : server.getOnlinePlayers().values()) {
                JsonObject playerObj = new JsonObject();
                playerObj.addProperty("id", player.getUniqueId().toString());
                playerObj.addProperty("name", player.getName());
                playerObj.addProperty("displayName", player.getDisplayName());
                playerObj.addProperty("world", player.getLevel().getName());
                
                JsonObject position = new JsonObject();
                position.addProperty("x", player.getX());
                position.addProperty("y", player.getY());
                position.addProperty("z", player.getZ());
                playerObj.add("position", position);
                
                playerObj.addProperty("ping", player.getPing());
                playerObj.addProperty("isOp", player.isOp());
                playerObj.addProperty("health", player.getHealth());
                playerObj.addProperty("foodLevel", player.getFoodData().getLevel());
                playerObj.addProperty("gameMode", player.getGamemode());
                playerObj.addProperty("edition", "Bedrock");
                
                playersArray.add(playerObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("players", playersArray);
            responseData.addProperty("online", playersArray.size());
            responseData.addProperty("max", server.getMaxPlayers());
            
            return createSuccessResponse(requestId, "player.list", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to get player list", e);
            return createErrorResponse(requestId, "player.list", e.getMessage());
        }
    }
    
    /**
     * Handle player info operation
     */
    public JsonObject handlePlayerInfo(String requestId, String playerId) {
        try {
            Player player = server.getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.info", "Player not found");
            }
            
            JsonObject playerInfo = new JsonObject();
            playerInfo.addProperty("id", player.getUniqueId().toString());
            playerInfo.addProperty("name", player.getName());
            playerInfo.addProperty("displayName", player.getDisplayName());
            playerInfo.addProperty("world", player.getLevel().getName());
            
            JsonObject position = new JsonObject();
            position.addProperty("x", player.getX());
            position.addProperty("y", player.getY());
            position.addProperty("z", player.getZ());
            playerInfo.add("position", position);
            
            playerInfo.addProperty("ping", player.getPing());
            playerInfo.addProperty("isOp", player.isOp());
            playerInfo.addProperty("health", player.getHealth());
            playerInfo.addProperty("maxHealth", player.getMaxHealth());
            playerInfo.addProperty("foodLevel", player.getFoodData().getLevel());
            playerInfo.addProperty("level", player.getExperienceLevel());
            playerInfo.addProperty("exp", player.getExperience());
            playerInfo.addProperty("gameMode", player.getGamemode());
            playerInfo.addProperty("isFlying", player.isFlying());
            playerInfo.addProperty("isSneaking", player.isSneaking());
            playerInfo.addProperty("isSprinting", player.isSprinting());
            playerInfo.addProperty("address", player.getAddress());
            playerInfo.addProperty("edition", "Bedrock");
            playerInfo.addProperty("deviceOS", player.getLoginChainData().getDeviceOS().name());
            
            JsonObject responseData = new JsonObject();
            responseData.add("player", playerInfo);
            
            return createSuccessResponse(requestId, "player.info", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to get player info", e);
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
            Player player = server.getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.kick", "Player not found");
            }
            
            String playerName = player.getName();
            final String kickReason = reason;
            
            // Kick on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                player.kick(kickReason);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            responseData.addProperty("reason", kickReason);
            
            return createSuccessResponse(requestId, "player.kick", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to kick player", e);
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
            Player player = server.getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.message", "Player not found");
            }
            
            String playerName = player.getName();
            
            // Send message on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                player.sendMessage(message);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "player.message", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to send message to player", e);
            return createErrorResponse(requestId, "player.message", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist list operation
     */
    public JsonObject handleWhitelistList(String requestId) {
        try {
            JsonArray whitelistArray = new JsonArray();
            
            for (String playerName : server.getWhitelist().getAll().keySet()) {
                JsonObject playerObj = new JsonObject();
                playerObj.addProperty("name", playerName);
                whitelistArray.add(playerObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("whitelist", whitelistArray);
            responseData.addProperty("enabled", server.hasWhitelist());
            responseData.addProperty("count", whitelistArray.size());
            
            return createSuccessResponse(requestId, "whitelist.list", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to get whitelist", e);
            return createErrorResponse(requestId, "whitelist.list", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist add operation
     */
    public JsonObject handleWhitelistAdd(String requestId, String playerName) {
        if (playerName == null || playerName.isEmpty()) {
            return createErrorResponse(requestId, "whitelist.add", "Missing playerName parameter");
        }
        
        try {
            server.getWhitelist().add(playerName);
            server.getWhitelist().reload();
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "whitelist.add", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to add to whitelist", e);
            return createErrorResponse(requestId, "whitelist.add", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist remove operation
     */
    public JsonObject handleWhitelistRemove(String requestId, String playerName) {
        if (playerName == null || playerName.isEmpty()) {
            return createErrorResponse(requestId, "whitelist.remove", "Missing playerName parameter");
        }
        
        try {
            server.getWhitelist().remove(playerName);
            server.getWhitelist().reload();
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "whitelist.remove", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to remove from whitelist", e);
            return createErrorResponse(requestId, "whitelist.remove", e.getMessage());
        }
    }
    
    /**
     * Handle command execute operation
     */
    public JsonObject handleCommandExecute(String requestId, String command) {
        if (command == null || command.isEmpty()) {
            return createErrorResponse(requestId, "command.execute", "Missing command parameter");
        }
        
        try {
            long startTime = System.currentTimeMillis();
            
            // Execute command on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                server.dispatchCommand(server.getConsoleSender(), command);
            });
            
            long executionTime = System.currentTimeMillis() - startTime;
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("command", command);
            responseData.addProperty("executionTime", executionTime);
            
            JsonArray output = new JsonArray();
            output.add("Command executed");
            responseData.add("output", output);
            
            return createSuccessResponse(requestId, "command.execute", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to execute command", e);
            return createErrorResponse(requestId, "command.execute", e.getMessage());
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
            serverInfo.addProperty("version", server.getVersion());
            serverInfo.addProperty("nukkitVersion", server.getNukkitVersion());
            serverInfo.addProperty("coreType", "Bedrock");
            serverInfo.addProperty("coreName", "Nukkit");
            serverInfo.addProperty("maxPlayers", server.getMaxPlayers());
            serverInfo.addProperty("onlinePlayers", server.getOnlinePlayers().size());
            serverInfo.addProperty("port", server.getPort());
            serverInfo.addProperty("ip", server.getIp());
            serverInfo.addProperty("motd", server.getMotd());
            serverInfo.addProperty("whitelistEnabled", server.hasWhitelist());
            
            JsonArray levelsArray = new JsonArray();
            for (Level level : server.getLevels().values()) {
                JsonObject levelObj = new JsonObject();
                levelObj.addProperty("name", level.getName());
                levelObj.addProperty("dimension", level.getDimension());
                levelObj.addProperty("difficulty", level.getDifficulty());
                levelObj.addProperty("playerCount", level.getPlayers().size());
                levelsArray.add(levelObj);
            }
            serverInfo.add("levels", levelsArray);
            
            JsonObject responseData = new JsonObject();
            responseData.add("info", serverInfo);
            
            return createSuccessResponse(requestId, "server.info", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to get server info", e);
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
            statusData.addProperty("uptime", System.currentTimeMillis() - server.getStartTime());
            
            JsonObject playersData = new JsonObject();
            playersData.addProperty("online", server.getOnlinePlayers().size());
            playersData.addProperty("max", server.getMaxPlayers());
            statusData.add("players", playersData);
            
            JsonObject performanceData = new JsonObject();
            performanceData.addProperty("tps", server.getTicksPerSecond());
            performanceData.addProperty("tickUsage", server.getTickUsage());
            
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
            logger.log(LogLevel.WARNING, "Failed to get server status", e);
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
            server.getScheduler().scheduleTask(plugin, () -> {
                server.broadcastMessage(broadcastMessage);
            });
            
            // Schedule restart
            server.getScheduler().scheduleDelayedTask(plugin, () -> {
                server.shutdown();
            }, delay * 20);
            
            return createSuccessResponse(requestId, "server.restart", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to restart server", e);
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
            server.getScheduler().scheduleTask(plugin, () -> {
                server.broadcastMessage(broadcastMessage);
            });
            
            // Schedule stop
            server.getScheduler().scheduleDelayedTask(plugin, () -> {
                server.shutdown();
            }, delay * 20);
            
            return createSuccessResponse(requestId, "server.stop", responseData);
            
        } catch (Exception e) {
            logger.log(LogLevel.WARNING, "Failed to stop server", e);
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
