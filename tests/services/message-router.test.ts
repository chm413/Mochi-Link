/**
 * Unit Tests for Message Router Service
 * 
 * Tests the message routing functionality between groups and servers
 * including filtering, formatting, and rate limiting.
 */

import { Context } from 'koishi';
import { MessageRouter, IncomingMessage, ServerEvent } from '../../src/services/message-router';
import { BindingManager } from '../../src/services/binding';
import { EventService } from '../../src/services/event';
import { AuditService } from '../../src/services/audit';

// Mock dependencies
jest.mock('../../src/services/binding');
jest.mock('../../src/services/event');
jest.mock('../../src/services/audit');

describe('MessageRouter', () => {
  let ctx: Context;
  let messageRouter: MessageRouter;
  let mockBindingManager: jest.Mocked<BindingManager>;
  let mockEventService: jest.Mocked<EventService>;
  let mockAudit: jest.Mocked<AuditService>;

  beforeEach(() => {
    // Mock Koishi context
    ctx = {
      logger: jest.fn(() => ({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      })),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockBindingManager = new BindingManager(ctx, {} as any, {} as any) as jest.Mocked<BindingManager>;
    mockEventService = new EventService(ctx, {} as any) as jest.Mocked<EventService>;
    mockAudit = new AuditService(ctx) as jest.Mocked<AuditService>;

    messageRouter = new MessageRouter(ctx, mockBindingManager, mockEventService);
    
    // Mock the emit method since MessageRouter extends EventEmitter
    jest.spyOn(messageRouter, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('routeGroupMessage', () => {
    const incomingMessage: IncomingMessage = {
      groupId: 'group123',
      userId: 'user456',
      userName: 'TestUser',
      content: 'Hello world!',
      timestamp: Date.now(),
      messageId: 'msg123'
    };

    it('should route message to bound servers', async () => {
      // Mock binding query
      mockBindingManager.getGroupServers.mockResolvedValue(['server123', 'server456']);
      mockBindingManager.queryBindings.mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: {
            chat: {
              enabled: true,
              bidirectional: true,
              messageFormat: '[{username}] {content}'
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });
      mockBindingManager.updateBindingActivity.mockResolvedValue(undefined);

      await messageRouter.routeGroupMessage(incomingMessage);

      expect(mockBindingManager.getGroupServers).toHaveBeenCalledWith('group123', 'chat');
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
    });

    it('should not route when no bindings exist', async () => {
      mockBindingManager.getGroupServers.mockResolvedValue([]);

      await messageRouter.routeGroupMessage(incomingMessage);

      expect(ctx.emit).not.toHaveBeenCalled();
      expect(messageRouter.emit).not.toHaveBeenCalled();
    });

    it('should apply message filters', async () => {
      mockBindingManager.getGroupServers.mockResolvedValue(['server123']);
      mockBindingManager.queryBindings.mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: {
            chat: {
              enabled: true,
              bidirectional: true,
              filterRules: [{
                type: 'keyword',
                pattern: 'badword',
                action: 'block'
              }]
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });

      const messageWithBadWord = {
        ...incomingMessage,
        content: 'This contains badword!'
      };

      await messageRouter.routeGroupMessage(messageWithBadWord);

      // Message should be blocked, so no emit should occur
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(messageRouter.emit).not.toHaveBeenCalled();
    });

    it('should transform message content with filters', async () => {
      mockBindingManager.getGroupServers.mockResolvedValue(['server123']);
      mockBindingManager.queryBindings.mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: {
            chat: {
              enabled: true,
              bidirectional: true,
              filterRules: [{
                type: 'keyword',
                pattern: 'badword',
                action: 'transform',
                replacement: '***'
              }]
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });

      const messageWithBadWord = {
        ...incomingMessage,
        content: 'This contains badword!'
      };

      await messageRouter.routeGroupMessage(messageWithBadWord);

      expect(messageRouter.emit).toHaveBeenCalledWith('outgoing-message', expect.objectContaining({
        content: expect.stringContaining('This contains ***!')
      }));
    });

    it('should respect rate limiting', async () => {
      mockBindingManager.getGroupServers.mockResolvedValue(['server123']);
      mockBindingManager.queryBindings.mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'chat',
          config: {
            chat: {
              enabled: true,
              bidirectional: true,
              rateLimiting: {
                maxMessages: 1,
                windowMs: 60000 // 1 minute
              }
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });

      // First message should go through
      await messageRouter.routeGroupMessage(incomingMessage);
      expect(messageRouter.emit).toHaveBeenCalledTimes(1);

      // Second message should be rate limited
      await messageRouter.routeGroupMessage({
        ...incomingMessage,
        content: 'Second message',
        timestamp: Date.now()
      });
      expect(messageRouter.emit).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('routeServerEvent', () => {
    const serverEvent: ServerEvent = {
      serverId: 'server123',
      eventType: 'player.join',
      data: {
        playerId: 'player456',
        playerName: 'NewPlayer'
      },
      timestamp: Date.now()
    };

    it('should route event to bound groups', async () => {
      mockBindingManager.getServerGroups.mockResolvedValue(['group123', 'group456']);
      mockBindingManager.queryBindings.mockResolvedValue({
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
      mockBindingManager.updateBindingActivity.mockResolvedValue(undefined);

      await messageRouter.routeServerEvent(serverEvent);

      expect(mockBindingManager.getServerGroups).toHaveBeenCalledWith('server123', 'event');
      expect(messageRouter.emit).toHaveBeenCalledWith('group-message', expect.objectContaining({
        groupId: 'group123',
        content: 'Player NewPlayer joined the server!',
        metadata: expect.objectContaining({
          serverId: 'server123',
          eventType: 'player.join'
        })
      }));
    });

    it('should not route when event type is not allowed', async () => {
      mockBindingManager.getServerGroups.mockResolvedValue(['group123']);
      mockBindingManager.queryBindings.mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'event',
          config: {
            event: {
              enabled: true,
              eventTypes: ['player.leave'], // Only leave events allowed
              format: 'Player left!'
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });

      await messageRouter.routeServerEvent(serverEvent);

      expect(ctx.emit).not.toHaveBeenCalled();
      expect(messageRouter.emit).not.toHaveBeenCalled();
    });

    it('should not route when event binding is disabled', async () => {
      mockBindingManager.getServerGroups.mockResolvedValue(['group123']);
      mockBindingManager.queryBindings.mockResolvedValue({
        bindings: [{
          id: 1,
          groupId: 'group123',
          serverId: 'server123',
          bindingType: 'event',
          config: {
            event: {
              enabled: false, // Disabled
              eventTypes: ['player.join'],
              format: 'Player joined!'
            }
          },
          status: 'active',
          createdAt: new Date()
        }],
        total: 1
      });

      await messageRouter.routeServerEvent(serverEvent);

      expect(ctx.emit).not.toHaveBeenCalled();
      expect(messageRouter.emit).not.toHaveBeenCalled();
    });
  });

  describe('message filtering', () => {
    it('should block messages with regex filter', async () => {
      const filters = [{
        type: 'regex' as const,
        pattern: '\\b(spam|advertisement)\\b',
        action: 'block' as const
      }];

      // Use reflection to access private method for testing
      const applyFilters = (messageRouter as any).applyMessageFilters.bind(messageRouter);
      
      const result1 = applyFilters('This is spam content', filters);
      const result2 = applyFilters('This is normal content', filters);

      expect(result1).toBeNull(); // Blocked
      expect(result2).toBe('This is normal content'); // Allowed
    });

    it('should transform messages with regex filter', async () => {
      const filters = [{
        type: 'regex' as const,
        pattern: '\\b(badword)\\b',
        action: 'transform' as const,
        replacement: '***'
      }];

      const applyFilters = (messageRouter as any).applyMessageFilters.bind(messageRouter);
      
      const result = applyFilters('This contains badword in it', filters);

      expect(result).toBe('This contains *** in it');
    });

    it('should handle length filter', async () => {
      const filters = [{
        type: 'length' as const,
        pattern: '10', // Max 10 characters
        action: 'transform' as const
      }];

      const applyFilters = (messageRouter as any).applyMessageFilters.bind(messageRouter);
      
      const result = applyFilters('This is a very long message', filters);

      expect(result).toBe('This is a ...');
      expect(result?.length).toBeLessThanOrEqual(13); // 10 + '...'
    });
  });

  describe('message formatting', () => {
    it('should format message with custom template', async () => {
      const message: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello world!',
        timestamp: 1234567890000
      };

      const formatMessage = (messageRouter as any).formatMessage.bind(messageRouter);
      
      const result = formatMessage(
        message.content,
        message,
        '[{group}] {username}: {content} at {time}'
      );

      expect(result).toContain('[group123]');
      expect(result).toContain('TestUser:');
      expect(result).toContain('Hello world!');
      expect(result).toContain('at ');
    });

    it('should use default format when no template provided', async () => {
      const message: IncomingMessage = {
        groupId: 'group123',
        userId: 'user456',
        userName: 'TestUser',
        content: 'Hello world!',
        timestamp: Date.now()
      };

      const formatMessage = (messageRouter as any).formatMessage.bind(messageRouter);
      
      const result = formatMessage(message.content, message);

      expect(result).toBe('[TestUser] Hello world!');
    });
  });

  describe('event formatting', () => {
    it('should format event with custom template', async () => {
      const event: ServerEvent = {
        serverId: 'server123',
        eventType: 'player.join',
        data: {
          playerId: 'player456',
          playerName: 'NewPlayer'
        },
        timestamp: 1234567890000
      };

      const formatEventMessage = (messageRouter as any).formatEventMessage.bind(messageRouter);
      
      const result = formatEventMessage(
        event,
        'Player {playerName} joined {server} at {time}'
      );

      expect(result).toContain('Player NewPlayer');
      expect(result).toContain('joined server123');
      expect(result).toContain('at ');
    });

    it('should use default format when no template provided', async () => {
      const event: ServerEvent = {
        serverId: 'server123',
        eventType: 'player.join',
        data: { playerName: 'NewPlayer' },
        timestamp: Date.now()
      };

      const formatEventMessage = (messageRouter as any).formatEventMessage.bind(messageRouter);
      
      const result = formatEventMessage(event);

      expect(result).toContain('[server123]');
      expect(result).toContain('player.join:');
      expect(result).toContain('playerName');
    });
  });

  describe('rate limiting', () => {
    it('should allow messages within rate limit', async () => {
      const checkRateLimit = (messageRouter as any).checkRateLimit.bind(messageRouter);
      
      const config = { maxMessages: 5, windowMs: 60000 };
      
      // First 5 messages should be allowed
      for (let i = 0; i < 5; i++) {
        const allowed = await checkRateLimit('group123', 'server123', config);
        expect(allowed).toBe(true);
      }
    });

    it('should block messages exceeding rate limit', async () => {
      const checkRateLimit = (messageRouter as any).checkRateLimit.bind(messageRouter);
      
      const config = { maxMessages: 2, windowMs: 60000 };
      
      // First 2 messages should be allowed
      expect(await checkRateLimit('group123', 'server123', config)).toBe(true);
      expect(await checkRateLimit('group123', 'server123', config)).toBe(true);
      
      // Third message should be blocked
      expect(await checkRateLimit('group123', 'server123', config)).toBe(false);
    });

    it('should reset rate limit after window expires', async () => {
      const checkRateLimit = (messageRouter as any).checkRateLimit.bind(messageRouter);
      
      const config = { maxMessages: 1, windowMs: 100 }; // 100ms window
      
      // First message allowed
      expect(await checkRateLimit('group123', 'server123', config)).toBe(true);
      
      // Second message blocked
      expect(await checkRateLimit('group123', 'server123', config)).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be allowed again
      expect(await checkRateLimit('group123', 'server123', config)).toBe(true);
    });
  });

  describe('getRoutingStats', () => {
    it('should return current routing statistics', () => {
      const stats = messageRouter.getRoutingStats();

      expect(stats).toHaveProperty('messagesRouted24h');
      expect(stats).toHaveProperty('eventsRouted24h');
      expect(stats).toHaveProperty('routingErrors24h');
      expect(stats).toHaveProperty('activeRoutes');
      expect(stats).toHaveProperty('messagesByGroup');
      expect(stats).toHaveProperty('messagesByServer');
    });
  });

  describe('resetDailyStats', () => {
    it('should reset daily statistics', () => {
      // Set some stats
      const stats = messageRouter.getRoutingStats();
      (messageRouter as any).routingStats.messagesRouted24h = 100;
      (messageRouter as any).routingStats.eventsRouted24h = 50;
      (messageRouter as any).routingStats.routingErrors24h = 5;

      messageRouter.resetDailyStats();

      const newStats = messageRouter.getRoutingStats();
      expect(newStats.messagesRouted24h).toBe(0);
      expect(newStats.eventsRouted24h).toBe(0);
      expect(newStats.routingErrors24h).toBe(0);
      expect(Object.keys(newStats.messagesByGroup)).toHaveLength(0);
      expect(Object.keys(newStats.messagesByServer)).toHaveLength(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with low error rate', async () => {
      mockBindingManager.getBindingStats.mockResolvedValue({
        totalBindings: 10,
        activeBindings: 8,
        bindingsByType: { chat: 4, event: 4, command: 0, monitoring: 0 },
        bindingsByGroup: {},
        bindingsByServer: {},
        messageCount24h: 1000,
        errorCount24h: 10
      });

      // Set some routing stats
      (messageRouter as any).routingStats.messagesRouted24h = 1000;
      (messageRouter as any).routingStats.eventsRouted24h = 500;
      (messageRouter as any).routingStats.routingErrors24h = 50; // 3.3% error rate

      const health = await messageRouter.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.details.activeRoutes).toBe(8);
      expect(health.details.messagesRouted24h).toBe(1000);
      expect(health.details.eventsRouted24h).toBe(500);
    });

    it('should return degraded status with high error rate', async () => {
      mockBindingManager.getBindingStats.mockResolvedValue({
        totalBindings: 10,
        activeBindings: 8,
        bindingsByType: { chat: 4, event: 4, command: 0, monitoring: 0 },
        bindingsByGroup: {},
        bindingsByServer: {},
        messageCount24h: 1000,
        errorCount24h: 10
      });

      // Set high error rate
      (messageRouter as any).routingStats.messagesRouted24h = 100;
      (messageRouter as any).routingStats.eventsRouted24h = 50;
      (messageRouter as any).routingStats.routingErrors24h = 20; // 13.3% error rate

      const health = await messageRouter.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.details.errorRate).toBeGreaterThan(0.1);
    });

    it('should return unhealthy status on error', async () => {
      mockBindingManager.getBindingStats.mockRejectedValue(new Error('Service unavailable'));

      const health = await messageRouter.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBe('Service unavailable');
    });
  });
});