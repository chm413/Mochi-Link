/**
 * Connection Mode Management Types
 *
 * Type definitions for connection adapters, managers, and related functionality.
 */
import { EventEmitter } from 'events';
import { ConnectionConfig, ConnectionMode, UWBPMessage, CommandResult, MochiLinkError } from '../types';
export interface ConnectionAdapter extends EventEmitter {
    readonly serverId: string;
    readonly mode: ConnectionMode;
    readonly isConnected: boolean;
    readonly capabilities: string[];
    connect(config: ConnectionConfig): Promise<void>;
    disconnect(): Promise<void>;
    reconnect(): Promise<void>;
    sendMessage(message: UWBPMessage): Promise<void>;
    sendCommand(command: string): Promise<CommandResult>;
    getConnectionInfo(): ConnectionInfo;
    isHealthy(): boolean;
}
export interface ConnectionInfo {
    serverId: string;
    mode: ConnectionMode;
    isConnected: boolean;
    connectedAt?: Date;
    lastActivity?: Date;
    capabilities: string[];
    stats: ConnectionStats;
    config: ConnectionConfig;
}
export interface ConnectionStats {
    messagesReceived: number;
    messagesSent: number;
    commandsExecuted: number;
    errors: number;
    uptime: number;
    latency?: number;
}
export declare class ConnectionModeError extends MochiLinkError {
    mode: ConnectionMode;
    serverId: string;
    constructor(message: string, mode: ConnectionMode, serverId: string);
}
