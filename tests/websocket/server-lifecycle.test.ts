import { MochiWebSocketServer } from '../../src/websocket/server';

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
});
