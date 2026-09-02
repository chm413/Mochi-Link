"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MochiLinkExternalService = void 0;
const express_1 = __importDefault(require("express"));
const cors = __importStar(require("cors"));
const helmet = __importStar(require("helmet"));
const compression = __importStar(require("compression"));
const cron = __importStar(require("node-cron"));
const winston = __importStar(require("winston"));
const http_1 = require("http");
const LLBDSConfig_1 = require("./config/LLBDSConfig");
const MochiLinkConnectionManager_1 = require("./network/MochiLinkConnectionManager");
const ExternalPerformanceMonitor_1 = require("./monitoring/ExternalPerformanceMonitor");
async function getFetch() {
    const nativeFetch = globalThis.fetch;
    if (typeof nativeFetch === 'function') {
        return nativeFetch.bind(globalThis);
    }
    // node-fetch v3 is ESM-only. Keep the CommonJS connector compatible with
    // Node versions that do not provide a global fetch without using require().
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    return (await dynamicImport('node-fetch')).default;
}
async function fetchWithTimeout(url, init = {}, timeout = 30000) {
    const fetch = await getFetch();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const requestInit = { ...init };
        delete requestInit.timeout;
        return await fetch(url, { ...requestInit, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Mochi-Link External Network Service for LLBDS
 *
 * This service runs as a separate Node.js process to handle all network
 * communication with the Mochi-Link management system, avoiding any
 * performance impact on the Minecraft server core.
 *
 * Architecture:
 * LLBDS Server -> LSE Plugin -> HTTP API -> This Service -> Mochi-Link
 *
 * @author chm413
 * @version 1.0.0
 */
class MochiLinkExternalService {
    constructor() {
        this.httpPort = 25581; // External service HTTP port
        this.lseBridgePort = 25580; // LSE bridge port
        this.isRunning = false;
        this.isConnected = false;
        // Data caches
        this.serverData = {};
        this.playerData = new Map();
        this.performanceData = {};
        this.initializeLogger();
        this.initializeExpress();
        this.config = new LLBDSConfig_1.LLBDSConfig();
    }
    /**
     * Initialize Winston logger
     */
    initializeLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'mochi-link-external-service' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/external-service-error.log',
                    level: 'error'
                }),
                new winston.transports.File({
                    filename: 'logs/external-service.log'
                }),
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                })
            ]
        });
    }
    /**
     * Initialize Express application
     */
    initializeExpress() {
        this.app = (0, express_1.default)();
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: ['http://localhost:25580'], // Only allow LSE bridge
            credentials: true
        }));
        this.app.use(compression());
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        // Setup routes
        this.setupRoutes();
    }
    /**
     * Setup Express routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                service: 'mochi-link-external-service',
                version: '1.0.0',
                uptime: process.uptime(),
                connected: this.isConnected,
                timestamp: new Date().toISOString()
            });
        });
        // Server data endpoints
        this.app.get('/api/server/status', (_req, res) => {
            res.json({
                success: true,
                data: this.serverData
            });
        });
        this.app.post('/api/server/update', (_req, res) => {
            try {
                this.serverData = { ...this.serverData, ..._req.body };
                this.logger.debug('Server data updated:', _req.body);
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to update server data:', error);
                res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Player data endpoints
        this.app.get('/api/players', (_req, res) => {
            res.json({
                success: true,
                data: Array.from(this.playerData.values())
            });
        });
        this.app.post('/api/players/update', (req, res) => {
            try {
                const { playerId, data } = req.body;
                this.playerData.set(playerId, { ...this.playerData.get(playerId), ...data });
                this.logger.debug(`Player data updated for ${playerId}:`, data);
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to update player data:', error);
                res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        });
        this.app.delete('/api/players/:playerId', (req, res) => {
            try {
                const { playerId } = req.params;
                this.playerData.delete(playerId);
                this.logger.debug(`Player data removed for ${playerId}`);
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to remove player data:', error);
                res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Event forwarding endpoint
        this.app.post('/api/events/forward', async (req, res) => {
            try {
                const event = req.body;
                await this.forwardEventToMochiLink(event);
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to forward event:', error);
                res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Command execution endpoint
        this.app.post('/api/commands/execute', async (req, res) => {
            try {
                const { command, timeout = 30000 } = req.body;
                const result = await this.executeCommandOnServer(command, timeout);
                res.json({ success: true, result });
            }
            catch (error) {
                this.logger.error('Failed to execute command:', error);
                res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Performance data endpoint
        this.app.get('/api/performance', (_req, res) => {
            res.json({
                success: true,
                data: this.performanceData
            });
        });
        // Shutdown endpoint
        this.app.post('/shutdown', (_req, res) => {
            res.json({ success: true, message: 'Shutting down...' });
            setTimeout(() => {
                this.shutdown();
            }, 1000);
        });
    }
    /**
     * Start the external service
     */
    async start() {
        try {
            this.logger.info('Starting Mochi-Link External Service...');
            this.logger.info('正在启动大福连外部服务...');
            // Load configuration
            await this.config.load();
            this.httpPort = this.config.getExternalServicePort();
            this.lseBridgePort = this.config.getHttpPort();
            // Start HTTP server
            this.server = (0, http_1.createServer)(this.app);
            await new Promise((resolve, reject) => {
                this.server.listen(this.httpPort, (error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            });
            // Initialize connection manager
            this.connectionManager = new MochiLinkConnectionManager_1.MochiLinkConnectionManager(this.config, this.logger);
            this.setupMochiLinkHandlers();
            // Initialize performance monitor
            this.performanceMonitor = new ExternalPerformanceMonitor_1.ExternalPerformanceMonitor(this.logger);
            // Mark the process running before connecting so a failed initial
            // connection can enter the configured reconnect path.
            this.isRunning = true;
            // Start connection to Mochi-Link
            await this.startMochiLinkConnection();
            // Start performance monitoring
            this.startPerformanceMonitoring();
            // Start periodic tasks
            this.startPeriodicTasks();
            this.logger.info(`External service started on port ${this.httpPort}`);
            this.logger.info(`外部服务已在端口 ${this.httpPort} 启动`);
        }
        catch (error) {
            this.logger.error('Failed to start external service:', error);
            throw error;
        }
    }
    /**
     * Start connection to Mochi-Link management system
     */
    async startMochiLinkConnection() {
        try {
            this.logger.info('Connecting to Mochi-Link management system...');
            await this.connectionManager.connect();
            if (this.connectionManager.isConnected()) {
                this.isConnected = true;
                this.logger.info('Successfully connected to Mochi-Link management system!');
                this.logger.info('已成功连接到大福连管理系统！');
            }
        }
        catch (error) {
            this.logger.warn('Failed to connect to Mochi-Link:', error);
            // Schedule reconnection
            setTimeout(() => {
                if (this.isRunning) {
                    this.startMochiLinkConnection();
                }
            }, 30000);
        }
    }
    /**
     * Setup Mochi-Link message handlers
     */
    setupMochiLinkHandlers() {
        this.connectionManager.on('message', (message) => {
            this.handleMochiLinkMessage(message);
        });
        this.connectionManager.on('disconnect', () => {
            this.isConnected = false;
            this.logger.warn('Disconnected from Mochi-Link management system');
            // Schedule reconnection
            setTimeout(() => {
                if (this.isRunning) {
                    this.startMochiLinkConnection();
                }
            }, 30000);
        });
        this.connectionManager.on('error', (error) => {
            this.logger.error('Mochi-Link connection error:', error);
        });
    }
    /**
     * Handle messages from Mochi-Link
     */
    async handleMochiLinkMessage(message) {
        try {
            // Do not log protocol bodies; handshake payloads can contain a
            // token or challenge response.
            this.logger.debug('Received message from Mochi-Link:', {
                type: message?.type,
                op: message?.op || message?.systemOp,
                id: message?.id
            });
            switch (message.op) {
                case 'server.status':
                case 'server.getStatus':
                case 'server.getInfo':
                    await this.handleServerStatusRequest(message);
                    break;
                case 'player.list':
                    await this.handlePlayerListRequest(message);
                    break;
                case 'command.execute':
                    await this.handleCommandExecuteRequest(message);
                    break;
                case 'performance.get':
                case 'server.getMetrics':
                    await this.handlePerformanceRequest(message);
                    break;
                case 'player.getInfo':
                    await this.handlePlayerInfoRequest(message);
                    break;
                default:
                    this.logger.warn('Unsupported message operation:', message.op);
                    await this.connectionManager.send(this.createResponse(message, {}, false, `Unsupported operation: ${message.op || '(missing)'}`, 'UNSUPPORTED_OPERATION'));
            }
        }
        catch (error) {
            this.logger.error('Failed to handle Mochi-Link message:', error);
            if (message?.type === 'request' && this.connectionManager) {
                await this.connectionManager.send(this.createResponse(message, {}, false, error instanceof Error ? error.message : String(error), 'OPERATION_FAILED'));
            }
        }
    }
    /** Build the canonical U-WBP response envelope. */
    createResponse(request, data = {}, success = true, error, code) {
        const response = {
            type: 'response',
            id: this.generateMessageId(),
            requestId: request?.id,
            op: request?.op || 'response',
            success,
            data,
            timestamp: Date.now(),
            version: '2.0',
            serverId: this.config.getServerId()
        };
        if (error) {
            response.error = error;
            response.data = { ...data, code: code || 'OPERATION_FAILED' };
        }
        return response;
    }
    /** Build a canonical event envelope. */
    createEvent(op, data) {
        const normalized = this.normalizeEventOperation(op);
        const payload = normalized === op ? { ...data } : { ...data, sourceEvent: op };
        if (normalized === 'server.status' && !payload.status) {
            payload.status = op === 'server.stop' ? 'offline' : 'online';
        }
        return {
            type: 'event',
            id: this.generateMessageId(),
            op: normalized,
            eventType: normalized,
            data: payload,
            timestamp: Date.now(),
            version: '2.0',
            serverId: this.config.getServerId()
        };
    }
    normalizeEventOperation(op) {
        switch (op) {
            case 'player.kick':
            case 'player.quit':
                return 'player.leave';
            case 'server.load':
            case 'server.ready':
            case 'server.start':
            case 'server.stop':
                return 'server.status';
            case 'performance.update':
                return 'server.metrics';
            case 'player.join':
            case 'player.leave':
            case 'player.chat':
            case 'player.death':
            case 'player.advancement':
            case 'player.move':
            case 'server.status':
            case 'server.logLine':
            case 'server.metrics':
            case 'alert.tpsLow':
            case 'alert.memoryHigh':
            case 'alert.playerFlood':
            case 'alert.diskSpace':
            case 'alert.connectionLost':
                return op;
            default:
                return 'server.logLine';
        }
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    /**
     * Handle server status request
     */
    async handleServerStatusRequest(message) {
        await this.refreshSnapshot();
        const players = Array.from(this.playerData.values());
        if (!this.serverData.serverId && !this.serverData.version) {
            await this.connectionManager.send(this.createResponse(message, {}, false, 'LLBDS status is unavailable'));
            return;
        }
        const baseInfo = {
            ...this.serverData,
            serverId: this.serverData.serverId || this.config.getServerId(),
            coreType: 'Bedrock',
            coreName: this.serverData.coreName || 'LLBDS',
            players,
            performance: this.performanceData
        };
        const op = message?.op;
        const data = op === 'server.getInfo'
            ? { info: baseInfo }
            : {
                status: this.serverData.status || 'online',
                online: this.serverData.status === 'online',
                playerCount: players.length,
                maxPlayers: this.serverData.maxPlayers,
                tps: this.performanceData.tps,
                memoryUsage: this.performanceData.memoryUsage
            };
        const response = this.createResponse(message, data);
        await this.connectionManager.send(response);
    }
    /**
     * Handle player list request
     */
    async handlePlayerListRequest(message) {
        await this.refreshSnapshot();
        if (!this.serverData.serverId && this.playerData.size === 0) {
            await this.connectionManager.send(this.createResponse(message, {}, false, 'LLBDS player list is unavailable'));
            return;
        }
        const response = this.createResponse(message, {
            players: Array.from(this.playerData.values()),
            count: this.playerData.size,
            online: this.playerData.size,
            max: this.serverData.maxPlayers
        });
        await this.connectionManager.send(response);
    }
    /**
     * Handle command execute request
     */
    async handleCommandExecuteRequest(message) {
        try {
            const { command, timeout = 30000 } = message.data;
            const result = await this.executeCommandOnServer(command, timeout);
            const commandResult = result?.result && typeof result.result === 'object'
                ? result.result
                : result;
            const response = this.createResponse(message, { command, ...commandResult }, commandResult?.success !== false, commandResult?.error);
            await this.connectionManager.send(response);
        }
        catch (error) {
            const response = this.createResponse(message, {}, false, error instanceof Error ? error.message : String(error));
            await this.connectionManager.send(response);
        }
    }
    /**
     * Handle performance request
     */
    async handlePerformanceRequest(message) {
        await this.refreshSnapshot();
        if (!this.performanceData || Object.keys(this.performanceData).length === 0) {
            await this.connectionManager.send(this.createResponse(message, {}, false, 'LLBDS performance metrics are unavailable'));
            return;
        }
        const response = this.createResponse(message, { metrics: { ...this.performanceData } });
        await this.connectionManager.send(response);
    }
    async handlePlayerInfoRequest(message) {
        await this.refreshSnapshot();
        const playerId = message.data?.playerId || message.data?.id || message.data?.playerName;
        const player = playerId ? this.findPlayer(String(playerId)) : undefined;
        if (!player) {
            await this.connectionManager.send(this.createResponse(message, {}, false, 'Player not found'));
            return;
        }
        await this.connectionManager.send(this.createResponse(message, { player }));
    }
    /** Refresh the cache from the in-process LSE bridge before serving reads. */
    async refreshSnapshot() {
        const base = `http://localhost:${this.lseBridgePort}`;
        const requests = await Promise.allSettled([
            fetchWithTimeout(`${base}/api/server/status`, {}, 5000),
            fetchWithTimeout(`${base}/api/players`, {}, 5000),
            fetchWithTimeout(`${base}/api/performance`, {}, 5000)
        ]);
        let refreshed = false;
        const statusResponse = requests[0];
        if (statusResponse.status === 'fulfilled' && statusResponse.value.ok) {
            const body = await statusResponse.value.json();
            const raw = body?.data ?? body;
            if (this.hasServerSnapshot(raw)) {
                this.serverData = this.normalizeServerData(raw);
                if (raw.tps !== undefined || raw.memory || raw.memoryUsage) {
                    this.performanceData = this.normalizeMetrics(raw, this.performanceData);
                }
                refreshed = true;
            }
        }
        const playersResponse = requests[1];
        if (playersResponse.status === 'fulfilled' && playersResponse.value.ok) {
            const body = await playersResponse.value.json();
            const rawPlayers = body?.data ?? body;
            if (Array.isArray(rawPlayers)) {
                this.playerData.clear();
                for (const rawPlayer of rawPlayers) {
                    const player = this.normalizePlayer(rawPlayer);
                    if (player)
                        this.playerData.set(player.id, player);
                }
                refreshed = true;
            }
        }
        const performanceResponse = requests[2];
        if (performanceResponse.status === 'fulfilled' && performanceResponse.value.ok) {
            const body = await performanceResponse.value.json();
            const raw = body?.data ?? body;
            if (this.hasMetricsSnapshot(raw)) {
                this.performanceData = this.normalizeMetrics(raw, this.performanceData);
                refreshed = true;
            }
        }
        if (!refreshed && !this.serverData.serverId && this.playerData.size === 0 &&
            Object.keys(this.performanceData).length === 0) {
            throw new Error('LSE bridge snapshot unavailable');
        }
    }
    normalizeServerData(raw) {
        const players = raw.players && typeof raw.players === 'object' ? raw.players : {};
        const onlinePlayers = Number(raw.onlinePlayers ?? players.online ?? 0);
        const maxPlayers = Number(raw.maxPlayers ?? players.max ?? 0);
        const memory = raw.memoryUsage ?? raw.memory;
        return {
            serverId: String(raw.serverId ?? this.config.getServerId()),
            name: String(raw.name ?? this.config.getServerName()),
            version: String(raw.version ?? 'unknown'),
            coreType: 'Bedrock',
            coreName: String(raw.coreName ?? 'LLBDS'),
            status: raw.status ?? (raw.online === false ? 'offline' : 'online'),
            online: raw.online !== undefined
                ? Boolean(raw.online)
                : raw.status !== undefined
                    ? raw.status === 'online'
                    : true,
            maxPlayers,
            onlinePlayers,
            uptime: Number(raw.uptime ?? 0),
            tps: Number(raw.tps ?? 0),
            memoryUsage: this.normalizeMemory(memory),
            worldInfo: Array.isArray(raw.worldInfo) ? raw.worldInfo : []
        };
    }
    normalizeMetrics(raw, previous = {}) {
        const metrics = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : raw;
        const memory = metrics.memoryUsage ?? metrics.memory ?? raw.memoryUsage ?? raw.memory ?? previous.memoryUsage;
        return {
            serverId: String(metrics.serverId ?? this.config.getServerId()),
            timestamp: Number(metrics.timestamp ?? Date.now()),
            tps: Number(metrics.tps ?? metrics.ticksPerSecond ?? previous.tps ?? 0),
            cpuUsage: Number(metrics.cpuUsage ?? metrics.cpu?.usage ?? previous.cpuUsage ?? 0),
            memoryUsage: this.normalizeMemory(memory),
            playerCount: Number(metrics.playerCount ?? metrics.players?.online ?? this.playerData.size),
            ping: Number(metrics.ping ?? 0)
        };
    }
    hasServerSnapshot(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return false;
        return ['serverId', 'status', 'online', 'version', 'coreName', 'maxPlayers',
            'onlinePlayers', 'playerCount', 'error'].some(key => Object.prototype.hasOwnProperty.call(raw, key));
    }
    hasMetricsSnapshot(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return false;
        const metrics = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : raw;
        return ['tps', 'ticksPerSecond', 'cpuUsage', 'memoryUsage', 'memory',
            'playerCount', 'players', 'ping'].some(key => Object.prototype.hasOwnProperty.call(metrics, key));
    }
    normalizeMemory(raw) {
        const memory = raw && typeof raw === 'object' ? raw : {};
        const used = Number(memory.used ?? 0);
        const max = Number(memory.max ?? memory.total ?? 0);
        const free = Number(memory.free ?? Math.max(0, max - used));
        const percentage = Number(memory.percentage ?? (max > 0 ? used / max * 100 : 0));
        return { used, max, free, percentage };
    }
    normalizePlayer(raw) {
        if (!raw || typeof raw !== 'object')
            return null;
        const name = String(raw.name ?? raw.realName ?? '');
        const id = String(raw.id ?? raw.xuid ?? raw.uuid ?? name);
        if (!name || !id)
            return null;
        const position = raw.position ?? raw.pos ?? {};
        return {
            id,
            name,
            displayName: String(raw.displayName ?? name),
            world: String(raw.world ?? raw.level ?? 'unknown'),
            position: {
                x: Number(position.x ?? 0),
                y: Number(position.y ?? 0),
                z: Number(position.z ?? 0),
                ...(position.yaw !== undefined ? { yaw: Number(position.yaw) } : {}),
                ...(position.pitch !== undefined ? { pitch: Number(position.pitch) } : {})
            },
            ping: Math.max(0, Number(raw.ping ?? raw.avgPing ?? 0)),
            isOp: Boolean(raw.isOp ?? raw.isOP ?? false),
            permissions: Array.isArray(raw.permissions) ? raw.permissions.map(String) : [],
            edition: 'Bedrock',
            ...(raw.deviceType || raw.device ? { deviceType: String(raw.deviceType ?? raw.device) } : {}),
            isOnline: raw.online !== false
        };
    }
    findPlayer(identifier) {
        const direct = this.playerData.get(identifier);
        if (direct)
            return direct;
        return Array.from(this.playerData.values()).find(player => player.name === identifier || player.displayName === identifier);
    }
    /**
     * Execute command on LLBDS server via LSE bridge
     */
    async executeCommandOnServer(command, timeout) {
        try {
            const response = await fetchWithTimeout(`http://localhost:${this.lseBridgePort}/api/commands/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command, timeout })
            }, timeout);
            if (!response.ok) {
                throw new Error(`Command execution failed: ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            this.logger.error('Failed to execute command on server:', error);
            throw error;
        }
    }
    /**
     * Forward event to Mochi-Link
     */
    async forwardEventToMochiLink(event) {
        if (!this.isConnected) {
            this.logger.warn('Cannot forward event: not connected to Mochi-Link');
            return;
        }
        try {
            const message = this.createEvent(event.type || 'server.event', event.data || event);
            await this.connectionManager.send(message);
            this.logger.debug('Event forwarded to Mochi-Link:', event.type);
        }
        catch (error) {
            this.logger.error('Failed to forward event to Mochi-Link:', error);
        }
    }
    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        // Monitor system performance every 30 seconds
        cron.schedule('*/30 * * * * *', async () => {
            try {
                const systemInfo = await this.performanceMonitor.collectSystemInfo();
                this.performanceData = {
                    ...this.normalizeMetrics(this.performanceData, this.performanceData),
                    cpuUsage: Number(systemInfo?.cpu?.usage?.total ?? this.performanceData.cpuUsage ?? 0),
                    timestamp: Date.now(),
                    system: systemInfo
                };
                // Send performance data to Mochi-Link if connected
                if (this.isConnected) {
                    const message = this.createEvent('server.metrics', {
                        metrics: { ...this.performanceData }
                    });
                    await this.connectionManager.send(message);
                }
            }
            catch (error) {
                this.logger.error('Failed to collect performance data:', error);
            }
        });
    }
    /**
     * Start periodic tasks
     */
    startPeriodicTasks() {
        // Heartbeat every 30 seconds
        cron.schedule('*/30 * * * * *', async () => {
            if (this.isConnected) {
                try {
                    const message = {
                        type: 'system',
                        id: this.generateMessageId(),
                        op: 'ping',
                        systemOp: 'ping',
                        data: { serverId: this.config.getServerId() },
                        timestamp: Date.now(),
                        version: '2.0',
                        serverId: this.config.getServerId()
                    };
                    await this.connectionManager.send(message);
                }
                catch (error) {
                    this.logger.error('Failed to send heartbeat:', error);
                }
            }
        });
        // Clean up old data every 5 minutes
        cron.schedule('*/5 * * * *', () => {
            this.cleanupOldData();
        });
    }
    /**
     * Clean up old data
     */
    cleanupOldData() {
        try {
            // Remove offline players older than 1 hour
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const entries = Array.from(this.playerData.entries());
            for (const [playerId, playerData] of entries) {
                if (playerData.lastSeen && playerData.lastSeen < oneHourAgo && !playerData.online) {
                    this.playerData.delete(playerId);
                    this.logger.debug(`Cleaned up old player data for ${playerId}`);
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to clean up old data:', error);
        }
    }
    /**
     * Shutdown the service
     */
    async shutdown() {
        try {
            this.logger.info('Shutting down Mochi-Link External Service...');
            this.isRunning = false;
            // Disconnect from Mochi-Link
            if (this.connectionManager) {
                await this.connectionManager.disconnect();
            }
            // Stop HTTP server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(() => {
                        resolve();
                    });
                });
            }
            this.logger.info('Mochi-Link External Service shutdown completed');
            process.exit(0);
        }
        catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}
exports.MochiLinkExternalService = MochiLinkExternalService;
// Handle process signals
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    if (service) {
        await service.shutdown();
    }
});
process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    if (service) {
        await service.shutdown();
    }
});
// Start the service
let service;
async function main() {
    try {
        service = new MochiLinkExternalService();
        await service.start();
    }
    catch (error) {
        console.error('Failed to start Mochi-Link External Service:', error);
        process.exit(1);
    }
}
// Auto-start if running directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=external-service.js.map