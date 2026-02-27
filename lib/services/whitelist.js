"use strict";
/**
 * Whitelist Management Service
 *
 * Provides unified whitelist management across different server types,
 * including bidirectional synchronization and offline operation caching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhitelistManager = void 0;
const table_names_1 = require("../database/table-names");
// ============================================================================
// Whitelist Manager Service
// ============================================================================
class WhitelistManager {
    constructor(ctx, getBridge) {
        this.whitelistCache = new Map();
        this.pendingOperations = new Map();
        this.syncStatus = new Map();
        // Ban system properties
        this.banCache = new Map();
        this.pendingBanOperations = new Map();
        this.banSyncStatus = new Map();
        this.syncInterval = 30 * 1000; // 30 seconds
        this.maxRetries = 3;
        this.ctx = ctx;
        this.getBridgeFn = getBridge;
        this.initializeService();
    }
    // ============================================================================
    // Server-Independent Whitelist Management
    // ============================================================================
    /**
     * Get whitelist for a specific server
     */
    async getWhitelist(serverId) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            // Check if server is online and sync if needed
            if (await this.isServerOnline(serverId)) {
                await this.syncFromServer(serverId);
            }
            // Return cached whitelist
            const cache = this.whitelistCache.get(serverId);
            if (cache) {
                return [...cache.entries]; // Return copy to prevent mutation
            }
            // If no cache, try to load from database
            const dbEntries = await this.loadWhitelistFromDatabase(serverId);
            if (dbEntries.length > 0) {
                this.updateCache(serverId, dbEntries);
                return dbEntries;
            }
            return [];
        }
        catch (error) {
            logger.error(`Failed to get whitelist for server ${serverId}:`, error);
            return [];
        }
    }
    /**
     * Add player to whitelist
     */
    async addToWhitelist(serverId, playerId, playerName, executor, reason) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            const operation = {
                type: 'add',
                playerId,
                playerName,
                reason,
                executor,
                timestamp: new Date()
            };
            // Check if server is online
            if (await this.isServerOnline(serverId)) {
                // Execute immediately on server
                const success = await this.executeOperationOnServer(serverId, operation);
                if (success) {
                    // Update local cache
                    await this.updateLocalWhitelist(serverId, operation);
                    // Record audit log
                    await this.recordAuditLog(serverId, operation, 'success');
                    return true;
                }
                else {
                    // If server execution fails, cache the operation
                    await this.cacheOperation(serverId, operation);
                    await this.recordAuditLog(serverId, operation, 'cached');
                    return false;
                }
            }
            else {
                // Server offline, cache the operation
                await this.cacheOperation(serverId, operation);
                await this.recordAuditLog(serverId, operation, 'cached');
                logger.info(`Cached whitelist add operation for offline server ${serverId}: ${playerId}`);
                return true; // Return true as operation is cached
            }
        }
        catch (error) {
            logger.error(`Failed to add ${playerId} to whitelist for server ${serverId}:`, error);
            await this.recordAuditLog(serverId, {
                type: 'add',
                playerId,
                playerName,
                reason,
                executor,
                timestamp: new Date()
            }, 'error', error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    /**
     * Remove player from whitelist
     */
    async removeFromWhitelist(serverId, playerId, executor, reason) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            const operation = {
                type: 'remove',
                playerId,
                reason,
                executor,
                timestamp: new Date()
            };
            // Check if server is online
            if (await this.isServerOnline(serverId)) {
                // Execute immediately on server
                const success = await this.executeOperationOnServer(serverId, operation);
                if (success) {
                    // Update local cache
                    await this.updateLocalWhitelist(serverId, operation);
                    // Record audit log
                    await this.recordAuditLog(serverId, operation, 'success');
                    return true;
                }
                else {
                    // If server execution fails, cache the operation
                    await this.cacheOperation(serverId, operation);
                    await this.recordAuditLog(serverId, operation, 'cached');
                    return false;
                }
            }
            else {
                // Server offline, cache the operation
                await this.cacheOperation(serverId, operation);
                await this.recordAuditLog(serverId, operation, 'cached');
                logger.info(`Cached whitelist remove operation for offline server ${serverId}: ${playerId}`);
                return true; // Return true as operation is cached
            }
        }
        catch (error) {
            logger.error(`Failed to remove ${playerId} from whitelist for server ${serverId}:`, error);
            await this.recordAuditLog(serverId, {
                type: 'remove',
                playerId,
                reason,
                executor,
                timestamp: new Date()
            }, 'error', error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    /**
     * Check if player is whitelisted
     */
    async isWhitelisted(serverId, playerId) {
        const whitelist = await this.getWhitelist(serverId);
        return whitelist.some(entry => entry.playerId === playerId);
    }
    // ============================================================================
    // Ban System Management
    // ============================================================================
    /**
     * Get ban list for a specific server
     */
    async getBanList(serverId) {
        const logger = this.ctx.logger('mochi-link:ban');
        try {
            // Check if server is online and sync if needed
            if (await this.isServerOnline(serverId)) {
                await this.syncBansFromServer(serverId);
            }
            // Return cached ban list
            const cache = this.banCache.get(serverId);
            if (cache) {
                return [...cache.filter(ban => ban.isActive)]; // Return only active bans
            }
            // If no cache, try to load from database
            const dbBans = await this.loadBansFromDatabase(serverId);
            if (dbBans.length > 0) {
                this.updateBanCache(serverId, dbBans);
                return dbBans.filter(ban => ban.isActive);
            }
            return [];
        }
        catch (error) {
            logger.error(`Failed to get ban list for server ${serverId}:`, error);
            return [];
        }
    }
    /**
     * Ban a target (player, IP, or device)
     */
    async banTarget(serverId, banType, target, targetName, reason, executor, duration // duration in milliseconds, undefined for permanent
    ) {
        const logger = this.ctx.logger('mochi-link:ban');
        try {
            const operation = {
                type: 'ban',
                banType,
                target,
                targetName,
                reason,
                executor,
                timestamp: new Date(),
                duration
            };
            // Check if server is online
            if (await this.isServerOnline(serverId)) {
                // Execute immediately on server
                const success = await this.executeBanOperationOnServer(serverId, operation);
                if (success) {
                    // Update local cache
                    await this.updateLocalBanList(serverId, operation);
                    // Record audit log
                    await this.recordAuditLog(serverId, operation, 'success');
                    return true;
                }
                else {
                    // If server execution fails, cache the operation
                    await this.cacheBanOperation(serverId, operation);
                    await this.recordAuditLog(serverId, operation, 'cached');
                    return false;
                }
            }
            else {
                // Server offline, cache the operation
                await this.cacheBanOperation(serverId, operation);
                await this.recordAuditLog(serverId, operation, 'cached');
                logger.info(`Cached ban operation for offline server ${serverId}: ${banType} ${target}`);
                return true; // Return true as operation is cached
            }
        }
        catch (error) {
            logger.error(`Failed to ban ${target} on server ${serverId}:`, error);
            await this.recordAuditLog(serverId, {
                type: 'ban',
                banType,
                target,
                targetName,
                reason,
                executor,
                timestamp: new Date(),
                duration
            }, 'error', error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    /**
     * Unban a target
     */
    async unbanTarget(serverId, banType, target, executor, reason) {
        const logger = this.ctx.logger('mochi-link:ban');
        try {
            const operation = {
                type: 'unban',
                banType,
                target,
                reason,
                executor,
                timestamp: new Date()
            };
            // Check if server is online
            if (await this.isServerOnline(serverId)) {
                // Execute immediately on server
                const success = await this.executeBanOperationOnServer(serverId, operation);
                if (success) {
                    // Update local cache
                    await this.updateLocalBanList(serverId, operation);
                    // Record audit log
                    await this.recordAuditLog(serverId, operation, 'success');
                    return true;
                }
                else {
                    // If server execution fails, cache the operation
                    await this.cacheBanOperation(serverId, operation);
                    await this.recordAuditLog(serverId, operation, 'cached');
                    return false;
                }
            }
            else {
                // Server offline, cache the operation
                await this.cacheBanOperation(serverId, operation);
                await this.recordAuditLog(serverId, operation, 'cached');
                logger.info(`Cached unban operation for offline server ${serverId}: ${banType} ${target}`);
                return true; // Return true as operation is cached
            }
        }
        catch (error) {
            logger.error(`Failed to unban ${target} on server ${serverId}:`, error);
            await this.recordAuditLog(serverId, {
                type: 'unban',
                banType,
                target,
                reason,
                executor,
                timestamp: new Date()
            }, 'error', error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    /**
     * Check if a target is banned
     */
    async isBanned(serverId, banType, target) {
        const banList = await this.getBanList(serverId);
        return banList.some(ban => ban.banType === banType && ban.target === target && ban.isActive);
    }
    /**
     * Get ban information for a specific target
     */
    async getBanInfo(serverId, banType, target) {
        const banList = await this.getBanList(serverId);
        return banList.find(ban => ban.banType === banType && ban.target === target && ban.isActive) || null;
    }
    /**
     * Process expired bans automatically
     */
    async processExpiredBans() {
        const logger = this.ctx.logger('mochi-link:ban');
        try {
            const now = new Date();
            for (const [serverId, bans] of this.banCache.entries()) {
                const expiredBans = bans.filter(ban => ban.isActive &&
                    ban.expiresAt &&
                    ban.expiresAt <= now);
                for (const expiredBan of expiredBans) {
                    logger.info(`Auto-unbanning expired ${expiredBan.banType} ban: ${expiredBan.target} on server ${serverId}`);
                    // Mark as inactive
                    expiredBan.isActive = false;
                    // Try to unban on server if online
                    if (await this.isServerOnline(serverId)) {
                        await this.executeBanOperationOnServer(serverId, {
                            type: 'unban',
                            banType: expiredBan.banType,
                            target: expiredBan.target,
                            executor: 'system',
                            timestamp: now,
                            reason: 'Ban expired'
                        });
                    }
                    // Record audit log
                    await this.recordAuditLog(serverId, {
                        type: 'unban',
                        banType: expiredBan.banType,
                        target: expiredBan.target,
                        executor: 'system',
                        timestamp: now,
                        reason: 'Ban expired'
                    }, 'success');
                }
                // Update cache
                this.banCache.set(serverId, bans);
                // Save to database
                await this.saveBansToDatabase(serverId, bans);
            }
        }
        catch (error) {
            logger.error('Failed to process expired bans:', error);
        }
    }
    // ============================================================================
    // Ban System Internal Methods
    // ============================================================================
    /**
     * Cache a ban operation for later execution
     */
    async cacheBanOperation(serverId, operation) {
        const logger = this.ctx.logger('mochi-link:ban');
        try {
            // Get existing pending operations
            let pending = this.pendingBanOperations.get(serverId) || [];
            // Optimize operations (cancel out conflicting operations)
            pending = this.optimizeBanOperations(pending, operation);
            // Store in memory
            this.pendingBanOperations.set(serverId, pending);
            // Persist to database
            await this.savePendingBanOperationToDatabase(serverId, operation);
            // Update sync status
            const status = this.banSyncStatus.get(serverId);
            if (status) {
                status.pendingOperations = pending.length;
            }
            logger.debug(`Cached ban operation for server ${serverId}: ${operation.type} ${operation.target}`);
        }
        catch (error) {
            logger.error(`Failed to cache ban operation for server ${serverId}:`, error);
            throw error;
        }
    }
    /**
     * Optimize ban operations by canceling out conflicting ones
     */
    optimizeBanOperations(existing, newOperation) {
        const optimized = [...existing];
        // Find conflicting operations for the same target
        const conflictIndex = optimized.findIndex(op => op.banType === newOperation.banType &&
            op.target === newOperation.target &&
            op.type !== newOperation.type);
        if (conflictIndex !== -1) {
            // Remove the conflicting operation instead of adding the new one
            optimized.splice(conflictIndex, 1);
            return optimized;
        }
        // Check for duplicate operations
        const duplicateIndex = optimized.findIndex(op => op.banType === newOperation.banType &&
            op.target === newOperation.target &&
            op.type === newOperation.type);
        if (duplicateIndex !== -1) {
            // Update the existing operation with newer timestamp and executor
            optimized[duplicateIndex] = newOperation;
            return optimized;
        }
        // Add new operation
        optimized.push(newOperation);
        return optimized;
    }
    /**
     * Execute ban operation on server
     */
    async executeBanOperationOnServer(serverId, operation) {
        try {
            const bridge = await this.getBridge(serverId);
            if (!bridge || !bridge.hasCapability('ban_management')) {
                return false;
            }
            if (operation.type === 'ban') {
                return await bridge.banTarget(operation.banType, operation.target, operation.targetName || operation.target, operation.reason || 'No reason provided', operation.duration);
            }
            else {
                return await bridge.unbanTarget(operation.banType, operation.target);
            }
        }
        catch (error) {
            this.ctx.logger('mochi-link:ban').error(`Failed to execute ${operation.type} operation on server ${serverId}:`, error);
            return false;
        }
    }
    /**
     * Update local ban cache
     */
    async updateLocalBanList(serverId, operation) {
        let bans = this.banCache.get(serverId) || [];
        if (operation.type === 'ban') {
            // Remove existing ban for the same target if present
            bans = bans.filter(ban => !(ban.banType === operation.banType && ban.target === operation.target));
            // Add new ban entry
            const expiresAt = operation.duration ?
                new Date(operation.timestamp.getTime() + operation.duration) :
                undefined;
            bans.push({
                id: `${serverId}-${operation.banType}-${operation.target}-${operation.timestamp.getTime()}`,
                serverId,
                banType: operation.banType,
                target: operation.target,
                targetName: operation.targetName,
                reason: operation.reason || 'No reason provided',
                bannedBy: operation.executor,
                bannedAt: operation.timestamp,
                expiresAt,
                isActive: true
            });
        }
        else {
            // Mark existing ban as inactive
            const existingBan = bans.find(ban => ban.banType === operation.banType &&
                ban.target === operation.target &&
                ban.isActive);
            if (existingBan) {
                existingBan.isActive = false;
            }
        }
        this.banCache.set(serverId, bans);
        // Save to database
        await this.saveBansToDatabase(serverId, bans);
    }
    /**
     * Sync bans from server to local cache
     */
    async syncBansFromServer(serverId) {
        const logger = this.ctx.logger('mochi-link:ban');
        try {
            const bridge = await this.getBridge(serverId);
            if (!bridge || !bridge.hasCapability('ban_management')) {
                logger.warn(`Server ${serverId} does not support ban management`);
                return;
            }
            // Get ban list from server
            const serverBans = await bridge.getBanList();
            // Convert to BanEntry format
            const entries = serverBans.map((ban) => ({
                id: `${serverId}-${ban.type}-${ban.target}-${ban.createdAt || Date.now()}`,
                serverId,
                banType: ban.type,
                target: ban.target,
                targetName: ban.targetName,
                reason: ban.reason || 'No reason provided',
                bannedBy: ban.bannedBy || 'system',
                bannedAt: ban.createdAt ? new Date(ban.createdAt) : new Date(),
                expiresAt: ban.expiresAt ? new Date(ban.expiresAt) : undefined,
                isActive: ban.isActive !== false
            }));
            // Update cache
            this.updateBanCache(serverId, entries);
            // Update sync status
            this.updateBanSyncStatus(serverId, true);
            logger.debug(`Synced ban list from server ${serverId}: ${entries.length} entries`);
        }
        catch (error) {
            logger.error(`Failed to sync ban list from server ${serverId}:`, error);
            this.updateBanSyncStatus(serverId, false, error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Update ban cache
     */
    updateBanCache(serverId, bans) {
        this.banCache.set(serverId, [...bans]);
    }
    /**
     * Update ban sync status
     */
    updateBanSyncStatus(serverId, success, error) {
        const existing = this.banSyncStatus.get(serverId);
        const status = {
            serverId,
            lastSync: new Date(),
            pendingOperations: existing?.pendingOperations || 0,
            syncErrors: success ? [] : (error ? [error] : existing?.syncErrors || []),
            isOnline: success
        };
        this.banSyncStatus.set(serverId, status);
    }
    // ============================================================================
    // Bidirectional Synchronization (Koishi ? Server)
    // ============================================================================
    /**
     * Sync whitelist from server to local cache
     */
    async syncFromServer(serverId) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            const bridge = await this.getBridge(serverId);
            if (!bridge || !bridge.hasCapability('whitelist_management')) {
                logger.warn(`Server ${serverId} does not support whitelist management`);
                return;
            }
            // Get whitelist from server
            const serverWhitelist = await bridge.getWhitelist();
            // Convert to WhitelistEntry format
            const entries = serverWhitelist.map((entry) => ({
                playerId: entry.id,
                playerName: entry.name,
                addedBy: entry.addedBy || 'system',
                addedAt: entry.addedAt || new Date(),
                reason: entry.reason,
                serverId
            }));
            // Update cache
            this.updateCache(serverId, entries);
            // Update sync status
            this.updateSyncStatus(serverId, true);
            logger.debug(`Synced whitelist from server ${serverId}: ${entries.length} entries`);
        }
        catch (error) {
            logger.error(`Failed to sync whitelist from server ${serverId}:`, error);
            this.updateSyncStatus(serverId, false, error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Sync whitelist from local cache to server
     */
    async syncToServer(serverId) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            const bridge = await this.getBridge(serverId);
            if (!bridge || !bridge.hasCapability('whitelist_management')) {
                logger.warn(`Server ${serverId} does not support whitelist management`);
                return;
            }
            const cache = this.whitelistCache.get(serverId);
            if (!cache) {
                logger.warn(`No whitelist cache found for server ${serverId}`);
                return;
            }
            // Get current server whitelist
            const serverWhitelist = await bridge.getWhitelist();
            const serverPlayerIds = new Set(serverWhitelist.map((entry) => entry.id));
            // Find differences
            const toAdd = cache.entries.filter(entry => !serverPlayerIds.has(entry.playerId));
            const toRemove = serverWhitelist.filter((entry) => !cache.entries.some(cacheEntry => cacheEntry.playerId === entry.id));
            // Apply changes to server
            for (const entry of toAdd) {
                await bridge.addToWhitelist(entry.playerId, entry.playerName, entry.reason);
                logger.debug(`Added ${entry.playerId} to server ${serverId} whitelist`);
            }
            for (const entry of toRemove) {
                await bridge.removeFromWhitelist(entry.id);
                logger.debug(`Removed ${entry.id} from server ${serverId} whitelist`);
            }
            logger.info(`Synced whitelist to server ${serverId}: +${toAdd.length}, -${toRemove.length}`);
        }
        catch (error) {
            logger.error(`Failed to sync whitelist to server ${serverId}:`, error);
            this.updateSyncStatus(serverId, false, error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Force full bidirectional sync
     */
    async forceSyncBidirectional(serverId) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            // First sync from server (server is authoritative)
            await this.syncFromServer(serverId);
            // Then process any pending operations
            await this.processPendingOperations(serverId);
            logger.info(`Completed bidirectional sync for server ${serverId}`);
        }
        catch (error) {
            logger.error(`Failed bidirectional sync for server ${serverId}:`, error);
            throw error;
        }
    }
    // ============================================================================
    // Offline Operation Caching
    // ============================================================================
    /**
     * Cache an operation for later execution
     */
    async cacheOperation(serverId, operation) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            // Get existing pending operations
            let pending = this.pendingOperations.get(serverId) || [];
            // Optimize operations (cancel out conflicting operations)
            pending = this.optimizeOperations(pending, operation);
            // Store in memory
            this.pendingOperations.set(serverId, pending);
            // Persist to database
            await this.savePendingOperationToDatabase(serverId, operation);
            // Update sync status
            const status = this.syncStatus.get(serverId);
            if (status) {
                status.pendingOperations = pending.length;
            }
            logger.debug(`Cached operation for server ${serverId}: ${operation.type} ${operation.playerId}`);
        }
        catch (error) {
            logger.error(`Failed to cache operation for server ${serverId}:`, error);
            throw error;
        }
    }
    /**
     * Optimize operations by canceling out conflicting ones
     */
    optimizeOperations(existing, newOperation) {
        const optimized = [...existing];
        // Find conflicting operations for the same player
        const conflictIndex = optimized.findIndex(op => op.playerId === newOperation.playerId && op.type !== newOperation.type);
        if (conflictIndex !== -1) {
            // Remove the conflicting operation instead of adding the new one
            optimized.splice(conflictIndex, 1);
            return optimized;
        }
        // Check for duplicate operations
        const duplicateIndex = optimized.findIndex(op => op.playerId === newOperation.playerId && op.type === newOperation.type);
        if (duplicateIndex !== -1) {
            // Update the existing operation with newer timestamp and executor
            optimized[duplicateIndex] = newOperation;
            return optimized;
        }
        // Add new operation
        optimized.push(newOperation);
        return optimized;
    }
    /**
     * Process pending operations when server comes online
     */
    async processPendingOperations(serverId) {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            const pending = this.pendingOperations.get(serverId) || [];
            if (pending.length === 0) {
                return;
            }
            logger.info(`Processing ${pending.length} pending operations for server ${serverId}`);
            const results = {
                success: 0,
                failed: 0,
                errors: []
            };
            for (const operation of pending) {
                try {
                    const success = await this.executeOperationOnServer(serverId, operation);
                    if (success) {
                        await this.updateLocalWhitelist(serverId, operation);
                        await this.recordAuditLog(serverId, operation, 'success');
                        results.success++;
                    }
                    else {
                        results.failed++;
                        results.errors.push(`Failed to execute ${operation.type} for ${operation.playerId}`);
                    }
                }
                catch (error) {
                    results.failed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    results.errors.push(`Error executing ${operation.type} for ${operation.playerId}: ${errorMsg}`);
                    await this.recordAuditLog(serverId, operation, 'error', errorMsg);
                }
            }
            // Clear processed operations
            this.pendingOperations.delete(serverId);
            await this.clearPendingOperationsFromDatabase(serverId);
            // Update sync status
            const status = this.syncStatus.get(serverId);
            if (status) {
                status.pendingOperations = 0;
                if (results.failed > 0) {
                    status.syncErrors = results.errors;
                }
                else {
                    status.syncErrors = [];
                }
            }
            logger.info(`Processed pending operations for server ${serverId}: ${results.success} success, ${results.failed} failed`);
        }
        catch (error) {
            logger.error(`Failed to process pending operations for server ${serverId}:`, error);
            throw error;
        }
    }
    // ============================================================================
    // Server Integration Methods
    // ============================================================================
    /**
     * Execute whitelist operation on server
     */
    async executeOperationOnServer(serverId, operation) {
        try {
            const bridge = await this.getBridge(serverId);
            if (!bridge || !bridge.hasCapability('whitelist_management')) {
                return false;
            }
            if (operation.type === 'add') {
                return await bridge.addToWhitelist(operation.playerId, operation.playerName || operation.playerId, operation.reason);
            }
            else {
                return await bridge.removeFromWhitelist(operation.playerId);
            }
        }
        catch (error) {
            this.ctx.logger('mochi-link:whitelist').error(`Failed to execute ${operation.type} operation on server ${serverId}:`, error);
            return false;
        }
    }
    /**
     * Update local whitelist cache
     */
    async updateLocalWhitelist(serverId, operation) {
        const cache = this.whitelistCache.get(serverId);
        if (!cache) {
            return;
        }
        if (operation.type === 'add') {
            // Remove existing entry if present
            cache.entries = cache.entries.filter(entry => entry.playerId !== operation.playerId);
            // Add new entry
            cache.entries.push({
                playerId: operation.playerId,
                playerName: operation.playerName || operation.playerId,
                addedBy: operation.executor,
                addedAt: operation.timestamp,
                reason: operation.reason,
                serverId
            });
        }
        else {
            // Remove entry
            cache.entries = cache.entries.filter(entry => entry.playerId !== operation.playerId);
        }
        cache.lastUpdate = new Date();
        cache.version++;
        // Save to database
        await this.saveWhitelistToDatabase(serverId, cache.entries);
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Check if server is online
     */
    async isServerOnline(serverId) {
        try {
            const bridge = await this.getBridge(serverId);
            return bridge ? await bridge.isHealthy() : false;
        }
        catch {
            return false;
        }
    }
    /**
     * Get bridge for server
     */
    async getBridge(serverId) {
        const bridge = this.getBridgeFn(serverId);
        if (!bridge) {
            this.ctx.logger('mochi-link:whitelist').warn(`Bridge not available for server ${serverId}, operations will be queued`);
        }
        return bridge;
    }
    /**
     * Update cache
     */
    updateCache(serverId, entries) {
        this.whitelistCache.set(serverId, {
            serverId,
            entries: [...entries],
            lastUpdate: new Date(),
            version: (this.whitelistCache.get(serverId)?.version || 0) + 1
        });
    }
    /**
     * Update sync status
     */
    updateSyncStatus(serverId, success, error) {
        const existing = this.syncStatus.get(serverId);
        const status = {
            serverId,
            lastSync: new Date(),
            pendingOperations: existing?.pendingOperations || 0,
            syncErrors: success ? [] : (error ? [error] : existing?.syncErrors || []),
            isOnline: success
        };
        this.syncStatus.set(serverId, status);
    }
    /**
     * Initialize service
     */
    initializeService() {
        const logger = this.ctx.logger('mochi-link:whitelist');
        logger.info('Whitelist Manager initialized');
        // Set up periodic sync for online servers
        setInterval(() => {
            this.performPeriodicSync();
        }, this.syncInterval);
        // Set up expired ban processing (every 5 minutes)
        setInterval(() => {
            this.processExpiredBans();
        }, 5 * 60 * 1000);
        // Load pending operations from database on startup
        this.loadPendingOperationsFromDatabase();
    }
    /**
     * Perform periodic sync for all servers
     */
    async performPeriodicSync() {
        const logger = this.ctx.logger('mochi-link:whitelist');
        try {
            // Get all servers that need syncing
            const whitelistServerIds = Array.from(this.whitelistCache.keys());
            const banServerIds = Array.from(this.banCache.keys());
            const allServerIds = new Set([...whitelistServerIds, ...banServerIds]);
            for (const serverId of allServerIds) {
                try {
                    if (await this.isServerOnline(serverId)) {
                        // Process pending whitelist operations first
                        await this.processPendingOperations(serverId);
                        // Process pending ban operations
                        await this.processPendingBanOperations(serverId);
                        // Then sync from server
                        await this.syncFromServer(serverId);
                        await this.syncBansFromServer(serverId);
                    }
                }
                catch (error) {
                    logger.error(`Periodic sync failed for server ${serverId}:`, error);
                }
            }
            // Process expired bans
            await this.processExpiredBans();
        }
        catch (error) {
            logger.error('Periodic sync error:', error);
        }
    }
    /**
     * Process pending ban operations when server comes online
     */
    async processPendingBanOperations(serverId) {
        const logger = this.ctx.logger('mochi-link:ban');
        try {
            const pending = this.pendingBanOperations.get(serverId) || [];
            if (pending.length === 0) {
                return;
            }
            logger.info(`Processing ${pending.length} pending ban operations for server ${serverId}`);
            const results = {
                success: 0,
                failed: 0,
                errors: []
            };
            for (const operation of pending) {
                try {
                    const success = await this.executeBanOperationOnServer(serverId, operation);
                    if (success) {
                        await this.updateLocalBanList(serverId, operation);
                        await this.recordAuditLog(serverId, operation, 'success');
                        results.success++;
                    }
                    else {
                        results.failed++;
                        results.errors.push(`Failed to execute ${operation.type} for ${operation.target}`);
                    }
                }
                catch (error) {
                    results.failed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    results.errors.push(`Error executing ${operation.type} for ${operation.target}: ${errorMsg}`);
                    await this.recordAuditLog(serverId, operation, 'error', errorMsg);
                }
            }
            // Clear processed operations
            this.pendingBanOperations.delete(serverId);
            await this.clearPendingBanOperationsFromDatabase(serverId);
            // Update sync status
            const status = this.banSyncStatus.get(serverId);
            if (status) {
                status.pendingOperations = 0;
                if (results.failed > 0) {
                    status.syncErrors = results.errors;
                }
                else {
                    status.syncErrors = [];
                }
            }
            logger.info(`Processed pending ban operations for server ${serverId}: ${results.success} success, ${results.failed} failed`);
        }
        catch (error) {
            logger.error(`Failed to process pending ban operations for server ${serverId}:`, error);
            throw error;
        }
    }
    // ============================================================================
    // Database Operations
    // ============================================================================
    async loadWhitelistFromDatabase(serverId) {
        try {
            // Load whitelist entries from player_cache table
            const cacheEntries = await this.ctx.database.get(table_names_1.TableNames.playerCache, {
                last_server_id: serverId
            });
            // Convert to WhitelistEntry format
            return cacheEntries.map(entry => ({
                playerId: entry.uuid || entry.xuid || entry.name,
                playerName: entry.name,
                addedBy: 'system', // Default value since we don't store this in player_cache
                addedAt: entry.created_at,
                serverId,
                reason: 'Loaded from cache'
            }));
        }
        catch (error) {
            this.ctx.logger('mochi-link:whitelist').error(`Failed to load whitelist from database for server ${serverId}:`, error);
            return [];
        }
    }
    async saveWhitelistToDatabase(serverId, entries) {
        try {
            // For now, we'll use the pending_operations table to store whitelist state
            // In a full implementation, you might want a dedicated whitelist table
            // Clear existing whitelist entries for this server
            await this.ctx.database.remove(table_names_1.TableNames.pendingOperations, {
                server_id: serverId,
                operation_type: 'whitelist_state'
            });
            // Save current whitelist state
            if (entries.length > 0) {
                await this.ctx.database.create(table_names_1.TableNames.pendingOperations, {
                    server_id: serverId,
                    operation_type: 'whitelist_state',
                    target: 'whitelist',
                    parameters: JSON.stringify(entries),
                    status: 'completed'
                });
            }
        }
        catch (error) {
            this.ctx.logger('mochi-link:whitelist').error(`Failed to save whitelist to database for server ${serverId}:`, error);
        }
    }
    async savePendingOperationToDatabase(serverId, operation) {
        try {
            await this.ctx.database.create(table_names_1.TableNames.pendingOperations, {
                server_id: serverId,
                operation_type: `whitelist_${operation.type}`,
                target: operation.playerId,
                parameters: JSON.stringify({
                    playerName: operation.playerName,
                    reason: operation.reason,
                    executor: operation.executor,
                    timestamp: operation.timestamp.toISOString()
                }),
                status: 'pending'
            });
        }
        catch (error) {
            this.ctx.logger('mochi-link:whitelist').error(`Failed to save pending operation to database:`, error);
        }
    }
    async clearPendingOperationsFromDatabase(serverId) {
        try {
            await this.ctx.database.remove(table_names_1.TableNames.pendingOperations, {
                server_id: serverId,
                operation_type: { $regex: /^whitelist_(add|remove)$/ }
            });
        }
        catch (error) {
            this.ctx.logger('mochi-link:whitelist').error(`Failed to clear pending operations from database:`, error);
        }
    }
    async loadPendingOperationsFromDatabase() {
        try {
            // Load whitelist operations
            const pendingOps = await this.ctx.database.get(table_names_1.TableNames.pendingOperations, {
                status: 'pending',
                operation_type: { $regex: /^whitelist_(add|remove)$/ }
            });
            // Group by server
            const serverOps = new Map();
            for (const op of pendingOps) {
                if (!serverOps.has(op.server_id)) {
                    serverOps.set(op.server_id, []);
                }
                try {
                    // Safely parse parameters
                    let params = {};
                    if (op.parameters) {
                        if (typeof op.parameters === 'string') {
                            if (op.parameters.trim()) {
                                params = JSON.parse(op.parameters);
                            }
                        }
                        else {
                            params = op.parameters;
                        }
                    }
                    const operation = {
                        type: op.operation_type.replace('whitelist_', ''),
                        playerId: op.target,
                        playerName: params.playerName,
                        reason: params.reason,
                        executor: params.executor,
                        timestamp: new Date(params.timestamp)
                    };
                    serverOps.get(op.server_id).push(operation);
                }
                catch (parseError) {
                    this.ctx.logger('mochi-link:whitelist').error(`Failed to parse pending operation:`, parseError);
                }
            }
            // Load into memory
            for (const [serverId, operations] of serverOps) {
                this.pendingOperations.set(serverId, operations);
            }
            // Load ban operations
            const pendingBanOps = await this.ctx.database.get(table_names_1.TableNames.pendingOperations, {
                status: 'pending',
                operation_type: { $regex: /^ban_(ban|unban)$/ }
            });
            // Group ban operations by server
            const serverBanOps = new Map();
            for (const op of pendingBanOps) {
                if (!serverBanOps.has(op.server_id)) {
                    serverBanOps.set(op.server_id, []);
                }
                try {
                    // Safely parse parameters
                    let params = {};
                    if (op.parameters) {
                        if (typeof op.parameters === 'string') {
                            if (op.parameters.trim()) {
                                params = JSON.parse(op.parameters);
                            }
                        }
                        else {
                            params = op.parameters;
                        }
                    }
                    const operation = {
                        type: op.operation_type.replace('ban_', ''),
                        banType: params.banType,
                        target: op.target,
                        targetName: params.targetName,
                        reason: params.reason,
                        executor: params.executor,
                        timestamp: new Date(params.timestamp),
                        duration: params.duration
                    };
                    serverBanOps.get(op.server_id).push(operation);
                }
                catch (parseError) {
                    this.ctx.logger('mochi-link:ban').error(`Failed to parse pending ban operation:`, parseError);
                }
            }
            // Load ban operations into memory
            for (const [serverId, operations] of serverBanOps) {
                this.pendingBanOperations.set(serverId, operations);
            }
        }
        catch (error) {
            this.ctx.logger('mochi-link:whitelist').error(`Failed to load pending operations from database:`, error);
        }
    }
    async recordAuditLog(serverId, operation, result, errorMessage) {
        try {
            const operationData = {
                type: operation.type,
                target: 'playerId' in operation ? operation.playerId : operation.target,
                executor: operation.executor,
                timestamp: operation.timestamp.toISOString(),
                reason: operation.reason
            };
            if ('banType' in operation) {
                operationData.banType = operation.banType;
                operationData.duration = operation.duration;
            }
            if ('playerName' in operation) {
                operationData.playerName = operation.playerName;
            }
            await this.ctx.database.create(table_names_1.TableNames.auditLogs, {
                user_id: operation.executor,
                server_id: serverId,
                operation: `${('banType' in operation) ? 'ban' : 'whitelist'}_${operation.type}`,
                operation_data: JSON.stringify(operationData),
                result,
                error_message: errorMessage
            });
        }
        catch (error) {
            this.ctx.logger('mochi-link:whitelist').error(`Failed to record audit log:`, error);
        }
    }
    // ============================================================================
    // Ban System Database Operations
    // ============================================================================
    async loadBansFromDatabase(serverId) {
        try {
            // Load ban entries from pending_operations table
            const banOps = await this.ctx.database.get(table_names_1.TableNames.pendingOperations, {
                server_id: serverId,
                operation_type: 'ban_state'
            });
            if (banOps.length === 0) {
                return [];
            }
            // Get the latest ban state
            const latestBanState = banOps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            try {
                // Safely parse parameters
                let bans = [];
                if (latestBanState.parameters) {
                    if (typeof latestBanState.parameters === 'string') {
                        if (latestBanState.parameters.trim()) {
                            bans = JSON.parse(latestBanState.parameters);
                        }
                    }
                    else {
                        bans = latestBanState.parameters;
                    }
                }
                return bans.map((ban) => ({
                    ...ban,
                    bannedAt: new Date(ban.bannedAt),
                    expiresAt: ban.expiresAt ? new Date(ban.expiresAt) : undefined
                }));
            }
            catch (parseError) {
                this.ctx.logger('mochi-link:ban').error(`Failed to parse ban state:`, parseError);
                return [];
            }
        }
        catch (error) {
            this.ctx.logger('mochi-link:ban').error(`Failed to load bans from database for server ${serverId}:`, error);
            return [];
        }
    }
    async saveBansToDatabase(serverId, bans) {
        try {
            // Save current ban state
            await this.ctx.database.create(table_names_1.TableNames.pendingOperations, {
                server_id: serverId,
                operation_type: 'ban_state',
                target: 'bans',
                parameters: JSON.stringify(bans.map(ban => ({
                    ...ban,
                    bannedAt: ban.bannedAt.toISOString(),
                    expiresAt: ban.expiresAt?.toISOString()
                }))),
                status: 'completed'
            });
        }
        catch (error) {
            this.ctx.logger('mochi-link:ban').error(`Failed to save bans to database for server ${serverId}:`, error);
        }
    }
    async savePendingBanOperationToDatabase(serverId, operation) {
        try {
            await this.ctx.database.create(table_names_1.TableNames.pendingOperations, {
                server_id: serverId,
                operation_type: `ban_${operation.type}`,
                target: operation.target,
                parameters: JSON.stringify({
                    banType: operation.banType,
                    targetName: operation.targetName,
                    reason: operation.reason,
                    executor: operation.executor,
                    timestamp: operation.timestamp.toISOString(),
                    duration: operation.duration
                }),
                status: 'pending'
            });
        }
        catch (error) {
            this.ctx.logger('mochi-link:ban').error(`Failed to save pending ban operation to database:`, error);
        }
    }
    async clearPendingBanOperationsFromDatabase(serverId) {
        try {
            await this.ctx.database.remove(table_names_1.TableNames.pendingOperations, {
                server_id: serverId,
                operation_type: { $regex: /^ban_(ban|unban)$/ }
            });
        }
        catch (error) {
            this.ctx.logger('mochi-link:ban').error(`Failed to clear pending ban operations from database:`, error);
        }
    }
    // ============================================================================
    // Public API Methods
    // ============================================================================
    /**
     * Get sync status for a server
     */
    getSyncStatus(serverId) {
        return this.syncStatus.get(serverId) || null;
    }
    /**
     * Get sync status for all servers
     */
    getAllSyncStatus() {
        return new Map(this.syncStatus);
    }
    /**
     * Get pending operations count for a server
     */
    getPendingOperationsCount(serverId) {
        return this.pendingOperations.get(serverId)?.length || 0;
    }
    /**
     * Get pending operations for a server
     */
    getPendingOperations(serverId) {
        return [...(this.pendingOperations.get(serverId) || [])];
    }
    /**
     * Clear all pending operations for a server (admin function)
     */
    async clearPendingOperations(serverId, executor) {
        this.pendingOperations.delete(serverId);
        await this.clearPendingOperationsFromDatabase(serverId);
        const status = this.syncStatus.get(serverId);
        if (status) {
            status.pendingOperations = 0;
        }
        await this.recordAuditLog(serverId, {
            type: 'remove',
            playerId: 'ALL_PENDING',
            executor,
            timestamp: new Date()
        }, 'success');
        this.ctx.logger('mochi-link:whitelist').info(`Cleared all pending operations for server ${serverId} by ${executor}`);
    }
    /**
     * Get whitelist statistics
     */
    getWhitelistStats() {
        const totalServers = this.whitelistCache.size;
        const totalEntries = Array.from(this.whitelistCache.values())
            .reduce((sum, cache) => sum + cache.entries.length, 0);
        const totalPendingOperations = Array.from(this.pendingOperations.values())
            .reduce((sum, ops) => sum + ops.length, 0);
        const serversOnline = Array.from(this.syncStatus.values())
            .filter(status => status.isOnline).length;
        const lastSyncErrors = Array.from(this.syncStatus.values())
            .filter(status => status.syncErrors.length > 0).length;
        return {
            totalServers,
            totalEntries,
            totalPendingOperations,
            serversOnline,
            lastSyncErrors
        };
    }
    // ============================================================================
    // Ban System Public API Methods
    // ============================================================================
    /**
     * Get ban sync status for a server
     */
    getBanSyncStatus(serverId) {
        return this.banSyncStatus.get(serverId) || null;
    }
    /**
     * Get ban sync status for all servers
     */
    getAllBanSyncStatus() {
        return new Map(this.banSyncStatus);
    }
    /**
     * Get pending ban operations count for a server
     */
    getPendingBanOperationsCount(serverId) {
        return this.pendingBanOperations.get(serverId)?.length || 0;
    }
    /**
     * Get pending ban operations for a server
     */
    getPendingBanOperations(serverId) {
        return [...(this.pendingBanOperations.get(serverId) || [])];
    }
    /**
     * Clear all pending ban operations for a server (admin function)
     */
    async clearPendingBanOperations(serverId, executor) {
        this.pendingBanOperations.delete(serverId);
        await this.clearPendingBanOperationsFromDatabase(serverId);
        const status = this.banSyncStatus.get(serverId);
        if (status) {
            status.pendingOperations = 0;
        }
        await this.recordAuditLog(serverId, {
            type: 'unban',
            banType: 'player',
            target: 'ALL_PENDING',
            executor,
            timestamp: new Date()
        }, 'success');
        this.ctx.logger('mochi-link:ban').info(`Cleared all pending ban operations for server ${serverId} by ${executor}`);
    }
    /**
     * Get ban statistics
     */
    getBanStats() {
        const totalServers = this.banCache.size;
        const allBans = Array.from(this.banCache.values()).flat();
        const activeBans = allBans.filter(ban => ban.isActive);
        const totalActiveBans = activeBans.length;
        const totalPendingOperations = Array.from(this.pendingBanOperations.values())
            .reduce((sum, ops) => sum + ops.length, 0);
        const serversOnline = Array.from(this.banSyncStatus.values())
            .filter(status => status.isOnline).length;
        const lastSyncErrors = Array.from(this.banSyncStatus.values())
            .filter(status => status.syncErrors.length > 0).length;
        const bansByType = {
            player: activeBans.filter(ban => ban.banType === 'player').length,
            ip: activeBans.filter(ban => ban.banType === 'ip').length,
            device: activeBans.filter(ban => ban.banType === 'device').length
        };
        return {
            totalServers,
            totalActiveBans,
            totalPendingOperations,
            serversOnline,
            lastSyncErrors,
            bansByType
        };
    }
    /**
     * Get all active bans across all servers
     */
    getAllActiveBans() {
        const allBans = [];
        for (const bans of this.banCache.values()) {
            allBans.push(...bans.filter(ban => ban.isActive));
        }
        return allBans;
    }
    /**
     * Search bans by target or reason
     */
    searchBans(query, serverId) {
        const searchIn = serverId ?
            [this.banCache.get(serverId) || []] :
            Array.from(this.banCache.values());
        const allBans = searchIn.flat().filter(ban => ban.isActive);
        const lowerQuery = query.toLowerCase();
        return allBans.filter(ban => ban.target.toLowerCase().includes(lowerQuery) ||
            ban.targetName?.toLowerCase().includes(lowerQuery) ||
            ban.reason.toLowerCase().includes(lowerQuery) ||
            ban.bannedBy.toLowerCase().includes(lowerQuery));
    }
}
exports.WhitelistManager = WhitelistManager;
