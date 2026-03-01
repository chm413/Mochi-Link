package com.mochilink.connector.nukkit.commands;

import cn.nukkit.command.Command;
import cn.nukkit.command.CommandSender;
import cn.nukkit.utils.TextFormat;
import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;

import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * MochiLink Nukkit Command
 * 
 * Command handler for Nukkit plugin.
 * 
 * @author chm413
 * @version 2.1.0
 */
public class MochiLinkNukkitCommand extends Command {
    
    private final MochiLinkNukkitPlugin plugin;
    
    public MochiLinkNukkitCommand(MochiLinkNukkitPlugin plugin) {
        super("mochilink", "MochiLink management command", "/mochilink <subcommand>", new String[]{"ml", "mochi"});
        this.setPermission("mochilink.admin");
        this.plugin = plugin;
    }
    
    @Override
    public boolean execute(CommandSender sender, String label, String[] args) {
        if (!this.testPermission(sender)) {
            return false;
        }
        
        if (args.length == 0) {
            sendHelp(sender);
            return true;
        }
        
        String subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case "status":
                handleStatus(sender);
                break;
                
            case "reconnect":
            case "retry":
                handleReconnect(sender);
                break;
                
            case "info":
                handleInfo(sender);
                break;
                
            case "stats":
                handleStats(sender);
                break;
                
            case "config":
                if (args.length > 1) {
                    handleConfig(sender, args);
                } else {
                    sender.sendMessage(TextFormat.RED + "Usage: /mochilink config <get|set> [key] [value]");
                }
                break;
                
            case "reload":
                handleReload(sender);
                break;
                
            case "subscriptions":
            case "subs":
                handleSubscriptions(sender);
                break;
                
            case "reconnection":
            case "recon":
                handleReconnectionControl(sender, args);
                break;
                
            case "help":
                sendHelp(sender);
                break;
                
            default:
                sender.sendMessage(TextFormat.RED + "Unknown subcommand: " + subcommand);
                sendHelp(sender);
        }
        
        return true;
    }
    
    /**
     * Handle status subcommand
     */
    private void handleStatus(CommandSender sender) {
        boolean connected = plugin.isConnectedToManagement();
        String status = plugin.getConnectionStatus();
        
        sender.sendMessage(TextFormat.GOLD + "=== MochiLink Nukkit Status ===");
        sender.sendMessage(TextFormat.YELLOW + "Plugin: " + 
            (plugin.isPluginEnabled() ? TextFormat.GREEN + "Enabled" : TextFormat.RED + "Disabled"));
        sender.sendMessage(TextFormat.YELLOW + "Connection: " + 
            (connected ? TextFormat.GREEN + status : TextFormat.RED + status));
        
        if (plugin.getConnectionManager() != null) {
            var reconStatus = plugin.getConnectionManager().getReconnectionStatus();
            
            sender.sendMessage(TextFormat.YELLOW + "Reconnect Attempts: " + TextFormat.WHITE + 
                reconStatus.get("currentAttempts") + "/" + reconStatus.get("totalAttempts"));
            sender.sendMessage(TextFormat.YELLOW + "Reconnection: " + 
                ((Boolean)reconStatus.get("disabled") ? TextFormat.RED + "Disabled" : TextFormat.GREEN + "Enabled"));
        }
    }
    
    /**
     * Handle reconnect subcommand
     */
    private void handleReconnect(CommandSender sender) {
        sender.sendMessage(TextFormat.YELLOW + "Reconnecting to Mochi-Link management server...");
        
        // 如果重连被禁用，先启用它
        if (plugin.getConnectionManager() != null) {
            var status = plugin.getConnectionManager().getReconnectionStatus();
            if ((Boolean)status.get("disabled")) {
                plugin.getConnectionManager().enableReconnection();
                sender.sendMessage(TextFormat.GREEN + "Reconnection re-enabled!");
            }
        }
        
        plugin.reconnect();
        sender.sendMessage(TextFormat.GREEN + "Reconnection initiated!");
    }
    
    /**
     * Handle info subcommand
     */
    private void handleInfo(CommandSender sender) {
        sender.sendMessage(TextFormat.GOLD + "=== MochiLink Nukkit Info ===");
        sender.sendMessage(TextFormat.YELLOW + "Version: " + TextFormat.WHITE + "2.1.0");
        sender.sendMessage(TextFormat.YELLOW + "Protocol: " + TextFormat.WHITE + "U-WBP v2.0");
        sender.sendMessage(TextFormat.YELLOW + "Server Type: " + TextFormat.WHITE + "Nukkit");
        
        if (plugin.getPluginConfig() != null) {
            sender.sendMessage(TextFormat.YELLOW + "Server ID: " + TextFormat.WHITE + 
                plugin.getPluginConfig().getServerId());
            sender.sendMessage(TextFormat.YELLOW + "Server Name: " + TextFormat.WHITE + 
                plugin.getPluginConfig().getServerName());
            sender.sendMessage(TextFormat.YELLOW + "Management Host: " + TextFormat.WHITE + 
                plugin.getPluginConfig().getMochiLinkHost() + ":" + 
                plugin.getPluginConfig().getMochiLinkPort());
        }
    }
    
    /**
     * Handle stats subcommand
     */
    private void handleStats(CommandSender sender) {
        var server = plugin.getServer();
        
        sender.sendMessage(TextFormat.GOLD + "=== Server Statistics ===");
        sender.sendMessage(TextFormat.YELLOW + "Players: " + TextFormat.WHITE + 
            server.getOnlinePlayers().size() + "/" + server.getMaxPlayers());
        sender.sendMessage(TextFormat.YELLOW + "TPS: " + TextFormat.WHITE + 
            String.format("%.2f", server.getTicksPerSecond()));
        
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
        long maxMemory = runtime.maxMemory() / 1024 / 1024;
        sender.sendMessage(TextFormat.YELLOW + "Memory: " + TextFormat.WHITE + 
            usedMemory + "MB / " + maxMemory + "MB");
    }
    
    /**
     * Handle config subcommand
     */
    private void handleConfig(CommandSender sender, String[] args) {
        String action = args[1].toLowerCase();
        
        switch (action) {
            case "get":
                if (args.length == 2) {
                    showAllConfig(sender);
                } else {
                    getConfigValue(sender, args[2]);
                }
                break;
                
            case "set":
                if (args.length < 4) {
                    sender.sendMessage(TextFormat.RED + "Usage: /mochilink config set <key> <value>");
                    return;
                }
                setConfigValue(sender, args[2], args[3]);
                break;
                
            default:
                sender.sendMessage(TextFormat.RED + "Unknown config action: " + action);
                sender.sendMessage(TextFormat.YELLOW + "Available actions: get, set");
        }
    }
    
    /**
     * Show all config values
     */
    private void showAllConfig(CommandSender sender) {
        if (plugin.getPluginConfig() == null) {
            sender.sendMessage(TextFormat.RED + "Configuration not available");
            return;
        }
        
        var config = plugin.getPluginConfig();
        
        sender.sendMessage(TextFormat.GOLD + "=== MochiLink Configuration ===");
        sender.sendMessage(TextFormat.YELLOW + "server-id: " + TextFormat.WHITE + config.getServerId());
        sender.sendMessage(TextFormat.YELLOW + "server-name: " + TextFormat.WHITE + config.getServerName());
        sender.sendMessage(TextFormat.YELLOW + "host: " + TextFormat.WHITE + config.getMochiLinkHost());
        sender.sendMessage(TextFormat.YELLOW + "port: " + TextFormat.WHITE + config.getMochiLinkPort());
        sender.sendMessage(TextFormat.YELLOW + "auto-reconnect: " + TextFormat.WHITE + 
            config.isAutoReconnectEnabled());
    }
    
    /**
     * Get config value
     */
    private void getConfigValue(CommandSender sender, String key) {
        sender.sendMessage(TextFormat.YELLOW + "Use /mochilink config get to see all values");
    }
    
    /**
     * Set config value
     */
    private void setConfigValue(CommandSender sender, String key, String value) {
        sender.sendMessage(TextFormat.YELLOW + "Setting " + key + " to " + value + "...");
        sender.sendMessage(TextFormat.GOLD + "Note: Config changes require /mochilink reload to take effect");
        sender.sendMessage(TextFormat.GOLD + "Please edit config.yml manually and use /mochilink reload");
    }
    
    /**
     * Handle reload subcommand
     */
    private void handleReload(CommandSender sender) {
        sender.sendMessage(TextFormat.YELLOW + "Reloading MochiLink configuration...");
        
        try {
            plugin.reloadPluginConfig();
            sender.sendMessage(TextFormat.GREEN + "Configuration reloaded successfully!");
            sender.sendMessage(TextFormat.YELLOW + "Reconnecting with new configuration...");
            plugin.reconnect();
        } catch (Exception e) {
            sender.sendMessage(TextFormat.RED + "Failed to reload configuration: " + e.getMessage());
        }
    }
    
    /**
     * Handle subscriptions subcommand
     */
    private void handleSubscriptions(CommandSender sender) {
        if (plugin.getSubscriptionManager() == null) {
            sender.sendMessage(TextFormat.RED + "Subscription manager not available");
            return;
        }
        
        var subscriptions = plugin.getSubscriptionManager().getAllSubscriptions();
        
        sender.sendMessage(TextFormat.GOLD + "=== Active Event Subscriptions ===");
        
        if (subscriptions.isEmpty()) {
            sender.sendMessage(TextFormat.GRAY + "No active subscriptions");
            return;
        }
        
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        
        subscriptions.forEach((subId, subscription) -> {
            sender.sendMessage(TextFormat.YELLOW + "ID: " + TextFormat.WHITE + subId);
            sender.sendMessage(TextFormat.GRAY + "  Events: " + String.join(", ", subscription.getEventTypes()));
            
            if (!subscription.getFilters().isEmpty()) {
                sender.sendMessage(TextFormat.GRAY + "  Filters: " + subscription.getFilters());
            }
            
            sender.sendMessage(TextFormat.GRAY + "  Created: " + 
                sdf.format(new Date(subscription.getCreatedAt() * 1000)));
        });
        
        sender.sendMessage(TextFormat.YELLOW + "Total: " + TextFormat.WHITE + subscriptions.size() + " subscriptions");
    }
    
    /**
     * Handle reconnection control subcommand
     */
    private void handleReconnectionControl(CommandSender sender, String[] args) {
        if (plugin.getConnectionManager() == null) {
            sender.sendMessage(TextFormat.RED + "Connection manager not available");
            return;
        }
        
        if (args.length == 1) {
            // 显示重连状态
            var status = plugin.getConnectionManager().getReconnectionStatus();
            
            sender.sendMessage(TextFormat.GOLD + "=== Reconnection Status ===");
            sender.sendMessage(TextFormat.YELLOW + "Enabled: " + 
                ((Boolean)status.get("disabled") ? TextFormat.RED + "No" : TextFormat.GREEN + "Yes"));
            sender.sendMessage(TextFormat.YELLOW + "Currently Reconnecting: " + 
                ((Boolean)status.get("isReconnecting") ? TextFormat.GREEN + "Yes" : TextFormat.GRAY + "No"));
            sender.sendMessage(TextFormat.YELLOW + "Current Attempts: " + TextFormat.WHITE + 
                status.get("currentAttempts"));
            sender.sendMessage(TextFormat.YELLOW + "Total Attempts: " + TextFormat.WHITE + 
                status.get("totalAttempts"));
            sender.sendMessage(TextFormat.YELLOW + "Next Interval: " + TextFormat.WHITE + 
                status.get("nextInterval") + "ms");
            
            if ((Long)status.get("lastAttemptTime") > 0) {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                sender.sendMessage(TextFormat.YELLOW + "Last Attempt: " + TextFormat.WHITE + 
                    sdf.format(new Date((Long)status.get("lastAttemptTime"))));
            }
            
            return;
        }
        
        String action = args[1].toLowerCase();
        
        switch (action) {
            case "enable":
                plugin.getConnectionManager().enableReconnection();
                sender.sendMessage(TextFormat.GREEN + "Reconnection enabled!");
                break;
                
            case "disable":
                plugin.getConnectionManager().disableReconnection();
                sender.sendMessage(TextFormat.YELLOW + "Reconnection disabled!");
                break;
                
            case "status":
                handleReconnectionControl(sender, new String[]{"reconnection"});
                break;
                
            default:
                sender.sendMessage(TextFormat.RED + "Unknown action: " + action);
                sender.sendMessage(TextFormat.YELLOW + "Available actions: enable, disable, status");
        }
    }
    
    /**
     * Send help message
     */
    private void sendHelp(CommandSender sender) {
        sender.sendMessage(TextFormat.GOLD + "=== MochiLink Nukkit Commands ===");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink status" + TextFormat.WHITE + " - Check connection status");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink reconnect" + TextFormat.WHITE + " - Manually retry connection");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink info" + TextFormat.WHITE + " - Show plugin information");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink stats" + TextFormat.WHITE + " - Show server statistics");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink config <get|set>" + TextFormat.WHITE + " - Manage configuration");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink reload" + TextFormat.WHITE + " - Reload configuration");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink subscriptions" + TextFormat.WHITE + " - List event subscriptions");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink reconnection <enable|disable|status>" + TextFormat.WHITE + " - Control reconnection");
        sender.sendMessage(TextFormat.YELLOW + "/mochilink help" + TextFormat.WHITE + " - Show this help message");
    }
}
