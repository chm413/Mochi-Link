# Mochi-Link Connectors Collection

Collection Date: 周六 2026/02/28 11:55:29.02

## Directory Structure

```
mochi-link-connectors/
├── java-edition/
│   ├── fabric/              # Fabric mod for Fabric servers
│   ├── forge/               # Forge mod for Forge servers
│   ├── paper-spigot/        # Plugin for Paper/Spigot servers
│   └── folia/               # Plugin for Folia servers
├── bedrock-edition/
│   ├── llbds/               # Plugin for LLBDS servers
│   ├── nukkit/              # Plugin for Nukkit servers
│   └── pmmp/                # Plugin for PocketMine-MP servers
└── config-templates/        # Configuration file templates
```

## Installation

### Java Edition

**Fabric:**
1. Copy `java-edition/fabric/mochi-link-connector-fabric-*.jar` to your server's `mods/` folder
2. Restart the server

**Forge:**
1. Copy `java-edition/forge/mochi-link-connector-forge-*.jar` to your server's `mods/` folder
2. Restart the server

**Paper/Spigot:**
1. Copy `java-edition/paper-spigot/mochi-link-connector-java-*.jar` to your server's `plugins/` folder
2. Restart the server

**Folia:**
1. Copy `java-edition/folia/mochi-link-connector-folia-*.jar` to your server's `plugins/` folder
2. Restart the server

### Bedrock Edition

**LLBDS:**
1. Copy the entire `bedrock-edition/llbds/` folder to your LLBDS `plugins/` directory
2. Run `npm install` in the plugin folder
3. Restart the server

**Nukkit:**
1. Copy `bedrock-edition/nukkit/mochi-link-connector-nukkit-*.jar` to your server's `plugins/` folder
2. Restart the server

**PMMP:**
1. Copy the entire `bedrock-edition/pmmp/` folder to your PMMP `plugins/` directory
2. Restart the server

## Configuration

Configuration templates are available in the `config-templates/` folder:

- `fabric-config.json` - Fabric configuration
- `paper-spigot-config.yml` - Paper/Spigot configuration
- `folia-config.yml` - Folia configuration
- `llbds-config.json` - LLBDS configuration
- `CORRECT_CONFIG_EXAMPLE.yml` - General configuration example

Copy the appropriate template to your server's plugin/mod folder and edit as needed.

## Support

- GitHub: https://github.com/chm413/Mochi-Link
- Issues: https://github.com/chm413/Mochi-Link/issues

## Version Information

All connectors version: 1.0.0
Build date: 周六 2026/02/28
