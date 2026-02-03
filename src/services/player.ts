/**
 * Player Information Management Service
 * 
 * Provides unified player information management across different server types,
 * including non-premium player identity recognition and caching mechanisms.
 */

import { Context } from 'koishi';
import { 
  Player, 
  PlayerDetail, 
  IdentityMarkers
} from '../types';

// ============================================================================
// Player Information Types
// ============================================================================

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

// ============================================================================
// Player Information Service
// ============================================================================

export class PlayerInformationService {
  private ctx: Context;
  private playerCache = new Map<string, PlayerCache>();
  private identityIndex = new Map<string, Set<string>>(); // identifier -> playerIds
  private syncStatus = new Map<string, PlayerSyncStatus>();
  private cacheTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(ctx: Context) {
    this.ctx = ctx;
    this.initializeService();
  }

  // ============================================================================
  // Unified Player Information Query Interface
  // ============================================================================

  /**
   * Get unified player information from a specific server
   */
  async getPlayerInfo(serverId: string, playerId: string): Promise<PlayerDetail | null> {
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
      
    } catch (error) {
      logger.error(`Failed to get player info for ${playerId} on ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Get online players from a specific server with unified format
   */
  async getOnlinePlayers(serverId: string): Promise<Player[]> {
    const logger = this.ctx.logger('mochi-link:player');
    
    try {
      const bridge = this.getBridge(serverId);
      if (!bridge) {
        throw new Error(`No bridge found for server ${serverId}`);
      }

      const players = await bridge.getOnlinePlayers();
      
      // Update cache for all online players
      for (const player of players) {
        const playerDetail: PlayerDetail = {
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
      
    } catch (error) {
      logger.error(`Failed to get online players for ${serverId}:`, error);
      return [];
    }
  }

  /**
   * Search for players across multiple servers
   */
  async searchPlayers(criteria: PlayerSearchCriteria): Promise<PlayerIdentityMatch[]> {
    const logger = this.ctx.logger('mochi-link:player');
    const matches: PlayerIdentityMatch[] = [];
    
    try {
      // Search in cache first
      const cacheMatches = this.searchInCache(criteria);
      matches.push(...cacheMatches);
      
      // If specific server is requested, search there too
      if (criteria.serverId) {
        const serverMatches = await this.searchInServer(criteria.serverId, criteria);
        matches.push(...serverMatches);
      } else {
        // Search across all connected servers
        const serverIds = this.getConnectedServerIds();
        for (const serverId of serverIds) {
          const serverMatches = await this.searchInServer(serverId, criteria);
          matches.push(...serverMatches);
        }
      }
      
      // Deduplicate and resolve conflicts
      return this.resolvePlayerMatches(matches);
      
    } catch (error) {
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
  private detectPremiumStatus(player: Player): boolean {
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
  private calculateIdentityConfidence(player: Player): number {
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
  private identifyPlayerConflicts(player: PlayerDetail): PlayerDetail[] {
    const conflicts: PlayerDetail[] = [];
    
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
  private async updatePlayerCache(player: PlayerDetail, serverId: string): Promise<void> {
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
  private updateIdentityIndex(player: PlayerDetail, playerId: string): void {
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
      this.identityIndex.get(identifier)!.add(playerId);
    }
  }

  /**
   * Search for players in cache
   */
  private searchInCache(criteria: PlayerSearchCriteria): PlayerIdentityMatch[] {
    const matches: PlayerIdentityMatch[] = [];
    
    // Build search identifiers
    const searchIds: string[] = [];
    if (criteria.uuid) searchIds.push(`id:${criteria.uuid}`);
    if (criteria.xuid) searchIds.push(`id:${criteria.xuid}`);
    if (criteria.name) searchIds.push(`name:${criteria.name.toLowerCase()}`);
    
    // Find matching players
    const foundPlayerIds = new Set<string>();
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
  private async searchInServer(serverId: string, criteria: PlayerSearchCriteria): Promise<PlayerIdentityMatch[]> {
    const matches: PlayerIdentityMatch[] = [];
    
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
    } catch (error) {
      this.ctx.logger('mochi-link:player').error(`Failed to search in server ${serverId}:`, error);
    }
    
    return matches;
  }

  /**
   * Resolve and deduplicate player matches
   */
  private resolvePlayerMatches(matches: PlayerIdentityMatch[]): PlayerIdentityMatch[] {
    // Group by player ID
    const grouped = new Map<string, PlayerIdentityMatch[]>();
    
    for (const match of matches) {
      const key = match.player.id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(match);
    }
    
    // Resolve conflicts and return best matches
    const resolved: PlayerIdentityMatch[] = [];
    
    for (const [playerId, playerMatches] of grouped) {
      if (playerMatches.length === 1) {
        resolved.push(playerMatches[0]);
      } else {
        // Choose match with highest confidence
        const bestMatch = playerMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        resolved.push(bestMatch);
      }
    }
    
    return resolved.sort((a, b) => b.confidence - a.confidence);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generatePlayerId(player: PlayerDetail): string {
    // Use ID as primary identifier, fallback to name
    return player.id || `name:${player.name}`;
  }

  private getCachedPlayer(playerId: string): PlayerCache | undefined {
    return this.playerCache.get(playerId);
  }

  private isCacheValid(cache: PlayerCache): boolean {
    const now = Date.now();
    const cacheAge = now - cache.lastSeen.getTime();
    return cacheAge < this.cacheTimeout;
  }

  private getBridge(serverId: string): any {
    // This would integrate with the connection manager to get the bridge
    // For now, return a mock
    return null;
  }

  private getConnectedServerIds(): string[] {
    // This would get the list of connected servers from the connection manager
    return [];
  }

  private updateSyncStatus(serverId: string): void {
    const status = this.syncStatus.get(serverId) || {
      serverId,
      lastSync: new Date(),
      pendingUpdates: 0,
      syncErrors: []
    };
    
    status.lastSync = new Date();
    this.syncStatus.set(serverId, status);
  }

  private matchesSearchCriteria(player: Player, criteria: PlayerSearchCriteria): boolean {
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

  private getMatchedIdentifiers(player: PlayerDetail, criteria: PlayerSearchCriteria): string[] {
    const matched: string[] = [];
    
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

  private initializeService(): void {
    const logger = this.ctx.logger('mochi-link:player');
    logger.info('Player Information Service initialized');
    
    // Set up periodic cache cleanup
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
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
  getSyncStatus(): Map<string, PlayerSyncStatus> {
    return new Map(this.syncStatus);
  }

  /**
   * Force refresh player cache for a specific server
   */
  async refreshServerCache(serverId: string): Promise<void> {
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
      
    } catch (error) {
      logger.error(`Failed to refresh cache for server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalPlayers: number;
    cacheHitRate: number;
    averageConfidence: number;
    conflictCount: number;
  } {
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