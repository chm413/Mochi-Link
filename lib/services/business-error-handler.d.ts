/**
 * Business Logic Error Handler
 *
 * Handles business logic errors including permission failures, data sync conflicts,
 * and server unavailability with appropriate degradation strategies.
 */
import { EventEmitter } from 'events';
import { Context } from 'koishi';
import { PermissionDeniedError, ServerUnavailableError, PendingOperation } from '../types';
import { AuditService } from './audit';
export interface BusinessErrorHandlerConfig {
    maxPermissionRetries: number;
    permissionRetryInterval: number;
    serverUnavailableTimeout: number;
    maxUnavailableRetries: number;
    conflictResolutionStrategy: 'server_wins' | 'client_wins' | 'manual' | 'merge';
    maxConflictRetries: number;
    enableGracefulDegradation: boolean;
    degradationTimeout: number;
    maxCachedOperations: number;
    cacheExpirationTime: number;
}
export interface SyncConflict {
    type: 'whitelist_mismatch' | 'player_identity_conflict' | 'operation_conflict' | 'data_version_conflict';
    serverId: string;
    conflictData: any;
    serverVersion?: any;
    clientVersion?: any;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface ConflictResolution {
    strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
    resolvedData?: any;
    requiresManualIntervention: boolean;
    resolutionSteps: string[];
}
export interface MaintenanceStatus {
    isPlanned: boolean;
    startTime?: Date;
    estimatedEndTime?: Date;
    reason?: string;
    affectedServices: string[];
    allowedOperations: string[];
}
export declare class BusinessErrorHandler extends EventEmitter {
    private ctx;
    private config;
    private auditService;
    private maintenanceSchedule;
    private cachedOperations;
    private conflictHistory;
    constructor(ctx: Context, auditService: AuditService, config?: Partial<BusinessErrorHandlerConfig>);
    /**
     * Handle permission denied errors with retry and escalation
     */
    handlePermissionDenied(userId: string, serverId: string, operation: string, error: PermissionDeniedError): Promise<void>;
    /**
     * Handle permission configuration refresh
     */
    refreshPermissions(userId: string, serverId: string): Promise<void>;
    /**
     * Handle server unavailable errors with caching and degradation
     */
    handleServerUnavailable(serverId: string, operation: string, operationData: any, error: ServerUnavailableError): Promise<void>;
    /**
     * Cache operation for later execution
     */
    private cacheOperation;
    /**
     * Attempt graceful degradation for unavailable server
     */
    private attemptGracefulDegradation;
    /**
     * Handle data synchronization conflicts
     */
    handleSyncConflict(conflict: SyncConflict): Promise<ConflictResolution>;
    /**
     * Resolve specific conflict based on type and strategy
     */
    private resolveConflict;
    /**
     * Resolve whitelist conflicts
     */
    private resolveWhitelistConflict;
    /**
     * Resolve player identity conflicts
     */
    private resolvePlayerIdentityConflict;
    /**
     * Resolve operation conflicts
     */
    private resolveOperationConflict;
    /**
     * Resolve data version conflicts
     */
    private resolveDataVersionConflict;
    /**
     * Set planned maintenance for a server
     */
    setPlannedMaintenance(serverId: string, maintenance: Omit<MaintenanceStatus, 'isPlanned'>): Promise<void>;
    /**
     * Clear planned maintenance for a server
     */
    clearPlannedMaintenance(serverId: string): Promise<void>;
    /**
     * Get maintenance status for a server
     */
    getMaintenanceStatus(serverId: string): Promise<MaintenanceStatus>;
    /**
     * Check if operation can be cached for offline execution
     */
    private isCacheableOperation;
    /**
     * Check permission configuration issues
     */
    private checkPermissionConfiguration;
    /**
     * Get permission denial count for user/server
     */
    private getPermissionDenialCount;
    /**
     * Find contradictory operations in a sequence
     */
    private findContradictoryOperations;
    /**
     * Expire cached operation
     */
    private expireCachedOperation;
    /**
     * Get cached operations for server
     */
    getCachedOperations(serverId: string): PendingOperation[];
    /**
     * Get conflict history for server
     */
    getConflictHistory(serverId: string): SyncConflict[];
    /**
     * Get business error statistics
     */
    getStats(): {
        totalCachedOperations: number;
        cachedOperationsByServer: Record<string, number>;
        totalConflicts: number;
        conflictsByType: Record<string, number>;
        serversInMaintenance: number;
    };
    /**
     * Shutdown business error handler
     */
    shutdown(): void;
}
