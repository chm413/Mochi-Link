/**
 * Plugin Connection Adapter
 *
 * Handles WebSocket connections to Minecraft server plugins (Connector Bridge).
 * This is the primary connection mode for servers with plugin support.
 */
import { BaseConnectionAdapter } from './base';
import { ConnectionConfig, UWBPMessage, CommandResult } from '../../types';
export declare class PluginConnectionAdapter extends BaseConnectionAdapter {
    private ws?;
    private reconnectTimer?;
    private heartbeatTimer?;
    private pendingRequests;
    constructor(serverId: string);
    protected doConnect(config: ConnectionConfig): Promise<void>;
    protected doDisconnect(): Promise<void>;
    protected doSendMessage(message: UWBPMessage): Promise<void>;
    protected doSendCommand(command: string): Promise<CommandResult>;
    protected doHealthCheck(): boolean;
    private handleMessage;
    private handleResponse;
    private handleSystemMessage;
    private handleDisconnection;
    private sendRequestAndWait;
    private rejectPendingRequests;
    private setupHeartbeat;
    private sendPing;
    private sendPong;
    private sendDisconnectMessage;
    private clearTimers;
}
