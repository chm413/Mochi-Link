/**
 * Tests for U-WBP v2 Protocol Serialization
 */

import { 
  MessageSerializer, 
  serialize, 
  deserialize, 
  safeDeserialize,
  validateAndSerialize,
  deserializeAndValidate
} from '../../src/protocol/serialization';
import { MessageFactory } from '../../src/protocol/messages';

describe('MessageSerializer', () => {
  describe('serialize', () => {
    it('should serialize a valid message', () => {
      const request = MessageFactory.createRequest('server.getInfo', { test: 'data' });
      const result = MessageSerializer.serialize(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.metadata?.originalSize).toBeGreaterThan(0);
    });

    it('should serialize with pretty formatting', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const result = MessageSerializer.serialize(request, { pretty: true });
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('\n'); // Pretty formatting includes newlines
    });

    it('should include metadata when requested', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const result = MessageSerializer.serialize(request, { includeMetadata: true });
      
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.data as string);
      expect(parsed._metadata).toBeDefined();
      expect(parsed._metadata.serializedAt).toBeDefined();
    });

    it('should handle compression', () => {
      const request = MessageFactory.createRequest('server.getInfo', { 
        largeData: 'x'.repeat(1000) 
      });
      const result = MessageSerializer.serialize(request, { compress: true });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.compressedSize).toBeDefined();
    });

    it('should handle encryption', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const result = MessageSerializer.serialize(request, { 
        encrypt: true, 
        encryptionKey: 'test-key-123' 
      });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.encrypted).toBe(true);
    });

    it('should fail validation in strict mode', () => {
      const invalidMessage = { type: 'invalid' } as any;
      const result = MessageSerializer.serialize(invalidMessage, { 
        validate: true, 
        strictValidation: true 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('deserialize', () => {
    it('should deserialize a valid message', () => {
      const request = MessageFactory.createRequest('server.getInfo', { test: 'data' });
      const serialized = MessageSerializer.serialize(request);
      const result = MessageSerializer.deserialize(serialized.data as string);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message?.type).toBe('request');
      expect(result.message?.op).toBe('server.getInfo');
      expect(result.message?.data.test).toBe('data');
    });

    it('should handle compressed data', () => {
      const request = MessageFactory.createRequest('server.getInfo', { 
        data: 'x'.repeat(1000) 
      });
      const serialized = MessageSerializer.serialize(request, { compress: true });
      const result = MessageSerializer.deserialize(serialized.data as string | Buffer);
      
      expect(result.success).toBe(true);
      expect(result.message?.data.data).toBe('x'.repeat(1000));
      expect(result.metadata?.wasCompressed).toBe(true);
    });

    it('should handle encrypted data', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const key = 'test-key-123';
      const serialized = MessageSerializer.serialize(request, { 
        encrypt: true, 
        encryptionKey: key 
      });
      const result = MessageSerializer.deserialize(serialized.data as string | Buffer, { 
        decrypt: true, 
        decryptionKey: key 
      });
      
      expect(result.success).toBe(true);
      expect(result.message?.op).toBe('server.getInfo');
      expect(result.metadata?.wasEncrypted).toBe(true);
    });

    it('should enforce size limits', () => {
      const largeData = 'x'.repeat(2000000); // 2MB
      const result = MessageSerializer.deserialize(largeData, { maxSize: 1000000 }); // 1MB limit
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Data too large');
    });

    it('should handle invalid JSON', () => {
      const result = MessageSerializer.deserialize('invalid json');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deserialization failed');
    });

    it('should handle validation errors', () => {
      const invalidMessage = JSON.stringify({ type: 'invalid' });
      const result = MessageSerializer.deserialize(invalidMessage, { 
        validate: true, 
        strictValidation: true 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid U-WBP message structure');
    });

    it('should collect warnings in non-strict mode', () => {
      const message = MessageFactory.createRequest('server.getInfo');
      message.timestamp = Date.now() - 120000; // Create a warning
      const serialized = JSON.stringify(message);
      
      const result = MessageSerializer.deserialize(serialized, { 
        validate: true, 
        strictValidation: false 
      });
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });
});

describe('Convenience Functions', () => {
  describe('serialize', () => {
    it('should serialize with default options', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const result = serialize(request);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should throw on serialization error', () => {
      const invalidMessage = { type: 'invalid' } as any;
      expect(() => serialize(invalidMessage)).toThrow();
    });
  });

  describe('deserialize', () => {
    it('should deserialize with default options', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const serialized = serialize(request);
      const deserialized = deserialize(serialized);
      
      expect(deserialized.type).toBe('request');
      expect(deserialized.op).toBe('server.getInfo');
    });

    it('should throw on deserialization error', () => {
      expect(() => deserialize('invalid json')).toThrow();
    });
  });

  describe('safeDeserialize', () => {
    it('should return message on success', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const serialized = serialize(request);
      const result = safeDeserialize(serialized);
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('request');
    });

    it('should return null on error', () => {
      const result = safeDeserialize('invalid json');
      expect(result).toBeNull();
    });
  });

  describe('validateAndSerialize', () => {
    it('should validate and serialize valid message', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const result = validateAndSerialize(request);
      
      expect(typeof result).toBe('string');
    });

    it('should throw on invalid message', () => {
      const invalidMessage = { type: 'invalid' } as any;
      expect(() => validateAndSerialize(invalidMessage)).toThrow();
    });
  });

  describe('deserializeAndValidate', () => {
    it('should deserialize and validate valid message', () => {
      const request = MessageFactory.createRequest('server.getInfo');
      const serialized = serialize(request);
      const result = deserializeAndValidate(serialized);
      
      expect(result.type).toBe('request');
      expect(result.op).toBe('server.getInfo');
    });

    it('should throw on invalid message', () => {
      const invalidMessage = JSON.stringify({ type: 'invalid' });
      expect(() => deserializeAndValidate(invalidMessage)).toThrow();
    });
  });
});