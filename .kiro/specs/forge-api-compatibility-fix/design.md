# Design Document: Forge API Compatibility Fix

## Overview

This design document provides a comprehensive technical solution for resolving 91 compilation errors in the Mochi-Link Forge connector for Minecraft 1.20.1 (Forge 47.2.0). The errors stem from API incompatibilities where methods, fields, and type signatures have changed between Minecraft versions.

The Forge connector is a critical component that enables remote management of Minecraft Forge servers through WebSocket communication. It handles player management, server control, event monitoring, and command execution using the U-WBP v2.0 protocol.

### Problem Statement

The current Forge connector code references deprecated or non-existent API methods and fields from older Minecraft versions. These incompatibilities prevent successful compilation and deployment. The solution must:

1. Map all 91 compilation errors to their correct Minecraft 1.20.1 API equivalents
2. Preserve all existing functionality and behavior
3. Maintain identical JSON response structures for WebSocket communication
4. Ensure type safety and proper error handling

### Solution Approach

The solution involves systematic API migration across three main files:
- `ForgeMessageHandler.java` (primary file with ~80 errors)
- `ForgeEventHandler.java` (~8 errors)
- `MochiLinkForgeCommand.java` (~3 errors)

Each API change is mapped to specific requirements and validated through property-based testing to ensure correctness.

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Mochi-Link Forge Mod                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ ForgeMessageHandler│◄────────┤ WebSocket Client │          │
│  │  (API Fixes)      │         │                  │          │
│  └────────┬─────────┘         └──────────────────┘          │
│           │                                                   │
│           │ Uses Minecraft 1.20.1 API                        │
│           ▼                                                   │
│  ┌──────────────────────────────────────────────┐           │
│  │         Minecraft Server API                  │           │
│  │  • ServerPlayer (player info)                 │           │
│  │  • MinecraftServer (server operations)        │           │
│  │  • PlayerList (player management)             │           │
│  │  • ServerLevel (world data)                   │           │
│  │  • CommandSourceStack (commands)              │           │
│  └──────────────────────────────────────────────┘           │
│           ▲                                                   │
│           │                                                   │
│  ┌────────┴─────────┐         ┌──────────────────┐          │
│  │ ForgeEventHandler │         │ MochiLinkCommand │          │
│  │  (API Fixes)      │         │  (API Fixes)     │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### API Migration Strategy

The migration follows a systematic approach:

1. **Field vs Method Resolution**: Determine whether API access should use field access or method calls
2. **Type Conversion**: Handle changes in return types (e.g., Component vs String)
3. **Method Renaming**: Map old method names to new equivalents
4. **Null Safety**: Add appropriate null checks and error handling
5. **Behavioral Preservation**: Ensure identical output for all operations

## Components and Interfaces

### 1. Player Information API Changes

#### 1.1 UUID Retrieval
- **Old API**: `player.getUUID()` (may have returned different type)
- **New API**: `player.getUUID().toString()`
- **Location**: ForgeMessageHandler.java (lines 52, 91, 169, 207, 243, etc.)
- **Impact**: All player identification operations
- **Validation**: UUID format must match existing pattern

#### 1.2 Player Name Retrieval
- **Old API**: `player.getName()` (returned String directly)
- **New API**: `player.getName().getString()`
- **Location**: ForgeMessageHandler.java (lines 53, 92, 170, 208, etc.)
- **Impact**: All player name display and logging
- **Validation**: String output must be identical

#### 1.3 Display Name Retrieval
- **Old API**: `player.getDisplayName()` (returned String)
- **New API**: `player.getDisplayName().getString()`
- **Location**: ForgeMessageHandler.java (lines 54, 93)
- **Impact**: Player display in UI and messages
- **Validation**: Display name formatting preserved

#### 1.4 World/Level Access
- **Old API**: `player.level()` (method call)
- **New API**: `player.level` (field access)
- **Location**: ForgeMessageHandler.java (lines 55, 94)
- **Impact**: World dimension retrieval
- **Validation**: Dimension string format unchanged

#### 1.5 Position Coordinates
- **Old API**: `player.getX()`, `player.getY()`, `player.getZ()`
- **New API**: Same methods (no change needed)
- **Location**: ForgeMessageHandler.java (lines 57-59, 96-98)
- **Impact**: Player position tracking
- **Validation**: Coordinate precision maintained

#### 1.6 Network Latency
- **Old API**: `player.latency` (field access)
- **New API**: `player.connection.latency()` (method through connection)
- **Location**: ForgeMessageHandler.java (lines 62, 101)
- **Impact**: Ping display
- **Validation**: Latency value accuracy

#### 1.7 Game Profile Access
- **Old API**: `player.getGameProfile()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (lines 63, 103)
- **Impact**: OP status checking
- **Validation**: Profile data integrity

#### 1.8 Health Values
- **Old API**: `player.getHealth()`, `player.getMaxHealth()`
- **New API**: Same methods (no change needed)
- **Location**: ForgeMessageHandler.java (lines 64, 104)
- **Impact**: Health monitoring
- **Validation**: Health value accuracy

#### 1.9 Food Data
- **Old API**: `player.getFoodData()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (line 65)
- **Impact**: Hunger level tracking
- **Validation**: Food level accuracy

#### 1.10 Experience Values
- **Old API**: `player.experienceLevel`, `player.experienceProgress`
- **New API**: Same fields (no change needed)
- **Location**: ForgeMessageHandler.java (lines 106-107)
- **Impact**: XP display
- **Validation**: Experience values preserved

#### 1.11 Game Mode Access
- **Old API**: `player.gameMode.getGameModeForPlayer()`
- **New API**: `player.gameMode.getGameModeForPlayer()` (verify method exists)
- **Alternative**: `player.gameMode.getGameType()` if needed
- **Location**: ForgeMessageHandler.java (lines 66, 108)
- **Impact**: Game mode display
- **Validation**: Game mode string format

#### 1.12 Player Abilities
- **Old API**: `player.getAbilities()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (line 109)
- **Impact**: Flying status and abilities
- **Validation**: Abilities data structure

#### 1.13 Movement State
- **Old API**: `player.isCrouching()`, `player.isSprinting()`
- **New API**: Same methods (no change needed)
- **Location**: ForgeMessageHandler.java (lines 110-111)
- **Impact**: Player state tracking
- **Validation**: Boolean state accuracy

#### 1.14 IP Address Retrieval
- **Old API**: `player.getIpAddress()` (may not exist)
- **New API**: `player.connection.getRemoteAddress().toString()`
- **Location**: ForgeMessageHandler.java (line 112)
- **Impact**: IP logging and tracking
- **Validation**: IP address format

### 2. Server Information API Changes

#### 2.1 Server Thread Execution
- **Old API**: `server.execute()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (lines 173, 211, 249, 287, 325, 363, 401, 439, 477)
- **Impact**: Thread-safe server operations
- **Validation**: Execution timing preserved

#### 2.2 Command Manager Access
- **Old API**: `server.getCommands()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (lines 287, 325, 401)
- **Impact**: Command execution
- **Validation**: Command results identical

#### 2.3 Command Source Creation
- **Old API**: `server.createCommandSourceStack()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (lines 288, 326, 402)
- **Impact**: Command context creation
- **Validation**: Command permissions preserved

#### 2.4 Server MOTD
- **Old API**: `server.getMotd()` (may return different type)
- **New API**: `server.getMotd()` (verify return type, may need `.getString()`)
- **Location**: ForgeMessageHandler.java (lines 419, 421)
- **Impact**: Server description display
- **Validation**: MOTD string format

#### 2.5 Server Version
- **Old API**: `server.getServerVersion()` (deprecated)
- **New API**: `SharedConstants.getCurrentVersion().getName()`
- **Location**: ForgeMessageHandler.java (line 420)
- **Impact**: Version display
- **Validation**: Version string format
- **Note**: Requires import `net.minecraft.SharedConstants;`

#### 2.6 Player Count Methods
- **Old API**: `server.getMaxPlayers()`, `server.getPlayerCount()`
- **New API**: Same methods (no change needed)
- **Location**: ForgeMessageHandler.java (lines 68, 423, 424, 454)
- **Impact**: Player count display
- **Validation**: Count accuracy

#### 2.7 Server Port
- **Old API**: `server.getPort()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (line 425)
- **Impact**: Port display
- **Validation**: Port number accuracy

#### 2.8 Authentication Status
- **Old API**: `server.usesAuthentication()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (line 427)
- **Impact**: Online mode display
- **Validation**: Boolean value accuracy

#### 2.9 Server Performance Metrics
- **Old API**: `server.getAverageTickTime()` (may not exist)
- **New API**: Manual calculation using `server.tickTimes` array
- **Location**: ForgeMessageHandler.java (line 459)
- **Impact**: TPS calculation
- **Validation**: TPS calculation accuracy
- **Implementation**:
  ```java
  long[] tickTimes = server.tickTimes;
  if (tickTimes != null && tickTimes.length > 0) {
      long sum = 0;
      for (long time : tickTimes) {
          sum += time;
      }
      double averageTickTimeNs = (double) sum / tickTimes.length;
      double averageTickTimeMs = averageTickTimeNs / 1000000.0;
      double tps = Math.min(20.0, 1000.0 / averageTickTimeMs);
  }
  ```

#### 2.10 Server Stop Method
- **Old API**: `server.stopServer()` (may not exist)
- **New API**: `server.halt(false)` or verify `stopServer()` exists
- **Location**: ForgeMessageHandler.java (lines 482, 520)
- **Impact**: Server shutdown
- **Validation**: Shutdown behavior identical

### 3. Player List and World API Changes

#### 3.1 Entity Type Casting
- **Old API**: Direct cast `(ServerPlayer) event.getEntity()`
- **New API**: Safe instanceof pattern matching
- **Location**: ForgeEventHandler.java (lines 42, 72)
- **Impact**: Event handling safety
- **Validation**: No ClassCastException
- **Implementation**:
  ```java
  if (!(event.getEntity() instanceof ServerPlayer)) {
      return;
  }
  ServerPlayer player = (ServerPlayer) event.getEntity();
  ```

#### 3.2 Whitelist Access
- **Old API**: `server.getPlayerList().getWhiteListNames()`
- **New API**: Verify method exists and return type
- **Alternative**: May need to iterate whitelist entries
- **Location**: ForgeMessageHandler.java (line 233)
- **Impact**: Whitelist display
- **Validation**: Whitelist data structure

#### 3.3 Whitelist Status
- **Old API**: `server.getPlayerList().isUsingWhitelist()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (lines 240, 426)
- **Impact**: Whitelist enabled check
- **Validation**: Boolean value accuracy

#### 3.4 System Message Broadcasting
- **Old API**: `server.getPlayerList().broadcastSystemMessage()`
- **New API**: Same method (verify signature)
- **Location**: ForgeMessageHandler.java (lines 475, 513)
- **Impact**: Server-wide announcements
- **Validation**: Message delivery

#### 3.5 World Dimension Access
- **Old API**: `level.dimension()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (lines 431, 432)
- **Impact**: Dimension identification
- **Validation**: Dimension string format

#### 3.6 World Difficulty
- **Old API**: `level.getDifficulty()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (line 433)
- **Impact**: Difficulty display
- **Validation**: Difficulty value accuracy

#### 3.7 World Players
- **Old API**: `level.players()`
- **New API**: Same method (no change needed)
- **Location**: ForgeMessageHandler.java (line 434)
- **Impact**: Per-world player count
- **Validation**: Player list accuracy

### 4. Command System API Changes

#### 4.1 Server Access from Command Source
- **Old API**: `source.getServer()`
- **New API**: Same method (no change needed)
- **Location**: MochiLinkForgeCommand.java (line 149)
- **Impact**: Command execution context
- **Validation**: Server instance access

#### 4.2 Command Permission Requirements
- **Old API**: `builder.requires()`
- **New API**: Same method (no change needed)
- **Location**: MochiLinkForgeCommand.java (line 37)
- **Impact**: Permission checking
- **Validation**: Permission level enforcement

## Data Models

### Player Information Model

```java
{
  "id": String,              // UUID.toString()
  "name": String,            // getName().getString()
  "displayName": String,     // getDisplayName().getString()
  "world": String,           // level.dimension().location().toString()
  "position": {
    "x": double,             // getX()
    "y": double,             // getY()
    "z": double              // getZ()
  },
  "ping": int,               // connection.latency()
  "isOp": boolean,           // PlayerList.isOp(getGameProfile())
  "health": float,           // getHealth()
  "maxHealth": float,        // getMaxHealth()
  "foodLevel": int,          // getFoodData().getFoodLevel()
  "level": int,              // experienceLevel field
  "exp": float,              // experienceProgress field
  "gameMode": String,        // gameMode.getGameModeForPlayer().getName()
  "isFlying": boolean,       // getAbilities().flying
  "isSneaking": boolean,     // isCrouching()
  "isSprinting": boolean,    // isSprinting()
  "address": String          // connection.getRemoteAddress().toString()
}
```

### Server Information Model

```java
{
  "name": String,            // getMotd() [verify type]
  "version": String,         // SharedConstants.getCurrentVersion().getName()
  "coreType": "Java",
  "coreName": "Forge",
  "maxPlayers": int,         // getMaxPlayers()
  "onlinePlayers": int,      // getPlayerCount()
  "port": int,               // getPort()
  "motd": String,            // getMotd() [verify type]
  "whitelistEnabled": boolean, // PlayerList.isUsingWhitelist()
  "onlineMode": boolean,     // usesAuthentication()
  "worlds": [
    {
      "name": String,        // dimension().location().toString()
      "dimension": String,   // dimension().location().toString()
      "difficulty": String,  // getDifficulty().getKey()
      "playerCount": int     // players().size()
    }
  ]
}
```

### Server Status Model

```java
{
  "status": "online",
  "uptime": long,            // System.currentTimeMillis() - serverStartTime
  "players": {
    "online": int,           // getPlayerCount()
    "max": int               // getMaxPlayers()
  },
  "performance": {
    "tps": double,           // Calculated from tickTimes array
    "memoryUsage": long,     // Runtime memory calculation
    "memoryMax": long,       // Runtime.maxMemory()
    "memoryPercent": double  // Calculated percentage
  }
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection Analysis

After analyzing all acceptance criteria, several properties can be consolidated:

**Consolidation 1**: Properties 1.1-1.14 (individual player API methods) can be grouped into a comprehensive "Player API Access" property that verifies all player information retrieval methods work correctly.

**Consolidation 2**: Properties 2.1-2.9 (individual server API methods) can be grouped into a comprehensive "Server API Access" property.

**Consolidation 3**: Properties 6.2 and 6.3 are subsumed by 6.1 (compilation success).

**Consolidation 4**: Properties 7.5 and 7.6 are subsumed by 7.1 (JSON response structure preservation).

**Consolidation 5**: Properties 8.1, 8.2, 8.4, and 8.5 all test round-trip serialization and can be consolidated into two comprehensive round-trip properties.

### Property 1: Player Information API Completeness

*For any* ServerPlayer instance in Minecraft 1.20.1, all player information retrieval methods (getUUID(), getName(), getDisplayName(), level field, getX()/getY()/getZ(), connection.latency(), getGameProfile(), getHealth(), getMaxHealth(), getFoodData(), experienceLevel, experienceProgress, gameMode, getAbilities(), isCrouching(), isSprinting(), connection.getRemoteAddress()) SHALL return valid, non-null values of the correct type.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14**

### Property 2: Server Information API Completeness

*For any* MinecraftServer instance in Minecraft 1.20.1, all server information retrieval methods (execute(), getCommands(), createCommandSourceStack(), getMotd(), SharedConstants.getCurrentVersion().getName(), getMaxPlayers(), getPlayerCount(), getPort(), usesAuthentication()) SHALL return valid, non-null values of the correct type.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

### Property 3: Player Count Invariant

*For any* MinecraftServer instance, the current player count SHALL always be less than or equal to the maximum player count (getPlayerCount() <= getMaxPlayers()).

**Validates: Requirements 2.6, 2.7**

### Property 4: Health Invariant

*For any* ServerPlayer instance, the current health SHALL always be less than or equal to the maximum health (getHealth() <= getMaxHealth()) and both values SHALL be non-negative.

**Validates: Requirements 1.8**

### Property 5: TPS Bounds

*For any* calculated TPS value from server tick times, the TPS SHALL be bounded between 0.0 and 20.0 inclusive.

**Validates: Requirements 2.11**

### Property 6: Uptime Monotonicity

*For any* two sequential uptime measurements, the second measurement SHALL be greater than or equal to the first (uptime is monotonically increasing).

**Validates: Requirements 2.10**

### Property 7: Safe Entity Casting

*For any* Entity instance, attempting to cast to ServerPlayer SHALL only succeed when instanceof ServerPlayer returns true, preventing ClassCastException.

**Validates: Requirements 3.1**

### Property 8: World API Completeness

*For any* ServerLevel instance in Minecraft 1.20.1, all world information retrieval methods (dimension(), getDifficulty(), players()) SHALL return valid, non-null values of the correct type.

**Validates: Requirements 3.5, 3.6, 3.7**

### Property 9: PlayerList API Completeness

*For any* PlayerList instance in Minecraft 1.20.1, all player list methods (getWhiteListNames(), isUsingWhitelist(), broadcastSystemMessage()) SHALL execute without throwing exceptions and return valid values.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 10: Command API Completeness

*For any* CommandSourceStack instance in Minecraft 1.20.1, the getServer() method SHALL return a valid, non-null MinecraftServer instance.

**Validates: Requirements 4.1**

### Property 11: Command Permission Enforcement

*For any* command builder with requires() predicate, the command SHALL only execute when the predicate returns true for the command source.

**Validates: Requirements 4.2**

### Property 12: Compilation Success

*For the* Forge connector codebase, running Gradle build SHALL complete with exit code 0 and zero compilation errors.

**Validates: Requirements 6.1**

### Property 13: Player Data JSON Round-Trip

*For any* valid player data object, serializing to JSON, then parsing, then serializing again SHALL produce equivalent JSON output (structural equality).

**Validates: Requirements 8.1, 8.4**

### Property 14: Server Status JSON Round-Trip

*For any* valid server status object, serializing to JSON, then parsing, then serializing again SHALL produce equivalent JSON output (structural equality).

**Validates: Requirements 8.2, 8.5**

### Property 15: WebSocket Message Structure Preservation

*For any* valid WebSocket operation (player.list, player.info, player.kick, player.message, whitelist.list, whitelist.add, whitelist.remove, command.execute, server.info, server.status, server.restart, server.stop), the JSON response structure SHALL match the expected U-WBP v2.0 format with all required fields present.

**Validates: Requirements 7.1**

### Property 16: Event Data Structure Preservation

*For any* player event (join, leave, chat), the forwarded event data SHALL contain all required fields in the expected JSON structure matching U-WBP v2.0 format.

**Validates: Requirements 7.2**

### Property 17: Command Execution Preservation

*For any* valid Minecraft command string, executing the command through the Forge connector SHALL produce the same server-side effects as executing it directly through the server console.

**Validates: Requirements 7.3**

### Property 18: Configuration Value Preservation

*For any* configuration key in the Forge connector config file, the retrieved value SHALL match the value stored in the file (no data corruption during read).

**Validates: Requirements 7.4**

### Property 19: Error Handling Consistency

*For any* error condition (null server, player not found, invalid parameters), the error response SHALL contain a "success": false field and an "error" message field in the JSON response.

**Validates: Requirements 7.7**

### Property 20: WebSocket Message Parsing Correctness

*For any* valid U-WBP v2.0 WebSocket message, parsing SHALL correctly extract the message type, operation, request ID, and all parameters without data loss.

**Validates: Requirements 8.3**

## Error Handling

### Compilation Error Resolution Strategy

Each of the 91 compilation errors follows a systematic resolution pattern:

1. **Identify the error**: Determine if it's a method name change, field vs method access, or type conversion issue
2. **Locate the correct API**: Reference Minecraft 1.20.1 / Forge 47.2.0 documentation
3. **Apply the fix**: Update the code with the correct API call
4. **Verify type safety**: Ensure all type conversions are safe and explicit
5. **Test the fix**: Verify the fix compiles and produces correct output

### Runtime Error Handling

All API access points include appropriate error handling:

```java
try {
    MinecraftServer server = mod.getServer();
    if (server == null) {
        return createErrorResponse(requestId, operation, "Server not available");
    }
    
    // API operations here
    
} catch (Exception e) {
    logger.error("Operation failed", e);
    return createErrorResponse(requestId, operation, e.getMessage());
}
```

### Null Safety

All API calls that may return null are checked:

```java
ServerPlayer player = server.getPlayerList().getPlayer(UUID.fromString(playerId));
if (player == null) {
    return createErrorResponse(requestId, operation, "Player not found");
}
```

### Type Safety

All type conversions use safe patterns:

```java
// Safe instanceof check before casting
if (!(event.getEntity() instanceof ServerPlayer)) {
    return;
}
ServerPlayer player = (ServerPlayer) event.getEntity();
```

### Thread Safety

All server operations execute on the server thread:

```java
server.execute(() -> {
    // Server operations here
});
```

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Unit Testing

Unit tests focus on:

1. **Specific API Examples**: Test each API change with concrete examples
   - Example: Test that `player.getName().getString()` returns "Steve" for a test player named Steve
   - Example: Test that `SharedConstants.getCurrentVersion().getName()` returns a version string like "1.20.1"

2. **Edge Cases**: Test boundary conditions and special cases
   - Empty player lists
   - Null server instances
   - Invalid UUIDs
   - Maximum player count reached
   - Zero health players

3. **Error Conditions**: Test error handling paths
   - Player not found
   - Server not available
   - Invalid command syntax
   - Permission denied

4. **Integration Points**: Test component interactions
   - WebSocket message handling
   - Event forwarding
   - Command execution
   - Configuration loading

### Property-Based Testing

Property-based testing uses **fast-check** (JavaScript/TypeScript) or **jqwik** (Java) to generate random test inputs and verify properties hold across all inputs.

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `@Property("Feature: forge-api-compatibility-fix, Property {number}: {property_text}")`

**Property Test Examples**:

```java
@Property
@Label("Feature: forge-api-compatibility-fix, Property 3: Player Count Invariant")
void playerCountNeverExceedsMaximum(@ForAll ServerPlayer player) {
    MinecraftServer server = player.getServer();
    assertThat(server.getPlayerCount()).isLessThanOrEqualTo(server.getMaxPlayers());
}

@Property
@Label("Feature: forge-api-compatibility-fix, Property 4: Health Invariant")
void playerHealthNeverExceedsMaxHealth(@ForAll ServerPlayer player) {
    assertThat(player.getHealth()).isLessThanOrEqualTo(player.getMaxHealth());
    assertThat(player.getHealth()).isGreaterThanOrEqualTo(0.0f);
}

@Property
@Label("Feature: forge-api-compatibility-fix, Property 5: TPS Bounds")
void tpsBoundedBetweenZeroAndTwenty(@ForAll("tickTimesArray") long[] tickTimes) {
    double tps = calculateTPS(tickTimes);
    assertThat(tps).isBetween(0.0, 20.0);
}

@Property
@Label("Feature: forge-api-compatibility-fix, Property 13: Player Data JSON Round-Trip")
void playerDataRoundTrip(@ForAll ServerPlayer player) {
    JsonObject json1 = serializePlayerData(player);
    PlayerData parsed = parsePlayerData(json1);
    JsonObject json2 = serializePlayerData(parsed);
    assertThat(json1).isEqualTo(json2);
}

@Property
@Label("Feature: forge-api-compatibility-fix, Property 15: WebSocket Message Structure Preservation")
void webSocketResponseStructure(@ForAll("validOperations") String operation, @ForAll String requestId) {
    JsonObject response = handleOperation(operation, requestId);
    assertThat(response.has("type")).isTrue();
    assertThat(response.has("id")).isTrue();
    assertThat(response.has("op")).isTrue();
    assertThat(response.has("timestamp")).isTrue();
    assertThat(response.has("version")).isTrue();
    assertThat(response.has("data")).isTrue();
}
```

### Testing Library Selection

For Java/Forge connector:
- **Primary**: jqwik (https://jqwik.net/) - Property-based testing for Java
- **Alternative**: JUnit-Quickcheck
- **Unit Testing**: JUnit 5

### Test Coverage Goals

- **API Method Coverage**: 100% of all changed API methods must have tests
- **Property Coverage**: All 20 correctness properties must have property-based tests
- **Error Path Coverage**: All error handling paths must have unit tests
- **Integration Coverage**: All WebSocket operations must have integration tests

### Compilation Verification

The primary validation is successful compilation:

```bash
cd connectors/forge
./gradlew clean build

# Expected output:
# BUILD SUCCESSFUL
# 0 compilation errors
```

### Behavioral Verification

After compilation success, verify behavioral preservation:

1. **Start Test Server**: Launch Minecraft server with Forge connector
2. **Connect WebSocket Client**: Establish connection to management server
3. **Execute Test Operations**: Run all WebSocket operations
4. **Verify Responses**: Compare JSON responses to expected structures
5. **Monitor Events**: Verify events are forwarded correctly
6. **Test Commands**: Execute commands and verify results

### Regression Testing

Maintain a test suite of:
- 50+ unit tests covering all API changes
- 20 property-based tests (one per correctness property)
- 12 integration tests (one per WebSocket operation)
- 5 event tests (join, leave, chat, start, stop)

All tests must pass before deployment.

