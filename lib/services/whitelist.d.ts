/**
 * Whitelist Management Service
 *
 * Provides unified whitelist management across different server types,
 * including bidirectional synchronization and offline operation caching.
 */
import { Context } from 'koishi';
export interface WhitelistEntry {
    playerId: string;
    playerName: string;
    addedBy: string;
    addedAt: Date;
    reason?: string;
    serverId: string;
}
export interface WhitelistOperation {
    type: 'add' | 'remove';
    playerId: string;
    playerName?: string;
    reason?: string;
    executor: string;
    timestamp: Date;
}
export interface WhitelistSyncStatus {
    serverId: string;
    lastSync: Date;
    pendingOperations: number;
    syncErrors: string[];
    isOnline: boolean;
}
export interface WhitelistCache {
    serverId: string;
    entries: WhitelistEntry[];
    lastUpdate: Date;
    version: number;
}
export interface BanEntry {
    id: string;
    serverId: string;
    banType: 'player' | 'ip' | 'device';
    target: string;
    targetName?: string;
    reason: string;
    bannedBy: string;
    bannedAt: Date;
    expiresAt?: Date;
    isActive: boolean;
}
export interface BanOperation {
    type: 'ban' | 'unban';
    banType: 'player' | 'ip' | 'device';
    target: string;
    targetName?: string;
    reason?: string;
    executor: string;
    timestamp: Date;
    duration?: number;
}
export interface BanSyncStatus {
    serverId: string;
    lastSync: Date;
    pendingOperations: number;
    syncErrors: string[];
    isOnline: boolean;
}
export declare class WhitelistManager {
    private ctx;
    private getBridgeFn;
    private whitelistCache;
    private pendingOperations;
    private syncStatus;
    private banCache;
    private pendingBanOperations;
    private banSyncStatus;
    private syncInterval;
    private maxRetries;
    constructor(ctx: Context, getBridge: (serverId: string) => any);
    /**
     * Get whitelist for a specific server
     */
    getWhitelist(serverId: string): Promise<WhitelistEntry[]>;
    /**
     * Add player to whitelist
     */
    addToWhitelist(serverId: string, playerId: string, playerName: string, executor: string, reason?: string): Promise<boolean>;
    /**
     * Remove player from whitelist
     */
    removeFromWhitelist(serverId: string, playerId: string, executor: string, reason?: string): Promise<boolean>;
    /**
     * Check if player is whitelisted
     */
    isWhitelisted(serverId: string, playerId: string): Promise<boolean>;
    /**
     * Get ban list for a specific server
     */
    getBanList(serverId: string): Promise<BanEntry[]>;
    /**
     * Ban a target (player, IP, or device)
     */
    banTarget(serverId: string, banType: 'player' | 'ip' | 'device', target: string, targetName: string | undefined, reason: string, executor: string, duration?: number): Promise<boolean>;
    /**
     * Unban a target
     */
    unbanTarget(serverId: string, banType: 'player' | 'ip' | 'device', target: string, executor: string, reason?: string): Promise<boolean>;
    /**
     * Check if a target is banned
     */
    isBanned(serverId: string, banType: 'player' | 'ip' | 'device', target: string): Promise<boolean>;
    /**
     * Get ban information for a specific target
     */
    getBanInfo(serverId: string, banType: 'player' | 'ip' | 'device', target: string): Promise<BanEntry | null>;
    /**
     * Process expired bans automatically
     */
    processExpiredBans(): Promise<void>;
    /**
     * Cache a ban operation for later execution
     */
    private cacheBanOperation;
    /**
     * Optimize ban operations by canceling out conflicting ones
     */
    private optimizeBanOperations;
    /**
     * Execute ban operation on server
     */
    private executeBanOperationOnServer;
    /**
     * Update local ban cache
     */
    private updateLocalBanList;
    /**
     * Sync bans from server to local cache
     */
    private syncBansFromServer;
    /**
     * Update ban cache
     */
    private updateBanCache;
    /**
     * Update ban sync status
     */
    private updateBanSyncStatus;
    /**
     * Sync whitelist from server to local cache
     */
    syncFromServer(serverId: string): Promise<void>;
    /**
     * Sync whitelist from local cache to server
     */
    syncToServer(serverId: string): Promise<void>;
    /**
     * Force full bidirectional sync
     */
    forceSyncBidirectional(serverId: string): Promise<void>;
    /**
     * Cache an operation for later execution
     */
    private cacheOperation;
    /**
     * Optimize operations by canceling out conflicting ones
     */
    private optimizeOperations;
    /**
     * Process pending operations when server comes online
     */
    processPendingOperations(serverId: string): Promise<void>;
    /**
     * Execute whitelist operation on server
     */
    private executeOperationOnServer;
    /**
     * Update local whitelist cache
     */
    private updateLocalWhitelist;
    /**
     * Check if server is online
     */
    private isServerOnline;
    /**
     * Get bridge for server
     */
    private getBridge;
    /**
     * Update cache
     */
    private updateCache;
    /**
     * Update sync status
     */
    private updateSyncStatus;
    /**
     * Initialize service
     */
    private initializeService;
    /**
     * Perform periodic sync for all servers
     */
    private performPeriodicSync;
    /**
     * Process pending ban operations when server comes online
     */
    private processPendingBanOperations;
    private loadWhitelistFromDatabase;
    private saveWhitelistToDatabase;
    private savePendingOperationToDatabase;
    private clearPendingOperationsFromDatabase;
    private loadPendingOperationsFromDatabase;
    private recordAuditLog;
    private loadBansFromDatabase;
    private saveBansToDatabase;
    private savePendingBanOperationToDatabase;
    private clearPendingBanOperationsFromDatabase;
    /**
     * Get sync status for a server
     */
    getSyncStatus(serverId: string): WhitelistSyncStatus | null;
    /**
     * Get sync status for all servers
     */
    getAllSyncStatus(): Map<string, WhitelistSyncStatus>;
    /**
     * Get pending operations count for a server
     */
    getPendingOperationsCount(serverId: string): number;
    /**
     * Get pending operations for a server
     */
    getPendingOperations(serverId: string): WhitelistOperation[];
    /**
     * Clear all pending operations for a server (admin function)
     */
    clearPendingOperations(serverId: string, executor: string): Promise<void>;
    /**
     * Get whitelist statistics
     */
    getWhitelistStats(): {
        totalServers: number;
        totalEntries: number;
        totalPendingOperations: number;
        serversOnline: number;
        lastSyncErrors: number;
    };
    /**
     * Get ban sync status for a server
     */
    getBanSyncStatus(serverId: string): BanSyncStatus | null;
    /**
     * Get ban sync status for all servers
     */
    getAllBanSyncStatus(): Map<string, BanSyncStatus>;
    /**
     * Get pending ban operations count for a server
     */
    getPendingBanOperationsCount(serverId: string): number;
    /**
     * Get pending ban operations for a server
     */
    getPendingBanOperations(serverId: string): BanOperation[];
    /**
     * Clear all pending ban operations for a server (admin function)
     */
    clearPendingBanOperations(serverId: string, executor: string): Promise<void>;
    /**
     * Get ban statistics
     */
    getBanStats(): {
        totalServers: number;
        totalActiveBans: number;
        totalPendingOperations: number;
        serversOnline: number;
        lastSyncErrors: number;
        bansByType: {
            player: number;
            ip: number;
            device: number;
        };
    };
    /**
     * Get all active bans across all servers
     */
    getAllActiveBans(): BanEntry[];
    /**
     * Search bans by target or reason
     */
    searchBans(query: string, serverId?: string): BanEntry[];
}
