package com.mochilink.connector.nukkit.commands;

import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;

import cn.nukkit.command.Command;
import cn.nukkit.command.CommandSender;
import cn.nukkit.utils.TextFormat;

/**
 * Command executor for Nukkit plugin commands
 */
public class MochiLinkNukkitCommand extends Command {
    
    private final MochiLinkNukkitPlugin plugin;
    
    public MochiLinkNukkitCommand(MochiLinkNukkitPlugin plugin) {
        super("mochilink", "Mochi-Link connector commands", "/mochilink [status|reconnect]", new String[]{"ml"});
        this.plugin = plugin;
    }
    
    @Override
    public boolean execute(CommandSender sender, String label, String[] args) {
        if (args.length == 0) {
            return handleMainCommand(sender);
        }
        
        String subCommand = args[0].toLowerCase();
        switch (subCommand) {
            case "status":
                return handleStatusCommand(sender);
            case "reconnect":
                return handleReconnectCommand(sender);
            default:
                return handleMainCommand(sender);
        }
    }
    
    private boolean handleMainCommand(CommandSender sender) {
        sender.sendMessage(TextFormat.GOLD + "=== Mochi-Link Nukkit Connector ===");
        sender.sendMessage(TextFormat.YELLOW + "Version: 1.0.0");
        sender.sendMessage(TextFormat.YELLOW + "Commands:");
        sender.sendMessage(TextFormat.GRAY + "  /mochilink - Show this help");
        sender.sendMessage(TextFormat.GRAY + "  /mochilink status - Show connection status");
        sender.sendMessage(TextFormat.GRAY + "  /mochilink reconnect - Reconnect to server");
        return true;
    }
    
    private boolean handleStatusCommand(CommandSender sender) {
        boolean connected = plugin.isConnectedToManagement();
        String status = connected ? TextFormat.GREEN + "Connected" : TextFormat.RED + "Disconnected";
        
        sender.sendMessage(TextFormat.GOLD + "=== Mochi-Link Status ===");
        sender.sendMessage(TextFormat.YELLOW + "Status: " + status);
        sender.sendMessage(TextFormat.YELLOW + "Plugin: " + (plugin.isPluginEnabled() ? TextFormat.GREEN + "Enabled" : TextFormat.RED + "Disabled"));
        
        return true;
    }
    
    private boolean handleReconnectCommand(CommandSender sender) {
        if (!sender.hasPermission("mochilink.admin")) {
            sender.sendMessage(TextFormat.RED + "You don't have permission to use this command");
            return true;
        }
        
        sender.sendMessage(TextFormat.YELLOW + "Reconnecting to management server...");
        plugin.reconnect();
        
        return true;
    }
}
