package com.mochilink.connector.handlers;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.connection.ConnectionManager;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.util.logging.Logger;

/**
 * Handles command processing for remote command execution
 * 
 * Processes commands received from the management server and executes
 * them on the Minecraft server with appropriate security checks.
 */
public class CommandHandler implements CommandExecutor {
    
    private final MochiLinkPlugin plugin;
    private final ConnectionManager connectionManager;
    private final Logger logger;
    
    public CommandHandler(MochiLinkPlugin plugin, ConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // This method handles local commands, not remote ones
        // Remote commands are handled through the MessageHandler
        return true;
    }
    
    /**
     * Execute a command with security checks
     */
    public CommandResult executeCommand(String command, String executor) {
        try {
            // Security checks
            if (!plugin.getPluginConfig().isAllowConsoleCommands()) {
                return new CommandResult(false, "", "Console commands are disabled");
            }
            
            // Check command blacklist
            String baseCommand = command.split(" ")[0].toLowerCase();
            if (plugin.getPluginConfig().isCommandBlacklisted(baseCommand)) {
                return new CommandResult(false, "", "Command is blacklisted: " + baseCommand);
            }
            
            // Log command execution attempt
            if (plugin.getPluginConfig().isLogCommands()) {
                logger.info(String.format("Executing remote command: %s (executor: %s)", command, executor));
            }
            
            // Execute command on main thread
            CommandResult result = new CommandResult(true, "Command queued for execution", null);
            
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                try {
                    boolean success = plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(), 
                        command
                    );
                    
                    // In a real implementation, you'd capture the actual output
                    String output = success ? "Command executed successfully" : "Command execution failed";
                    
                    // Log result
                    if (plugin.getPluginConfig().isLogCommands()) {
                        logger.info(String.format("Command result: %s, Success: %s", command, success));
                    }
                    
                } catch (Exception e) {
                    logger.warning("Command execution error: " + e.getMessage());
                }
            });
            
            return result;
            
        } catch (Exception e) {
            logger.warning("Failed to execute command: " + e.getMessage());
            return new CommandResult(false, "", e.getMessage());
        }
    }
    
    /**
     * Validate command before execution
     */
    public boolean isCommandAllowed(String command) {
        if (!plugin.getPluginConfig().isAllowConsoleCommands()) {
            return false;
        }
        
        String baseCommand = command.split(" ")[0].toLowerCase();
        return !plugin.getPluginConfig().isCommandBlacklisted(baseCommand);
    }
    
    /**
     * Get command execution timeout
     */
    public int getCommandTimeout() {
        return plugin.getPluginConfig().getCommandTimeout();
    }
    
    /**
     * Command execution result
     */
    public static class CommandResult {
        private final boolean success;
        private final String output;
        private final String error;
        private final long executionTime;
        
        public CommandResult(boolean success, String output, String error) {
            this.success = success;
            this.output = output != null ? output : "";
            this.error = error != null ? error : "";
            this.executionTime = System.currentTimeMillis();
        }
        
        public boolean isSuccess() { return success; }
        public String getOutput() { return output; }
        public String getError() { return error; }
        public long getExecutionTime() { return executionTime; }
    }
}