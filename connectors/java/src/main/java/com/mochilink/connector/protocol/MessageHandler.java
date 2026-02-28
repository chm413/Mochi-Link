package com.mochilink.connector.protocol;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.protocol.UWBPv2Protocol.ProtocolMessage;
import com.mochilink.connector.subscription.EventSubscription;

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
                
            case "player.info":
                handlePlayerInfo(message);
                break;
                
            case "player.kick":
                handlePlayerKick(message);
                break;
                
            case "player.message":
                handlePlayerMessage(message);
                break;
                
            case "whitelist.list":
                handleWhitelistList(message);
                break;
                
            case "whitelist.add":
                handleWhitelistAdd(message);
                break;
                
            case "whitelist.remove":
                handleWhitelistRemove(message);
                break;
                
            case "server.info":
                handleServerInfo(message);
                break;
                
            case "server.status":
                handleServerStatus(message);
                break;
                
            case "server.restart":
                handleServerRestart(message);
                break;
                
            case "server.stop":
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
                sendCommandResponse(requestId, false, "", "Unknown operation: " + op);
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
        
        if (command == null || command.trim().isEmpty()) {
            sendCommandResponse(requestId, false, "", "Command is empty");
            return;
        }
        
        // Check if console commands are allowed
        if (!plugin.getPluginConfig().isAllowConsoleCommands()) {
            sendCommandResponse(requestId, false, "", "Console commands are disabled");
            return;
        }
        
        // Check command blacklist
        String baseCommand = command.split(" ")[0].toLowerCase();
        if (plugin.getPluginConfig().isCommandBlacklisted(baseCommand)) {
            sendCommandResponse(requestId, false, "", "Command is blacklisted");
            return;
        }
        
        logger.info(String.format("Executing remote command: %s (requested by: %s)", command, executor));
        
        // Execute command on main thread
        new BukkitRunnable() {
            @Override
            public void run() {
                executeCommand(requestId, command);
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
                requestId, "player.list", responseData, true, null
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
        String playerId = message.getDataString("playerId");
        
        try {
            org.bukkit.entity.Player player = plugin.getServer().getPlayer(java.util.UUID.fromString(playerId));
            
            if (player == null) {
                sendErrorResponse(requestId, "player.info", "Player not found");
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
                requestId, "player.info", responseData, true, null
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get player info", e);
            sendErrorResponse(requestId, "player.info", e.getMessage());
        }
    }
    
    /**
     * Handle player kick operation
     */
    private void handlePlayerKick(ProtocolMessage message) {
        String requestId = message.getId();
        String playerId = message.getDataString("playerId");
        String reason = message.getDataString("reason");
        
        if (reason == null || reason.isEmpty()) {
            reason = "Kicked by administrator";
        }
        
        try {
            org.bukkit.entity.Player player = plugin.getServer().getPlayer(java.util.UUID.fromString(playerId));
            
            if (player == null) {
                sendErrorResponse(requestId, "player.kick", "Player not found");
                return;
            }
            
            String playerName = player.getName();
            final String kickReason = reason;
            
            // Kick on main thread
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                player.kickPlayer(kickReason);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            responseData.addProperty("reason", kickReason);
            
            String response = protocol.createResponseMessage(
                requestId, "player.kick", responseData, true, null
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
            
            String response = protocol.createResponseMessage(
                requestId, "whitelist.list", responseData, true, null
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get whitelist", e);
            sendErrorResponse(requestId, "whitelist.list", e.getMessage());
        }
    }
    
    /**
     * Handle whitelist add operation
     */
    private void handleWhitelistAdd(ProtocolMessage message) {
        String requestId = message.getId();
        String playerName = message.getDataString("playerName");
        String playerId = message.getDataString("playerId");
        
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
                requestId, "whitelist.add", responseData, true, null
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
                requestId, "whitelist.remove", responseData, true, null
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
        
        try {
            JsonObject serverInfo = new JsonObject();
            serverInfo.addProperty("serverId", plugin.getPluginConfig().getServerId());
            serverInfo.addProperty("name", plugin.getPluginConfig().getServerName());
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
            
            String response = protocol.createResponseMessage(
                requestId, "server.info", responseData, true, null
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get server info", e);
            sendErrorResponse(requestId, "server.info", e.getMessage());
        }
    }
    
    /**
     * Handle server status operation
     */
    private void handleServerStatus(ProtocolMessage message) {
        String requestId = message.getId();
        
        try {
            JsonObject statusData = new JsonObject();
            statusData.addProperty("status", "online");
            statusData.addProperty("uptime", System.currentTimeMillis() - plugin.getServer().getStartTime());
            
            JsonObject playersData = new JsonObject();
            playersData.addProperty("online", plugin.getServer().getOnlinePlayers().size());
            playersData.addProperty("max", plugin.getServer().getMaxPlayers());
            statusData.add("players", playersData);
            
            JsonObject performanceData = new JsonObject();
            performanceData.addProperty("tps", plugin.getServer().getTPS()[0]); // 1 minute TPS
            
            Runtime runtime = Runtime.getRuntime();
            long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
            long maxMemory = runtime.maxMemory() / 1024 / 1024;
            performanceData.addProperty("memoryUsage", usedMemory);
            performanceData.addProperty("memoryMax", maxMemory);
            performanceData.addProperty("memoryPercent", (double) usedMemory / maxMemory * 100);
            statusData.add("performance", performanceData);
            
            JsonObject responseData = new JsonObject();
            responseData.add("status", statusData);
            
            String response = protocol.createResponseMessage(
                requestId, "server.status", responseData, true, null
            );
            plugin.getConnectionManager().sendMessage(response);
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to get server status", e);
            sendErrorResponse(requestId, "server.status", e.getMessage());
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
        
        if (command == null || command.trim().isEmpty()) {
            sendCommandResponse(commandId, false, "", "Command is empty");
            return;
        }
        
        // Check if console commands are allowed
        if (!plugin.getPluginConfig().isAllowConsoleCommands()) {
            sendCommandResponse(commandId, false, "", "Console commands are disabled");
            return;
        }
        
        // Check command blacklist
        String baseCommand = command.split(" ")[0].toLowerCase();
        if (plugin.getPluginConfig().isCommandBlacklisted(baseCommand)) {
            sendCommandResponse(commandId, false, "", "Command is blacklisted");
            return;
        }
        
        logger.info(String.format("Executing remote command: %s (requested by: %s)", command, executor));
        
        // Execute command on main thread
        new BukkitRunnable() {
            @Override
            public void run() {
                executeCommand(commandId, command);
            }
        }.runTask(plugin);
    }
    
    /**
     * Execute command and send response
     */
    private void executeCommand(String commandId, String command) {
        try {
            // Execute command
            ConsoleCommandSender console = Bukkit.getConsoleSender();
            boolean success = Bukkit.dispatchCommand(console, command);
            
            // Get output (this is simplified - in a real implementation you'd need to capture console output)
            String output = "Command executed";
            String error = success ? null : "Command execution failed";
            
            // Send response
            sendCommandResponse(commandId, success, output, error);
            
            // Log command execution
            if (plugin.getPluginConfig().isLogCommands()) {
                logger.info(String.format("Command executed: %s, Success: %s", command, success));
            }
            
        } catch (Exception e) {
            logger.log(Level.WARNING, "Command execution failed", e);
            sendCommandResponse(commandId, false, "", e.getMessage());
        }
    }
    
    /**
     * Send command response
     */
    private void sendCommandResponse(String commandId, boolean success, String output, String error) {
        try {
            String response = protocol.createCommandResponseMessage(commandId, success, output, error);
            plugin.getConnectionManager().sendMessage(response);
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to send command response", e);
        }
    }
    
    /**
     * Send error response
     */
    private void sendErrorResponse(String requestId, String op, String errorMessage) {
        try {
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", false);
            responseData.addProperty("error", errorMessage);
            
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
            String statusMessage = protocol.createServerEventMessage("server_ready", null);
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
    
    /**
     * Handle player message operation (send private message to player)
     */
    private void handlePlayerMessage(ProtocolMessage message) {
        String requestId = message.getId();
        String playerId = message.getDataString("playerId");
        String messageText = message.getDataString("message");
        
        if (messageText == null || messageText.isEmpty()) {
            sendErrorResponse(requestId, "player.message", "Missing message parameter");
            return;
        }
        
        try {
            org.bukkit.entity.Player player = plugin.getServer().getPlayer(java.util.UUID.fromString(playerId));
            
            if (player == null) {
                sendErrorResponse(requestId, "player.message", "Player not found");
                return;
            }
            
            String playerName = player.getName();
            
            // Send message on main thread
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                player.sendMessage(messageText);
            });
            
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("playerName", playerName);
            
            String response = protocol.createResponseMessage(
                requestId, "player.message", responseData, true, null
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
        int delay = message.getDataInt("delay", 10); // Default 10 seconds delay
        
        try {
            // Send response first
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will restart in " + delay + " seconds");
            
            String response = protocol.createResponseMessage(
                requestId, "server.restart", responseData, true, null
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
                    // Fallback to stop if restart is not supported
                    plugin.getServer().shutdown();
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
        int delay = message.getDataInt("delay", 10); // Default 10 seconds delay
        
        try {
            // Send response first
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("delay", delay);
            responseData.addProperty("message", "Server will stop in " + delay + " seconds");
            
            String response = protocol.createResponseMessage(
                requestId, "server.stop", responseData, true, null
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
            sendErrorResponse(requestId, "server.stop", e.getMessage());
        }
    }
}
