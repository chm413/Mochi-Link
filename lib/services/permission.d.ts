/**
 * Mochi-Link (大福连) - Permission Management Service
 *
 * This file implements the comprehensive permission management system that integrates
 * with Koishi's permission system and provides server-specific permission control.
 */
import { Context } from 'koishi';
import { ServerRole, Permission, ServerACL } from '../types';
export interface PermissionCheckResult {
    granted: boolean;
    reason?: string;
    inheritedFrom?: string;
    role?: ServerRole;
}
export interface RoleDefinition {
    name: ServerRole;
    permissions: string[];
    inherits?: ServerRole[];
    description: string;
}
export interface PermissionContext {
    userId: string;
    serverId: string;
    operation: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}
export declare const DEFAULT_ROLES: Record<ServerRole, RoleDefinition>;
export declare class PermissionManager {
    private ctx;
    private aclOps;
    private auditOps;
    private roleDefinitions;
    constructor(ctx: Context);
    /**
     * Check if user has permission for a specific operation on a server
     */
    checkPermission(userId: string, serverId: string, operation: string): Promise<PermissionCheckResult>;
    /**
     * Check permission and throw error if denied
     */
    requirePermission(userId: string, serverId: string, operation: string, context?: Partial<PermissionContext>): Promise<void>;
    /**
     * Check multiple permissions at once
     */
    checkMultiplePermissions(userId: string, serverId: string, operations: string[]): Promise<Record<string, PermissionCheckResult>>;
    /**
     * Check Koishi's built-in permission system
     */
    private checkKoishiPermission;
    /**
     * Grant permission in Koishi's system
     */
    grantKoishiPermission(userId: string, serverId: string, operation: string, grantedBy: string): Promise<void>;
    /**
     * Revoke permission in Koishi's system
     */
    revokeKoishiPermission(userId: string, serverId: string, operation: string, revokedBy: string): Promise<void>;
    /**
     * Check ACL-based permissions
     */
    private checkACLPermission;
    /**
     * Check if user is server owner
     */
    private checkOwnerPermission;
    /**
     * Assign role to user for server
     */
    assignRole(userId: string, serverId: string, role: ServerRole, grantedBy: string, expiresAt?: Date): Promise<ServerACL>;
    /**
     * Remove role from user for server
     */
    removeRole(userId: string, serverId: string, removedBy: string): Promise<boolean>;
    /**
     * Get user's role for server
     */
    getUserRole(userId: string, serverId: string): Promise<ServerRole | null>;
    /**
     * Get all users with roles for server
     */
    getServerUsers(serverId: string): Promise<Array<{
        userId: string;
        role: ServerRole;
        grantedBy: string;
        grantedAt: Date;
        expiresAt?: Date;
    }>>;
    /**
     * Get user's permissions for server
     */
    getUserPermissions(userId: string, serverId: string): Promise<Permission[]>;
    /**
     * Get permissions for a role
     */
    getRolePermissions(role: ServerRole, serverId: string): Promise<string[]>;
    /**
     * Define or update a role
     */
    defineRole(role: ServerRole, definition: RoleDefinition): void;
    /**
     * Get role definition
     */
    getRoleDefinition(role: ServerRole): RoleDefinition | undefined;
    /**
     * Get all role definitions
     */
    getAllRoleDefinitions(): Map<ServerRole, RoleDefinition>;
    /**
     * Check if role inherits from another role
     */
    roleInheritsFrom(role: ServerRole, parentRole: ServerRole): boolean;
    /**
     * Get role hierarchy for a role
     */
    getRoleHierarchy(role: ServerRole): ServerRole[];
    /**
     * Validate permission format
     */
    validatePermissionFormat(permission: string): boolean;
    /**
     * Parse permission string
     */
    parsePermission(permission: string): {
        serverId: string;
        operation: string;
    } | null;
    /**
     * Format permission string
     */
    formatPermission(serverId: string, operation: string): string;
    /**
     * Get permission manager health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: {
            aclOperational: boolean;
            koishiIntegration: boolean;
            roleDefinitions: number;
        };
    }>;
}
