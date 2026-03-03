/**
 * Player Action Service
 *
 * Handles player management actions such as kicking, messaging, teleporting, etc.
 * This service is separate from PlayerInformationService to maintain separation
 * of concerns: information queries vs. action execution.
 */
import { Context } from 'koishi';
import { BaseConnectorBridge } from '../bridge/base';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
export interface PlayerKickOptions {
    playerId: string;
    playerName?: string;
    reason?: string;
    executor?: string;
}
export interface PlayerKickResult {
    success: boolean;
    playerId: string;
    reason?: string;
    error?: string;
    timestamp: Date;
}
export interface PlayerMessageOptions {
    playerId: string;
    playerName?: string;
    message: string;
    executor?: string;
}
export interface PlayerMessageResult {
    success: boolean;
    playerId: string;
    message: string;
    error?: string;
    timestamp: Date;
}
export interface PlayerTeleportOptions {
    playerId: string;
    targetPlayerId?: string;
    location?: {
        world: string;
        x: number;
        y: number;
        z: number;
    };
    executor?: string;
}
export interface PlayerTeleportResult {
    success: boolean;
    playerId: string;
    destination: string;
    error?: string;
    timestamp: Date;
}
export declare class PlayerActionService {
    private ctx;
    private getBridge;
    private auditService;
    private permissionManager;
    private logger;
    constructor(ctx: Context, getBridge: (serverId: string) => BaseConnectorBridge | null, auditService: AuditService, permissionManager: PermissionManager);
    /**
     * Kick a player from the server
     */
    kickPlayer(serverId: string, options: PlayerKickOptions): Promise<PlayerKickResult>;
    /**
     * Send a private message to a player
     */
    sendMessage(serverId: string, options: PlayerMessageOptions): Promise<PlayerMessageResult>;
    /**
     * Teleport a player to a location or another player
     */
    teleportPlayer(serverId: string, options: PlayerTeleportOptions): Promise<PlayerTeleportResult>;
    /**
     * Kick multiple players
     */
    kickPlayers(serverId: string, playerIds: string[], reason?: string, executor?: string): Promise<PlayerKickResult[]>;
    /**
     * Send message to multiple players
     */
    broadcastMessage(serverId: string, playerIds: string[], message: string, executor?: string): Promise<PlayerMessageResult[]>;
    /**
     * Ban a player from the server
     */
    banPlayer(serverId: string, options: {
        playerId: string;
        playerName?: string;
        reason: string;
        duration?: number;
        banType: 'uuid' | 'ip' | 'both';
        executor?: string;
    }): Promise<{
        success: boolean;
        playerId: string;
        reason: string;
        duration?: number;
        banType: string;
        error?: string;
        timestamp: Date;
    }>;
    /**
     * Unban a player from the server
     */
    unbanPlayer(serverId: string, options: {
        playerId: string;
        reason?: string;
        executor?: string;
    }): Promise<{
        success: boolean;
        playerId: string;
        error?: string;
        timestamp: Date;
    }>;
    /**
     * Get ban list from server
     */
    getBanList(serverId: string, banType?: 'uuid' | 'ip' | 'all'): Promise<{
        success: boolean;
        bans: Array<{
            playerId: string;
            playerName?: string;
            reason: string;
            bannedBy: string;
            bannedAt: string;
            expiresAt?: string;
            banType: 'uuid' | 'ip';
        }>;
        error?: string;
    }>;
}
