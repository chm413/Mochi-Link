package com.mochilink.connector.folia.handlers;

import com.mochilink.connector.folia.MochiLinkFoliaPlugin;
import com.mochilink.connector.folia.connection.FoliaConnectionManager;

import java.util.logging.Logger;

/**
 * Handles commands received from management server for Folia
 * Executes commands using Folia's region scheduler
 */
public class FoliaCommandHandler {
    
    private final MochiLinkFoliaPlugin plugin;
    private final FoliaConnectionManager connectionManager;
    private final Logger logger;
    
    public FoliaCommandHandler(MochiLinkFoliaPlugin plugin, FoliaConnectionManager connectionManager) {
        this.plugin = plugin;
        this.connectionManager = connectionManager;
        this.logger = plugin.getLogger();
    }
    
    /**
     * Execute command from management server
     */
    public void executeCommand(String command) {
        logger.info("Executing command: " + command);
        
        // Use Folia's global region scheduler for server commands
        plugin.getServer().getGlobalRegionScheduler().run(plugin, (task) -> {
            try {
                plugin.getServer().dispatchCommand(
                    plugin.getServer().getConsoleSender(),
                    command
                );
                logger.info("Command executed successfully: " + command);
            } catch (Exception e) {
                logger.severe("Failed to execute command: " + e.getMessage());
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
