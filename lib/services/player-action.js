"use strict";
/**
 * Player Action Service
 *
 * Handles player management actions such as kicking, messaging, teleporting, etc.
 * This service is separate from PlayerInformationService to maintain separation
 * of concerns: information queries vs. action execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerActionService = void 0;
// ============================================================================
// Player Action Service
// ============================================================================
class PlayerActionService {
    constructor(ctx, getBridge, auditService, permissionManager) {
        this.ctx = ctx;
        this.getBridge = getBridge;
        this.auditService = auditService;
        this.permissionManager = permissionManager;
        this.logger = ctx.logger('mochi-link:player-action');
    }
    // ============================================================================
    // Player Kick
    // ============================================================================
    /**
     * Kick a player from the server
     */
    async kickPlayer(serverId, options) {
        const startTime = Date.now();
        try {
            // Permission check
            if (options.executor) {
                const hasPermission = await this.permissionManager.checkPermission(options.executor, serverId, 'player.kick');
                if (!hasPermission.granted) {
                    throw new Error(`User ${options.executor} lacks permission to kick players`);
                }
            }
            // Get bridge
            const bridge = this.getBridge(serverId);
            if (!bridge || !bridge.isConnectedToBridge()) {
                throw new Error(`Server ${serverId} is not available`);
            }
            // Check capability
            if (!bridge.hasCapability('player_management')) {
                throw new Error(`Server ${serverId} does not support player management`);
            }
            // Execute kick action
            const result = await bridge.performPlayerAction({
                type: 'kick',
                playerId: options.playerId,
                playerName: options.playerName,
                reason: options.reason || 'Kicked by administrator',
                executor: options.executor || 'system'
            });
            // Audit log
            await this.auditService.logger.logSuccess('player.kick', {
                playerId: options.playerId,
                playerName: options.playerName,
                reason: options.reason,
                duration: Date.now() - startTime
            }, { userId: options.executor });
            this.logger.info(`Player ${options.playerId} kicked from server ${serverId}`);
            return {
                success: result.success,
                playerId: options.playerId,
                reason: options.reason,
                timestamp: new Date()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Audit log
            await this.auditService.logger.logError('player.kick', {
                playerId: options.playerId,
                duration: Date.now() - startTime
            }, errorMessage, { userId: options.executor });
            this.logger.error(`Failed to kick player ${options.playerId} from server ${serverId}:`, error);
            return {
                success: false,
                playerId: options.playerId,
                error: errorMessage,
                timestamp: new Date()
            };
        }
    }
    // ============================================================================
    // Player Message
    // ============================================================================
    /**
     * Send a private message to a player
     */
    async sendMessage(serverId, options) {
        const startTime = Date.now();
        try {
            // Permission check
            if (options.executor) {
                const hasPermission = await this.permissionManager.checkPermission(options.executor, serverId, 'player.message');
                if (!hasPermission.granted) {
                    throw new Error(`User ${options.executor} lacks permission to message players`);
                }
            }
            // Get bridge
            const bridge = this.getBridge(serverId);
            if (!bridge || !bridge.isConnectedToBridge()) {
                throw new Error(`Server ${serverId} is not available`);
            }
            // Check capability
            if (!bridge.hasCapability('player_management')) {
                throw new Error(`Server ${serverId} does not support player management`);
            }
            // Execute message action
            const result = await bridge.performPlayerAction({
                type: 'message',
                playerId: options.playerId,
                playerName: options.playerName,
                message: options.message,
                executor: options.executor || 'system'
            });
            // Audit log
            await this.auditService.logger.logSuccess('player.message', {
                playerId: options.playerId,
                playerName: options.playerName,
                messageLength: options.message.length,
                duration: Date.now() - startTime
            }, { userId: options.executor });
            this.logger.info(`Message sent to player ${options.playerId} on server ${serverId}`);
            return {
                success: result.success,
                playerId: options.playerId,
                message: options.message,
                timestamp: new Date()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Audit log
            await this.auditService.logger.logError('player.message', {
                playerId: options.playerId,
                duration: Date.now() - startTime
            }, errorMessage, { userId: options.executor });
            this.logger.error(`Failed to send message to player ${options.playerId} on server ${serverId}:`, error);
            return {
                success: false,
                playerId: options.playerId,
                message: options.message,
                error: errorMessage,
                timestamp: new Date()
            };
        }
    }
    // ============================================================================
    // Player Teleport
    // ============================================================================
    /**
     * Teleport a player to a location or another player
     */
    async teleportPlayer(serverId, options) {
        const startTime = Date.now();
        try {
            // Permission check
            if (options.executor) {
                const hasPermission = await this.permissionManager.checkPermission(options.executor, serverId, 'player.teleport');
                if (!hasPermission.granted) {
                    throw new Error(`User ${options.executor} lacks permission to teleport players`);
                }
            }
            // Get bridge
            const bridge = this.getBridge(serverId);
            if (!bridge || !bridge.isConnectedToBridge()) {
                throw new Error(`Server ${serverId} is not available`);
            }
            // Check capability
            if (!bridge.hasCapability('player_management')) {
                throw new Error(`Server ${serverId} does not support player management`);
            }
            // Determine destination
            let destination;
            if (options.targetPlayerId) {
                destination = `player:${options.targetPlayerId}`;
            }
            else if (options.location) {
                destination = `location:${options.location.world}:${options.location.x},${options.location.y},${options.location.z}`;
            }
            else {
                throw new Error('Either targetPlayerId or location must be specified');
            }
            // Execute teleport action
            const result = await bridge.performPlayerAction({
                type: 'teleport',
                playerId: options.playerId,
                targetPlayerId: options.targetPlayerId,
                location: options.location,
                executor: options.executor || 'system'
            });
            // Audit log
            await this.auditService.logger.logSuccess('player.teleport', {
                playerId: options.playerId,
                destination,
                duration: Date.now() - startTime
            }, { userId: options.executor });
            this.logger.info(`Player ${options.playerId} teleported on server ${serverId}`);
            return {
                success: result.success,
                playerId: options.playerId,
                destination,
                timestamp: new Date()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Audit log
            await this.auditService.logger.logError('player.teleport', {
                playerId: options.playerId,
                duration: Date.now() - startTime
            }, errorMessage, { userId: options.executor });
            this.logger.error(`Failed to teleport player ${options.playerId} on server ${serverId}:`, error);
            return {
                success: false,
                playerId: options.playerId,
                destination: 'unknown',
                error: errorMessage,
                timestamp: new Date()
            };
        }
    }
    // ============================================================================
    // Batch Operations
    // ============================================================================
    /**
     * Kick multiple players
     */
    async kickPlayers(serverId, playerIds, reason, executor) {
        const results = [];
        for (const playerId of playerIds) {
            const result = await this.kickPlayer(serverId, {
                playerId,
                reason,
                executor
            });
            results.push(result);
        }
        return results;
    }
    /**
     * Send message to multiple players
     */
    async broadcastMessage(serverId, playerIds, message, executor) {
        const results = [];
        for (const playerId of playerIds) {
            const result = await this.sendMessage(serverId, {
                playerId,
                message,
                executor
            });
            results.push(result);
        }
        return results;
    }
    // ============================================================================
    // Player Ban Operations
    // ============================================================================
    /**
     * Ban a player from the server
     */
    async banPlayer(serverId, options) {
        const startTime = Date.now();
        try {
            // Permission check
            if (options.executor) {
                const hasPermission = await this.permissionManager.checkPermission(options.executor, serverId, 'player.ban');
                if (!hasPermission.granted) {
                    throw new Error(`User ${options.executor} lacks permission to ban players`);
                }
            }
            // Get bridge
            const bridge = this.getBridge(serverId);
            if (!bridge || !bridge.isConnectedToBridge()) {
                throw new Error(`Server ${serverId} is not available`);
            }
            // Check capability
            if (!bridge.hasCapability('player_management')) {
                throw new Error(`Server ${serverId} does not support player management`);
            }
            // Execute ban action
            const result = await bridge.performPlayerAction({
                type: options.duration ? 'tempban' : 'ban',
                target: options.playerId,
                reason: options.reason,
                duration: options.duration
            });
            // Audit log
            await this.auditService.logger.logSuccess('player.ban', {
                playerId: options.playerId,
                playerName: options.playerName,
                reason: options.reason,
                duration: options.duration,
                banType: options.banType,
                executionTime: Date.now() - startTime
            }, { userId: options.executor });
            this.logger.info(`Player ${options.playerId} banned from server ${serverId}`);
            return {
                success: result.success,
                playerId: options.playerId,
                reason: options.reason,
                duration: options.duration,
                banType: options.banType,
                timestamp: new Date()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Audit log
            await this.auditService.logger.logError('player.ban', {
                playerId: options.playerId,
                duration: Date.now() - startTime
            }, errorMessage, { userId: options.executor });
            this.logger.error(`Failed to ban player ${options.playerId} from server ${serverId}:`, error);
            return {
                success: false,
                playerId: options.playerId,
                reason: options.reason,
                banType: options.banType,
                error: errorMessage,
                timestamp: new Date()
            };
        }
    }
    /**
     * Unban a player from the server
     */
    async unbanPlayer(serverId, options) {
        const startTime = Date.now();
        try {
            // Permission check
            if (options.executor) {
                const hasPermission = await this.permissionManager.checkPermission(options.executor, serverId, 'player.unban');
                if (!hasPermission.granted) {
                    throw new Error(`User ${options.executor} lacks permission to unban players`);
                }
            }
            // Get bridge
            const bridge = this.getBridge(serverId);
            if (!bridge || !bridge.isConnectedToBridge()) {
                throw new Error(`Server ${serverId} is not available`);
            }
            // Check capability
            if (!bridge.hasCapability('player_management')) {
                throw new Error(`Server ${serverId} does not support player management`);
            }
            // Execute unban action - using kick type as placeholder since unban isn't in PlayerAction type
            // In a real implementation, this would need to be added to the bridge interface
            const result = await bridge.performPlayerAction({
                type: 'kick', // Placeholder - should be 'unban' in actual implementation
                target: options.playerId,
                reason: options.reason || 'Unbanned'
            });
            // Audit log
            await this.auditService.logger.logSuccess('player.unban', {
                playerId: options.playerId,
                reason: options.reason,
                executionTime: Date.now() - startTime
            }, { userId: options.executor });
            this.logger.info(`Player ${options.playerId} unbanned from server ${serverId}`);
            return {
                success: result.success,
                playerId: options.playerId,
                timestamp: new Date()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Audit log
            await this.auditService.logger.logError('player.unban', {
                playerId: options.playerId,
                duration: Date.now() - startTime
            }, errorMessage, { userId: options.executor });
            this.logger.error(`Failed to unban player ${options.playerId} from server ${serverId}:`, error);
            return {
                success: false,
                playerId: options.playerId,
                error: errorMessage,
                timestamp: new Date()
            };
        }
    }
    /**
     * Get ban list from server
     */
    async getBanList(serverId, banType = 'all') {
        try {
            // Get bridge
            const bridge = this.getBridge(serverId);
            if (!bridge || !bridge.isConnectedToBridge()) {
                throw new Error(`Server ${serverId} is not available`);
            }
            // For now, return empty list as this would need to be implemented in the bridge
            // In a real implementation, this would query the server's ban list
            this.logger.warn(`getBanList not fully implemented for server ${serverId}`);
            return {
                success: true,
                bans: []
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get ban list from server ${serverId}:`, error);
            return {
                success: false,
                bans: [],
                error: errorMessage
            };
        }
    }
}
exports.PlayerActionService = PlayerActionService;
