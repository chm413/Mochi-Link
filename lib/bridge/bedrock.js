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
    /** Send a canonical U-WBP request when the adapter supports it. */
    async sendProtocolRequest(op, data = {}, timeout = 10000) {
        if (!this.connectionAdapter || typeof this.connectionAdapter.sendRequest !== 'function') {
            return null;
        }
        return this.connectionAdapter.sendRequest(op, data, timeout);
    }
    responseData(response) {
        const data = response?.data && typeof response.data === 'object' ? response.data : {};
        return data.result && typeof data.result === 'object' ? data.result : data;
    }
    normalizeMemory(value) {
        const memory = value && typeof value === 'object' ? value : {};
        const used = Number(memory.used ?? 0);
        const max = Number(memory.max ?? 0);
        const free = Number(memory.free ?? Math.max(0, max - used));
        const percentage = Number(memory.percentage ?? (max > 0 ? used / max * 100 : 0));
        return { used, max, free, percentage };
    }
    normalizePlayer(value) {
        if (!value || typeof value !== 'object' || !value.id || !value.name)
            return null;
        return {
            id: String(value.id),
            name: String(value.name),
            displayName: String(value.displayName ?? value.name),
            world: String(value.world ?? 'unknown'),
            position: {
                x: Number(value.position?.x ?? 0),
                y: Number(value.position?.y ?? 0),
                z: Number(value.position?.z ?? 0),
                ...(value.position?.yaw !== undefined ? { yaw: Number(value.position.yaw) } : {}),
                ...(value.position?.pitch !== undefined ? { pitch: Number(value.position.pitch) } : {})
            },
            ping: Math.max(0, Number(value.ping ?? 0)),
            isOp: Boolean(value.isOp),
            permissions: Array.isArray(value.permissions) ? value.permissions.map(String) : [],
            edition: 'Bedrock',
            ...(value.deviceType !== undefined ? { deviceType: String(value.deviceType) } : {}),
            ...(value.ipAddress !== undefined ? { ipAddress: String(value.ipAddress) } : {}),
            ...(value.health !== undefined ? { health: Number(value.health) } : {}),
            ...(value.level !== undefined ? { level: Number(value.level) } : {}),
            ...(value.gameMode !== undefined ? { gameMode: String(value.gameMode) } : {}),
            ...(value.isOnline !== undefined ? { isOnline: Boolean(value.isOnline) } : {})
        };
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
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('server.getInfo');
            const responsePayload = this.responseData(response);
            const info = responsePayload?.info || responsePayload;
            if (!info || typeof info !== 'object' || !info.serverId) {
                throw new types_1.BridgeConnectionError('Bedrock connector returned no server info', this.config.serverId);
            }
            let metrics = {};
            if (info.tps === undefined || info.memoryUsage === undefined) {
                try {
                    const metricsResponse = await this.sendProtocolRequest('server.getMetrics');
                    const metricsPayload = this.responseData(metricsResponse);
                    metrics = metricsPayload?.metrics || metricsPayload || {};
                }
                catch {
                    // Keep explicitly unavailable metric values rather than inventing a
                    // successful default record.
                }
            }
            return {
                serverId: String(info.serverId),
                name: String(info.name ?? this.config.serverId),
                version: String(info.version ?? this.config.coreVersion ?? 'unknown'),
                coreType: 'Bedrock',
                coreName: String(info.coreName ?? this.config.coreName ?? 'Bedrock'),
                maxPlayers: Number(info.maxPlayers ?? 0),
                onlinePlayers: Number(info.onlinePlayers ?? info.playerCount ?? 0),
                uptime: Number(info.uptime ?? 0),
                tps: Number(info.tps ?? metrics.tps ?? 0),
                memoryUsage: this.normalizeMemory(info.memoryUsage ?? metrics.memoryUsage),
                worldInfo: Array.isArray(info.worldInfo) ? info.worldInfo : [],
                ...(info.status !== undefined ? { status: String(info.status) } : {}),
                ...(info.online !== undefined ? { online: Boolean(info.online) } : {})
            };
        }
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
                // Bukkit/Bedrock command output does not expose a portable start time.
                // Do not derive uptime from two unrelated timestamps.
                uptime: 0,
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
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('server.getMetrics');
            const responsePayload = this.responseData(response);
            const metrics = responsePayload?.metrics || responsePayload;
            if (!metrics || typeof metrics !== 'object' || !metrics.serverId) {
                throw new types_1.BridgeConnectionError('Bedrock connector returned no performance metrics', this.config.serverId);
            }
            return {
                serverId: String(metrics.serverId),
                timestamp: Number(metrics.timestamp ?? Date.now()),
                tps: Number(metrics.tps ?? 0),
                cpuUsage: Number(metrics.cpuUsage ?? 0),
                memoryUsage: this.normalizeMemory(metrics.memoryUsage),
                playerCount: Number(metrics.playerCount ?? 0),
                ping: Number(metrics.ping ?? 0)
            };
        }
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
            throw new types_1.BridgeConnectionError(`Performance metrics are unavailable: ${error instanceof Error ? error.message : String(error)}`, this.config.serverId);
        }
    }
    async executeCommand(command, timeout = 10000) {
        this.requireConnection();
        try {
            const startTime = Date.now();
            const result = await this.connectionAdapter.sendCommand(command, timeout);
            const executionTime = Date.now() - startTime;
            const rawOutput = result?.output;
            const output = Array.isArray(rawOutput)
                ? rawOutput.map(String)
                : rawOutput === undefined || rawOutput === null
                    ? []
                    : String(rawOutput).split(/\r?\n/).filter(Boolean);
            return {
                success: result?.success === true,
                output,
                executionTime,
                error: result?.error
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
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('player.list');
            const responsePayload = this.responseData(response);
            if (!Array.isArray(responsePayload?.players)) {
                throw new types_1.BridgeConnectionError('Bedrock connector returned no player list', this.config.serverId);
            }
            return responsePayload.players
                .map((player) => this.normalizePlayer(player))
                .filter((player) => player !== null);
        }
        try {
            const listResult = await this.executeCommand('list');
            const playerNames = this.parsePlayerNames(listResult.output);
            const playerCount = this.parsePlayerList(listResult.output).onlinePlayers;
            if (playerCount <= 0) {
                return [];
            }
            // A player count without names is not enough to create player
            // identities. Do not manufacture `unknown-*` records.
            if (playerNames.length === 0)
                return [];
            const normalizedNames = playerNames.slice(0, playerCount);
            const players = [];
            // Get detailed info for each player (if possible)
            for (const name of normalizedNames) {
                try {
                    const player = await this.getBasicPlayerInfo(name);
                    if (player) {
                        players.push(player);
                    }
                }
                catch {
                    // The command path only provides a name. Keep the real identity and
                    // explicit unknown fields from getBasicPlayerInfo; never invent a
                    // world, device or position fallback here.
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
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('player.getInfo', { playerId });
            const responsePayload = this.responseData(response);
            const rawPlayer = responsePayload?.player || responsePayload?.playerInfo;
            const player = this.normalizePlayer(rawPlayer);
            if (!player)
                return null;
            return {
                ...player,
                ...(rawPlayer.firstJoinAt ? { firstJoinAt: new Date(rawPlayer.firstJoinAt) } : {}),
                ...(rawPlayer.lastSeenAt ? { lastSeenAt: new Date(rawPlayer.lastSeenAt) } : {}),
                ...(rawPlayer.totalPlayTime !== undefined
                    ? { totalPlayTime: Number(rawPlayer.totalPlayTime) }
                    : {}),
                ...(rawPlayer.identityConfidence !== undefined
                    ? { identityConfidence: Number(rawPlayer.identityConfidence) }
                    : {}),
                ...(rawPlayer.identityMarkers && typeof rawPlayer.identityMarkers === 'object'
                    ? { identityMarkers: rawPlayer.identityMarkers }
                    : {})
            };
        }
        return null;
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
            if (!gameruleResult.success) {
                throw new types_1.UnsupportedOperationError('world.getSettings', this.config.serverId, 'Bedrock');
            }
            this.parseGamerules(gameruleResult.output, gamerules);
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
        catch (error) {
            throw error instanceof types_1.UnsupportedOperationError
                ? error
                : new types_1.BridgeConnectionError(`World settings are unavailable: ${error instanceof Error ? error.message : String(error)}`, this.config.serverId);
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
                case 'shutdown':
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
        // Plugin enumeration is core-specific; never report an empty list as a
        // successful answer when the bridge has no defined command for this core.
        if (this.config.coreName.toLowerCase().includes('pmmp')) {
            const result = await this.executeCommand('plugins');
            if (!result.success) {
                throw new types_1.UnsupportedOperationError('plugin.list', this.config.serverId, this.config.coreName);
            }
            return this.parsePluginList(result.output);
        }
        if (this.config.coreName.toLowerCase().includes('llbds')) {
            const result = await this.executeCommand('ll list');
            if (!result.success) {
                throw new types_1.UnsupportedOperationError('plugin.list', this.config.serverId, this.config.coreName);
            }
            return this.parseLLBDSPluginList(result.output);
        }
        throw new types_1.UnsupportedOperationError('plugin.list', this.config.serverId, this.config.coreName);
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
        const listLine = output.find(line => line.toLowerCase().includes('players online')) || '';
        const match = listLine.match(/(\d+)\s+of\s+(?:a\s+max\s+of\s+)?(\d+)\s+players\s+online/i);
        return {
            onlinePlayers: match ? parseInt(match[1]) : 0,
            maxPlayers: match ? parseInt(match[2], 10) : 0
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
        const text = (output || []).join(' ');
        const tpsMatch = text.match(/\bTPS\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
        const cpuMatch = text.match(/\bCPU\b\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?/i);
        const memoryMatch = text.match(/(?:memory|mem)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:MB|MiB)?\s*(?:\/|of)\s*(\d+(?:\.\d+)?)\s*(?:MB|MiB)?/i);
        const used = memoryMatch ? Number(memoryMatch[1]) : 0;
        const max = memoryMatch ? Number(memoryMatch[2]) : 0;
        return {
            // Vanilla Bedrock does not expose TPS/CPU in a stable command format;
            // zero means "not reported" when the command itself succeeded.
            tps: tpsMatch ? Number(tpsMatch[1]) : 0,
            cpuUsage: cpuMatch ? Number(cpuMatch[1]) : 0,
            memoryUsage: {
                used,
                max,
                free: Math.max(0, max - used),
                percentage: max > 0 ? (used / max) * 100 : 0
            }
        };
    }
    async getWorldInfo() {
        // No portable Bedrock command reports loaded worlds/chunks. Keep the
        // collection empty until a connector supplies real world metadata.
        return [];
    }
    parseGamerules(output, target) {
        for (const line of output || []) {
            const match = line.match(/^\s*([A-Za-z0-9_]+)\s*[:=]\s*(.+?)\s*$/);
            if (!match)
                continue;
            const raw = match[2].trim();
            target[match[1]] = raw === 'true' ? true : raw === 'false' ? false :
                (raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw);
        }
    }
    getCapabilities() {
        const supported = super.getCapabilities();
        if (typeof this.connectionAdapter?.sendRequest !== 'function') {
            return supported;
        }
        const declared = Array.isArray(this.connectionAdapter.capabilities)
            ? this.connectionAdapter.capabilities.map(String)
            : [];
        return supported.filter(capability => declared.includes(capability));
    }
    hasCapability(capability) {
        return this.getCapabilities().includes(capability);
    }
    async getBasicPlayerInfo(playerName) {
        // Get basic player information - simplified implementation
        return {
            id: playerName,
            name: playerName,
            displayName: playerName,
            world: 'unknown',
            position: { x: 0, y: 0, z: 0 },
            ping: 0,
            isOp: false,
            permissions: [],
            edition: 'Bedrock',
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
