/** Canonical U-WBP v2 connector capability groups. */
export const CONNECTOR_CAPABILITY_NAMES = [
  'player_management',
  'command_execution',
  'performance_monitoring',
  'event_streaming',
  'whitelist_management',
  'ban_management',
  'operator_management',
  'world_management',
  'plugin_integration',
  'server_control'
] as const;

export type ConnectorCapability = typeof CONNECTOR_CAPABILITY_NAMES[number];

const CONNECTOR_CAPABILITY_SET = new Set<string>(CONNECTOR_CAPABILITY_NAMES);
const LEGACY_CAPABILITY_ALIASES: Record<string, ConnectorCapability> = {
  realtime_events: 'event_streaming',
  'server.getInfo': 'performance_monitoring',
  'server.getStatus': 'performance_monitoring',
  'server.getMetrics': 'performance_monitoring',
  'player.list': 'player_management',
  'player.getInfo': 'player_management',
  'player.kick': 'player_management',
  'player.ban': 'ban_management',
  'command.execute': 'command_execution',
  'whitelist.get': 'whitelist_management',
  'whitelist.add': 'whitelist_management',
  'whitelist.remove': 'whitelist_management',
  'whitelist.*': 'whitelist_management',
  'server.shutdown': 'server_control',
  'server.restart': 'server_control'
};

/** Normalize an untrusted connector declaration to the protocol vocabulary. */
export function normalizeConnectorCapabilities(value: unknown): ConnectorCapability[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const normalized = rawValues
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => LEGACY_CAPABILITY_ALIASES[item] || item)
    .filter((item): item is ConnectorCapability => CONNECTOR_CAPABILITY_SET.has(item));

  return [...new Set(normalized)];
}
