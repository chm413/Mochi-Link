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

// ============================================================================
// Player Action Types
// ============================================================================

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

// ============================================================================
// Player Action Service
// ============================================================================

export class PlayerActionService {
  private logger: any;

  constructor(
    private ctx: Context,
    private getBridge: (serverId: string) => BaseConnectorBridge | null,
    private auditService: AuditService,
    private permissionManager: PermissionManager
  ) {
    this.logger = ctx.logger('mochi-link:player-action');
  }

  // ============================================================================
  // Player Kick
  // ============================================================================

  /**
   * Kick a player from the server
   */
  async kickPlayer(
    serverId: string,
    options: PlayerKickOptions
  ): Promise<PlayerKickResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          options.executor,
          serverId,
          'player.kick'
        );
        
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
      await this.auditService.logger.logSuccess(
        'player.kick',
        {
          playerId: options.playerId,
          playerName: options.playerName,
          reason: options.reason,
          duration: Date.now() - startTime
        },
        { userId: options.executor }
      );

      this.logger.info(`Player ${options.playerId} kicked from server ${serverId}`);

      return {
        success: result.success,
        playerId: options.playerId,
        reason: options.reason,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Audit log
      await this.auditService.logger.logError(
        'player.kick',
        {
          playerId: options.playerId,
          duration: Date.now() - startTime
        },
        errorMessage,
        { userId: options.executor }
      );

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
  async sendMessage(
    serverId: string,
    options: PlayerMessageOptions
  ): Promise<PlayerMessageResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          options.executor,
          serverId,
          'player.message'
        );
        
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
      await this.auditService.logger.logSuccess(
        'player.message',
        {
          playerId: options.playerId,
          playerName: options.playerName,
          messageLength: options.message.length,
          duration: Date.now() - startTime
        },
        { userId: options.executor }
      );

      this.logger.info(`Message sent to player ${options.playerId} on server ${serverId}`);

      return {
        success: result.success,
        playerId: options.playerId,
        message: options.message,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Audit log
      await this.auditService.logger.logError(
        'player.message',
        {
          playerId: options.playerId,
          duration: Date.now() - startTime
        },
        errorMessage,
        { userId: options.executor }
      );

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
  async teleportPlayer(
    serverId: string,
    options: PlayerTeleportOptions
  ): Promise<PlayerTeleportResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          options.executor,
          serverId,
          'player.teleport'
        );
        
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
      let destination: string;
      if (options.targetPlayerId) {
        destination = `player:${options.targetPlayerId}`;
      } else if (options.location) {
        destination = `location:${options.location.world}:${options.location.x},${options.location.y},${options.location.z}`;
      } else {
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
      await this.auditService.logger.logSuccess(
        'player.teleport',
        {
          playerId: options.playerId,
          destination,
          duration: Date.now() - startTime
        },
        { userId: options.executor }
      );

      this.logger.info(`Player ${options.playerId} teleported on server ${serverId}`);

      return {
        success: result.success,
        playerId: options.playerId,
        destination,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Audit log
      await this.auditService.logger.logError(
        'player.teleport',
        {
          playerId: options.playerId,
          duration: Date.now() - startTime
        },
        errorMessage,
        { userId: options.executor }
      );

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
  async kickPlayers(
    serverId: string,
    playerIds: string[],
    reason?: string,
    executor?: string
  ): Promise<PlayerKickResult[]> {
    const results: PlayerKickResult[] = [];
    
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
  async broadcastMessage(
    serverId: string,
    playerIds: string[],
    message: string,
    executor?: string
  ): Promise<PlayerMessageResult[]> {
    const results: PlayerMessageResult[] = [];
    
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
}
