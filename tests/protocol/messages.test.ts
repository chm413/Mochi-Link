/**
 * Tests for U-WBP v2 Protocol Message Definitions
 */

import {
  MessageFactory,
  MessageUtils,
  isUWBPMessage,
  isUWBPRequest,
  isUWBPResponse,
  isUWBPEvent,
  isUWBPSystemMessage,
  UWBP_VERSION
} from '../../src/protocol/messages';

describe('MessageFactory', () => {
  describe('createRequest', () => {
    it('should create a valid request message', () => {
      const request = MessageFactory.createRequest('server.getInfo', { test: 'data' });
      
      expect(request.type).toBe('request');
      expect(request.op).toBe('server.getInfo');
      expect(request.data).toEqual({ test: 'data' });
      expect(request.version).toBe(UWBP_VERSION);
      expect(request.id).toBeDefined();
      expect(request.timestamp).toBeDefined();
    });

    it('should include optional parameters', () => {
      const request = MessageFactory.createRequest('player.kick', { playerId: '123' }, {
        serverId: 'test-server',
        timeout: 5000
      });
      
      expect(request.serverId).toBe('test-server');
      expect(request.timeout).toBe(5000);
    });
  });

  describe('createResponse', () => {
    it('should create a successful response', () => {
      const response = MessageFactory.createResponse('req-123', 'server.getInfo', { info: 'data' });
      
      expect(response.type).toBe('response');
      expect(response.op).toBe('server.getInfo');
      expect(response.requestId).toBe('req-123');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ info: 'data' });
    });

    it('should create an error response', () => {
      const response = MessageFactory.createResponse('req-123', 'server.getInfo', {}, {
        success: false,
        error: 'Server not found'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Server not found');
    });
  });

  describe('createEvent', () => {
    it('should create a valid event message', () => {
      const event = MessageFactory.createEvent('player.join', { 
        player: { id: '123', name: 'TestPlayer' } 
      });
      
      expect(event.type).toBe('event');
      expect(event.op).toBe('player.join');
      expect(event.eventType).toBe('player.join');
      expect(event.data.player.name).toBe('TestPlayer');
    });
  });

  describe('createSystemMessage', () => {
    it('should create a valid system message', () => {
      const message = MessageFactory.createSystemMessage('ping', { timestamp: Date.now() });
      
      expect(message.type).toBe('system');
      expect(message.op).toBe('ping');
      expect(message.systemOp).toBe('ping');
      expect(message.data.timestamp).toBeDefined();
    });
  });

  describe('createError', () => {
    it('should create an error response', () => {
      const error = MessageFactory.createError('req-123', 'server.getInfo', 'Not found', 'NOT_FOUND');
      
      expect(error.type).toBe('response');
      expect(error.success).toBe(false);
      expect(error.error).toBe('Not found');
      expect(error.data.code).toBe('NOT_FOUND');
    });
  });
});

describe('Message Type Guards', () => {
  it('should identify U-WBP messages correctly', () => {
    const validMessage = {
      type: 'request',
      id: 'test-123',
      op: 'server.getInfo',
      data: {}
    };
    
    expect(isUWBPMessage(validMessage)).toBe(true);
    expect(isUWBPMessage({})).toBe(false);
    expect(isUWBPMessage(null)).toBe(false);
  });

  it('should identify request messages correctly', () => {
    const request = MessageFactory.createRequest('server.getInfo');
    const response = MessageFactory.createResponse('123', 'server.getInfo');
    
    expect(isUWBPRequest(request)).toBe(true);
    expect(isUWBPRequest(response)).toBe(false);
  });

  it('should identify response messages correctly', () => {
    const response = MessageFactory.createResponse('123', 'server.getInfo');
    const request = MessageFactory.createRequest('server.getInfo');
    
    expect(isUWBPResponse(response)).toBe(true);
    expect(isUWBPResponse(request)).toBe(false);
  });

  it('should identify event messages correctly', () => {
    const event = MessageFactory.createEvent('player.join');
    const request = MessageFactory.createRequest('server.getInfo');
    
    expect(isUWBPEvent(event)).toBe(true);
    expect(isUWBPEvent(request)).toBe(false);
  });

  it('should identify system messages correctly', () => {
    const system = MessageFactory.createSystemMessage('ping');
    const request = MessageFactory.createRequest('server.getInfo');
    
    expect(isUWBPSystemMessage(system)).toBe(true);
    expect(isUWBPSystemMessage(request)).toBe(false);
  });
});

describe('MessageUtils', () => {
  describe('getOperationCategory', () => {
    it('should extract operation category correctly', () => {
      expect(MessageUtils.getOperationCategory('server.getInfo')).toBe('server');
      expect(MessageUtils.getOperationCategory('player.kick')).toBe('player');
      expect(MessageUtils.getOperationCategory('invalid')).toBe('invalid');
    });
  });

  describe('getOperationAction', () => {
    it('should extract operation action correctly', () => {
      expect(MessageUtils.getOperationAction('server.getInfo')).toBe('getInfo');
      expect(MessageUtils.getOperationAction('player.kick')).toBe('kick');
      expect(MessageUtils.getOperationAction('invalid')).toBe('unknown');
    });
  });

  describe('requiresAuth', () => {
    it('should identify operations that require authentication', () => {
      expect(MessageUtils.requiresAuth('server.shutdown')).toBe(true);
      expect(MessageUtils.requiresAuth('player.kick')).toBe(true);
      expect(MessageUtils.requiresAuth('server.getInfo')).toBe(false);
      expect(MessageUtils.requiresAuth('player.list')).toBe(false);
    });
  });

  describe('isModifyingOperation', () => {
    it('should identify modifying operations', () => {
      expect(MessageUtils.isModifyingOperation('server.shutdown')).toBe(true);
      expect(MessageUtils.isModifyingOperation('player.kick')).toBe(true);
      expect(MessageUtils.isModifyingOperation('server.getInfo')).toBe(false);
      expect(MessageUtils.isModifyingOperation('player.list')).toBe(false);
    });
  });

  describe('getExpectedResponseTime', () => {
    it('should return appropriate timeouts for operations', () => {
      expect(MessageUtils.getExpectedResponseTime('server.shutdown')).toBe(30000);
      expect(MessageUtils.getExpectedResponseTime('server.restart')).toBe(60000);
      expect(MessageUtils.getExpectedResponseTime('server.getInfo')).toBe(3000);
    });
  });
});