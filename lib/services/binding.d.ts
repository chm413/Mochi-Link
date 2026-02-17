/**
 * Mochi-Link (大福连) - Group-Server Binding Management Service
 *
 * This service manages the many-to-many binding relationships between
 * chat groups and Minecraft servers, including routing rules and monitoring.
 */
import { Context } from 'koishi';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
export type BindingType = 'chat' | 'event' | 'command' | 'monitoring';
export interface ServerBinding {
    id: number;
    groupId: string;
    serverId: string;
    bindingType: BindingType;
    config: BindingConfig;
    createdAt: Date;
    status: 'active' | 'inactive' | 'error';
    lastActivity?: Date;
}
export interface BindingConfig {
    chat?: {
        enabled: boolean;
        bidirectional: boolean;
        messageFormat?: string;
        filterRules?: MessageFilter[];
        rateLimiting?: {
            maxMessages: number;
            windowMs: number;
        };
    };
    event?: {
        enabled: boolean;
        eventTypes: string[];
        format?: string;
        filters?: EventFilter[];
    };
    command?: {
        enabled: boolean;
        allowedCommands: string[];
        requiredRole?: string;
        prefix?: string;
    };
    monitoring?: {
        enabled: boolean;
        alertTypes: string[];
        threshold?: any;
    };
}
export interface MessageFilter {
    type: 'regex' | 'keyword' | 'user' | 'length';
    pattern: string;
    action: 'allow' | 'block' | 'transform';
    replacement?: string;
}
export interface EventFilter {
    eventType: string;
    conditions?: any;
    action: 'allow' | 'block' | 'transform';
}
export interface BindingRoute {
    groupId: string;
    serverIds: string[];
    bindingType: BindingType;
    priority: number;
}
export interface BindingStats {
    totalBindings: number;
    activeBindings: number;
    bindingsByType: Record<BindingType, number>;
    bindingsByGroup: Record<string, number>;
    bindingsByServer: Record<string, number>;
    messageCount24h: number;
    errorCount24h: number;
}
export interface BindingCreateOptions {
    groupId: string;
    serverId: string;
    bindingType: BindingType;
    config: BindingConfig;
    priority?: number;
}
export interface BindingUpdateOptions {
    config?: Partial<BindingConfig>;
    bindingType?: BindingType;
    priority?: number;
}
export interface BindingQuery {
    groupId?: string;
    serverId?: string;
    bindingType?: BindingType;
    status?: 'active' | 'inactive' | 'error';
    limit?: number;
    offset?: number;
}
export declare class BindingManager {
    private ctx;
    private audit;
    private permission;
    private logger;
    private routingCache;
    private bindingCache;
    private statsCache;
    private statsCacheExpiry;
    constructor(ctx: Context, audit: AuditService, permission: PermissionManager);
    /**
     * Create a new group-server binding
     */
    createBinding(userId: string, options: BindingCreateOptions): Promise<ServerBinding>;
    /**
     * Update an existing binding
     */
    updateBinding(userId: string, bindingId: number, options: BindingUpdateOptions): Promise<ServerBinding>;
    /**
     * Delete a binding
     */
    deleteBinding(userId: string, bindingId: number): Promise<void>;
    /**
     * Get binding by ID
     */
    getBinding(bindingId: number): Promise<ServerBinding | null>;
    /**
     * Query bindings with filters
     */
    queryBindings(query: BindingQuery): Promise<{
        bindings: ServerBinding[];
        total: number;
    }>;
    /**
     * Get routing rules for a group
     */
    getGroupRoutes(groupId: string): Promise<BindingRoute[]>;
    /**
     * Get all servers bound to a group
     */
    getGroupServers(groupId: string, bindingType?: BindingType): Promise<string[]>;
    /**
     * Get all groups bound to a server
     */
    getServerGroups(serverId: string, bindingType?: BindingType): Promise<string[]>;
    /**
     * Check if a group-server binding exists
     */
    hasBinding(groupId: string, serverId: string, bindingType?: BindingType): Promise<boolean>;
    /**
     * Update binding activity timestamp
     */
    updateBindingActivity(groupId: string, serverId: string, bindingType: BindingType): Promise<void>;
    /**
     * Monitor binding health and update status
     */
    monitorBindingHealth(): Promise<void>;
    /**
     * Get binding statistics
     */
    getBindingStats(): Promise<BindingStats>;
    /**
     * Create multiple bindings in batch
     */
    createBindingsBatch(userId: string, bindings: BindingCreateOptions[]): Promise<ServerBinding[]>;
    /**
     * Delete multiple bindings by group
     */
    deleteGroupBindings(userId: string, groupId: string): Promise<number>;
    /**
     * Delete multiple bindings by server
     */
    deleteServerBindings(userId: string, serverId: string): Promise<number>;
    /**
     * Convert database binding to application model
     */
    private dbBindingToModel;
    /**
     * Get priority for binding type (higher = more important)
     */
    private getBindingTypePriority;
    /**
     * Clear all caches
     */
    private clearCaches;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
    /**
     * Cleanup service resources
     */
    cleanup(): Promise<void>;
}
