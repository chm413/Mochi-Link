"use strict";
/**
 * Player Information Management Service
 *
 * Provides unified player information management across different server types,
 * including non-premium player identity recognition and caching mechanisms.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerInformationService = void 0;
// ============================================================================
// Player Information Service
// ============================================================================
class PlayerInformationService {
    constructor(ctx, getBridge) {
        this.playerCache = new Map();
        this.identityIndex = new Map(); // identifier -> playerIds
        this.syncStatus = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
        this.ctx = ctx;
        this.getBridgeFn = getBridge;
        this.initializeService();
    }
    // ============================================================================
    // Unified Player Information Query Interface
    // ============================================================================
    /**
     * Get unified player information from a specific server
     */
    async getPlayerInfo(serverId, playerId) {
        const logger = this.ctx.logger('mochi-link:player');
        try {
            // Check cache first
            const cached = this.getCachedPlayer(playerId);
            if (cached && this.isCacheValid(cached)) {
                logger.debug(`Returning cached player info for ${playerId}`);
                return cached.cachedData;
            }
            // Fetch from server bridge
            const bridge = this.getBridge(serverId);
            if (!bridge) {
                throw new Error(`No bridge found for server ${serverId}`);
            }
            const playerDetail = await bridge.getPlayerDetail(playerId);
            if (!playerDetail) {
                return null;
            }
            // Update cache and identity markers
            await this.updatePlayerCache(playerDetail, serverId);
            return playerDetail;
        }
        catch (error) {
            logger.error(`Failed to get player info for ${playerId} on ${serverId}:`, error);
            return null;
        }
    }
    /**
     * Get online players from a specific server with unified format
     */
    async getOnlinePlayers(serverId) {
        const logger = this.ctx.logger('mochi-link:player');
        try {
            const bridge = this.getBridge(serverId);
            if (!bridge) {
                throw new Error(`No bridge found for server ${serverId}`);
            }
            const players = await bridge.getOnlinePlayers();
            // Update cache for all online players
            for (const player of players) {
                const playerDetail = {
                    ...player,
                    firstJoinAt: new Date(), // Would be fetched from server data
                    lastSeenAt: new Date(),
                    totalPlayTime: 0,
                    isPremium: this.detectPremiumStatus(player),
                    identityConfidence: this.calculateIdentityConfidence(player),
                    identityMarkers: {
                        serverIds: [serverId],
                        firstSeen: new Date(),
                        lastSeen: new Date()
                    }
                };
                await this.updatePlayerCache(playerDetail, serverId);
            }
            return players;
        }
        catch (error) {
            logger.error(`Failed to get online players for ${serverId}:`, error);
            return [];
        }
    }
    /**
     * Search for players across multiple servers
     */
    async searchPlayers(criteria) {
        const logger = this.ctx.logger('mochi-link:player');
        const matches = [];
        try {
            // Search in cache first
            const cacheMatches = this.searchInCache(criteria);
            matches.push(...cacheMatches);
            // If specific server is requested, search there too
            if (criteria.serverId) {
                const serverMatches = await this.searchInServer(criteria.serverId, criteria);
                matches.push(...serverMatches);
            }
            else {
                // Search across all connected servers
                const serverIds = this.getConnectedServerIds();
                for (const serverId of serverIds) {
                    const serverMatches = await this.searchInServer(serverId, criteria);
                    matches.push(...serverMatches);
                }
            }
            // Deduplicate and resolve conflicts
            return this.resolvePlayerMatches(matches);
        }
        catch (error) {
            logger.error('Failed to search players:', error);
            return [];
        }
    }
    // ============================================================================
    // Non-Premium Player Identity Recognition
    // ============================================================================
    /**
     * Detect if a player is using a premium (official) account
     */
    detectPremiumStatus(player) {
        // Java Edition: Check UUID format and patterns
        if (player.edition === 'Java') {
            // Premium Java accounts have specific UUID patterns
            if (player.id && player.id.length === 36 && player.id.includes('-')) {
                // Check if UUID follows Mojang's pattern
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return uuidPattern.test(player.id);
            }
            return false;
        }
        // Bedrock Edition: Check XUID format
        if (player.edition === 'Bedrock') {
            // Premium Bedrock accounts have numeric XUIDs
            if (player.id && /^\d+$/.test(player.id)) {
                return true;
            }
            return false;
        }
        return false;
    }
    /**
     * Calculate identity confidence based on available markers
     */
    calculateIdentityConfidence(player) {
        let confidence = 0.5; // Base confidence
        // Premium status increases confidence
        if (this.detectPremiumStatus(player)) {
            confidence += 0.4;
        }
        // Consistent name and ID increases confidence
        if (player.name && player.id) {
            confidence += 0.1;
        }
        // Additional markers (IP, device type) can increase confidence
        if (player.deviceType && player.deviceType !== 'Unknown') {
            confidence += 0.05;
        }
        return Math.min(confidence, 1.0);
    }
    /**
     * Identify potential conflicts for non-premium players
     */
    identifyPlayerConflicts(player) {
        const conflicts = [];
        // Check for same name but different UUID/XUID
        if (player.name) {
            const nameMatches = this.identityIndex.get(`name:${player.name.toLowerCase()}`);
            if (nameMatches) {
                for (const playerId of nameMatches) {
                    const cached = this.playerCache.get(playerId);
                    if (cached && cached.cachedData.id !== player.id) {
                        conflicts.push(cached.cachedData);
                    }
                }
            }
        }
        return conflicts;
    }
    // ============================================================================
    // Player Information Caching and Synchronization
    // ============================================================================
    /**
     * Update player cache with new information
     */
    async updatePlayerCache(player, serverId) {
        const playerId = this.generatePlayerId(player);
        // Get existing cache or create new
        let cache = this.playerCache.get(playerId);
        if (!cache) {
            cache = {
                playerId,
                serverIds: [],
                lastSeen: new Date(),
                cachedData: player,
                identityMarkers: player.identityMarkers || {
                    serverIds: [],
                    firstSeen: new Date(),
                    lastSeen: new Date()
                }
            };
        }
        // Update cache data
        cache.cachedData = { ...cache.cachedData, ...player };
        cache.lastSeen = new Date();
        // Add server ID if not already present
        if (!cache.serverIds.includes(serverId)) {
            cache.serverIds.push(serverId);
        }
        // Update identity markers
        if (!cache.identityMarkers.serverIds.includes(serverId)) {
            cache.identityMarkers.serverIds.push(serverId);
        }
        cache.identityMarkers.lastSeen = new Date();
        // Store in cache
        this.playerCache.set(playerId, cache);
        // Update identity index
        this.updateIdentityIndex(player, playerId);
        // Update sync status
        this.updateSyncStatus(serverId);
    }
    /**
     * Update identity index for fast lookups
     */
    updateIdentityIndex(player, playerId) {
        // Index by various identifiers
        const identifiers = [
            `id:${player.id}`,
            `name:${player.name.toLowerCase()}`,
        ];
        // Add additional identifiers if available
        if (player.displayName && player.displayName !== player.name) {
            identifiers.push(`display:${player.displayName.toLowerCase()}`);
        }
        for (const identifier of identifiers) {
            if (!this.identityIndex.has(identifier)) {
                this.identityIndex.set(identifier, new Set());
            }
            this.identityIndex.get(identifier).add(playerId);
        }
    }
    /**
     * Search for players in cache
     */
    searchInCache(criteria) {
        const matches = [];
        // Build search identifiers
        const searchIds = [];
        if (criteria.uuid)
            searchIds.push(`id:${criteria.uuid}`);
        if (criteria.xuid)
            searchIds.push(`id:${criteria.xuid}`);
        if (criteria.name)
            searchIds.push(`name:${criteria.name.toLowerCase()}`);
        // Find matching players
        const foundPlayerIds = new Set();
        for (const searchId of searchIds) {
            const playerIds = this.identityIndex.get(searchId);
            if (playerIds) {
                playerIds.forEach(id => foundPlayerIds.add(id));
            }
        }
        // Convert to matches
        for (const playerId of foundPlayerIds) {
            const cache = this.playerCache.get(playerId);
            if (cache && this.isCacheValid(cache)) {
                const conflicts = this.identifyPlayerConflicts(cache.cachedData);
                matches.push({
                    player: cache.cachedData,
                    confidence: cache.cachedData.identityConfidence || 0.5,
                    matchedBy: this.getMatchedIdentifiers(cache.cachedData, criteria),
                    conflictsWith: conflicts.length > 0 ? conflicts : undefined
                });
            }
        }
        return matches;
    }
    /**
     * Search for players in a specific server
     */
    async searchInServer(serverId, criteria) {
        const matches = [];
        try {
            // Get online players and search through them
            const onlinePlayers = await this.getOnlinePlayers(serverId);
            for (const player of onlinePlayers) {
                if (this.matchesSearchCriteria(player, criteria)) {
                    const playerDetail = await this.getPlayerInfo(serverId, player.id);
                    if (playerDetail) {
                        const conflicts = this.identifyPlayerConflicts(playerDetail);
                        matches.push({
                            player: playerDetail,
                            confidence: playerDetail.identityConfidence || 0.5,
                            matchedBy: this.getMatchedIdentifiers(playerDetail, criteria),
                            conflictsWith: conflicts.length > 0 ? conflicts : undefined
                        });
                    }
                }
            }
        }
        catch (error) {
            this.ctx.logger('mochi-link:player').error(`Failed to search in server ${serverId}:`, error);
        }
        return matches;
    }
    /**
     * Resolve and deduplicate player matches
     */
    resolvePlayerMatches(matches) {
        // Group by player ID
        const grouped = new Map();
        for (const match of matches) {
            const key = match.player.id;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(match);
        }
        // Resolve conflicts and return best matches
        const resolved = [];
        for (const [playerId, playerMatches] of grouped) {
            if (playerMatches.length === 1) {
                resolved.push(playerMatches[0]);
            }
            else {
                // Choose match with highest confidence
                const bestMatch = playerMatches.reduce((best, current) => current.confidence > best.confidence ? current : best);
                resolved.push(bestMatch);
            }
        }
        return resolved.sort((a, b) => b.confidence - a.confidence);
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    generatePlayerId(player) {
        // Use ID as primary identifier, fallback to name
        return player.id || `name:${player.name}`;
    }
    getCachedPlayer(playerId) {
        return this.playerCache.get(playerId);
    }
    isCacheValid(cache) {
        const now = Date.now();
        const cacheAge = now - cache.lastSeen.getTime();
        return cacheAge < this.cacheTimeout;
    }
    getBridge(serverId) {
        const bridge = this.getBridgeFn(serverId);
        if (!bridge) {
            this.ctx.logger('mochi-link:player').warn(`Bridge not available for server ${serverId}, using cached data only`);
        }
        return bridge;
    }
    getConnectedServerIds() {
        // This would get the list of connected servers from the connection manager
        return [];
    }
    updateSyncStatus(serverId) {
        const status = this.syncStatus.get(serverId) || {
            serverId,
            lastSync: new Date(),
            pendingUpdates: 0,
            syncErrors: []
        };
        status.lastSync = new Date();
        this.syncStatus.set(serverId, status);
    }
    matchesSearchCriteria(player, criteria) {
        if (criteria.name && player.name.toLowerCase() !== criteria.name.toLowerCase()) {
            return false;
        }
        if (criteria.uuid && player.id !== criteria.uuid) {
            return false;
        }
        if (criteria.xuid && player.id !== criteria.xuid) {
            return false;
        }
        return true;
    }
    getMatchedIdentifiers(player, criteria) {
        const matched = [];
        if (criteria.name && player.name.toLowerCase() === criteria.name.toLowerCase()) {
            matched.push('name');
        }
        if (criteria.uuid && player.id === criteria.uuid) {
            matched.push('uuid');
        }
        if (criteria.xuid && player.id === criteria.xuid) {
            matched.push('xuid');
        }
        return matched;
    }
    initializeService() {
        const logger = this.ctx.logger('mochi-link:player');
        logger.info('Player Information Service initialized');
        // Set up periodic cache cleanup
        setInterval(() => {
            this.cleanupExpiredCache();
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    cleanupExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];
        for (const [key, cache] of this.playerCache) {
            const cacheAge = now - cache.lastSeen.getTime();
            if (cacheAge > this.cacheTimeout) {
                expiredKeys.push(key);
            }
        }
        for (const key of expiredKeys) {
            this.playerCache.delete(key);
        }
        if (expiredKeys.length > 0) {
            this.ctx.logger('mochi-link:player').debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }
    // ============================================================================
    // Public API Methods
    // ============================================================================
    /**
     * Get player synchronization status for all servers
     */
    getSyncStatus() {
        return new Map(this.syncStatus);
    }
    /**
     * Force refresh player cache for a specific server
     */
    async refreshServerCache(serverId) {
        const logger = this.ctx.logger('mochi-link:player');
        try {
            logger.info(`Refreshing player cache for server ${serverId}`);
            // Clear existing cache for this server
            for (const [key, cache] of this.playerCache) {
                if (cache.serverIds.includes(serverId)) {
                    // Remove server from cache or delete entirely if it's the only server
                    cache.serverIds = cache.serverIds.filter(id => id !== serverId);
                    if (cache.serverIds.length === 0) {
                        this.playerCache.delete(key);
                    }
                }
            }
            // Refresh with current online players
            await this.getOnlinePlayers(serverId);
            logger.info(`Player cache refreshed for server ${serverId}`);
        }
        catch (error) {
            logger.error(`Failed to refresh cache for server ${serverId}:`, error);
            throw error;
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const totalPlayers = this.playerCache.size;
        let totalConfidence = 0;
        let conflictCount = 0;
        for (const cache of this.playerCache.values()) {
            totalConfidence += cache.cachedData.identityConfidence || 0.5;
            const conflicts = this.identifyPlayerConflicts(cache.cachedData);
            if (conflicts.length > 0) {
                conflictCount++;
            }
        }
        return {
            totalPlayers,
            cacheHitRate: 0.85, // This would be calculated based on actual cache hits
            averageConfidence: totalPlayers > 0 ? totalConfidence / totalPlayers : 0,
            conflictCount
        };
    }
}
exports.PlayerInformationService = PlayerInformationService;
