package com.mochilink.connector.commands;

import com.mochilink.connector.MochiLinkPlugin;
import com.mochilink.connector.connection.ConnectionManager;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Command executor for Mochi-Link plugin commands
 * 
 * Handles administrative commands for managing the plugin connection
 * and viewing status information.
 */
public class MochiLinkCommand implements CommandExecutor, TabCompleter {
    
    private final MochiLinkPlugin plugin;
    
    public MochiLinkCommand(MochiLinkPlugin plugin) {
        this.plugin = plugin;
    }
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        
        // Check permissions
        if (!sender.hasPermission("mochilink.admin")) {
            sender.sendMessage(ChatColor.RED + "You don't have permission to use this command.");
            return true;
        }
        
        // Handle different commands
        switch (label.toLowerCase()) {
            case "mochilink":
                return handleMainCommand(sender, args);
            case "mlstatus":
                return handleStatusCommand(sender);
            case "mlreconnect":
                return handleReconnectCommand(sender);
            default:
                return false;
        }
    }
    
    /**
     * Handle main mochilink command
     */
    private boolean handleMainCommand(CommandSender sender, String[] args) {
        if (args.length == 0) {
            showHelp(sender);
            return true;
        }
        
        switch (args[0].toLowerCase()) {
            case "status":
                return handleStatusCommand(sender);
                
            case "reconnect":
                return handleReconnectCommand(sender);
                
            case "disconnect":
                return handleDisconnectCommand(sender);
                
            case "reload":
                return handleReloadCommand(sender);
                
            case "info":
                return handleInfoCommand(sender);
                
            case "help":
            default:
                showHelp(sender);
                return true;
        }
    }
    
    /**
     * Handle status command
     */
    private boolean handleStatusCommand(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== Mochi-Link Status ===");
        
        // Plugin status
        sender.sendMessage(ChatColor.YELLOW + "Plugin Status: " + 
            (plugin.isPluginEnabled() ? ChatColor.GREEN + "Enabled" : ChatColor.RED + "Disabled"));
        
        // Connection status
        ConnectionManager connectionManager = plugin.getConnectionManager();
        if (connectionManager != null) {
            boolean connected = connectionManager.isConnected();
            sender.sendMessage(ChatColor.YELLOW + "Connection Status: " + 
                (connected ? ChatColor.GREEN + "Connected" : ChatColor.RED + "Disconnected"));
            
            if (connected) {
                ConnectionManager.ConnectionStats stats = connectionManager.getConnectionStats();
                sender.sendMessage(ChatColor.YELLOW + "Connection Time: " + 
                    ChatColor.WHITE + formatDuration(stats.getConnectionTime()));
            } else {
                sender.sendMessage(ChatColor.YELLOW + "Reconnect Attempts: " + 
                    ChatColor.WHITE + connectionManager.getReconnectAttempts());
            }
        }
        
        // Configuration info
        sender.sendMessage(ChatColor.YELLOW + "Server ID: " + 
            ChatColor.WHITE + plugin.getPluginConfig().getServerId());
        sender.sendMessage(ChatColor.YELLOW + "Connection Mode: " + 
            ChatColor.WHITE + plugin.getPluginConfig().getConnectionMode());
        
        return true;
    }
    
    /**
     * Handle reconnect command
     */
    private boolean handleReconnectCommand(CommandSender sender) {
        sender.sendMessage(ChatColor.YELLOW + "Attempting to reconnect to management server...");
        
        plugin.reconnect();
        
        sender.sendMessage(ChatColor.GREEN + "Reconnection initiated. Check status in a few seconds.");
        return true;
    }
    
    /**
     * Handle disconnect command
     */
    private boolean handleDisconnectCommand(CommandSender sender) {
        sender.sendMessage(ChatColor.YELLOW + "Disconnecting from management server...");
        
        ConnectionManager connectionManager = plugin.getConnectionManager();
        if (connectionManager != null) {
            connectionManager.disconnect();
            sender.sendMessage(ChatColor.GREEN + "Disconnected from management server.");
        } else {
            sender.sendMessage(ChatColor.RED + "Connection manager not available.");
        }
        
        return true;
    }
    
    /**
     * Handle reload command
     */
    private boolean handleReloadCommand(CommandSender sender) {
        sender.sendMessage(ChatColor.YELLOW + "Reloading Mochi-Link configuration...");
        
        try {
            plugin.getPluginConfig().load();
            sender.sendMessage(ChatColor.GREEN + "Configuration reloaded successfully.");
        } catch (Exception e) {
            sender.sendMessage(ChatColor.RED + "Failed to reload configuration: " + e.getMessage());
        }
        
        return true;
    }
    
    /**
     * Handle info command
     */
    private boolean handleInfoCommand(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== Mochi-Link Information ===");
        sender.sendMessage(ChatColor.YELLOW + "Plugin Version: " + 
            ChatColor.WHITE + plugin.getDescription().getVersion());
        sender.sendMessage(ChatColor.YELLOW + "Author: " + 
            ChatColor.WHITE + String.join(", ", plugin.getDescription().getAuthors()));
        sender.sendMessage(ChatColor.YELLOW + "Website: " + 
            ChatColor.WHITE + plugin.getDescription().getWebsite());
        sender.sendMessage(ChatColor.YELLOW + "Description: " + 
            ChatColor.WHITE + plugin.getDescription().getDescription());
        
        // Feature status
        sender.sendMessage(ChatColor.GOLD + "=== Enabled Features ===");
        List<String> enabledModules = plugin.getPluginConfig().getEnabledModules();
        for (String module : enabledModules) {
            sender.sendMessage(ChatColor.GREEN + "✓ " + ChatColor.WHITE + module);
        }
        
        return true;
    }
    
    /**
     * Show help message
     */
    private void showHelp(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== Mochi-Link Commands ===");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink status" + ChatColor.WHITE + " - Show connection status");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink reconnect" + ChatColor.WHITE + " - Reconnect to server");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink disconnect" + ChatColor.WHITE + " - Disconnect from server");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink reload" + ChatColor.WHITE + " - Reload configuration");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink info" + ChatColor.WHITE + " - Show plugin information");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink help" + ChatColor.WHITE + " - Show this help");
        sender.sendMessage(ChatColor.GRAY + "Aliases: /mlstatus, /mlreconnect");
    }
    
    /**
     * Format duration in milliseconds to human readable string
     */
    private String formatDuration(long milliseconds) {
        long seconds = milliseconds / 1000;
        long minutes = seconds / 60;
        long hours = minutes / 60;
        
        if (hours > 0) {
            return String.format("%dh %dm %ds", hours, minutes % 60, seconds % 60);
        } else if (minutes > 0) {
            return String.format("%dm %ds", minutes, seconds % 60);
        } else {
            return String.format("%ds", seconds);
        }
    }
    
    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> completions = new ArrayList<>();
        
        if (!sender.hasPermission("mochilink.admin")) {
            return completions;
        }
        
        if (args.length == 1) {
            List<String> subcommands = Arrays.asList("status", "reconnect", "disconnect", "reload", "info", "help");
            String partial = args[0].toLowerCase();
            
            for (String subcommand : subcommands) {
                if (subcommand.startsWith(partial)) {
                    completions.add(subcommand);
                }
            }
        }
        
        return completions;
    }
}