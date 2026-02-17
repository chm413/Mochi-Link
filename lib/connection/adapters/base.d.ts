/**
 * Base Connection Adapter
 *
 * Abstract base class for all connection adapters, providing common
 * functionality and interface implementation.
 */
import { EventEmitter } from 'events';
import { ConnectionAdapter, ConnectionInfo, ConnectionStats } from '../types';
import { ConnectionConfig, ConnectionMode, UWBPMessage, CommandResult } from '../../types';
export declare abstract class BaseConnectionAdapter extends EventEmitter implements ConnectionAdapter {
    readonly serverId: string;
    readonly mode: ConnectionMode;
    capabilities: string[];
    protected _isConnected: boolean;
    protected _connectedAt?: Date;
    protected _lastActivity?: Date;
    protected _config?: ConnectionConfig;
    protected _stats: ConnectionStats;
    constructor(serverId: string, mode: ConnectionMode);
    get isConnected(): boolean;
    connect(config: ConnectionConfig): Promise<void>;
    disconnect(): Promise<void>;
    reconnect(): Promise<void>;
    sendMessage(message: UWBPMessage): Promise<void>;
    sendCommand(command: string): Promise<CommandResult>;
    getConnectionInfo(): ConnectionInfo;
    isHealthy(): boolean;
    protected abstract doConnect(config: ConnectionConfig): Promise<void>;
    protected abstract doDisconnect(): Promise<void>;
    protected abstract doSendMessage(message: UWBPMessage): Promise<void>;
    protected abstract doSendCommand(command: string): Promise<CommandResult>;
    protected abstract doHealthCheck(): boolean;
    protected updateStats(): void;
    protected recordMessage(): void;
    protected recordError(): void;
}
