import {
  parseConnectionConfig,
  normalizeServerConnectionConfig,
  resolveServerWsCapabilities,
} from '../src/utils/connection-config';

describe('index connection config parsing', () => {
  it('should parse object connection_config and keep legacy fallback consistent', () => {
    const server = {
      connection_mode: 'forward',
      connection_config: {
        connector: {
          host: '127.0.0.1',
          port: 8080,
        },
      },
    };

    const parsed = parseConnectionConfig(server);
    const normalized = normalizeServerConnectionConfig(parsed, 'forward');
    const resolved = resolveServerWsCapabilities(server);

    expect(normalized.usedLegacyMode).toBe(true);
    expect(normalized.capabilities).toEqual(resolved);
    expect(resolved).toEqual({
      accept_inbound_ws: true,
      dial_outbound_ws: false,
    });
  });

  it('should parse object connection_config with capability fields and avoid legacy mode', () => {
    const server = {
      connection_mode: 'reverse',
      connection_config: {
        ws_capabilities: {
          accept_inbound_ws: false,
          dial_outbound_ws: true,
        },
      },
    };

    const normalized = normalizeServerConnectionConfig(parseConnectionConfig(server), 'reverse');
    const resolved = resolveServerWsCapabilities(server);

    expect(normalized.usedLegacyMode).toBe(false);
    expect(normalized.capabilities).toEqual(resolved);
    expect(resolved).toEqual({
      accept_inbound_ws: false,
      dial_outbound_ws: true,
    });
  });
});
