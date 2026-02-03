/**
 * Property-Based Tests for Command Execution Service
 * 
 * Tests the round-trip consistency of command execution to ensure that
 * commands sent to servers return appropriate execution results.
 */

import * as fc from 'fast-check';
import { Context } from 'koishi';
import { CommandExecutionService } from '../../src/services/command';
import { AuditService } from '../../src/services/audit';
import { PermissionManager } from '../../src/services/permission';
import { BaseConnectorBridge } from '../../src/bridge/base';
import { CommandResult } from '../../src/types';

// ============================================================================
// Test Setup and Mocks
// ============================================================================

describe('Command Execution Service - Property Tests', () => {
  let ctx: Context;
  let commandService: CommandExecutionService;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockPermissionManager: jest.Mocked<PermissionManager>;
  let mockGetBridge: jest.MockedFunction<(serverId: string) => BaseConnectorBridge | null>;

  beforeEach(() => {
    // Create mock context
    ctx = {
      logger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }))
    } as any;

    // Create mock services
    mockAuditService = {
      logger: {
        logSuccess: jest.fn().mockResolvedValue(undefined),
        logFailure: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    mockPermissionManager = {
      checkPermission: jest.fn().mockResolvedValue({ granted: true })
    } as any;

    mockGetBridge = jest.fn();

    // Create command service
    commandService = new CommandExecutionService(
      ctx,
      mockAuditService,
      mockPermissionManager,
      mockGetBridge
    );
  });

  // ============================================================================
  // Property 7: Command Execution Round-trip Consistency
  // ============================================================================

  describe('Property 7: Command Execution Round-trip Consistency', () => {
    it('should return consistent execution results for valid commands', async () => {
      await fc.assert(fc.asyncProperty(
        // Generate test data
        fc.record({
          serverId: fc.string({ minLength: 8, maxLength: 32 }),
          command: fc.oneof(
            // Valid Minecraft commands
            fc.constantFrom(
              'list',
              'help',
              'version',
              'time query daytime',
              'weather query',
              'difficulty peaceful',
              'gamerule showDeathMessages true',
              'tp @a 0 100 0',
              'give @a minecraft:diamond 1',
              'effect give @a minecraft:speed 30 1'
            ),
            // Custom commands with parameters
            fc.record({
              base: fc.constantFrom('say', 'tell', 'kick', 'ban', 'pardon'),
              args: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 })
            }).map(({ base, args }) => `${base} ${args.join(' ')}`),
            // Time and weather commands
            fc.record({
              type: fc.constantFrom('time', 'weather'),
              action: fc.constantFrom('set', 'add'),
              value: fc.oneof(
                fc.constantFrom('day', 'night', 'noon', 'midnight'),
                fc.constantFrom('clear', 'rain', 'thunder'),
                fc.integer({ min: 0, max: 24000 }).map(String)
              )
            }).map(({ type, action, value }) => `${type} ${action} ${value}`)
          ),
          executor: fc.option(fc.string({ minLength: 3, maxLength: 16 }), { nil: undefined }),
          timeout: fc.option(fc.integer({ min: 1000, max: 30000 }), { nil: undefined })
        }),
        async ({ serverId, command, executor, timeout }) => {
          // **Validates: Requirements 6.1**
          
          // Create mock bridge that simulates successful command execution
          const mockBridge = {
            isConnectedToBridge: jest.fn().mockReturnValue(true),
            executeCommand: jest.fn().mockImplementation(async (cmd: string, timeoutMs?: number) => {
              // Simulate realistic command execution
              const executionTime = Math.floor(Math.random() * 500) + 50; // 50-550ms
              
              // Simulate different types of command outputs
              const outputs: string[] = [];
              
              if (cmd.startsWith('list')) {
                outputs.push('There are 3 of a max of 20 players online: player1, player2, player3');
              } else if (cmd.startsWith('help')) {
                outputs.push('Available commands:', '/list - Show online players', '/time - Manage world time');
              } else if (cmd.startsWith('version')) {
                outputs.push('This server is running Paper version git-Paper-123 (MC: 1.20.1)');
              } else if (cmd.startsWith('say ')) {
                const message = cmd.substring(4);
                outputs.push(`[Server] ${message}`);
              } else if (cmd.startsWith('time ')) {
                outputs.push('Set the time to 1000');
              } else if (cmd.startsWith('weather ')) {
                outputs.push('Set weather to clear');
              } else {
                outputs.push(`Command executed: ${cmd}`);
              }

              return {
                success: true,
                output: outputs,
                executionTime,
                error: undefined
              } as CommandResult;
            })
          } as any;

          mockGetBridge.mockReturnValue(mockBridge);

          // Execute command
          const result = await commandService.executeCommand(
            serverId,
            command,
            executor,
            { timeout, requirePermission: false, auditLog: false }
          );

          // Verify round-trip consistency properties
          expect(result).toBeDefined();
          expect(typeof result.success).toBe('boolean');
          expect(Array.isArray(result.output)).toBe(true);
          expect(typeof result.executionTime).toBe('number');
          
          // For successful commands, verify positive properties
          if (result.success) {
            expect(result.executionTime).toBeGreaterThan(0);
            expect(result.output.length).toBeGreaterThan(0);
            expect(result.error).toBeUndefined();
            
            // Verify that output contains relevant information
            const outputText = result.output.join(' ').toLowerCase();
            const commandLower = command.toLowerCase();
            
            // Command-specific output validation
            if (commandLower.includes('list')) {
              expect(outputText).toMatch(/player|online|max/);
            } else if (commandLower.includes('help')) {
              expect(outputText).toMatch(/command|available|help/);
            } else if (commandLower.includes('version')) {
              expect(outputText).toMatch(/server|version|running/);
            } else if (commandLower.startsWith('say ')) {
              expect(outputText).toMatch(/server/);
            }
          }

          // Verify bridge interaction
          expect(mockGetBridge).toHaveBeenCalledWith(serverId);
          expect(mockBridge.isConnectedToBridge).toHaveBeenCalled();
          expect(mockBridge.executeCommand).toHaveBeenCalledWith(command, timeout);
        }
      ), { numRuns: 25 }) // Reduced runs for faster execution
    });

    it('should handle command execution failures consistently', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          serverId: fc.string({ minLength: 8, maxLength: 32 }),
          command: fc.string({ minLength: 1, maxLength: 100 }),
          errorType: fc.constantFrom('timeout', 'invalid_command', 'permission_denied', 'server_error'),
          executor: fc.option(fc.string({ minLength: 3, maxLength: 16 }), { nil: undefined })
        }),
        async ({ serverId, command, errorType, executor }) => {
          // **Validates: Requirements 6.1**
          
          // Create mock bridge that simulates different failure scenarios
          const mockBridge = {
            isConnectedToBridge: jest.fn().mockReturnValue(true),
            executeCommand: jest.fn().mockImplementation(async () => {
              const executionTime = Math.floor(Math.random() * 200) + 10;
              
              switch (errorType) {
                case 'timeout':
                  return {
                    success: false,
                    output: [],
                    executionTime,
                    error: 'Command execution timed out'
                  };
                  
                case 'invalid_command':
                  return {
                    success: false,
                    output: ['Unknown command. Type "/help" for help.'],
                    executionTime,
                    error: 'Invalid command'
                  };
                  
                case 'permission_denied':
                  return {
                    success: false,
                    output: ['You do not have permission to use this command'],
                    executionTime,
                    error: 'Permission denied'
                  };
                  
                case 'server_error':
                  return {
                    success: false,
                    output: ['An internal server error occurred'],
                    executionTime,
                    error: 'Internal server error'
                  };
                  
                default:
                  return {
                    success: false,
                    output: [],
                    executionTime,
                    error: 'Unknown error'
                  };
              }
            })
          } as any;

          mockGetBridge.mockReturnValue(mockBridge);

          // Execute command
          const result = await commandService.executeCommand(
            serverId,
            command,
            executor,
            { requirePermission: false, auditLog: false }
          );

          // Verify failure consistency properties
          expect(result).toBeDefined();
          expect(result.success).toBe(false);
          expect(Array.isArray(result.output)).toBe(true);
          expect(typeof result.executionTime).toBe('number');
          expect(result.executionTime).toBeGreaterThan(0);
          expect(typeof result.error).toBe('string');
          expect(result.error).toBeTruthy();

          // Verify error message is meaningful
          expect(result.error!.length).toBeGreaterThan(0);
          
          // Verify bridge interaction
          expect(mockGetBridge).toHaveBeenCalledWith(serverId);
          expect(mockBridge.executeCommand).toHaveBeenCalledWith(command, undefined);
        }
      ), { numRuns: 20 })
    });

    it('should handle server unavailability consistently', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          serverId: fc.string({ minLength: 8, maxLength: 32 }),
          command: fc.string({ minLength: 1, maxLength: 50 }),
          serverState: fc.constantFrom('disconnected', 'null_bridge', 'bridge_error'),
          executor: fc.option(fc.string({ minLength: 3, maxLength: 16 }), { nil: undefined })
        }),
        async ({ serverId, command, serverState, executor }) => {
          // **Validates: Requirements 6.1**
          
          // Configure mock bridge based on server state
          switch (serverState) {
            case 'disconnected':
              const disconnectedBridge = {
                isConnectedToBridge: jest.fn().mockReturnValue(false)
              } as any;
              mockGetBridge.mockReturnValue(disconnectedBridge);
              break;
              
            case 'null_bridge':
              mockGetBridge.mockReturnValue(null);
              break;
              
            case 'bridge_error':
              const errorBridge = {
                isConnectedToBridge: jest.fn().mockReturnValue(true),
                executeCommand: jest.fn().mockRejectedValue(new Error('Bridge communication error'))
              } as any;
              mockGetBridge.mockReturnValue(errorBridge);
              break;
          }

          // Execute command
          const result = await commandService.executeCommand(
            serverId,
            command,
            executor,
            { requirePermission: false, auditLog: false }
          );

          // Verify consistent error handling
          expect(result).toBeDefined();
          expect(result.success).toBe(false);
          expect(Array.isArray(result.output)).toBe(true);
          expect(result.output).toHaveLength(0); // No output for server errors
          expect(typeof result.executionTime).toBe('number');
          expect(result.executionTime).toBeGreaterThan(0);
          expect(typeof result.error).toBe('string');
          expect(result.error).toBeTruthy();

          // Verify error message indicates server unavailability
          expect(result.error!.toLowerCase()).toMatch(/server|unavailable|not available|error/);
          
          // Verify bridge interaction
          expect(mockGetBridge).toHaveBeenCalledWith(serverId);
        }
      ), { numRuns: 20 })
    });

    it('should maintain execution time consistency', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          serverId: fc.string({ minLength: 8, maxLength: 32 }),
          commands: fc.array(
            fc.string({ minLength: 1, maxLength: 30 }),
            { minLength: 2, maxLength: 5 }
          ),
          simulatedDelay: fc.integer({ min: 10, max: 500 })
        }),
        async ({ serverId, commands, simulatedDelay }) => {
          // **Validates: Requirements 6.1**
          
          const executionTimes: number[] = [];
          
          // Create mock bridge with consistent delay
          const mockBridge = {
            isConnectedToBridge: jest.fn().mockReturnValue(true),
            executeCommand: jest.fn().mockImplementation(async (cmd: string) => {
              // Simulate consistent execution time
              await new Promise(resolve => setTimeout(resolve, simulatedDelay));
              
              return {
                success: true,
                output: [`Executed: ${cmd}`],
                executionTime: simulatedDelay + Math.floor(Math.random() * 10), // Small variance
                error: undefined
              } as CommandResult;
            })
          } as any;

          mockGetBridge.mockReturnValue(mockBridge);

          // Execute all commands
          for (const command of commands) {
            const result = await commandService.executeCommand(
              serverId,
              command,
              undefined,
              { requirePermission: false, auditLog: false }
            );
            
            expect(result.success).toBe(true);
            expect(result.executionTime).toBeGreaterThan(0);
            executionTimes.push(result.executionTime);
          }

          // Verify execution time consistency
          expect(executionTimes).toHaveLength(commands.length);
          
          // All execution times should be reasonably close to the simulated delay
          for (const time of executionTimes) {
            expect(time).toBeGreaterThanOrEqual(simulatedDelay);
            expect(time).toBeLessThanOrEqual(simulatedDelay + 50); // Allow some variance
          }

          // Verify that execution times are reported consistently
          const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
          expect(avgTime).toBeGreaterThan(simulatedDelay - 10);
          expect(avgTime).toBeLessThan(simulatedDelay + 20);
        }
      ), { numRuns: 15 })
    });
  });

  // ============================================================================
  // Additional Command Service Properties
  // ============================================================================

  describe('Command Service Consistency Properties', () => {
    it('should maintain consistent quick action behavior', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          serverId: fc.string({ minLength: 8, maxLength: 32 }),
          actionType: fc.constantFrom('kick', 'broadcast', 'message', 'time', 'weather'),
          parameters: fc.record({
            player: fc.option(fc.string({ minLength: 3, maxLength: 16 }), { nil: undefined }),
            message: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            time: fc.option(fc.constantFrom('day', 'night', 'noon', 'midnight'), { nil: undefined }),
            weather: fc.option(fc.constantFrom('clear', 'rain', 'thunder'), { nil: undefined }),
            reason: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
          })
        }),
        async ({ serverId, actionType, parameters }) => {
          // Create valid parameters for the action type
          let validParameters: any = {};
          
          switch (actionType) {
            case 'kick':
              validParameters = {
                player: parameters.player || 'testplayer',
                reason: parameters.reason || 'Test kick'
              };
              break;
            case 'broadcast':
              validParameters = {
                message: parameters.message || 'Test broadcast'
              };
              break;
            case 'message':
              validParameters = {
                player: parameters.player || 'testplayer',
                message: parameters.message || 'Test message'
              };
              break;
            case 'time':
              validParameters = {
                time: parameters.time || 'day'
              };
              break;
            case 'weather':
              validParameters = {
                weather: parameters.weather || 'clear'
              };
              break;
          }

          const mockBridge = {
            isConnectedToBridge: jest.fn().mockReturnValue(true),
            executeCommand: jest.fn().mockResolvedValue({
              success: true,
              output: [`Quick action ${actionType} executed`],
              executionTime: 100,
              error: undefined
            } as CommandResult)
          } as any;

          mockGetBridge.mockReturnValue(mockBridge);

          // Execute quick action
          const result = await commandService.executeQuickAction(
            serverId,
            { type: actionType as any, parameters: validParameters },
            undefined,
            { requirePermission: false, auditLog: false }
          );

          // Verify consistent quick action behavior
          expect(result).toBeDefined();
          expect(typeof result.success).toBe('boolean');
          expect(Array.isArray(result.output)).toBe(true);
          expect(typeof result.executionTime).toBe('number');

          // Verify bridge was called with appropriate command
          expect(mockBridge.executeCommand).toHaveBeenCalled();
          const calledCommand = mockBridge.executeCommand.mock.calls[0][0];
          expect(typeof calledCommand).toBe('string');
          expect(calledCommand.length).toBeGreaterThan(0);
        }
      ), { numRuns: 20 })
    });
  });
});