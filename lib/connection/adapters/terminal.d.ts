/**
 * Terminal Injection Connection Adapter
 *
 * Handles terminal injection connections by taking control of a Minecraft
 * server process's stdin/stdout streams. This is used when no other connection
 * methods are available.
 */
import { BaseConnectionAdapter } from './base';
import { ConnectionConfig, UWBPMessage, CommandResult } from '../../types';
export declare class TerminalConnectionAdapter extends BaseConnectionAdapter {
    private process?;
    private outputBuffer;
    private commandQueue;
    private isProcessingCommand;
    private lastOutputTime;
    constructor(serverId: string);
    protected doConnect(config: ConnectionConfig): Promise<void>;
    protected doDisconnect(): Promise<void>;
    protected doSendMessage(message: UWBPMessage): Promise<void>;
    protected doSendCommand(command: string): Promise<CommandResult>;
    protected doHealthCheck(): boolean;
    private attachToProcess;
    private spawnProcess;
    private setupProcessHandlers;
    private handleOutput;
    private parseServerEvents;
    private processCommandQueue;
    private handleProcessExit;
    private rejectPendingCommands;
    /**
     * Get recent log lines
     */
    getRecentLogs(count?: number): string[];
    /**
     * Send raw input to process
     */
    sendRawInput(input: string): Promise<void>;
    /**
     * Get process information
     */
    getProcessInfo(): any;
}
