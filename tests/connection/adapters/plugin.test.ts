/**
 * Plugin Connection Adapter Tests
 * 
 * Unit tests for the plugin connection adapter functionality.
 */

import WebSocket from 'ws';
import { PluginConnectionAdapter } from '../../../src/connection/adapters/plugin';
import { UWBPMessage, ConnectionConfig } from '../../../src/types';

// Mock WebSocket
jest.mock('ws');

// Mock MessageSerializer
jest.mock('../../../src/protocol/serialization', () => ({
  MessageSerializer: {
    serialize: jest.fn().mockReturnValue({ success: true, data: '{}' }),
    deserialize: jest.fn().mockReturnValue({ success: true, message: {} })
  }
}));

describe('PluginConnectionAdapter', () => {
  let adapter: PluginConnectionAdapter;
  let mockWs: any;
  const serverId = 'test-server-1';

  beforeEach(() => {
    adapter = new PluginConnectionAdapter(serverId);
    
    // Create mock WebSocket
    mockWs = {
      readyState: WebSocket.OPEN,
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      ping: jest.fn()
    };
    
    // Mock WebSocket constructor
    (WebSocket as any).mockImplementation(() => mockWs);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid plugin config', async () => {
      const config: ConnectionConfig = {
        plugin: {
          host: 'localhost',
          port: 8080,
          ssl: false
        }
      };

      // Setup WebSocket mock to emit open event
      mockWs.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await adapter.connect(config);

      expect(adapter.isConnected).toBe(true);
      expect(adapter.mode).toBe('plugin');
      expect(adapter.serverId).toBe(serverId);
    });

    it('should fail to connect with invalid config', async () => {
      const config: ConnectionConfig = {};

      await expect(adapter.connect(config)).rejects.toThrow('Plugin configuration is required');
    });

    it('should disconnect gracefully', async () => {
      const config: ConnectionConfig = {
        plugin: {
          host: 'localhost',
          port: 8080,
          ssl: false
        }
      };

      // Setup connection
      mockWs.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await adapter.connect(config);
      
      // Mock send for disconnect message
      mockWs.send.mockImplementation((data: string, callback?: () => void) => {
        if (callback) callback();
      });

      await adapter.disconnect();

      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Normal closure');
      expect(adapter.isConnected).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      const config: ConnectionConfig = {
        plugin: {
          host: 'localhost',
          port: 8080,
          ssl: false
        }
      };

      mockWs.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await adapter.connect(config);
    });

    it('should send messages successfully', async () => {
      const message: UWBPMessage = {
        type: 'request',
        id: 'test-1',
        op: 'server.info',
        data: {},
        timestamp: Date.now(),
        serverId,
        version: '2.0'
      };

      mockWs.send.mockImplementation((data: string, callback?: () => void) => {
        if (callback) callback();
      });

      await adapter.sendMessage(message);

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should handle command execution', async () => {
      const command = 'list';

      // Mock response handling
      let messageHandler: ((data: Buffer) => void) | undefined;
      mockWs.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'message') {
          messageHandler = callback;
        }
      });

      let sentRequestId: string | undefined;
      mockWs.send.mockImplementation((data: string, callback?: () => void) => {
        if (callback) callback();
        
        // Extract request ID from the command that would be sent
        sentRequestId = `cmd-${Date.now()}-test123`;
        
        // Simulate immediate response with correct format
        if (messageHandler) {
          const response = {
            type: 'response',
            id: `response-${Date.now()}`,
            requestId: sentRequestId, // This is the key field the adapter expects
            success: true,
            data: {
              output: ['There are 0 of a max of 20 players online'],
              executionTime: 100
            },
            timestamp: Date.now(),
            serverId: adapter.serverId,
            version: '2.0'
          };
          
          // Simulate the response immediately
          process.nextTick(() => {
            messageHandler!(Buffer.from(JSON.stringify(response)));
          });
        }
      });

      // Mock the sendRequestAndWait method directly to avoid complex mocking
      const originalSendRequestAndWait = (adapter as any).sendRequestAndWait;
      (adapter as any).sendRequestAndWait = jest.fn().mockResolvedValue({
        success: true,
        data: {
          output: ['There are 0 of a max of 20 players online'],
          executionTime: 100
        }
      });

      const result = await adapter.sendCommand(command);

      expect(result.success).toBe(true);
      expect(result.output).toContain('There are 0 of a max of 20 players online');
      
      // Restore original method
      (adapter as any).sendRequestAndWait = originalSendRequestAndWait;
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy when connected', async () => {
      const config: ConnectionConfig = {
        plugin: {
          host: 'localhost',
          port: 8080,
          ssl: false
        }
      };

      mockWs.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await adapter.connect(config);

      expect(adapter.isHealthy()).toBe(true);
    });

    it('should report unhealthy when disconnected', () => {
      expect(adapter.isHealthy()).toBe(false);
    });
  });

  describe('Connection Info', () => {
    it('should provide accurate connection information', async () => {
      const config: ConnectionConfig = {
        plugin: {
          host: 'localhost',
          port: 8080,
          ssl: false
        }
      };

      mockWs.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await adapter.connect(config);

      const info = adapter.getConnectionInfo();

      expect(info.serverId).toBe(serverId);
      expect(info.mode).toBe('plugin');
      expect(info.isConnected).toBe(true);
      expect(info.capabilities).toContain('realtime_events');
      expect(info.capabilities).toContain('command_execution');
    });
  });
});