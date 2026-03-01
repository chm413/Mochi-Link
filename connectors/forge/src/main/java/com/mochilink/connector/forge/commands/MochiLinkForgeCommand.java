package com.mochilink.connector.forge.commands;

import com.mochilink.connector.forge.MochiLinkForgeMod;
import com.mochilink.connector.common.ReconnectionManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;

import java.text.SimpleDateFormat;
import java.util.Date;

import static net.minecraft.commands.Commands.literal;

/**
 * MochiLink Forge Command
 * 
 * Command handler for Forge mod.
 * 
 * @author chm413
 * @version 2.1.0
 */
public class MochiLinkForgeCommand {
    
    private final MochiLinkForgeMod mod;
    
    public MochiLinkForgeCommand(MochiLinkForgeMod mod) {
        this.mod = mod;
    }
    
    /**
     * Register commands
     */
    public void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(literal("mochilink")
            .requires(source -> source.hasPermission(3))
            .then(literal("status")
                .executes(this::handleStatus))
            .then(literal("reconnect")
                .executes(this::handleReconnect))
            .then(literal("retry")
                .executes(this::handleReconnect))
            .then(literal("info")
                .executes(this::handleInfo))
            .then(literal("stats")
                .executes(this::handleStats))
            .then(literal("config")
                .then(literal("get")
                    .executes(this::handleConfigGetAll)))
            .then(literal("reload")
                .executes(this::handleReload))
            .then(literal("subscriptions")
                .executes(this::handleSubscriptions))
            .then(literal("subs")
                .executes(this::handleSubscriptions))
            .then(literal("reconnection")
                .executes(this::handleReconnectionStatus)
                .then(literal("enable")
                    .executes(this::handleReconnectionEnable))
                .then(literal("disable")
                    .executes(this::handleReconnectionDisable))
                .then(literal("status")
                    .executes(this::handleReconnectionStatus)))
            .then(literal("recon")
                .executes(this::handleReconnectionStatus)
                .then(literal("enable")
                    .executes(this::handleReconnectionEnable))
                .then(literal("disable")
                    .executes(this::handleReconnectionDisable))
                .then(literal("status")
                    .executes(this::handleReconnectionStatus)))
            .then(literal("help")
                .executes(this::handleHelp))
            .executes(this::handleHelp));
    }
    
    /**
     * Handle status command
     */
    private int handleStatus(CommandContext<CommandSourceStack> ctx) {
        boolean connected = mod.isConnectedToManagement();
        String status = mod.getConnectionStatus();
        
        sendMessage(ctx, "§6=== MochiLink Forge Status ===");
        sendMessage(ctx, "§eMod: " + (mod.isModEnabled() ? "§aEnabled" : "§cDisabled"));
        sendMessage(ctx, "§eConnection: " + (connected ? "§a" + status : "§c" + status));
        
        if (mod.getConnectionManager() != null) {
            ReconnectionManager.ReconnectionStatus reconStatus = 
                mod.getConnectionManager().getReconnectionStatus();
            
            sendMessage(ctx, "§eReconnect Attempts: §f" + 
                reconStatus.currentAttempts + "/" + reconStatus.totalAttempts);
            sendMessage(ctx, "§eReconnection: " + 
                (reconStatus.disabled ? "§cDisabled" : "§aEnabled"));
        }
        
        return 1;
    }
    
    /**
     * Handle reconnect command
     */
    private int handleReconnect(CommandContext<CommandSourceStack> ctx) {
        sendMessage(ctx, "§eReconnecting to Mochi-Link management server...");
        
        // 如果重连被禁用，先启用它
        if (mod.getConnectionManager() != null) {
            ReconnectionManager.ReconnectionStatus status = 
                mod.getConnectionManager().getReconnectionStatus();
            if (status.disabled) {
                mod.getConnectionManager().enableReconnection();
                sendMessage(ctx, "§aReconnection re-enabled!");
            }
        }
        
        mod.reconnect();
        sendMessage(ctx, "§aReconnection initiated!");
        
        return 1;
    }
    
    /**
     * Handle info command
     */
    private int handleInfo(CommandContext<CommandSourceStack> ctx) {
        sendMessage(ctx, "§6=== MochiLink Forge Info ===");
        sendMessage(ctx, "§eVersion: §f2.1.0");
        sendMessage(ctx, "§eProtocol: §fU-WBP v2.0");
        sendMessage(ctx, "§eServer Type: §fForge");
        
        if (mod.getConfig() != null) {
            sendMessage(ctx, "§eServer ID: §f" + mod.getConfig().getServerId());
            sendMessage(ctx, "§eServer Name: §f" + mod.getConfig().getServerName());
            sendMessage(ctx, "§eManagement Host: §f" + 
                mod.getConfig().getMochiLinkHost() + ":" + mod.getConfig().getMochiLinkPort());
        }
        
        return 1;
    }
    
    /**
     * Handle stats command
     */
    private int handleStats(CommandContext<CommandSourceStack> ctx) {
        MinecraftServer server = ctx.getSource().getServer();
        
        sendMessage(ctx, "§6=== Server Statistics ===");
        sendMessage(ctx, "§ePlayers: §f" + 
            server.getPlayerCount() + "/" + server.getMaxPlayers());
        sendMessage(ctx, "§eTPS: §f" + 
            String.format("%.2f", server.getAverageTickTime()));
        
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
        long maxMemory = runtime.maxMemory() / 1024 / 1024;
        sendMessage(ctx, "§eMemory: §f" + usedMemory + "MB / " + maxMemory + "MB");
        
        return 1;
    }
    
    /**
     * Handle config get all command
     */
    private int handleConfigGetAll(CommandContext<CommandSourceStack> ctx) {
        if (mod.getConfig() == null) {
            sendMessage(ctx, "§cConfiguration not available");
            return 0;
        }
        
        sendMessage(ctx, "§6=== MochiLink Configuration ===");
        sendMessage(ctx, "§eserver-id: §f" + mod.getConfig().getServerId());
        sendMessage(ctx, "§eserver-name: §f" + mod.getConfig().getServerName());
        sendMessage(ctx, "§ehost: §f" + mod.getConfig().getMochiLinkHost());
        sendMessage(ctx, "§eport: §f" + mod.getConfig().getMochiLinkPort());
        sendMessage(ctx, "§eauto-reconnect: §f" + mod.getConfig().isAutoReconnectEnabled());
        
        return 1;
    }
    
    /**
     * Handle reload command
     */
    private int handleReload(CommandContext<CommandSourceStack> ctx) {
        sendMessage(ctx, "§eReloading MochiLink configuration...");
        
        try {
            mod.reloadConfig();
            sendMessage(ctx, "§aConfiguration reloaded successfully!");
            sendMessage(ctx, "§eReconnecting with new configuration...");
            mod.reconnect();
        } catch (Exception e) {
            sendMessage(ctx, "§cFailed to reload configuration: " + e.getMessage());
        }
        
        return 1;
    }
    
    /**
     * Handle subscriptions command
     */
    private int handleSubscriptions(CommandContext<CommandSourceStack> ctx) {
        if (mod.getSubscriptionManager() == null) {
            sendMessage(ctx, "§cSubscription manager not available");
            return 0;
        }
        
        var subscriptions = mod.getSubscriptionManager().getAllSubscriptions();
        
        sendMessage(ctx, "§6=== Active Event Subscriptions ===");
        
        if (subscriptions.isEmpty()) {
            sendMessage(ctx, "§7No active subscriptions");
            return 1;
        }
        
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        
        subscriptions.forEach((subId, subscription) -> {
            sendMessage(ctx, "§eID: §f" + subId);
            sendMessage(ctx, "§7  Events: " + String.join(", ", subscription.getEventTypes()));
            
            if (!subscription.getFilters().isEmpty()) {
                sendMessage(ctx, "§7  Filters: " + subscription.getFilters());
            }
            
            sendMessage(ctx, "§7  Created: " + sdf.format(new Date(subscription.getCreatedAt() * 1000)));
        });
        
        sendMessage(ctx, "§eTotal: §f" + subscriptions.size() + " subscriptions");
        
        return 1;
    }
    
    /**
     * Handle reconnection status command
     */
    private int handleReconnectionStatus(CommandContext<CommandSourceStack> ctx) {
        if (mod.getConnectionManager() == null) {
            sendMessage(ctx, "§cConnection manager not available");
            return 0;
        }
        
        ReconnectionManager.ReconnectionStatus status = 
            mod.getConnectionManager().getReconnectionStatus();
        
        sendMessage(ctx, "§6=== Reconnection Status ===");
        sendMessage(ctx, "§eEnabled: " + (status.disabled ? "§cNo" : "§aYes"));
        sendMessage(ctx, "§eCurrently Reconnecting: " + 
            (status.isReconnecting ? "§aYes" : "§7No"));
        sendMessage(ctx, "§eCurrent Attempts: §f" + status.currentAttempts);
        sendMessage(ctx, "§eTotal Attempts: §f" + status.totalAttempts);
        sendMessage(ctx, "§eNext Interval: §f" + status.nextInterval + "ms");
        
        if (status.lastAttemptTime > 0) {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            sendMessage(ctx, "§eLast Attempt: §f" + sdf.format(new Date(status.lastAttemptTime)));
        }
        
        return 1;
    }
    
    /**
     * Handle reconnection enable command
     */
    private int handleReconnectionEnable(CommandContext<CommandSourceStack> ctx) {
        if (mod.getConnectionManager() == null) {
            sendMessage(ctx, "§cConnection manager not available");
            return 0;
        }
        
        mod.getConnectionManager().enableReconnection();
        sendMessage(ctx, "§aReconnection enabled!");
        
        return 1;
    }
    
    /**
     * Handle reconnection disable command
     */
    private int handleReconnectionDisable(CommandContext<CommandSourceStack> ctx) {
        if (mod.getConnectionManager() == null) {
            sendMessage(ctx, "§cConnection manager not available");
            return 0;
        }
        
        mod.getConnectionManager().disableReconnection();
        sendMessage(ctx, "§eReconnection disabled!");
        
        return 1;
    }
    
    /**
     * Handle help command
     */
    private int handleHelp(CommandContext<CommandSourceStack> ctx) {
        sendMessage(ctx, "§6=== MochiLink Forge Commands ===");
        sendMessage(ctx, "§e/mochilink status §f- Check connection status");
        sendMessage(ctx, "§e/mochilink reconnect §f- Manually retry connection");
        sendMessage(ctx, "§e/mochilink info §f- Show mod information");
        sendMessage(ctx, "§e/mochilink stats §f- Show server statistics");
        sendMessage(ctx, "§e/mochilink config get §f- View configuration");
        sendMessage(ctx, "§e/mochilink reload §f- Reload configuration");
        sendMessage(ctx, "§e/mochilink subscriptions §f- List event subscriptions");
        sendMessage(ctx, "§e/mochilink reconnection <enable|disable|status> §f- Control reconnection");
        sendMessage(ctx, "§e/mochilink help §f- Show this help message");
        
        return 1;
    }
    
    /**
     * Send message to command source
     */
    private void sendMessage(CommandContext<CommandSourceStack> ctx, String message) {
        ctx.getSource().sendSuccess(() -> Component.literal(message), false);
    }
}
