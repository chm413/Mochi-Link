package com.mochilink.connector.forge.protocol;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mochilink.connector.forge.MochiLinkForgeMod;
import com.mochilink.connector.forge.connection.ForgeConnectionManager;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;
import org.slf4j.Logger;

import java.util.UUID;

/**
 * Forge Message Handler
 * Handles all incoming messages and operations for Forge servers
 */
public class ForgeMessageHandler {
    
    private final MochiLinkForgeMod mod;
    private final ForgeConnectionManager connectionManager;
    private final Logger logger;
    
    public ForgeMessageHandler(MochiLinkForgeMod mod, ForgeConnectionManager connectionManager) {
        this.mod = mod;
        this.connectionManager = connectionManager;
        this.logger = MochiLinkForgeMod.getLogger();
    }
    
    /**
     * Handle player list operation
     */
    public JsonObject handlePlayerList(String requestId) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "player.list", "Server not available");
            }
            
            JsonArray playersArray = new JsonArray();
            
            for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                JsonObject playerObj = new JsonObject();
                playerObj.addProperty("id", player.getStringUUID());
                playerObj.addProperty("name", player.getName().getString());
                playerObj.addProperty("displayName", player.getDisplayName().getString());
                playerObj.addProperty("world", player.level().dimension().location().toString());
                
                JsonObject position = new JsonObject();
                position.addProperty("x", player.getX());
                position.addProperty("y", player.getY());
                position.addProperty("z", player.getZ());
                playerObj.add("position", position);
                
                playerObj.addProperty("ping", player.latency);
                playerObj.addProperty("isOp", server.getPlayerList().isOp(player.getGameProfile()));
                playerObj.addProperty("health", player.getHealth());
                playerObj.addProperty("foodLevel", player.getFoodData().getFoodLevel());
                playerObj.addProperty("gameMode", player.gameMode.getGameModeForPlayer().getName());
                
                playersArray.add(playerObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("players", playersArray);
            responseData.addProperty("online", playersArray.size());
            responseData.addProperty("max", server.getMaxPlayers());
            
            return createSuccessResponse(requestId, "player.list", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to get player list", e);
            return createErrorResponse(requestId, "player.list", e.getMessage());
        }
    }
    
    /**
     * Handle player info operation
     */
    public JsonObject handlePlayerInfo(String requestId, String playerId) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "player.info", "Server not available");
            }
            
            ServerPlayer player = server.getPlayerList().getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.info", "Player not found");
            }
            
            JsonObject playerInfo = new JsonObject();
            playerInfo.addProperty("id", player.getStringUUID());
            playerInfo.addProperty("name", player.getName().getString());
            playerInfo.addProperty("displayName", player.getDisplayName().getString());
            playerInfo.addProperty("world", player.level().dimension().location().toString());
            
            JsonObject position = new JsonObject();
            position.addProperty("x", player.getX());
            position.addProperty("y", player.getY());
            position.addProperty("z", player.getZ());
            playerInfo.add("position", position);
            
            playerInfo.addProperty("ping", player.latency);
            playerInfo.addProperty("isOp", server.getPlayerList().isOp(player.getGameProfile()));
            playerInfo.addProperty("health", player.getHealth());
            playerInfo.addProperty("maxHealth", player.getMaxHealth());
            playerInfo.addProperty("foodLevel", player.getFoodData().getFoodLevel());
            playerInfo.addProperty("level", player.experienceLevel);
            playerInfo.addProperty("exp", player.experienceProgress);
            playerInfo.addProperty("gameMode", player.gameMode.getGameModeForPlayer().getName());
            playerInfo.addProperty("isFlying", player.getAbilities().flying);
            playerInfo.addProperty("isSneaking", player.isCrouching());
            playerInfo.addProperty("isSprinting", player.isSprinting());
            playerInfo.addProperty("address", player.getIpAddress());
            
            JsonObject responseData = new JsonObject();
            responseData.add("player", playerInfo);
            
            return createSuccessResponse(requestId, "player.info", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to get player info", e);
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
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "player.kick", "Server not available");
            }
            
            ServerPlayer player = server.getPlayerList().getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.kick", "Player not found");
            }
            
            String playerName = player.getName().getString();
            final String kickReason = reason;
            
            // Kick player on server thread
            server.execute(() -> {
                player.connection.disconnect(Component.literal(kickReason));
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            responseData.addProperty("reason", kickReason);
            
            return createSuccessResponse(requestId, "player.kick", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to kick player", e);
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
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "player.message", "Server not available");
            }
            
            ServerPlayer player = server.getPlayerList().getPlayer(UUID.fromString(playerId));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.message", "Player not found");
            }
            
            String playerName = player.getName().getString();
            
            // Send message on server thread
            server.execute(() -> {
                player.sendSystemMessage(Component.literal(message));
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "player.message", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to send message to player", e);
            return createErrorResponse(requestId, "player.message", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist list operation
     */
    public JsonObject handleWhitelistList(String requestId) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "whitelist.list", "Server not available");
            }
            
            JsonArray whitelistArray = new JsonArray();
            
            for (String playerName : server.getPlayerList().getWhiteListNames()) {
                JsonObject playerObj = new JsonObject();
                playerObj.addProperty("name", playerName);
                whitelistArray.add(playerObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("whitelist", whitelistArray);
            responseData.addProperty("enabled", server.getPlayerList().isUsingWhitelist());
            responseData.addProperty("count", whitelistArray.size());
            
            return createSuccessResponse(requestId, "whitelist.list", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to get whitelist", e);
            return createErrorResponse(requestId, "whitelist.list", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist add operation
     */
    public JsonObject handleWhitelistAdd(String requestId, String playerName, String playerId) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "whitelist.add", "Server not available");
            }
            
            if (playerName == null || playerName.isEmpty()) {
                return createErrorResponse(requestId, "whitelist.add", "Missing playerName parameter");
            }
            
            // Add to whitelist on server thread
            server.execute(() -> {
                try {
                    server.getCommands().performPrefixedCommand(
                        server.createCommandSourceStack(),
                        "whitelist add " + playerName
                    );
                } catch (Exception e) {
                    logger.error("Failed to add to whitelist", e);
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "whitelist.add", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to add to whitelist", e);
            return createErrorResponse(requestId, "whitelist.add", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist remove operation
     */
    public JsonObject handleWhitelistRemove(String requestId, String playerName, String playerId) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "whitelist.remove", "Server not available");
            }
            
            if (playerName == null || playerName.isEmpty()) {
                return createErrorResponse(requestId, "whitelist.remove", "Missing playerName parameter");
            }
            
            // Remove from whitelist on server thread
            server.execute(() -> {
                try {
                    server.getCommands().performPrefixedCommand(
                        server.createCommandSourceStack(),
                        "whitelist remove " + playerName
                    );
                } catch (Exception e) {
                    logger.error("Failed to remove from whitelist", e);
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "whitelist.remove", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to remove from whitelist", e);
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
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "command.execute", "Server not available");
            }
            
            logger.info("Executing command: {}", command);
            
            // Execute command on server thread
            server.execute(() -> {
                try {
                    server.getCommands().performPrefixedCommand(
                        server.createCommandSourceStack(),
                        command
                    );
                } catch (Exception e) {
                    logger.error("Failed to execute command", e);
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("command", command);
            responseData.addProperty("message", "Command executed successfully");
            
            return createSuccessResponse(requestId, "command.execute", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to execute command", e);
            return createErrorResponse(requestId, "command.execute", e.getMessage());
        }
    }
    
    /**
     * Handle server info operation
     */
    public JsonObject handleServerInfo(String requestId) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "server.info", "Server not available");
            }
            
            JsonObject serverInfo = new JsonObject();
            serverInfo.addProperty("name", server.getMotd());
            serverInfo.addProperty("version", server.getServerVersion());
            serverInfo.addProperty("coreType", "Java");
            serverInfo.addProperty("coreName", "Forge");
            serverInfo.addProperty("maxPlayers", server.getMaxPlayers());
            serverInfo.addProperty("onlinePlayers", server.getPlayerCount());
            serverInfo.addProperty("port", server.getPort());
            serverInfo.addProperty("motd", server.getMotd());
            serverInfo.addProperty("whitelistEnabled", server.getPlayerList().isUsingWhitelist());
            serverInfo.addProperty("onlineMode", server.usesAuthentication());
            
            JsonArray worldsArray = new JsonArray();
            for (ServerLevel world : server.getAllLevels()) {
                JsonObject worldObj = new JsonObject();
                worldObj.addProperty("name", world.dimension().location().toString());
                worldObj.addProperty("dimension", world.dimension().location().toString());
                worldObj.addProperty("difficulty", world.getDifficulty().getKey());
                worldObj.addProperty("playerCount", world.players().size());
                worldsArray.add(worldObj);
            }
            serverInfo.add("worlds", worldsArray);
            
            JsonObject responseData = new JsonObject();
            responseData.add("info", serverInfo);
            
            return createSuccessResponse(requestId, "server.info", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to get server info", e);
            return createErrorResponse(requestId, "server.info", e.getMessage());
        }
    }
    
    /**
     * Handle server status operation
     */
    public JsonObject handleServerStatus(String requestId) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "server.status", "Server not available");
            }
            
            JsonObject statusData = new JsonObject();
            statusData.addProperty("status", "online");
            statusData.addProperty("uptime", System.currentTimeMillis() - server.getServerStartTimeMillis());
            
            JsonObject playersData = new JsonObject();
            playersData.addProperty("online", server.getPlayerCount());
            playersData.addProperty("max", server.getMaxPlayers());
            statusData.add("players", playersData);
            
            JsonObject performanceData = new JsonObject();
            performanceData.addProperty("tps", server.getAverageTickTime());
            
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
            logger.error("Failed to get server status", e);
            return createErrorResponse(requestId, "server.status", e.getMessage());
        }
    }
    
    /**
     * Handle server restart operation
     */
    public JsonObject handleServerRestart(String requestId, int delay) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "server.restart", "Server not available");
            }
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will restart in " + delay + " seconds");
            
            // Broadcast to all players
            final String broadcastMessage = "§c[Mochi-Link] Server will restart in " + delay + " seconds!";
            server.execute(() -> {
                server.getPlayerList().broadcastSystemMessage(
                    Component.literal(broadcastMessage).withStyle(ChatFormatting.RED),
                    false
                );
            });
            
            // Schedule restart (Note: Forge doesn't have built-in restart, so we stop)
            new Thread(() -> {
                try {
                    Thread.sleep(delay * 1000L);
                    server.execute(() -> server.halt(false));
                } catch (InterruptedException e) {
                    logger.error("Restart interrupted", e);
                }
            }).start();
            
            return createSuccessResponse(requestId, "server.restart", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to restart server", e);
            return createErrorResponse(requestId, "server.restart", e.getMessage());
        }
    }
    
    /**
     * Handle server stop operation
     */
    public JsonObject handleServerStop(String requestId, int delay) {
        try {
            MinecraftServer server = mod.getServer();
            if (server == null) {
                return createErrorResponse(requestId, "server.stop", "Server not available");
            }
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will stop in " + delay + " seconds");
            
            // Broadcast to all players
            final String broadcastMessage = "§c[Mochi-Link] Server will stop in " + delay + " seconds!";
            server.execute(() -> {
                server.getPlayerList().broadcastSystemMessage(
                    Component.literal(broadcastMessage).withStyle(ChatFormatting.RED),
                    false
                );
            });
            
            // Schedule stop
            new Thread(() -> {
                try {
                    Thread.sleep(delay * 1000L);
                    server.execute(() -> server.halt(false));
                } catch (InterruptedException e) {
                    logger.error("Stop interrupted", e);
                }
            }).start();
            
            return createSuccessResponse(requestId, "server.stop", responseData);
            
        } catch (Exception e) {
            logger.error("Failed to stop server", e);
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
        response.addProperty("timestamp", System.currentTimeMillis());
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
        response.addProperty("timestamp", System.currentTimeMillis());
        response.addProperty("version", "2.0");
        
        JsonObject data = new JsonObject();
        data.addProperty("success", false);
        data.addProperty("error", error);
        response.add("data", data);
        
        return response;
    }
}
