import { LSEBridge } from '../bridge/LSEBridge';
/**
 * LLBDS Command Handler
 *
 * Handles command registration and execution for LLBDS server
 * integration with the Mochi-Link management system.
 *
 * @author chm413
 * @version 1.0.0
 */
export declare class LLBDSCommandHandler {
    private lseBridge;
    private registeredCommands;
    constructor(lseBridge: LSEBridge);
    /**
     * Register all LLBDS commands
     */
    registerCommands(): void;
    /**
     * Unregister all commands
     */
    unregisterCommands(): void;
    /**
     * Register main Mochi-Link command
     */
    private registerMochiLinkCommand;
    /**
     * Register status command
     */
    private registerStatusCommand;
    /**
     * Register reload command
     */
    private registerReloadCommand;
    /**
     * Send help message to player
     */
    private sendHelpMessage;
    /**
     * Handle status command
     */
    private handleStatusCommand;
    /**
     * Handle reload command
     */
    private handleReloadCommand;
    /**
     * Handle connect command
     */
    private handleConnectCommand;
    /**
     * Handle disconnect command
     */
    private handleDisconnectCommand;
    /**
     * Handle info command
     */
    private handleInfoCommand;
    private handleConsoleStatusCommand;
    private handleConsoleReloadCommand;
    private handleConsoleConnectCommand;
    private handleConsoleDisconnectCommand;
    /**
     * Get registered commands
     */
    getRegisteredCommands(): string[];
    /**
     * Check if command is registered
     */
    isCommandRegistered(commandName: string): boolean;
}
//# sourceMappingURL=LLBDSCommandHandler.d.ts.map