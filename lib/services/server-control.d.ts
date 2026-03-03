/**
 * Server Control Service
 *
 * Handles server control operations such as restart, shutdown, save, etc.
 * This service is separate from ServerManager to maintain separation of concerns:
 * server registration/configuration vs. runtime control operations.
 */
import { Context } from 'koishi';
import { BaseConnectorBridge } from '../bridge/base';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
export interface ServerRestartOptions {
    delay?: number;
    message?: string;
    executor?: string;
}
export interface ServerRestartResult {
    success: boolean;
    serverId: string;
    delay: number;
    message?: string;
    error?: string;
    timestamp: Date;
}
export interface ServerShutdownOptions {
    delay?: number;
    message?: string;
    executor?: string;
}
export interface ServerShutdownResult {
    success: boolean;
    serverId: string;
    delay: number;
    message?: string;
    error?: string;
    timestamp: Date;
}
export interface ServerSaveOptions {
    worlds?: string[];
    executor?: string;
}
export interface ServerSaveResult {
    success: boolean;
    serverId: string;
    worlds: string[];
    error?: string;
    timestamp: Date;
    duration: number;
}
export interface ServerReloadOptions {
    type?: 'config' | 'plugins' | 'all';
    executor?: string;
}
export interface ServerReloadResult {
    success: boolean;
    serverId: string;
    type: string;
    error?: string;
    timestamp: Date;
    duration: number;
}
export declare class ServerControlService {
    private ctx;
    private getBridge;
    private auditService;
    private permissionManager;
    private logger;
    constructor(ctx: Context, getBridge: (serverId: string) => BaseConnectorBridge | null, auditService: AuditService, permissionManager: PermissionManager);
    /**
     * Restart a server
     */
    restartServer(serverId: string, options?: ServerRestartOptions): Promise<ServerRestartResult>;
    /**
     * Shutdown a server
     */
    shutdownServer(serverId: string, options?: ServerShutdownOptions): Promise<ServerShutdownResult>;
    /**
     * Save server worlds
     */
    saveServer(serverId: string, options?: ServerSaveOptions): Promise<ServerSaveResult>;
    /**
     * Reload server configuration or plugins
     */
    reloadServer(serverId: string, options?: ServerReloadOptions): Promise<ServerReloadResult>;
    /**
     * Restart multiple servers
     */
    restartServers(serverIds: string[], options?: ServerRestartOptions): Promise<ServerRestartResult[]>;
    /**
     * Save multiple servers
     */
    saveServers(serverIds: string[], options?: ServerSaveOptions): Promise<ServerSaveResult[]>;
}
