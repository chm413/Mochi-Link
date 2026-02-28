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

// ============================================================================
// Server Control Types
// ============================================================================

export interface ServerRestartOptions {
  delay?: number; // seconds
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
  delay?: number; // seconds
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
  worlds?: string[]; // specific worlds to save, empty = all
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

// ============================================================================
// Server Control Service
// ============================================================================

export class ServerControlService {
  private logger: any;

  constructor(
    private ctx: Context,
    private getBridge: (serverId: string) => BaseConnectorBridge | null,
    private auditService: AuditService,
    private permissionManager: PermissionManager
  ) {
    this.logger = ctx.logger('mochi-link:server-control');
  }

  // ============================================================================
  // Server Restart
  // ============================================================================

  /**
   * Restart a server
   */
  async restartServer(
    serverId: string,
    options: ServerRestartOptions = {}
  ): Promise<ServerRestartResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          options.executor,
          serverId,
          'server.restart'
        );
        
        if (!hasPermission.granted) {
          throw new Error(`User ${options.executor} lacks permission to restart server`);
        }
      }

      // Get bridge
      const bridge = this.getBridge(serverId);
      if (!bridge || !bridge.isConnectedToBridge()) {
        throw new Error(`Server ${serverId} is not available`);
      }

      // Check capability
      if (!bridge.hasCapability('server_control')) {
        throw new Error(`Server ${serverId} does not support server control operations`);
      }

      const delay = options.delay || 0;
      const message = options.message || `Server restarting in ${delay} seconds`;

      // Execute restart operation
      const result = await bridge.performServerOperation({
        type: 'restart',
        delay,
        message,
        graceful: true
      });

      // Audit log
      await this.auditService.logger.logSuccess(
        'server.restart',
        {
          serverId,
          delay,
          message,
          duration: Date.now() - startTime
        },
        { userId: options.executor }
      );

      this.logger.info(`Server ${serverId} restart initiated with ${delay}s delay`);

      return {
        success: result.success,
        serverId,
        delay,
        message,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Audit log
      await this.auditService.logger.logError(
        'server.restart',
        {
          serverId,
          duration: Date.now() - startTime
        },
        errorMessage,
        { userId: options.executor }
      );

      this.logger.error(`Failed to restart server ${serverId}:`, error);

      return {
        success: false,
        serverId,
        delay: options.delay || 0,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  // ============================================================================
  // Server Shutdown
  // ============================================================================

  /**
   * Shutdown a server
   */
  async shutdownServer(
    serverId: string,
    options: ServerShutdownOptions = {}
  ): Promise<ServerShutdownResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          options.executor,
          serverId,
          'server.shutdown'
        );
        
        if (!hasPermission.granted) {
          throw new Error(`User ${options.executor} lacks permission to shutdown server`);
        }
      }

      // Get bridge
      const bridge = this.getBridge(serverId);
      if (!bridge || !bridge.isConnectedToBridge()) {
        throw new Error(`Server ${serverId} is not available`);
      }

      // Check capability
      if (!bridge.hasCapability('server_control')) {
        throw new Error(`Server ${serverId} does not support server control operations`);
      }

      const delay = options.delay || 0;
      const message = options.message || `Server shutting down in ${delay} seconds`;

      // Execute shutdown operation
      const result = await bridge.performServerOperation({
        type: 'shutdown',
        delay,
        message,
        graceful: true
      });

      // Audit log
      await this.auditService.logger.logSuccess(
        'server.shutdown',
        {
          serverId,
          delay,
          message,
          duration: Date.now() - startTime
        },
        { userId: options.executor }
      );

      this.logger.info(`Server ${serverId} shutdown initiated with ${delay}s delay`);

      return {
        success: result.success,
        serverId,
        delay,
        message,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Audit log
      await this.auditService.logger.logError(
        'server.shutdown',
        {
          serverId,
          duration: Date.now() - startTime
        },
        errorMessage,
        { userId: options.executor }
      );

      this.logger.error(`Failed to shutdown server ${serverId}:`, error);

      return {
        success: false,
        serverId,
        delay: options.delay || 0,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  // ============================================================================
  // Server Save
  // ============================================================================

  /**
   * Save server worlds
   */
  async saveServer(
    serverId: string,
    options: ServerSaveOptions = {}
  ): Promise<ServerSaveResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          options.executor,
          serverId,
          'server.save'
        );
        
        if (!hasPermission.granted) {
          throw new Error(`User ${options.executor} lacks permission to save server`);
        }
      }

      // Get bridge
      const bridge = this.getBridge(serverId);
      if (!bridge || !bridge.isConnectedToBridge()) {
        throw new Error(`Server ${serverId} is not available`);
      }

      // Check capability
      if (!bridge.hasCapability('world_management')) {
        throw new Error(`Server ${serverId} does not support world management operations`);
      }

      const worlds = options.worlds || [];

      // Execute save operation
      const result = await bridge.performWorldOperation({
        type: 'save',
        worlds,
        graceful: true
      });

      const duration = Date.now() - startTime;

      // Audit log
      await this.auditService.logger.logSuccess(
        'server.save',
        {
          serverId,
          worlds,
          duration
        },
        { userId: options.executor }
      );

      this.logger.info(`Server ${serverId} worlds saved successfully`);

      return {
        success: result.success,
        serverId,
        worlds,
        timestamp: new Date(),
        duration
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;
      
      // Audit log
      await this.auditService.logger.logError(
        'server.save',
        {
          serverId,
          duration
        },
        errorMessage,
        { userId: options.executor }
      );

      this.logger.error(`Failed to save server ${serverId}:`, error);

      return {
        success: false,
        serverId,
        worlds: options.worlds || [],
        error: errorMessage,
        timestamp: new Date(),
        duration
      };
    }
  }

  // ============================================================================
  // Server Reload
  // ============================================================================

  /**
   * Reload server configuration or plugins
   */
  async reloadServer(
    serverId: string,
    options: ServerReloadOptions = {}
  ): Promise<ServerReloadResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          options.executor,
          serverId,
          'server.reload'
        );
        
        if (!hasPermission.granted) {
          throw new Error(`User ${options.executor} lacks permission to reload server`);
        }
      }

      // Get bridge
      const bridge = this.getBridge(serverId);
      if (!bridge || !bridge.isConnectedToBridge()) {
        throw new Error(`Server ${serverId} is not available`);
      }

      // Check capability
      if (!bridge.hasCapability('server_control')) {
        throw new Error(`Server ${serverId} does not support server control operations`);
      }

      const reloadType = options.type || 'all';

      // Execute reload operation
      const result = await bridge.performServerOperation({
        type: 'reload',
        reloadType,
        graceful: true
      });

      const duration = Date.now() - startTime;

      // Audit log
      await this.auditService.logger.logSuccess(
        'server.reload',
        {
          serverId,
          type: reloadType,
          duration
        },
        { userId: options.executor }
      );

      this.logger.info(`Server ${serverId} reloaded successfully (type: ${reloadType})`);

      return {
        success: result.success,
        serverId,
        type: reloadType,
        timestamp: new Date(),
        duration
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;
      
      // Audit log
      await this.auditService.logger.logError(
        'server.reload',
        {
          serverId,
          duration
        },
        errorMessage,
        { userId: options.executor }
      );

      this.logger.error(`Failed to reload server ${serverId}:`, error);

      return {
        success: false,
        serverId,
        type: options.type || 'all',
        error: errorMessage,
        timestamp: new Date(),
        duration
      };
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Restart multiple servers
   */
  async restartServers(
    serverIds: string[],
    options: ServerRestartOptions = {}
  ): Promise<ServerRestartResult[]> {
    const results: ServerRestartResult[] = [];
    
    for (const serverId of serverIds) {
      const result = await this.restartServer(serverId, options);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Save multiple servers
   */
  async saveServers(
    serverIds: string[],
    options: ServerSaveOptions = {}
  ): Promise<ServerSaveResult[]> {
    const results: ServerSaveResult[] = [];
    
    for (const serverId of serverIds) {
      const result = await this.saveServer(serverId, options);
      results.push(result);
    }
    
    return results;
  }
}
