import { Context } from 'koishi';
import { SimpleDatabaseManager } from '../../src/database/simple-init';
import { createMockContext } from '../setup';

describe('SimpleDatabaseManager migrateLegacyConnectionMode', () => {
  let ctx: Context;
  let manager: SimpleDatabaseManager;
  let logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    ctx = createMockContext();
    (ctx as any).logger = jest.fn(() => logger);
    manager = new SimpleDatabaseManager(ctx, 'mochi_');
  });

  it('migrates legacy reverse when connection_config is empty', async () => {
    (ctx.database.get as jest.Mock).mockResolvedValue([
      {
        id: 'legacy-empty-config',
        connection_mode: 'reverse',
        connection_config: '',
        // 模拟 DB 列默认值存在，不应作为新语义判断依据
        accept_inbound_ws: false,
        dial_outbound_ws: false
      }
    ]);

    await manager.migrateLegacyConnectionMode();

    expect(ctx.database.set).toHaveBeenCalledTimes(1);
    const setPayload = (ctx.database.set as jest.Mock).mock.calls[0][2];

    expect(setPayload.connection_mode).toBe('forward');
    expect(setPayload.accept_inbound_ws).toBe(true);
    expect(setPayload.dial_outbound_ws).toBe(false);

    const migratedConfig = JSON.parse(setPayload.connection_config);
    expect(migratedConfig.ws_capabilities).toEqual({
      accept_inbound_ws: true,
      dial_outbound_ws: false
    });
    expect(migratedConfig.migration.auto_migrated_legacy_reverse_at).toEqual(expect.any(String));

    expect(manager.getStartupMigrationSummary()).toEqual({
      migratedReverseToForward: 1,
      skipped: 0,
      warnedLegacyRead: 0
    });
  });

  it('does not migrate reverse when ws_capabilities already exist in config', async () => {
    (ctx.database.get as jest.Mock).mockResolvedValue([
      {
        id: 'already-new-semantics',
        connection_mode: 'reverse',
        connection_config: JSON.stringify({
          ws_capabilities: {
            accept_inbound_ws: true,
            dial_outbound_ws: false
          }
        }),
        accept_inbound_ws: false,
        dial_outbound_ws: false
      }
    ]);

    await manager.migrateLegacyConnectionMode();

    expect(ctx.database.set).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('配置中存在能力字段或迁移标记，保留为新语义数据')
    );
    expect(manager.getStartupMigrationSummary()).toEqual({
      migratedReverseToForward: 0,
      skipped: 1,
      warnedLegacyRead: 1
    });
  });
});
