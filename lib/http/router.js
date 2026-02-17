"use strict";
/**
 * HTTP API Router Implementation
 *
 * This file implements the complete HTTP API router with all endpoint handlers
 * for the Mochi-Link system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIRouter = void 0;
class APIRouter {
    constructor(ctx, serviceManager) {
        this.ctx = ctx;
        this.serviceManager = serviceManager;
        this.routes = [];
    }
    // ============================================================================
    // Route Registration Methods
    // ============================================================================
    addRoute(method, path, handler) {
        this.routes.push({ method, path, handler });
    }
    get(path, handler) {
        this.addRoute('GET', path, handler);
    }
    post(path, handler) {
        this.addRoute('POST', path, handler);
    }
    put(path, handler) {
        this.addRoute('PUT', path, handler);
    }
    delete(path, handler) {
        this.addRoute('DELETE', path, handler);
    }
    // ============================================================================
    // Request Routing
    // ============================================================================
    async route(req) {
        try {
            // Extract path parameters
            const pathParams = this.extractPathParams(req.path);
            req.context = { ...req.context, ...pathParams };
            // Route to appropriate handler
            const handler = this.getHandler(req.method, req.path);
            if (!handler) {
                return this.createErrorResponse('NOT_FOUND', 'Endpoint not found', req.context.requestId);
            }
            return await handler(req);
        }
        catch (error) {
            this.ctx.logger('api-router').error('Request routing error:', error);
            return this.createErrorResponse('SERVER_ERROR', error instanceof Error ? error.message : 'Internal server error', req.context.requestId);
        }
    }
    getHandler(method, path) {
        // System endpoints
        if (method === 'GET' && path === '/api/health')
            return this.getSystemHealth.bind(this);
        if (method === 'GET' && path === '/api/stats')
            return this.getSystemStats.bind(this);
        // Server management endpoints
        if (method === 'GET' && path === '/api/servers')
            return this.getServers.bind(this);
        if (method === 'POST' && path === '/api/servers')
            return this.createServer.bind(this);
        if (method === 'GET' && this.matchPath('/api/servers/:serverId', path))
            return this.getServer.bind(this);
        if (method === 'PUT' && this.matchPath('/api/servers/:serverId', path))
            return this.updateServer.bind(this);
        if (method === 'DELETE' && this.matchPath('/api/servers/:serverId', path))
            return this.deleteServer.bind(this);
        // Player management endpoints
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/players', path))
            return this.getPlayers.bind(this);
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/players/:playerId', path))
            return this.getPlayer.bind(this);
        if (method === 'POST' && this.matchPath('/api/servers/:serverId/players/:playerId/kick', path))
            return this.kickPlayer.bind(this);
        // Whitelist management endpoints
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/whitelist', path))
            return this.getWhitelist.bind(this);
        if (method === 'POST' && this.matchPath('/api/servers/:serverId/whitelist', path))
            return this.addToWhitelist.bind(this);
        if (method === 'DELETE' && this.matchPath('/api/servers/:serverId/whitelist/:playerId', path))
            return this.removeFromWhitelist.bind(this);
        // Ban management endpoints
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/bans', path))
            return this.getBans.bind(this);
        if (method === 'POST' && this.matchPath('/api/servers/:serverId/bans', path))
            return this.createBan.bind(this);
        if (method === 'PUT' && this.matchPath('/api/servers/:serverId/bans/:banId', path))
            return this.updateBan.bind(this);
        if (method === 'DELETE' && this.matchPath('/api/servers/:serverId/bans/:banId', path))
            return this.deleteBan.bind(this);
        // Command execution endpoints
        if (method === 'POST' && this.matchPath('/api/servers/:serverId/commands', path))
            return this.executeCommand.bind(this);
        if (method === 'POST' && this.matchPath('/api/servers/:serverId/actions', path))
            return this.executeQuickAction.bind(this);
        // Monitoring endpoints
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/status', path))
            return this.getServerStatus.bind(this);
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/performance', path))
            return this.getPerformanceHistory.bind(this);
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/alerts', path))
            return this.getAlerts.bind(this);
        if (method === 'POST' && this.matchPath('/api/servers/:serverId/alerts/:alertId/acknowledge', path))
            return this.acknowledgeAlert.bind(this);
        // Real-time monitoring endpoints
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/metrics/current', path))
            return this.getCurrentMetrics.bind(this);
        if (method === 'GET' && this.matchPath('/api/servers/:serverId/metrics/summary', path))
            return this.getMetricsSummary.bind(this);
        // Batch operations
        if (method === 'POST' && path === '/api/batch/commands')
            return this.executeBatchCommands.bind(this);
        if (method === 'POST' && path === '/api/batch/actions')
            return this.executeBatchActions.bind(this);
        // Audit log endpoints
        if (method === 'GET' && path === '/api/audit')
            return this.getAuditLogs.bind(this);
        // Authentication endpoints
        if (method === 'POST' && path === '/api/auth/verify')
            return this.verifyToken.bind(this);
        if (method === 'POST' && path === '/api/auth/tokens')
            return this.createToken.bind(this);
        // Binding management endpoints
        if (method === 'GET' && path === '/api/bindings')
            return this.getBindings.bind(this);
        if (method === 'POST' && path === '/api/bindings')
            return this.createBinding.bind(this);
        if (method === 'GET' && this.matchPath('/api/bindings/:bindingId', path))
            return this.getBinding.bind(this);
        if (method === 'PUT' && this.matchPath('/api/bindings/:bindingId', path))
            return this.updateBinding.bind(this);
        if (method === 'DELETE' && this.matchPath('/api/bindings/:bindingId', path))
            return this.deleteBinding.bind(this);
        if (method === 'GET' && path === '/api/bindings/stats')
            return this.getBindingStats.bind(this);
        if (method === 'POST' && path === '/api/bindings/batch')
            return this.createBindingsBatch.bind(this);
        if (method === 'GET' && this.matchPath('/api/groups/:groupId/routes', path))
            return this.getGroupRoutes.bind(this);
        return null;
    }
    // ============================================================================
    // System Endpoints
    // ============================================================================
    async getSystemHealth(req) {
        try {
            const health = await this.serviceManager.systemService?.getHealth() || {
                status: 'healthy',
                uptime: process.uptime() * 1000,
                version: '1.0.0',
                services: [],
                database: { connected: true },
                connections: { active: 0, total: 0, byStatus: {} }
            };
            return this.createSuccessResponse(health, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get system health', req.context.requestId);
        }
    }
    async getSystemStats(req) {
        try {
            const stats = await this.serviceManager.systemService?.getStats() || {
                servers: { total: 0, online: 0, offline: 0, byType: {} },
                players: { total: 0, online: 0, byEdition: {} },
                operations: { pending: 0, completed24h: 0, failed24h: 0 },
                performance: { avgResponseTime: 0, requestsPerMinute: 0, errorRate: 0 }
            };
            return this.createSuccessResponse(stats, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get system stats', req.context.requestId);
        }
    }
    // ============================================================================
    // Server Management Endpoints
    // ============================================================================
    async getServers(req) {
        try {
            const page = parseInt(req.query?.page || '1') || 1;
            const limit = parseInt(req.query?.limit || '20') || 20;
            const result = await this.serviceManager.serverManager.getServers({
                page,
                limit,
                userId: req.context.userId
            });
            return this.createPaginatedResponse(result.data, result.pagination, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get servers', req.context.requestId);
        }
    }
    async createServer(req) {
        try {
            if (!req.body.name || !req.body.coreType || !req.body.connectionMode) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Missing required fields', req.context.requestId);
            }
            const result = await this.serviceManager.serverManager.createServer(req.body, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to create server', req.context.requestId);
        }
    }
    async getServer(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const server = await this.serviceManager.serverManager.getServer(serverId);
            if (!server) {
                return this.createErrorResponse('NOT_FOUND', 'Server not found', req.context.requestId);
            }
            return this.createSuccessResponse(server, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get server', req.context.requestId);
        }
    }
    async updateServer(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const result = await this.serviceManager.serverManager.updateServer(serverId, req.body, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to update server', req.context.requestId);
        }
    }
    async deleteServer(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            await this.serviceManager.serverManager.deleteServer(serverId, req.context.userId);
            return this.createSuccessResponse({ deleted: true }, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to delete server', req.context.requestId);
        }
    }
    // ============================================================================
    // Player Management Endpoints
    // ============================================================================
    async getPlayers(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const page = parseInt(req.query?.page || '1') || 1;
            const limit = parseInt(req.query?.limit || '20') || 20;
            const result = await this.serviceManager.playerManager.getPlayers(serverId, { page, limit });
            return this.createPaginatedResponse(result.data, result.pagination, req.context.requestId, result.summary);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get players', req.context.requestId);
        }
    }
    async getPlayer(req) {
        try {
            const serverId = req.context.serverId;
            const playerId = req.context.playerId;
            if (!serverId || !playerId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID and Player ID are required', req.context.requestId);
            }
            const player = await this.serviceManager.playerManager.getPlayer(serverId, playerId);
            if (!player) {
                return this.createErrorResponse('NOT_FOUND', 'Player not found', req.context.requestId);
            }
            return this.createSuccessResponse(player, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get player', req.context.requestId);
        }
    }
    async kickPlayer(req) {
        try {
            const serverId = req.context.serverId;
            const playerId = req.context.playerId;
            if (!serverId || !playerId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID and Player ID are required', req.context.requestId);
            }
            if (!req.body.reason) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Kick reason is required', req.context.requestId);
            }
            const result = await this.serviceManager.playerManager.kickPlayer(serverId, playerId, req.body.reason, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to kick player', req.context.requestId);
        }
    }
    // ============================================================================
    // Whitelist Management Endpoints
    // ============================================================================
    async getWhitelist(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const result = await this.serviceManager.whitelistManager.getWhitelist(serverId);
            return this.createSuccessResponse(result.data, req.context.requestId, result.metadata);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get whitelist', req.context.requestId);
        }
    }
    async addToWhitelist(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            if (!req.body.playerId) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Player ID is required', req.context.requestId);
            }
            const result = await this.serviceManager.whitelistManager.addToWhitelist(serverId, req.body.playerId, req.body.playerName, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to add to whitelist', req.context.requestId);
        }
    }
    async removeFromWhitelist(req) {
        try {
            const serverId = req.context.serverId;
            const playerId = req.context.playerId;
            if (!serverId || !playerId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID and Player ID are required', req.context.requestId);
            }
            const result = await this.serviceManager.whitelistManager.removeFromWhitelist(serverId, playerId, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to remove from whitelist', req.context.requestId);
        }
    }
    // ============================================================================
    // Ban Management Endpoints
    // ============================================================================
    async getBans(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const page = parseInt(req.query?.page || '1') || 1;
            const limit = parseInt(req.query?.limit || '20') || 20;
            const result = await this.serviceManager.banManager.getBans(serverId, { page, limit });
            return this.createPaginatedResponse(result.data, result.pagination, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get bans', req.context.requestId);
        }
    }
    async createBan(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            if (!req.body.type || !req.body.target || !req.body.reason) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Type, target, and reason are required', req.context.requestId);
            }
            const result = await this.serviceManager.banManager.createBan(serverId, req.body, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to create ban', req.context.requestId);
        }
    }
    async updateBan(req) {
        try {
            const serverId = req.context.serverId;
            const banId = req.context.banId;
            if (!serverId || !banId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID and Ban ID are required', req.context.requestId);
            }
            const result = await this.serviceManager.banManager.updateBan(serverId, banId, req.body, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to update ban', req.context.requestId);
        }
    }
    async deleteBan(req) {
        try {
            const serverId = req.context.serverId;
            const banId = req.context.banId;
            if (!serverId || !banId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID and Ban ID are required', req.context.requestId);
            }
            await this.serviceManager.banManager.deleteBan(serverId, banId, req.context.userId);
            return this.createSuccessResponse({ deleted: true }, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to delete ban', req.context.requestId);
        }
    }
    // ============================================================================
    // Command Execution Endpoints
    // ============================================================================
    async executeCommand(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            if (!req.body.command) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Command is required', req.context.requestId);
            }
            // Check permissions
            const permissionCheck = await this.serviceManager.permissionManager.checkPermission(req.context.userId, serverId, 'commands.execute');
            if (!permissionCheck.granted) {
                return this.createErrorResponse('PERMISSION_DENIED', 'Insufficient permissions', req.context.requestId);
            }
            const result = await this.serviceManager.commandService.executeCommand(serverId, req.body.command, req.context.userId, {
                timeout: req.body.timeout || 30000,
                requirePermission: true,
                auditLog: true
            });
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to execute command', req.context.requestId);
        }
    }
    async executeQuickAction(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            if (!req.body.action) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Action is required', req.context.requestId);
            }
            const result = await this.serviceManager.commandService.executeQuickAction(serverId, req.body, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to execute quick action', req.context.requestId);
        }
    }
    // ============================================================================
    // Monitoring Endpoints
    // ============================================================================
    async getServerStatus(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const status = await this.serviceManager.serverManager.getServerStatus(serverId);
            return this.createSuccessResponse(status, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get server status', req.context.requestId);
        }
    }
    async getPerformanceHistory(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const startTime = req.query?.startTime ? new Date(req.query.startTime) : new Date(Date.now() - 3600000);
            const endTime = req.query?.endTime ? new Date(req.query.endTime) : new Date();
            const interval = parseInt(req.query?.interval || '5') || 5;
            const result = await this.serviceManager.monitoringService.getHistoricalData(serverId, { start: startTime, end: endTime }, interval);
            return this.createSuccessResponse(result.metrics, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get performance history', req.context.requestId);
        }
    }
    async getAlerts(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const page = parseInt(req.query?.page || '1') || 1;
            const limit = parseInt(req.query?.limit || '20') || 20;
            const alerts = await this.serviceManager.monitoringService.getActiveAlerts(serverId);
            // Simple pagination for alerts
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedAlerts = alerts.slice(startIndex, endIndex);
            const pagination = {
                page,
                limit,
                total: alerts.length,
                totalPages: Math.ceil(alerts.length / limit),
                hasNext: endIndex < alerts.length,
                hasPrev: page > 1
            };
            return this.createPaginatedResponse(paginatedAlerts, pagination, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get alerts', req.context.requestId);
        }
    }
    async acknowledgeAlert(req) {
        try {
            const alertId = req.context.alertId;
            if (!alertId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Alert ID is required', req.context.requestId);
            }
            await this.serviceManager.monitoringService.acknowledgeAlert(alertId, req.context.userId);
            return this.createSuccessResponse({ acknowledged: true }, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to acknowledge alert', req.context.requestId);
        }
    }
    async getCurrentMetrics(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const status = await this.serviceManager.serverManager.getServerStatus(serverId);
            const metrics = {
                timestamp: Date.now(),
                serverId,
                tps: status.tps || 0,
                playerCount: status.playerCount || 0,
                memoryUsage: status.memoryUsage || { used: 0, max: 0, percentage: 0 },
                cpuUsage: status.cpuUsage || 0,
                ping: status.ping || 0,
                uptime: status.uptime || 0,
                status: status.status || 'unknown'
            };
            return this.createSuccessResponse(metrics, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get current metrics', req.context.requestId);
        }
    }
    async getMetricsSummary(req) {
        try {
            const serverId = req.context.serverId;
            if (!serverId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Server ID is required', req.context.requestId);
            }
            const summary = await this.serviceManager.monitoringService.getServerPerformanceSummary(serverId);
            return this.createSuccessResponse(summary, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get metrics summary', req.context.requestId);
        }
    }
    // ============================================================================
    // Batch Operations Endpoints
    // ============================================================================
    async executeBatchCommands(req) {
        try {
            if (!req.body.serverIds || !Array.isArray(req.body.serverIds) || !req.body.command) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Server IDs array and command are required', req.context.requestId);
            }
            const result = await this.serviceManager.commandService.executeBatchOperation({
                serverIds: req.body.serverIds,
                operation: 'command',
                payload: { command: req.body.command }
            }, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to execute batch commands', req.context.requestId);
        }
    }
    async executeBatchActions(req) {
        try {
            if (!req.body.serverIds || !Array.isArray(req.body.serverIds) || !req.body.action) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Server IDs array and action are required', req.context.requestId);
            }
            const result = await this.serviceManager.commandService.executeBatchOperation({
                serverIds: req.body.serverIds,
                operation: 'action',
                payload: { action: req.body.action, parameters: req.body.parameters }
            }, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to execute batch actions', req.context.requestId);
        }
    }
    // ============================================================================
    // Audit Log Endpoints
    // ============================================================================
    async getAuditLogs(req) {
        try {
            const page = parseInt(req.query?.page || '1') || 1;
            const limit = parseInt(req.query?.limit || '20') || 20;
            const filters = {
                userId: req.query?.userId,
                serverId: req.query?.serverId,
                operation: req.query?.operation,
                result: req.query?.result,
                startTime: req.query?.startTime ? new Date(req.query.startTime) : undefined,
                endTime: req.query?.endTime ? new Date(req.query.endTime) : undefined
            };
            const result = await this.serviceManager.auditService.getLogs(filters, { page, limit });
            return this.createPaginatedResponse(result.data, result.pagination, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get audit logs', req.context.requestId);
        }
    }
    // ============================================================================
    // Authentication Endpoints
    // ============================================================================
    async verifyToken(req) {
        try {
            if (!req.body.token) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Token is required', req.context.requestId);
            }
            const result = await this.serviceManager.tokenManager.verifyToken(req.body.token);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to verify token', req.context.requestId);
        }
    }
    async createToken(req) {
        try {
            if (!req.body.serverId) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Server ID is required', req.context.requestId);
            }
            const result = await this.serviceManager.tokenManager.createToken(req.body, req.context.userId);
            return this.createSuccessResponse(result, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to create token', req.context.requestId);
        }
    }
    // ============================================================================
    // Binding Management Endpoints
    // ============================================================================
    async getBindings(req) {
        try {
            const page = parseInt(req.query?.page || '1') || 1;
            const limit = parseInt(req.query?.limit || '20') || 20;
            const filters = {
                groupId: req.query?.groupId,
                serverId: req.query?.serverId,
                bindingType: req.query?.bindingType,
                status: req.query?.status,
                limit,
                offset: (page - 1) * limit
            };
            const result = await this.serviceManager.binding.queryBindings(filters);
            const pagination = {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
                hasNext: (page * limit) < result.total,
                hasPrev: page > 1
            };
            return this.createPaginatedResponse(result.bindings, pagination, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get bindings', req.context.requestId);
        }
    }
    async createBinding(req) {
        try {
            if (!req.body.groupId || !req.body.serverId || !req.body.bindingType || !req.body.config) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Group ID, Server ID, binding type, and config are required', req.context.requestId);
            }
            // Check permissions
            const permissionCheck = await this.serviceManager.permission.checkPermission(req.context.userId, req.body.serverId, 'binding.create');
            if (!permissionCheck.granted) {
                return this.createErrorResponse('PERMISSION_DENIED', 'Insufficient permissions to create bindings', req.context.requestId);
            }
            const binding = await this.serviceManager.binding.createBinding(req.context.userId, {
                groupId: req.body.groupId,
                serverId: req.body.serverId,
                bindingType: req.body.bindingType,
                config: req.body.config,
                priority: req.body.priority
            });
            return this.createSuccessResponse({ bindingId: binding.id }, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to create binding', req.context.requestId);
        }
    }
    async getBinding(req) {
        try {
            const bindingId = parseInt(req.context.bindingId || '0');
            if (!bindingId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Binding ID is required', req.context.requestId);
            }
            const binding = await this.serviceManager.binding.getBinding(bindingId);
            if (!binding) {
                return this.createErrorResponse('NOT_FOUND', 'Binding not found', req.context.requestId);
            }
            return this.createSuccessResponse(binding, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get binding', req.context.requestId);
        }
    }
    async updateBinding(req) {
        try {
            const bindingId = parseInt(req.context.bindingId || '0');
            if (!bindingId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Binding ID is required', req.context.requestId);
            }
            // Get existing binding to check permissions
            const existingBinding = await this.serviceManager.binding.getBinding(bindingId);
            if (!existingBinding) {
                return this.createErrorResponse('NOT_FOUND', 'Binding not found', req.context.requestId);
            }
            // Check permissions
            const permissionCheck = await this.serviceManager.permission.checkPermission(req.context.userId, existingBinding.serverId, 'binding.update');
            if (!permissionCheck.granted) {
                return this.createErrorResponse('PERMISSION_DENIED', 'Insufficient permissions to update bindings', req.context.requestId);
            }
            const updatedBinding = await this.serviceManager.binding.updateBinding(req.context.userId, bindingId, {
                config: req.body.config,
                bindingType: req.body.bindingType,
                priority: req.body.priority
            });
            return this.createSuccessResponse(updatedBinding, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to update binding', req.context.requestId);
        }
    }
    async deleteBinding(req) {
        try {
            const bindingId = parseInt(req.context.bindingId || '0');
            if (!bindingId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Binding ID is required', req.context.requestId);
            }
            // Get existing binding to check permissions
            const existingBinding = await this.serviceManager.binding.getBinding(bindingId);
            if (!existingBinding) {
                return this.createErrorResponse('NOT_FOUND', 'Binding not found', req.context.requestId);
            }
            // Check permissions
            const permissionCheck = await this.serviceManager.permission.checkPermission(req.context.userId, existingBinding.serverId, 'binding.delete');
            if (!permissionCheck.granted) {
                return this.createErrorResponse('PERMISSION_DENIED', 'Insufficient permissions to delete bindings', req.context.requestId);
            }
            await this.serviceManager.binding.deleteBinding(req.context.userId, bindingId);
            return this.createSuccessResponse({ deleted: true }, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to delete binding', req.context.requestId);
        }
    }
    async getBindingStats(req) {
        try {
            const stats = await this.serviceManager.binding.getBindingStats();
            return this.createSuccessResponse(stats, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get binding statistics', req.context.requestId);
        }
    }
    async createBindingsBatch(req) {
        try {
            if (!req.body.bindings || !Array.isArray(req.body.bindings)) {
                return this.createErrorResponse('VALIDATION_ERROR', 'Bindings array is required', req.context.requestId);
            }
            const results = await this.serviceManager.binding.createBindingsBatch(req.context.userId, req.body.bindings);
            const response = {
                totalRequested: req.body.bindings.length,
                successCount: results.length,
                results: results.map((binding, index) => ({
                    groupId: req.body.bindings[index].groupId,
                    serverId: req.body.bindings[index].serverId,
                    bindingType: req.body.bindings[index].bindingType,
                    success: true,
                    bindingId: binding.id
                }))
            };
            return this.createSuccessResponse(response, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to create bindings batch', req.context.requestId);
        }
    }
    async getGroupRoutes(req) {
        try {
            const groupId = req.context.groupId;
            if (!groupId) {
                return this.createErrorResponse('INVALID_REQUEST', 'Group ID is required', req.context.requestId);
            }
            const routes = await this.serviceManager.binding.getGroupRoutes(groupId);
            return this.createSuccessResponse(routes, req.context.requestId);
        }
        catch (error) {
            return this.createErrorResponse('SERVER_ERROR', 'Failed to get group routes', req.context.requestId);
        }
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    matchPath(routePath, requestPath) {
        const routeParts = routePath.split('/');
        const requestParts = requestPath.split('/');
        if (routeParts.length !== requestParts.length) {
            return false;
        }
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];
            // Parameter matching (e.g., :id)
            if (routePart.startsWith(':')) {
                continue;
            }
            if (routePart !== requestPart) {
                return false;
            }
        }
        return true;
    }
    extractPathParams(path) {
        const params = {};
        // Extract serverId
        const serverMatch = path.match(/\/api\/servers\/([^\/]+)/);
        if (serverMatch) {
            params.serverId = serverMatch[1];
        }
        // Extract playerId
        const playerMatch = path.match(/\/players\/([^\/]+)/);
        if (playerMatch) {
            params.playerId = playerMatch[1];
        }
        // Extract banId
        const banMatch = path.match(/\/bans\/([^\/]+)/);
        if (banMatch) {
            params.banId = banMatch[1];
        }
        // Extract alertId
        const alertMatch = path.match(/\/alerts\/([^\/]+)/);
        if (alertMatch) {
            params.alertId = alertMatch[1];
        }
        // Extract bindingId
        const bindingMatch = path.match(/\/api\/bindings\/([^\/]+)/);
        if (bindingMatch && bindingMatch[1] !== 'stats' && bindingMatch[1] !== 'batch') {
            params.bindingId = bindingMatch[1];
        }
        // Extract groupId
        const groupMatch = path.match(/\/api\/groups\/([^\/]+)/);
        if (groupMatch) {
            params.groupId = groupMatch[1];
        }
        return params;
    }
    createSuccessResponse(data, requestId, metadata) {
        const response = {
            success: true,
            data,
            timestamp: Date.now(),
            requestId
        };
        if (metadata) {
            Object.assign(response, metadata);
        }
        return response;
    }
    createPaginatedResponse(data, pagination, requestId, summary) {
        const response = {
            success: true,
            data,
            pagination,
            timestamp: Date.now(),
            requestId
        };
        if (summary) {
            response.summary = summary;
        }
        return response;
    }
    createErrorResponse(error, message, requestId) {
        return {
            success: false,
            error,
            message,
            timestamp: Date.now(),
            requestId
        };
    }
}
exports.APIRouter = APIRouter;
exports.default = APIRouter;
