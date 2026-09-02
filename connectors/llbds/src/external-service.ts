import express from 'express';
import * as cors from 'cors';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as cron from 'node-cron';
import * as winston from 'winston';
import { createServer } from 'http';
import { LLBDSConfig } from './config/LLBDSConfig';
import { MochiLinkConnectionManager } from './network/MochiLinkConnectionManager';
import { ExternalPerformanceMonitor } from './monitoring/ExternalPerformanceMonitor';

type FetchLike = (url: string, init?: Record<string, any>) => Promise<any>;

async function getFetch(): Promise<FetchLike> {
    const nativeFetch = (globalThis as any).fetch;
    if (typeof nativeFetch === 'function') {
        return nativeFetch.bind(globalThis) as FetchLike;
    }

    // node-fetch v3 is ESM-only. Keep the CommonJS connector compatible with
    // Node versions that do not provide a global fetch without using require().
    const dynamicImport = new Function('specifier', 'return import(specifier)') as
        (specifier: string) => Promise<{ default: FetchLike }>;
    return (await dynamicImport('node-fetch')).default;
}

async function fetchWithTimeout(url: string, init: Record<string, any> = {}, timeout = 30000): Promise<any> {
    const fetch = await getFetch();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const requestInit = { ...init };
        delete requestInit.timeout;
        return await fetch(url, { ...requestInit, signal: controller.signal });
    } finally {
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
    private app!: express.Application;
    private server: any;
    private config!: LLBDSConfig;
    private connectionManager!: MochiLinkConnectionManager;
    private performanceMonitor!: ExternalPerformanceMonitor;
    private logger!: winston.Logger;
    
    private httpPort: number = 25581; // External service HTTP port
    private lseBridgePort: number = 25580; // LSE bridge port
    private isRunning: boolean = false;
    private isConnected: boolean = false;
    
    // Data caches
    private serverData: any = {};
    private playerData: Map<string, any> = new Map();
    private performanceData: any = {};
    
    constructor() {
        this.initializeLogger();
        this.initializeExpress();
        this.config = new LLBDSConfig();
    }
    
    /**
     * Initialize Winston logger
     */
    private initializeLogger(): void {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
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
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }
    
    /**
     * Initialize Express application
     */
    private initializeExpress(): void {
        this.app = express();
        
        // Security middleware
        this.app.use((helmet as any)());
        this.app.use((cors as any)({
            origin: ['http://localhost:25580'], // Only allow LSE bridge
            credentials: true
        }));
        this.app.use((compression as any)());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Setup routes
        this.setupRoutes();
    }
    
    /**
     * Setup Express routes
     */
    private setupRoutes(): void {
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
            } catch (error: unknown) {
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
            } catch (error: unknown) {
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
            } catch (error: unknown) {
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
            } catch (error: unknown) {
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
            } catch (error: unknown) {
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
    public async start(): Promise<void> {
        try {
            this.logger.info('Starting Mochi-Link External Service...');
            this.logger.info('正在启动大福连外部服务...');
            
            // Load configuration
            await this.config.load();
            this.httpPort = this.config.getExternalServicePort();
            this.lseBridgePort = this.config.getHttpPort();
            
            // Start HTTP server
            this.server = createServer(this.app);
            await new Promise<void>((resolve, reject) => {
                this.server.listen(this.httpPort, (error: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
            
            // Initialize connection manager
            this.connectionManager = new MochiLinkConnectionManager(this.config, this.logger);
            this.setupMochiLinkHandlers();
            
            // Initialize performance monitor
            this.performanceMonitor = new ExternalPerformanceMonitor(this.logger);

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
            
        } catch (error) {
            this.logger.error('Failed to start external service:', error);
            throw error;
        }
    }
    
    /**
     * Start connection to Mochi-Link management system
     */
    private async startMochiLinkConnection(): Promise<void> {
        try {
            this.logger.info('Connecting to Mochi-Link management system...');
            
            await this.connectionManager.connect();
            
            if (this.connectionManager.isConnected()) {
                this.isConnected = true;
                this.logger.info('Successfully connected to Mochi-Link management system!');
                this.logger.info('已成功连接到大福连管理系统！');
                
            }
            
        } catch (error) {
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
    private setupMochiLinkHandlers(): void {
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
    private async handleMochiLinkMessage(message: any): Promise<void> {
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
                    await this.connectionManager.send(this.createResponse(
                        message,
                        {},
                        false,
                        `Unsupported operation: ${message.op || '(missing)'}`,
                        'UNSUPPORTED_OPERATION'
                    ));
            }
            
        } catch (error) {
            this.logger.error('Failed to handle Mochi-Link message:', error);
            if (message?.type === 'request' && this.connectionManager) {
                await this.connectionManager.send(this.createResponse(
                    message,
                    {},
                    false,
                    error instanceof Error ? error.message : String(error),
                    'OPERATION_FAILED'
                ));
            }
        }
    }

    /** Build the canonical U-WBP response envelope. */
    private createResponse(
        request: any,
        data: Record<string, any> = {},
        success: boolean = true,
        error?: string,
        code?: string
    ): Record<string, any> {
        const response: Record<string, any> = {
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
    private createEvent(op: string, data: Record<string, any>): Record<string, any> {
        const normalized = this.normalizeEventOperation(op);
        const payload: Record<string, any> = normalized === op ? { ...data } : { ...data, sourceEvent: op };
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

    private normalizeEventOperation(op: string): string {
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

    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    
    /**
     * Handle server status request
     */
    private async handleServerStatusRequest(message: any): Promise<void> {
        await this.refreshSnapshot();
        const players = Array.from(this.playerData.values());
        if (!this.serverData.serverId && !this.serverData.version) {
            await this.connectionManager.send(this.createResponse(
                message,
                {},
                false,
                'LLBDS status is unavailable'
            ));
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
    private async handlePlayerListRequest(message: any): Promise<void> {
        await this.refreshSnapshot();
        if (!this.serverData.serverId && this.playerData.size === 0) {
            await this.connectionManager.send(this.createResponse(
                message,
                {},
                false,
                'LLBDS player list is unavailable'
            ));
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
    private async handleCommandExecuteRequest(message: any): Promise<void> {
        try {
            const { command, timeout = 30000 } = message.data;
            const result = await this.executeCommandOnServer(command, timeout);
            const commandResult = result?.result && typeof result.result === 'object'
                ? result.result
                : result;
            const response = this.createResponse(
                message,
                { command, ...commandResult },
                commandResult?.success !== false,
                commandResult?.error
            );
            
            await this.connectionManager.send(response);
            
        } catch (error: unknown) {
            const response = this.createResponse(
                message,
                {},
                false,
                error instanceof Error ? error.message : String(error)
            );
            
            await this.connectionManager.send(response);
        }
    }
    
    /**
     * Handle performance request
     */
    private async handlePerformanceRequest(message: any): Promise<void> {
        await this.refreshSnapshot();
        if (!this.performanceData || Object.keys(this.performanceData).length === 0) {
            await this.connectionManager.send(this.createResponse(
                message,
                {},
                false,
                'LLBDS performance metrics are unavailable'
            ));
            return;
        }
        const response = this.createResponse(message, { metrics: { ...this.performanceData } });
        
        await this.connectionManager.send(response);
    }

    private async handlePlayerInfoRequest(message: any): Promise<void> {
        await this.refreshSnapshot();
        const playerId = message.data?.playerId || message.data?.id || message.data?.playerName;
        const player = playerId ? this.findPlayer(String(playerId)) : undefined;
        if (!player) {
            await this.connectionManager.send(this.createResponse(
                message,
                {},
                false,
                'Player not found'
            ));
            return;
        }
        await this.connectionManager.send(this.createResponse(message, { player }));
    }

    /** Refresh the cache from the in-process LSE bridge before serving reads. */
    private async refreshSnapshot(): Promise<void> {
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
                    if (player) this.playerData.set(player.id, player);
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

    private normalizeServerData(raw: any): Record<string, any> {
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

    private normalizeMetrics(raw: any, previous: Record<string, any> = {}): Record<string, any> {
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

    private hasServerSnapshot(raw: any): boolean {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
        return ['serverId', 'status', 'online', 'version', 'coreName', 'maxPlayers',
            'onlinePlayers', 'playerCount', 'error'].some(key =>
            Object.prototype.hasOwnProperty.call(raw, key));
    }

    private hasMetricsSnapshot(raw: any): boolean {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
        const metrics = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : raw;
        return ['tps', 'ticksPerSecond', 'cpuUsage', 'memoryUsage', 'memory',
            'playerCount', 'players', 'ping'].some(key =>
            Object.prototype.hasOwnProperty.call(metrics, key));
    }

    private normalizeMemory(raw: any): Record<string, number> {
        const memory = raw && typeof raw === 'object' ? raw : {};
        const used = Number(memory.used ?? 0);
        const max = Number(memory.max ?? memory.total ?? 0);
        const free = Number(memory.free ?? Math.max(0, max - used));
        const percentage = Number(memory.percentage ?? (max > 0 ? used / max * 100 : 0));
        return { used, max, free, percentage };
    }

    private normalizePlayer(raw: any): Record<string, any> | null {
        if (!raw || typeof raw !== 'object') return null;
        const name = String(raw.name ?? raw.realName ?? '');
        const id = String(raw.id ?? raw.xuid ?? raw.uuid ?? name);
        if (!name || !id) return null;
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

    private findPlayer(identifier: string): Record<string, any> | undefined {
        const direct = this.playerData.get(identifier);
        if (direct) return direct;
        return Array.from(this.playerData.values()).find(player =>
            player.name === identifier || player.displayName === identifier
        );
    }
    
    /**
     * Execute command on LLBDS server via LSE bridge
     */
    private async executeCommandOnServer(command: string, timeout: number): Promise<any> {
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
            
        } catch (error) {
            this.logger.error('Failed to execute command on server:', error);
            throw error;
        }
    }
    
    /**
     * Forward event to Mochi-Link
     */
    private async forwardEventToMochiLink(event: any): Promise<void> {
        if (!this.isConnected) {
            this.logger.warn('Cannot forward event: not connected to Mochi-Link');
            return;
        }
        
        try {
            const message = this.createEvent(event.type || 'server.event', event.data || event);
            
            await this.connectionManager.send(message);
            this.logger.debug('Event forwarded to Mochi-Link:', event.type);
            
        } catch (error) {
            this.logger.error('Failed to forward event to Mochi-Link:', error);
        }
    }
    
    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
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
                
            } catch (error: unknown) {
                this.logger.error('Failed to collect performance data:', error);
            }
        });
    }
    
    /**
     * Start periodic tasks
     */
    private startPeriodicTasks(): void {
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
                    
                } catch (error) {
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
    private cleanupOldData(): void {
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
            
        } catch (error) {
            this.logger.error('Failed to clean up old data:', error);
        }
    }
    
    /**
     * Shutdown the service
     */
    public async shutdown(): Promise<void> {
        try {
            this.logger.info('Shutting down Mochi-Link External Service...');
            
            this.isRunning = false;
            
            // Disconnect from Mochi-Link
            if (this.connectionManager) {
                await this.connectionManager.disconnect();
            }
            
            // Stop HTTP server
            if (this.server) {
                await new Promise<void>((resolve) => {
                    this.server.close(() => {
                        resolve();
                    });
                });
            }
            
            this.logger.info('Mochi-Link External Service shutdown completed');
            process.exit(0);
            
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}

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
let service: MochiLinkExternalService;

async function main() {
    try {
        service = new MochiLinkExternalService();
        await service.start();
        
    } catch (error) {
        console.error('Failed to start Mochi-Link External Service:', error);
        process.exit(1);
    }
}

// Auto-start if running directly
if (require.main === module) {
    main();
}

export { MochiLinkExternalService };
