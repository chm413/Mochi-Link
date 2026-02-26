/**
 * Mochi-Link (大福连) - Database Models
 *
 * This file contains the database table definitions and model interfaces
 * for the Minecraft Unified Management and Monitoring System.
 */
import { Context } from 'koishi';
import { DatabaseServer, DatabaseServerACL, DatabaseAPIToken, DatabaseAuditLog, DatabasePendingOperation, DatabaseServerBinding, DatabasePlayerCache } from '../types';
declare module 'koishi' {
    interface Tables {
        minecraft_servers: DatabaseServer;
        server_acl: DatabaseServerACL;
        api_tokens: DatabaseAPIToken;
        audit_logs: DatabaseAuditLog;
        pending_operations: DatabasePendingOperation;
        server_bindings: DatabaseServerBinding;
        player_cache: DatabasePlayerCache;
    }
}
export declare function defineModels(ctx: Context): void;
export declare function createIndexes(ctx: Context): Promise<void>;
export declare class ModelUtils {
    private ctx;
    constructor(ctx: Context);
    /**
     * Convert database server record to application model
     */
    static dbServerToModel(dbServer: DatabaseServer): any;
    /**
     * Convert application model to database server record
     */
    static modelToDbServer(model: any): Partial<DatabaseServer>;
    /**
     * Convert database ACL record to application model
     */
    static dbACLToModel(dbACL: DatabaseServerACL): any;
    /**
     * Convert application ACL model to database record
     */
    static modelToDbACL(model: any): Partial<DatabaseServerACL>;
    /**
     * Convert database audit log to application model
     */
    static dbAuditToModel(dbAudit: DatabaseAuditLog): any;
    /**
     * Convert application audit model to database record
     */
    static modelToDbAudit(model: any): Partial<DatabaseAuditLog>;
}
export declare function runMigrations(ctx: Context): Promise<void>;
export declare function checkDatabaseHealth(ctx: Context): Promise<boolean>;
