package com.mochilink.connector.nukkit.handlers;

import com.mochilink.connector.nukkit.MochiLinkNukkitPlugin;
import com.mochilink.connector.nukkit.connection.NukkitConnectionManager;
import cn.nukkit.plugin.PluginLogger;

/**
 * Handles commands received from management server for Nukkit
 * Implements U-WBP v2 command protocol
 */
public class NukkitCommandHandler {
    
    private final MochiLinkNukkitPlugin plugin;
    private final NukkitConnectionManager connectionManager;
    private final PluginLogger logger;
    
    public NukkitCommandHandler(MochiLinkNukkitPlugin plugin, NukkitConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    /**
     * Execute command from management server
     */
    public void executeCommand(String command) {
        logger.info("Executing command: " + command);
        
        plugin.getServer().getScheduler().scheduleTask(plugin, () -> {
            try {
                plugin.getServer().dispatchCommand(
                    plugin.getServer().getConsoleSender(),
                    command
                );
                logger.info("Command executed successfully: " + command);
            } catch (Exception e) {
                logger.error("Failed to execute command: " + e.getMessage());
            }
        });
    }
    
    /**
     * Handle command response
     */
    public void handleCommandResponse(String response) {
        connectionManager.sendMessage(response);
    }
}
