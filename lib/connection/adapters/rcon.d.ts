/**
 * RCON Connection Adapter
 *
 * Handles RCON (Remote Console) connections to Minecraft servers.
 * This mode is used when servers have RCON enabled but no plugin support.
 */
import { BaseConnectionAdapter } from './base';
import { ConnectionConfig, UWBPMessage, CommandResult } from '../../types';
export declare class RCONConnectionAdapter extends BaseConnectionAdapter {
    private socket?;
    private isAuthenticated;
    private requestId;
    private pendingRequests;
    private buffer;
    constructor(serverId: string);
    protected doConnect(config: ConnectionConfig): Promise<void>;
    protected doDisconnect(): Promise<void>;
    protected doSendMessage(message: UWBPMessage): Promise<void>;
    protected doSendCommand(command: string): Promise<CommandResult>;
    protected doHealthCheck(): boolean;
    private authenticate;
    private sendPacket;
    private handleData;
    private parsePacket;
    private handlePacket;
    private handleDisconnection;
    private rejectPendingRequests;
    /**
     * Get server information via RCON commands
     */
    getServerInfo(): Promise<any>;
    /**
     * Check if server is responsive
     */
    ping(): Promise<number>;
}
