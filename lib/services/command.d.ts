/**
 * Command Execution Service
 *
 * Provides command execution capabilities including console commands,
 * quick actions, and server-level control operations with permission
 * verification and audit logging.
 */
import { Context } from 'koishi';
import { CommandResult, QuickAction } from '../types/index';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
import { BaseConnectorBridge } from '../bridge/base';
export interface CommandExecutionOptions {
    timeout?: number;
    requirePermission?: boolean;
    auditLog?: boolean;
    executor?: string;
}
export interface QuickActionDefinition {
    type: string;
    name: string;
    description: string;
    requiredPermission: string;
    parameters: QuickActionParameter[];
}
export interface QuickActionParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    options?: string[];
    validation?: RegExp;
    min?: number;
    max?: number;
}
export interface ServerControlOperation {
    type: 'save-world' | 'reload-config' | 'graceful-shutdown' | 'restart' | 'backup';
    serverId: string;
    parameters?: Record<string, any>;
    graceful?: boolean;
    timeout?: number;
    message?: string;
}
export interface ServerControlResult {
    success: boolean;
    operation: ServerControlOperation;
    timestamp: Date;
    duration: number;
    output?: string[];
    error?: string;
    details?: Record<string, any>;
}
export interface BatchOperationRequest {
    serverIds: string[];
    operation: 'command' | 'quick-action' | 'server-control';
    payload: any;
    options?: CommandExecutionOptions;
}
export interface BatchOperationResult {
    totalServers: number;
    successCount: number;
    failureCount: number;
    results: Array<{
        serverId: string;
        success: boolean;
        result?: any;
        error?: string;
    }>;
    duration: number;
}
export declare class CommandExecutionService {
    private ctx;
    private auditService;
    private permissionManager;
    private getBridge;
    private logger;
    private quickActions;
    constructor(ctx: Context, auditService: AuditService, permissionManager: PermissionManager, getBridge: (serverId: string) => BaseConnectorBridge | null);
    /**
     * Execute a console command on a server
     */
    executeCommand(serverId: string, command: string, executor?: string, options?: CommandExecutionOptions): Promise<CommandResult>;
    /**
     * Execute a quick action
     */
    executeQuickAction(serverId: string, action: QuickAction, executor?: string, options?: CommandExecutionOptions): Promise<CommandResult>;
    /**
     * Get available quick actions
     */
    getQuickActions(): QuickActionDefinition[];
    /**
     * Get quick action definition
     */
    getQuickAction(type: string): QuickActionDefinition | undefined;
    /**
     * Execute a server control operation
     */
    executeServerControl(operation: ServerControlOperation, executor?: string, options?: CommandExecutionOptions): Promise<ServerControlResult>;
    /**
     * Execute batch operations across multiple servers
     */
    executeBatchOperation(request: BatchOperationRequest, executor?: string): Promise<BatchOperationResult>;
    /**
     * Initialize built-in quick actions
     */
    private initializeQuickActions;
    /**
     * Validate quick action parameters
     */
    private validateQuickActionParameters;
    /**
     * Convert quick action to console command
     */
    private convertQuickActionToCommand;
    /**
     * Execute server operation using bridge
     */
    private executeServerOperation;
    /**
     * Execute save world operation
     */
    private executeSaveWorld;
    /**
     * Execute reload config operation
     */
    private executeReloadConfig;
    /**
     * Execute graceful shutdown operation
     */
    private executeGracefulShutdown;
    /**
     * Execute restart operation
     */
    private executeRestart;
    /**
     * Execute backup operation
     */
    private executeBackup;
    /**
     * Split array into chunks
     */
    private chunkArray;
}
