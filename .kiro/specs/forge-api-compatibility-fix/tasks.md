# Implementation Plan: Forge API Compatibility Fix

## Overview

This implementation plan addresses 91 compilation errors in the Mochi-Link Forge connector for Minecraft 1.20.1 (Forge 47.2.0). The errors stem from API incompatibilities where methods, fields, and type signatures have changed between Minecraft versions. The solution systematically updates all API calls to use the correct Minecraft 1.20.1 equivalents while preserving all existing functionality and behavior.

The implementation follows a methodical approach: fix compilation errors file by file, validate each change, and ensure all WebSocket operations continue to produce identical JSON responses.

## Tasks

- [ ] 1. Set up testing framework and validation utilities
  - Create test utilities for comparing JSON structures
  - Set up jqwik for property-based testing
  - Create mock objects for ServerPlayer and MinecraftServer
  - _Requirements: 6.1, 6.2, 6.3_

- [-] 2. Fix player information API calls in ForgeMessageHandler.java
  - [x] 2.1 Update UUID retrieval methods
    - Change all `player.getUUID()` calls to `player.getUUID().toString()` where string conversion is needed
    - Locations: lines 52, 91, 169, 207, 243, and similar patterns throughout the file
    - _Requirements: 1.1_
  
  - [x] 2.2 Update player name retrieval methods
    - Change `player.getName()` to `player.getName().getString()` for string extraction
    - Locations: lines 53, 92, 170, 208, and similar patterns
    - _Requirements: 1.2_
  
  - [x] 2.3 Update display name retrieval methods
    - Change `player.getDisplayName()` to `player.getDisplayName().getString()`
    - Locations: lines 54, 93
    - _Requirements: 1.3_
  
  - [x] 2.4 Update world/level access patterns
    - Change `player.level()` method calls to `player.level` field access
    - Locations: lines 55, 94
    - _Requirements: 1.4_
  
  - [x] 2.5 Update network latency access
    - Change `player.latency` to `player.connection.latency()` method call
    - Locations: lines 62, 101
    - _Requirements: 1.6_
  
  - [-] 2.6 Update game mode access
    - Verify `player.gameMode.getGameModeForPlayer()` method exists, use `getGameType()` if needed
    - Locations: lines 66, 108
    - _Requirements: 1.11_
  
  - [ ] 2.7 Update IP address retrieval
    - Change to `player.connection.getRemoteAddress().toString()`
    - Location: line 112
    - _Requirements: 1.14_
  
  - [ ]* 2.8 Write property test for player information API completeness
    - **Property 1: Player Information API Completeness**
    - **Validates: Requirements 1.1-1.14**
    - Test that all player information methods return valid, non-null values
  
  - [ ]* 2.9 Write unit tests for player information retrieval
    - Test specific examples: UUID format, name strings, coordinates
    - Test edge cases: null checks, empty strings
    - _Requirements: 1.1-1.14_

- [ ] 3. Fix server information API calls in ForgeMessageHandler.java
  - [ ] 3.1 Update server version retrieval
    - Replace `server.getServerVersion()` with `SharedConstants.getCurrentVersion().getName()`
    - Add import: `net.minecraft.SharedConstants;`
    - Location: line 420
    - _Requirements: 2.5_
  
  - [ ] 3.2 Update server MOTD retrieval
    - Verify `server.getMotd()` return type, add `.getString()` if it returns Component
    - Locations: lines 419, 421
    - _Requirements: 2.4_
  
  - [ ] 3.3 Implement TPS calculation from tick times array
    - Replace `server.getAverageTickTime()` with manual calculation using `server.tickTimes`
    - Calculate average tick time in nanoseconds, convert to milliseconds, derive TPS
    - Ensure TPS is capped at 20.0
    - Location: line 459
    - _Requirements: 2.11_
  
  - [ ] 3.4 Update server stop method
    - Verify `server.stopServer()` exists, replace with `server.halt(false)` if needed
    - Locations: lines 482, 520
    - _Requirements: 2.12_
  
  - [ ]* 3.5 Write property test for server information API completeness
    - **Property 2: Server Information API Completeness**
    - **Validates: Requirements 2.1-2.9**
    - Test that all server information methods return valid, non-null values
  
  - [ ]* 3.6 Write property test for TPS bounds
    - **Property 5: TPS Bounds**
    - **Validates: Requirements 2.11**
    - Test that calculated TPS is always between 0.0 and 20.0
  
  - [ ]* 3.7 Write unit tests for server information retrieval
    - Test version string format, MOTD extraction, TPS calculation accuracy
    - Test edge cases: empty tick times array, null server
    - _Requirements: 2.1-2.12_

- [ ] 4. Checkpoint - Verify ForgeMessageHandler.java compiles
  - Run `./gradlew compileJava` to check for remaining errors in ForgeMessageHandler.java
  - Ensure all tests pass, ask the user if questions arise

- [ ] 5. Fix player list and world API calls in ForgeMessageHandler.java
  - [ ] 5.1 Update whitelist retrieval
    - Verify `server.getPlayerList().getWhiteListNames()` method and return type
    - May need to iterate whitelist entries if method signature changed
    - Location: line 233
    - _Requirements: 3.2_
  
  - [ ] 5.2 Update system message broadcasting
    - Verify `server.getPlayerList().broadcastSystemMessage()` method signature
    - Locations: lines 475, 513
    - _Requirements: 3.4_
  
  - [ ]* 5.3 Write property test for player list API completeness
    - **Property 9: PlayerList API Completeness**
    - **Validates: Requirements 3.2, 3.3, 3.4**
    - Test that all PlayerList methods execute without exceptions
  
  - [ ]* 5.4 Write property test for world API completeness
    - **Property 8: World API Completeness**
    - **Validates: Requirements 3.5, 3.6, 3.7**
    - Test that all ServerLevel methods return valid values
  
  - [ ]* 5.5 Write unit tests for whitelist and world operations
    - Test whitelist data structure, message broadcasting
    - Test world dimension strings, difficulty values, player counts
    - _Requirements: 3.2-3.7_

- [ ] 6. Fix event handling in ForgeEventHandler.java
  - [ ] 6.1 Add safe entity type casting with instanceof checks
    - Replace direct casts with instanceof pattern matching
    - Add early return if entity is not ServerPlayer
    - Locations: lines 42, 72
    - _Requirements: 3.1_
  
  - [ ]* 6.2 Write property test for safe entity casting
    - **Property 7: Safe Entity Casting**
    - **Validates: Requirements 3.1**
    - Test that casting only succeeds when instanceof returns true
  
  - [ ]* 6.3 Write unit tests for event handling
    - Test player join/leave events with valid ServerPlayer
    - Test events with non-player entities (should be ignored)
    - _Requirements: 3.1, 7.2_

- [ ] 7. Fix command system in MochiLinkForgeCommand.java
  - [ ] 7.1 Verify command source API methods
    - Verify `source.getServer()` method exists and returns correct type
    - Verify `builder.requires()` method signature
    - Locations: lines 37, 149
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 7.2 Write property test for command API completeness
    - **Property 10: Command API Completeness**
    - **Validates: Requirements 4.1**
    - Test that CommandSourceStack.getServer() returns valid MinecraftServer
  
  - [ ]* 7.3 Write property test for command permission enforcement
    - **Property 11: Command Permission Enforcement**
    - **Validates: Requirements 4.2**
    - Test that commands only execute when permission predicate returns true
  
  - [ ]* 7.4 Write unit tests for command execution
    - Test command registration with permission requirements
    - Test command execution with valid and invalid permissions
    - _Requirements: 4.1, 4.2, 7.3_

- [ ] 8. Checkpoint - Verify all files compile successfully
  - Run `./gradlew clean build` to ensure zero compilation errors
  - Verify build completes with exit code 0
  - Ensure all tests pass, ask the user if questions arise

- [ ] 9. Implement behavioral preservation tests
  - [ ] 9.1 Create WebSocket message structure validation tests
    - Test all 12 WebSocket operations (player.list, player.info, player.kick, player.message, whitelist.list, whitelist.add, whitelist.remove, command.execute, server.info, server.status, server.restart, server.stop)
    - Verify JSON response structure matches U-WBP v2.0 format
    - _Requirements: 7.1_
  
  - [ ]* 9.2 Write property test for WebSocket message structure preservation
    - **Property 15: WebSocket Message Structure Preservation**
    - **Validates: Requirements 7.1**
    - Test that all operations produce responses with required fields
  
  - [ ]* 9.3 Write property test for event data structure preservation
    - **Property 16: Event Data Structure Preservation**
    - **Validates: Requirements 7.2**
    - Test that player events contain all required fields
  
  - [ ]* 9.4 Write unit tests for command execution preservation
    - Test that commands produce identical server-side effects
    - Compare command results before and after API changes
    - _Requirements: 7.3_

- [ ] 10. Implement JSON serialization round-trip tests
  - [ ] 10.1 Create player data serialization utilities
    - Implement serialize and parse functions for player data
    - Ensure JSON structure matches expected format
    - _Requirements: 8.1, 8.4_
  
  - [ ] 10.2 Create server status serialization utilities
    - Implement serialize and parse functions for server status
    - Ensure JSON structure matches expected format
    - _Requirements: 8.2, 8.5_
  
  - [ ]* 10.3 Write property test for player data JSON round-trip
    - **Property 13: Player Data JSON Round-Trip**
    - **Validates: Requirements 8.1, 8.4**
    - Test that serialize -> parse -> serialize produces equivalent JSON
  
  - [ ]* 10.4 Write property test for server status JSON round-trip
    - **Property 14: Server Status JSON Round-Trip**
    - **Validates: Requirements 8.2, 8.5**
    - Test that serialize -> parse -> serialize produces equivalent JSON
  
  - [ ]* 10.5 Write property test for WebSocket message parsing correctness
    - **Property 20: WebSocket Message Parsing Correctness**
    - **Validates: Requirements 8.3**
    - Test that parsing extracts all message fields without data loss

- [ ] 11. Implement invariant property tests
  - [ ]* 11.1 Write property test for player count invariant
    - **Property 3: Player Count Invariant**
    - **Validates: Requirements 2.6, 2.7**
    - Test that current player count <= max player count
  
  - [ ]* 11.2 Write property test for health invariant
    - **Property 4: Health Invariant**
    - **Validates: Requirements 1.8**
    - Test that current health <= max health and both are non-negative
  
  - [ ]* 11.3 Write property test for uptime monotonicity
    - **Property 6: Uptime Monotonicity**
    - **Validates: Requirements 2.10**
    - Test that uptime measurements are monotonically increasing

- [ ] 12. Implement error handling consistency tests
  - [ ]* 12.1 Write property test for error handling consistency
    - **Property 19: Error Handling Consistency**
    - **Validates: Requirements 7.7**
    - Test that all error conditions produce responses with "success": false and "error" fields
  
  - [ ]* 12.2 Write unit tests for error conditions
    - Test null server, player not found, invalid parameters
    - Verify error messages are descriptive and consistent
    - _Requirements: 7.7_

- [ ] 13. Final integration testing and validation
  - [ ] 13.1 Run complete test suite
    - Execute all unit tests and property-based tests
    - Verify all 20 correctness properties pass
    - Ensure minimum 100 iterations per property test
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 13.2 Perform manual integration testing
    - Start test Minecraft server with Forge connector
    - Connect WebSocket client and test all operations
    - Verify events are forwarded correctly
    - Test command execution and verify results
    - _Requirements: 7.1-7.7_
  
  - [ ] 13.3 Validate configuration access
    - Test that configuration values are read correctly
    - Verify no data corruption during config file parsing
    - _Requirements: 5.1, 5.2, 7.4_

- [ ] 14. Final checkpoint - Complete validation
  - Ensure all tests pass with zero failures
  - Verify `./gradlew clean build` completes successfully with zero compilation errors
  - Confirm all WebSocket operations produce correct JSON responses
  - Ask the user if questions arise before marking complete

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at critical milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- All API changes preserve existing functionality and JSON response structures
- The implementation uses Java for the Forge connector (Minecraft 1.20.1 / Forge 47.2.0)
