/**
 * WebSocket Connection Tests
 * 
 * Unit tests for WebSocket connection implementation.
 */

import WebSocket from 'ws';
import { WebSocketConnection } from '../../src/websocket/connection';
import { MessageFactory } from '../../src/protocol/messages';

// Mock WebSocket
jest.mock('ws');

describe('WebSocketConnection', () => {
  let mockWs: any;
  let connection: WebSocketConnection;

  beforeEach(() => {
    mockWs = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      ping: jest.fn(),
      pong: jest.fn(),
      on: jest.fn()
    };

    connection = new WebSocketConnection(mockWs, 'test-server', 'plugin');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(connection.serverId).toBe('test-server');
      expect(connection.mode).toBe('plugin');
      expect(connection.capabilities).toEqual([]);
      expect(connection.status).toBe('connecting');
    });

    it('should set up WebSocket event handlers', () => {
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      // Simulate connected state
      connection['_status'] = 'connected';
      connection.setAuthenticated(true);
    });

    it('should send valid messages', async () => {
      const message = MessageFactory.createRequest('server.getInfo');
      
      mockWs.send.mockImplementation((data: any, callback?: any) => {
        if (callback) callback();
      });

      await connection.send(message);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"request"'),
        expect.any(Function)
      );
    });

    it('should queue messages when connecting', async () => {
      connection['_status'] = 'connecting';
      const message = MessageFactory.createRequest('server.getInfo');

      await connection.send(message);

      expect(mockWs.send).not.toHaveBeenCalled();
      expect(connection['messageQueue']).toHaveLength(1);
    });

    it('should throw error when disconnected', async () => {
      connection['_status'] = 'disconnected';
      const message = MessageFactory.createRequest('server.getInfo');

      await expect(connection.send(message)).rejects.toThrow('Cannot send message: connection is disconnected');
    });
  });

  describe('Authentication', () => {
    it('should set authentication status', () => {
      expect(connection.isReady()).toBe(false);

      connection.setAuthenticated(true, 'test-token');

      expect(connection.isReady()).toBe(false); // Still connecting
      
      connection['_status'] = 'connected';
      expect(connection.isReady()).toBe(true);
    });
  });

  describe('Capabilities Management', () => {
    it('should update capabilities', () => {
      const capabilities = ['server.getInfo', 'player.list'];
      
      connection.updateCapabilities(capabilities);

      expect(connection.capabilities).toEqual(capabilities);
    });
  });

  describe('Connection Info', () => {
    it('should provide connection info', () => {
      connection.setAuthenticated(true);
      connection.updateCapabilities(['server.getInfo']);

      const info = connection.getConnectionInfo();

      expect(info).toEqual({
        serverId: 'test-server',
        status: 'connecting',
        mode: 'plugin',
        isAuthenticated: true,
        capabilities: ['server.getInfo'],
        stats: expect.any(Object),
        queuedMessages: 0
      });
    });
  });

  describe('Ping/Pong', () => {
    it('should send ping', () => {
      mockWs.readyState = WebSocket.OPEN;
      const data = Buffer.from('test');

      connection.ping(data);

      expect(mockWs.ping).toHaveBeenCalledWith(data);
    });

    it('should check if connection is alive', () => {
      mockWs.readyState = WebSocket.OPEN;
      expect(connection.isAlive()).toBe(true);

      mockWs.readyState = WebSocket.CLOSED;
      expect(connection.isAlive()).toBe(false);
    });
  });
});