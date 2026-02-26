"use strict";
/**
 * LuckPerms Integration
 *
 * Integration with LuckPerms permission system to provide advanced permission
 * management, group handling, and context-aware permission checking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LuckPermsFactory = exports.LuckPermsPlugin = void 0;
const types_1 = require("../types");
class LuckPermsPlugin {
    constructor(config) {
        this.name = 'LuckPerms';
        this.type = 'luckperms';
        this.capabilities = ['permission_management', 'group_management'];
        this._isAvailable = false;
        this.bridge = config.bridge;
        this.serverId = config.serverId;
        this.version = '1.0.0'; // Will be updated during initialization
    }
    get isAvailable() {
        return this._isAvailable;
    }
    /**
     * Initialize the LuckPerms integration
     */
    async initialize() {
        try {
            const available = await this.checkAvailability();
            this._isAvailable = available;
        }
        catch (error) {
            console.error('Failed to initialize LuckPerms integration:', error);
            this._isAvailable = false;
        }
    }
    /**
     * Check if LuckPerms is available and functional
     */
    async checkAvailability() {
        try {
            // Try to execute a LuckPerms command to check if it's available
            const result = await this.bridge.executeCommand('lp info');
            return result.success && result.output.some(line => line.toLowerCase().includes('luckperms'));
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
            throw new types_1.PluginOperationError('luckperms', 'getPluginInfo', 'Plugin not available');
        }
        try {
            const result = await this.bridge.executeCommand('lp info');
            const versionLine = result.output.find(line => line.includes('version')) || '';
            const versionMatch = versionLine.match(/version\s+(\S+)/i);
            const version = versionMatch ? versionMatch[1] : 'unknown';
            return {
                name: 'LuckPerms',
                version,
                description: 'A permissions plugin for Minecraft servers',
                authors: ['Luck'],
                enabled: true,
                dependencies: [],
                apiVersion: '5.4.0'
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('luckperms', 'getPluginInfo', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get user permissions
     */
    async getUserPermissions(playerId) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('luckperms', 'getUserPermissions', 'Plugin not available');
        }
        try {
            // Get user info
            const userResult = await this.bridge.executeCommand(`lp user ${playerId} info`);
            const permissionsResult = await this.bridge.executeCommand(`lp user ${playerId} permission info`);
            const groupsResult = await this.bridge.executeCommand(`lp user ${playerId} parent info`);
            const userInfo = this.parseUserInfo(userResult.output);
            const permissions = this.parsePermissions(permissionsResult.output);
            const groups = await this.parseUserGroups(groupsResult.output);
            return {
                playerId,
                playerName: userInfo.name,
                permissions,
                groups,
                primaryGroup: userInfo.primaryGroup,
                prefix: userInfo.prefix,
                suffix: userInfo.suffix,
                metadata: userInfo.metadata
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('luckperms', 'getUserPermissions', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Check if user has a specific permission
     */
    async hasPermission(playerId, permission, context) {
        if (!this.isAvailable) {
            return false;
        }
        try {
            let command = `lp user ${playerId} haspermission ${permission}`;
            // Add context if provided
            if (context) {
                const contextParts = Object.entries(context)
                    .filter(([, value]) => value !== undefined)
                    .map(([key, value]) => `${key}=${value}`);
                if (contextParts.length > 0) {
                    command += ` ${contextParts.join(' ')}`;
                }
            }
            const result = await this.bridge.executeCommand(command);
            // Parse the result to determine if permission is granted
            return result.success && result.output.some(line => line.toLowerCase().includes('true') || line.toLowerCase().includes('granted'));
        }
        catch (error) {
            console.error(`Failed to check permission ${permission} for player ${playerId}:`, error);
            return false;
        }
    }
    /**
     * Get user's groups
     */
    async getUserGroups(playerId) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('luckperms', 'getUserGroups', 'Plugin not available');
        }
        try {
            const result = await this.bridge.executeCommand(`lp user ${playerId} parent info`);
            return this.parseUserGroups(result.output);
        }
        catch (error) {
            throw new types_1.PluginOperationError('luckperms', 'getUserGroups', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Add user to a group
     */
    async addUserToGroup(playerId, groupName, context) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('luckperms', 'addUserToGroup', 'Plugin not available');
        }
        try {
            let command = `lp user ${playerId} parent add ${groupName}`;
            // Add context if provided
            if (context) {
                const contextParts = Object.entries(context)
                    .filter(([, value]) => value !== undefined)
                    .map(([key, value]) => `${key}=${value}`);
                if (contextParts.length > 0) {
                    command += ` ${contextParts.join(' ')}`;
                }
            }
            const result = await this.bridge.executeCommand(command);
            return result.success && !result.output.some(line => line.toLowerCase().includes('error') || line.toLowerCase().includes('failed'));
        }
        catch (error) {
            throw new types_1.PluginOperationError('luckperms', 'addUserToGroup', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Remove user from a group
     */
    async removeUserFromGroup(playerId, groupName, context) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('luckperms', 'removeUserFromGroup', 'Plugin not available');
        }
        try {
            let command = `lp user ${playerId} parent remove ${groupName}`;
            // Add context if provided
            if (context) {
                const contextParts = Object.entries(context)
                    .filter(([, value]) => value !== undefined)
                    .map(([key, value]) => `${key}=${value}`);
                if (contextParts.length > 0) {
                    command += ` ${contextParts.join(' ')}`;
                }
            }
            const result = await this.bridge.executeCommand(command);
            return result.success && !result.output.some(line => line.toLowerCase().includes('error') || line.toLowerCase().includes('failed'));
        }
        catch (error) {
            throw new types_1.PluginOperationError('luckperms', 'removeUserFromGroup', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get all available groups
     */
    async getAllGroups() {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('luckperms', 'getAllGroups', 'Plugin not available');
        }
        try {
            const result = await this.bridge.executeCommand('lp listgroups');
            const groupNames = this.parseGroupList(result.output);
            // Get detailed information for each group
            const groups = [];
            for (const groupName of groupNames) {
                try {
                    const group = await this.getGroup(groupName);
                    if (group) {
                        groups.push(group);
                    }
                }
                catch (error) {
                    console.warn(`Failed to get details for group ${groupName}:`, error);
                }
            }
            return groups;
        }
        catch (error) {
            throw new types_1.PluginOperationError('luckperms', 'getAllGroups', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get group information
     */
    async getGroup(groupName) {
        if (!this.isAvailable) {
            return null;
        }
        try {
            const infoResult = await this.bridge.executeCommand(`lp group ${groupName} info`);
            const permissionsResult = await this.bridge.executeCommand(`lp group ${groupName} permission info`);
            const parentsResult = await this.bridge.executeCommand(`lp group ${groupName} parent info`);
            if (!infoResult.success) {
                return null;
            }
            const groupInfo = this.parseGroupInfo(infoResult.output);
            const permissions = this.parsePermissions(permissionsResult.output);
            const parents = this.parseParentGroups(parentsResult.output);
            return {
                name: groupName,
                displayName: groupInfo.displayName,
                weight: groupInfo.weight,
                permissions,
                parents,
                prefix: groupInfo.prefix,
                suffix: groupInfo.suffix,
                metadata: groupInfo.metadata
            };
        }
        catch (error) {
            console.error(`Failed to get group ${groupName}:`, error);
            return null;
        }
    }
    /**
     * Cleanup resources when shutting down
     */
    async cleanup() {
        this._isAvailable = false;
    }
    /**
     * Parse user information from command output
     */
    parseUserInfo(output) {
        let name = 'Unknown';
        let primaryGroup = 'default';
        let prefix;
        let suffix;
        const metadata = {};
        for (const line of output) {
            if (line.includes('Username:')) {
                const match = line.match(/Username:\s*(.+)/);
                if (match)
                    name = match[1].trim();
            }
            if (line.includes('Primary Group:')) {
                const match = line.match(/Primary Group:\s*(.+)/);
                if (match)
                    primaryGroup = match[1].trim();
            }
            if (line.includes('Prefix:')) {
                const match = line.match(/Prefix:\s*(.+)/);
                if (match)
                    prefix = match[1].trim();
            }
            if (line.includes('Suffix:')) {
                const match = line.match(/Suffix:\s*(.+)/);
                if (match)
                    suffix = match[1].trim();
            }
        }
        return { name, primaryGroup, prefix, suffix, metadata };
    }
    /**
     * Parse permissions from command output
     */
    parsePermissions(output) {
        const permissions = [];
        for (const line of output) {
            // Look for permission entries in the format: "permission.node: true/false"
            const match = line.match(/^\s*([a-zA-Z0-9._-]+):\s*(true|false)/);
            if (match) {
                const [, permission, valueStr] = match;
                const value = valueStr === 'true';
                permissions.push({
                    permission,
                    value,
                    source: 'user' // This would need more sophisticated parsing to determine actual source
                });
            }
        }
        return permissions;
    }
    /**
     * Parse user groups from command output
     */
    async parseUserGroups(output) {
        const groupNames = [];
        for (const line of output) {
            // Look for group entries
            const match = line.match(/^\s*-\s*([a-zA-Z0-9._-]+)/);
            if (match) {
                groupNames.push(match[1]);
            }
        }
        // Get detailed information for each group
        const groups = [];
        for (const groupName of groupNames) {
            const group = await this.getGroup(groupName);
            if (group) {
                groups.push(group);
            }
        }
        return groups;
    }
    /**
     * Parse group list from command output
     */
    parseGroupList(output) {
        const groups = [];
        for (const line of output) {
            // Look for group entries in list format
            const match = line.match(/^\s*-\s*([a-zA-Z0-9._-]+)/);
            if (match) {
                groups.push(match[1]);
            }
        }
        return groups;
    }
    /**
     * Parse group information from command output
     */
    parseGroupInfo(output) {
        let displayName;
        let weight = 0;
        let prefix;
        let suffix;
        const metadata = {};
        for (const line of output) {
            if (line.includes('Display Name:')) {
                const match = line.match(/Display Name:\s*(.+)/);
                if (match)
                    displayName = match[1].trim();
            }
            if (line.includes('Weight:')) {
                const match = line.match(/Weight:\s*(\d+)/);
                if (match)
                    weight = parseInt(match[1]);
            }
            if (line.includes('Prefix:')) {
                const match = line.match(/Prefix:\s*(.+)/);
                if (match)
                    prefix = match[1].trim();
            }
            if (line.includes('Suffix:')) {
                const match = line.match(/Suffix:\s*(.+)/);
                if (match)
                    suffix = match[1].trim();
            }
        }
        return { displayName, weight, prefix, suffix, metadata };
    }
    /**
     * Parse parent groups from command output
     */
    parseParentGroups(output) {
        const parents = [];
        for (const line of output) {
            const match = line.match(/^\s*-\s*([a-zA-Z0-9._-]+)/);
            if (match) {
                parents.push(match[1]);
            }
        }
        return parents;
    }
}
exports.LuckPermsPlugin = LuckPermsPlugin;
/**
 * Factory for creating LuckPerms integration instances
 */
class LuckPermsFactory {
    create(config) {
        return new LuckPermsPlugin(config);
    }
}
exports.LuckPermsFactory = LuckPermsFactory;
