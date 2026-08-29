import { ServiceManager } from '../../src/services';

describe('ServiceManager cleanup', () => {
  it('cleans every timed service even when the Koishi context is disposed', async () => {
    const manager = Object.create(ServiceManager.prototype) as any;
    const calls: string[] = [];
    const step = (name: string, failure = false) => jest.fn(async () => {
      calls.push(name);
      if (failure) throw new Error(`${name} failed`);
    });

    manager.ctx = { logger: undefined };
    manager.logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    manager.performance = { shutdown: step('performance', true) };
    manager.pluginIntegration = { cleanup: step('plugin integration') };
    manager.monitoring = { shutdown: step('monitoring') };
    manager.event = { shutdown: step('event') };
    manager.messageRouter = { cleanup: step('message router') };
    manager.binding = { cleanup: step('binding') };
    manager.whitelist = { cleanup: step('whitelist') };
    manager.player = { cleanup: step('player') };
    manager.server = { cleanup: step('server') };

    await manager.cleanup();

    expect(calls).toEqual([
      'performance',
      'plugin integration',
      'monitoring',
      'event',
      'message router',
      'binding',
      'whitelist',
      'player',
      'server'
    ]);
    expect(manager.logger.error).toHaveBeenCalledWith(
      'Failed to clean up performance service:',
      expect.any(Error)
    );
    expect(manager.logger.warn).toHaveBeenCalledWith(
      'Service cleanup completed with 1 failure(s)'
    );
  });
});
