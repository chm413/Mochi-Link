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
        this.app.get('/health', (req, res) => {
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
        this.app.get('/api/server/status', (req, res) => {
            res.json({
                success: true,
                data: this.serverData
            });
        });
        this.app.post('/api/server/update', (req, res) => {
            try {
                this.serverData = { ...this.serverData, ...req.body };
                this.logger.debug('Server data updated:', req.body);
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to update server data:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // Player data endpoints
        this.app.get('/api/players', (req, res) => {
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
                res.status(500).json({ success: false, error: error.message });
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
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // Event forwarding endpoint
        this.app.post('/api/events/forward', (req, res) => {
            try {
                const event = req.body;
                this.forwardEventToMochiLink(event);
                res.json({ success: true });
            }
            catch (error) {
                this.logger.error('Failed to forward event:', error);
                res.status(500).json({ success: false, error: error.message });
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
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // Performance data endpoint
        this.app.get('/api/performance', (req, res) => {
            res.json({
                success: true,
                data: this.performanceData
            });
        });
        // Shutdown endpoint
        this.app.post('/shutdown', (req, res) => {
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
            // Initialize performance monitor
            this.performanceMonitor = new ExternalPerformanceMonitor_1.ExternalPerformanceMonitor(this.logger);
            // Start connection to Mochi-Link
            await this.startMochiLinkConnection();
            // Start performance monitoring
            this.startPerformanceMonitoring();
            // Start periodic tasks
            this.startPeriodicTasks();
            this.isRunning = true;
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
                // Setup message handlers
                this.setupMochiLinkHandlers();
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
            this.logger.debug('Received message from Mochi-Link:', message);
            switch (message.op) {
                case 'server.status':
                    await this.handleServerStatusRequest(message);
                    break;
                case 'player.list':
                    await this.handlePlayerListRequest(message);
                    break;
                case 'command.execute':
                    await this.handleCommandExecuteRequest(message);
                    break;
                case 'performance.get':
                    await this.handlePerformanceRequest(message);
                    break;
                default:
                    this.logger.warn('Unknown message operation:', message.op);
            }
        }
        catch (error) {
            this.logger.error('Failed to handle Mochi-Link message:', error);
        }
    }
    /**
     * Handle server status request
     */
    async handleServerStatusRequest(message) {
        const response = {
            type: 'response',
            id: message.id,
            success: true,
            data: {
                ...this.serverData,
                players: Array.from(this.playerData.values()),
                performance: this.performanceData,
                timestamp: new Date().toISOString()
            }
        };
        await this.connectionManager.send(response);
    }
    /**
     * Handle player list request
     */
    async handlePlayerListRequest(message) {
        const response = {
            type: 'response',
            id: message.id,
            success: true,
            data: {
                players: Array.from(this.playerData.values()),
                count: this.playerData.size,
                timestamp: new Date().toISOString()
            }
        };
        await this.connectionManager.send(response);
    }
    /**
     * Handle command execute request
     */
    async handleCommandExecuteRequest(message) {
        try {
            const { command, timeout = 30000 } = message.data;
            const result = await this.executeCommandOnServer(command, timeout);
            const response = {
                type: 'response',
                id: message.id,
                success: true,
                data: {
                    command,
                    result,
                    timestamp: new Date().toISOString()
                }
            };
            await this.connectionManager.send(response);
        }
        catch (error) {
            const response = {
                type: 'response',
                id: message.id,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            await this.connectionManager.send(response);
        }
    }
    /**
     * Handle performance request
     */
    async handlePerformanceRequest(message) {
        const response = {
            type: 'response',
            id: message.id,
            success: true,
            data: {
                ...this.performanceData,
                timestamp: new Date().toISOString()
            }
        };
        await this.connectionManager.send(response);
    }
    /**
     * Execute command on LLBDS server via LSE bridge
     */
    async executeCommandOnServer(command, timeout) {
        try {
            const fetch = require('node-fetch');
            const response = await fetch(`http://localhost:${this.lseBridgePort}/api/commands/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command, timeout }),
                timeout
            });
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
            const message = {
                type: 'event',
                event: event.type,
                data: event.data,
                timestamp: new Date().toISOString(),
                serverId: this.config.getServerId()
            };
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
                    ...this.performanceData,
                    system: systemInfo,
                    timestamp: new Date().toISOString()
                };
                // Send performance data to Mochi-Link if connected
                if (this.isConnected) {
                    const message = {
                        type: 'event',
                        event: 'performance.update',
                        data: this.performanceData,
                        timestamp: new Date().toISOString(),
                        serverId: this.config.getServerId()
                    };
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
                        type: 'heartbeat',
                        timestamp: new Date().toISOString(),
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