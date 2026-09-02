/** Canonical U-WBP v2 connector capability groups. */
export declare const CONNECTOR_CAPABILITY_NAMES: readonly ["player_management", "command_execution", "performance_monitoring", "event_streaming", "whitelist_management", "ban_management", "operator_management", "world_management", "plugin_integration", "server_control"];
export type ConnectorCapability = typeof CONNECTOR_CAPABILITY_NAMES[number];
/** Normalize an untrusted connector declaration to the protocol vocabulary. */
export declare function normalizeConnectorCapabilities(value: unknown): ConnectorCapability[];
