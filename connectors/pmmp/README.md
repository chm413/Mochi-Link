# Mochi-Link PMMP Connector

Minecraft Bedrock Edition (PMMP) connector plugin for Mochi-Link unified management system.

## Features

- ✅ U-WBP v2 Protocol Compliant
- ✅ WebSocket Connection to Management Server
- ✅ Real-time Event Streaming
- ✅ Remote Command Execution
- ✅ Player Management
- ✅ Whitelist Management
- ✅ Performance Monitoring
- ✅ Automatic Reconnection
- ✅ Heartbeat Mechanism

## Requirements

- PocketMine-MP 5.0.0 or higher
- PHP 8.1 or higher
- Mochi-Link Management Server

## Installation

1. Download the latest release from the releases page
2. Place the `.phar` file in your PMMP `plugins` folder
3. Start your server to generate the configuration file
4. Edit `plugins/MochiLinkConnectorPMMP/config.yml` with your settings
5. Restart your server

## Configuration

Edit `config.yml` in the plugin folder:

```yaml
# Management Server Connection
mochi-link-host: "localhost"
mochi-link-port: 25580
mochi-link-path: "/ws"
use-ssl: false

# Server Identification
server-id: ""  # Auto-generated if empty
server-name: "PMMP Server"

# Authentication
auth-token: "your-auth-token-here"

# Connection Behavior
timeout: 10000
retry-attempts: 10
retry-delay: 5000
auto-reconnect: true
reconnect-interval: 30

# Performance Monitoring
enable-monitoring: true
monitoring-interval: 30
```

## Commands

- `/mochilink status` - Check connection status
- `/mochilink reconnect` - Reconnect to management server
- `/mochilink info` - Show plugin information
- `/mochilink stats` - Show server statistics
- `/mochilink help` - Show help message

Aliases: `/ml`, `/mochi`, `/mlp`

## Permissions

- `mochilink.admin` - Full access to MochiLink commands (default: op)
- `mochilink.manage` - Manage server connections and settings (default: op)
- `mochilink.monitor` - View server status and monitoring data (default: op)

## Supported Operations

### Server Management
- Get server status
- Get server information
- Execute commands

### Player Management
- List online players
- Get player information
- Kick players
- Send private messages

### Whitelist Management
- Get whitelist
- Add players to whitelist
- Remove players from whitelist

### Event Streaming
- Player join/leave events
- Player chat events
- Player death events
- Server metrics events

## Protocol

This connector implements the U-WBP v2 (Unified WebSocket Bridge Protocol version 2.0) for communication with the Mochi-Link management server.

### Message Format

All messages follow the U-WBP v2 standard format:

```json
{
  "type": "request|response|event",
  "id": "unique-message-id",
  "op": "operation.type",
  "data": {},
  "timestamp": 1234567890,
  "version": "2.0",
  "serverId": "server-id"
}
```

## Development

### Building from Source

1. Clone the repository
2. Navigate to `connectors/pmmp`
3. Build using DevTools or your preferred method

### Project Structure

```
connectors/pmmp/
├── src/
│   └── com/mochilink/connector/pmmp/
│       ├── MochiLinkPMMPPlugin.php          # Main plugin class
│       ├── config/
│       │   └── PMMPPluginConfig.php         # Configuration manager
│       ├── protocol/
│       │   └── UWBPMessage.php              # U-WBP v2 message class
│       ├── connection/
│       │   └── PMMPConnectionManager.php    # WebSocket connection manager
│       ├── handlers/
│       │   ├── PMMPEventHandler.php         # Event handler
│       │   └── PMMPCommandHandler.php       # Command handler
│       ├── monitoring/
│       │   └── PMMPPerformanceMonitor.php   # Performance monitor
│       └── commands/
│           └── MochiLinkPMMPCommand.php     # Command implementation
├── resources/
│   └── config.yml                           # Default configuration
├── plugin.yml                               # Plugin manifest
└── README.md                                # This file
```

## Troubleshooting

### Connection Issues

1. Check that the management server is running
2. Verify the host and port in config.yml
3. Ensure the auth token is correct
4. Check firewall settings

### Performance Issues

1. Adjust monitoring interval in config.yml
2. Disable debug mode if enabled
3. Check server resources (CPU, memory)

### Event Not Forwarding

1. Check event forwarding settings in config.yml
2. Verify connection status with `/mochilink status`
3. Check server logs for errors

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/chm413/Mochi-Link/issues
- Documentation: https://github.com/chm413/Mochi-Link/wiki

## License

This project is licensed under the MIT License.

## Credits

- Author: chm413
- Protocol: U-WBP v2
- Platform: PocketMine-MP

## Changelog

### Version 1.0.0 (2024-01-01)
- Initial release
- U-WBP v2 protocol implementation
- WebSocket connection support
- Event streaming
- Command execution
- Player management
- Whitelist management
- Performance monitoring
- Automatic reconnection
