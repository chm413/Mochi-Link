# Forge API Compatibility Fixes Needed

## Status
The Forge connector has 91 compilation errors due to API incompatibilities with Forge 1.20.1.
Tasks 3.1-3.5 in the spec were marked complete but fixes were never applied.

## Critical Fixes Required

### 1. Import Addition
- ✅ DONE: Added `import net.minecraft.SharedConstants;`

### 2. Player API Fixes (ForgeMessageHandler.java)

#### Field vs Method Access:
- `player.level()` → `player.level` (field access, not method)
- `player.latency` → `player.connection.latency()` (method, not field)
- `player.experienceLevel` → Keep as field
- `player.experienceProgress` → Keep as field
- `player.gameMode` → Keep as field

#### Method Name Changes:
- `player.getName().getString()` → Check if getName() returns String or Component
  - If String: remove `.getString()`
  - If Component: keep `.getString()`
- `player.getDisplayName()` → Returns Component, needs `.getString()`
- `player.getX()`, `getY()`, `getZ()` → These should exist, verify
- `player.getGameProfile()` → Should exist, verify
- `player.getHealth()`, `getMaxHealth()` → Should exist, verify
- `player.getFoodData()` → Should exist, verify
- `player.getAbilities()` → Should exist, verify
- `player.isCrouching()` → Should exist, verify
- `player.isSprinting()` → Should exist, verify
- `player.getIpAddress()` → May need `player.connection.getRemoteAddress().toString()`

#### GameMode Access:
- `player.gameMode.getGameModeForPlayer()` → May need different method
  - Try: `player.gameMode.getGameModeForPlayer()`
  - Or: `player.gameMode.getGameType()`

### 3. Server API Fixes (ForgeMessageHandler.java)

#### Method Existence:
- `server.execute()` → Should exist, verify
- `server.getCommands()` → Should exist, verify
- `server.createCommandSourceStack()` → Should exist, verify
- `server.getMotd()` → May not exist, check alternative
- `server.getServerVersion()` → Replace with `SharedConstants.getCurrentVersion().getName()`
- `server.getMaxPlayers()` → Should exist, verify
- `server.getPlayerCount()` → Should exist, verify
- `server.getPort()` → Should exist, verify
- `server.usesAuthentication()` → May need alternative
- `server.getAverageTickTime()` → May not exist, calculate manually
- `server.stopServer()` → May be `server.halt(false)`

### 4. PlayerList API Fixes
- `server.getPlayerList().getWhiteListNames()` → May return different type
- `server.getPlayerList().isUsingWhitelist()` → Should exist, verify
- `server.getPlayerList().broadcastSystemMessage()` → Should exist, verify

### 5. ServerLevel API Fixes
- `level.dimension()` → Should exist, verify
- `level.getDifficulty()` → Should exist, verify
- `level.players()` → Should exist, verify

### 6. Event Handler Fixes (ForgeEventHandler.java)
- Entity to ServerPlayer cast → Use safe instanceof pattern
- `player.getName().getString()` → Same as above

### 7. Command Fixes (MochiLinkForgeCommand.java)
- `source.getServer()` → Should exist, verify
- `builder.requires()` → Should exist, verify

## Next Steps
1. Apply all fixes systematically
2. Run compilation to verify
3. Fix any remaining issues
4. Update task status

## References
- Spec: `.kiro/specs/forge-api-compatibility-fix/`
- Design Doc: Detailed API replacements in design.md
- Tasks: tasks.md shows what needs to be done
