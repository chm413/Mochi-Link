package com.mochilink.connector.folia.commands;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.ChatColor;

/**
 * Command executor for Folia plugin commands
 */
public class MochiLinkFoliaCommand implements CommandExecutor {
    
    private final MochiLinkFoliaPlugin plugin;
    
    public MochiLinkFoliaCommand(MochiLinkFoliaPlugin plugin) {
        this.plugin = plugin;
    }
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        String cmd = command.getName().toLowerCase();
        
        switch (cmd) {
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
    
    private boolean handleMainCommand(CommandSender sender, String[] args) {
        sender.sendMessage(ChatColor.GOLD + "=== Mochi-Link Folia Connector ===");
        sender.sendMessage(ChatColor.YELLOW + "Version: 1.0.0");
        sender.sendMessage(ChatColor.YELLOW + "Commands:");
        sender.sendMessage(ChatColor.GRAY + "  /mochilink - Show this help");
        sender.sendMessage(ChatColor.GRAY + "  /mlstatus - Show connection status");
        sender.sendMessage(ChatColor.GRAY + "  /mlreconnect - Reconnect to server");
        return true;
    }
    
    private boolean handleStatusCommand(CommandSender sender) {
        boolean connected = plugin.isConnectedToManagement();
        String status = connected ? ChatColor.GREEN + "Connected" : ChatColor.RED + "Disconnected";
        
        sender.sendMessage(ChatColor.GOLD + "=== Mochi-Link Status ===");
        sender.sendMessage(ChatColor.YELLOW + "Status: " + status);
        sender.sendMessage(ChatColor.YELLOW + "Plugin: " + (plugin.isPluginEnabled() ? ChatColor.GREEN + "Enabled" : ChatColor.RED + "Disabled"));
        
        return true;
    }
    
    private boolean handleReconnectCommand(CommandSender sender) {
        if (!sender.hasPermission("mochilink.admin")) {
            sender.sendMessage(ChatColor.RED + "You don't have permission to use this command");
            return true;
        }
        
        sender.sendMessage(ChatColor.YELLOW + "Reconnecting to management server...");
        plugin.reconnect();
        
        return true;
    }
}
