"use strict";
/**
 * Bedrock Edition Connector Bridge
 *
 * Implementation for Bedrock Edition servers (LLBDS, PMMP, etc.)
 * Provides unified interface for server operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockConnectorBridge = void 0;
const base_1 = require("./base");
const types_1 = require("./types");
// ============================================================================
// Bedrock Edition Bridge Implementation
// ============================================================================
class BedrockConnectorBridge extends base_1.BaseConnectorBridge {
    constructor(config, connectionAdapter) {
        super(config);
        this.serverCache = new Map();
        this.lastMetricsUpdate = new Date(0);
        this.connectionAdapter = connectionAdapter;
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    async connect() {
        if (!this.connectionAdapter) {
            throw new types_1.BridgeConnectionError('No connection adapter provided', this.config.serverId);
        }
        try {
            if (!this.connectionAdapter.isConnected) {
                await this.connectionAdapter.connect();
            }
            this.setConnected(true);
            await this.initializeServerInfo();
            // Set up event listeners
            this.setupEventListeners();
        }
        catch (error) {
            this.setConnected(false);
            throw new types_1.BridgeConnectionError(`Failed to connect to Bedrock server: ${error instanceof Error ? error.message : String(error)}`, this.config.serverId);
        }
    }
    async disconnect() {
        try {
            if (this.connectionAdapter && this.connectionAdapter.isConnected) {
                await this.connectionAdapter.disconnect();
            }
        }
        finally {
            this.setConnected(false);
            this.serverCache.clear();
        }
    }
    async isHealthy() {
        if (!this.isConnected || !this.connectionAdapter) {
            return false;
        }
        try {
            // Try a simple command to test connectivity
            const result = await this.executeCommand('list', 5000);
            return result.success;
        }
        catch {
            return false;
        }
    }
    // ============================================================================
    // Server Information
    // ============================================================================
    async getServerInfo() {
        this.requireConnection();
        try {
            // Get basic server info using Bedrock-specific commands
            const versionResult = await this.executeCommand('version');
            const listResult = await this.executeCommand('list');
            // Parse version information
            const versionInfo = this.parseVersionInfo(versionResult.output);
            const playerInfo = this.parsePlayerList(listResult.output);
            // Get performance metrics for additional info
            const metrics = await this.getPerformanceMetrics();
            const serverInfo = {
                serverId: this.config.serverId,
                name: this.config.serverId, // Could be enhanced to get actual server name
                version: versionInfo.version,
                coreType: 'Bedrock',
                coreName: versionInfo.coreName,
                maxPlayers: playerInfo.maxPlayers,
                onlinePlayers: playerInfo.onlinePlayers,
                uptime: metrics.timestamp - this.lastUpdate.getTime(),
                tps: metrics.tps,
                memoryUsage: metrics.memoryUsage,
                worldInfo: await this.getWorldInfo()
            };
            this.serverCache.set('serverInfo', serverInfo);
            return serverInfo;
        }
        catch (error) {
            throw new types_1.BridgeConnectionError(`Failed to get server info: ${error instanceof Error ? error.message : String(error)}`, this.config.serverId);
        }
    }
    async getPerformanceMetrics() {
        this.requireConnection();
        // Return cached metrics if recent (within 30 seconds)
        const now = new Date();
        if (this.metricsCache && (now.getTime() - this.lastMetricsUpdate.getTime()) < 30000) {
            return this.metricsCache;
        }
        try {
            // Get performance information using available commands
            const statusResult = await this.executeCommand('status');
            const performanceInfo = this.parsePerformanceInfo(statusResult.output);
            // Get player count
            const listResult = await this.executeCommand('list');
            const playerInfo = this.parsePlayerList(listResult.output);
            const metrics = {
                serverId: this.config.serverId,
                timestamp: now.getTime(),
                tps: performanceInfo.tps,
                cpuUsage: performanceInfo.cpuUsage,
                memoryUsage: performanceInfo.memoryUsage,
                playerCount: playerInfo.onlinePlayers,
                ping: 0 // Not available through commands
            };
            this.metricsCache = metrics;
            this.lastMetricsUpdate = now;
            return metrics;
        }
        catch (error) {
            // Return basic metrics if detailed ones fail
            const basicMetrics = {
                serverId: this.config.serverId,
                timestamp: now.getTime(),
                tps: 20.0,
                cpuUsage: 0,
                memoryUsage: { used: 0, max: 0, free: 0, percentage: 0 },
                playerCount: 0,
                ping: 0
            };
            return basicMetrics;
        }
    }
    async executeCommand(command, timeout = 10000) {
        this.requireConnection();
        try {
            const startTime = Date.now();
            const result = await this.connectionAdapter.sendCommand(command);
            const executionTime = Date.now() - startTime;
            return {
                success: result.success || false,
                output: result.output || [],
                executionTime,
                error: result.error
            };
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('timeout')) {
                throw new types_1.BridgeTimeoutError(command, this.config.serverId, timeout);
            }
            return {
                success: false,
                output: [],
                executionTime: 0,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    // ============================================================================
    // Player Management
    // ============================================================================
    async getOnlinePlayers() {
        this.requireConnection();
        try {
            const listResult = await this.executeCommand('list');
            const playerNames = this.parsePlayerNames(listResult.output);
            const players = [];
            // Get detailed info for each player (if possible)
            for (const name of playerNames) {
                try {
                    const player = await this.getBasicPlayerInfo(name);
                    if (player) {
                        players.push(player);
                    }
                }
                catch {
                    // If we can't get detailed info, create basic player object
                    players.push({
                        id: name, // Use name as ID if XUID not available
                        name,
                        displayName: name,
                        world: 'Overworld',
                        position: { x: 0, y: 0, z: 0 },
                        ping: 0,
                        isOp: false,
                        permissions: [],
                        edition: 'Bedrock',
                        deviceType: 'Unknown'
                    });
                }
            }
            return players;
        }
        catch (error) {
            throw new types_1.BridgeConnectionError(`Failed to get online players: ${error instanceof Error ? error.message : String(error)}`, this.config.serverId);
        }
    }
    async getPlayerDetail(playerId) {
        this.requireConnection();
        try {
            // Try to get player info using various commands
            const player = await this.getBasicPlayerInfo(playerId);
            if (!player) {
                return null;
            }
            // Enhance with additional details if available
            const detail = {
                ...player,
                firstJoinAt: new Date(), // Would need to be retrieved from server data
                lastSeenAt: new Date(),
                totalPlayTime: 0, // Would need to be calculated
                isPremium: false, // Bedrock edition doesn't have premium concept
                identityConfidence: 0.8, // Lower confidence for Bedrock due to name changes
                identityMarkers: {
                    serverIds: [this.config.serverId],
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    device: player.deviceType
                }
            };
            return detail;
        }
        catch (error) {
            return null;
        }
    }
    // ============================================================================
    // Protected Implementation Methods
    // ============================================================================
    initializeCapabilities() {
        // Bedrock edition has different capabilities than Java
        this.addCapability('player_management');
        this.addCapability('command_execution');
        this.addCapability('performance_monitoring');
        this.addCapability('event_streaming');
        this.addCapability('whitelist_management');
        this.addCapability('ban_management');
        this.addCapability('operator_management');
        // World management is limited in Bedrock
        if (this.config.coreName.toLowerCase().includes('llbds') ||
            this.config.coreName.toLowerCase().includes('pmmp')) {
            this.addCapability('world_management');
            this.addCapability('plugin_integration');
            this.addCapability('server_control');
        }
    }
    async doPlayerAction(action) {
        const startTime = Date.now();
        try {
            let command;
            switch (action.type) {
                case 'kick':
                    command = `kick "${action.target}"${action.reason ? ` ${action.reason}` : ''}`;
                    break;
                case 'ban':
                    // Bedrock uses different ban syntax
                    command = `ban "${action.target}"${action.reason ? ` ${action.reason}` : ''}`;
                    break;
                case 'tempban':
                    // Temporary bans might require plugins
                    command = `tempban "${action.target}" ${action.duration || 3600}${action.reason ? ` ${action.reason}` : ''}`;
                    break;
                case 'mute':
                    // Muting typically requires plugins
                    command = `mute "${action.target}"${action.reason ? ` ${action.reason}` : ''}`;
                    break;
                case 'warn':
                    // Warnings typically require plugins
                    command = `warn "${action.target}"${action.reason ? ` ${action.reason}` : ''}`;
                    break;
                case 'teleport':
                    if (action.metadata?.target) {
                        command = `tp "${action.target}" "${action.metadata.target}"`;
                    }
                    else if (action.metadata?.x && action.metadata?.y && action.metadata?.z) {
                        command = `tp "${action.target}" ${action.metadata.x} ${action.metadata.y} ${action.metadata.z}`;
                    }
                    else {
                        throw new Error('Teleport action requires target player or coordinates');
                    }
                    break;
                default:
                    throw new Error(`Unsupported player action: ${action.type}`);
            }
            const result = await this.executeCommand(command);
            return {
                success: result.success,
                action,
                timestamp: new Date(),
                error: result.error
            };
        }
        catch (error) {
            return {
                success: false,
                action,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async doGetWhitelist() {
        const result = await this.executeCommand('whitelist list');
        return this.parseWhitelistEntries(result.output);
    }
    async doAddToWhitelist(playerId, playerName, reason) {
        // Bedrock uses player names for whitelist
        const result = await this.executeCommand(`whitelist add "${playerName}"`);
        return result.success;
    }
    async doRemoveFromWhitelist(playerId) {
        // Note: We need the player name, not ID for vanilla commands
        const result = await this.executeCommand(`whitelist remove "${playerId}"`);
        return result.success;
    }
    async doGetBanList() {
        const result = await this.executeCommand('banlist');
        return this.parseBanEntries(result.output);
    }
    async doBanPlayer(playerId, reason, duration) {
        let command;
        if (duration) {
            // Temporary ban (might require plugins)
            command = `tempban "${playerId}" ${duration} ${reason}`;
        }
        else {
            command = `ban "${playerId}" ${reason}`;
        }
        const result = await this.executeCommand(command);
        return result.success;
    }
    async doUnbanPlayer(playerId) {
        const result = await this.executeCommand(`pardon "${playerId}"`);
        return result.success;
    }
    async doWorldOperation(operation) {
        const startTime = Date.now();
        try {
            let command;
            switch (operation.type) {
                case 'save':
                    command = 'save hold'; // Bedrock save command
                    await this.executeCommand(command);
                    command = 'save resume';
                    break;
                case 'backup':
                    // Note: Backup typically requires plugins or external tools
                    throw new Error('Backup operation requires plugin support');
                case 'reload':
                    // Bedrock doesn't have a reload command
                    throw new Error('Reload operation not supported on Bedrock servers');
                default:
                    throw new Error(`Unsupported world operation: ${operation.type}`);
            }
            const result = await this.executeCommand(command);
            const duration = Date.now() - startTime;
            return {
                success: result.success,
                operation,
                timestamp: new Date(),
                duration,
                error: result.error
            };
        }
        catch (error) {
            return {
                success: false,
                operation,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async doGetWorldSettings(worldName) {
        // Get basic world settings using gamerule commands
        const gamerules = {};
        try {
            const gameruleResult = await this.executeCommand('gamerule');
            // Parse gamerule output to get current settings
            // This is a simplified implementation
            return {
                name: worldName || 'Bedrock level',
                gamemode: 'survival',
                difficulty: 'normal',
                pvp: true,
                time: 0,
                weather: 'clear',
                gamerules
            };
        }
        catch {
            // Return default settings if we can't get them
            return {
                name: worldName || 'Bedrock level',
                gamemode: 'survival',
                difficulty: 'normal',
                pvp: true,
                time: 0,
                weather: 'clear',
                gamerules: {}
            };
        }
    }
    async doUpdateWorldSettings(settings, worldName) {
        try {
            let success = true;
            if (settings.time !== undefined) {
                const result = await this.executeCommand(`time set ${settings.time}`);
                success = success && result.success;
            }
            if (settings.weather !== undefined) {
                const result = await this.executeCommand(`weather ${settings.weather}`);
                success = success && result.success;
            }
            if (settings.difficulty !== undefined) {
                const result = await this.executeCommand(`difficulty ${settings.difficulty}`);
                success = success && result.success;
            }
            // Update gamerules if provided
            if (settings.gamerules) {
                for (const [rule, value] of Object.entries(settings.gamerules)) {
                    const result = await this.executeCommand(`gamerule ${rule} ${value}`);
                    success = success && result.success;
                }
            }
            return success;
        }
        catch {
            return false;
        }
    }
    async doServerOperation(operation) {
        const startTime = Date.now();
        try {
            let command;
            switch (operation.type) {
                case 'stop':
                    command = 'stop';
                    if (operation.message) {
                        await this.executeCommand(`say ${operation.message}`);
                    }
                    break;
                case 'restart':
                    // Bedrock doesn't have a built-in restart command
                    throw new Error('Restart operation requires plugin support');
                case 'reload':
                    // Bedrock doesn't have a reload command
                    throw new Error('Reload operation not supported on Bedrock servers');
                case 'save':
                    command = 'save hold';
                    await this.executeCommand(command);
                    command = 'save resume';
                    break;
                default:
                    throw new Error(`Unsupported server operation: ${operation.type}`);
            }
            const result = await this.executeCommand(command);
            const duration = Date.now() - startTime;
            return {
                success: result.success,
                operation,
                timestamp: new Date(),
                duration,
                error: result.error
            };
        }
        catch (error) {
            return {
                success: false,
                operation,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async doGetPlugins() {
        try {
            // Plugin commands vary by server implementation
            if (this.config.coreName.toLowerCase().includes('pmmp')) {
                const result = await this.executeCommand('plugins');
                return this.parsePluginList(result.output);
            }
            else if (this.config.coreName.toLowerCase().includes('llbds')) {
                const result = await this.executeCommand('ll list');
                return this.parseLLBDSPluginList(result.output);
            }
            return [];
        }
        catch {
            return [];
        }
    }
    async doPluginOperation(operation) {
        try {
            let command;
            if (this.config.coreName.toLowerCase().includes('pmmp')) {
                switch (operation.type) {
                    case 'enable':
                        command = `plugin enable ${operation.pluginName}`;
                        break;
                    case 'disable':
                        command = `plugin disable ${operation.pluginName}`;
                        break;
                    case 'reload':
                        command = `plugin reload ${operation.pluginName}`;
                        break;
                    default:
                        throw new Error(`Unsupported plugin operation: ${operation.type}`);
                }
            }
            else if (this.config.coreName.toLowerCase().includes('llbds')) {
                switch (operation.type) {
                    case 'enable':
                        command = `ll load ${operation.pluginName}`;
                        break;
                    case 'disable':
                        command = `ll unload ${operation.pluginName}`;
                        break;
                    case 'reload':
                        command = `ll reload ${operation.pluginName}`;
                        break;
                    default:
                        throw new Error(`Unsupported plugin operation: ${operation.type}`);
                }
            }
            else {
                throw new Error('Plugin operations not supported on this server type');
            }
            const result = await this.executeCommand(command);
            return {
                success: result.success,
                operation,
                timestamp: new Date(),
                error: result.error
            };
        }
        catch (error) {
            return {
                success: false,
                operation,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    requireConnection() {
        if (!this.isConnected || !this.connectionAdapter) {
            throw new types_1.BridgeConnectionError('Bridge is not connected to server', this.config.serverId);
        }
    }
    async initializeServerInfo() {
        try {
            await this.getServerInfo();
        }
        catch {
            // Ignore errors during initialization
        }
    }
    setupEventListeners() {
        if (!this.connectionAdapter)
            return;
        // Listen for connection events
        this.connectionAdapter.on('disconnected', () => {
            this.setConnected(false);
        });
        // Listen for server events
        this.connectionAdapter.on('event', (event) => {
            this.handleServerEvent(event);
        });
    }
    handleServerEvent(event) {
        // Convert server events to bridge events
        const bridgeEvent = this.createBridgeEvent(event.type || 'server.event', event.data || event, 'server');
        this.emitBridgeEvent(bridgeEvent);
    }
    parseVersionInfo(output) {
        // Parse version command output for Bedrock
        const versionLine = output.find(line => line.includes('version')) || '';
        // Extract version and core name from output
        const version = versionLine.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] || 'unknown';
        const coreName = versionLine.includes('LLBDS') ? 'LLBDS' :
            versionLine.includes('PMMP') ? 'PMMP' :
                versionLine.includes('Bedrock') ? 'Bedrock' : 'Unknown';
        return { version, coreName };
    }
    parsePlayerList(output) {
        // Parse "list" command output for Bedrock
        const listLine = output.find(line => line.includes('players online')) || '';
        const match = listLine.match(/(\d+) of (\d+) players online/);
        return {
            onlinePlayers: match ? parseInt(match[1]) : 0,
            maxPlayers: match ? parseInt(match[2]) : 20
        };
    }
    parsePlayerNames(output) {
        // Extract player names from list command output
        const playerLine = output.find(line => line.includes(':'));
        if (!playerLine)
            return [];
        const namesSection = playerLine.split(':')[1];
        if (!namesSection)
            return [];
        return namesSection.split(',').map(name => name.trim()).filter(name => name.length > 0);
    }
    parsePerformanceInfo(output) {
        // Parse performance information from status command output
        // This is a simplified implementation
        return {
            tps: 20.0,
            cpuUsage: 0,
            memoryUsage: {
                used: 0,
                max: 0,
                free: 0,
                percentage: 0
            }
        };
    }
    async getWorldInfo() {
        // Get world information - simplified implementation for Bedrock
        return [{
                name: 'Bedrock level',
                dimension: 'overworld',
                playerCount: 0,
                loadedChunks: 0
            }];
    }
    async getBasicPlayerInfo(playerName) {
        // Get basic player information - simplified implementation
        return {
            id: playerName,
            name: playerName,
            displayName: playerName,
            world: 'Overworld',
            position: { x: 0, y: 0, z: 0 },
            ping: 0,
            isOp: false,
            permissions: [],
            edition: 'Bedrock',
            deviceType: 'Unknown'
        };
    }
    parseWhitelistEntries(output) {
        // Parse whitelist entries - simplified implementation
        return [];
    }
    parseBanEntries(output) {
        // Parse ban entries - simplified implementation
        return [];
    }
    parsePluginList(output) {
        // Parse PMMP plugin list - simplified implementation
        return [];
    }
    parseLLBDSPluginList(output) {
        // Parse LLBDS plugin list - simplified implementation
        return [];
    }
}
exports.BedrockConnectorBridge = BedrockConnectorBridge;
