package com.mochilink.connector.protocol;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.protocol.UWBPv2Protocol.ProtocolMessage;

import org.bukkit.Bukkit;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.scheduler.BukkitRunnable;

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
    
    public MessageHandler(MochiLinkPlugin plugin, UWBPv2Protocol protocol) {
        this.plugin = plugin;
        this.protocol = protocol;
        this.logger = plugin.getLogger();
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
                case UWBPv2Protocol.MESSAGE_TYPE_COMMAND:
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
     * Handle command execution message
     */
    private void handleCommandMessage(ProtocolMessage message) {
        String commandId = message.getDataString("command_id");
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
            // Create command output capturer
            CommandOutputCapturer outputCapturer = new CommandOutputCapturer();
            
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
     * Simple command output capturer (placeholder implementation)
     * In a real implementation, you'd need to intercept console output
     */
    private static class CommandOutputCapturer {
        // This is a placeholder - implementing real console output capture
        // would require more complex logging framework integration
    }
}