/**
 * Mochi-Link (大福连) - Permission Management Service
 * 
 * This file implements the comprehensive permission management system that integrates
 * with Koishi's permission system and provides server-specific permission control.
 */

import { Context, User } from 'koishi';
import { ACLOperations, AuditOperations } from '../database/operations';
import { ServerRole, Permission, ServerACL, PermissionDeniedError } from '../types';

// ============================================================================
// Permission Management Types
// ============================================================================

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

// ============================================================================
// Role Definitions
// ============================================================================

export const DEFAULT_ROLES: Record<ServerRole, RoleDefinition> = {
  owner: {
    name: 'owner',
    permissions: ['*'], // All permissions
    description: 'Server owner with full administrative access'
  },
  admin: {
    name: 'admin',
    permissions: [
      'server.manage',
      'server.restart',
      'server.stop',
      'server.command',
      'player.manage',
      'player.kick',
      'player.ban',
      'player.unban',
      'whitelist.manage',
      'whitelist.add',
      'whitelist.remove',
      'console.access',
      'monitoring.view'
    ],
    inherits: ['moderator'],
    description: 'Server administrator with extensive management permissions'
  },
  moderator: {
    name: 'moderator',
    permissions: [
      'player.kick',
      'player.message',
      'whitelist.view',
      'monitoring.view',
      'console.view'
    ],
    inherits: ['viewer'],
    description: 'Server moderator with player management permissions'
  },
  viewer: {
    name: 'viewer',
    permissions: [
      'server.view',
      'player.view',
      'monitoring.view'
    ],
    description: 'Read-only access to server information'
  }
};

// ============================================================================
// Permission Manager Class
// ============================================================================

export class PermissionManager {
  private aclOps: ACLOperations;
  private auditOps: AuditOperations;
  private roleDefinitions: Map<ServerRole, RoleDefinition>;

  constructor(private ctx: Context) {
    this.aclOps = new ACLOperations(ctx);
    this.auditOps = new AuditOperations(ctx);
    this.roleDefinitions = new Map(Object.entries(DEFAULT_ROLES) as [ServerRole, RoleDefinition][]);
  }

  // ============================================================================
  // Core Permission Checking
  // ============================================================================

  /**
   * Check if user has permission for a specific operation on a server
   */
  async checkPermission(
    userId: string, 
    serverId: string, 
    operation: string
  ): Promise<PermissionCheckResult> {
    try {
      // Format permission as "serverId.operation"
      const permissionKey = `${serverId}.${operation}`;
      
      // First check Koishi's built-in permission system
      const koishiPermission = await this.checkKoishiPermission(userId, permissionKey);
      if (koishiPermission.granted) {
        return koishiPermission;
      }

      // Then check our ACL system
      const aclPermission = await this.checkACLPermission(userId, serverId, operation);
      if (aclPermission.granted) {
        return aclPermission;
      }

      // Check if user is server owner
      const ownerPermission = await this.checkOwnerPermission(userId, serverId);
      if (ownerPermission.granted) {
        return ownerPermission;
      }

      return {
        granted: false,
        reason: `User ${userId} lacks permission for operation ${operation} on server ${serverId}`
      };

    } catch (error) {
      this.ctx.logger('mochi-link:permission').error('Permission check failed:', error);
      return {
        granted: false,
        reason: `Permission check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check permission and throw error if denied
   */
  async requirePermission(
    userId: string, 
    serverId: string, 
    operation: string,
    context?: Partial<PermissionContext>
  ): Promise<void> {
    const result = await this.checkPermission(userId, serverId, operation);
    
    if (!result.granted) {
      // Log permission denial
      await this.auditOps.logOperation(
        userId,
        serverId,
        'permission.denied',
        { operation, reason: result.reason },
        'failure',
        result.reason,
        context?.ipAddress,
        context?.userAgent
      );

      throw new PermissionDeniedError(
        result.reason || `Permission denied for operation ${operation}`,
        userId,
        serverId,
        operation
      );
    }

    // Log successful permission check
    await this.auditOps.logOperation(
      userId,
      serverId,
      'permission.granted',
      { operation, role: result.role, inheritedFrom: result.inheritedFrom },
      'success',
      undefined,
      context?.ipAddress,
      context?.userAgent
    );
  }

  /**
   * Check multiple permissions at once
   */
  async checkMultiplePermissions(
    userId: string,
    serverId: string,
    operations: string[]
  ): Promise<Record<string, PermissionCheckResult>> {
    const results: Record<string, PermissionCheckResult> = {};
    
    for (const operation of operations) {
      results[operation] = await this.checkPermission(userId, serverId, operation);
    }
    
    return results;
  }

  // ============================================================================
  // Koishi Permission Integration
  // ============================================================================

  /**
   * Check Koishi's built-in permission system
   */
  private async checkKoishiPermission(
    userId: string, 
    permissionKey: string
  ): Promise<PermissionCheckResult> {
    try {
      // For Koishi integration, we'll use a simplified approach
      // In a real implementation, you would parse the userId to get platform and pid
      // For now, we'll assume the userId format is "platform:pid" or just use a default platform
      
      const [platform, pid] = userId.includes(':') ? userId.split(':', 2) : ['default', userId];
      
      // Get user from Koishi
      const user = await this.ctx.database.getUser(platform, pid);
      if (!user) {
        return { granted: false, reason: 'User not found' };
      }

      // Check if user has the permission in Koishi's system
      const hasPermission = user.authority >= 1 && 
        (user.permissions?.includes(permissionKey) || user.permissions?.includes('*'));

      if (hasPermission) {
        return {
          granted: true,
          reason: 'Granted by Koishi permission system',
          inheritedFrom: 'koishi'
        };
      }

      return { granted: false, reason: 'Not granted by Koishi permission system' };

    } catch (error) {
      this.ctx.logger('mochi-link:permission').error('Koishi permission check failed:', error);
      return { granted: false, reason: 'Koishi permission check failed' };
    }
  }

  /**
   * Grant permission in Koishi's system
   */
  async grantKoishiPermission(
    userId: string, 
    serverId: string, 
    operation: string,
    grantedBy: string
  ): Promise<void> {
    const permissionKey = `${serverId}.${operation}`;
    
    try {
      const [platform, pid] = userId.includes(':') ? userId.split(':', 2) : ['default', userId];
      
      const user = await this.ctx.database.getUser(platform, pid);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const permissions = user.permissions || [];
      if (!permissions.includes(permissionKey)) {
        permissions.push(permissionKey);
        await this.ctx.database.setUser(platform, pid, { permissions });
      }

      // Log the permission grant
      await this.auditOps.logOperation(
        grantedBy,
        serverId,
        'permission.koishi.grant',
        { targetUserId: userId, operation, permissionKey },
        'success',
        undefined
      );

    } catch (error) {
      await this.auditOps.logOperation(
        grantedBy,
        serverId,
        'permission.koishi.grant',
        { targetUserId: userId, operation, permissionKey },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Revoke permission in Koishi's system
   */
  async revokeKoishiPermission(
    userId: string, 
    serverId: string, 
    operation: string,
    revokedBy: string
  ): Promise<void> {
    const permissionKey = `${serverId}.${operation}`;
    
    try {
      const [platform, pid] = userId.includes(':') ? userId.split(':', 2) : ['default', userId];
      
      const user = await this.ctx.database.getUser(platform, pid);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const permissions = user.permissions || [];
      const filteredPermissions = permissions.filter(p => p !== permissionKey);
      
      if (filteredPermissions.length !== permissions.length) {
        await this.ctx.database.setUser(platform, pid, { permissions: filteredPermissions });
      }

      // Log the permission revocation
      await this.auditOps.logOperation(
        revokedBy,
        serverId,
        'permission.koishi.revoke',
        { targetUserId: userId, operation, permissionKey },
        'success',
        undefined
      );

    } catch (error) {
      await this.auditOps.logOperation(
        revokedBy,
        serverId,
        'permission.koishi.revoke',
        { targetUserId: userId, operation, permissionKey },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  // ============================================================================
  // ACL Permission System
  // ============================================================================

  /**
   * Check ACL-based permissions
   */
  private async checkACLPermission(
    userId: string, 
    serverId: string, 
    operation: string
  ): Promise<PermissionCheckResult> {
    const acl = await this.aclOps.getACL(userId, serverId);
    
    if (!acl) {
      return { granted: false, reason: 'No ACL entry found' };
    }

    // Check if ACL is expired
    if (acl.expiresAt && acl.expiresAt < new Date()) {
      return { granted: false, reason: 'ACL entry has expired' };
    }

    // Check direct permission
    const permissionKey = `${serverId}.${operation}`;
    if (acl.permissions.includes(permissionKey) || acl.permissions.includes('*')) {
      return {
        granted: true,
        reason: 'Granted by direct ACL permission',
        role: acl.role
      };
    }

    // Check role-based permissions
    const rolePermissions = await this.getRolePermissions(acl.role, serverId);
    if (rolePermissions.includes(operation) || rolePermissions.includes('*')) {
      return {
        granted: true,
        reason: 'Granted by role-based permission',
        role: acl.role,
        inheritedFrom: acl.role
      };
    }

    return { granted: false, reason: 'Operation not permitted by ACL or role' };
  }

  /**
   * Check if user is server owner
   */
  private async checkOwnerPermission(
    userId: string, 
    serverId: string
  ): Promise<PermissionCheckResult> {
    try {
      const servers = await this.ctx.database.get('minecraft_servers', { 
        id: serverId, 
        owner_id: userId 
      });

      if (servers.length > 0) {
        return {
          granted: true,
          reason: 'User is server owner',
          role: 'owner'
        };
      }

      return { granted: false, reason: 'User is not server owner' };

    } catch (error) {
      return { granted: false, reason: 'Owner check failed' };
    }
  }

  // ============================================================================
  // Role Management
  // ============================================================================

  /**
   * Assign role to user for server
   */
  async assignRole(
    userId: string,
    serverId: string,
    role: ServerRole,
    grantedBy: string,
    expiresAt?: Date
  ): Promise<ServerACL> {
    try {
      // Get role permissions
      const rolePermissions = await this.getRolePermissions(role, serverId);
      
      // Create or update ACL
      const acl = await this.aclOps.grantPermission(
        userId,
        serverId,
        role,
        rolePermissions,
        grantedBy,
        expiresAt
      );

      // Log role assignment
      await this.auditOps.logOperation(
        grantedBy,
        serverId,
        'role.assign',
        { targetUserId: userId, role, expiresAt },
        'success'
      );

      return acl;

    } catch (error) {
      await this.auditOps.logOperation(
        grantedBy,
        serverId,
        'role.assign',
        { targetUserId: userId, role, error: (error as Error).message },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Remove role from user for server
   */
  async removeRole(
    userId: string,
    serverId: string,
    removedBy: string
  ): Promise<boolean> {
    try {
      const success = await this.aclOps.revokePermission(userId, serverId);

      // Log role removal
      await this.auditOps.logOperation(
        removedBy,
        serverId,
        'role.remove',
        { targetUserId: userId },
        success ? 'success' : 'failure'
      );

      return success;

    } catch (error) {
      await this.auditOps.logOperation(
        removedBy,
        serverId,
        'role.remove',
        { targetUserId: userId, error: (error as Error).message },
        'error',
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Get user's role for server
   */
  async getUserRole(userId: string, serverId: string): Promise<ServerRole | null> {
    // Check if user is owner
    const ownerCheck = await this.checkOwnerPermission(userId, serverId);
    if (ownerCheck.granted) {
      return 'owner';
    }

    // Check ACL
    const acl = await this.aclOps.getACL(userId, serverId);
    return acl?.role || null;
  }

  /**
   * Get all users with roles for server
   */
  async getServerUsers(serverId: string): Promise<Array<{
    userId: string;
    role: ServerRole;
    grantedBy: string;
    grantedAt: Date;
    expiresAt?: Date;
  }>> {
    const acls = await this.aclOps.getServerACLs(serverId);
    
    // Add server owner
    const servers = await this.ctx.database.get('minecraft_servers', { id: serverId });
    const result = [];

    if (servers.length > 0) {
      result.push({
        userId: servers[0].owner_id,
        role: 'owner' as ServerRole,
        grantedBy: 'system',
        grantedAt: servers[0].created_at
      });
    }

    // Add ACL users
    for (const acl of acls) {
      result.push({
        userId: acl.userId,
        role: acl.role,
        grantedBy: acl.grantedBy,
        grantedAt: acl.grantedAt,
        expiresAt: acl.expiresAt
      });
    }

    return result;
  }

  /**
   * Get user's permissions for server
   */
  async getUserPermissions(userId: string, serverId: string): Promise<Permission[]> {
    const permissions: Permission[] = [];

    // Check owner permissions
    const ownerCheck = await this.checkOwnerPermission(userId, serverId);
    if (ownerCheck.granted) {
      permissions.push({
        serverId,
        operation: '*',
        granted: true,
        inheritedFrom: 'owner'
      });
      return permissions;
    }

    // Check ACL permissions
    const acl = await this.aclOps.getACL(userId, serverId);
    if (acl) {
      const rolePermissions = await this.getRolePermissions(acl.role, serverId);
      
      for (const operation of rolePermissions) {
        permissions.push({
          serverId,
          operation,
          granted: true,
          inheritedFrom: acl.role
        });
      }
    }

    return permissions;
  }

  // ============================================================================
  // Role Definition Management
  // ============================================================================

  /**
   * Get permissions for a role
   */
  async getRolePermissions(role: ServerRole, serverId: string): Promise<string[]> {
    const roleDefinition = this.roleDefinitions.get(role);
    if (!roleDefinition) {
      return [];
    }

    let permissions = [...roleDefinition.permissions];

    // Add inherited permissions
    if (roleDefinition.inherits) {
      for (const inheritedRole of roleDefinition.inherits) {
        const inheritedPermissions = await this.getRolePermissions(inheritedRole, serverId);
        permissions = [...permissions, ...inheritedPermissions];
      }
    }

    // Convert generic permissions to server-specific format
    return permissions.map(permission => {
      if (permission === '*') {
        return '*';
      }
      return permission.includes('.') ? permission : `${serverId}.${permission}`;
    });
  }

  /**
   * Define or update a role
   */
  defineRole(role: ServerRole, definition: RoleDefinition): void {
    this.roleDefinitions.set(role, definition);
  }

  /**
   * Get role definition
   */
  getRoleDefinition(role: ServerRole): RoleDefinition | undefined {
    return this.roleDefinitions.get(role);
  }

  /**
   * Get all role definitions
   */
  getAllRoleDefinitions(): Map<ServerRole, RoleDefinition> {
    return new Map(this.roleDefinitions);
  }

  // ============================================================================
  // Permission Inheritance
  // ============================================================================

  /**
   * Check if role inherits from another role
   */
  roleInheritsFrom(role: ServerRole, parentRole: ServerRole): boolean {
    const roleDefinition = this.roleDefinitions.get(role);
    if (!roleDefinition || !roleDefinition.inherits) {
      return false;
    }

    if (roleDefinition.inherits.includes(parentRole)) {
      return true;
    }

    // Check recursive inheritance
    for (const inheritedRole of roleDefinition.inherits) {
      if (this.roleInheritsFrom(inheritedRole, parentRole)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get role hierarchy for a role
   */
  getRoleHierarchy(role: ServerRole): ServerRole[] {
    const hierarchy: ServerRole[] = [role];
    const roleDefinition = this.roleDefinitions.get(role);
    
    if (roleDefinition?.inherits) {
      for (const inheritedRole of roleDefinition.inherits) {
        hierarchy.push(...this.getRoleHierarchy(inheritedRole));
      }
    }

    return [...new Set(hierarchy)]; // Remove duplicates
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Validate permission format
   */
  validatePermissionFormat(permission: string): boolean {
    // Permission should be in format "serverId.operation" or "*"
    if (permission === '*') {
      return true;
    }

    const parts = permission.split('.');
    return parts.length >= 2 && 
           parts.every(part => part.length > 0 && part.trim() === part && !part.includes(' '));
  }

  /**
   * Parse permission string
   */
  parsePermission(permission: string): { serverId: string; operation: string } | null {
    if (permission === '*') {
      return { serverId: '*', operation: '*' };
    }

    const dotIndex = permission.indexOf('.');
    if (dotIndex === -1) {
      return null;
    }

    return {
      serverId: permission.substring(0, dotIndex),
      operation: permission.substring(dotIndex + 1)
    };
  }

  /**
   * Format permission string
   */
  formatPermission(serverId: string, operation: string): string {
    if (serverId === '*' && operation === '*') {
      return '*';
    }
    return `${serverId}.${operation}`;
  }

  /**
   * Get permission manager health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      aclOperational: boolean;
      koishiIntegration: boolean;
      roleDefinitions: number;
    };
  }> {
    try {
      // Test ACL operations
      const testACLs = await this.aclOps.getUserACLs('health-check-user');
      const aclOperational = Array.isArray(testACLs);

      // Test Koishi integration
      let koishiIntegration = false;
      try {
        await this.ctx.database.getUser('default', 'health-check-user');
        koishiIntegration = true;
      } catch (error) {
        // Expected for non-existent user
        koishiIntegration = true;
      }

      const status = aclOperational && koishiIntegration ? 'healthy' : 'degraded';

      return {
        status,
        details: {
          aclOperational,
          koishiIntegration,
          roleDefinitions: this.roleDefinitions.size
        }
      };

    } catch (error) {
      this.ctx.logger('mochi-link:permission').error('Permission health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          aclOperational: false,
          koishiIntegration: false,
          roleDefinitions: this.roleDefinitions.size
        }
      };
    }
  }
}