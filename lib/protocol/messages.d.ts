/**
 * U-WBP v2 Protocol Message Definitions
 *
 * Defines all message types, operations, and data structures for the
 * Unified WebSocket Bridge Protocol version 2.
 */
import { UWBPMessage, UWBPRequest, UWBPResponse, UWBPEvent, UWBPSystemMessage, Player, PlayerDetail, ServerInfo, PerformanceMetrics, CommandResult } from '../types';
export declare const UWBP_VERSION = "2.0";
export declare const PROTOCOL_NAME = "U-WBP";
export type RequestOperation = 'server.getInfo' | 'server.getStatus' | 'server.getMetrics' | 'server.shutdown' | 'server.restart' | 'server.reload' | 'server.save' | 'player.list' | 'player.getInfo' | 'player.kick' | 'player.ban' | 'player.unban' | 'player.message' | 'player.teleport' | 'whitelist.get' | 'whitelist.add' | 'whitelist.remove' | 'whitelist.enable' | 'whitelist.disable' | 'command.execute' | 'command.suggest' | 'world.list' | 'world.getInfo' | 'world.setTime' | 'world.setWeather' | 'world.broadcast';
export type EventOperation = 'player.join' | 'player.leave' | 'player.chat' | 'player.death' | 'player.advancement' | 'player.move' | 'server.status' | 'server.logLine' | 'server.metrics' | 'alert.tpsLow' | 'alert.memoryHigh' | 'alert.playerFlood' | 'alert.diskSpace' | 'alert.connectionLost';
export type SystemOperation = 'ping' | 'pong' | 'handshake' | 'capabilities' | 'disconnect' | 'error';
export declare class MessageFactory {
    /**
     * Create a request message
     */
    static createRequest(op: RequestOperation, data?: any, options?: {
        id?: string;
        serverId?: string;
        timeout?: number;
    }): UWBPRequest;
    /**
     * Create a response message
     */
    static createResponse(requestId: string, op: string, data?: any, options?: {
        success?: boolean;
        error?: string;
        serverId?: string;
    }): UWBPResponse;
    /**
     * Create an event message
     */
    static createEvent(op: EventOperation, data?: any, options?: {
        serverId?: string;
        eventType?: string;
    }): UWBPEvent;
    /**
     * Create a system message
     */
    static createSystemMessage(op: SystemOperation, data?: any, options?: {
        serverId?: string;
    }): UWBPSystemMessage;
    /**
     * Create an error response
     */
    static createError(requestId: string, op: string, error: string, code?: string, details?: any): UWBPResponse;
    /**
     * Generate a unique message ID
     */
    private static generateId;
}
export interface ServerInfoData {
    info: ServerInfo;
}
export interface ServerStatusData {
    status: 'online' | 'offline' | 'starting' | 'stopping' | 'error';
    uptime?: number;
    playerCount?: number;
    maxPlayers?: number;
    tps?: number;
    memoryUsage?: {
        used: number;
        max: number;
        percentage: number;
    };
}
export interface ServerMetricsData {
    metrics: PerformanceMetrics;
}
export interface PlayerListData {
    players: Player[];
    online: number;
    max: number;
}
export interface PlayerInfoData {
    player: PlayerDetail;
}
export interface PlayerActionData {
    playerId: string;
    playerName?: string;
    reason?: string;
    message?: string;
    location?: {
        world: string;
        x: number;
        y: number;
        z: number;
    };
}
export interface WhitelistData {
    enabled: boolean;
    players: string[];
}
export interface WhitelistActionData {
    playerId: string;
    playerName?: string;
}
export interface CommandExecuteData {
    command: string;
    sender?: string;
    timeout?: number;
}
export interface CommandResultData {
    result: CommandResult;
}
export interface CommandSuggestData {
    partial: string;
    suggestions: string[];
}
export interface WorldListData {
    worlds: Array<{
        name: string;
        dimension: string;
        playerCount: number;
        loadedChunks: number;
    }>;
}
export interface WorldActionData {
    world?: string;
    time?: number | 'day' | 'night' | 'noon' | 'midnight';
    weather?: 'clear' | 'rain' | 'thunder';
    duration?: number;
    message?: string;
}
export interface PlayerJoinEventData {
    player: Player;
    firstJoin: boolean;
}
export interface PlayerLeaveEventData {
    playerId: string;
    playerName: string;
    reason?: 'quit' | 'kick' | 'ban' | 'timeout';
}
export interface PlayerChatEventData {
    playerId: string;
    playerName: string;
    message: string;
    channel?: string;
    recipients?: string[];
}
export interface PlayerDeathEventData {
    playerId: string;
    playerName: string;
    cause: string;
    killer?: string;
    location: {
        world: string;
        x: number;
        y: number;
        z: number;
    };
}
export interface ServerLogEventData {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    source?: string;
    thread?: string;
}
export interface AlertEventData {
    alertType: 'tps' | 'memory' | 'disk' | 'connection' | 'player';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value?: number;
    threshold?: number;
    details?: any;
}
export interface HandshakeData {
    protocolVersion: string;
    serverType: 'koishi' | 'connector';
    serverId?: string;
    capabilities: string[];
    authentication?: {
        token: string;
        method: 'token' | 'certificate';
    };
}
export interface CapabilitiesData {
    capabilities: string[];
    serverInfo?: {
        name: string;
        version: string;
        coreType: 'Java' | 'Bedrock';
        coreName: string;
    };
}
export interface DisconnectData {
    reason: string;
    code?: number;
    reconnect?: boolean;
    retryAfter?: number;
}
export declare function isUWBPMessage(obj: any): obj is UWBPMessage;
export declare function isUWBPRequest(obj: any): obj is UWBPRequest;
export declare function isUWBPResponse(obj: any): obj is UWBPResponse;
export declare function isUWBPEvent(obj: any): obj is UWBPEvent;
export declare function isUWBPSystemMessage(obj: any): obj is UWBPSystemMessage;
export declare class MessageUtils {
    /**
     * Extract operation category from operation string
     */
    static getOperationCategory(op: string): string;
    /**
     * Extract operation action from operation string
     */
    static getOperationAction(op: string): string;
    /**
     * Check if operation requires authentication
     */
    static requiresAuth(op: string): boolean;
    /**
     * Check if operation modifies server state
     */
    static isModifyingOperation(op: string): boolean;
    /**
     * Get expected response time for operation (in milliseconds)
     */
    static getExpectedResponseTime(op: string): number;
}
