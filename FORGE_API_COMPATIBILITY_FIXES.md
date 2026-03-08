# Forge API Compatibility Fixes for Minecraft 1.20.1

## Issues Found

Based on the build errors, here are the API incompatibilities:

### 1. Player Name API
- **Error**: `getName().getString()` - getString() doesn't exist
- **Fix**: In MC 1.20.1, `getName()` returns `Component`, use `.getString()` on it
- **Actually**: Need to verify - might return String directly in 1.20.1

### 2. Player Level Access
- **Error**: `player.level` - field not accessible
- **Fix**: Use `player.level()` method

### 3. Player Connection Latency
- **Error**: `player.connection.latency()` - method doesn't exist
- **Fix**: Use `player.latency` field directly

### 4. Server Methods
- **Error**: Various server methods not found
- **Issues**:
  - `server.getMotd()` → Use `server.getServerModName()`
  - `server.getServerVersion()` → Use `server.getServerVersion()`
  - `server.getPlayerCount()` → Use `server.getPlayerList().getPlayerCount()`
  - `server.getMaxPlayers()` → Use `server.getMaxPlayers()`
  - `server.execute()` → Use `server.submit()`

### 5. Player Methods
- **Error**: Various player methods
- **Issues**:
  - `player.getGameProfile()` → Use `player.getGameProfile()`
  - `player.getAbilities()` → Use `player.getAbilities()`
  - `player.isCrouching()` → Use `player.isCrouching()`
  - `player.isSprinting()` → Use `player.isSprinting()`
  - `player.connection.getRemoteAddress()` → Use `player.getIpAddress()`

### 6. World/Level Methods
- **Error**: World dimension access
- **Fix**: `world.dimension()` returns ResourceKey, use `.location()` to get ResourceLocation

### 7. Command Execution
- **Error**: `server.getCommands().performPrefixedCommand()`
- **Fix**: Use `server.getCommands().performCommand()`

### 8. Whitelist Methods
- **Error**: `server.getPlayerList().getWhiteListNames()`
- **Fix**: Use `server.getPlayerList().getWhiteList().getEntries()`
- **Error**: `server.getPlayerList().isUsingWhitelist()`
- **Fix**: Use `server.getPlayerList().isWhiteListEnabled()`

### 9. Broadcast Methods
- **Error**: `server.getPlayerList().broadcastSystemMessage()`
- **Fix**: Use `server.getPlayerList().broadcastMessage()` with ChatType

### 10. Server Stop
- **Error**: `server.stopServer()`
- **Fix**: Use `server.halt(false)`

### 11. Performance Metrics
- **Error**: `server.getAverageTickTime()`
- **Fix**: Calculate from `server.tickTimes` array

### 12. Entity Type Checking
- **Error**: `Entity cannot be converted to ServerPlayer`
- **Fix**: This is correct - need to check Forge event API

## Implementation Plan

1. Fix all `getName().getString()` calls
2. Fix all `player.level` to `player.level()`
3. Fix all `player.connection.latency()` to `player.latency`
4. Fix all server method calls
5. Fix all whitelist API calls
6. Fix all broadcast calls
7. Fix command execution
8. Fix server stop/restart
9. Fix performance metrics calculation
10. Fix event handler entity type checks

