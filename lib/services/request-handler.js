"use strict";
/**
 * WebSocket Request Handler
 *
 * Routes incoming U-WBP v2 requests to appropriate service handlers
 * according to the protocol specification.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestHandler = void 0;
const messages_1 = require("../protocol/messages");
const subscription_handler_1 = require("./subscription-handler");
// ============================================================================
// Request Handler
// ============================================================================
class RequestHandler {
    constructor(ctx, services) {
        this.ctx = ctx;
        this.services = services;
        this.logger = ctx.logger('mochi-link:request-handler');
        this.subscriptionHandler = new subscription_handler_1.SubscriptionHandler(ctx, services.event);
    }
    /**
     * Handle incoming request
     */
    async handleRequest(request, connection) {
        this.logger.debug(`Handling request: ${request.op} from ${connection.serverId}`);
        try {
            // Route request based on operation
            const response = await this.routeRequest(request, connection);
            this.logger.debug(`Request handled successfully: ${request.op}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to handle request ${request.op}:`, error);
            // Return error response
            return messages_1.MessageFactory.createError(request.id, request.op, error instanceof Error ? error.message : 'Request processing failed', 'REQUEST_FAILED', { error: String(error) });
        }
    }
    /**
     * Route request to appropriate handler
     */
    async routeRequest(request, connection) {
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
    async handleEventOperation(action, request, connection) {
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
    async handleServerOperation(action, request, connection) {
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
    async handlePlayerOperation(action, request, connection) {
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
    async handleWhitelistOperation(action, request, connection) {
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
    async handleCommandOperation(action, request, connection) {
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
    async handleSystemOperation(action, request, connection) {
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
    async handleServerGetInfo(request, connection) {
        // TODO: Implement getServerInfo - should query from connector
        const server = await this.services.server.getServer(connection.serverId);
        if (!server) {
            return messages_1.MessageFactory.createError(request.id, request.op, 'Server not found', 'SERVER_NOT_FOUND');
        }
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
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
    async handleServerGetStatus(request, connection) {
        // TODO: Implement getServerStatus - should query from connector
        const server = await this.services.server.getServer(connection.serverId);
        if (!server) {
            return messages_1.MessageFactory.createError(request.id, request.op, 'Server not found', 'SERVER_NOT_FOUND');
        }
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            status: server.status,
            online: server.status === 'online'
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    async handleServerGetMetrics(request, connection) {
        // TODO: Implement getServerMetrics - should query from connector
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
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
    async handleServerSave(request, connection) {
        await this.services.command.executeCommand(connection.serverId, 'save-all', 'system');
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            message: 'World saved successfully'
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    async handleServerRestart(request, connection) {
        // This would need to be implemented based on server management capabilities
        throw new Error('Server restart not implemented');
    }
    async handleServerShutdown(request, connection) {
        // This would need to be implemented based on server management capabilities
        throw new Error('Server shutdown not implemented');
    }
    // ============================================================================
    // Player Operation Handlers
    // ============================================================================
    async handlePlayerList(request, connection) {
        const players = await this.services.player.getOnlinePlayers(connection.serverId);
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            players,
            online: players.length,
            max: 20 // This should come from server config
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    async handlePlayerGetInfo(request, connection) {
        const { playerId } = request.data;
        if (!playerId) {
            throw new Error('playerId is required');
        }
        const player = await this.services.player.getPlayerInfo(connection.serverId, playerId);
        return messages_1.MessageFactory.createResponse(request.id, request.op, { player }, {
            success: true,
            serverId: connection.serverId
        });
    }
    async handlePlayerKick(request, connection) {
        const { playerId, reason } = request.data;
        if (!playerId) {
            throw new Error('playerId is required');
        }
        // TODO: Implement kickPlayer in PlayerInformationService
        // await this.services.player.kickPlayer(
        //   connection.serverId,
        //   playerId,
        //   reason || 'Kicked by administrator'
        // );
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            message: `Player ${playerId} kick requested (not implemented)`
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    async handlePlayerMessage(request, connection) {
        const { playerId, message } = request.data;
        if (!playerId || !message) {
            throw new Error('playerId and message are required');
        }
        // TODO: Implement sendMessage in PlayerInformationService
        // await this.services.player.sendMessage(
        //   connection.serverId,
        //   playerId,
        //   message
        // );
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            message: 'Message sent successfully (not implemented)'
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    // ============================================================================
    // Whitelist Operation Handlers
    // ============================================================================
    async handleWhitelistGet(request, connection) {
        const whitelist = await this.services.whitelist.getWhitelist(connection.serverId);
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            enabled: true, // This should come from server config
            players: whitelist.map(p => p.playerId || p.playerName)
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    async handleWhitelistAdd(request, connection) {
        const { playerId, playerName } = request.data;
        if (!playerId) {
            throw new Error('playerId is required');
        }
        await this.services.whitelist.addToWhitelist(connection.serverId, playerId, playerName || playerId, 'system');
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            message: `Player ${playerName || playerId} added to whitelist`
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    async handleWhitelistRemove(request, connection) {
        const { playerId } = request.data;
        if (!playerId) {
            throw new Error('playerId is required');
        }
        await this.services.whitelist.removeFromWhitelist(connection.serverId, playerId, 'system');
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
            message: `Player ${playerId} removed from whitelist`
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
    // ============================================================================
    // Command Operation Handlers
    // ============================================================================
    async handleCommandExecute(request, connection) {
        const { command, timeout } = request.data;
        if (!command) {
            throw new Error('command is required');
        }
        const result = await this.services.command.executeCommand(connection.serverId, command, 'system', { timeout: timeout || 5000 });
        return messages_1.MessageFactory.createResponse(request.id, request.op, {
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
    async handleSystemPing(request, connection) {
        return messages_1.MessageFactory.createResponse(request.id, 'system.pong', {
            latency: Date.now() - (request.timestamp ? new Date(request.timestamp).getTime() : Date.now())
        }, {
            success: true,
            serverId: connection.serverId
        });
    }
}
exports.RequestHandler = RequestHandler;
