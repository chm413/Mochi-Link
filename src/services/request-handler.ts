/**
 * WebSocket Request Handler
 * 
 * Routes incoming U-WBP v2 requests to appropriate service handlers
 * according to the protocol specification.
 */

import { Context } from 'koishi';
import { 
  UWBPRequest, 
  UWBPResponse,
  Connection 
} from '../types';
import { MessageFactory } from '../protocol/messages';
import { SubscriptionHandler } from './subscription-handler';
import { EventService } from './event';
import { ServerManager } from './server';
import { PlayerInformationService } from './player';
import { PlayerActionService } from './player-action';
import { ServerControlService } from './server-control';
import { WhitelistManager } from './whitelist';
import { CommandExecutionService } from './command';

// ============================================================================
// Request Handler
// ============================================================================

export class RequestHandler {
  private logger: any;
  private subscriptionHandler: SubscriptionHandler;

  constructor(
    private ctx: Context,
    private services: {
      event: EventService;
      server: ServerManager;
      player: PlayerInformationService;
      playerAction: PlayerActionService;
      serverControl: ServerControlService;
      whitelist: WhitelistManager;
      command: CommandExecutionService;
    }
  ) {
    this.logger = ctx.logger('mochi-link:request-handler');
    this.subscriptionHandler = new SubscriptionHandler(ctx, services.event);
  }

  /**
   * Handle incoming request
   */
  async handleRequest(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    this.logger.debug(`Handling request: ${request.op} from ${connection.serverId}`);

    try {
      // Route request based on operation
      const response = await this.routeRequest(request, connection);
      
      this.logger.debug(`Request handled successfully: ${request.op}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to handle request ${request.op}:`, error);

      // Return error response
      return MessageFactory.createError(
        request.id,
        request.op,
        error instanceof Error ? error.message : 'Request processing failed',
        'REQUEST_FAILED',
        { error: String(error) }
      );
    }
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const [category, action] = request.op.split('.');

    switch (category) {
      // Event subscription operations
      case 'event':
        return this.handleEventOperation(action, request, connection);

      // Server management operations
      case 'server':
        return this.handleServerOperation(action, request, connection);

      // Player management operations
      case 'player':
        return this.handlePlayerOperation(action, request, connection);

      // Whitelist operations
      case 'whitelist':
        return this.handleWhitelistOperation(action, request, connection);

      // Command operations
      case 'command':
        return this.handleCommandOperation(action, request, connection);

      // System operations
      case 'system':
        return this.handleSystemOperation(action, request, connection);

      default:
        throw new Error(`Unknown operation category: ${category}`);
    }
  }

  /**
   * Handle event operations
   */
  private async handleEventOperation(
    action: string,
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    switch (action) {
      case 'subscribe':
        return this.subscriptionHandler.handleSubscribe(request, connection);

      case 'unsubscribe':
        return this.subscriptionHandler.handleUnsubscribe(request, connection);

      case 'list':
        return this.subscriptionHandler.handleListSubscriptions(request, connection);

      default:
        throw new Error(`Unknown event operation: ${action}`);
    }
  }

  /**
   * Handle server operations
   */
  private async handleServerOperation(
    action: string,
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    switch (action) {
      case 'getInfo':
      case 'get_info':
        return this.handleServerGetInfo(request, connection);

      case 'getStatus':
      case 'get_status':
        return this.handleServerGetStatus(request, connection);

      case 'getMetrics':
      case 'get_metrics':
        return this.handleServerGetMetrics(request, connection);

      case 'save':
        return this.handleServerSave(request, connection);

      case 'restart':
        return this.handleServerRestart(request, connection);

      case 'shutdown':
        return this.handleServerShutdown(request, connection);

      default:
        throw new Error(`Unknown server operation: ${action}`);
    }
  }

  /**
   * Handle player operations
   */
  private async handlePlayerOperation(
    action: string,
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    switch (action) {
      case 'list':
        return this.handlePlayerList(request, connection);

      case 'getInfo':
      case 'get_info':
        return this.handlePlayerGetInfo(request, connection);

      case 'kick':
        return this.handlePlayerKick(request, connection);

      case 'message':
        return this.handlePlayerMessage(request, connection);

      default:
        throw new Error(`Unknown player operation: ${action}`);
    }
  }

  /**
   * Handle whitelist operations
   */
  private async handleWhitelistOperation(
    action: string,
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    switch (action) {
      case 'get':
        return this.handleWhitelistGet(request, connection);

      case 'add':
        return this.handleWhitelistAdd(request, connection);

      case 'remove':
        return this.handleWhitelistRemove(request, connection);

      default:
        throw new Error(`Unknown whitelist operation: ${action}`);
    }
  }

  /**
   * Handle command operations
   */
  private async handleCommandOperation(
    action: string,
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    switch (action) {
      case 'execute':
        return this.handleCommandExecute(request, connection);

      default:
        throw new Error(`Unknown command operation: ${action}`);
    }
  }

  /**
   * Handle system operations
   */
  private async handleSystemOperation(
    action: string,
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    switch (action) {
      case 'ping':
        return this.handleSystemPing(request, connection);

      default:
        throw new Error(`Unknown system operation: ${action}`);
    }
  }

  // ============================================================================
  // Server Operation Handlers
  // ============================================================================

  private async handleServerGetInfo(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    // TODO: Implement getServerInfo - should query from connector
    const server = await this.services.server.getServer(connection.serverId);
    if (!server) {
      return MessageFactory.createError(
        request.id,
        request.op,
        'Server not found',
        'SERVER_NOT_FOUND'
      );
    }
    
    return MessageFactory.createResponse(request.id, request.op, { 
      info: {
        id: server.id,
        name: server.name,
        coreType: server.coreType,
        coreName: server.coreName,
        coreVersion: server.coreVersion || 'unknown',
        status: server.status
      }
    }, {
      success: true,
      serverId: connection.serverId
    });
  }

  private async handleServerGetStatus(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    // TODO: Implement getServerStatus - should query from connector
    const server = await this.services.server.getServer(connection.serverId);
    if (!server) {
      return MessageFactory.createError(
        request.id,
        request.op,
        'Server not found',
        'SERVER_NOT_FOUND'
      );
    }
    
    return MessageFactory.createResponse(request.id, request.op, {
      status: server.status,
      online: server.status === 'online'
    }, {
      success: true,
      serverId: connection.serverId
    });
  }

  private async handleServerGetMetrics(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    // TODO: Implement getServerMetrics - should query from connector
    return MessageFactory.createResponse(request.id, request.op, { 
      metrics: {
        tps: 20.0,
        cpuUsage: 0,
        memoryUsage: 0,
        memoryMax: 0
      }
    }, {
      success: true,
      serverId: connection.serverId
    });
  }

  private async handleServerSave(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { worlds } = request.data;
    
    const result = await this.services.serverControl.saveServer(
      connection.serverId,
      {
        worlds: worlds || [],
        executor: 'system'
      }
    );
    
    return MessageFactory.createResponse(request.id, request.op, {
      success: result.success,
      worlds: result.worlds,
      duration: result.duration,
      message: result.success ? 'World saved successfully' : 'Failed to save world'
    }, {
      success: result.success,
      error: result.error,
      serverId: connection.serverId
    });
  }

  private async handleServerRestart(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { delay, message } = request.data;
    
    const result = await this.services.serverControl.restartServer(
      connection.serverId,
      {
        delay: delay || 0,
        message: message || 'Server restarting',
        executor: 'system'
      }
    );
    
    return MessageFactory.createResponse(request.id, request.op, {
      success: result.success,
      delay: result.delay,
      message: result.success ? 'Server restart initiated' : 'Failed to restart server'
    }, {
      success: result.success,
      error: result.error,
      serverId: connection.serverId
    });
  }

  private async handleServerShutdown(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { delay, message } = request.data;
    
    const result = await this.services.serverControl.shutdownServer(
      connection.serverId,
      {
        delay: delay || 0,
        message: message || 'Server shutting down',
        executor: 'system'
      }
    );
    
    return MessageFactory.createResponse(request.id, request.op, {
      success: result.success,
      delay: result.delay,
      message: result.success ? 'Server shutdown initiated' : 'Failed to shutdown server'
    }, {
      success: result.success,
      error: result.error,
      serverId: connection.serverId
    });
  }

  // ============================================================================
  // Player Operation Handlers
  // ============================================================================

  private async handlePlayerList(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const players = await this.services.player.getOnlinePlayers(connection.serverId);
    return MessageFactory.createResponse(request.id, request.op, {
      players,
      online: players.length,
      max: 20 // This should come from server config
    }, {
      success: true,
      serverId: connection.serverId
    });
  }

  private async handlePlayerGetInfo(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { playerId } = request.data;
    if (!playerId) {
      throw new Error('playerId is required');
    }

    const player = await this.services.player.getPlayerInfo(
      connection.serverId,
      playerId
    );
    return MessageFactory.createResponse(request.id, request.op, { player }, {
      success: true,
      serverId: connection.serverId
    });
  }

  private async handlePlayerKick(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { playerId, playerName, reason } = request.data;
    if (!playerId) {
      throw new Error('playerId is required');
    }

    const result = await this.services.playerAction.kickPlayer(
      connection.serverId,
      {
        playerId,
        playerName,
        reason: reason || 'Kicked by administrator',
        executor: 'system'
      }
    );
    
    return MessageFactory.createResponse(request.id, request.op, {
      success: result.success,
      playerId: result.playerId,
      reason: result.reason,
      message: result.success ? 'Player kicked successfully' : 'Failed to kick player'
    }, {
      success: result.success,
      error: result.error,
      serverId: connection.serverId
    });
  }

  private async handlePlayerMessage(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { playerId, playerName, message } = request.data;
    if (!playerId || !message) {
      throw new Error('playerId and message are required');
    }

    const result = await this.services.playerAction.sendMessage(
      connection.serverId,
      {
        playerId,
        playerName,
        message,
        executor: 'system'
      }
    );
    
    return MessageFactory.createResponse(request.id, request.op, {
      success: result.success,
      playerId: result.playerId,
      message: result.success ? 'Message sent successfully' : 'Failed to send message'
    }, {
      success: result.success,
      error: result.error,
      serverId: connection.serverId
    });
  }

  // ============================================================================
  // Whitelist Operation Handlers
  // ============================================================================

  private async handleWhitelistGet(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const whitelist = await this.services.whitelist.getWhitelist(connection.serverId);
    return MessageFactory.createResponse(request.id, request.op, {
      enabled: true, // This should come from server config
      players: whitelist.map(p => p.playerId || p.playerName)
    }, {
      success: true,
      serverId: connection.serverId
    });
  }

  private async handleWhitelistAdd(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { playerId, playerName } = request.data;
    if (!playerId) {
      throw new Error('playerId is required');
    }

    await this.services.whitelist.addToWhitelist(
      connection.serverId,
      playerId,
      playerName || playerId,
      'system'
    );
    return MessageFactory.createResponse(request.id, request.op, {
      message: `Player ${playerName || playerId} added to whitelist`
    }, {
      success: true,
      serverId: connection.serverId
    });
  }

  private async handleWhitelistRemove(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { playerId } = request.data;
    if (!playerId) {
      throw new Error('playerId is required');
    }

    await this.services.whitelist.removeFromWhitelist(
      connection.serverId,
      playerId,
      'system'
    );
    return MessageFactory.createResponse(request.id, request.op, {
      message: `Player ${playerId} removed from whitelist`
    }, {
      success: true,
      serverId: connection.serverId
    });
  }

  // ============================================================================
  // Command Operation Handlers
  // ============================================================================

  private async handleCommandExecute(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    const { command, timeout } = request.data;
    if (!command) {
      throw new Error('command is required');
    }

    const result = await this.services.command.executeCommand(
      connection.serverId,
      command,
      'system',
      { timeout: timeout || 5000 }
    );

    return MessageFactory.createResponse(request.id, request.op, {
      result
    }, {
      success: result.success,
      error: result.error,
      serverId: connection.serverId
    });
  }

  // ============================================================================
  // System Operation Handlers
  // ============================================================================

  private async handleSystemPing(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    return MessageFactory.createResponse(request.id, 'system.pong', {
      latency: Date.now() - (request.timestamp ? new Date(request.timestamp).getTime() : Date.now())
    }, {
      success: true,
      serverId: connection.serverId
    });
  }
}
