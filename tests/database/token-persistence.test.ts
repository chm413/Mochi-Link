import { SimpleDatabaseManager } from '../../src/database/simple-init';

describe('token persistence', () => {
  it('returns a new secret once without persisting plaintext', async () => {
    const create = jest.fn().mockResolvedValue({ id: 7 });
    const ctx = {
      database: { create },
      logger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
    } as any;
    const manager = new SimpleDatabaseManager(ctx, 'mochi_');

    const result = await manager.createAPIToken('server-1', 'raw-secret', 'sha256-hash');

    expect(create).toHaveBeenCalledWith(
      'mochi_api_tokens',
      expect.objectContaining({
        server_id: 'server-1',
        token: '',
        token_hash: 'sha256-hash'
      })
    );
    expect(result.token).toBe('raw-secret');
    expect(result.tokenHash).toBe('sha256-hash');
  });
});
