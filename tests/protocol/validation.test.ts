/**
 * Tests for U-WBP v2 Protocol Message Validation
 */

import { MessageValidator, ValidationUtils } from '../../src/protocol/validation';
import { MessageFactory } from '../../src/protocol/messages';

describe('MessageValidator', () => {
  describe('validate', () => {
    it('should validate a correct request message', () => {
      const request = MessageFactory.createRequest('server.getInfo', { test: 'data' });
      const result = MessageValidator.validate(request);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a correct response message', () => {
      const response = MessageFactory.createResponse('req-123', 'server.getInfo', { info: 'data' });
      const result = MessageValidator.validate(response);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a correct event message', () => {
      const event = MessageFactory.createEvent('player.join', { player: { id: '123', name: 'Test' } });
      const result = MessageValidator.validate(event);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a correct system message', () => {
      const system = MessageFactory.createSystemMessage('ping', { timestamp: Date.now() });
      const result = MessageValidator.validate(system);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid message structure', () => {
      const result = MessageValidator.validate({});
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject message with invalid type', () => {
      const invalidMessage = {
        type: 'invalid',
        id: 'test-123',
        op: 'server.getInfo',
        data: {}
      };
      
      const result = MessageValidator.validate(invalidMessage);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TYPE')).toBe(true);
    });

    it('should reject message with missing required fields', () => {
      const invalidMessage = {
        type: 'request',
        // missing id, op, data
      };
      
      const result = MessageValidator.validate(invalidMessage);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject message with invalid operation format', () => {
      const invalidMessage = {
        type: 'request',
        id: 'test-123',
        op: 'invalid-operation-format',
        data: {}
      };
      
      const result = MessageValidator.validate(invalidMessage);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_OP_FORMAT')).toBe(true);
    });

    it('should reject response without requestId', () => {
      const invalidResponse = {
        type: 'response',
        id: 'test-123',
        op: 'server.getInfo',
        data: {},
        success: true
        // missing requestId
      };
      
      const result = MessageValidator.validate(invalidResponse);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_REQUEST_ID')).toBe(true);
    });

    it('should reject event without eventType', () => {
      const invalidEvent = {
        type: 'event',
        id: 'test-123',
        op: 'player.join',
        data: {}
        // missing eventType
      };
      
      const result = MessageValidator.validate(invalidEvent);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_EVENT_TYPE')).toBe(true);
    });

    it('should handle data size limits', () => {
      const largeData = 'x'.repeat(2000000); // 2MB string
      const message = MessageFactory.createRequest('server.getInfo', { large: largeData });
      
      const result = MessageValidator.validate(message);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DATA_TOO_LARGE')).toBe(true);
    });

    it('should warn about timestamp drift', () => {
      const message = MessageFactory.createRequest('server.getInfo', {});
      message.timestamp = Date.now() - 120000; // 2 minutes ago
      
      const result = MessageValidator.validate(message);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'TIMESTAMP_DRIFT')).toBe(true);
    });

    it('should validate server ID format', () => {
      const message = MessageFactory.createRequest('server.getInfo', {}, { serverId: 'invalid server id!' });
      
      const result = MessageValidator.validate(message);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_SERVER_ID_FORMAT')).toBe(true);
    });

    it('should validate timeout ranges', () => {
      const message = MessageFactory.createRequest('server.getInfo', {}, { timeout: 500 }); // Too short
      
      const result = MessageValidator.validate(message);
      
      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.warnings.some(w => w.code === 'TIMEOUT_TOO_SHORT')).toBe(true);
    });
  });

  describe('operation-specific validation', () => {
    it('should validate player.kick requires playerId', () => {
      const request = MessageFactory.createRequest('player.kick', {}); // Missing playerId
      
      const result = MessageValidator.validate(request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_PLAYER_ID')).toBe(true);
    });

    it('should validate command.execute requires command', () => {
      const request = MessageFactory.createRequest('command.execute', {}); // Missing command
      
      const result = MessageValidator.validate(request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_COMMAND')).toBe(true);
    });

    it('should validate player.join event requires player info', () => {
      const event = MessageFactory.createEvent('player.join', {}); // Missing player info
      
      const result = MessageValidator.validate(event);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_PLAYER_INFO')).toBe(true);
    });

    it('should validate handshake requires protocol info', () => {
      const system = MessageFactory.createSystemMessage('handshake', {}); // Missing required fields
      
      const result = MessageValidator.validate(system);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_HANDSHAKE_INFO')).toBe(true);
    });
  });
});

describe('ValidationUtils', () => {
  describe('isValid', () => {
    it('should return true for valid messages', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      expect(ValidationUtils.isValid(request)).toBe(true);
    });

    it('should return false for invalid messages', () => {
      expect(ValidationUtils.isValid({})).toBe(false);
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw for valid messages', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      expect(() => ValidationUtils.validateOrThrow(request)).not.toThrow();
    });

    it('should throw for invalid messages', () => {
      expect(() => ValidationUtils.validateOrThrow({})).toThrow();
    });
  });

  describe('getValidationSummary', () => {
    it('should return "Valid" for valid messages', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const result = MessageValidator.validate(request);
      
      expect(ValidationUtils.getValidationSummary(result)).toBe('Valid');
    });

    it('should return appropriate summary for invalid messages', () => {
      const result = MessageValidator.validate({});
      const summary = ValidationUtils.getValidationSummary(result);
      
      expect(summary).toContain('Invalid');
      expect(summary).toContain('error');
    });

    it('should return appropriate summary for messages with warnings', () => {
      const message = MessageFactory.createRequest('server.getInfo');
      message.timestamp = Date.now() - 120000; // Create a warning
      
      const result = MessageValidator.validate(message);
      const summary = ValidationUtils.getValidationSummary(result);
      
      expect(summary).toContain('Valid with');
      expect(summary).toContain('warning');
    });
  });
});