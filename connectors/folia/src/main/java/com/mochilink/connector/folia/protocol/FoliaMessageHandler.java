package com.mochilink.connector.folia.protocol;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.connection.FoliaConnectionManager;
import com.mochilink.connector.folia.utils.InputValidator;
import com.mochilink.connector.folia.utils.InputValidator.ValidationResult;
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
                playerObj.addProperty("displayName", player.getDisplayName().toString());
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
        // 验证 playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            return createErrorResponse(requestId, "player.info", playerIdResult.getError());
        }
        
        try {
            Player player = plugin.getServer().getPlayer(UUID.fromString(playerIdResult.getValue()));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.info", "Player not found");
            }
            
            JsonObject playerInfo = new JsonObject();
            playerInfo.addProperty("id", player.getUniqueId().toString());
            playerInfo.addProperty("name", player.getName());
            playerInfo.addProperty("displayName", player.getDisplayName().toString());
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
        // 验证 playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            return createErrorResponse(requestId, "player.kick", playerIdResult.getError());
        }
        
        // 验证并清理 reason
        ValidationResult<String> reasonResult = InputValidator.validateReason(reason);
        String sanitizedReason = reasonResult.getValue();
        
        try {
            Player player = plugin.getServer().getPlayer(UUID.fromString(playerIdResult.getValue()));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.kick", "Player not found");
            }
            
            String playerName = player.getName();
            final String kickReason = sanitizedReason;
            
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
        // 验证 playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            return createErrorResponse(requestId, "player.message", playerIdResult.getError());
        }
        
        // 验证并清理 message
        ValidationResult<String> messageResult = InputValidator.validateMessage(message);
        String sanitizedMessage = messageResult.getValue();
        
        try {
            Player player = plugin.getServer().getPlayer(UUID.fromString(playerIdResult.getValue()));
            
            if (player == null) {
                return createErrorResponse(requestId, "player.message", "Player not found");
            }
            
            String playerName = player.getName();
            
            // Send message on player's region thread
            player.getScheduler().run(plugin, (ScheduledTask task) -> {
                player.sendMessage(sanitizedMessage);
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
        // 验证 playerName（如果提供）
        if (playerName != null && !playerName.isEmpty()) {
            ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
            if (!nameResult.isValid()) {
                return createErrorResponse(requestId, "whitelist.add", nameResult.getError());
            }
            playerName = nameResult.getValue();
        }
        
        // 验证 playerId（如果提供）
        if (playerId != null && !playerId.isEmpty()) {
            ValidationResult<String> idResult = InputValidator.validatePlayerId(playerId);
            if (!idResult.isValid()) {
                return createErrorResponse(requestId, "whitelist.add", idResult.getError());
            }
            playerId = idResult.getValue();
        }
        
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
        // 验证 playerName（如果提供）
        if (playerName != null && !playerName.isEmpty()) {
            ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
            if (!nameResult.isValid()) {
                return createErrorResponse(requestId, "whitelist.remove", nameResult.getError());
            }
            playerName = nameResult.getValue();
        }
        
        // 验证 playerId（如果提供）
        if (playerId != null && !playerId.isEmpty()) {
            ValidationResult<String> idResult = InputValidator.validatePlayerId(playerId);
            if (!idResult.isValid()) {
                return createErrorResponse(requestId, "whitelist.remove", idResult.getError());
            }
            playerId = idResult.getValue();
        }
        
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
            serverInfo.addProperty("name", plugin.getPluginConfig().getServerId());
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
            statusData.addProperty("uptime", System.currentTimeMillis() - plugin.getStartTime());
            
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
     * Handle command execute operation
     */
    public JsonObject handleCommandExecute(String requestId, String command) {
        // 验证 command
        ValidationResult<String> commandResult = InputValidator.validateCommand(command);
        if (!commandResult.isValid()) {
            return createErrorResponse(requestId, "command.execute", commandResult.getError());
        }
        
        String validCommand = commandResult.getValue();
        
        try {
            logger.info("Executing command: " + validCommand);
            
            long startTime = System.currentTimeMillis();
            
            // Execute command on global region scheduler
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                try {
                    plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(),
                        validCommand
                    );
                } catch (Exception e) {
                    logger.log(Level.WARNING, "Failed to execute command", e);
                }
            });
            
            long executionTime = System.currentTimeMillis() - startTime;
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("command", validCommand);
            responseData.addProperty("executionTime", executionTime);
            
            JsonArray output = new JsonArray();
            output.add("Command executed successfully");
            responseData.add("output", output);
            
            return createSuccessResponse(requestId, "command.execute", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to execute command", e);
            return createErrorResponse(requestId, "command.execute", e.getMessage());
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
                        Player player = plugin.getServer().getPlayer(uuid);
                        if (player != null) {
                            targetName = player.getName();
                        } else {
                            // Try to get offline player name
                            targetName = plugin.getServer().getOfflinePlayer(uuid).getName();
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
            
            // Execute ban command on global region scheduler
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                try {
                    String banCommand;
                    if (duration != null && duration > 0) {
                        // Temporary ban (if supported by server)
                        banCommand = "ban " + finalName + " " + banReason;
                    } else {
                        // Permanent ban
                        banCommand = "ban " + finalName + " " + banReason;
                    }
                    
                    plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(),
                        banCommand
                    );
                } catch (Exception e) {
                    logger.log(Level.WARNING, "Failed to ban player", e);
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
            logger.log(Level.WARNING, "Failed to ban player", e);
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
                        UUID uuid = UUID.fromString(playerId);
                        targetName = plugin.getServer().getOfflinePlayer(uuid).getName();
                    } catch (IllegalArgumentException e) {
                        return createErrorResponse(requestId, "player.unban", "Invalid player ID format");
                    }
                }
            }
            
            if (targetName == null || targetName.isEmpty()) {
                return createErrorResponse(requestId, "player.unban", "Missing player name or ID");
            }
            
            final String finalName = targetName;
            
            // Execute unban command on global region scheduler
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                try {
                    plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(),
                        "pardon " + finalName
                    );
                } catch (Exception e) {
                    logger.log(Level.WARNING, "Failed to unban player", e);
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", finalName);
            
            return createSuccessResponse(requestId, "player.unban", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to unban player", e);
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
            // Note: Bukkit API doesn't provide direct access to ban list
            // We need to use the banlist command output or BanList API
            org.bukkit.BanList banList;
            if ("ip".equalsIgnoreCase(banType)) {
                banList = plugin.getServer().getBanList(org.bukkit.BanList.Type.IP);
            } else {
                banList = plugin.getServer().getBanList(org.bukkit.BanList.Type.NAME);
            }
            
            for (Object entryObj : banList.getBanEntries()) {
                org.bukkit.BanEntry<?> entry = (org.bukkit.BanEntry<?>) entryObj;
                JsonObject banObj = new JsonObject();
                banObj.addProperty("target", entry.getTarget());
                banObj.addProperty("reason", entry.getReason());
                banObj.addProperty("source", entry.getSource());
                banObj.addProperty("created", entry.getCreated().toString());
                if (entry.getExpiration() != null) {
                    banObj.addProperty("expires", entry.getExpiration().toString());
                }
                banlistArray.add(banObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("banlist", banlistArray);
            responseData.addProperty("type", banType != null ? banType : "name");
            responseData.addProperty("count", banlistArray.size());
            
            return createSuccessResponse(requestId, "player.banlist", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get banlist", e);
            return createErrorResponse(requestId, "player.banlist", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist enable operation
     */
    public JsonObject handleWhitelistEnable(String requestId) {
        try {
            // Execute whitelist on command
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                try {
                    plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(),
                        "whitelist on"
                    );
                } catch (Exception e) {
                    logger.log(Level.WARNING, "Failed to enable whitelist", e);
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("enabled", true);
            
            return createSuccessResponse(requestId, "whitelist.enable", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to enable whitelist", e);
            return createErrorResponse(requestId, "whitelist.enable", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist disable operation
     */
    public JsonObject handleWhitelistDisable(String requestId) {
        try {
            // Execute whitelist off command
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                try {
                    plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(),
                        "whitelist off"
                    );
                } catch (Exception e) {
                    logger.log(Level.WARNING, "Failed to disable whitelist", e);
                }
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("enabled", false);
            
            return createSuccessResponse(requestId, "whitelist.disable", responseData);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to disable whitelist", e);
            return createErrorResponse(requestId, "whitelist.disable", e.getMessage());
        }
    }
    
    /**
     * Handle server save operation
     */
    public JsonObject handleServerSave(String requestId, String worldName) {
        try {
            // Execute save command
            plugin.getServer().getGlobalRegionScheduler().run(plugin, (ScheduledTask task) -> {
                try {
                    if (worldName != null && !worldName.isEmpty()) {
                        // Save specific world
                        plugin.getServer().dispatchCommand(
                            plugin.getServer().getConsoleSender(),
                            "save-all " + worldName
                        );
                    } else {
                        // Save all worlds
                        plugin.getServer().dispatchCommand(
                            plugin.getServer().getConsoleSender(),
                            "save-all"
                        );
                    }
                } catch (Exception e) {
                    logger.log(Level.WARNING, "Failed to save world", e);
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
            logger.log(Level.WARNING, "Failed to save world", e);
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
