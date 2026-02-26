"use strict";
/**
 * PlaceholderAPI Integration
 *
 * Integration with PlaceholderAPI (PAPI) to provide dynamic placeholder resolution
 * for server information, player data, and custom placeholders.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceholderAPIFactory = exports.PlaceholderAPIPlugin = void 0;
const types_1 = require("../types");
class PlaceholderAPIPlugin {
    constructor(config) {
        this.name = 'PlaceholderAPI';
        this.type = 'placeholderapi';
        this.capabilities = ['placeholder_resolution'];
        this._isAvailable = false;
        this.placeholderHandlers = new Map();
        this.bridge = config.bridge;
        this.serverId = config.serverId;
        this.version = '1.0.0'; // Will be updated during initialization
    }
    get isAvailable() {
        return this._isAvailable;
    }
    /**
     * Initialize the PlaceholderAPI integration
     */
    async initialize() {
        try {
            // Check if PlaceholderAPI is available on the server
            const available = await this.checkAvailability();
            this._isAvailable = available;
            if (available) {
                // Register built-in placeholders
                await this.registerBuiltInPlaceholders();
            }
        }
        catch (error) {
            console.error('Failed to initialize PlaceholderAPI integration:', error);
            this._isAvailable = false;
        }
    }
    /**
     * Check if PlaceholderAPI is available and functional
     */
    async checkAvailability() {
        try {
            // Try to execute a PAPI command to check if it's available
            const result = await this.bridge.executeCommand('papi version');
            return result.success && result.output.some(line => line.toLowerCase().includes('placeholderapi'));
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
            throw new types_1.PluginOperationError('placeholderapi', 'getPluginInfo', 'Plugin not available');
        }
        try {
            const result = await this.bridge.executeCommand('papi version');
            const versionLine = result.output.find(line => line.includes('version')) || '';
            const versionMatch = versionLine.match(/version\s+(\S+)/i);
            const version = versionMatch ? versionMatch[1] : 'unknown';
            return {
                name: 'PlaceholderAPI',
                version,
                description: 'A resource that allows plugins to hook into other plugins and display information',
                authors: ['clip', 'Glare'],
                enabled: true,
                dependencies: [],
                apiVersion: '2.11.0'
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('placeholderapi', 'getPluginInfo', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Resolve a placeholder for a specific player
     */
    async resolvePlaceholder(playerId, placeholder) {
        if (!this.isAvailable) {
            return null;
        }
        try {
            // Check if we have a local handler for this placeholder
            const localHandler = this.findLocalHandler(placeholder);
            if (localHandler) {
                return await localHandler(playerId, this.extractPlaceholderParams(placeholder));
            }
            // Use PAPI parse command to resolve the placeholder
            const command = `papi parse ${playerId} ${placeholder}`;
            const result = await this.bridge.executeCommand(command);
            if (result.success && result.output.length > 0) {
                const resolved = result.output[0].trim();
                // Return null if placeholder wasn't resolved (still contains %)
                return resolved.includes('%') ? null : resolved;
            }
            return null;
        }
        catch (error) {
            console.error(`Failed to resolve placeholder ${placeholder} for player ${playerId}:`, error);
            return null;
        }
    }
    /**
     * Resolve multiple placeholders for a player
     */
    async resolvePlaceholders(playerId, placeholders) {
        const results = {};
        // Process placeholders in batches to avoid overwhelming the server
        const batchSize = 10;
        for (let i = 0; i < placeholders.length; i += batchSize) {
            const batch = placeholders.slice(i, i + batchSize);
            const batchPromises = batch.map(async (placeholder) => {
                const result = await this.resolvePlaceholder(playerId, placeholder);
                return { placeholder, result };
            });
            const batchResults = await Promise.allSettled(batchPromises);
            for (const promiseResult of batchResults) {
                if (promiseResult.status === 'fulfilled') {
                    const { placeholder, result } = promiseResult.value;
                    results[placeholder] = result;
                }
            }
        }
        return results;
    }
    /**
     * Get all available placeholders
     */
    async getAvailablePlaceholders() {
        if (!this.isAvailable) {
            return [];
        }
        try {
            const result = await this.bridge.executeCommand('papi list');
            const placeholders = [];
            for (const line of result.output) {
                const match = line.match(/^\s*-\s*(\w+):\s*(.+)$/);
                if (match) {
                    const [, identifier, description] = match;
                    placeholders.push({
                        identifier,
                        plugin: 'PlaceholderAPI',
                        description: description.trim()
                    });
                }
            }
            // Add built-in placeholders
            placeholders.push(...this.getBuiltInPlaceholders());
            return placeholders;
        }
        catch (error) {
            console.error('Failed to get available placeholders:', error);
            return this.getBuiltInPlaceholders();
        }
    }
    /**
     * Register a custom placeholder
     */
    async registerPlaceholder(identifier, handler) {
        try {
            this.placeholderHandlers.set(identifier, handler);
            return true;
        }
        catch (error) {
            console.error(`Failed to register placeholder ${identifier}:`, error);
            return false;
        }
    }
    /**
     * Cleanup resources when shutting down
     */
    async cleanup() {
        this.placeholderHandlers.clear();
        this._isAvailable = false;
    }
    /**
     * Register built-in placeholders for Mochi-Link
     */
    async registerBuiltInPlaceholders() {
        // Server information placeholders
        this.registerPlaceholder('mochilink_server_name', async () => {
            const serverInfo = await this.bridge.getServerInfo();
            return serverInfo.name;
        });
        this.registerPlaceholder('mochilink_server_tps', async () => {
            const serverInfo = await this.bridge.getServerInfo();
            return serverInfo.tps.toFixed(2);
        });
        this.registerPlaceholder('mochilink_server_players', async () => {
            const serverInfo = await this.bridge.getServerInfo();
            return serverInfo.onlinePlayers.toString();
        });
        this.registerPlaceholder('mochilink_server_max_players', async () => {
            const serverInfo = await this.bridge.getServerInfo();
            return serverInfo.maxPlayers.toString();
        });
        // Player-specific placeholders
        this.registerPlaceholder('mochilink_player_ping', async (playerId) => {
            const players = await this.bridge.getOnlinePlayers();
            const player = players.find(p => p.id === playerId || p.name === playerId);
            return player ? player.ping.toString() : '0';
        });
        this.registerPlaceholder('mochilink_player_world', async (playerId) => {
            const players = await this.bridge.getOnlinePlayers();
            const player = players.find(p => p.id === playerId || p.name === playerId);
            return player ? player.world : 'unknown';
        });
    }
    /**
     * Get built-in placeholder information
     */
    getBuiltInPlaceholders() {
        return [
            {
                identifier: 'mochilink_server_name',
                plugin: 'MochiLink',
                description: 'Server display name'
            },
            {
                identifier: 'mochilink_server_tps',
                plugin: 'MochiLink',
                description: 'Current server TPS'
            },
            {
                identifier: 'mochilink_server_players',
                plugin: 'MochiLink',
                description: 'Current online player count'
            },
            {
                identifier: 'mochilink_server_max_players',
                plugin: 'MochiLink',
                description: 'Maximum player count'
            },
            {
                identifier: 'mochilink_player_ping',
                plugin: 'MochiLink',
                description: 'Player ping in milliseconds'
            },
            {
                identifier: 'mochilink_player_world',
                plugin: 'MochiLink',
                description: 'Player current world name'
            }
        ];
    }
    /**
     * Find a local placeholder handler
     */
    findLocalHandler(placeholder) {
        // Remove % symbols and extract identifier
        const cleanPlaceholder = placeholder.replace(/%/g, '');
        const identifier = cleanPlaceholder.split('_')[0] + '_' + cleanPlaceholder.split('_')[1] + '_' + cleanPlaceholder.split('_')[2];
        return this.placeholderHandlers.get(identifier) || null;
    }
    /**
     * Extract parameters from a placeholder
     */
    extractPlaceholderParams(placeholder) {
        const cleanPlaceholder = placeholder.replace(/%/g, '');
        const parts = cleanPlaceholder.split('_');
        return parts.length > 3 ? parts.slice(3).join('_') : '';
    }
}
exports.PlaceholderAPIPlugin = PlaceholderAPIPlugin;
/**
 * Factory for creating PlaceholderAPI integration instances
 */
class PlaceholderAPIFactory {
    create(config) {
        return new PlaceholderAPIPlugin(config);
    }
}
exports.PlaceholderAPIFactory = PlaceholderAPIFactory;
