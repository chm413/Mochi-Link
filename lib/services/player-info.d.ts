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
}
