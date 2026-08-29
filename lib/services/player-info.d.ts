/**
 * Player Information Management Service
 *
 * Provides unified player information query interface and handles
 * non-premium player identity recognition across different server types.
 */
import { EventEmitter } from 'events';
import { Player, PlayerDetail, PlayerIdentity, IdentityMarkers } from '../types';
import { BaseConnectorBridge } from '../bridge/base';
export interface PlayerInfoServiceConfig {
    cacheTimeout: number;
    maxCacheSize: number;
    identityConfidenceThreshold: number;
    conflictDetectionEnabled: boolean;
    enableCrossServerMatching: boolean;
    matchingCriteria: ('uuid' | 'xuid' | 'name' | 'ip' | 'device')[];
}
export interface PlayerQuery {
    serverId?: string;
    playerId?: string;
    playerName?: string;
    ipAddress?: string;
    includeOffline?: boolean;
}
export interface PlayerInfoResult {
    player: PlayerDetail;
    identity: PlayerIdentity;
    lastUpdated: Date;
    source: 'cache' | 'server' | 'aggregated';
}
export declare class PlayerInfoService extends EventEmitter {
    private config;
    private bridges;
    private playerCache;
    private database;
    private cacheCleanupInterval?;
    constructor(config?: Partial<PlayerInfoServiceConfig>, database?: any);
    /**
     * Register a bridge for player information queries
     */
    registerBridge(serverId: string, bridge: BaseConnectorBridge): void;
    /**
     * Unregister a bridge
     */
    unregisterBridge(serverId: string): void;
    /**
     * Get unified player information
     */
    getPlayerInfo(query: PlayerQuery): Promise<PlayerInfoResult | null>;
    /**
     * Get online players from all servers
     */
    getOnlinePlayersAll(): Promise<Map<string, Player[]>>;
    /**
     * Search players by criteria
     */
    searchPlayers(criteria: {
        name?: string;
        uuid?: string;
        xuid?: string;
        serverId?: string;
        isOnline?: boolean;
    }): Promise<PlayerInfoResult[]>;
    /**
     * Resolve player identity across servers
     */
    resolvePlayerIdentity(playerData: Player[]): Promise<PlayerIdentity>;
    /**
     * Detect identity conflicts for non-premium players
     */
    detectIdentityConflicts(playerId: string): Promise<PlayerIdentity[]>;
    /**
     * Update player identity markers
     */
    updateIdentityMarkers(playerId: string, serverId: string, markers: Partial<IdentityMarkers>): Promise<void>;
    private queryServerPlayerInfo;
    private queryCrossServerPlayerInfo;
    private aggregatePlayerResults;
    /**
     * 身份解析按名称归组：同一名称下的多条记录合并为一个待判定的身份，
     * 组内出现多个不同 UUID/XUID 即构成冲突（需求 4.3 / 属性 4）。
     * 旧实现按 uuid/ip/device 签名拆组，同名不同 UUID 的记录被分散，
     * 冲突永远无法被检测到——已修复。
     */
    private groupByIdentityMarkers;
    private calculateIdentityConfidence;
    private calculateConfidenceScore;
    private matchesCriteria;
    private searchInDatabase;
    private deduplicateResults;
    private updateDatabaseMarkers;
    private generateCacheKey;
    private isCacheValid;
    private cachePlayerInfo;
    private cleanupCache;
    private handlePlayerEvent;
    /**
     * Cleanup resources
     */
    cleanup(): void;
}
