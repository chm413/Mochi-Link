/**
 * LuckPerms Integration
 *
 * Integration with LuckPerms permission system to provide advanced permission
 * management, group handling, and context-aware permission checking.
 */
import { LuckPermsIntegration, PluginInfo, UserPermissions, Group, PermissionContext, PluginConfig, PluginIntegrationFactory, PluginCapability } from '../types';
export declare class LuckPermsPlugin implements LuckPermsIntegration {
    readonly name = "LuckPerms";
    readonly type: "luckperms";
    readonly version: string;
    readonly capabilities: PluginCapability[];
    private bridge;
    private serverId;
    private _isAvailable;
    constructor(config: PluginConfig);
    get isAvailable(): boolean;
    /**
     * Initialize the LuckPerms integration
     */
    initialize(): Promise<void>;
    /**
     * Check if LuckPerms is available and functional
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Get plugin information
     */
    getPluginInfo(): Promise<PluginInfo>;
    /**
     * Get user permissions
     */
    getUserPermissions(playerId: string): Promise<UserPermissions>;
    /**
     * Check if user has a specific permission
     */
    hasPermission(playerId: string, permission: string, context?: PermissionContext): Promise<boolean>;
    /**
     * Get user's groups
     */
    getUserGroups(playerId: string): Promise<Group[]>;
    /**
     * Add user to a group
     */
    addUserToGroup(playerId: string, groupName: string, context?: PermissionContext): Promise<boolean>;
    /**
     * Remove user from a group
     */
    removeUserFromGroup(playerId: string, groupName: string, context?: PermissionContext): Promise<boolean>;
    /**
     * Get all available groups
     */
    getAllGroups(): Promise<Group[]>;
    /**
     * Get group information
     */
    getGroup(groupName: string): Promise<Group | null>;
    /**
     * Cleanup resources when shutting down
     */
    cleanup(): Promise<void>;
    /**
     * Parse user information from command output
     */
    private parseUserInfo;
    /**
     * Parse permissions from command output
     */
    private parsePermissions;
    /**
     * Parse user groups from command output
     */
    private parseUserGroups;
    /**
     * Parse group list from command output
     */
    private parseGroupList;
    /**
     * Parse group information from command output
     */
    private parseGroupInfo;
    /**
     * Parse parent groups from command output
     */
    private parseParentGroups;
}
/**
 * Factory for creating LuckPerms integration instances
 */
export declare class LuckPermsFactory implements PluginIntegrationFactory {
    create(config: PluginConfig): LuckPermsPlugin;
}
