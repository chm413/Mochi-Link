"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LSEBridge = void 0;
/**
 * LSE Bridge - Lightweight HTTP API Bridge
 *
 * This class runs inside the LLBDS process and provides a minimal HTTP API
 * for communication with the external Node.js service. It's designed to have
 * minimal performance impact on the Minecraft server.
 *
 * @author chm413
 * @version 1.0.0
 */
class LSEBridge {
    constructor(port, config) {
        this.server = null;
        this._isRunning = false;
        // Event callbacks
        this.eventCallbacks = new Map();
        this.httpPort = port;
        this.config = config;
    }
    /**
     * Start the LSE bridge HTTP server
     */
    async start() {
        try {
            // Use LLBDS's built-in HTTP server if available, otherwise create minimal server
            if (typeof HttpServer !== 'undefined') {
                // Use LLBDS HttpServer
                this.server = new HttpServer();
                this.setupLLBDSRoutes();
                this.server.listen(this.httpPort);
            }
            else {
                // Fallback to Node.js http module (if available in LSE environment)
                this.setupFallbackServer();
            }
            this._isRunning = true;
            logger.info(`LSE Bridge started on port ${this.httpPort}`);
            logger.info(`LSE 桥接器已在端�?${this.httpPort} 启动`);
        }
        catch (error) {
            logger.error('Failed to start LSE Bridge:', error);
            throw error;
        }
    }
    /**
     * Setup routes for LLBDS HttpServer
     */
    setupLLBDSRoutes() {
        if (!this.server)
            return;
        // Health check
        this.server.onGet('/health', (_req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                service: 'lse-bridge',
                version: '1.0.0',
                timestamp: Date.now()
            }));
        });
        // Server status
        this.server.onGet('/api/server/status', (_req, res) => {
            const status = this.getServerStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: status }));
        });
        // Player list
        this.server.onGet('/api/players', (_req, res) => {
            const players = this.getPlayerList();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: players }));
        });
        // Command execution
        this.server.onPost('/api/commands/execute', (req, res) => {
            try {
                const body = JSON.parse(req.body || '{}');
                const result = this.executeCommand(body.command);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    result: result,
                    timestamp: Date.now()
                }));
            }
            catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }));
            }
        });
        // Event forwarding endpoint
        this.server.onPost('/api/events/forward', (req, res) => {
            try {
                const event = JSON.parse(req.body || '{}');
                this.forwardEventToExternal(event);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            }
            catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }));
            }
        });
    }
    /**
     * Setup fallback HTTP server (if LLBDS HttpServer not available)
     */
    setupFallbackServer() {
        // Minimal HTTP server implementation using LLBDS network capabilities
        // This is a simplified version that works within LSE constraints
        logger.warn('LLBDS HttpServer not available, using fallback implementation');
        logger.warn('LLBDS HttpServer 不可用，使用备用实现');
        // Create a simple request handler using LLBDS network events
        this.setupNetworkEventHandlers();
    }
    /**
     * Setup network event handlers for fallback communication
     */
    setupNetworkEventHandlers() {
        // Use LLBDS event system for communication if HTTP server not available
        // This is a workaround for environments where HTTP server is not accessible
        try {
            // Listen for network events from external service
            if (typeof mc !== 'undefined' && mc.listen) {
                mc.listen('onServerCmd', (cmd) => {
                    if (cmd.startsWith('mochilink:')) {
                        this.handleNetworkCommand(cmd.substring(10));
                    }
                });
            }
            this._isRunning = true;
            logger.info('LSE Bridge fallback communication initialized');
            logger.info('LSE 桥接器备用通信已初始化');
        }
        catch (error) {
            logger.error('Failed to setup fallback communication:', error);
            throw error;
        }
    }
    /**
     * Handle network commands (fallback method)
     */
    handleNetworkCommand(command) {
        try {
            const parts = command.split(':');
            const action = parts[0];
            const data = parts.slice(1).join(':');
            switch (action) {
                case 'status':
                    this.sendNetworkResponse('status', this.getServerStatus());
                    break;
                case 'players':
                    this.sendNetworkResponse('players', this.getPlayerList());
                    break;
                case 'execute':
                    const result = this.executeCommand(data);
                    this.sendNetworkResponse('execute', result);
                    break;
                default:
                    logger.warn('Unknown network command:', action);
            }
        }
        catch (error) {
            logger.error('Failed to handle network command:', error);
        }
    }
    /**
     * Send network response (fallback method)
     */
    sendNetworkResponse(type, data) {
        try {
            // Use LLBDS logging or file system to communicate back
            const response = {
                type,
                data,
                timestamp: Date.now()
            };
            // Write to a temporary file that external service can read
            const fs = require('fs');
            const path = `./temp/lse-response-${Date.now()}.json`;
            fs.writeFileSync(path, JSON.stringify(response));
            logger.debug(`Network response written to ${path}`);
        }
        catch (error) {
            logger.error('Failed to send network response:', error);
        }
    }
    /**
     * Get current server status
     */
    getServerStatus() {
        try {
            const runtimeMc = globalThis.mc;
            const runtimeProcess = typeof process !== 'undefined' ? process : undefined;
            const onlinePlayers = runtimeMc?.getOnlinePlayers?.()?.length || 0;
            const maxPlayers = runtimeMc?.getMaxPlayers?.() || 0;
            const uptime = runtimeProcess?.uptime?.() || 0;
            const memory = runtimeProcess?.memoryUsage?.() || {};
            const status = {
                serverId: this.config.getServerId(),
                name: this.config.getServerName(),
                coreType: 'Bedrock',
                coreName: 'LLBDS',
                status: runtimeMc ? 'online' : 'offline',
                online: Boolean(runtimeMc),
                version: runtimeMc?.getBDSVersion?.() || 'Unknown',
                maxPlayers,
                onlinePlayers,
                playerCount: onlinePlayers,
                tps: Number(runtimeMc?.getTPS?.() || 0),
                memoryUsage: {
                    used: Number(memory.heapUsed || 0),
                    max: Number(memory.heapTotal || 0),
                    free: Math.max(0, Number(memory.heapTotal || 0) - Number(memory.heapUsed || 0)),
                    percentage: memory.heapTotal ? Number(memory.heapUsed || 0) / Number(memory.heapTotal) * 100 : 0
                },
                uptime: uptime * 1000,
                worldInfo: [],
                timestamp: Date.now()
            };
            return status;
        }
        catch (error) {
            logger.error('Failed to get server status:', error);
            return {
                online: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now()
            };
        }
    }
    /**
     * Get current player list
     */
    getPlayerList() {
        try {
            const runtimeMc = globalThis.mc;
            const players = runtimeMc?.getOnlinePlayers?.() || [];
            return players.map((player) => {
                const name = String(player.name || player.realName || '');
                const position = player.pos || player.position || {};
                return {
                    id: String(player.xuid || player.uuid || name),
                    name,
                    displayName: String(player.realName || player.name || name),
                    world: String(player.level?.name || player.world?.name || 'unknown'),
                    position: {
                        x: Number(position.x || 0),
                        y: Number(position.y || 0),
                        z: Number(position.z || 0)
                    },
                    ping: Math.max(0, Number(player.avgPing || player.ping || 0)),
                    isOp: Boolean(player.isOP || player.isOp),
                    permissions: Array.isArray(player.permissions) ? player.permissions.map(String) : [],
                    edition: 'Bedrock',
                    ...(player.deviceTypeName ? { deviceType: String(player.deviceTypeName) } : {}),
                    isOnline: true
                };
            }).filter((player) => player.name && player.id);
        }
        catch (error) {
            logger.error('Failed to get player list:', error);
            return [];
        }
    }
    /**
     * Execute command on server
     */
    executeCommand(command) {
        try {
            if (!command || typeof command !== 'string') {
                throw new Error('Invalid command');
            }
            // Check command whitelist/blacklist
            if (!this.isCommandAllowed(command)) {
                throw new Error('Command not allowed');
            }
            const runtimeMc = globalThis.mc;
            let result = '';
            let success = true;
            // runcmdEx provides both the real success flag and command output.
            if (runtimeMc?.runcmdEx) {
                const cmdResult = runtimeMc.runcmdEx(command);
                result = cmdResult?.output || '';
                success = cmdResult?.success !== false;
            }
            else if (runtimeMc?.runcmd) {
                success = Boolean(runtimeMc.runcmd(command));
            }
            else {
                throw new Error('Command execution not available');
            }
            return {
                command,
                output: Array.isArray(result)
                    ? result.map(String)
                    : String(result ?? '').split(/\r?\n/).filter(Boolean),
                success,
                ...(success ? {} : { error: 'Command execution failed' }),
                timestamp: Date.now()
            };
        }
        catch (error) {
            logger.error('Failed to execute command:', error);
            return {
                command,
                output: [],
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now()
            };
        }
    }
    /**
     * Check if command is allowed
     */
    isCommandAllowed(command) {
        const whitelist = this.config.getCommandWhitelist();
        const blacklist = this.config.getCommandBlacklist();
        // Check blacklist first
        for (const blocked of blacklist) {
            if (command.toLowerCase().startsWith(blocked.toLowerCase())) {
                return false;
            }
        }
        // If whitelist is empty, allow all (except blacklisted)
        if (whitelist.length === 0) {
            return true;
        }
        // Check whitelist
        for (const allowed of whitelist) {
            if (command.toLowerCase().startsWith(allowed.toLowerCase())) {
                return true;
            }
        }
        return false;
    }
    /**
     * Forward event to external service
     */
    forwardEventToExternal(event) {
        try {
            // Send event to external service via HTTP
            this.sendToExternalService('/api/events/forward', event);
        }
        catch (error) {
            logger.error('Failed to forward event to external service:', error);
        }
    }
    /**
     * Send data to external service
     */
    sendToExternalService(endpoint, data) {
        try {
            // Use LLBDS network capabilities to send HTTP request
            if (typeof network !== 'undefined' && network.httpPost) {
                const externalPort = this.config.getExternalServicePort();
                const url = `http://localhost:${externalPort}${endpoint}`;
                network.httpPost(url, JSON.stringify(data), {
                    'Content-Type': 'application/json'
                });
            }
            else {
                // Fallback: write to file for external service to pick up
                const fs = require('fs');
                const filename = `./temp/external-${Date.now()}.json`;
                fs.writeFileSync(filename, JSON.stringify({
                    endpoint,
                    data,
                    timestamp: Date.now()
                }));
            }
        }
        catch (error) {
            logger.error('Failed to send data to external service:', error);
        }
    }
    /**
     * Register event callback
     */
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }
    /**
     * Emit event
     */
    emit(event, ...args) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                }
                catch (error) {
                    logger.error(`Error in event callback for ${event}:`, error);
                }
            });
        }
    }
    /**
     * Stop the LSE bridge
     */
    async stop() {
        try {
            this._isRunning = false;
            if (this.server && this.server.close) {
                this.server.close();
            }
            logger.info('LSE Bridge stopped');
            logger.info('LSE 桥接器已停止');
        }
        catch (error) {
            logger.error('Failed to stop LSE Bridge:', error);
        }
    }
    /**
     * Check if bridge is running
     */
    isRunning() {
        return this._isRunning;
    }
    /**
     * Get bridge port
     */
    getPort() {
        return this.httpPort;
    }
}
exports.LSEBridge = LSEBridge;
//# sourceMappingURL=LSEBridge.js.map