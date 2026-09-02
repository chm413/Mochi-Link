package com.mochilink.connector.protocol;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.protocol.UWBPv2Protocol.ProtocolMessage;
import com.mochilink.connector.subscription.EventSubscription;
import com.mochilink.connector.utils.InputValidator;
import com.mochilink.connector.utils.InputValidator.ValidationResult;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import org.bukkit.Bukkit;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.lang.management.ManagementFactory;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Handles incoming messages from the management server
 * 
 * Processes different message types according to the U-WBP v2 protocol
 * and executes appropriate actions on the Minecraft server.
 */
public class MessageHandler {
    
    private final MochiLinkPlugin plugin;
    private final UWBPv2Protocol protocol;
    private final Logger logger;
    private final Gson gson;
    
    public MessageHandler(MochiLinkPlugin plugin, UWBPv2Protocol protocol) {
        this.plugin = plugin;
        this.protocol = protocol;
        this.logger = plugin.getLogger();
        this.gson = new Gson();
    }
    
    /**
     * Handle incoming message
     */
    public void handleMessage(String messageJson) {
        try {
            ProtocolMessage message = protocol.parseMessage(messageJson);
            
            if (message == null) {
                logger.warning("Failed to parse incoming message");
                return;
            }
            
            // Log message if verbose logging is enabled
            if (plugin.getPluginConfig().isVerboseConnection()) {
                logger.info("Processing message type: " + message.getType());
            }
            
            // Route message based on type
            switch (message.getType()) {
                case UWBPv2Protocol.MESSAGE_TYPE_REQUEST:
                    // U-WBP v2 standard format with op field
                    handleRequestMessage(message);
                    break;
                    
                case UWBPv2Protocol.MESSAGE_TYPE_COMMAND:
                    // Legacy format for backward compatibility
                    handleCommandMessage(message);
                    break;
                    
                case UWBPv2Protocol.MESSAGE_TYPE_STATUS:
                    handleStatusMessage(message);
                    break;
                    
                case UWBPv2Protocol.MESSAGE_TYPE_HEARTBEAT:
                    handleHeartbeatMessage(message);
                    break;
                    
                case UWBPv2Protocol.MESSAGE_TYPE_AUTH:
                    handleAuthMessage(message);
                    break;

                case UWBPv2Protocol.MESSAGE_TYPE_SYSTEM:
                    handleSystemMessage(message);
                    break;

                case "response":
                    // Responses belong to the request initiated by this
                    // connector. They are consumed by the connection layer.
                    break;
                    
                default:
                    logger.warning("Unknown message type: " + message.getType());
                    break;
            }
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error handling message", e);
        }
    }
    
    /**
     * Handle request message (U-WBP v2 standard format)
     */
    private void handleRequestMessage(ProtocolMessage message) {
        String requestId = message.getId();
        String op = message.getOp();
        
        if (op == null || op.trim().isEmpty()) {
            sendCommandResponse(requestId, false, "", "Operation (op) field is required");
            return;
        }
        
        if (plugin.getPluginConfig().isVerboseConnection()) {
            logger.info("Processing request operation: " + op);
        }
        
        // Route based on operation
        switch (op) {
            case "command.execute":
                handleCommandExecution(message);
                break;
                
            case "player.list":
                handlePlayerList(message);
                break;
                
            case "player.info": // legacy alias
            case "player.getInfo":
                handlePlayerInfo(message);
                break;
                
            case "player.kick":
                handlePlayerKick(message);
                break;
                
            case "player.message":
                handlePlayerMessage(message);
                break;
                
            case "whitelist.list": // legacy alias
            case "whitelist.get":
                handleWhitelistList(message);
                break;
                
            case "whitelist.add":
                handleWhitelistAdd(message);
                break;
                
            case "whitelist.remove":
                handleWhitelistRemove(message);
                break;
                
            case "server.info": // legacy alias
            case "server.getInfo":
                handleServerInfo(message);
                break;
                
            case "server.status": // legacy event/alias
            case "server.getStatus":
                handleServerStatus(message);
                break;

            case "server.getMetrics":
                handleServerMetrics(message);
                break;
                
            case "server.restart":
                handleServerRestart(message);
                break;
                
            case "server.stop": // legacy alias
            case "server.shutdown":
                handleServerStop(message);
                break;
                
            case "event.subscribe":
                handleEventSubscribe(message);
                break;
                
            case "event.unsubscribe":
                handleEventUnsubscribe(message);
                break;
                
            default:
                logger.warning("Unknown operation: " + op);
                sendErrorResponse(requestId, op, "Unsupported operation: " + op, "UNSUPPORTED_OPERATION");
                break;
        }
    }

    /**
     * Handle command execution operation
     */
    private void handleCommandExecution(ProtocolMessage message) {
        String requestId = message.getId();
        String command = message.getDataString("command");
        String executor = message.getDataString("executor");
        
        // Validate command
        ValidationResult<String> commandResult = InputValidator.validateCommand(command);
        if (!commandResult.isValid()) {
            sendCommandResponse(requestId, false, "", commandResult.getError());
            return;
        }
        final String validCommand = commandResult.getValue();
        
        // Check if console commands are allowed
        if (!plugin.getPluginConfig().isAllowConsoleCommands()) {
            sendCommandResponse(requestId, false, "", "Console commands are disabled");
            return;
        }
        
        // Check command blacklist
        String baseCommand = validCommand.split(" ")[0].toLowerCase();
        if (plugin.getPluginConfig().isCommandBlacklisted(baseCommand)) {
            sendCommandResponse(requestId, false, "", "Command is blacklisted");
            return;
        }
        
        logger.info(String.format("Executing remote command: %s (requested by: %s)", validCommand, executor));
        
        // Execute command on main thread
        new BukkitRunnable() {
            @Override
            public void run() {
                executeCommand(requestId, validCommand);
            }
        }.runTask(plugin);
    }
    
    /**
     * Handle player list operation
     */
    private void handlePlayerList(ProtocolMessage message) {
        String requestId = message.getId();
        
        try {
            JsonArray playersArray = new JsonArray();
            
            for (org.bukkit.entity.Player player : plugin.getServer().getOnlinePlayers()) {
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
                playerObj.add("permissions", gson.toJsonTree(player.getEffectivePermissions().stream()
                    .map(permission -> permission.getPermission())
                    .toArray(String[]::new)));
                playerObj.addProperty("edition", "Java");
                playerObj.addProperty("health", player.getHealth());
                playerObj.addProperty("foodLevel", player.getFoodLevel());
                playerObj.addProperty("gameMode", player.getGameMode().name());
                
                playersArray.add(playerObj);
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("players", playersArray);
            responseData.addProperty("online", playersArray.size());
            responseData.addProperty("max", plugin.getServer().getMaxPlayers());
            
            String response = protocol.createResponseMessage(
                requestId, "player.list", responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get player list", e);
            sendErrorResponse(requestId, "player.list", e.getMessage());
        }
    }
    
    /**
     * Handle player info operation
     */
    private void handlePlayerInfo(ProtocolMessage message) {
        String requestId = message.getId();
        String responseOp = operationOf(message, "player.getInfo");
        String playerId = message.getDataString("playerId");
        if (playerId == null) {
            playerId = message.getDataString("playerName");
        }
        
        try {
            if (playerId == null || playerId.trim().isEmpty()) {
                sendErrorResponse(requestId, responseOp, "Missing playerId or playerName");
                return;
            }

            // U-WBP accepts either a UUID/XUID-style identifier or the online
            // player name as the lookup key.
            org.bukkit.entity.Player player;
            try {
                player = plugin.getServer().getPlayer(java.util.UUID.fromString(playerId));
            } catch (IllegalArgumentException ignored) {
                ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerId);
                if (!nameResult.isValid()) {
                    sendErrorResponse(requestId, responseOp, nameResult.getError());
                    return;
                }
                player = plugin.getServer().getPlayer(nameResult.getValue());
            }
            
            if (player == null) {
                sendErrorResponse(requestId, responseOp, "Player not found");
                return;
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
            playerInfo.add("permissions", gson.toJsonTree(player.getEffectivePermissions().stream()
                .map(permission -> permission.getPermission())
                .toArray(String[]::new)));
            playerInfo.addProperty("edition", "Java");
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
            
            String response = protocol.createResponseMessage(
                requestId, responseOp, responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get player info", e);
            sendErrorResponse(requestId, responseOp, e.getMessage());
        }
    }
    
    /**
     * Handle player kick operation
     */
    private void handlePlayerKick(ProtocolMessage message) {
        String requestId = message.getId();
        String playerId = message.getDataString("playerId");
        String reason = message.getDataString("reason");
        
        // Validate playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            sendErrorResponse(requestId, "player.kick", playerIdResult.getError());
            return;
        }
        
        // Validate and sanitize reason
        ValidationResult<String> reasonResult = InputValidator.validateReason(reason);
        final String sanitizedReason = reasonResult.getValue();
        
        try {
            org.bukkit.entity.Player player = plugin.getServer().getPlayer(java.util.UUID.fromString(playerIdResult.getValue()));
            
            if (player == null) {
                sendErrorResponse(requestId, "player.kick", "Player not found");
                return;
            }
            
            String playerName = player.getName();
            
            // Kick on main thread
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                player.kickPlayer(sanitizedReason);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            responseData.addProperty("reason", sanitizedReason);
            
            String response = protocol.createResponseMessage(
                requestId, "player.kick", responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to kick player", e);
            sendErrorResponse(requestId, "player.kick", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist list operation
     */
    private void handleWhitelistList(ProtocolMessage message) {
        String requestId = message.getId();
        String responseOp = operationOf(message, "whitelist.get");
        
        try {
            JsonArray whitelistArray = new JsonArray();
            JsonArray playerNames = new JsonArray();
            
            for (org.bukkit.OfflinePlayer player : plugin.getServer().getWhitelistedPlayers()) {
                JsonObject playerObj = new JsonObject();
                playerObj.addProperty("id", player.getUniqueId().toString());
                playerObj.addProperty("name", player.getName());
                whitelistArray.add(playerObj);
                playerNames.add(player.getName() != null
                    ? player.getName()
                    : player.getUniqueId().toString());
            }
            
            JsonObject responseData = new JsonObject();
            responseData.add("whitelist", whitelistArray);
            responseData.add("players", playerNames);
            responseData.addProperty("enabled", plugin.getServer().hasWhitelist());
            responseData.addProperty("count", whitelistArray.size());
            
            String response = protocol.createResponseMessage(
                requestId, responseOp, responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get whitelist", e);
            sendErrorResponse(requestId, responseOp, e.getMessage());
        }
    }
    
    /**
     * Handle whitelist add operation
     */
    private void handleWhitelistAdd(ProtocolMessage message) {
        String requestId = message.getId();
        String playerName = message.getDataString("playerName");
        String playerId = message.getDataString("playerId");
        
        // Validate playerName if provided
        if (playerName != null && !playerName.isEmpty()) {
            ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
            if (!nameResult.isValid()) {
                sendErrorResponse(requestId, "whitelist.add", nameResult.getError());
                return;
            }
            playerName = nameResult.getValue();
        }
        
        // Validate playerId if provided
        if (playerId != null && !playerId.isEmpty()) {
            ValidationResult<String> idResult = InputValidator.validatePlayerId(playerId);
            if (!idResult.isValid()) {
                sendErrorResponse(requestId, "whitelist.add", idResult.getError());
                return;
            }
            playerId = idResult.getValue();
        }
        
        try {
            org.bukkit.OfflinePlayer player;
            
            if (playerId != null && !playerId.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(java.util.UUID.fromString(playerId));
            } else if (playerName != null && !playerName.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(playerName);
            } else {
                sendErrorResponse(requestId, "whitelist.add", "Missing playerName or playerId parameter");
                return;
            }
            
            player.setWhitelisted(true);
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", player.getName());
            responseData.addProperty("playerId", player.getUniqueId().toString());
            
            String response = protocol.createResponseMessage(
                requestId, "whitelist.add", responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to add to whitelist", e);
            sendErrorResponse(requestId, "whitelist.add", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist remove operation
     */
    private void handleWhitelistRemove(ProtocolMessage message) {
        String requestId = message.getId();
        String playerName = message.getDataString("playerName");
        String playerId = message.getDataString("playerId");
        
        // Validate playerName if provided
        if (playerName != null && !playerName.isEmpty()) {
            ValidationResult<String> nameResult = InputValidator.validatePlayerName(playerName);
            if (!nameResult.isValid()) {
                sendErrorResponse(requestId, "whitelist.remove", nameResult.getError());
                return;
            }
            playerName = nameResult.getValue();
        }
        
        // Validate playerId if provided
        if (playerId != null && !playerId.isEmpty()) {
            ValidationResult<String> idResult = InputValidator.validatePlayerId(playerId);
            if (!idResult.isValid()) {
                sendErrorResponse(requestId, "whitelist.remove", idResult.getError());
                return;
            }
            playerId = idResult.getValue();
        }
        
        try {
            org.bukkit.OfflinePlayer player;
            
            if (playerId != null && !playerId.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(java.util.UUID.fromString(playerId));
            } else if (playerName != null && !playerName.isEmpty()) {
                player = plugin.getServer().getOfflinePlayer(playerName);
            } else {
                sendErrorResponse(requestId, "whitelist.remove", "Missing playerName or playerId parameter");
                return;
            }
            
            player.setWhitelisted(false);
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", player.getName());
            responseData.addProperty("playerId", player.getUniqueId().toString());
            
            String response = protocol.createResponseMessage(
                requestId, "whitelist.remove", responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to remove from whitelist", e);
            sendErrorResponse(requestId, "whitelist.remove", e.getMessage());
        }
    }
    
    /**
     * Handle server info operation
     */
    private void handleServerInfo(ProtocolMessage message) {
        String requestId = message.getId();
        String responseOp = operationOf(message, "server.getInfo");
        
        try {
            JsonObject serverInfo = new JsonObject();
            serverInfo.addProperty("serverId", plugin.getPluginConfig().getServerId());
            serverInfo.addProperty("name", plugin.getServer().getMotd());
            serverInfo.addProperty("version", plugin.getServer().getVersion());
            serverInfo.addProperty("bukkitVersion", plugin.getServer().getBukkitVersion());
            serverInfo.addProperty("coreType", "Java");
            serverInfo.addProperty("coreName", plugin.getServer().getName());
            serverInfo.addProperty("maxPlayers", plugin.getServer().getMaxPlayers());
            serverInfo.addProperty("onlinePlayers", plugin.getServer().getOnlinePlayers().size());
            serverInfo.addProperty("port", plugin.getServer().getPort());
            serverInfo.addProperty("ip", plugin.getServer().getIp());
            serverInfo.addProperty("motd", plugin.getServer().getMotd());
            serverInfo.addProperty("whitelistEnabled", plugin.getServer().hasWhitelist());
            serverInfo.addProperty("onlineMode", plugin.getServer().getOnlineMode());
            serverInfo.addProperty("status", "online");
            serverInfo.addProperty("online", true);

            // Include the fields required by ServerInfoData so the management
            // bridge does not need to synthesize metrics or world values.
            serverInfo.addProperty("uptime", getUptimeMillis());
            serverInfo.addProperty("tps", getCurrentTps());
            Runtime infoRuntime = Runtime.getRuntime();
            long infoUsedMemory = infoRuntime.totalMemory() - infoRuntime.freeMemory();
            long infoMaxMemory = infoRuntime.maxMemory();
            JsonObject infoMemory = new JsonObject();
            infoMemory.addProperty("used", infoUsedMemory);
            infoMemory.addProperty("max", infoMaxMemory);
            infoMemory.addProperty("free", Math.max(0L, infoMaxMemory - infoUsedMemory));
            infoMemory.addProperty("percentage", infoMaxMemory > 0
                ? (double) infoUsedMemory / infoMaxMemory * 100.0 : 0.0);
            serverInfo.add("memoryUsage", infoMemory);
            
            JsonArray worldsArray = new JsonArray();
            for (org.bukkit.World world : plugin.getServer().getWorlds()) {
                JsonObject worldObj = new JsonObject();
                worldObj.addProperty("name", world.getName());
                worldObj.addProperty("dimension", dimensionOf(world.getEnvironment().name()));
                worldObj.addProperty("playerCount", world.getPlayers().size());
                worldObj.addProperty("loadedChunks", world.getLoadedChunks().length);
                worldsArray.add(worldObj);
            }
            serverInfo.add("worldInfo", worldsArray);
            
            JsonObject responseData = new JsonObject();
            responseData.add("info", serverInfo);
            
            String response = protocol.createResponseMessage(
                requestId, responseOp, responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get server info", e);
            sendErrorResponse(requestId, responseOp, e.getMessage());
        }
    }
    
    /**
     * Handle server status operation
     */
    private void handleServerStatus(ProtocolMessage message) {
        String requestId = message.getId();
        String responseOp = operationOf(message, "server.getStatus");
        
        try {
            JsonObject responseData = new JsonObject();
            responseData.addProperty("status", "online");
            responseData.addProperty("online", true);
            responseData.addProperty("uptime", getUptimeMillis());
            responseData.addProperty("playerCount", plugin.getServer().getOnlinePlayers().size());
            responseData.addProperty("maxPlayers", plugin.getServer().getMaxPlayers());
            responseData.addProperty("tps", getCurrentTps());

            Runtime runtime = Runtime.getRuntime();
            long usedMemory = runtime.totalMemory() - runtime.freeMemory();
            long maxMemory = runtime.maxMemory();
            JsonObject memoryUsage = new JsonObject();
            memoryUsage.addProperty("used", usedMemory);
            memoryUsage.addProperty("max", maxMemory);
            memoryUsage.addProperty("free", Math.max(0L, maxMemory - usedMemory));
            memoryUsage.addProperty("percentage", maxMemory > 0
                ? (double) usedMemory / maxMemory * 100.0 : 0.0);
            responseData.add("memoryUsage", memoryUsage);
            
            String response = protocol.createResponseMessage(
                requestId, responseOp, responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get server status", e);
            sendErrorResponse(requestId, responseOp, e.getMessage());
        }
    }
    
    /**
     * Handle event subscribe operation
     */
    private void handleEventSubscribe(ProtocolMessage message) {
        String requestId = message.getId();
        
        try {
            // Parse subscription request
            JsonObject data = message.getData();
            String serverId = data.has("serverId") ? data.get("serverId").getAsString() : null;
            List<String> eventTypes = new ArrayList<>();
            
            if (data.has("eventTypes")) {
                JsonArray types = data.getAsJsonArray("eventTypes");
                for (int i = 0; i < types.size(); i++) {
                    eventTypes.add(types.get(i).getAsString());
                }
            }
            
            // Parse filters
            Map<String, Object> filters = new HashMap<>();
            if (data.has("filters")) {
                JsonObject filtersObj = data.getAsJsonObject("filters");
                for (String key : filtersObj.keySet()) {
                    filters.put(key, filtersObj.get(key).getAsString());
                }
            }
            
            // Create subscription
            String subscriptionId = generateSubscriptionId();
            EventSubscription subscription = new EventSubscription(
                subscriptionId,
                eventTypes,
                filters,
                System.currentTimeMillis()
            );
            
            // Add to subscription manager
            plugin.getSubscriptionManager().addSubscription(subscriptionId, subscription);
            
            // Send success response
            JsonObject responseData = new JsonObject();
            responseData.addProperty("subscriptionId", subscriptionId);
            responseData.addProperty("serverId", serverId);
            responseData.add("eventTypes", gson.toJsonTree(eventTypes));
            responseData.addProperty("message", "Successfully subscribed to events");
            
            String response = protocol.createResponseMessage(
                requestId,
                "event.subscribe",
                responseData.toString()
            );
            
            plugin.getConnectionManager().sendMessage(response);
            
            logger.info("Event subscription created: " + subscriptionId + " for events: " + eventTypes);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to handle event subscription", e);
            sendErrorResponse(requestId, "event.subscribe", e.getMessage());
        }
    }
    
    /**
     * Handle event unsubscribe operation
     */
    private void handleEventUnsubscribe(ProtocolMessage message) {
        String requestId = message.getId();
        
        try {
            // Parse unsubscribe request
            JsonObject data = message.getData();
            String subscriptionId = data.get("subscriptionId").getAsString();
            
            // Remove subscription
            plugin.getSubscriptionManager().removeSubscription(subscriptionId);
            
            // Send success response
            JsonObject responseData = new JsonObject();
            responseData.addProperty("subscriptionId", subscriptionId);
            responseData.addProperty("message", "Successfully unsubscribed from events");
            
            String response = protocol.createResponseMessage(
                requestId,
                "event.unsubscribe",
                responseData.toString()
            );
            
            plugin.getConnectionManager().sendMessage(response);
            
            logger.info("Event subscription removed: " + subscriptionId);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to handle event unsubscription", e);
            sendErrorResponse(requestId, "event.unsubscribe", e.getMessage());
        }
    }
    
    /**
     * Handle command execution message (legacy format for backward compatibility)
     */
    private void handleCommandMessage(ProtocolMessage message) {
        // Support both old format (command_id in data) and new format (id at top level)
        String commandId = message.getId() != null ? message.getId() : message.getDataString("command_id");
        String command = message.getDataString("command");
        String executor = message.getDataString("executor");
        
        // Validate command
        ValidationResult<String> commandResult = InputValidator.validateCommand(command);
        if (!commandResult.isValid()) {
            sendCommandResponse(commandId, false, "", commandResult.getError());
            return;
        }
        final String validCommand = commandResult.getValue();
        
        // Check if console commands are allowed
        if (!plugin.getPluginConfig().isAllowConsoleCommands()) {
            sendCommandResponse(commandId, false, "", "Console commands are disabled");
            return;
        }
        
        // Check command blacklist
        String baseCommand = validCommand.split(" ")[0].toLowerCase();
        if (plugin.getPluginConfig().isCommandBlacklisted(baseCommand)) {
            sendCommandResponse(commandId, false, "", "Command is blacklisted");
            return;
        }
        
        logger.info(String.format("Executing remote command: %s (requested by: %s)", validCommand, executor));
        
        // Execute command on main thread
        new BukkitRunnable() {
            @Override
            public void run() {
                executeCommand(commandId, validCommand);
            }
        }.runTask(plugin);
    }
    
    /**
     * Execute command and send response
     */
    private void executeCommand(String commandId, String command) {
        long startTime = System.currentTimeMillis();
        try {
            // Execute command
            ConsoleCommandSender console = Bukkit.getConsoleSender();
            boolean success = Bukkit.dispatchCommand(console, command);
            
            // Bukkit does not expose a portable console-output capture API.
            // Return an empty output list rather than claiming text was produced.
            String output = "";
            String error = success ? null : "Command execution failed";
            
            // Send response
            sendCommandResponse(commandId, success, output, error,
                System.currentTimeMillis() - startTime);
            
            // Log command execution
            if (plugin.getPluginConfig().isLogCommands()) {
                logger.info(String.format("Command executed: %s, Success: %s", command, success));
            }
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Command execution failed", e);
            sendCommandResponse(commandId, false, "", e.getMessage(),
                System.currentTimeMillis() - startTime);
        }
    }
    
    /**
     * Send command response
     */
    private void sendCommandResponse(String commandId, boolean success, String output, String error) {
        sendCommandResponse(commandId, success, output, error, 0L);
    }

    /** Handle the canonical metrics operation with a metrics-shaped payload. */
    private void handleServerMetrics(ProtocolMessage message) {
        String requestId = message.getId();
        String responseOp = operationOf(message, "server.getMetrics");

        try {
            Runtime runtime = Runtime.getRuntime();
            long usedMemory = runtime.totalMemory() - runtime.freeMemory();
            long maxMemory = runtime.maxMemory();
            double percentage = maxMemory > 0 ? (double) usedMemory / maxMemory * 100.0 : 0.0;

            JsonObject metrics = new JsonObject();
            metrics.addProperty("serverId", plugin.getPluginConfig().getServerId());
            metrics.addProperty("timestamp", System.currentTimeMillis());
            metrics.addProperty("tps", getCurrentTps());
            metrics.addProperty("cpuUsage", 0.0); // Bukkit exposes no portable CPU metric.
            metrics.addProperty("playerCount", plugin.getServer().getOnlinePlayers().size());
            metrics.addProperty("ping", 0);

            JsonObject memory = new JsonObject();
            memory.addProperty("used", usedMemory);
            memory.addProperty("max", maxMemory);
            memory.addProperty("free", Math.max(0L, maxMemory - usedMemory));
            memory.addProperty("percentage", percentage);
            metrics.add("memoryUsage", memory);

            JsonObject responseData = new JsonObject();
            responseData.add("metrics", metrics);
            plugin.getConnectionManager().sendMessage(protocol.createResponseMessage(
                requestId, responseOp, responseData.toString()));
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get server metrics", e);
            sendErrorResponse(requestId, responseOp, e.getMessage());
        }
    }

    private void sendCommandResponse(String commandId, boolean success, String output,
                                     String error, long executionTime) {
        try {
            String response = protocol.createCommandResponseMessage(
                commandId, success, output, error, executionTime);
            plugin.getConnectionManager().sendMessage(response);
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send command response", e);
        }
    }
    
    /**
     * Send error response
     */
    private void sendErrorResponse(String requestId, String op, String errorMessage) {
        sendErrorResponse(requestId, op, errorMessage, "OPERATION_FAILED");
    }

    private void sendErrorResponse(String requestId, String op, String errorMessage, String code) {
        try {
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", false);
            responseData.addProperty("error", errorMessage);
            responseData.addProperty("code", code == null || code.isEmpty() ? "OPERATION_FAILED" : code);
            
            String response = protocol.createResponseMessage(
                requestId,
                op,
                responseData.toString()
            );
            
            plugin.getConnectionManager().sendMessage(response);
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send error response", e);
        }
    }
    
    /**
     * Handle status message
     */
    private void handleStatusMessage(ProtocolMessage message) {
        String status = message.getDataString("status");
        String statusMessage = message.getDataString("message");
        
        logger.info(String.format("Status update from management server: %s - %s", status, statusMessage));
        
        // Handle specific status messages
        switch (status) {
            case "ping":
                // Respond to ping with pong
                String pongResponse = protocol.createStatusMessage("pong", "Server is alive");
                plugin.getConnectionManager().sendMessage(pongResponse);
                break;
                
            case "shutdown_request":
                // Handle shutdown request
                logger.warning("Shutdown request received from management server");
                // You might want to implement graceful shutdown logic here
                break;
                
            case "config_reload":
                // Handle configuration reload request
                logger.info("Configuration reload requested");
                plugin.getPluginConfig().load();
                break;
        }
    }

    /** JVM uptime is the only portable uptime exposed by the Bukkit API. */
    private long getUptimeMillis() {
        return Math.max(0L, ManagementFactory.getRuntimeMXBean().getUptime());
    }

    private double getCurrentTps() {
        try {
            Object value = plugin.getServer().getClass().getMethod("getTPS").invoke(plugin.getServer());
            if (value instanceof double[] && ((double[]) value).length > 0) {
                return Math.max(0.0, Math.min(20.0, ((double[]) value)[0]));
            }
        } catch (ReflectiveOperationException ignored) {
            // Spigot does not expose TPS through the Bukkit Server interface.
        }
        return 0.0;
    }

    private String dimensionOf(String environment) {
        switch (environment) {
            case "NETHER": return "nether";
            case "THE_END": return "end";
            case "NORMAL": return "overworld";
            default: return environment.toLowerCase();
        }
    }

    /** Handle canonical system operations emitted by the Koishi endpoint. */
    private void handleSystemMessage(ProtocolMessage message) {
        String systemOp = message.getSystemOp() != null ? message.getSystemOp() : message.getOp();
        if (systemOp == null) {
            return;
        }

        switch (systemOp) {
            case "ping": {
                JsonObject data = new JsonObject();
                data.addProperty("serverId", plugin.getPluginConfig().getServerId());
                data.addProperty("timestamp", System.currentTimeMillis());
                String pong = protocol.createSystemMessage(
                    "pong", data, plugin.getPluginConfig().getServerId(), message.getId());
                plugin.getConnectionManager().sendMessage(pong);
                break;
            }
            case "handshake":
                // Token-in-query connections are authenticated before the first
                // application message. A challenge is handled by the normal
                // auth helper when a deployment explicitly uses that flow.
                if (message.getData().has("challenge")) {
                    long challengeTimestamp = message.getData().has("challengeTimestamp")
                        ? message.getData().get("challengeTimestamp").getAsLong()
                        : message.getTimestamp();
                    String auth = protocol.createChallengeAuthenticationMessage(
                        plugin.getPluginConfig().getApiToken(),
                        plugin.getPluginConfig().getServerId(),
                        message.getData().get("challenge").getAsString(),
                        challengeTimestamp,
                        message.getId());
                    plugin.getConnectionManager().sendMessage(auth);
                }
                break;
            case "disconnect":
                plugin.getConnectionManager().disconnect();
                break;
            case "pong":
                break;
            default:
                logger.warning("Unknown system operation: " + systemOp);
                break;
        }
    }
    
    /**
     * Handle heartbeat message
     */
    private void handleHeartbeatMessage(ProtocolMessage message) {
        // Heartbeat received from server - connection is healthy
        if (plugin.getPluginConfig().isVerboseConnection()) {
            logger.info("Heartbeat received from management server");
        }
        
        // Optionally respond with our own heartbeat
        String heartbeatResponse = protocol.createHeartbeatMessage();
        plugin.getConnectionManager().sendMessage(heartbeatResponse);
    }
    
    /**
     * Handle authentication message
     */
    private void handleAuthMessage(ProtocolMessage message) {
        String status = message.getDataString("status");
        String authMessage = message.getDataString("message");
        
        if ("success".equals(status)) {
            logger.info("Authentication successful: " + authMessage);
            
            // Send initial server status
            Map<String, Object> statusData = new HashMap<>();
            statusData.put("status", "online");
            statusData.put("reason", "authentication_succeeded");
            String statusMessage = protocol.createServerEventMessage("server.status", statusData);
            plugin.getConnectionManager().sendMessage(statusMessage);
            
        } else {
            logger.severe("Authentication failed: " + authMessage);
            
            // Disconnect on authentication failure
            plugin.getConnectionManager().disconnect();
        }
    }
    
    /**
     * Generate unique subscription ID
     */
    private String generateSubscriptionId() {
        return "sub_" + System.currentTimeMillis() + "_" + 
               Long.toHexString(Double.doubleToLongBits(Math.random()));
    }

    private String operationOf(ProtocolMessage message, String fallback) {
        return message.getOp() == null || message.getOp().trim().isEmpty()
            ? fallback : message.getOp();
    }
    
    /**
     * Handle player message operation (send private message to player)
     */
    private void handlePlayerMessage(ProtocolMessage message) {
        String requestId = message.getId();
        String playerId = message.getDataString("playerId");
        String messageText = message.getDataString("message");
        
        // Validate playerId
        ValidationResult<String> playerIdResult = InputValidator.validatePlayerId(playerId);
        if (!playerIdResult.isValid()) {
            sendErrorResponse(requestId, "player.message", playerIdResult.getError());
            return;
        }
        
        // Validate and sanitize message
        ValidationResult<String> messageResult = InputValidator.validateMessage(messageText);
        if (!messageResult.isValid()) {
            sendErrorResponse(requestId, "player.message", messageResult.getError());
            return;
        }
        final String sanitizedMessage = messageResult.getValue();
        
        try {
            org.bukkit.entity.Player player = plugin.getServer().getPlayer(java.util.UUID.fromString(playerIdResult.getValue()));
            
            if (player == null) {
                sendErrorResponse(requestId, "player.message", "Player not found");
                return;
            }
            
            String playerName = player.getName();
            
            // Send message on main thread
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                player.sendMessage(sanitizedMessage);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            String response = protocol.createResponseMessage(
                requestId, "player.message", responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send message to player", e);
            sendErrorResponse(requestId, "player.message", e.getMessage());
        }
    }
    
    /**
     * Handle server restart operation
     */
    private void handleServerRestart(ProtocolMessage message) {
        String requestId = message.getId();
        int delay = Math.max(0, Math.min(3600, message.getDataInt("delay", 10)));
        
        try {
            // Send response first
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will restart in " + delay + " seconds");
            
            String response = protocol.createResponseMessage(
                requestId, "server.restart", responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
            // Broadcast to all players
            final String broadcastMessage = "§c[Mochi-Link] Server will restart in " + delay + " seconds!";
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                plugin.getServer().broadcastMessage(broadcastMessage);
            });
            
            // Schedule restart
            plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
                try {
                    plugin.getServer().spigot().restart();
                } catch (Exception e) {
                    logger.log(Level.SEVERE, "Failed to restart server", e);
                    // Do not turn a failed restart into an unexpected shutdown.
                    sendErrorResponse(requestId, "server.restart",
                        "Server restart is not supported by this core", "UNSUPPORTED_OPERATION");
                }
            }, delay * 20L); // Convert seconds to ticks
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to restart server", e);
            sendErrorResponse(requestId, "server.restart", e.getMessage());
        }
    }
    
    /**
     * Handle server stop operation
     */
    private void handleServerStop(ProtocolMessage message) {
        String requestId = message.getId();
        int delay = Math.max(0, Math.min(3600, message.getDataInt("delay", 10)));
        String responseOp = operationOf(message, "server.shutdown");
        
        try {
            // Send response first
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will stop in " + delay + " seconds");
            
            String response = protocol.createResponseMessage(
                requestId, responseOp, responseData.toString()
            );
            plugin.getConnectionManager().sendMessage(response);
            
            // Broadcast to all players
            final String broadcastMessage = "§c[Mochi-Link] Server will stop in " + delay + " seconds!";
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                plugin.getServer().broadcastMessage(broadcastMessage);
            });
            
            // Schedule stop
            plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
                plugin.getServer().shutdown();
            }, delay * 20L); // Convert seconds to ticks
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to stop server", e);
            sendErrorResponse(requestId, responseOp, e.getMessage());
        }
    }
}
