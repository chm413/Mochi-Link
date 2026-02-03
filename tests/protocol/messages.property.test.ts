/**
 * Property-Based Tests for U-WBP v2 Protocol Message Format Standardization
 * 
 * **Validates: Requirements 11.1**
 * 
 * This file contains property-based tests that verify the U-WBP v2 protocol
 * message format standardization across all message types and operations.
 */

import * as fc from 'fast-check';
import {
  MessageFactory,
  isUWBPMessage,
  isUWBPRequest,
  isUWBPResponse,
  isUWBPEvent,
  isUWBPSystemMessage,
  UWBP_VERSION,
  RequestOperation,
  EventOperation,
  SystemOperation
} from '../../src/protocol/messages';
import { MessageValidator, ValidationUtils } from '../../src/protocol/validation';
import { MessageSerializer } from '../../src/protocol/serialization';
import { UWBPMessage, UWBPMessageType } from '../../src/types';

// ============================================================================
// Property-Based Test Generators
// ============================================================================

/**
 * Generator for valid message IDs following the recommended format
 */
const messageIdArbitrary = fc.tuple(
  fc.integer({ min: 1000000000000, max: 9999999999999 }), // timestamp-like number
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 9, maxLength: 9 })
).map(([timestamp, suffix]) => `${timestamp}-${suffix}`);

/**
 * Generator for valid server IDs
 */
const serverIdArbitrary = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'),
  { minLength: 1, maxLength: 64 }
);

/**
 * Generator for valid operation strings
 */
const requestOperationArbitrary = fc.constantFrom<RequestOperation>(
  'server.getInfo', 'server.getStatus', 'server.getMetrics', 'server.shutdown', 'server.restart',
  'server.reload', 'server.save', 'player.list', 'player.getInfo', 'player.kick', 'player.ban',
  'player.unban', 'player.message', 'player.teleport', 'whitelist.get', 'whitelist.add',
  'whitelist.remove', 'whitelist.enable', 'whitelist.disable', 'command.execute', 'command.suggest',
  'world.list', 'world.getInfo', 'world.setTime', 'world.setWeather', 'world.broadcast'
);

const eventOperationArbitrary = fc.constantFrom<EventOperation>(
  'player.join', 'player.leave', 'player.chat', 'player.death', 'player.advancement', 'player.move',
  'server.status', 'server.logLine', 'server.metrics', 'alert.tpsLow', 'alert.memoryHigh',
  'alert.playerFlood', 'alert.diskSpace', 'alert.connectionLost'
);

const systemOperationArbitrary = fc.constantFrom<SystemOperation>(
  'ping', 'pong', 'handshake', 'capabilities', 'disconnect', 'error'
);

/**
 * Generator for valid message data objects based on operation type
 */
const createValidDataForOperation = (operation: string): fc.Arbitrary<any> => {
  switch (operation) {
    // Operations that require playerId
    case 'player.kick':
    case 'player.ban':
    case 'player.unban':
    case 'whitelist.add':
    case 'whitelist.remove':
      return fc.record({
        playerId: fc.uuid(),
        playerName: fc.option(fc.string({ minLength: 3, maxLength: 16 })),
        reason: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
      });
    
    // Operations that require command
    case 'command.execute':
      return fc.record({
        command: fc.string({ minLength: 1, maxLength: 100 }),
        sender: fc.option(fc.string({ minLength: 3, maxLength: 16 })),
        timeout: fc.option(fc.integer({ min: 1000, max: 30000 }))
      });
    
    // Operations that require message and playerId
    case 'player.message':
      return fc.record({
        playerId: fc.uuid(),
        message: fc.string({ minLength: 1, maxLength: 256 }),
        playerName: fc.option(fc.string({ minLength: 3, maxLength: 16 }))
      });
    
    // Player join events require player info
    case 'player.join':
      return fc.record({
        player: fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 3, maxLength: 16 }),
          world: fc.string({ minLength: 1, maxLength: 32 }),
          displayName: fc.option(fc.string({ minLength: 3, maxLength: 32 }))
        }),
        firstJoin: fc.boolean()
      });
    
    // Player leave events require player info
    case 'player.leave':
      return fc.record({
        playerId: fc.uuid(),
        playerName: fc.string({ minLength: 3, maxLength: 16 }),
        reason: fc.option(fc.constantFrom('quit', 'kick', 'ban', 'timeout'))
      });
    
    // Player chat events require player and message info
    case 'player.chat':
      return fc.record({
        playerId: fc.uuid(),
        playerName: fc.string({ minLength: 3, maxLength: 16 }),
        message: fc.string({ minLength: 1, maxLength: 256 }),
        channel: fc.option(fc.string({ minLength: 1, maxLength: 32 }))
      });
    
    // Server status events require status
    case 'server.status':
      return fc.record({
        status: fc.constantFrom('online', 'offline', 'starting', 'stopping', 'error'),
        uptime: fc.option(fc.integer({ min: 0, max: 86400000 })),
        playerCount: fc.option(fc.integer({ min: 0, max: 1000 }))
      });
    
    // Handshake requires protocol info
    case 'handshake':
      return fc.record({
        protocolVersion: fc.constant('2.0'),
        serverType: fc.constantFrom('koishi', 'connector'),
        serverId: fc.option(fc.string({ minLength: 1, maxLength: 64 })),
        capabilities: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
      });
    
    // Capabilities requires capabilities array
    case 'capabilities':
      return fc.record({
        capabilities: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
        serverInfo: fc.option(fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          version: fc.string({ minLength: 1, maxLength: 20 }),
          coreType: fc.constantFrom('Java', 'Bedrock'),
          coreName: fc.string({ minLength: 1, maxLength: 20 })
        }))
      });
    
    // Disconnect should have reason
    case 'disconnect':
      return fc.record({
        reason: fc.string({ minLength: 1, maxLength: 100 }),
        code: fc.option(fc.integer({ min: 1000, max: 9999 })),
        reconnect: fc.option(fc.boolean())
      });
    
    // Default: simple valid data
    default:
      return fc.oneof(
        fc.constant({}),
        fc.record({
          timestamp: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
          data: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
        }, { requiredKeys: [] })
      );
  }
};

/**
 * Generator for valid message data objects
 */
const messageDataArbitrary = fc.oneof(
  fc.constant({}), // Empty object is always valid for most operations
  fc.record({
    // Common optional fields that don't break validation
    timestamp: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
    metadata: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
  }, { requiredKeys: [] })
);

/**
 * Generator for valid timestamps
 */
const timestampArbitrary = fc.integer({ 
  min: Date.now() - 86400000, // 24 hours ago
  max: Date.now() + 86400000  // 24 hours from now
});

/**
 * Generator for valid timeout values
 */
const timeoutArbitrary = fc.integer({ min: 1000, max: 300000 });

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property 12: Protocol Message Format Standardization', () => {
  /**
   * **Validates: Requirements 11.1**
   * 
   * Property: All WebSocket messages must conform to U-WBP v2 protocol JSON format standard
   * 
   * This property verifies that any message created through the MessageFactory
   * conforms to the standardized U-WBP v2 format with required fields:
   * - type: string (request|response|event|system)
   * - id: string (unique message identifier)
   * - op: string (operation identifier)
   * - data: any (operation-specific data)
   * - Additional type-specific fields as required
   */
  describe('Message Format Standardization', () => {
    it('should create request messages that conform to U-WBP v2 standard format', async () => {
      await fc.assert(fc.asyncProperty(
        requestOperationArbitrary,
        fc.option(serverIdArbitrary),
        fc.option(timeoutArbitrary),
        async (operation, serverId, timeout) => {
          // Generate valid data for the specific operation
          const dataArbitrary = createValidDataForOperation(operation);
          const data = fc.sample(dataArbitrary, 1)[0];
          
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          const message = MessageFactory.createRequest(operation, data, {
            serverId: serverId || undefined,
            timeout: timeout || undefined
          });

          // Verify basic U-WBP v2 structure
          expect(message).toHaveProperty('type', 'request');
          expect(message).toHaveProperty('id');
          expect(message).toHaveProperty('op', operation);
          expect(message).toHaveProperty('data');
          expect(message).toHaveProperty('version', UWBP_VERSION);
          expect(message).toHaveProperty('timestamp');

          // Verify message ID format
          expect(typeof message.id).toBe('string');
          expect(message.id.length).toBeGreaterThan(0);

          // Verify timestamp is a valid number
          expect(typeof message.timestamp).toBe('number');
          expect(message.timestamp).toBeGreaterThan(0);

          // Verify optional fields
          if (serverId !== null && serverId !== undefined) {
            expect(message.serverId).toBe(serverId);
          }
          if (timeout !== null && timeout !== undefined) {
            expect(message.timeout).toBe(timeout);
          }

          // Verify the message passes type guard
          expect(isUWBPMessage(message)).toBe(true);
          expect(isUWBPRequest(message)).toBe(true);

          // Verify the message can be validated
          const validationResult = MessageValidator.validate(message);
          expect(validationResult.valid).toBe(true);
        }
      ), { numRuns: 100 });
    });

    it('should create response messages that conform to U-WBP v2 standard format', async () => {
      await fc.assert(fc.asyncProperty(
        messageIdArbitrary, // requestId
        requestOperationArbitrary, // operation
        fc.boolean(), // success
        fc.option(fc.string({ minLength: 1, maxLength: 200 })), // error message
        fc.option(serverIdArbitrary),
        async (requestId, operation, success, error, serverId) => {
          // Generate valid data for the specific operation
          const dataArbitrary = createValidDataForOperation(operation);
          const data = fc.sample(dataArbitrary, 1)[0];
          
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          const message = MessageFactory.createResponse(requestId, operation, data, {
            success,
            error: success ? undefined : (error || 'Unknown error'),
            serverId: serverId || undefined
          });

          // Verify basic U-WBP v2 structure
          expect(message).toHaveProperty('type', 'response');
          expect(message).toHaveProperty('id');
          expect(message).toHaveProperty('op', operation);
          expect(message).toHaveProperty('data');
          expect(message).toHaveProperty('version', UWBP_VERSION);
          expect(message).toHaveProperty('timestamp');

          // Verify response-specific fields
          expect(message).toHaveProperty('success', success);
          expect(message).toHaveProperty('requestId', requestId);

          // Verify error field for failed responses
          if (!success) {
            expect(message).toHaveProperty('error');
            expect(typeof message.error).toBe('string');
          }

          // Verify optional serverId
          if (serverId !== null && serverId !== undefined) {
            expect(message.serverId).toBe(serverId);
          }

          // Verify the message passes type guard
          expect(isUWBPMessage(message)).toBe(true);
          expect(isUWBPResponse(message)).toBe(true);

          // Verify the message can be validated
          const validationResult = MessageValidator.validate(message);
          expect(validationResult.valid).toBe(true);
        }
      ), { numRuns: 100 });
    });

    it('should create event messages that conform to U-WBP v2 standard format', async () => {
      await fc.assert(fc.asyncProperty(
        eventOperationArbitrary,
        fc.option(serverIdArbitrary),
        fc.option(fc.string({ minLength: 1, maxLength: 50 })), // custom eventType
        async (operation, serverId, customEventType) => {
          // Generate valid data for the specific operation
          const dataArbitrary = createValidDataForOperation(operation);
          const data = fc.sample(dataArbitrary, 1)[0];
          
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          const message = MessageFactory.createEvent(operation, data, {
            serverId: serverId || undefined,
            eventType: customEventType || undefined
          });

          // Verify basic U-WBP v2 structure
          expect(message).toHaveProperty('type', 'event');
          expect(message).toHaveProperty('id');
          expect(message).toHaveProperty('op', operation);
          expect(message).toHaveProperty('data');
          expect(message).toHaveProperty('version', UWBP_VERSION);
          expect(message).toHaveProperty('timestamp');

          // Verify event-specific fields
          expect(message).toHaveProperty('eventType');
          expect(typeof message.eventType).toBe('string');
          
          // EventType should be custom type or default to operation
          const expectedEventType = customEventType || operation;
          expect(message.eventType).toBe(expectedEventType);

          // Verify optional serverId
          if (serverId !== null && serverId !== undefined) {
            expect(message.serverId).toBe(serverId);
          }

          // Verify the message passes type guard
          expect(isUWBPMessage(message)).toBe(true);
          expect(isUWBPEvent(message)).toBe(true);

          // Verify the message can be validated
          const validationResult = MessageValidator.validate(message);
          expect(validationResult.valid).toBe(true);
        }
      ), { numRuns: 100 });
    });

    it('should create system messages that conform to U-WBP v2 standard format', async () => {
      await fc.assert(fc.asyncProperty(
        systemOperationArbitrary,
        fc.option(serverIdArbitrary),
        async (operation, serverId) => {
          // Generate valid data for the specific operation
          const dataArbitrary = createValidDataForOperation(operation);
          const data = fc.sample(dataArbitrary, 1)[0];
          
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          const message = MessageFactory.createSystemMessage(operation, data, {
            serverId: serverId || undefined
          });

          // Verify basic U-WBP v2 structure
          expect(message).toHaveProperty('type', 'system');
          expect(message).toHaveProperty('id');
          expect(message).toHaveProperty('op', operation);
          expect(message).toHaveProperty('data');
          expect(message).toHaveProperty('version', UWBP_VERSION);
          expect(message).toHaveProperty('timestamp');

          // Verify system-specific fields
          expect(message).toHaveProperty('systemOp', operation);

          // Verify optional serverId
          if (serverId !== null && serverId !== undefined) {
            expect(message.serverId).toBe(serverId);
          }

          // Verify the message passes type guard
          expect(isUWBPMessage(message)).toBe(true);
          expect(isUWBPSystemMessage(message)).toBe(true);

          // Verify the message can be validated
          const validationResult = MessageValidator.validate(message);
          expect(validationResult.valid).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Property: All messages must be serializable and deserializable while maintaining format
   * 
   * This property verifies that messages maintain their U-WBP v2 format through
   * the serialization/deserialization process.
   */
  describe('Serialization Format Preservation', () => {
    it('should preserve U-WBP v2 format through serialization round-trip', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          // Generate different message types with valid data
          requestOperationArbitrary.map(op => ({ type: 'request' as const, op })),
          eventOperationArbitrary.map(op => ({ type: 'event' as const, op })),
          systemOperationArbitrary.map(op => ({ type: 'system' as const, op }))
        ),
        fc.option(serverIdArbitrary),
        async (messageSpec, serverId) => {
          // Generate valid data for the specific operation
          const dataArbitrary = createValidDataForOperation(messageSpec.op);
          const data = fc.sample(dataArbitrary, 1)[0];
          
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          let originalMessage: UWBPMessage;

          // Create message based on type
          switch (messageSpec.type) {
            case 'request':
              originalMessage = MessageFactory.createRequest(messageSpec.op as RequestOperation, data, { serverId: serverId || undefined });
              break;
            case 'event':
              originalMessage = MessageFactory.createEvent(messageSpec.op as EventOperation, data, { serverId: serverId || undefined });
              break;
            case 'system':
              originalMessage = MessageFactory.createSystemMessage(messageSpec.op as SystemOperation, data, { serverId: serverId || undefined });
              break;
            default:
              // This should never happen due to the generator, but TypeScript needs it
              originalMessage = MessageFactory.createRequest('server.getInfo', {});
              break;
          }

          // Serialize the message
          const serializationResult = MessageSerializer.serialize(originalMessage);
          expect(serializationResult.success).toBe(true);
          expect(serializationResult.data).toBeDefined();

          // Deserialize the message
          const deserializationResult = MessageSerializer.deserialize(serializationResult.data as string);
          expect(deserializationResult.success).toBe(true);
          expect(deserializationResult.message).toBeDefined();

          const deserializedMessage = deserializationResult.message!;

          // Verify the deserialized message maintains U-WBP v2 format
          expect(deserializedMessage).toHaveProperty('type', originalMessage.type);
          expect(deserializedMessage).toHaveProperty('id', originalMessage.id);
          expect(deserializedMessage).toHaveProperty('op', originalMessage.op);
          expect(deserializedMessage).toHaveProperty('version', UWBP_VERSION);
          expect(deserializedMessage).toHaveProperty('timestamp');

          // Verify type-specific fields are preserved
          if (originalMessage.type === 'response') {
            expect(deserializedMessage).toHaveProperty('success');
            expect(deserializedMessage).toHaveProperty('requestId');
          } else if (originalMessage.type === 'event') {
            expect(deserializedMessage).toHaveProperty('eventType');
          } else if (originalMessage.type === 'system') {
            expect(deserializedMessage).toHaveProperty('systemOp');
          }

          // Verify the deserialized message passes validation
          const validationResult = MessageValidator.validate(deserializedMessage);
          expect(validationResult.valid).toBe(true);

          // Verify type guards still work
          expect(isUWBPMessage(deserializedMessage)).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Property: All valid U-WBP v2 messages must have consistent field types
   * 
   * This property verifies that all required fields have the correct types
   * and that the message structure is consistent across all message types.
   */
  describe('Field Type Consistency', () => {
    it('should maintain consistent field types across all message types', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          requestOperationArbitrary.map(op => ({ type: 'request' as const, op })),
          eventOperationArbitrary.map(op => ({ type: 'event' as const, op })),
          systemOperationArbitrary.map(op => ({ type: 'system' as const, op }))
        ),
        fc.option(serverIdArbitrary),
        fc.option(timestampArbitrary),
        async (messageSpec, serverId, customTimestamp) => {
          // Generate valid data for the specific operation
          const dataArbitrary = createValidDataForOperation(messageSpec.op);
          const data = fc.sample(dataArbitrary, 1)[0];
          
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          let message: UWBPMessage;

          // Create message based on type
          switch (messageSpec.type) {
            case 'request':
              message = MessageFactory.createRequest(messageSpec.op as RequestOperation, data, { serverId: serverId || undefined });
              break;
            case 'event':
              message = MessageFactory.createEvent(messageSpec.op as EventOperation, data, { serverId: serverId || undefined });
              break;
            case 'system':
              message = MessageFactory.createSystemMessage(messageSpec.op as SystemOperation, data, { serverId: serverId || undefined });
              break;
          }

          // Override timestamp if provided
          if (customTimestamp !== null && customTimestamp !== undefined) {
            message.timestamp = customTimestamp;
          }

          // Verify required field types
          expect(typeof message.type).toBe('string');
          expect(['request', 'response', 'event', 'system']).toContain(message.type);

          expect(typeof message.id).toBe('string');
          expect(message.id.length).toBeGreaterThan(0);

          expect(typeof message.op).toBe('string');
          expect(message.op.length).toBeGreaterThan(0);

          // data can be any type, but should be defined
          expect(message.data).toBeDefined();

          // Optional fields type checking
          if (message.timestamp !== undefined) {
            expect(typeof message.timestamp).toBe('number');
            expect(message.timestamp).toBeGreaterThan(0);
          }

          if (message.serverId !== undefined) {
            expect(typeof message.serverId).toBe('string');
            expect(message.serverId.length).toBeGreaterThan(0);
          }

          if (message.version !== undefined) {
            expect(typeof message.version).toBe('string');
            expect(message.version).toBe(UWBP_VERSION);
          }

          // Type-specific field validation
          if (message.type === 'response') {
            const response = message as any;
            expect(typeof response.success).toBe('boolean');
            expect(typeof response.requestId).toBe('string');
            if (response.error !== undefined) {
              expect(typeof response.error).toBe('string');
            }
          }

          if (message.type === 'event') {
            const event = message as any;
            expect(typeof event.eventType).toBe('string');
            expect(event.eventType.length).toBeGreaterThan(0);
          }

          if (message.type === 'system') {
            const system = message as any;
            expect(typeof system.systemOp).toBe('string');
            expect(['ping', 'pong', 'handshake', 'capabilities', 'disconnect', 'error']).toContain(system.systemOp);
          }

          // Verify the message is valid according to our validator
          expect(ValidationUtils.isValid(message)).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Property: Message IDs must be unique across all generated messages
   * 
   * This property verifies that the message ID generation produces unique
   * identifiers, which is crucial for request-response matching.
   */
  describe('Message ID Uniqueness', () => {
    it('should generate unique message IDs for all messages', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(
          requestOperationArbitrary,
          { minLength: 10, maxLength: 100 }
        ),
        async (operations) => {
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          const generatedIds = new Set<string>();
          const messages: UWBPMessage[] = [];

          // Generate multiple messages
          for (const operation of operations) {
            // Generate valid data for each operation
            const dataArbitrary = createValidDataForOperation(operation);
            const data = fc.sample(dataArbitrary, 1)[0];
            
            const message = MessageFactory.createRequest(operation, data);
            messages.push(message);
            
            // Verify ID uniqueness
            expect(generatedIds.has(message.id)).toBe(false);
            generatedIds.add(message.id);
          }

          // Verify all messages have valid format
          for (const message of messages) {
            expect(isUWBPMessage(message)).toBe(true);
            expect(ValidationUtils.isValid(message)).toBe(true);
          }

          // Verify we generated the expected number of unique IDs
          expect(generatedIds.size).toBe(operations.length);
        }
      ), { numRuns: 50 }); // Reduced runs due to array generation
    });
  });

  /**
   * Property: All messages must be JSON-serializable
   * 
   * This property verifies that all generated messages can be converted
   * to JSON without errors, which is essential for WebSocket transmission.
   */
  describe('JSON Serializability', () => {
    it('should produce JSON-serializable messages for all message types', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          requestOperationArbitrary.map(op => ({ type: 'request' as const, op })),
          eventOperationArbitrary.map(op => ({ type: 'event' as const, op })),
          systemOperationArbitrary.map(op => ({ type: 'system' as const, op }))
        ),
        fc.option(serverIdArbitrary),
        async (messageSpec, serverId) => {
          // Generate valid data for the specific operation
          const dataArbitrary = createValidDataForOperation(messageSpec.op);
          const data = fc.sample(dataArbitrary, 1)[0];
          
          // Feature: minecraft-unified-management, Property 12: 协议消息格式标准化
          let message: UWBPMessage;

          // Create message based on type
          switch (messageSpec.type) {
            case 'request':
              message = MessageFactory.createRequest(messageSpec.op as RequestOperation, data, { serverId: serverId || undefined });
              break;
            case 'event':
              message = MessageFactory.createEvent(messageSpec.op as EventOperation, data, { serverId: serverId || undefined });
              break;
            case 'system':
              message = MessageFactory.createSystemMessage(messageSpec.op as SystemOperation, data, { serverId: serverId || undefined });
              break;
          }

          // Verify the message can be JSON serialized
          let jsonString: string;
          expect(() => {
            jsonString = JSON.stringify(message);
          }).not.toThrow();

          // Verify the JSON can be parsed back
          let parsedMessage: any;
          expect(() => {
            parsedMessage = JSON.parse(jsonString!);
          }).not.toThrow();

          // Verify the parsed message maintains the U-WBP v2 structure
          expect(parsedMessage).toHaveProperty('type', message.type);
          expect(parsedMessage).toHaveProperty('id', message.id);
          expect(parsedMessage).toHaveProperty('op', message.op);
          expect(parsedMessage).toHaveProperty('data');

          // Verify the parsed message is still a valid U-WBP message
          expect(isUWBPMessage(parsedMessage)).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });
});