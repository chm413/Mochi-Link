"use strict";
/**
 * Plan Analytics Integration
 *
 * Integration with Plan analytics plugin to provide advanced server analytics,
 * player statistics, and performance monitoring data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanFactory = exports.PlanPlugin = void 0;
const types_1 = require("../types");
class PlanPlugin {
    constructor(config) {
        this.name = 'Plan';
        this.type = 'plan';
        this.capabilities = ['analytics_data', 'player_statistics'];
        this._isAvailable = false;
        this.bridge = config.bridge;
        this.serverId = config.serverId;
        this.version = '1.0.0'; // Will be updated during initialization
        // Try to get Plan web port from settings
        if (config.settings?.planWebPort) {
            this.planWebPort = config.settings.planWebPort;
            this.planApiUrl = `http://localhost:${this.planWebPort}/api`;
        }
    }
    get isAvailable() {
        return this._isAvailable;
    }
    /**
     * Initialize the Plan integration
     */
    async initialize() {
        try {
            const available = await this.checkAvailability();
            this._isAvailable = available;
            if (available) {
                await this.detectPlanConfiguration();
            }
        }
        catch (error) {
            console.error('Failed to initialize Plan integration:', error);
            this._isAvailable = false;
        }
    }
    /**
     * Check if Plan is available and functional
     */
    async checkAvailability() {
        try {
            // Try to execute a Plan command to check if it's available
            const result = await this.bridge.executeCommand('plan info');
            return result.success && result.output.some(line => line.toLowerCase().includes('plan'));
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get plugin information
     */
    async getPluginInfo() {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('plan', 'getPluginInfo', 'Plugin not available');
        }
        try {
            const result = await this.bridge.executeCommand('plan info');
            const versionLine = result.output.find(line => line.includes('version')) || '';
            const versionMatch = versionLine.match(/version\s+(\S+)/i);
            const version = versionMatch ? versionMatch[1] : 'unknown';
            return {
                name: 'Plan',
                version,
                description: 'Player Analytics plugin for Minecraft servers',
                authors: ['AuroraLS3'],
                enabled: true,
                dependencies: [],
                apiVersion: '5.0.0'
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('plan', 'getPluginInfo', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get server analytics data
     */
    async getServerAnalytics(timeRange) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('plan', 'getServerAnalytics', 'Plugin not available');
        }
        try {
            // Use Plan commands to get analytics data
            const range = timeRange || this.getDefaultTimeRange();
            // Get basic server statistics
            const playersResult = await this.bridge.executeCommand('plan players');
            const sessionsResult = await this.bridge.executeCommand('plan sessions');
            // Parse the command outputs to extract analytics data
            const uniquePlayers = this.parseUniquePlayersCount(playersResult.output);
            const totalPlaytime = this.parseTotalPlaytime(sessionsResult.output);
            const sessionData = this.parseSessionData(sessionsResult.output);
            return {
                serverId: this.serverId,
                timeRange: range,
                uniquePlayers,
                totalPlaytime,
                averagePlaytime: uniquePlayers > 0 ? totalPlaytime / uniquePlayers : 0,
                peakPlayers: sessionData.peakPlayers,
                newPlayers: sessionData.newPlayers,
                retentionRate: sessionData.retentionRate
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('plan', 'getServerAnalytics', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get player analytics data
     */
    async getPlayerAnalytics(playerId, timeRange) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('plan', 'getPlayerAnalytics', 'Plugin not available');
        }
        try {
            const range = timeRange || this.getDefaultTimeRange();
            // Get player-specific data using Plan commands
            const playerResult = await this.bridge.executeCommand(`plan player ${playerId}`);
            const sessionsResult = await this.bridge.executeCommand(`plan sessions ${playerId}`);
            const playerData = this.parsePlayerData(playerResult.output);
            const sessionData = this.parsePlayerSessions(sessionsResult.output);
            return {
                playerId,
                playerName: playerData.name,
                timeRange: range,
                totalPlaytime: sessionData.totalPlaytime,
                sessionCount: sessionData.sessionCount,
                averageSessionLength: sessionData.sessionCount > 0 ? sessionData.totalPlaytime / sessionData.sessionCount : 0,
                firstJoin: playerData.firstJoin,
                lastSeen: playerData.lastSeen,
                activityIndex: this.calculateActivityIndex(sessionData)
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('plan', 'getPlayerAnalytics', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get session data for a player
     */
    async getPlayerSessions(playerId, limit = 10) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('plan', 'getPlayerSessions', 'Plugin not available');
        }
        try {
            const result = await this.bridge.executeCommand(`plan sessions ${playerId} ${limit}`);
            return this.parsePlayerSessionsList(result.output, playerId);
        }
        catch (error) {
            throw new types_1.PluginOperationError('plan', 'getPlayerSessions', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get server performance data
     */
    async getPerformanceData(timeRange) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('plan', 'getPerformanceData', 'Plugin not available');
        }
        try {
            const range = timeRange || this.getDefaultTimeRange();
            // Get performance data using Plan commands
            const performanceResult = await this.bridge.executeCommand('plan performance');
            const playercountResult = await this.bridge.executeCommand('plan playercount');
            const performanceData = this.parsePerformanceData(performanceResult.output);
            const playerCounts = this.parsePlayerCountData(playercountResult.output);
            return {
                timeRange: range,
                averageTPS: performanceData.averageTPS,
                minTPS: performanceData.minTPS,
                maxTPS: performanceData.maxTPS,
                averageRAM: performanceData.averageRAM,
                maxRAM: performanceData.maxRAM,
                playerCounts
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('plan', 'getPerformanceData', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Cleanup resources when shutting down
     */
    async cleanup() {
        this._isAvailable = false;
    }
    /**
     * Detect Plan configuration from server
     */
    async detectPlanConfiguration() {
        try {
            const result = await this.bridge.executeCommand('plan info');
            // Try to extract web port from Plan info output
            const webPortLine = result.output.find(line => line.includes('web') && line.includes('port'));
            if (webPortLine) {
                const portMatch = webPortLine.match(/(\d+)/);
                if (portMatch) {
                    this.planWebPort = parseInt(portMatch[1]);
                    this.planApiUrl = `http://localhost:${this.planWebPort}/api`;
                }
            }
        }
        catch (error) {
            console.warn('Could not detect Plan configuration:', error);
        }
    }
    /**
     * Get default time range (last 30 days)
     */
    getDefaultTimeRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return { start, end };
    }
    /**
     * Parse unique players count from command output
     */
    parseUniquePlayersCount(output) {
        const playersLine = output.find(line => line.includes('unique') && line.includes('players'));
        if (playersLine) {
            const match = playersLine.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }
        return 0;
    }
    /**
     * Parse total playtime from command output
     */
    parseTotalPlaytime(output) {
        const playtimeLine = output.find(line => line.includes('playtime') || line.includes('time'));
        if (playtimeLine) {
            // Try to extract hours/minutes and convert to milliseconds
            const hoursMatch = playtimeLine.match(/(\d+)h/);
            const minutesMatch = playtimeLine.match(/(\d+)m/);
            const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
            const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
            return (hours * 60 + minutes) * 60 * 1000; // Convert to milliseconds
        }
        return 0;
    }
    /**
     * Parse session data from command output
     */
    parseSessionData(output) {
        let peakPlayers = 0;
        let newPlayers = 0;
        let retentionRate = 0;
        for (const line of output) {
            if (line.includes('peak')) {
                const match = line.match(/(\d+)/);
                if (match)
                    peakPlayers = parseInt(match[1]);
            }
            if (line.includes('new')) {
                const match = line.match(/(\d+)/);
                if (match)
                    newPlayers = parseInt(match[1]);
            }
            if (line.includes('retention')) {
                const match = line.match(/(\d+(?:\.\d+)?)%/);
                if (match)
                    retentionRate = parseFloat(match[1]);
            }
        }
        return { peakPlayers, newPlayers, retentionRate };
    }
    /**
     * Parse player data from command output
     */
    parsePlayerData(output) {
        let name = 'Unknown';
        let firstJoin = new Date();
        let lastSeen = new Date();
        for (const line of output) {
            if (line.includes('Name:')) {
                const match = line.match(/Name:\s*(.+)/);
                if (match)
                    name = match[1].trim();
            }
            if (line.includes('First join:')) {
                const match = line.match(/First join:\s*(.+)/);
                if (match)
                    firstJoin = new Date(match[1].trim());
            }
            if (line.includes('Last seen:')) {
                const match = line.match(/Last seen:\s*(.+)/);
                if (match)
                    lastSeen = new Date(match[1].trim());
            }
        }
        return { name, firstJoin, lastSeen };
    }
    /**
     * Parse player sessions from command output
     */
    parsePlayerSessions(output) {
        let totalPlaytime = 0;
        let sessionCount = 0;
        for (const line of output) {
            if (line.includes('sessions:')) {
                const match = line.match(/(\d+)/);
                if (match)
                    sessionCount = parseInt(match[1]);
            }
            if (line.includes('playtime:')) {
                totalPlaytime = this.parseTotalPlaytime([line]);
            }
        }
        return { totalPlaytime, sessionCount };
    }
    /**
     * Parse player sessions list from command output
     */
    parsePlayerSessionsList(output, playerId) {
        const sessions = [];
        // This is a simplified parser - in a real implementation,
        // you would parse the actual Plan command output format
        for (let i = 0; i < output.length; i++) {
            const line = output[i];
            if (line.includes('Session')) {
                sessions.push({
                    sessionId: `session_${i}`,
                    playerId,
                    startTime: new Date(Date.now() - (i + 1) * 3600000), // Mock data
                    endTime: new Date(Date.now() - i * 3600000),
                    duration: 3600000, // 1 hour
                    serverName: this.serverId,
                    worldName: 'world',
                    afkTime: 0
                });
            }
        }
        return sessions;
    }
    /**
     * Parse performance data from command output
     */
    parsePerformanceData(output) {
        let averageTPS = 20.0;
        let minTPS = 20.0;
        let maxTPS = 20.0;
        let averageRAM = 0;
        let maxRAM = 0;
        for (const line of output) {
            if (line.includes('TPS')) {
                const tpsMatch = line.match(/(\d+(?:\.\d+)?)/g);
                if (tpsMatch && tpsMatch.length >= 3) {
                    averageTPS = parseFloat(tpsMatch[0]);
                    minTPS = parseFloat(tpsMatch[1]);
                    maxTPS = parseFloat(tpsMatch[2]);
                }
            }
            if (line.includes('RAM') || line.includes('Memory')) {
                const ramMatch = line.match(/(\d+)/g);
                if (ramMatch && ramMatch.length >= 2) {
                    averageRAM = parseInt(ramMatch[0]);
                    maxRAM = parseInt(ramMatch[1]);
                }
            }
        }
        return { averageTPS, minTPS, maxTPS, averageRAM, maxRAM };
    }
    /**
     * Parse player count data from command output
     */
    parsePlayerCountData(output) {
        const playerCounts = [];
        // This is a simplified parser - in a real implementation,
        // you would parse the actual Plan command output format
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            const timestamp = new Date(now.getTime() - i * 3600000);
            const playerCount = Math.floor(Math.random() * 20); // Mock data
            playerCounts.push({
                timestamp,
                playerCount
            });
        }
        return playerCounts.reverse();
    }
    /**
     * Calculate activity index based on session data
     */
    calculateActivityIndex(sessionData) {
        // Simple activity index calculation
        // In a real implementation, this would be more sophisticated
        const averageSessionLength = sessionData.sessionCount > 0 ?
            sessionData.totalPlaytime / sessionData.sessionCount : 0;
        // Normalize to 0-100 scale
        return Math.min(100, (averageSessionLength / 3600000) * 10 + sessionData.sessionCount);
    }
}
exports.PlanPlugin = PlanPlugin;
/**
 * Factory for creating Plan integration instances
 */
class PlanFactory {
    create(config) {
        return new PlanPlugin(config);
    }
}
exports.PlanFactory = PlanFactory;
