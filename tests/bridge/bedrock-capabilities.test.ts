import { BedrockConnectorBridge } from '../../src/bridge/bedrock';
import { BridgeConfig } from '../../src/bridge/types';

describe('BedrockConnectorBridge protocol capabilities', () => {
  const config: BridgeConfig = {
    serverId: 'bedrock-server-1',
    coreType: 'Bedrock',
    coreName: 'LLBDS',
    coreVersion: '1.20.80',
    connection: {
      host: 'localhost',
      port: 25565,
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 5000
    },
    features: {
      playerManagement: true,
      worldManagement: true,
      pluginIntegration: true,
      performanceMonitoring: true,
      eventStreaming: true
    },
    coreSpecific: { supportsLLBDS: true }
  };

  it('does not expose capabilities omitted by the authenticated connector', () => {
    const adapter = {
      sendRequest: jest.fn(),
      capabilities: [
        'player_management',
        'command_execution',
        'performance_monitoring',
        'event_streaming'
      ]
    };
    const bridge = new BedrockConnectorBridge(config, adapter);

    expect(bridge.getCapabilities()).toEqual(adapter.capabilities);
    expect(bridge.hasCapability('whitelist_management')).toBe(false);
    expect(bridge.hasCapability('server_control')).toBe(false);
  });
});
