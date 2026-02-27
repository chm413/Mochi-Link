/**
* Mochi-Link (大福连) - Database Initialization
*
* This file contains database initialization scripts and migration utilities.
*/
import { Context } from 'koishi';
import { DatabaseManager } from './operations';
export declare class DatabaseInitializer {
    private ctx;
    private dbManager;
    constructor(ctx: Context);
    /**
     * Initialize the complete database system
     */
    initialize(): Promise<void>;
    /**
     * Check database connectivity
     */
    private checkConnectivity;
    /**
     * Run database migrations
     */
    private runMigrations;
    /**
     * Verify that all required tables exist
     */
    private verifyTables;
    /**
     * Fix invalid JSON data in existing database records
     */
    private fixInvalidJsonData;
    /**
     * Create initial data if needed
     */
    private createInitialData;
    /**
     * Final health check
     */
    private finalHealthCheck;
    /**
     * Get the initialized database manager
     */
    getDatabaseManager(): DatabaseManager;
}
export declare class SchemaCreator {
    private ctx;
    constructor(ctx: Context);
    /**
     * Create all database tables with proper indexes
     */
    createSchema(): Promise<void>;
    /**
     * Drop all tables (for testing or reset purposes)
     */
    dropSchema(): Promise<void>;
}
export declare class MigrationManager {
    private ctx;
    constructor(ctx: Context);
    /**
     * Check if migration is needed
     */
    needsMigration(): Promise<boolean>;
    /**
     * Get migration status
     */
    getMigrationStatus(): Promise<{
        tablesExist: boolean;
        tableCount: number;
        lastMigration?: Date;
    }>;
    /**
     * Backup database before migration
     */
    backupDatabase(): Promise<string>;
}
export declare class MaintenanceManager {
    private ctx;
    private dbManager;
    constructor(ctx: Context);
    /**
     * Perform routine maintenance
     */
    performRoutineMaintenance(config: {
        auditRetentionDays: number;
        cleanupExpiredTokens: boolean;
        cleanupExpiredACLs: boolean;
        optimizePendingOperations: boolean;
    }): Promise<{
        auditLogsRemoved: number;
        tokensRemoved: number;
        aclsRemoved: number;
        operationsOptimized: number;
    }>;
    /**
     * Get maintenance recommendations
     */
    getMaintenanceRecommendations(): Promise<{
        auditLogCount: number;
        expiredTokenCount: number;
        expiredACLCount: number;
        pendingOperationCount: number;
        recommendations: string[];
    }>;
}
export { DatabaseManager, DatabaseInitializer as default };
