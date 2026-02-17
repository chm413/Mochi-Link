"use strict";
/**
 * Mochi-Link (大福连) - Group-Server Binding Management Service
 *
 * This service manages the many-to-many binding relationships between
 * chat groups and Minecraft servers, including routing rules and monitoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BindingManager = void 0;
const types_1 = require("../types");
// ============================================================================
// Binding Management Service
// ============================================================================
class BindingManager {
    constructor(ctx, audit, permission) {
        this.ctx = ctx;
        this.audit = audit;
        this.permission = permission;
        this.logger = this.ctx.logger('mochi-link:binding');
        this.routingCache = new Map();
        this.bindingCache = new Map();
        this.statsCache = null;
        this.statsCacheExpiry = 0;
    }
    // ============================================================================
    // Binding CRUD Operations
    // ============================================================================
    /**
     * Create a new group-server binding
     */
    async createBinding(userId, options) {
        this.logger.info(`Creating binding: group ${options.groupId} -> server ${options.serverId}`);
        // Check permissions
        const permissionResult = await this.permission.checkPermission(userId, options.serverId, 'binding.create');
        if (!permissionResult.granted) {
            throw new types_1.MochiLinkError(`User ${userId} lacks permission to create bindings for server ${options.serverId}`, 'PERMISSION_DENIED');
        }
        // Validate server exists
        const servers = await this.ctx.database.get('minecraft_servers', { id: options.serverId });
        if (servers.length === 0) {
            throw new types_1.MochiLinkError(`Server ${options.serverId} not found`, 'SERVER_NOT_FOUND');
        }
        // Check for duplicate binding
        const existing = await this.ctx.database.get('server_bindings', {
            group_id: options.groupId,
            server_id: options.serverId,
            binding_type: options.bindingType
        });
        if (existing.length > 0) {
            throw new types_1.MochiLinkError(`Binding already exists for group ${options.groupId} and server ${options.serverId} with type ${options.bindingType}`, 'BINDING_EXISTS');
        }
        // Create binding record
        const bindingData = {
            group_id: options.groupId,
            server_id: options.serverId,
            binding_type: options.bindingType,
            config: JSON.stringify(options.config),
            created_at: new Date()
        };
        await this.ctx.database.create('server_bindings', bindingData);
        // Get the created binding (since create doesn't return the created record)
        const createdBindings = await this.ctx.database.get('server_bindings', {
            group_id: options.groupId,
            server_id: options.serverId,
            binding_type: options.bindingType
        }, { sort: { created_at: 'desc' }, limit: 1 });
        if (createdBindings.length === 0) {
            throw new types_1.MochiLinkError('Failed to create binding', 'CREATION_FAILED');
        }
        const binding = createdBindings[0];
        // Convert to application model
        const serverBinding = this.dbBindingToModel(binding);
        // Clear caches
        this.clearCaches();
        // Audit log
        await this.audit.logger.logServerOperation(options.serverId, 'binding.create', {
            groupId: options.groupId,
            bindingType: options.bindingType,
            bindingId: binding.id
        }, 'success', undefined, {
            userId
        });
        this.logger.info(`Binding created successfully: ID ${binding.id}`);
        return serverBinding;
    }
    /**
     * Update an existing binding
     */
    async updateBinding(userId, bindingId, options) {
        this.logger.info(`Updating binding: ID ${bindingId}`);
        // Get existing binding
        const existingBindings = await this.ctx.database.get('server_bindings', { id: bindingId });
        if (existingBindings.length === 0) {
            throw new types_1.MochiLinkError(`Binding ${bindingId} not found`, 'BINDING_NOT_FOUND');
        }
        const existing = existingBindings[0];
        // Check permissions
        const permissionResult = await this.permission.checkPermission(userId, existing.server_id, 'binding.update');
        if (!permissionResult.granted) {
            throw new types_1.MochiLinkError(`User ${userId} lacks permission to update bindings for server ${existing.server_id}`, 'PERMISSION_DENIED');
        }
        // Merge configuration
        const currentConfig = typeof existing.config === 'string'
            ? JSON.parse(existing.config)
            : existing.config;
        const newConfig = { ...currentConfig, ...options.config };
        // Update binding
        const updateData = {
            config: JSON.stringify(newConfig)
        };
        if (options.bindingType) {
            updateData.binding_type = options.bindingType;
        }
        await this.ctx.database.set('server_bindings', bindingId, updateData);
        // Get updated binding
        const [updated] = await this.ctx.database.get('server_bindings', bindingId);
        const serverBinding = this.dbBindingToModel(updated);
        // Clear caches
        this.clearCaches();
        // Audit log
        await this.audit.logger.logServerOperation(existing.server_id, 'binding.update', {
            bindingId,
            changes: options
        }, 'success', undefined, {
            userId
        });
        this.logger.info(`Binding updated successfully: ID ${bindingId}`);
        return serverBinding;
    }
    /**
     * Delete a binding
     */
    async deleteBinding(userId, bindingId) {
        this.logger.info(`Deleting binding: ID ${bindingId}`);
        // Get existing binding
        const existingBindings = await this.ctx.database.get('server_bindings', { id: bindingId });
        if (existingBindings.length === 0) {
            throw new types_1.MochiLinkError(`Binding ${bindingId} not found`, 'BINDING_NOT_FOUND');
        }
        const existing = existingBindings[0];
        // Check permissions
        const permissionResult = await this.permission.checkPermission(userId, existing.server_id, 'binding.delete');
        if (!permissionResult.granted) {
            throw new types_1.MochiLinkError(`User ${userId} lacks permission to delete bindings for server ${existing.server_id}`, 'PERMISSION_DENIED');
        }
        // Delete binding
        await this.ctx.database.remove('server_bindings', bindingId);
        // Clear caches
        this.clearCaches();
        // Audit log
        await this.audit.logger.logServerOperation(existing.server_id, 'binding.delete', {
            bindingId,
            groupId: existing.group_id
        }, 'success', undefined, {
            userId
        });
        this.logger.info(`Binding deleted successfully: ID ${bindingId}`);
    }
    /**
     * Get binding by ID
     */
    async getBinding(bindingId) {
        const cached = this.bindingCache.get(`binding:${bindingId}`);
        if (cached) {
            return cached;
        }
        const bindings = await this.ctx.database.get('server_bindings', { id: bindingId });
        if (bindings.length === 0) {
            return null;
        }
        const binding = bindings[0];
        const serverBinding = this.dbBindingToModel(binding);
        this.bindingCache.set(`binding:${bindingId}`, serverBinding);
        return serverBinding;
    }
    /**
     * Query bindings with filters
     */
    async queryBindings(query) {
        const conditions = {};
        if (query.groupId)
            conditions.group_id = query.groupId;
        if (query.serverId)
            conditions.server_id = query.serverId;
        if (query.bindingType)
            conditions.binding_type = query.bindingType;
        // Get total count
        const allBindings = await this.ctx.database.get('server_bindings', conditions);
        const total = allBindings.length;
        // Get bindings with pagination
        const dbBindings = await this.ctx.database.get('server_bindings', conditions, {
            limit: query.limit || 50,
            offset: query.offset || 0,
            sort: { created_at: 'desc' }
        });
        const bindings = dbBindings.map(binding => this.dbBindingToModel(binding));
        return { bindings, total };
    }
    // ============================================================================
    // Routing Management
    // ============================================================================
    /**
     * Get routing rules for a group
     */
    async getGroupRoutes(groupId) {
        const cacheKey = `routes:${groupId}`;
        const cached = this.routingCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const bindings = await this.ctx.database.get('server_bindings', { group_id: groupId });
        // Group by binding type
        const routeMap = new Map();
        for (const binding of bindings) {
            const bindingType = binding.binding_type;
            if (!routeMap.has(bindingType)) {
                routeMap.set(bindingType, []);
            }
            routeMap.get(bindingType).push(binding.server_id);
        }
        // Convert to routes
        const routes = [];
        for (const [bindingType, serverIds] of routeMap) {
            routes.push({
                groupId,
                serverIds,
                bindingType,
                priority: this.getBindingTypePriority(bindingType)
            });
        }
        // Sort by priority
        routes.sort((a, b) => b.priority - a.priority);
        this.routingCache.set(cacheKey, routes);
        return routes;
    }
    /**
     * Get all servers bound to a group
     */
    async getGroupServers(groupId, bindingType) {
        const conditions = { group_id: groupId };
        if (bindingType) {
            conditions.binding_type = bindingType;
        }
        const bindings = await this.ctx.database.get('server_bindings', conditions);
        return [...new Set(bindings.map(b => b.server_id))];
    }
    /**
     * Get all groups bound to a server
     */
    async getServerGroups(serverId, bindingType) {
        const conditions = { server_id: serverId };
        if (bindingType) {
            conditions.binding_type = bindingType;
        }
        const bindings = await this.ctx.database.get('server_bindings', conditions);
        return [...new Set(bindings.map(b => b.group_id))];
    }
    /**
     * Check if a group-server binding exists
     */
    async hasBinding(groupId, serverId, bindingType) {
        const conditions = {
            group_id: groupId,
            server_id: serverId
        };
        if (bindingType) {
            conditions.binding_type = bindingType;
        }
        const bindings = await this.ctx.database.get('server_bindings', conditions);
        return bindings.length > 0;
    }
    // ============================================================================
    // Binding Status Monitoring
    // ============================================================================
    /**
     * Update binding activity timestamp
     */
    async updateBindingActivity(groupId, serverId, bindingType) {
        const binding = await this.ctx.database.get('server_bindings', {
            group_id: groupId,
            server_id: serverId,
            binding_type: bindingType
        });
        if (binding.length > 0) {
            // Update cache with activity timestamp
            const bindingId = binding[0].id;
            const cached = this.bindingCache.get(`binding:${bindingId}`);
            if (cached) {
                cached.lastActivity = new Date();
                cached.status = 'active';
            }
        }
    }
    /**
     * Monitor binding health and update status
     */
    async monitorBindingHealth() {
        this.logger.debug('Monitoring binding health...');
        const allBindings = await this.ctx.database.get('server_bindings', {});
        const now = Date.now();
        const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours
        for (const binding of allBindings) {
            const serverBinding = this.dbBindingToModel(binding);
            // Check if binding is inactive
            if (serverBinding.lastActivity) {
                const timeSinceActivity = now - serverBinding.lastActivity.getTime();
                if (timeSinceActivity > inactiveThreshold) {
                    serverBinding.status = 'inactive';
                }
            }
            // Update cache
            this.bindingCache.set(`binding:${binding.id}`, serverBinding);
        }
    }
    /**
     * Get binding statistics
     */
    async getBindingStats() {
        const now = Date.now();
        if (this.statsCache && now < this.statsCacheExpiry) {
            return this.statsCache;
        }
        const allBindings = await this.ctx.database.get('server_bindings', {});
        const stats = {
            totalBindings: allBindings.length,
            activeBindings: 0,
            bindingsByType: {
                chat: 0,
                event: 0,
                command: 0,
                monitoring: 0
            },
            bindingsByGroup: {},
            bindingsByServer: {},
            messageCount24h: 0, // Would need to track this separately
            errorCount24h: 0 // Would need to track this separately
        };
        for (const binding of allBindings) {
            const serverBinding = this.dbBindingToModel(binding);
            if (serverBinding.status === 'active') {
                stats.activeBindings++;
            }
            // Count by type
            stats.bindingsByType[serverBinding.bindingType]++;
            // Count by group
            stats.bindingsByGroup[serverBinding.groupId] =
                (stats.bindingsByGroup[serverBinding.groupId] || 0) + 1;
            // Count by server
            stats.bindingsByServer[serverBinding.serverId] =
                (stats.bindingsByServer[serverBinding.serverId] || 0) + 1;
        }
        // Cache for 5 minutes
        this.statsCache = stats;
        this.statsCacheExpiry = now + 5 * 60 * 1000;
        return stats;
    }
    // ============================================================================
    // Batch Operations
    // ============================================================================
    /**
     * Create multiple bindings in batch
     */
    async createBindingsBatch(userId, bindings) {
        this.logger.info(`Creating ${bindings.length} bindings in batch`);
        const results = [];
        const errors = [];
        for (const binding of bindings) {
            try {
                const result = await this.createBinding(userId, binding);
                results.push(result);
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            this.logger.warn(`Batch binding creation completed with ${errors.length} errors`);
        }
        return results;
    }
    /**
     * Delete multiple bindings by group
     */
    async deleteGroupBindings(userId, groupId) {
        this.logger.info(`Deleting all bindings for group ${groupId}`);
        const bindings = await this.ctx.database.get('server_bindings', { group_id: groupId });
        let deletedCount = 0;
        for (const binding of bindings) {
            try {
                await this.deleteBinding(userId, binding.id);
                deletedCount++;
            }
            catch (error) {
                this.logger.warn(`Failed to delete binding ${binding.id}:`, error);
            }
        }
        this.logger.info(`Deleted ${deletedCount} bindings for group ${groupId}`);
        return deletedCount;
    }
    /**
     * Delete multiple bindings by server
     */
    async deleteServerBindings(userId, serverId) {
        this.logger.info(`Deleting all bindings for server ${serverId}`);
        const bindings = await this.ctx.database.get('server_bindings', { server_id: serverId });
        let deletedCount = 0;
        for (const binding of bindings) {
            try {
                await this.deleteBinding(userId, binding.id);
                deletedCount++;
            }
            catch (error) {
                this.logger.warn(`Failed to delete binding ${binding.id}:`, error);
            }
        }
        this.logger.info(`Deleted ${deletedCount} bindings for server ${serverId}`);
        return deletedCount;
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Convert database binding to application model
     */
    dbBindingToModel(dbBinding) {
        return {
            id: dbBinding.id,
            groupId: dbBinding.group_id,
            serverId: dbBinding.server_id,
            bindingType: dbBinding.binding_type,
            config: typeof dbBinding.config === 'string'
                ? JSON.parse(dbBinding.config)
                : dbBinding.config,
            createdAt: dbBinding.created_at,
            status: 'active', // Default status, would be determined by monitoring
            lastActivity: undefined // Would be tracked separately
        };
    }
    /**
     * Get priority for binding type (higher = more important)
     */
    getBindingTypePriority(bindingType) {
        const priorities = {
            command: 100,
            monitoring: 80,
            event: 60,
            chat: 40
        };
        return priorities[bindingType] || 0;
    }
    /**
     * Clear all caches
     */
    clearCaches() {
        this.routingCache.clear();
        this.bindingCache.clear();
        this.statsCache = null;
        this.statsCacheExpiry = 0;
    }
    // ============================================================================
    // Health Check
    // ============================================================================
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            // Test database connectivity
            await this.ctx.database.get('server_bindings', {}, { limit: 1 });
            const stats = await this.getBindingStats();
            return {
                status: 'healthy',
                details: {
                    totalBindings: stats.totalBindings,
                    activeBindings: stats.activeBindings,
                    cacheSize: this.bindingCache.size
                }
            };
        }
        catch (error) {
            this.logger.error('Health check failed:', error);
            return {
                status: 'unhealthy',
                details: { error: error.message }
            };
        }
    }
    /**
     * Cleanup service resources
     */
    async cleanup() {
        this.logger.info('Cleaning up binding manager...');
        this.clearCaches();
    }
}
exports.BindingManager = BindingManager;
