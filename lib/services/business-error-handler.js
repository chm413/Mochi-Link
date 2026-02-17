"use strict";
/**
 * Business Logic Error Handler
 *
 * Handles business logic errors including permission failures, data sync conflicts,
 * and server unavailability with appropriate degradation strategies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessErrorHandler = void 0;
const events_1 = require("events");
// ============================================================================
// Business Error Handler Service
// ============================================================================
class BusinessErrorHandler extends events_1.EventEmitter {
    constructor(ctx, auditService, config = {}) {
        super();
        this.ctx = ctx;
        this.maintenanceSchedule = new Map();
        this.cachedOperations = new Map();
        this.conflictHistory = new Map();
        this.setMaxListeners(50);
        this.config = {
            maxPermissionRetries: 3,
            permissionRetryInterval: 5000,
            serverUnavailableTimeout: 30000,
            maxUnavailableRetries: 5,
            conflictResolutionStrategy: 'server_wins',
            maxConflictRetries: 3,
            enableGracefulDegradation: true,
            degradationTimeout: 60000,
            maxCachedOperations: 100,
            cacheExpirationTime: 3600000, // 1 hour
            ...config
        };
        this.auditService = auditService;
    }
    // ============================================================================
    // Permission Error Handling
    // ============================================================================
    /**
     * Handle permission denied errors with retry and escalation
     */
    async handlePermissionDenied(userId, serverId, operation, error) {
        const logger = this.ctx.logger('mochi-link:business-error');
        // Log permission denial
        await this.auditService.logger.logPermissionDenied(userId, serverId, operation);
        logger.warn(`Permission denied for user ${userId} on server ${serverId}: ${operation}`);
        // Check if this is a configuration issue
        const isConfigIssue = await this.checkPermissionConfiguration(userId, serverId);
        if (isConfigIssue) {
            this.emit('permissionConfigurationError', userId, serverId, operation);
            // Attempt automatic permission refresh
            this.emit('refreshUserPermissions', userId, serverId);
        }
        else {
            // Check for repeated permission denials
            const denialCount = await this.getPermissionDenialCount(userId, serverId);
            if (denialCount >= this.config.maxPermissionRetries) {
                this.emit('permissionEscalation', userId, serverId, operation, denialCount);
            }
        }
        this.emit('permissionDenied', userId, serverId, operation, error);
    }
    /**
     * Handle permission configuration refresh
     */
    async refreshPermissions(userId, serverId) {
        const logger = this.ctx.logger('mochi-link:business-error');
        try {
            logger.info(`Refreshing permissions for user ${userId} on server ${serverId}`);
            // Emit event for permission refresh
            this.emit('permissionRefreshRequired', userId, serverId);
            // Log the refresh attempt
            await this.auditService.logger.logSuccess('permission.refresh', { userId, serverId }, { userId, serverId });
        }
        catch (error) {
            logger.error(`Failed to refresh permissions for ${userId}:`, error);
            await this.auditService.logger.logError('permission.refresh', { userId, serverId }, error instanceof Error ? error : new Error(String(error)), { userId, serverId });
        }
    }
    // ============================================================================
    // Server Unavailability Handling
    // ============================================================================
    /**
     * Handle server unavailable errors with caching and degradation
     */
    async handleServerUnavailable(serverId, operation, operationData, error) {
        const logger = this.ctx.logger('mochi-link:business-error');
        // Check if this is planned maintenance
        const maintenanceStatus = await this.getMaintenanceStatus(serverId);
        if (maintenanceStatus.isPlanned) {
            logger.info(`Server ${serverId} is under planned maintenance`);
            // Check if operation is allowed during maintenance
            if (maintenanceStatus.allowedOperations.includes(operation)) {
                this.emit('maintenanceOperationAllowed', serverId, operation);
                return;
            }
            else {
                this.emit('maintenanceOperationBlocked', serverId, operation, maintenanceStatus);
            }
        }
        // Log server unavailable
        await this.auditService.logger.logError('server.unavailable', {
            operation,
            operationData,
            error: error.message
        }, error, { serverId });
        logger.warn(`Server ${serverId} unavailable for operation: ${operation}`);
        // Check if operation can be cached
        if (this.isCacheableOperation(operation)) {
            await this.cacheOperation(serverId, operation, operationData);
            this.emit('operationCached', serverId, operation);
        }
        else if (this.config.enableGracefulDegradation) {
            // Attempt graceful degradation
            await this.attemptGracefulDegradation(serverId, operation, operationData);
        }
        else {
            this.emit('serverUnavailable', serverId, operation, error);
        }
    }
    /**
     * Cache operation for later execution
     */
    async cacheOperation(serverId, operation, operationData) {
        const cached = this.cachedOperations.get(serverId) || [];
        // Check cache limits
        if (cached.length >= this.config.maxCachedOperations) {
            // Remove oldest operation
            cached.shift();
        }
        const pendingOp = {
            id: Date.now(),
            serverId,
            operationType: operation,
            target: operationData.target || 'unknown',
            parameters: operationData,
            status: 'pending',
            createdAt: new Date(),
            scheduledAt: new Date()
        };
        cached.push(pendingOp);
        this.cachedOperations.set(serverId, cached);
        // Set expiration timer
        setTimeout(() => {
            this.expireCachedOperation(serverId, pendingOp.id);
        }, this.config.cacheExpirationTime);
    }
    /**
     * Attempt graceful degradation for unavailable server
     */
    async attemptGracefulDegradation(serverId, operation, operationData) {
        const logger = this.ctx.logger('mochi-link:business-error');
        logger.info(`Attempting graceful degradation for ${serverId}: ${operation}`);
        // Define degradation strategies
        const degradationStrategies = {
            'player.kick': async () => {
                // For player kick, we can't degrade - it's critical
                this.emit('degradationFailed', serverId, operation, 'Critical operation cannot be degraded');
            },
            'server.broadcast': async () => {
                // For broadcast, we can queue it or send to available servers
                this.emit('broadcastDegraded', serverId, operationData.message);
            },
            'whitelist.add': async () => {
                // Cache whitelist operations
                await this.cacheOperation(serverId, operation, operationData);
            },
            'whitelist.remove': async () => {
                // Cache whitelist operations
                await this.cacheOperation(serverId, operation, operationData);
            }
        };
        const strategy = degradationStrategies[operation];
        if (strategy) {
            try {
                await strategy();
                this.emit('degradationSuccessful', serverId, operation);
            }
            catch (error) {
                this.emit('degradationFailed', serverId, operation, error);
            }
        }
        else {
            this.emit('degradationNotAvailable', serverId, operation);
        }
    }
    // ============================================================================
    // Data Sync Conflict Resolution
    // ============================================================================
    /**
     * Handle data synchronization conflicts
     */
    async handleSyncConflict(conflict) {
        const logger = this.ctx.logger('mochi-link:business-error');
        logger.warn(`Sync conflict detected for ${conflict.serverId}: ${conflict.type}`);
        // Log sync conflict
        await this.auditService.logger.logError('sync.conflict', {
            conflictType: conflict.type,
            conflictData: conflict.conflictData,
            severity: conflict.severity
        }, new Error(`Sync conflict: ${conflict.type}`), { serverId: conflict.serverId });
        // Store conflict in history
        const history = this.conflictHistory.get(conflict.serverId) || [];
        history.push(conflict);
        this.conflictHistory.set(conflict.serverId, history);
        // Resolve based on type and strategy
        const resolution = await this.resolveConflict(conflict);
        this.emit('syncConflictResolved', conflict, resolution);
        return resolution;
    }
    /**
     * Resolve specific conflict based on type and strategy
     */
    async resolveConflict(conflict) {
        const strategy = this.config.conflictResolutionStrategy;
        switch (conflict.type) {
            case 'whitelist_mismatch':
                return this.resolveWhitelistConflict(conflict, strategy);
            case 'player_identity_conflict':
                return this.resolvePlayerIdentityConflict(conflict, strategy);
            case 'operation_conflict':
                return this.resolveOperationConflict(conflict, strategy);
            case 'data_version_conflict':
                return this.resolveDataVersionConflict(conflict, strategy);
            default:
                return {
                    strategy: 'manual',
                    requiresManualIntervention: true,
                    resolutionSteps: ['Unknown conflict type - manual intervention required']
                };
        }
    }
    /**
     * Resolve whitelist conflicts
     */
    async resolveWhitelistConflict(conflict, strategy) {
        switch (strategy) {
            case 'server_wins':
                return {
                    strategy: 'server_wins',
                    requiresManualIntervention: false,
                    resolutionSteps: [
                        'Server whitelist takes precedence',
                        'Client whitelist will be updated to match server',
                        'Conflicting entries will be resolved in favor of server data'
                    ]
                };
            case 'client_wins':
                return {
                    strategy: 'client_wins',
                    requiresManualIntervention: false,
                    resolutionSteps: [
                        'Client whitelist takes precedence',
                        'Server whitelist will be updated to match client',
                        'Conflicting entries will be resolved in favor of client data'
                    ]
                };
            case 'merge':
                return {
                    strategy: 'merge',
                    requiresManualIntervention: false,
                    resolutionSteps: [
                        'Merge both whitelists',
                        'Add all unique entries from both sources',
                        'Remove duplicates based on player ID'
                    ]
                };
            default:
                return {
                    strategy: 'manual',
                    requiresManualIntervention: true,
                    resolutionSteps: [
                        'Manual review required',
                        'Compare server and client whitelists',
                        'Decide which entries to keep or merge'
                    ]
                };
        }
    }
    /**
     * Resolve player identity conflicts
     */
    async resolvePlayerIdentityConflict(conflict, strategy) {
        // Player identity conflicts usually require manual intervention
        return {
            strategy: 'manual',
            requiresManualIntervention: true,
            resolutionSteps: [
                'Player identity conflict detected',
                'Multiple players with same name but different UUIDs',
                'Manual verification required to determine correct identity',
                'Consider using additional identifiers (IP, device, etc.)'
            ]
        };
    }
    /**
     * Resolve operation conflicts
     */
    async resolveOperationConflict(conflict, strategy) {
        const operations = conflict.conflictData.operations || [];
        // Look for contradictory operations
        const contradictory = this.findContradictoryOperations(operations);
        if (contradictory.length > 0) {
            return {
                strategy: 'merge',
                requiresManualIntervention: false,
                resolutionSteps: [
                    'Remove contradictory operations',
                    'Keep the most recent operation for each target',
                    'Optimize operation sequence'
                ]
            };
        }
        return {
            strategy: 'merge',
            requiresManualIntervention: false,
            resolutionSteps: [
                'Merge operation sequences',
                'Remove duplicates',
                'Maintain chronological order'
            ]
        };
    }
    /**
     * Resolve data version conflicts
     */
    async resolveDataVersionConflict(conflict, strategy) {
        switch (strategy) {
            case 'server_wins':
                return {
                    strategy: 'server_wins',
                    requiresManualIntervention: false,
                    resolutionSteps: [
                        'Server data version takes precedence',
                        'Client data will be updated to match server version',
                        'Local changes may be lost'
                    ]
                };
            default:
                return {
                    strategy: 'manual',
                    requiresManualIntervention: true,
                    resolutionSteps: [
                        'Data version conflict requires manual review',
                        'Compare data versions and changes',
                        'Determine which version to keep or how to merge'
                    ]
                };
        }
    }
    // ============================================================================
    // Maintenance Management
    // ============================================================================
    /**
     * Set planned maintenance for a server
     */
    async setPlannedMaintenance(serverId, maintenance) {
        this.maintenanceSchedule.set(serverId, {
            ...maintenance,
            isPlanned: true
        });
        await this.auditService.logger.logSuccess('maintenance.scheduled', {
            serverId,
            startTime: maintenance.startTime,
            estimatedEndTime: maintenance.estimatedEndTime,
            reason: maintenance.reason
        }, { serverId });
        this.emit('maintenanceScheduled', serverId, maintenance);
    }
    /**
     * Clear planned maintenance for a server
     */
    async clearPlannedMaintenance(serverId) {
        this.maintenanceSchedule.delete(serverId);
        await this.auditService.logger.logSuccess('maintenance.cleared', { serverId }, { serverId });
        this.emit('maintenanceCleared', serverId);
    }
    /**
     * Get maintenance status for a server
     */
    async getMaintenanceStatus(serverId) {
        return this.maintenanceSchedule.get(serverId) || {
            isPlanned: false,
            affectedServices: [],
            allowedOperations: []
        };
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Check if operation can be cached for offline execution
     */
    isCacheableOperation(operation) {
        const cacheableOps = [
            'whitelist.add',
            'whitelist.remove',
            'player.kick',
            'server.broadcast',
            'player.message'
        ];
        return cacheableOps.includes(operation);
    }
    /**
     * Check permission configuration issues
     */
    async checkPermissionConfiguration(userId, serverId) {
        // This would typically check against the permission system
        // For now, we'll emit an event to let other services handle it
        return new Promise((resolve) => {
            this.emit('checkPermissionConfiguration', userId, serverId, resolve);
        });
    }
    /**
     * Get permission denial count for user/server
     */
    async getPermissionDenialCount(userId, serverId) {
        // This would typically query the audit logs
        // For now, we'll return a mock value
        return 1;
    }
    /**
     * Find contradictory operations in a sequence
     */
    findContradictoryOperations(operations) {
        const contradictory = [];
        const targets = new Map();
        // Group operations by target
        for (const op of operations) {
            const target = op.target || 'unknown';
            if (!targets.has(target)) {
                targets.set(target, []);
            }
            targets.get(target).push(op);
        }
        // Find contradictory operations for each target
        for (const [target, ops] of targets) {
            if (ops.length > 1) {
                // Check for add/remove pairs
                const adds = ops.filter(op => op.type?.includes('add'));
                const removes = ops.filter(op => op.type?.includes('remove'));
                if (adds.length > 0 && removes.length > 0) {
                    contradictory.push(...adds.slice(0, -1)); // Keep only the last add
                    contradictory.push(...removes.slice(0, -1)); // Keep only the last remove
                }
            }
        }
        return contradictory;
    }
    /**
     * Expire cached operation
     */
    expireCachedOperation(serverId, operationId) {
        const cached = this.cachedOperations.get(serverId);
        if (cached) {
            const filtered = cached.filter(op => op.id !== operationId);
            this.cachedOperations.set(serverId, filtered);
        }
    }
    /**
     * Get cached operations for server
     */
    getCachedOperations(serverId) {
        return this.cachedOperations.get(serverId) || [];
    }
    /**
     * Get conflict history for server
     */
    getConflictHistory(serverId) {
        return this.conflictHistory.get(serverId) || [];
    }
    /**
     * Get business error statistics
     */
    getStats() {
        const stats = {
            totalCachedOperations: 0,
            cachedOperationsByServer: {},
            totalConflicts: 0,
            conflictsByType: {},
            serversInMaintenance: 0
        };
        // Count cached operations
        for (const [serverId, operations] of this.cachedOperations) {
            stats.cachedOperationsByServer[serverId] = operations.length;
            stats.totalCachedOperations += operations.length;
        }
        // Count conflicts
        for (const conflicts of this.conflictHistory.values()) {
            stats.totalConflicts += conflicts.length;
            for (const conflict of conflicts) {
                stats.conflictsByType[conflict.type] = (stats.conflictsByType[conflict.type] || 0) + 1;
            }
        }
        // Count servers in maintenance
        stats.serversInMaintenance = this.maintenanceSchedule.size;
        return stats;
    }
    /**
     * Shutdown business error handler
     */
    shutdown() {
        this.cachedOperations.clear();
        this.conflictHistory.clear();
        this.maintenanceSchedule.clear();
        this.removeAllListeners();
    }
}
exports.BusinessErrorHandler = BusinessErrorHandler;
