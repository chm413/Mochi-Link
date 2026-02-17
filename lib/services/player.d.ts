/**
 * Player Information Management Service
 *
 * Provides unified player information management across different server types,
 * including non-premium player identity recognition and caching mechanisms.
 */
import { Context } from 'koishi';
import { Player, PlayerDetail, IdentityMarkers } from '../types';
export interface PlayerSearchCriteria {
    name?: string;
    uuid?: string;
    xuid?: string;
    ip?: string;
    serverId?: string;
}
export interface PlayerIdentityMatch {
    player: PlayerDetail;
    confidence: number;
    matchedBy: string[];
    conflictsWith?: PlayerDetail[];
}
export interface PlayerCache {
    playerId: string;
    serverIds: string[];
    lastSeen: Date;
    cachedData: PlayerDetail;
    identityMarkers: IdentityMarkers;
}
export interface PlayerSyncStatus {
    serverId: string;
    lastSync: Date;
    pendingUpdates: number;
    syncErrors: string[];
}
export declare class PlayerInformationService {
    private ctx;
    private playerCache;
    private identityIndex;
    private syncStatus;
    private cacheTimeout;
    constructor(ctx: Context);
    /**
     * Get unified player information from a specific server
     */
    getPlayerInfo(serverId: string, playerId: string): Promise<PlayerDetail | null>;
    /**
     * Get online players from a specific server with unified format
     */
    getOnlinePlayers(serverId: string): Promise<Player[]>;
    /**
     * Search for players across multiple servers
     */
    searchPlayers(criteria: PlayerSearchCriteria): Promise<PlayerIdentityMatch[]>;
    /**
     * Detect if a player is using a premium (official) account
     */
    private detectPremiumStatus;
    /**
     * Calculate identity confidence based on available markers
     */
    private calculateIdentityConfidence;
    /**
     * Identify potential conflicts for non-premium players
     */
    private identifyPlayerConflicts;
    /**
     * Update player cache with new information
     */
    private updatePlayerCache;
    /**
     * Update identity index for fast lookups
     */
    private updateIdentityIndex;
    /**
     * Search for players in cache
     */
    private searchInCache;
    /**
     * Search for players in a specific server
     */
    private searchInServer;
    /**
     * Resolve and deduplicate player matches
     */
    private resolvePlayerMatches;
    private generatePlayerId;
    private getCachedPlayer;
    private isCacheValid;
    private getBridge;
    private getConnectedServerIds;
    private updateSyncStatus;
    private matchesSearchCriteria;
    private getMatchedIdentifiers;
    private initializeService;
    private cleanupExpiredCache;
    /**
     * Get player synchronization status for all servers
     */
    getSyncStatus(): Map<string, PlayerSyncStatus>;
    /**
     * Force refresh player cache for a specific server
     */
    refreshServerCache(serverId: string): Promise<void>;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalPlayers: number;
        cacheHitRate: number;
        averageConfidence: number;
        conflictCount: number;
    };
}
