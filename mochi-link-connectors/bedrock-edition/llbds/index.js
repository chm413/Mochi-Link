"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MochiLinkLLBDSPlugin = void 0;
const LLBDSConfig_1 = require("./config/LLBDSConfig");
const LSEBridge_1 = require("./bridge/LSEBridge");
const LLBDSEventHandler_1 = require("./handlers/LLBDSEventHandler");
const LLBDSCommandHandler_1 = require("./handlers/LLBDSCommandHandler");
/**
 * Mochi-Link Connector Plugin for LLBDS (LiteLoaderBDS) with LSE
 *
 * This plugin provides integration between LLBDS servers and the Mochi-Link
 * unified management system, utilizing LSE (LiteLoaderBDS Script Engine) as
 * the bridge and Node.js external network service for communication.
 *
 * Architecture:
 * LLBDS Server <-> LSE Plugin <-> HTTP API <-> Node.js External Service <-> Mochi-Link
 *
 * @author chm413
 * @version 1.0.0
 */
// Plugin information
const PLUGIN_NAME = 'MochiLinkConnectorLLBDS';
const PLUGIN_VERSION = '1.0.0';
const PLUGIN_AUTHOR = 'chm413';
// Global plugin instance
let pluginInstance = null;
/**
 * LSE Plugin entry point - called when LLBDS loads the plugin
 * This runs inside the LLBDS process and should be lightweight
 */
function main() {
    try {
        // Initialize lightweight LSE plugin
        pluginInstance = new MochiLinkLLBDSPlugin();
        pluginInstance.initialize();
        logger.info(`${PLUGIN_NAME} v${PLUGIN_VERSION} LSE Bridge initialized!`);
        logger.info(`大福连 LLBDS LSE 桥接器 v${PLUGIN_VERSION} 已初始化！`);
    }
    catch (error) {
        logger.error(`Failed to initialize ${PLUGIN_NAME} LSE Bridge:`, error);
    }
}
/**
 * Plugin cleanup - called when LLBDS unloads the plugin
 */
function cleanup() {
    try {
        if (pluginInstance) {
            pluginInstance.cleanup();
            pluginInstance = null;
        }
        logger.info(`${PLUGIN_NAME} LSE Bridge has been unloaded.`);
        logger.info(`大福连 LLBDS LSE 桥接器已卸载。`);
    }
    catch (error) {
        logger.error(`Error during ${PLUGIN_NAME} LSE Bridge cleanup:`, error);
    }
}
// Export for LSE
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        main,
        cleanup,
        PLUGIN_NAME,
        PLUGIN_VERSION,
        PLUGIN_AUTHOR
    };
}
/**
 * LLBDS LSE Plugin Class (Lightweight Bridge)
 * This class runs inside the LLBDS process and provides minimal overhead
 */
class MochiLinkLLBDSPlugin {
    constructor() {
        this.isEnabled = false;
        this.httpPort = 25580; // Default HTTP API port
        this.config = new LLBDSConfig_1.LLBDSConfig();
    }
    /**
     * Initialize the lightweight LSE plugin
     */
    async initialize() {
        try {
            logger.info('Initializing Mochi-Link LLBDS LSE Bridge...');
            logger.info('正在初始化大福连 LLBDS LSE 桥接器...');
            // Load configuration
            await this.config.load();
            this.httpPort = this.config.getHttpPort();
            // Initialize LSE bridge (lightweight HTTP server for communication)
            this.lseBridge = new LSEBridge_1.LSEBridge(this.httpPort, this.config);
            await this.lseBridge.start();
            // Initialize event handler (registers LSE event listeners)
            this.eventHandler = new LLBDSEventHandler_1.LLBDSEventHandler(this.lseBridge);
            this.eventHandler.registerEvents();
            // Initialize command handler (registers LSE command handlers)
            this.commandHandler = new LLBDSCommandHandler_1.LLBDSCommandHandler(this.lseBridge);
            this.commandHandler.registerCommands();
            // Start external Node.js service
            await this.startExternalService();
            this.isEnabled = true;
            logger.info('Mochi-Link LLBDS LSE Bridge initialized successfully!');
            logger.info('大福连 LLBDS LSE 桥接器初始化成功！');
        }
        catch (error) {
            logger.error('Failed to initialize Mochi-Link LLBDS LSE Bridge:', error);
            throw error;
        }
    }
    /**
     * Start external Node.js service
     */
    async startExternalService() {
        try {
            // Check if external service is already running
            const isRunning = await this.checkExternalService();
            if (!isRunning) {
                logger.info('Starting external Node.js service...');
                logger.info('正在启动外部Node.js服务...');
                // Start external service using child process
                const { spawn } = require('child_process');
                const path = require('path');
                const servicePath = path.join(__dirname, '../external-service.js');
                const serviceProcess = spawn('node', [servicePath], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: path.dirname(servicePath)
                });
                serviceProcess.unref();
                // Wait for service to start
                await new Promise(resolve => setTimeout(resolve, 3000));
                const isStarted = await this.checkExternalService();
                if (isStarted) {
                    logger.info('External Node.js service started successfully!');
                    logger.info('外部Node.js服务启动成功！');
                }
                else {
                    throw new Error('Failed to start external Node.js service');
                }
            }
            else {
                logger.info('External Node.js service is already running');
                logger.info('外部Node.js服务已在运行');
            }
        }
        catch (error) {
            logger.warn('Failed to start external service:', error);
            logger.warn('启动外部服务失败:', error);
        }
    }
    /**
     * Check if external service is running
     */
    async checkExternalService() {
        try {
            const fetch = require('node-fetch');
            const response = await fetch(`http://localhost:${this.httpPort + 1}/health`, {
                timeout: 5000
            });
            return response.ok;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Cleanup plugin resources
     */
    async cleanup() {
        try {
            // Stop LSE bridge
            if (this.lseBridge) {
                await this.lseBridge.stop();
            }
            // Cleanup event handlers
            if (this.eventHandler) {
                this.eventHandler.unregisterEvents();
            }
            // Notify external service to stop
            try {
                const fetch = require('node-fetch');
                await fetch(`http://localhost:${this.httpPort + 1}/shutdown`, {
                    method: 'POST',
                    timeout: 5000
                });
            }
            catch (error) {
                // Ignore errors during shutdown
            }
            this.isEnabled = false;
            logger.info('Mochi-Link LLBDS LSE Bridge cleanup completed.');
            logger.info('大福连 LLBDS LSE 桥接器清理完成。');
        }
        catch (error) {
            logger.error('Error during LSE Bridge cleanup:', error);
        }
    }
    /**
     * Get plugin configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Get LSE bridge
     */
    getLSEBridge() {
        return this.lseBridge;
    }
    /**
     * Get event handler
     */
    getEventHandler() {
        return this.eventHandler;
    }
    /**
     * Get command handler
     */
    getCommandHandler() {
        return this.commandHandler;
    }
    /**
     * Check if plugin is enabled
     */
    isPluginEnabled() {
        return this.isEnabled;
    }
    /**
     * Get connection status
     */
    getConnectionStatus() {
        if (!this.isEnabled) {
            return 'LSE Bridge Disabled';
        }
        if (this.lseBridge && this.lseBridge.isRunning()) {
            return 'LSE Bridge Active';
        }
        return 'Unknown';
    }
}
exports.MochiLinkLLBDSPlugin = MochiLinkLLBDSPlugin;
//# sourceMappingURL=index.js.map