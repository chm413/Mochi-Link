package com.mochilink.connector.nukkit.protocol;

import cn.nukkit.Player;
import cn.nukkit.Server;
import cn.nukkit.level.Level;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.connection.NukkitConnectionManager;
import com.mochilink.connector.nukkit.utils.InputValidator;
import com.mochilink.connector.nukkit.utils.InputValidator.ValidationResult;

import java.util.UUID;

/**
 * Nukkit Message Handler
 * Handles all incoming messages and operations for Nukkit servers
 */
public class NukkitMessageHandler {
    
    private final MochiLinkNukkitPlugin plugin;
    private final NukkitConnectionManager connectionManager;
    private final Server server;
    private final cn.nukkit.utils.Logger logger;
    
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
            logger.warning("Failed to get player list: " + e.getMessage());
            return createErrorResponse(requestId, "player.list", e.getMessage());
        }
    }
    
    /**
     * Handle player info operation
     */
    public JsonObject handlePlayerInfo(String requestId, String playerId) {
        // Validate playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            return createErrorResponse(requestId, "player.info", playerIdResult.getError());
        }
        
        try {
            java.util.Optional<Player> playerOpt = server.getPlayer(UUID.fromString(playerIdResult.getValue()));
            
            if (!playerOpt.isPresent()) {
                return createErrorResponse(requestId, "player.info", "Player not found");
            }
            
            Player player = playerOpt.get();
            
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
            // Note: isFlying() not available in Nukkit
            playerInfo.addProperty("isFlying", false);
            playerInfo.addProperty("isSneaking", player.isSneaking());
            playerInfo.addProperty("isSprinting", player.isSprinting());
            playerInfo.addProperty("address", player.getAddress());
            playerInfo.addProperty("edition", "Bedrock");
            // Note: getDeviceOS() returns int, not enum
            playerInfo.addProperty("deviceOS", player.getLoginChainData().getDeviceOS());
            
            JsonObject responseData = new JsonObject();
            responseData.add("player", playerInfo);
            
            return createSuccessResponse(requestId, "player.info", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to get player info: " + e.getMessage());
            return createErrorResponse(requestId, "player.info", e.getMessage());
        }
    }
    
    /**
     * Handle player kick operation
     */
    public JsonObject handlePlayerKick(String requestId, String playerId, String reason) {
        // Validate playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            return createErrorResponse(requestId, "player.kick", playerIdResult.getError());
        }
        
        // Validate and sanitize reason
        ValidationResult<String> reasonResult = InputValidator.validateReason(reason);
        final String sanitizedReason = reasonResult.getValue();
        
        try {
            java.util.Optional<Player> playerOpt = server.getPlayer(UUID.fromString(playerIdResult.getValue()));
            
            if (!playerOpt.isPresent()) {
                return createErrorResponse(requestId, "player.kick", "Player not found");
            }
            
            Player player = playerOpt.get();
            
            String playerName = player.getName();
            
            // Kick on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                player.kick(sanitizedReason);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            responseData.addProperty("reason", sanitizedReason);
            
            return createSuccessResponse(requestId, "player.kick", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to kick player: " + e.getMessage());
            return createErrorResponse(requestId, "player.kick", e.getMessage());
        }
    }
    
    /**
     * Handle player message operation
     */
    public JsonObject handlePlayerMessage(String requestId, String playerId, String message) {
        // Validate playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            return createErrorResponse(requestId, "player.message", playerIdResult.getError());
        }
        
        // Validate and sanitize message
        ValidationResult<String> messageResult = InputValidator.validateMessage(message);
        if (!messageResult.isValid()) {
            return createErrorResponse(requestId, "player.message", messageResult.getError());
        }
        final String sanitizedMessage = messageResult.getValue();
        
        try {
            java.util.Optional<Player> playerOpt = server.getPlayer(UUID.fromString(playerIdResult.getValue()));
            
            if (!playerOpt.isPresent()) {
                return createErrorResponse(requestId, "player.message", "Player not found");
            }
            
            Player player = playerOpt.get();
            
            String playerName = player.getName();
            
            // Send message on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                player.sendMessage(sanitizedMessage);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "player.message", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to send message to player: " + e.getMessage());
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
            logger.warning("Failed to get whitelist: " + e.getMessage());
            return createErrorResponse(requestId, "whitelist.list", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist add operation
     */
    public JsonObject handleWhitelistAdd(String requestId, String playerName) {
        // Validate playerName
        ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
        if (!nameResult.isValid()) {
            return createErrorResponse(requestId, "whitelist.add", nameResult.getError());
        }
        
        try {
            // Nukkit whitelist API: set value in config
            server.getWhitelist().set(nameResult.getValue().toLowerCase(), true);
            server.getWhitelist().save();
            server.getWhitelist().reload();
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "whitelist.add", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to add to whitelist: " + e.getMessage());
            return createErrorResponse(requestId, "whitelist.add", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist remove operation
     */
    public JsonObject handleWhitelistRemove(String requestId, String playerName) {
        // Validate playerName
        ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
        if (!nameResult.isValid()) {
            return createErrorResponse(requestId, "whitelist.remove", nameResult.getError());
        }
        
        try {
            server.getWhitelist().remove(nameResult.getValue().toLowerCase());
            server.getWhitelist().save();
            server.getWhitelist().reload();
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            return createSuccessResponse(requestId, "whitelist.remove", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to remove from whitelist: " + e.getMessage());
            return createErrorResponse(requestId, "whitelist.remove", e.getMessage());
        }
    }
    
    /**
     * Handle command execute operation
     */
    public JsonObject handleCommandExecute(String requestId, String command) {
        // Validate command
        ValidationResult<String> commandResult = InputValidator.validateCommand(command);
        if (!commandResult.isValid()) {
            return createErrorResponse(requestId, "command.execute", commandResult.getError());
        }
        final String validCommand = commandResult.getValue();
        
        try {
            long startTime = System.currentTimeMillis();
            
            // Execute command on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                server.dispatchCommand(server.getConsoleSender(), validCommand);
            });
            
            long executionTime = System.currentTimeMillis() - startTime;
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("command", validCommand);
            responseData.addProperty("executionTime", executionTime);
            
            JsonArray output = new JsonArray();
            output.add("Command executed");
            responseData.add("output", output);
            
            return createSuccessResponse(requestId, "command.execute", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to execute command: " + e.getMessage());
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
                // Note: getDifficulty() not available, use default
                levelObj.addProperty("difficulty", 1);
                levelObj.addProperty("playerCount", level.getPlayers().size());
                levelsArray.add(levelObj);
            }
            serverInfo.add("levels", levelsArray);
            
            JsonObject responseData = new JsonObject();
            responseData.add("info", serverInfo);
            
            return createSuccessResponse(requestId, "server.info", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to get server info: " + e.getMessage());
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
            // Note: getStartTime() not available
            statusData.addProperty("timestamp", java.time.Instant.now().toString());
            
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
            logger.warning("Failed to get server status: " + e.getMessage());
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
            logger.warning("Failed to restart server: " + e.getMessage());
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
            logger.warning("Failed to stop server: " + e.getMessage());
            return createErrorResponse(requestId, "server.stop", e.getMessage());
        }
    }
    
    /**
     * Handle player ban operation
     */
    public JsonObject handlePlayerBan(String requestId, String playerId, String playerName, String reason, Integer duration) {
        // 验证 playerId（如果提供）
        if (playerId != null && !playerId.isEmpty()) {
            ValidationResult<String> idResult = InputValidator.validatePlayerId(playerId);
            if (!idResult.isValid()) {
                return createErrorResponse(requestId, "player.ban", idResult.getError());
            }
            playerId = idResult.getValue();
        }
        
        // 验证 playerName（如果提供）
        if (playerName != null && !playerName.isEmpty()) {
            ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
            if (!nameResult.isValid()) {
                return createErrorResponse(requestId, "player.ban", nameResult.getError());
            }
            playerName = nameResult.getValue();
        }
        
        // 验证并清理 reason
        ValidationResult<String> reasonResult = InputValidator.validateReason(reason);
        String sanitizedReason = reasonResult.getValue();
        
        // 验证 duration（如果提供）
        if (duration != null) {
            if (duration < 0 || duration > 365 * 24 * 60) {
                return createErrorResponse(requestId, "player.ban", 
                    "Invalid duration: must be between 0 and " + (365 * 24 * 60));
            }
        }
        
        try {
            // Get player name if only ID provided
            String targetName = playerName;
            if (targetName == null || targetName.isEmpty()) {
                if (playerId != null && !playerId.isEmpty()) {
                    try {
                        UUID uuid = UUID.fromString(playerId);
                        java.util.Optional<cn.nukkit.Player> player = server.getPlayer(uuid);
                        if (player.isPresent()) {
                            targetName = player.get().getName();
                        }
                    } catch (IllegalArgumentException e) {
                        return createErrorResponse(requestId, "player.ban", "Invalid player ID format");
                    }
                }
            }
            
            if (targetName == null || targetName.isEmpty()) {
                return createErrorResponse(requestId, "player.ban", "Missing player name or ID");
            }
            
            final String finalName = targetName;
            final String banReason = sanitizedReason;
            
            // Execute ban command on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                try {
                    String banCommand = "ban " + finalName + " " + banReason;
                    server.dispatchCommand(server.getConsoleSender(), banCommand);
                } catch (Exception e) {
                    logger.warning("Failed to ban player: " + e.getMessage());
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", finalName);
            responseData.addProperty("reason", banReason);
            if (duration != null && duration > 0) {
                responseData.addProperty("duration", duration);
            }
            
            return createSuccessResponse(requestId, "player.ban", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to ban player: " + e.getMessage());
            return createErrorResponse(requestId, "player.ban", e.getMessage());
        }
    }
    
    /**
     * Handle player unban operation
     */
    public JsonObject handlePlayerUnban(String requestId, String playerId, String playerName) {
        // 验证 playerId（如果提供）
        if (playerId != null && !playerId.isEmpty()) {
            ValidationResult<String> idResult = InputValidator.validatePlayerId(playerId);
            if (!idResult.isValid()) {
                return createErrorResponse(requestId, "player.unban", idResult.getError());
            }
            playerId = idResult.getValue();
        }
        
        // 验证 playerName（如果提供）
        if (playerName != null && !playerName.isEmpty()) {
            ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
            if (!nameResult.isValid()) {
                return createErrorResponse(requestId, "player.unban", nameResult.getError());
            }
            playerName = nameResult.getValue();
        }
        
        try {
            // Get player name if only ID provided
            String targetName = playerName;
            if (targetName == null || targetName.isEmpty()) {
                if (playerId != null && !playerId.isEmpty()) {
                    try {
                        UUID.fromString(playerId);
                        // Note: Nukkit doesn't have easy way to get name from UUID for offline players
                        return createErrorResponse(requestId, "player.unban", "Player name is required");
                    } catch (IllegalArgumentException e) {
                        return createErrorResponse(requestId, "player.unban", "Invalid player ID format");
                    }
                }
            }
            
            if (targetName == null || targetName.isEmpty()) {
                return createErrorResponse(requestId, "player.unban", "Missing player name or ID");
            }
            
            final String finalName = targetName;
            
            // Execute unban command on main thread
            server.getScheduler().scheduleTask(plugin, () -> {
                try {
                    server.dispatchCommand(server.getConsoleSender(), "pardon " + finalName);
                } catch (Exception e) {
                    logger.warning("Failed to unban player: " + e.getMessage());
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", finalName);
            
            return createSuccessResponse(requestId, "player.unban", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to unban player: " + e.getMessage());
            return createErrorResponse(requestId, "player.unban", e.getMessage());
        }
    }
    
    /**
     * Handle player banlist operation
     */
    public JsonObject handlePlayerBanlist(String requestId, String banType) {
        try {
            JsonArray banlistArray = new JsonArray();
            
            // Get ban list from server
            if ("ip".equalsIgnoreCase(banType)) {
                server.getIPBans().getEntries().keySet().forEach(ip -> {
                    JsonObject banObj = new JsonObject();
                    banObj.addProperty("target", ip);
                    banlistArray.add(banObj);
                });
            } else {
                server.getNameBans().getEntries().keySet().forEach(name -> {
                    JsonObject banObj = new JsonObject();
                    banObj.addProperty("target", name);
                    banlistArray.add(banObj);
                });
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("banlist", banlistArray);
            responseData.addProperty("type", banType != null ? banType : "name");
            responseData.addProperty("count", banlistArray.size());
            
            return createSuccessResponse(requestId, "player.banlist", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to get banlist: " + e.getMessage());
            return createErrorResponse(requestId, "player.banlist", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist enable operation
     */
    public JsonObject handleWhitelistEnable(String requestId) {
        try {
            // Execute whitelist on command
            server.getScheduler().scheduleTask(plugin, () -> {
                try {
                    server.dispatchCommand(server.getConsoleSender(), "whitelist on");
                } catch (Exception e) {
                    logger.warning("Failed to enable whitelist: " + e.getMessage());
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("enabled", true);
            
            return createSuccessResponse(requestId, "whitelist.enable", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to enable whitelist: " + e.getMessage());
            return createErrorResponse(requestId, "whitelist.enable", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist disable operation
     */
    public JsonObject handleWhitelistDisable(String requestId) {
        try {
            // Execute whitelist off command
            server.getScheduler().scheduleTask(plugin, () -> {
                try {
                    server.dispatchCommand(server.getConsoleSender(), "whitelist off");
                } catch (Exception e) {
                    logger.warning("Failed to disable whitelist: " + e.getMessage());
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("enabled", false);
            
            return createSuccessResponse(requestId, "whitelist.disable", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to disable whitelist: " + e.getMessage());
            return createErrorResponse(requestId, "whitelist.disable", e.getMessage());
        }
    }
    
    /**
     * Handle server save operation
     */
    public JsonObject handleServerSave(String requestId, String worldName) {
        try {
            // Execute save command
            server.getScheduler().scheduleTask(plugin, () -> {
                try {
                    if (worldName != null && !worldName.isEmpty()) {
                        // Save specific world (Nukkit doesn't support per-world save via command)
                        server.dispatchCommand(server.getConsoleSender(), "save-all");
                    } else {
                        // Save all worlds
                        server.dispatchCommand(server.getConsoleSender(), "save-all");
                    }
                } catch (Exception e) {
                    logger.warning("Failed to save world: " + e.getMessage());
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            if (worldName != null && !worldName.isEmpty()) {
                responseData.addProperty("world", worldName);
            } else {
                responseData.addProperty("world", "all");
            }
            
            return createSuccessResponse(requestId, "server.save", responseData);
            
        } catch (Exception e) {
            logger.warning("Failed to save world: " + e.getMessage());
            return createErrorResponse(requestId, "server.save", e.getMessage());
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

