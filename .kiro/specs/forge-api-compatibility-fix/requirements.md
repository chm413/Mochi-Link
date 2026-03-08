# Requirements Document

## Introduction

The Mochi-Link Forge connector for Minecraft 1.20.1 (Forge 47.2.0) currently fails to compile with 91 compilation errors due to API incompatibilities. This feature adds full API compatibility with Minecraft 1.20.1 / Forge 47.2.0, enabling the Forge connector to compile successfully and function correctly with the updated API while maintaining all existing functionality and behavior.

The Forge connector is a critical component of the Mochi-Link system that enables remote management of Minecraft Forge servers through WebSocket communication. It handles player management, server control, event monitoring, and command execution.

## Glossary

- **Forge_Connector**: The Java module that integrates Mochi-Link with Minecraft Forge servers
- **Minecraft_API**: The set of classes, methods, and fields provided by Minecraft and Forge for mod development
- **ServerPlayer**: The Minecraft class representing a player entity on the server side
- **MinecraftServer**: The Minecraft class representing the server instance
- **PlayerList**: The Minecraft class managing the list of connected players
- **ServerLevel**: The Minecraft class representing a world/dimension on the server
- **WebSocket_Message**: JSON-formatted messages exchanged between the connector and management server
- **API_Compatibility**: The state where code successfully compiles and runs against a specific API version
- **Compilation_Error**: An error reported by the Java compiler when code references non-existent methods or fields
- **Preservation**: The requirement that existing functionality and behavior remain unchanged after API updates

## Requirements

### Requirement 1: Player Information API Compatibility

**User Story:** As a Forge connector, I want to retrieve player information using the correct Minecraft 1.20.1 API methods, so that I can compile successfully and provide accurate player data to the management server.

#### Acceptance Criteria

1. WHEN THE Forge_Connector retrieves a player's UUID, THE Forge_Connector SHALL use the getUUID() method followed by toString() conversion
2. WHEN THE Forge_Connector retrieves a player's name, THE Forge_Connector SHALL use the getName() method with appropriate type handling for the returned value
3. WHEN THE Forge_Connector retrieves a player's display name, THE Forge_Connector SHALL use the getDisplayName() method and extract the string representation
4. WHEN THE Forge_Connector retrieves a player's world, THE Forge_Connector SHALL access the level field or use the serverLevel() method
5. WHEN THE Forge_Connector retrieves a player's coordinates, THE Forge_Connector SHALL use the getX(), getY(), and getZ() methods
6. WHEN THE Forge_Connector retrieves a player's network latency, THE Forge_Connector SHALL access the latency through the player's connection object
7. WHEN THE Forge_Connector retrieves a player's game profile, THE Forge_Connector SHALL use the getGameProfile() method
8. WHEN THE Forge_Connector retrieves a player's health values, THE Forge_Connector SHALL use the getHealth() and getMaxHealth() methods
9. WHEN THE Forge_Connector retrieves a player's hunger data, THE Forge_Connector SHALL use the getFoodData() method
10. WHEN THE Forge_Connector retrieves a player's experience values, THE Forge_Connector SHALL access the experienceLevel and experienceProgress fields
11. WHEN THE Forge_Connector retrieves a player's game mode, THE Forge_Connector SHALL access the game mode through the gameMode field using the appropriate getter method
12. WHEN THE Forge_Connector retrieves a player's abilities, THE Forge_Connector SHALL use the getAbilities() method
13. WHEN THE Forge_Connector checks a player's movement state, THE Forge_Connector SHALL use the isCrouching() and isSprinting() methods
14. WHEN THE Forge_Connector retrieves a player's IP address, THE Forge_Connector SHALL access the remote address through the player's connection object

### Requirement 2: Server Information API Compatibility

**User Story:** As a Forge connector, I want to retrieve server information using the correct Minecraft 1.20.1 API methods, so that I can compile successfully and provide accurate server data to the management server.

#### Acceptance Criteria

1. WHEN THE Forge_Connector executes tasks on the server thread, THE Forge_Connector SHALL use the execute() method
2. WHEN THE Forge_Connector accesses the command manager, THE Forge_Connector SHALL use the getCommands() method
3. WHEN THE Forge_Connector creates a command source, THE Forge_Connector SHALL use the createCommandSourceStack() method
4. WHEN THE Forge_Connector retrieves the server MOTD, THE Forge_Connector SHALL use the getMotd() method
5. WHEN THE Forge_Connector retrieves the server version, THE Forge_Connector SHALL use SharedConstants.getCurrentVersion().getName()
6. WHEN THE Forge_Connector retrieves the maximum player count, THE Forge_Connector SHALL use the getMaxPlayers() method
7. WHEN THE Forge_Connector retrieves the current player count, THE Forge_Connector SHALL use the getPlayerCount() method
8. WHEN THE Forge_Connector retrieves the server port, THE Forge_Connector SHALL use the getPort() method
9. WHEN THE Forge_Connector checks authentication status, THE Forge_Connector SHALL use the usesAuthentication() method
10. WHEN THE Forge_Connector retrieves server uptime, THE Forge_Connector SHALL implement custom time tracking from server start
11. WHEN THE Forge_Connector calculates server performance metrics, THE Forge_Connector SHALL implement manual TPS calculation using available tick data
12. WHEN THE Forge_Connector stops the server, THE Forge_Connector SHALL use the halt() method with appropriate parameters

### Requirement 3: Player List and World API Compatibility

**User Story:** As a Forge connector, I want to manage player lists and world information using the correct Minecraft 1.20.1 API methods, so that I can compile successfully and provide accurate whitelist and world data.

#### Acceptance Criteria

1. WHEN THE Forge_Connector converts an Entity to ServerPlayer, THE Forge_Connector SHALL use instanceof pattern matching for type safety
2. WHEN THE Forge_Connector retrieves the whitelist, THE Forge_Connector SHALL use the getWhiteList() method from PlayerList
3. WHEN THE Forge_Connector checks whitelist status, THE Forge_Connector SHALL use the isUsingWhitelist() method
4. WHEN THE Forge_Connector broadcasts system messages, THE Forge_Connector SHALL use the broadcastSystemMessage() method
5. WHEN THE Forge_Connector retrieves a world's dimension, THE Forge_Connector SHALL use the dimension() method
6. WHEN THE Forge_Connector retrieves a world's difficulty, THE Forge_Connector SHALL use the getDifficulty() method
7. WHEN THE Forge_Connector retrieves players in a world, THE Forge_Connector SHALL use the players() method

### Requirement 4: Command System API Compatibility

**User Story:** As a Forge connector, I want to register and execute commands using the correct Minecraft 1.20.1 API methods, so that I can compile successfully and provide command functionality.

#### Acceptance Criteria

1. WHEN THE Forge_Connector accesses the server from a command source, THE Forge_Connector SHALL use the getServer() method
2. WHEN THE Forge_Connector sets command permission requirements, THE Forge_Connector SHALL use the requires() method on command builders

### Requirement 5: Configuration Access Compatibility

**User Story:** As a Forge connector, I want to access configuration values using available getter methods, so that I can compile successfully and retrieve configuration settings.

#### Acceptance Criteria

1. WHEN THE Forge_Connector accesses the server host configuration, THE Forge_Connector SHALL use an available getter method that returns the host value
2. WHEN THE Forge_Connector accesses the server port configuration, THE Forge_Connector SHALL use an available getter method that returns the port value

### Requirement 6: Compilation Success

**User Story:** As a developer, I want the Forge connector to compile without errors, so that I can build and deploy the connector successfully.

#### Acceptance Criteria

1. WHEN THE Forge_Connector code is compiled with Gradle, THE compilation SHALL complete with zero errors
2. WHEN THE Forge_Connector code is compiled, THE compiler SHALL successfully resolve all API method and field references
3. WHEN THE Forge_Connector code is compiled, THE compiler SHALL validate all type conversions as safe and correct

### Requirement 7: Functional Behavior Preservation

**User Story:** As a system administrator, I want the Forge connector to maintain all existing functionality after API updates, so that my server management workflows continue to work without changes.

#### Acceptance Criteria

1. WHEN THE Forge_Connector processes WebSocket messages, THE Forge_Connector SHALL produce identical JSON response structures as before the API updates
2. WHEN THE Forge_Connector handles player events, THE Forge_Connector SHALL capture and forward events with identical data structures as before the API updates
3. WHEN THE Forge_Connector executes commands, THE Forge_Connector SHALL produce identical command results as before the API updates
4. WHEN THE Forge_Connector reads configuration files, THE Forge_Connector SHALL retrieve identical configuration values as before the API updates
5. WHEN THE Forge_Connector serializes data to JSON, THE Forge_Connector SHALL produce identical JSON structures as before the API updates
6. WHEN THE Forge_Connector communicates with the management server, THE Forge_Connector SHALL use identical message protocols as before the API updates
7. WHEN THE Forge_Connector handles errors, THE Forge_Connector SHALL log and handle exceptions identically as before the API updates

### Requirement 8: Parser and Serializer Round-Trip Integrity

**User Story:** As a developer, I want all data serialization and parsing to maintain round-trip integrity, so that data is not corrupted during transmission.

#### Acceptance Criteria

1. WHEN THE Forge_Connector serializes player data to JSON, THE Forge_Connector SHALL produce valid JSON that can be parsed back to equivalent data structures
2. WHEN THE Forge_Connector serializes server status to JSON, THE Forge_Connector SHALL produce valid JSON that can be parsed back to equivalent data structures
3. WHEN THE Forge_Connector parses WebSocket messages, THE Forge_Connector SHALL correctly interpret all message types and parameters
4. FOR ALL valid player data objects, serializing then parsing then serializing SHALL produce equivalent JSON output (round-trip property)
5. FOR ALL valid server status objects, serializing then parsing then serializing SHALL produce equivalent JSON output (round-trip property)
