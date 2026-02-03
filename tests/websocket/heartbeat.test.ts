/**
 * Heartbeat Manager Tests
 * 
 * Unit tests for WebSocket heartbeat management.
 */

import { HeartbeatManager } from '../../src/websocket/heartbeat';
import { WebSocketConnection } from '../../src/websocket/connection';
import { MessageFactory } from '../../src/protocol/messages';

// Mock WebSocketConnection
jest.mock('../../src/websocket/connection');
const MockWebSocketConnection = WebSocketConnection as jest.MockedClass<typeof WebSocketConnection>;

describe('HeartbeatManager', () => {
  let heartbeatManager: HeartbeatManager;
  let mockConnection: jest.Mocked<WebSocketConnection>;

  beforeEach(() => {
    heartbeatManager = new HeartbeatManager({
      interval: 1000,      // 1 second for testing
      timeout: 500,        // 0.5 seconds for testing
      maxMissedBeats: 2
    });

    mockConnection = new MockWebSocketConnection({} as any, 'test-server', 'plugin') as jest.Mocked<WebSocketConnection>;
    Object.defineProperty(mockConnection, 'serverId', {
      value: 'test-server',
      writable: true,
      configurable: true
    });
    mockConnection.isAlive = jest.fn().mockReturnValue(true);
    mockConnection.send = jest.fn().mockResolvedValue(undefined);
    mockConnection.on = jest.fn();
    mockConnection.emit = jest.fn();
  });

  afterEach(() => {
    heartbeatManager.shutdown();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Heartbeat Lifecycle', () => {
    it('should start heartbeat for connection', () => {
      heartbeatManager.startHeartbeat(mockConnection);

      expect(heartbeatManager.isActive('test-server')).toBe(true);
      expect(mockConnection.on).toHaveBeenCalledWith('pong', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });

    it('should stop heartbeat for connection', () => {
      heartbeatManager.startHeartbeat(mockConnection);
      expect(heartbeatManager.isActive('test-server')).toBe(true);

      heartbeatManager.stopHeartbeat('test-server');
      expect(heartbeatManager.isActive('test-server')).toBe(false);
    });

    it('should emit heartbeat events', () => {
      const emitSpy = jest.spyOn(heartbeatManager, 'emit');

      heartbeatManager.startHeartbeat(mockConnection);
      expect(emitSpy).toHaveBeenCalledWith('heartbeatStarted', 'test-server');

      heartbeatManager.stopHeartbeat('test-server');
      expect(emitSpy).toHaveBeenCalledWith('heartbeatStopped', 'test-server');
    });
  });

  describe('Ping/Pong Cycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send ping messages at intervals', async () => {
      heartbeatManager.startHeartbeat(mockConnection);

      // Fast-forward time to trigger ping
      jest.advanceTimersByTime(1000);

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          op: 'ping'
        })
      );
    });

    it('should handle pong responses', () => {
      heartbeatManager.startHeartbeat(mockConnection);

      // Get the pong handler
      const pongHandler = mockConnection.on.mock.calls.find(call => call[0] === 'pong')?.[1];
      expect(pongHandler).toBeDefined();

      // Simulate pong response
      const emitSpy = jest.spyOn(heartbeatManager, 'emit');
      pongHandler?.(Buffer.from('test'));

      expect(emitSpy).toHaveBeenCalledWith('pongReceived', 'test-server', expect.any(Number));
    });

    it('should calculate RTT correctly', () => {
      heartbeatManager.startHeartbeat(mockConnection);

      // Simulate ping sent
      const state = heartbeatManager['connections'].get('test-server');
      if (state) {
        state.lastPingSent = Date.now() - 100; // 100ms ago
      }

      // Get the pong handler and simulate response
      const pongHandler = mockConnection.on.mock.calls.find(call => call[0] === 'pong')?.[1];
      pongHandler?.(Buffer.from('test'));

      const stats = heartbeatManager.getStats('test-server');
      expect(stats?.rtt).toBeGreaterThan(0);
      expect(stats?.rtt).toBeLessThan(200); // Should be around 100ms
    });
  });

  describe('Heartbeat Failure Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should detect missed heartbeats', () => {
      const emitSpy = jest.spyOn(heartbeatManager, 'emit');
      heartbeatManager.startHeartbeat(mockConnection);

      // Advance time to trigger ping
      jest.advanceTimersByTime(1000);

      // Advance time to trigger timeout (no pong received)
      jest.advanceTimersByTime(500);

      expect(emitSpy).toHaveBeenCalledWith('heartbeatTimeout', 'test-server', 1);
    });

    it('should trigger failure after max missed beats', () => {
      const emitSpy = jest.spyOn(heartbeatManager, 'emit');
      heartbeatManager.startHeartbeat(mockConnection);

      // Simulate multiple missed heartbeats
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(1000); // Trigger ping
        jest.advanceTimersByTime(500);  // Trigger timeout
      }

      expect(emitSpy).toHaveBeenCalledWith('heartbeatFailure', 'test-server', 2);
      expect(emitSpy).toHaveBeenCalledWith('reconnectRequired', 'test-server', 'Heartbeat failure');
      expect(heartbeatManager.isActive('test-server')).toBe(false);
    });

    it('should reset missed beats on successful pong', () => {
      heartbeatManager.startHeartbeat(mockConnection);

      // Simulate one missed beat
      jest.advanceTimersByTime(1000); // Trigger ping
      jest.advanceTimersByTime(500);  // Trigger timeout

      const stats1 = heartbeatManager.getStats('test-server');
      expect(stats1?.missedBeats).toBe(1);

      // Simulate successful pong
      const pongHandler = mockConnection.on.mock.calls.find(call => call[0] === 'pong')?.[1];
      pongHandler?.(Buffer.from('test'));

      const stats2 = heartbeatManager.getStats('test-server');
      expect(stats2?.missedBeats).toBe(0);
    });
  });

  describe('Connection Event Handling', () => {
    it('should stop heartbeat on connection error', () => {
      heartbeatManager.startHeartbeat(mockConnection);
      expect(heartbeatManager.isActive('test-server')).toBe(true);

      // Get the error handler and simulate error
      const errorHandler = mockConnection.on.mock.calls.find(call => call[0] === 'error')?.[1];
      errorHandler?.(new Error('Connection error'));

      expect(heartbeatManager.isActive('test-server')).toBe(false);
    });

    it('should stop heartbeat on disconnection', () => {
      heartbeatManager.startHeartbeat(mockConnection);
      expect(heartbeatManager.isActive('test-server')).toBe(true);

      // Get the disconnected handler and simulate disconnection
      const disconnectedHandler = mockConnection.on.mock.calls.find(call => call[0] === 'disconnected')?.[1];
      disconnectedHandler?.(1000, 'Normal closure');

      expect(heartbeatManager.isActive('test-server')).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should provide connection statistics', () => {
      heartbeatManager.startHeartbeat(mockConnection);

      const stats = heartbeatManager.getStats('test-server');
      expect(stats).toEqual({
        isActive: true,
        lastPingSent: 0,
        lastPongReceived: expect.any(Number),
        missedBeats: 0,
        currentInterval: 1000,
        rtt: 0,
        averageRtt: 0
      });
    });

    it('should return null for unknown connection', () => {
      const stats = heartbeatManager.getStats('unknown-server');
      expect(stats).toBeNull();
    });

    it('should provide overall statistics', () => {
      heartbeatManager.startHeartbeat(mockConnection);

      const overallStats = heartbeatManager.getOverallStats();
      expect(overallStats).toEqual({
        activeConnections: 1,
        totalMissedBeats: 0,
        averageRtt: 0,
        connectionHealth: {
          'test-server': 'healthy'
        }
      });
    });

    it('should calculate connection health correctly', () => {
      heartbeatManager.startHeartbeat(mockConnection);

      // Simulate degraded connection
      const state = heartbeatManager['connections'].get('test-server');
      if (state) {
        state.missedBeats = 1;
        state.rtt = 800;
      }

      const overallStats = heartbeatManager.getOverallStats();
      expect(overallStats.connectionHealth['test-server']).toBe('degraded');

      // Simulate unhealthy connection
      if (state) {
        state.missedBeats = 2;
        state.rtt = 1500;
      }

      const overallStats2 = heartbeatManager.getOverallStats();
      expect(overallStats2.connectionHealth['test-server']).toBe('unhealthy');
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const emitSpy = jest.spyOn(heartbeatManager, 'emit');
      const newConfig = { interval: 2000, timeout: 1000 };

      heartbeatManager.updateConfig(newConfig);

      expect(emitSpy).toHaveBeenCalledWith('configUpdated', expect.objectContaining(newConfig));
    });
  });

  describe('Adaptive Heartbeat', () => {
    it('should adjust interval based on RTT', () => {
      const adaptiveManager = new HeartbeatManager({
        interval: 1000,
        adaptiveInterval: true,
        minInterval: 500,
        maxInterval: 5000
      });

      adaptiveManager.startHeartbeat(mockConnection);

      // Simulate good connection (low RTT)
      const state = adaptiveManager['connections'].get('test-server');
      if (state) {
        state.rttHistory = [50, 60, 70]; // Good RTT
        adaptiveManager['adjustHeartbeatInterval'](state);
        expect(state.currentInterval).toBeLessThan(1000);
      }

      adaptiveManager.shutdown();
    });

    it('should increase interval for poor connections', () => {
      const adaptiveManager = new HeartbeatManager({
        interval: 1000,
        adaptiveInterval: true,
        minInterval: 500,
        maxInterval: 5000
      });

      adaptiveManager.startHeartbeat(mockConnection);

      // Simulate poor connection (high RTT)
      const state = adaptiveManager['connections'].get('test-server');
      if (state) {
        state.rttHistory = [800, 900, 1000]; // Poor RTT
        adaptiveManager['adjustHeartbeatInterval'](state);
        expect(state.currentInterval).toBeGreaterThan(1000);
      }

      adaptiveManager.shutdown();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', () => {
      heartbeatManager.startHeartbeat(mockConnection);
      expect(heartbeatManager.isActive('test-server')).toBe(true);

      heartbeatManager.shutdown();

      expect(heartbeatManager.isActive('test-server')).toBe(false);
      expect(heartbeatManager['connections'].size).toBe(0);
    });
  });
});