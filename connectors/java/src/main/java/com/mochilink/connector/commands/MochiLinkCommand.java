package com.mochilink.connector.commands;

import com.mochilink.connector.MochiLinkPlugin;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

/**
 * MochiLink Command
 * 
 * Command handler for Bukkit/Spigot/Paper plugin.
 * 
 * @author chm413
 * @version 2.1.0
 */
public class MochiLinkCommand implements CommandExecutor, TabCompleter {
    
    private final MochiLinkPlugin plugin;
    
    public MochiLinkCommand(MochiLinkPlugin plugin) {
        this.plugin = plugin;
    }
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("mochilink.admin")) {
            sender.sendMessage(ChatColor.RED + "You don't have permission to use this command");
            return true;
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
                handleConfig(sender, Arrays.copyOfRange(args, 1, args.length));
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
                handleReconnectionControl(sender, Arrays.copyOfRange(args, 1, args.length));
                break;
                
            case "help":
                sendHelp(sender);
                break;
                
            default:
                sender.sendMessage(ChatColor.RED + "Unknown subcommand: " + subcommand);
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
        
        sender.sendMessage(ChatColor.GOLD + "=== MochiLink Status ===");
        sender.sendMessage(ChatColor.YELLOW + "Plugin: " + 
            (plugin.isPluginEnabled() ? ChatColor.GREEN + "Enabled" : ChatColor.RED + "Disabled"));
        sender.sendMessage(ChatColor.YELLOW + "Connection: " + 
            (connected ? ChatColor.GREEN + status : ChatColor.RED + status));
        
        if (plugin.getConnectionManager() != null) {
            var reconStatus = plugin.getConnectionManager().getReconnectionStatus();
            
            sender.sendMessage(ChatColor.YELLOW + "Reconnect Attempts: " + ChatColor.WHITE + 
                reconStatus.get("currentAttempts") + "/" + reconStatus.get("totalAttempts"));
            sender.sendMessage(ChatColor.YELLOW + "Reconnection: " + 
                ((Boolean)reconStatus.get("disabled") ? ChatColor.RED + "Disabled" : ChatColor.GREEN + "Enabled"));
        }
    }
    
    /**
     * Handle reconnect subcommand
     */
    private void handleReconnect(CommandSender sender) {
        sender.sendMessage(ChatColor.YELLOW + "Reconnecting to Mochi-Link management server...");
        
        // 如果重连被禁用，先启用它
        if (plugin.getConnectionManager() != null) {
            var status = plugin.getConnectionManager().getReconnectionStatus();
            if ((Boolean)status.get("disabled")) {
                plugin.getConnectionManager().enableReconnection();
                sender.sendMessage(ChatColor.GREEN + "Reconnection re-enabled!");
            }
        }
        
        plugin.reconnect();
        sender.sendMessage(ChatColor.GREEN + "Reconnection initiated!");
    }
    
    /**
     * Handle info subcommand
     */
    private void handleInfo(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== MochiLink Info ===");
        sender.sendMessage(ChatColor.YELLOW + "Version: " + ChatColor.WHITE + "2.1.0");
        sender.sendMessage(ChatColor.YELLOW + "Protocol: " + ChatColor.WHITE + "U-WBP v2.0");
        sender.sendMessage(ChatColor.YELLOW + "Server Type: " + ChatColor.WHITE + "Bukkit/Spigot/Paper");
        
        if (plugin.getConfig() != null) {
            sender.sendMessage(ChatColor.YELLOW + "Server ID: " + ChatColor.WHITE + 
                plugin.getConfig().getString("server-id", "unknown"));
            sender.sendMessage(ChatColor.YELLOW + "Server Name: " + ChatColor.WHITE + 
                plugin.getConfig().getString("server-name", "unknown"));
            sender.sendMessage(ChatColor.YELLOW + "Management Host: " + ChatColor.WHITE + 
                plugin.getConfig().getString("mochilink.host", "unknown") + ":" + 
                plugin.getConfig().getInt("mochilink.port", 0));
        }
    }
    
    /**
     * Handle stats subcommand
     */
    private void handleStats(CommandSender sender) {
        var server = plugin.getServer();
        
        sender.sendMessage(ChatColor.GOLD + "=== Server Statistics ===");
        sender.sendMessage(ChatColor.YELLOW + "Players: " + ChatColor.WHITE + 
            server.getOnlinePlayers().size() + "/" + server.getMaxPlayers());
        sender.sendMessage(ChatColor.YELLOW + "TPS: " + ChatColor.WHITE + 
            String.format("%.2f", server.getTPS()[0]));
        
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
        long maxMemory = runtime.maxMemory() / 1024 / 1024;
        sender.sendMessage(ChatColor.YELLOW + "Memory: " + ChatColor.WHITE + 
            usedMemory + "MB / " + maxMemory + "MB");
    }
    
    /**
     * Handle config subcommand
     */
    private void handleConfig(CommandSender sender, String[] args) {
        if (args.length == 0) {
            sender.sendMessage(ChatColor.RED + "Usage: /mochilink config <get|set> [key] [value]");
            return;
        }
        
        String action = args[0].toLowerCase();
        
        switch (action) {
            case "get":
                if (args.length == 1) {
                    showAllConfig(sender);
                } else {
                    getConfigValue(sender, args[1]);
                }
                break;
                
            case "set":
                if (args.length < 3) {
                    sender.sendMessage(ChatColor.RED + "Usage: /mochilink config set <key> <value>");
                    return;
                }
                setConfigValue(sender, args[1], args[2]);
                break;
                
            default:
                sender.sendMessage(ChatColor.RED + "Unknown config action: " + action);
                sender.sendMessage(ChatColor.YELLOW + "Available actions: get, set");
        }
    }
    
    /**
     * Show all config values
     */
    private void showAllConfig(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== MochiLink Configuration ===");
        sender.sendMessage(ChatColor.YELLOW + "server-id: " + ChatColor.WHITE + 
            plugin.getConfig().getString("server-id", "not set"));
        sender.sendMessage(ChatColor.YELLOW + "server-name: " + ChatColor.WHITE + 
            plugin.getConfig().getString("server-name", "not set"));
        sender.sendMessage(ChatColor.YELLOW + "host: " + ChatColor.WHITE + 
            plugin.getConfig().getString("mochilink.host", "not set"));
        sender.sendMessage(ChatColor.YELLOW + "port: " + ChatColor.WHITE + 
            plugin.getConfig().getInt("mochilink.port", 0));
        sender.sendMessage(ChatColor.YELLOW + "auto-reconnect: " + ChatColor.WHITE + 
            plugin.getConfig().getBoolean("mochilink.auto-reconnect", true));
    }
    
    /**
     * Get config value
     */
    private void getConfigValue(CommandSender sender, String key) {
        Object value = plugin.getConfig().get(key);
        
        if (value == null) {
            sender.sendMessage(ChatColor.RED + "Unknown config key: " + key);
            return;
        }
        
        sender.sendMessage(ChatColor.YELLOW + key + ": " + ChatColor.WHITE + value);
    }
    
    /**
     * Set config value
     */
    private void setConfigValue(CommandSender sender, String key, String value) {
        sender.sendMessage(ChatColor.YELLOW + "Setting " + key + " to " + value + "...");
        sender.sendMessage(ChatColor.GOLD + "Note: Config changes require /mochilink reload to take effect");
        sender.sendMessage(ChatColor.GOLD + "Please edit config.yml manually and use /mochilink reload");
    }
    
    /**
     * Handle reload subcommand
     */
    private void handleReload(CommandSender sender) {
        sender.sendMessage(ChatColor.YELLOW + "Reloading MochiLink configuration...");
        
        try {
            plugin.reloadPluginConfig();
            sender.sendMessage(ChatColor.GREEN + "Configuration reloaded successfully!");
            sender.sendMessage(ChatColor.YELLOW + "Reconnecting with new configuration...");
            plugin.reconnect();
        } catch (Exception e) {
            sender.sendMessage(ChatColor.RED + "Failed to reload configuration: " + e.getMessage());
        }
    }
    
    /**
     * Handle subscriptions subcommand
     */
    private void handleSubscriptions(CommandSender sender) {
        if (plugin.getSubscriptionManager() == null) {
            sender.sendMessage(ChatColor.RED + "Subscription manager not available");
            return;
        }
        
        var subscriptions = plugin.getSubscriptionManager().getAllSubscriptions();
        
        sender.sendMessage(ChatColor.GOLD + "=== Active Event Subscriptions ===");
        
        if (subscriptions.isEmpty()) {
            sender.sendMessage(ChatColor.GRAY + "No active subscriptions");
            return;
        }
        
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        
        subscriptions.forEach((subId, subscription) -> {
            sender.sendMessage(ChatColor.YELLOW + "ID: " + ChatColor.WHITE + subId);
            sender.sendMessage(ChatColor.GRAY + "  Events: " + String.join(", ", subscription.getEventTypes()));
            
            if (!subscription.getFilters().isEmpty()) {
                sender.sendMessage(ChatColor.GRAY + "  Filters: " + subscription.getFilters());
            }
            
            sender.sendMessage(ChatColor.GRAY + "  Created: " + 
                sdf.format(new Date(subscription.getCreatedAt() * 1000)));
        });
        
        sender.sendMessage(ChatColor.YELLOW + "Total: " + ChatColor.WHITE + subscriptions.size() + " subscriptions");
    }
    
    /**
     * Handle reconnection control subcommand
     */
    private void handleReconnectionControl(CommandSender sender, String[] args) {
        if (plugin.getConnectionManager() == null) {
            sender.sendMessage(ChatColor.RED + "Connection manager not available");
            return;
        }
        
        if (args.length == 0) {
            // 显示重连状态
            var status = plugin.getConnectionManager().getReconnectionStatus();
            
            sender.sendMessage(ChatColor.GOLD + "=== Reconnection Status ===");
            sender.sendMessage(ChatColor.YELLOW + "Enabled: " + 
                ((Boolean)status.get("disabled") ? ChatColor.RED + "No" : ChatColor.GREEN + "Yes"));
            sender.sendMessage(ChatColor.YELLOW + "Currently Reconnecting: " + 
                ((Boolean)status.get("isReconnecting") ? ChatColor.GREEN + "Yes" : ChatColor.GRAY + "No"));
            sender.sendMessage(ChatColor.YELLOW + "Current Attempts: " + ChatColor.WHITE + 
                status.get("currentAttempts"));
            sender.sendMessage(ChatColor.YELLOW + "Total Attempts: " + ChatColor.WHITE + 
                status.get("totalAttempts"));
            sender.sendMessage(ChatColor.YELLOW + "Next Interval: " + ChatColor.WHITE + 
                status.get("nextInterval") + "ms");
            
            if ((Long)status.get("lastAttemptTime") > 0) {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                sender.sendMessage(ChatColor.YELLOW + "Last Attempt: " + ChatColor.WHITE + 
                    sdf.format(new Date((Long)status.get("lastAttemptTime"))));
            }
            
            return;
        }
        
        String action = args[0].toLowerCase();
        
        switch (action) {
            case "enable":
                plugin.getConnectionManager().enableReconnection();
                sender.sendMessage(ChatColor.GREEN + "Reconnection enabled!");
                break;
                
            case "disable":
                plugin.getConnectionManager().disableReconnection();
                sender.sendMessage(ChatColor.YELLOW + "Reconnection disabled!");
                break;
                
            case "status":
                handleReconnectionControl(sender, new String[0]);
                break;
                
            default:
                sender.sendMessage(ChatColor.RED + "Unknown action: " + action);
                sender.sendMessage(ChatColor.YELLOW + "Available actions: enable, disable, status");
        }
    }
    
    /**
     * Send help message
     */
    private void sendHelp(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== MochiLink Commands ===");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink status" + ChatColor.WHITE + " - Check connection status");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink reconnect" + ChatColor.WHITE + " - Manually retry connection");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink info" + ChatColor.WHITE + " - Show plugin information");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink stats" + ChatColor.WHITE + " - Show server statistics");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink config <get|set>" + ChatColor.WHITE + " - Manage configuration");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink reload" + ChatColor.WHITE + " - Reload configuration");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink subscriptions" + ChatColor.WHITE + " - List event subscriptions");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink reconnection <enable|disable|status>" + ChatColor.WHITE + " - Control reconnection");
        sender.sendMessage(ChatColor.YELLOW + "/mochilink help" + ChatColor.WHITE + " - Show this help message");
    }
    
    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!sender.hasPermission("mochilink.admin")) {
            return new ArrayList<>();
        }
        
        if (args.length == 1) {
            return Arrays.asList("status", "reconnect", "info", "stats", "config", "reload", 
                "subscriptions", "reconnection", "help")
                .stream()
                .filter(s -> s.startsWith(args[0].toLowerCase()))
                .collect(Collectors.toList());
        }
        
        if (args.length == 2) {
            switch (args[0].toLowerCase()) {
                case "config":
                    return Arrays.asList("get", "set")
                        .stream()
                        .filter(s -> s.startsWith(args[1].toLowerCase()))
                        .collect(Collectors.toList());
                    
                case "reconnection":
                case "recon":
                    return Arrays.asList("enable", "disable", "status")
                        .stream()
                        .filter(s -> s.startsWith(args[1].toLowerCase()))
                        .collect(Collectors.toList());
            }
        }
        
        return new ArrayList<>();
    }
}
