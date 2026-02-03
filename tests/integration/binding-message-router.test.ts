/**
 * Integration Tests for Binding and Message Router Services
 * 
 * Tests the integration between binding management and message routing
 * to ensure they work together correctly.
 */

import { Context } from 'koishi';
import { BindingManager } from '../../src/services/binding';
import { MessageRouter, IncomingMessage, ServerEvent } from '../../src/services/message-router';
import { AuditService } from '../../src/services/audit';
import { PermissionManager } from '../../src/services/permission';
import { EventService } from '../../src/services/event';

// Mock dependencies
jest.mock('../../src/services/audit');
jest.mock('../../src/services/permission');
jest.mock('../../src/services/event');

describe('Binding and Message Router Integration', () => {
  let ctx: Context;
  let bindingManager: BindingManager;
  let messageRouter: MessageRouter;
  let mockAudit: any;
  let mockPermission: any;
  let mockEventService: any;
  let mockDatabase: any;

  beforeEach(() => {
    // Mock Koishi context
    ctx = {
      logger: jest.fn(() => ({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      })),
      database: {
        get: jest.fn(),
        create: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        eval: jest.fn()
      }
    } as any;

    mockDatabase = ctx.database;
    
    // Create proper mocks
    mockAudit = {
      logger: {
        logServerOperation: jest.fn().mockResolvedValue({})
      }
    } as any;

    mockPermission = {
      checkPermission: jest.fn().mockResolvedValue({ granted: true })
    } as any;

    mockEventService = {
      // Mock event service methods if needed
    } as any;

    bindingManager = new BindingManager(ctx, mockAudit, mockPermission);
    messageRouter = new MessageRouter(ctx, bindingManager, mockEventService);
    
    // Mock the emit method since MessageRouter extends EventEmitter
    jest.spyOn(messageRouter, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Message Routing', () => {
    it('should route messages from group to servers based on bindings', async () => {
      // Setup: Create a binding
      const userId = 'user123';
      const bindingOptions = {
        groupId: 'group123',
        serverId: 'server123',
        bindingType: 'chat' as const,
        config: {
          chat: {
            enabled: true,
            bidirectional: true,
            messageFormat: '[{username}] {content}'
          }
        }
      };

      // Mock database operations for binding creation
      mockDatabase.get.mockResolvedValueOnce([{ id: 'server123' }]); // Server exists
      mockDatabase.get.mockResolvedValueOnce([]); // No existing binding
      mockDatabase.create.mockResolvedValue(undefined);
      const mockBinding = {
        id: 1,
        group_id: 'group123',
        server_id: 'server123',
        binding_type: 'chat',
        config: JSON.stringify(bindingOptions.config),
        created_at: new Date()
      };
      mockDatabase.get.mockResolvedValueOnce([mockBinding]); // Get created binding

      // Create the binding
      const binding = await bindingManager.createBinding(userId, bindingOptions);
      expect(binding.id).toBe(1);

      // Setup: Mock message routing queries
      jest.spyOn(bindingManager, 'getGroupServers').mockResolvedValue(['server123']);
      jest.spyOn(bindingManager, 'queryBindings').mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: bindingOptions.config,
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });
      jest.spyOn(bindingManager, 'updateBindingActivity').mockResolvedValue(undefined);

      // Test: Route a message
      const incomingMessage: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello world!',
        timestamp: Date.now()
      };

      await messageRouter.routeGroupMessage(incomingMessage);

      // Verify: Message was routed correctly
      expect(bindingManager.getGroupServers).toHaveBeenCalledWith('group123', 'chat');
      expect(messageRouter.emit).toHaveBeenCalledWith('outgoing-message', expect.objectContaining({
        serverId: 'server123',
        content: '[TestUser] Hello world!',
        format: 'chat',
        metadata: expect.objectContaining({
          originalGroupId: 'group123',
          originalUserId: 'user456',
          originalUserName: 'TestUser'
        })
      }));
      expect(bindingManager.updateBindingActivity).toHaveBeenCalledWith('group123', 'server123', 'chat');
    });

    it('should route server events to groups based on bindings', async () => {
      // Setup: Mock event routing queries
      jest.spyOn(bindingManager, 'getServerGroups').mockResolvedValue(['group123']);
      jest.spyOn(bindingManager, 'queryBindings').mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'event',
          config: {
            event: {
              enabled: true,
              eventTypes: ['player.join', 'player.leave'],
              format: 'Player {playerName} joined the server!'
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });
      jest.spyOn(bindingManager, 'updateBindingActivity').mockResolvedValue(undefined);

      // Test: Route a server event
      const serverEvent: ServerEvent = {
        serverId: 'server123',
        eventType: 'player.join',
        data: {
          playerId: 'player456',
          playerName: 'NewPlayer'
        },
        timestamp: Date.now()
      };

      await messageRouter.routeServerEvent(serverEvent);

      // Verify: Event was routed correctly
      expect(bindingManager.getServerGroups).toHaveBeenCalledWith('server123', 'event');
      expect(messageRouter.emit).toHaveBeenCalledWith('group-message', expect.objectContaining({
        groupId: 'group123',
        content: 'Player NewPlayer joined the server!',
        metadata: expect.objectContaining({
          serverId: 'server123',
          eventType: 'player.join'
        })
      }));
      expect(bindingManager.updateBindingActivity).toHaveBeenCalledWith('group123', 'server123', 'event');
    });

    it('should handle multiple bindings for the same group', async () => {
      // Setup: Mock multiple server bindings
      jest.spyOn(bindingManager, 'getGroupServers').mockResolvedValue(['server123', 'server456']);
      jest.spyOn(bindingManager, 'queryBindings')
        .mockResolvedValueOnce({
          bindings: [{
            id: 1,
            groupId: 'group123',
            serverId: 'server123',
            bindingType: 'chat',
            config: {
              chat: {
                enabled: true,
                bidirectional: true,
                messageFormat: '[Server1] {username}: {content}'
              }
            },
            status: 'active',
            createdAt: new Date()
          }],
          total: 1
        })
        .mockResolvedValueOnce({
          bindings: [{
            id: 2,
            groupId: 'group123',
            serverId: 'server456',
            bindingType: 'chat',
            config: {
              chat: {
                enabled: true,
                bidirectional: true,
                messageFormat: '[Server2] {username}: {content}'
              }
            },
            status: 'active',
            createdAt: new Date()
          }],
          total: 1
        });
      jest.spyOn(bindingManager, 'updateBindingActivity').mockResolvedValue(undefined);

      // Test: Route a message to multiple servers
      const incomingMessage: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello everyone!',
        timestamp: Date.now()
      };

      await messageRouter.routeGroupMessage(incomingMessage);

      // Verify: Message was routed to both servers
      expect(messageRouter.emit).toHaveBeenCalledTimes(2);
      expect(messageRouter.emit).toHaveBeenCalledWith('outgoing-message', expect.objectContaining({
        serverId: 'server123',
        content: '[Server1] TestUser: Hello everyone!'
      }));
      expect(messageRouter.emit).toHaveBeenCalledWith('outgoing-message', expect.objectContaining({
        serverId: 'server456',
        content: '[Server2] TestUser: Hello everyone!'
      }));
    });

    it('should not route when bindings are disabled', async () => {
      // Setup: Mock disabled binding
      jest.spyOn(bindingManager, 'getGroupServers').mockResolvedValue(['server123']);
      jest.spyOn(bindingManager, 'queryBindings').mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: {
            chat: {
              enabled: false, // Disabled
              bidirectional: true
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });

      // Test: Try to route a message
      const incomingMessage: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello world!',
        timestamp: Date.now()
      };

      await messageRouter.routeGroupMessage(incomingMessage);

      // Verify: Message was not routed
      expect(messageRouter.emit).not.toHaveBeenCalled();
    });
  });

  describe('Binding Management Integration', () => {
    it('should update routing when bindings are modified', async () => {
      const userId = 'user123';
      
      // Setup: Create initial binding
      const bindingOptions = {
        groupId: 'group123',
        serverId: 'server123',
        bindingType: 'chat' as const,
        config: {
          chat: {
            enabled: true,
            bidirectional: true,
            messageFormat: '[{username}] {content}'
          }
        }
      };

      // Mock database operations
      mockDatabase.get.mockResolvedValueOnce([{ id: 'server123' }]); // Server exists
      mockDatabase.get.mockResolvedValueOnce([]); // No existing binding
      mockDatabase.create.mockResolvedValue(undefined);
      const mockBinding = {
        id: 1,
        group_id: 'group123',
        server_id: 'server123',
        binding_type: 'chat',
        config: JSON.stringify(bindingOptions.config),
        created_at: new Date()
      };
      mockDatabase.get.mockResolvedValueOnce([mockBinding]); // Get created binding

      // Create binding
      const binding = await bindingManager.createBinding(userId, bindingOptions);

      // Test: Update binding configuration
      const updateOptions = {
        config: {
          chat: {
            enabled: false,
            bidirectional: false
          }
        }
      };

      mockDatabase.get.mockResolvedValueOnce([mockBinding]); // Get existing binding
      mockDatabase.set.mockResolvedValue(undefined);
      const updatedMockBinding = {
        ...mockBinding,
        config: JSON.stringify({
          chat: { enabled: false, bidirectional: false }
        })
      };
      mockDatabase.get.mockResolvedValueOnce([updatedMockBinding]); // Get updated binding

      const updatedBinding = await bindingManager.updateBinding(userId, binding.id, updateOptions);

      // Verify: Binding was updated
      expect(updatedBinding.config.chat?.enabled).toBe(false);
      expect(updatedBinding.config.chat?.bidirectional).toBe(false);

      // Test: Routing should now be disabled
      jest.spyOn(bindingManager, 'getGroupServers').mockResolvedValue(['server123']);
      jest.spyOn(bindingManager, 'queryBindings').mockResolvedValue({
        bindings: [updatedBinding],
        total: 1
      });

      const incomingMessage: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello world!',
        timestamp: Date.now()
      };

      await messageRouter.routeGroupMessage(incomingMessage);

      // Verify: Message was not routed due to disabled binding
      expect(messageRouter.emit).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle binding service errors gracefully', async () => {
      // Setup: Mock binding service error
      jest.spyOn(bindingManager, 'getGroupServers').mockRejectedValue(new Error('Database connection failed'));

      // Test: Try to route a message
      const incomingMessage: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello world!',
        timestamp: Date.now()
      };

      // Should not throw error
      await expect(messageRouter.routeGroupMessage(incomingMessage)).resolves.not.toThrow();

      // Verify: No messages were routed
      expect(messageRouter.emit).not.toHaveBeenCalled();
    });

    it('should continue routing to other servers if one fails', async () => {
      // Setup: Mock partial failure scenario
      jest.spyOn(bindingManager, 'getGroupServers').mockResolvedValue(['server123', 'server456']);
      jest.spyOn(bindingManager, 'queryBindings')
        .mockResolvedValueOnce({
          bindings: [{
            id: 1,
            groupId: 'group123',
            serverId: 'server123',
            bindingType: 'chat',
            config: {
              chat: {
                enabled: true,
                bidirectional: true
              }
            },
            status: 'active',
            createdAt: new Date()
          }],
          total: 1
        })
        .mockRejectedValueOnce(new Error('Server connection failed')); // Second server fails
      jest.spyOn(bindingManager, 'updateBindingActivity').mockResolvedValue(undefined);

      // Test: Route message
      const incomingMessage: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello world!',
        timestamp: Date.now()
      };

      await messageRouter.routeGroupMessage(incomingMessage);

      // Verify: First server received the message, second failed gracefully
      expect(messageRouter.emit).toHaveBeenCalledTimes(1);
      expect(messageRouter.emit).toHaveBeenCalledWith('outgoing-message', expect.objectContaining({
        serverId: 'server123'
      }));
    });
  });
});