import { ProtocolHandler } from '../../src/protocol/handler';
import { MessageFactory } from '../../src/protocol/messages';
import { Connection, UWBPMessage } from '../../src/types';

function createConnection(): Connection & { send: jest.Mock<Promise<void>, [UWBPMessage]> } {
  return {
    serverId: 'java-test',
    status: 'connected',
    mode: 'plugin',
    capabilities: [],
    send: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  };
}

describe('ProtocolHandler', () => {
  it('resolves a pending request when the correlated response is routed', async () => {
    const handler = new ProtocolHandler();
    const connection = createConnection();
    const pending = handler.sendRequest(connection, 'server.getInfo', {}, { timeout: 5000 });

    await Promise.resolve();
    const request = connection.send.mock.calls[0][0];
    const response = MessageFactory.createResponse(request.id, request.op, { name: 'Test' });
    await handler.handleMessage(connection, JSON.stringify(response));

    await expect(pending).resolves.toMatchObject({ requestId: request.id, success: true });
    expect(handler.getStats().pendingRequests).toBe(0);
    expect(handler.getStats().activeRequests).toBe(0);
  });

  it('correlates pong with the incoming ping and preserves server identity', async () => {
    const handler = new ProtocolHandler();
    const connection = createConnection();
    const ping = MessageFactory.createSystemMessage('ping', {}, { serverId: connection.serverId });

    await handler.handleMessage(connection, JSON.stringify(ping));

    expect(connection.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'system',
      systemOp: 'pong',
      requestId: ping.id,
      serverId: connection.serverId
    }));
  });

  it('rejects a correlated response whose operation does not match the request', async () => {
    const handler = new ProtocolHandler();
    const connection = createConnection();
    const pending = handler.sendRequest(connection, 'server.getInfo', {}, { timeout: 5000 });

    await Promise.resolve();
    const request = connection.send.mock.calls[0][0];
    const response = MessageFactory.createResponse(request.id, 'server.getStatus', {
      status: 'online',
      online: true
    });
    await handler.handleMessage(connection, JSON.stringify(response));

    await expect(pending).rejects.toThrow('Response operation mismatch');
    expect(handler.getStats().pendingRequests).toBe(0);
  });

  it('normalizes capability updates to the canonical protocol vocabulary', async () => {
    const handler = new ProtocolHandler();
    const connection = createConnection();
    const message = MessageFactory.createSystemMessage('capabilities', {
      capabilities: ['command.execute', 'event_streaming', 'unknown', 'event_streaming']
    });

    await handler.handleMessage(connection, JSON.stringify(message));

    expect(connection.capabilities).toEqual(['command_execution', 'event_streaming']);
  });
});
