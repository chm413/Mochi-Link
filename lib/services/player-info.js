"use strict";
/**
 * Player Information Management Service
 *
 * Provides unified player information query interface and handles
 * non-premium player identity recognition across different server types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerInfoService = void 0;
const events_1 = require("events");
class PlayerInfoService extends events_1.EventEmitter {
    constructor(config = {}, database) {
        super();
        this.bridges = new Map();
        this.playerCache = new Map();
        this.config = {
            cacheTimeout: 300000, // 5 minutes
            maxCacheSize: 10000,
            identityConfidenceThreshold: 0.7,
            conflictDetectionEnabled: true,
            enableCrossServerMatching: true,
            matchingCriteria: ['uuid', 'xuid', 'name', 'ip'],
            ...config
        };
        this.database = database;
        // Set up cache cleanup
        setInterval(() => this.cleanupCache(), this.config.cacheTimeout);
    }
    // ============================================================================
    // Bridge Management
    // ============================================================================
    /**
     * Register a bridge for player information queries
     */
    registerBridge(serverId, bridge) {
        this.bridges.set(serverId, bridge);
        // Listen for player events to update cache
        bridge.on('bridgeEvent:player.join', (event) => {
            this.handlePlayerEvent('join', event);
        });
        bridge.on('bridgeEvent:player.leave', (event) => {
            this.handlePlayerEvent('leave', event);
        });
    }
    /**
     * Unregister a bridge
     */
    unregisterBridge(serverId) {
        const bridge = this.bridges.get(serverId);
        if (bridge) {
            bridge.removeAllListeners();
            this.bridges.delete(serverId);
        }
    }
    // ============================================================================
    // Player Information Queries
    // ============================================================================
    /**
     * Get unified player information
     */
    async getPlayerInfo(query) {
        // Try cache first
        const cacheKey = this.generateCacheKey(query);
        const cached = this.playerCache.get(cacheKey);
        if (cached && this.isCacheValid(cached)) {
            return cached;
        }
        // Query from server(s)
        let result = null;
        if (query.serverId) {
            // Query specific server
            result = await this.queryServerPlayerInfo(query.serverId, query);
        }
        else if (this.config.enableCrossServerMatching) {
            // Query across all servers
            result = await this.queryCrossServerPlayerInfo(query);
        }
        // Cache the result
        if (result) {
            this.cachePlayerInfo(cacheKey, result);
        }
        return result;
    }
    /**
     * Get online players from all servers
     */
    async getOnlinePlayersAll() {
        const results = new Map();
        for (const [serverId, bridge] of this.bridges) {
            try {
                if (bridge.isConnectedToBridge()) {
                    const players = await bridge.getOnlinePlayers();
                    results.set(serverId, players);
                }
            }
            catch (error) {
                this.emit('error', {
                    type: 'query_failed',
                    serverId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        return results;
    }
    /**
     * Search players by criteria
     */
    async searchPlayers(criteria) {
        const results = [];
        // Search in cache first
        for (const [key, cached] of this.playerCache) {
            if (this.matchesCriteria(cached.player, criteria)) {
                results.push(cached);
            }
        }
        // Search in database if available
        if (this.database) {
            const dbResults = await this.searchInDatabase(criteria);
            results.push(...dbResults);
        }
        // Remove duplicates and sort by relevance
        return this.deduplicateResults(results);
    }
    // ============================================================================
    // Non-Premium Player Identity Recognition
    // ============================================================================
    /**
     * Resolve player identity across servers
     */
    async resolvePlayerIdentity(playerData) {
        if (playerData.length === 0) {
            throw new Error('No player data provided');
        }
        // Group by potential identity markers
        const identityGroups = this.groupByIdentityMarkers(playerData);
        // Calculate confidence scores
        const identities = identityGroups.map(group => this.calculateIdentityConfidence(group));
        // Find the most confident identity
        const primaryIdentity = identities.reduce((best, current) => current.confidence > best.confidence ? current : best);
        // Detect conflicts
        const conflicts = identities.filter(identity => identity !== primaryIdentity &&
            identity.confidence > this.config.identityConfidenceThreshold);
        return {
            ...primaryIdentity,
            conflicts
        };
    }
    /**
     * Detect identity conflicts for non-premium players
     */
    async detectIdentityConflicts(playerId) {
        const conflicts = [];
        // Get all player records with the same name but different IDs
        const query = {
            playerName: playerId,
            includeOffline: true
        };
        const results = await this.searchPlayers({ name: playerId });
        if (results.length > 1) {
            // Multiple players with same name - potential conflict
            for (const result of results) {
                if (result.identity.confidence < this.config.identityConfidenceThreshold) {
                    conflicts.push(result.identity);
                }
            }
        }
        return conflicts;
    }
    /**
     * Update player identity markers
     */
    async updateIdentityMarkers(playerId, serverId, markers) {
        const cacheKey = `${serverId}:${playerId}`;
        const cached = this.playerCache.get(cacheKey);
        if (cached) {
            // Update cached identity markers
            cached.player.identityMarkers = {
                ...cached.player.identityMarkers,
                ...markers,
                lastSeen: new Date(),
                serverIds: [...new Set([...cached.player.identityMarkers.serverIds, serverId])]
            };
            // Recalculate confidence
            cached.identity.confidence = this.calculateConfidenceScore(cached.player);
            cached.lastUpdated = new Date();
            this.playerCache.set(cacheKey, cached);
        }
        // Update database if available
        if (this.database) {
            await this.updateDatabaseMarkers(playerId, serverId, markers);
        }
        this.emit('identityUpdated', { playerId, serverId, markers });
    }
    // ============================================================================
    // Private Implementation Methods
    // ============================================================================
    async queryServerPlayerInfo(serverId, query) {
        const bridge = this.bridges.get(serverId);
        if (!bridge || !bridge.isConnectedToBridge()) {
            return null;
        }
        try {
            let player = null;
            if (query.playerId) {
                player = await bridge.getPlayerDetail(query.playerId);
            }
            else if (query.playerName) {
                // Search by name in online players
                const onlinePlayers = await bridge.getOnlinePlayers();
                const found = onlinePlayers.find(p => p.name === query.playerName);
                if (found) {
                    player = await bridge.getPlayerDetail(found.id);
                }
            }
            if (!player) {
                return null;
            }
            // Resolve identity
            const identity = await this.resolvePlayerIdentity([player]);
            return {
                player,
                identity,
                lastUpdated: new Date(),
                source: 'server'
            };
        }
        catch (error) {
            this.emit('error', {
                type: 'server_query_failed',
                serverId,
                query,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
    async queryCrossServerPlayerInfo(query) {
        const allResults = [];
        // Query all connected servers
        for (const [serverId, bridge] of this.bridges) {
            if (bridge.isConnectedToBridge()) {
                const result = await this.queryServerPlayerInfo(serverId, query);
                if (result) {
                    allResults.push(result);
                }
            }
        }
        if (allResults.length === 0) {
            return null;
        }
        // Aggregate results
        return await this.aggregatePlayerResults(allResults);
    }
    async aggregatePlayerResults(results) {
        // Use the most recent result as base
        const primary = results.reduce((latest, current) => current.lastUpdated > latest.lastUpdated ? current : latest);
        // Merge identity information from all results
        const allPlayerData = results.map(r => r.player);
        const aggregatedIdentity = await this.resolvePlayerIdentity(allPlayerData);
        return {
            player: primary.player,
            identity: aggregatedIdentity,
            lastUpdated: new Date(),
            source: 'aggregated'
        };
    }
    groupByIdentityMarkers(playerData) {
        const groups = new Map();
        for (const player of playerData) {
            // Create identity signature based on available markers
            const signatures = [];
            if (player.id && player.id.length > 16) {
                signatures.push(`uuid:${player.id}`);
            }
            if (player.ipAddress) {
                signatures.push(`ip:${player.ipAddress}`);
            }
            if (player.deviceType) {
                signatures.push(`device:${player.deviceType}`);
            }
            // Use name as fallback for non-premium players
            if (signatures.length === 0) {
                signatures.push(`name:${player.name}`);
            }
            for (const signature of signatures) {
                if (!groups.has(signature)) {
                    groups.set(signature, []);
                }
                groups.get(signature).push(player);
            }
        }
        return Array.from(groups.values());
    }
    calculateIdentityConfidence(playerGroup) {
        if (playerGroup.length === 0) {
            throw new Error('Empty player group');
        }
        const representative = playerGroup[0];
        let confidence = 0.5; // Base confidence
        // Increase confidence based on available markers
        if (representative.id && representative.id.length > 16) {
            confidence += 0.3; // UUID/XUID available
        }
        if (representative.ipAddress) {
            confidence += 0.1; // IP address available
        }
        if (representative.deviceType && representative.edition === 'Bedrock') {
            confidence += 0.1; // Device type for Bedrock
        }
        // Decrease confidence for conflicts
        const uniqueIds = new Set(playerGroup.map(p => p.id));
        if (uniqueIds.size > 1) {
            confidence -= 0.2; // Multiple IDs for same name
        }
        // Ensure confidence is within bounds
        confidence = Math.max(0, Math.min(1, confidence));
        return {
            uuid: representative.edition === 'Java' ? representative.id : undefined,
            xuid: representative.edition === 'Bedrock' ? representative.id : undefined,
            name: representative.name,
            confidence,
            markers: {
                ip: representative.ipAddress,
                device: representative.deviceType,
                firstSeen: new Date(),
                lastSeen: new Date(),
                serverIds: []
            },
            conflicts: []
        };
    }
    calculateConfidenceScore(player) {
        let score = 0.5;
        // Premium players have higher confidence
        if (player.isPremium) {
            score += 0.3;
        }
        // Long play time increases confidence
        if (player.totalPlayTime > 3600000) { // 1 hour
            score += 0.1;
        }
        // Multiple server presence increases confidence
        if (player.identityMarkers.serverIds.length > 1) {
            score += 0.1;
        }
        return Math.max(0, Math.min(1, score));
    }
    matchesCriteria(player, criteria) {
        if (criteria.name && !player.name.toLowerCase().includes(criteria.name.toLowerCase())) {
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
    async searchInDatabase(criteria) {
        // Database search implementation would go here
        // This is a placeholder for the actual database integration
        return [];
    }
    deduplicateResults(results) {
        const seen = new Set();
        const deduplicated = [];
        for (const result of results) {
            const key = `${result.player.id}:${result.player.name}`;
            if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(result);
            }
        }
        return deduplicated.sort((a, b) => b.identity.confidence - a.identity.confidence);
    }
    async updateDatabaseMarkers(playerId, serverId, markers) {
        // Database update implementation would go here
        // This is a placeholder for the actual database integration
    }
    generateCacheKey(query) {
        const parts = [
            query.serverId || 'all',
            query.playerId || '',
            query.playerName || '',
            query.ipAddress || ''
        ];
        return parts.join(':');
    }
    isCacheValid(cached) {
        const age = Date.now() - cached.lastUpdated.getTime();
        return age < this.config.cacheTimeout;
    }
    cachePlayerInfo(key, result) {
        // Implement LRU cache eviction if needed
        if (this.playerCache.size >= this.config.maxCacheSize) {
            const oldestKey = this.playerCache.keys().next().value;
            if (oldestKey) {
                this.playerCache.delete(oldestKey);
            }
        }
        this.playerCache.set(key, result);
    }
    cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.playerCache) {
            if (now - cached.lastUpdated.getTime() > this.config.cacheTimeout) {
                this.playerCache.delete(key);
            }
        }
    }
    handlePlayerEvent(eventType, event) {
        // Update cache when players join/leave
        const serverId = event.serverId;
        const playerId = event.playerId || event.player?.id;
        if (serverId && playerId) {
            const cacheKey = `${serverId}:${playerId}`;
            if (eventType === 'leave') {
                // Remove from cache when player leaves
                this.playerCache.delete(cacheKey);
            }
            else {
                // Update last seen when player joins
                const cached = this.playerCache.get(cacheKey);
                if (cached) {
                    cached.player.lastSeenAt = new Date();
                    cached.lastUpdated = new Date();
                }
            }
        }
    }
}
exports.PlayerInfoService = PlayerInfoService;
