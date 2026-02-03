/**
 * Command Execution Service
 * 
 * Provides command execution capabilities including console commands,
 * quick actions, and server-level control operations with permission
 * verification and audit logging.
 */

import { Context } from 'koishi';
import { CommandResult, QuickAction, ServerConfig, PermissionDeniedError, ServerUnavailableError } from '../types/index';
import { AuditService } from './audit';
import { PermissionManager } from './permission';
import { BaseConnectorBridge } from '../bridge/base';

// ============================================================================
// Command Execution Types
// ============================================================================

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
  options?: string[]; // for select type
  validation?: RegExp; // for string type
  min?: number; // for number type
  max?: number; // for number type
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

// ============================================================================
// Command Execution Service
// ============================================================================

export class CommandExecutionService {
  private logger = this.ctx.logger('mochi-link:command');
  private quickActions: Map<string, QuickActionDefinition> = new Map();

  constructor(
    private ctx: Context,
    private auditService: AuditService,
    private permissionManager: PermissionManager,
    private getBridge: (serverId: string) => BaseConnectorBridge | null
  ) {
    this.initializeQuickActions();
  }

  // ============================================================================
  // Console Command Execution
  // ============================================================================

  /**
   * Execute a console command on a server
   */
  async executeCommand(
    serverId: string,
    command: string,
    executor?: string,
    options: CommandExecutionOptions = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.requirePermission !== false && executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          executor,
          serverId,
          'command.execute'
        );
        
        if (!hasPermission.granted) {
          throw new PermissionDeniedError(
            `User ${executor} lacks permission to execute commands on server ${serverId}`,
            executor,
            serverId,
            'command.execute'
          );
        }
      }

      // Get bridge connection
      const bridge = this.getBridge(serverId);
      if (!bridge || !bridge.isConnectedToBridge()) {
        // Ensure minimum execution time for consistency
        await new Promise(resolve => setTimeout(resolve, 1));
        const executionTime = Date.now() - startTime;
        
        // Audit log the failure
        if (options.auditLog !== false) {
          await this.auditService.logger.logError(
            'command.execute',
            { command, executionTime },
            `Server ${serverId} is not available`,
            { userId: executor }
          );
        }

        this.logger.error(`Command execution failed on ${serverId}: Server not available`);
        
        return {
          success: false,
          output: [],
          executionTime: Math.max(executionTime, 1), // Ensure minimum 1ms
          error: `Server ${serverId} is not available`
        };
      }

      // Execute command
      const result = await bridge.executeCommand(command, options.timeout);
      
      // Audit logging
      if (options.auditLog !== false) {
        if (result.success) {
          await this.auditService.logger.logSuccess(
            'command.execute',
            {
              command,
              success: result.success,
              executionTime: result.executionTime,
              outputLines: result.output.length
            },
            { userId: executor }
          );
        } else {
          await this.auditService.logger.logFailure(
            'command.execute',
            {
              command,
              success: result.success,
              executionTime: result.executionTime,
              outputLines: result.output.length
            },
            result.error || 'Command execution failed',
            { userId: executor }
          );
        }
      }

      this.logger.info(`Command executed on ${serverId}: ${command} (${result.executionTime}ms)`);
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Audit log the failure
      if (options.auditLog !== false) {
        await this.auditService.logger.logError(
          'command.execute',
          { command, executionTime },
          errorMessage,
          { userId: executor }
        );
      }

      this.logger.error(`Command execution failed on ${serverId}: ${errorMessage}`);
      
      return {
        success: false,
        output: [],
        executionTime: Math.max(executionTime, 1), // Ensure minimum 1ms
        error: errorMessage
      };
    }
  }

  // ============================================================================
  // Quick Actions
  // ============================================================================

  /**
   * Execute a quick action
   */
  async executeQuickAction(
    serverId: string,
    action: QuickAction,
    executor?: string,
    options: CommandExecutionOptions = {}
  ): Promise<CommandResult> {
    const actionDef = this.quickActions.get(action.type);
    if (!actionDef) {
      throw new Error(`Unknown quick action type: ${action.type}`);
    }

    // Permission check
    if (options.requirePermission !== false && executor) {
      const hasPermission = await this.permissionManager.checkPermission(
        executor,
        serverId,
        actionDef.requiredPermission
      );
      
      if (!hasPermission.granted) {
        throw new PermissionDeniedError(
          `User ${executor} lacks permission for action ${action.type} on server ${serverId}`,
          executor,
          serverId,
          actionDef.requiredPermission
        );
      }
    }

    // Validate parameters
    this.validateQuickActionParameters(action, actionDef);

    // Convert quick action to command
    const command = this.convertQuickActionToCommand(action);
    
    // Execute the command
    const result = await this.executeCommand(serverId, command, executor, {
      ...options,
      auditLog: false // We'll log the quick action separately
    });

    // Audit log the quick action
    if (options.auditLog !== false) {
      if (result.success) {
        await this.auditService.logger.logSuccess(
          `quick-action.${action.type}`,
          {
            action: action.type,
            parameters: action.parameters,
            success: result.success,
            executionTime: result.executionTime
          },
          { userId: executor }
        );
      } else {
        await this.auditService.logger.logFailure(
          `quick-action.${action.type}`,
          {
            action: action.type,
            parameters: action.parameters,
            success: result.success,
            executionTime: result.executionTime
          },
          result.error || 'Quick action failed',
          { userId: executor }
        );
      }
    }

    return result;
  }

  /**
   * Get available quick actions
   */
  getQuickActions(): QuickActionDefinition[] {
    return Array.from(this.quickActions.values());
  }

  /**
   * Get quick action definition
   */
  getQuickAction(type: string): QuickActionDefinition | undefined {
    return this.quickActions.get(type);
  }

  // ============================================================================
  // Server Control Operations
  // ============================================================================

  /**
   * Execute a server control operation
   */
  async executeServerControl(
    operation: ServerControlOperation,
    executor?: string,
    options: CommandExecutionOptions = {}
  ): Promise<ServerControlResult> {
    const startTime = Date.now();
    
    try {
      // Permission check
      if (options.requirePermission !== false && executor) {
        const hasPermission = await this.permissionManager.checkPermission(
          executor,
          operation.serverId,
          `server.${operation.type}`
        );
        
        if (!hasPermission.granted) {
          throw new PermissionDeniedError(
            `User ${executor} lacks permission for ${operation.type} on server ${operation.serverId}`,
            executor,
            operation.serverId,
            `server.${operation.type}`
          );
        }
      }

      // Get bridge connection
      const bridge = this.getBridge(operation.serverId);
      if (!bridge || !bridge.isConnectedToBridge()) {
        throw new ServerUnavailableError(
          `Server ${operation.serverId} is not available`,
          operation.serverId
        );
      }

      // Execute server operation
      const result = await this.executeServerOperation(bridge, operation);
      
      // Ensure minimum execution time for testing
      const duration = Math.max(Date.now() - startTime, 1);
      const serverResult: ServerControlResult = {
        success: result.success,
        operation,
        timestamp: new Date(),
        duration,
        output: result.output,
        error: result.error,
        details: result.details
      };

      // Audit logging
      if (options.auditLog !== false) {
        if (result.success) {
          await this.auditService.logger.logSuccess(
            `server.${operation.type}`,
            {
              operation: operation.type,
              parameters: operation.parameters,
              graceful: operation.graceful,
              success: result.success,
              duration
            },
            { userId: executor }
          );
        } else {
          await this.auditService.logger.logFailure(
            `server.${operation.type}`,
            {
              operation: operation.type,
              parameters: operation.parameters,
              graceful: operation.graceful,
              success: result.success,
              duration
            },
            result.error || 'Server operation failed',
            { userId: executor }
          );
        }
      }

      this.logger.info(`Server operation ${operation.type} executed on ${operation.serverId} (${duration}ms)`);
      return serverResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Audit log the failure
      if (options.auditLog !== false) {
        await this.auditService.logger.logError(
          `server.${operation.type}`,
          { operation: operation.type, duration },
          errorMessage,
          { userId: executor }
        );
      }

      this.logger.error(`Server operation ${operation.type} failed on ${operation.serverId}: ${errorMessage}`);
      
      return {
        success: false,
        operation,
        timestamp: new Date(),
        duration,
        error: errorMessage
      };
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Execute batch operations across multiple servers
   */
  async executeBatchOperation(
    request: BatchOperationRequest,
    executor?: string
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const results: BatchOperationResult['results'] = [];
    
    this.logger.info(`Starting batch operation ${request.operation} on ${request.serverIds.length} servers`);

    // Execute operations in parallel with concurrency limit
    const concurrency = 5; // Limit concurrent operations
    const chunks = this.chunkArray(request.serverIds, concurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (serverId) => {
        try {
          let result: any;
          
          switch (request.operation) {
            case 'command':
              result = await this.executeCommand(
                serverId,
                request.payload.command,
                executor,
                request.options
              );
              break;
              
            case 'quick-action':
              result = await this.executeQuickAction(
                serverId,
                request.payload,
                executor,
                request.options
              );
              break;
              
            case 'server-control':
              result = await this.executeServerControl(
                { ...request.payload, serverId },
                executor,
                request.options
              );
              break;
              
            default:
              throw new Error(`Unknown batch operation type: ${request.operation}`);
          }
          
          return {
            serverId,
            success: result.success,
            result,
            error: result.error
          };
          
        } catch (error) {
          return {
            serverId,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });
      
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    // Audit log the batch operation
    await this.auditService.logger.logSuccess(
      `batch.${request.operation}`,
      {
        serverCount: request.serverIds.length,
        successCount,
        failureCount,
        duration,
        operation: request.operation
      },
      { userId: executor }
    );

    this.logger.info(`Batch operation completed: ${successCount}/${results.length} successful (${duration}ms)`);

    return {
      totalServers: request.serverIds.length,
      successCount,
      failureCount,
      results,
      duration
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize built-in quick actions
   */
  private initializeQuickActions(): void {
    // Kick player action
    this.quickActions.set('kick', {
      type: 'kick',
      name: 'Kick Player',
      description: 'Kick a player from the server',
      requiredPermission: 'player.kick',
      parameters: [
        {
          name: 'player',
          type: 'string',
          required: true,
          description: 'Player name or UUID to kick'
        },
        {
          name: 'reason',
          type: 'string',
          required: false,
          description: 'Reason for kicking the player'
        }
      ]
    });

    // Broadcast message action
    this.quickActions.set('broadcast', {
      type: 'broadcast',
      name: 'Broadcast Message',
      description: 'Send a message to all players',
      requiredPermission: 'server.broadcast',
      parameters: [
        {
          name: 'message',
          type: 'string',
          required: true,
          description: 'Message to broadcast'
        }
      ]
    });

    // Private message action
    this.quickActions.set('message', {
      type: 'message',
      name: 'Private Message',
      description: 'Send a private message to a player',
      requiredPermission: 'player.message',
      parameters: [
        {
          name: 'player',
          type: 'string',
          required: true,
          description: 'Player name or UUID to message'
        },
        {
          name: 'message',
          type: 'string',
          required: true,
          description: 'Message to send'
        }
      ]
    });

    // Set time action
    this.quickActions.set('time', {
      type: 'time',
      name: 'Set Time',
      description: 'Set the world time',
      requiredPermission: 'world.time',
      parameters: [
        {
          name: 'time',
          type: 'select',
          required: true,
          description: 'Time to set',
          options: ['day', 'night', 'noon', 'midnight']
        },
        {
          name: 'world',
          type: 'string',
          required: false,
          description: 'World name (default: main world)'
        }
      ]
    });

    // Set weather action
    this.quickActions.set('weather', {
      type: 'weather',
      name: 'Set Weather',
      description: 'Set the world weather',
      requiredPermission: 'world.weather',
      parameters: [
        {
          name: 'weather',
          type: 'select',
          required: true,
          description: 'Weather to set',
          options: ['clear', 'rain', 'thunder']
        },
        {
          name: 'duration',
          type: 'number',
          required: false,
          description: 'Duration in seconds',
          min: 1,
          max: 86400
        },
        {
          name: 'world',
          type: 'string',
          required: false,
          description: 'World name (default: main world)'
        }
      ]
    });
  }

  /**
   * Validate quick action parameters
   */
  private validateQuickActionParameters(action: QuickAction, definition: QuickActionDefinition): void {
    for (const param of definition.parameters) {
      const value = action.parameters[param.name];
      
      // Check required parameters
      if (param.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        switch (param.type) {
          case 'string':
            if (typeof value !== 'string') {
              throw new Error(`Parameter '${param.name}' must be a string`);
            }
            if (param.validation && !param.validation.test(value)) {
              throw new Error(`Parameter '${param.name}' does not match required format`);
            }
            break;
            
          case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
              throw new Error(`Parameter '${param.name}' must be a number`);
            }
            if (param.min !== undefined && value < param.min) {
              throw new Error(`Parameter '${param.name}' must be at least ${param.min}`);
            }
            if (param.max !== undefined && value > param.max) {
              throw new Error(`Parameter '${param.name}' must be at most ${param.max}`);
            }
            break;
            
          case 'boolean':
            if (typeof value !== 'boolean') {
              throw new Error(`Parameter '${param.name}' must be a boolean`);
            }
            break;
            
          case 'select':
            if (param.options && !param.options.includes(value)) {
              throw new Error(`Parameter '${param.name}' must be one of: ${param.options.join(', ')}`);
            }
            break;
        }
      }
    }
  }

  /**
   * Convert quick action to console command
   */
  private convertQuickActionToCommand(action: QuickAction): string {
    switch (action.type) {
      case 'kick':
        const kickReason = action.parameters.reason ? ` ${action.parameters.reason}` : '';
        return `kick ${action.parameters.player}${kickReason}`;
        
      case 'broadcast':
        return `say ${action.parameters.message}`;
        
      case 'message':
        return `tell ${action.parameters.player} ${action.parameters.message}`;
        
      case 'time':
        const timeWorld = action.parameters.world ? ` ${action.parameters.world}` : '';
        return `time set ${action.parameters.time}${timeWorld}`;
        
      case 'weather':
        const weatherDuration = action.parameters.duration ? ` ${action.parameters.duration}` : '';
        const weatherWorld = action.parameters.world ? ` ${action.parameters.world}` : '';
        return `weather ${action.parameters.weather}${weatherDuration}${weatherWorld}`;
        
      default:
        throw new Error(`Unknown quick action type: ${action.type}`);
    }
  }

  /**
   * Execute server operation using bridge
   */
  private async executeServerOperation(
    bridge: BaseConnectorBridge,
    operation: ServerControlOperation
  ): Promise<{ success: boolean; output?: string[]; error?: string; details?: any }> {
    switch (operation.type) {
      case 'save-world':
        return this.executeSaveWorld(bridge, operation);
        
      case 'reload-config':
        return this.executeReloadConfig(bridge, operation);
        
      case 'graceful-shutdown':
        return this.executeGracefulShutdown(bridge, operation);
        
      case 'restart':
        return this.executeRestart(bridge, operation);
        
      case 'backup':
        return this.executeBackup(bridge, operation);
        
      default:
        throw new Error(`Unknown server operation type: ${operation.type}`);
    }
  }

  /**
   * Execute save world operation
   */
  private async executeSaveWorld(
    bridge: BaseConnectorBridge,
    operation: ServerControlOperation
  ): Promise<{ success: boolean; output?: string[]; error?: string; details?: any }> {
    try {
      const worldName = operation.parameters?.world || '';
      const command = worldName ? `save-all ${worldName}` : 'save-all';
      const result = await bridge.executeCommand(command, operation.timeout);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        details: { world: worldName }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute reload config operation
   */
  private async executeReloadConfig(
    bridge: BaseConnectorBridge,
    operation: ServerControlOperation
  ): Promise<{ success: boolean; output?: string[]; error?: string; details?: any }> {
    try {
      const result = await bridge.executeCommand('reload', operation.timeout);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute graceful shutdown operation
   */
  private async executeGracefulShutdown(
    bridge: BaseConnectorBridge,
    operation: ServerControlOperation
  ): Promise<{ success: boolean; output?: string[]; error?: string; details?: any }> {
    try {
      const message = operation.message || 'Server is shutting down';
      const timeout = operation.timeout || 30;
      
      // Broadcast shutdown message
      await bridge.executeCommand(`say ${message}`);
      
      // Wait a moment for the message to be sent
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Execute shutdown
      const result = await bridge.executeCommand('stop', timeout * 1000);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        details: { message, timeout }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute restart operation
   */
  private async executeRestart(
    bridge: BaseConnectorBridge,
    operation: ServerControlOperation
  ): Promise<{ success: boolean; output?: string[]; error?: string; details?: any }> {
    try {
      const message = operation.message || 'Server is restarting';
      
      // Broadcast restart message
      await bridge.executeCommand(`say ${message}`);
      
      // Wait a moment for the message to be sent
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Execute restart (if supported by the server)
      const result = await bridge.executeCommand('restart', operation.timeout);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        details: { message }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute backup operation
   */
  private async executeBackup(
    bridge: BaseConnectorBridge,
    operation: ServerControlOperation
  ): Promise<{ success: boolean; output?: string[]; error?: string; details?: any }> {
    try {
      // First save the world
      await bridge.executeCommand('save-all');
      
      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Execute backup command (server-specific)
      const backupName = operation.parameters?.name || `backup-${Date.now()}`;
      const result = await bridge.executeCommand(`backup create ${backupName}`, operation.timeout);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        details: { backupName }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}