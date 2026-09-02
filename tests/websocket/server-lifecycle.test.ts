import { MochiWebSocketServer } from '../../src/websocket/server';
import { EventEmitter } from 'events';

describe('MochiWebSocketServer lifecycle', () => {
  it('shuts down authentication resources even when it is not listening', async () => {
    const server = Object.create(MochiWebSocketServer.prototype) as any;
    server.authManager = { shutdown: jest.fn() };
    server.connections = new Map([['server-1', {}]]);
    server.isRunning = false;

    await server.stop();

    expect(server.authManager.shutdown).toHaveBeenCalledTimes(1);
    expect(server.connections.size).toBe(0);
  });

  it('closes unauthenticated connections that send non-handshake messages', async () => {
    const server = Object.create(MochiWebSocketServer.prototype) as any;
    server.config = { authenticationTimeout: 10000 };
    server.connections = new Map();
    server.emit = jest.fn();

    const connection = new EventEmitter() as any;
    connection.serverId = 'java-test';
    connection.close = jest.fn().mockResolvedValue(undefined);
    const info = { authenticated: false, lastActivity: new Date(), messageCount: 0 };

    server.setupConnectionHandlers(connection, info);
    connection.emit('message', {
      type: 'request',
      id: 'request-1',
      op: 'server.getInfo',
      data: {}
    });
    await Promise.resolve();

    expect(connection.close).toHaveBeenCalledWith(1008, 'Authentication required');
    expect(server.emit).not.toHaveBeenCalledWith('message', expect.anything(), connection);
    connection.emit('disconnected', 1008, 'Authentication required');
  });

  it('allows the authentication handshake before authentication completes', () => {
    const server = Object.create(MochiWebSocketServer.prototype) as any;
    server.config = { authenticationTimeout: 10000 };
    server.connections = new Map();
    server.emit = jest.fn();

    const connection = new EventEmitter() as any;
    connection.serverId = 'bedrock-test';
    connection.close = jest.fn().mockResolvedValue(undefined);
    const info = { authenticated: false, lastActivity: new Date(), messageCount: 0 };
    const handshake = {
      type: 'system',
      id: 'handshake-1',
      op: 'handshake',
      systemOp: 'handshake',
      data: {}
    };

    server.setupConnectionHandlers(connection, info);
    connection.emit('message', handshake);

    expect(connection.close).not.toHaveBeenCalled();
    expect(server.emit).toHaveBeenCalledWith('message', handshake, connection);
    connection.emit('disconnected', 1000, 'done');
  });

  it('rejects an explicitly incompatible protocol version during upgrade', async () => {
    const server = Object.create(MochiWebSocketServer.prototype) as any;
    server.config = { maxConnections: 100 };
    server.connections = new Map();
    const ws = { close: jest.fn() };
    const request = {
      url: '/ws?serverId=java-test',
      headers: {
        host: '127.0.0.1',
        'x-protocol-version': '3.0'
      },
      socket: {}
    };

    await server.handleNewConnection(ws, request);

    expect(ws.close).toHaveBeenCalledWith(1002, 'Unsupported U-WBP version');
    expect(server.connections.size).toBe(0);
  });
});
