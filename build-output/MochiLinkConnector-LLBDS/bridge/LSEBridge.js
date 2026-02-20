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
        // Command queue for external service
        this.commandQueue = [];
        this.commandResults = new Map();
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
        this.server.onGet('/health', (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                service: 'lse-bridge',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            }));
        });
        // Server status
        this.server.onGet('/api/server/status', (req, res) => {
            const status = this.getServerStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: status }));
        });
        // Player list
        this.server.onGet('/api/players', (req, res) => {
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
                    timestamp: new Date().toISOString()
                }));
            }
            catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
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
                    error: error.message
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
                timestamp: new Date().toISOString()
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
            const status = {
                online: true,
                version: mc?.getBDSVersion?.() || 'Unknown',
                players: {
                    online: mc?.getOnlinePlayers?.()?.length || 0,
                    max: mc?.getMaxPlayers?.() || 20
                },
                tps: mc?.getTPS?.() || 20.0,
                memory: {
                    used: process.memoryUsage?.()?.heapUsed || 0,
                    total: process.memoryUsage?.()?.heapTotal || 0
                },
                uptime: process.uptime?.() || 0,
                timestamp: new Date().toISOString()
            };
            return status;
        }
        catch (error) {
            logger.error('Failed to get server status:', error);
            return {
                online: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Get current player list
     */
    getPlayerList() {
        try {
            const players = mc?.getOnlinePlayers?.() || [];
            return players.map((player) => ({
                name: player.name || player.realName || 'Unknown',
                xuid: player.xuid || '',
                uuid: player.uuid || '',
                ip: player.ip || '',
                device: player.deviceTypeName || 'Unknown',
                ping: player.avgPing || 0,
                joinTime: player.joinTime || Date.now(),
                online: true
            }));
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
            // Execute command using LLBDS API
            let result = '';
            if (mc?.runcmd) {
                result = mc.runcmd(command);
            }
            else if (mc?.runcmdEx) {
                const cmdResult = mc.runcmdEx(command);
                result = cmdResult.output || '';
            }
            else {
                throw new Error('Command execution not available');
            }
            return {
                command,
                output: result,
                success: true,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            logger.error('Failed to execute command:', error);
            return {
                command,
                output: '',
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
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
                    timestamp: new Date().toISOString()
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