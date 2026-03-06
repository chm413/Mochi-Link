# Forge API 兼容性修复设计文档

## Overview

Forge 连接器在 CI 构建时出现 97 个编译错误，这些错误是由于代码使用了 Forge 1.20.1 API 中不存在的方法和字段。本设计文档提供了系统化的 API 替换方案，确保代码与 Forge 1.20.1 API 完全兼容，同时保持与其他连接器（Fabric、Folia、Nukkit）的行为一致性。

修复策略：
1. 将所有不兼容的 API 调用替换为 Forge 1.20.1 中存在的正确方法
2. 为配置类添加缺失的 getter 方法
3. 确保类型转换的安全性
4. 保持代码的可读性和可维护性

受影响的文件：
- `ForgeMessageHandler.java` - 60+ 个 API 错误
- `ForgeEventHandler.java` - 20+ 个 API 错误
- `MochiLinkForgeCommand.java` - 10+ 个 API 错误
- `ForgeModConfig.java` - 缺少 getter 方法

## Glossary

- **Bug_Condition (C)**: 代码调用了 Forge 1.20.1 API 中不存在的方法或访问了不存在的字段
- **Property (P)**: 使用正确的 Forge 1.20.1 API 方法，代码能够成功编译并保持相同的功能行为
- **Preservation**: 修复后的代码必须保持与原代码相同的功能行为，不改变任何业务逻辑
- **ServerPlayer**: Forge 中表示服务器端玩家的类，包含玩家状态和操作方法
- **MinecraftServer**: Forge 中表示 Minecraft 服务器实例的类
- **API 兼容性**: 代码使用的 API 方法在目标 Forge 版本中存在且行为符合预期

## Bug Details

### Fault Condition

该 bug 在 CI 构建过程中触发，当 Gradle 编译 Forge 连接器代码时，编译器无法找到代码中引用的方法或字段。这些方法和字段在开发时可能存在于不同版本的 API 中，或者是错误的方法名称。

**Formal Specification:**
```
FUNCTION isBugCondition(codeStatement)
  INPUT: codeStatement of type JavaStatement
  OUTPUT: boolean
  
  RETURN (codeStatement.callsMethod() AND NOT methodExistsInForgeAPI(codeStatement.method))
         OR (codeStatement.accessesField() AND NOT fieldExistsInForgeAPI(codeStatement.field))
         OR (codeStatement.performsTypeCast() AND NOT typeCastIsValid(codeStatement.cast))
         OR (codeStatement.accessesConfigValue() AND NOT getterMethodExists(codeStatement.configField))
END FUNCTION
```

### Examples

**ServerPlayer API 错误示例：**
- `player.getStringUUID()` - 方法不存在，应使用 `player.getUUID().toString()`
- `player.getName().getString()` - getName() 返回 String 而非 Component，不需要 getString()
- `player.getDisplayName()` - 方法不存在，应使用 `player.getDisplayName()` 返回 Component
- `player.level()` - 方法不存在，应使用 `player.level` 字段或 `player.serverLevel()`
- `player.latency` - 字段不存在，应使用 `player.connection.latency()`

**MinecraftServer API 错误示例：**
- `server.getServerVersion()` - 方法不存在，应使用 `SharedConstants.getCurrentVersion().getName()`
- `server.getAverageTickTime()` - 方法不存在，需要手动计算 TPS
- `server.getServerStartTimeMillis()` - 方法不存在，需要自定义时间跟踪

**配置类错误示例：**
- `config.getMochiLinkHost()` - getter 方法不存在，但字段名为 `serverHost`
- `config.getMochiLinkPort()` - getter 方法不存在，但字段名为 `serverPort`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 所有 WebSocket 消息处理逻辑必须保持不变（player.list, player.info, player.kick 等）
- 所有事件处理逻辑必须保持不变（玩家加入、离开、聊天等）
- 所有命令功能必须保持不变（status, reconnect, info 等）
- 所有配置读取逻辑必须保持不变
- 生成的 JSON 数据结构必须保持不变
- 与管理服务器的通信协议必须保持不变

**Scope:**
所有不涉及 Forge API 调用的代码应完全不受影响。这包括：
- JSON 序列化和反序列化逻辑
- WebSocket 连接管理
- 事件订阅管理
- 重连机制
- 日志记录
- 错误处理

## Hypothesized Root Cause

基于错误分析，最可能的原因是：

1. **API 版本不匹配**: 代码可能是基于不同版本的 Forge API 编写的，或者参考了错误的 API 文档
   - 某些方法名称在不同版本间发生了变化
   - 某些字段变成了方法，或方法变成了字段
   - 某些 API 在 1.20.1 版本中被移除或重命名

2. **方法名称错误**: 开发者可能使用了不存在的便捷方法
   - `getStringUUID()` 不存在，需要使用 `getUUID().toString()`
   - `getDisplayName()` 返回类型可能与预期不同

3. **字段访问方式错误**: 某些属性需要通过方法访问而非直接字段访问
   - `player.latency` 应该是 `player.connection.latency()`
   - `player.level()` 应该是 `player.level` 字段

4. **配置类设计不完整**: ForgeModConfig 的字段名与 getter 方法名不一致
   - 字段名为 `serverHost` 但代码调用 `getMochiLinkHost()`
   - 字段名为 `serverPort` 但代码调用 `getMochiLinkPort()`

## Correctness Properties

Property 1: Fault Condition - API 调用编译成功

_For any_ 代码语句中调用了 Forge API 方法或访问了 Forge API 字段，修复后的代码 SHALL 使用在 Forge 1.20.1 API 中实际存在的方法或字段，使得编译器能够成功解析并编译该语句。

**Validates: Requirements 2.1-2.36**

Property 2: Preservation - 功能行为不变

_For any_ 不涉及 API 调用替换的代码逻辑（业务逻辑、数据处理、协议实现），修复后的代码 SHALL 产生与原代码完全相同的行为，保持所有功能特性、数据格式和通信协议不变。

**Validates: Requirements 3.1-3.10**

## Fix Implementation

### Changes Required

假设我们的根因分析是正确的，需要进行以下修改：

**File**: `connectors/forge/src/main/java/com/mochilink/connector/forge/protocol/ForgeMessageHandler.java`

**Function**: `handlePlayerList()`, `handlePlayerInfo()`, `handleServerInfo()`, `handleServerStatus()`, 等

**Specific Changes**:

1. **ServerPlayer UUID 获取**:
   - 将 `player.getStringUUID()` 替换为 `player.getUUID().toString()`
   - 影响：handlePlayerList(), handlePlayerInfo(), 事件处理器

2. **ServerPlayer 名称获取**:
   - 检查 `player.getName()` 的返回类型
   - 如果返回 String，移除 `.getString()` 调用
   - 如果返回 Component，保留 `.getString()` 调用
   - 影响：所有使用玩家名称的地方

3. **ServerPlayer 显示名称获取**:
   - 将 `player.getDisplayName()` 替换为 `player.getDisplayName().getString()`
   - 确保 getDisplayName() 返回 Component 类型
   - 影响：handlePlayerList(), handlePlayerInfo()

4. **ServerPlayer 世界获取**:
   - 将 `player.level()` 替换为 `player.level` 字段访问
   - 或使用 `player.serverLevel()` 方法（如果存在）
   - 影响：handlePlayerList(), handlePlayerInfo()

5. **ServerPlayer 坐标获取**:
   - 将 `player.getX()`, `player.getY()`, `player.getZ()` 替换为正确的方法
   - 可能是 `player.getX()`, `player.getY()`, `player.getZ()` 本身就是正确的
   - 或者使用 `player.position()` 获取 Vec3 对象
   - 影响：handlePlayerList(), handlePlayerInfo()

6. **ServerPlayer 延迟获取**:
   - 将 `player.latency` 替换为 `player.connection.latency()`
   - 或使用 `player.latency()` 方法（如果存在）
   - 影响：handlePlayerList(), handlePlayerInfo()

7. **ServerPlayer GameProfile 获取**:
   - 确认 `player.getGameProfile()` 是否存在
   - 如果不存在，使用替代方法获取 GameProfile
   - 影响：handlePlayerList()

8. **ServerPlayer 生命值获取**:
   - 确认 `player.getHealth()` 和 `player.getMaxHealth()` 是否存在
   - 可能需要使用 `player.getHealth()` 和 `player.getMaxHealth()` 本身
   - 影响：handlePlayerList(), handlePlayerInfo()

9. **ServerPlayer 饥饿值获取**:
   - 确认 `player.getFoodData()` 是否存在
   - 影响：handlePlayerList(), handlePlayerInfo()

10. **ServerPlayer 经验获取**:
    - 将 `player.experienceLevel` 和 `player.experienceProgress` 替换为正确的访问方式
    - 可能是字段访问或 getter 方法
    - 影响：handlePlayerInfo()

11. **ServerPlayer 游戏模式获取**:
    - 将 `player.gameMode.getGameModeForPlayer()` 替换为正确的方法
    - 可能是 `player.gameMode.getGameModeForPlayer()` 或 `player.gameMode.getGameType()`
    - 影响：handlePlayerList(), handlePlayerInfo()

12. **ServerPlayer 能力获取**:
    - 确认 `player.getAbilities()` 是否存在
    - 影响：handlePlayerInfo()

13. **ServerPlayer 状态检查**:
    - 确认 `player.isCrouching()` 和 `player.isSprinting()` 是否存在
    - 可能是 `player.isCrouching()` 和 `player.isSprinting()` 本身
    - 影响：handlePlayerInfo()

14. **ServerPlayer IP 地址获取**:
    - 将 `player.getIpAddress()` 替换为 `player.connection.getRemoteAddress()`
    - 或使用其他方法获取 IP 地址
    - 影响：handlePlayerInfo()

**File**: `connectors/forge/src/main/java/com/mochilink/connector/forge/protocol/ForgeMessageHandler.java`

**Function**: `handleServerInfo()`, `handleServerStatus()`, `handleServerRestart()`, `handleServerStop()`

**Specific Changes**:

15. **MinecraftServer 任务执行**:
    - 确认 `server.execute()` 是否存在
    - 这个方法通常存在，可能不需要修改
    - 影响：多个方法

16. **MinecraftServer 命令管理器获取**:
    - 确认 `server.getCommands()` 是否存在
    - 影响：handleWhitelistAdd(), handleWhitelistRemove(), handleCommandExecute()

17. **MinecraftServer 命令源创建**:
    - 确认 `server.createCommandSourceStack()` 是否存在
    - 影响：handleWhitelistAdd(), handleWhitelistRemove(), handleCommandExecute()

18. **MinecraftServer MOTD 获取**:
    - 确认 `server.getMotd()` 是否存在
    - 影响：handleServerInfo()

19. **MinecraftServer 版本获取**:
    - 将 `server.getServerVersion()` 替换为 `SharedConstants.getCurrentVersion().getName()`
    - 需要导入 `net.minecraft.SharedConstants`
    - 影响：handleServerInfo()

20. **MinecraftServer 最大玩家数获取**:
    - 确认 `server.getMaxPlayers()` 是否存在
    - 影响：handlePlayerList(), handleServerInfo(), handleServerStatus(), handleStats()

21. **MinecraftServer 当前玩家数获取**:
    - 确认 `server.getPlayerCount()` 是否存在
    - 影响：handleServerInfo(), handleServerStatus(), handleStats()

22. **MinecraftServer 端口获取**:
    - 确认 `server.getPort()` 是否存在
    - 影响：handleServerInfo()

23. **MinecraftServer 正版验证检查**:
    - 确认 `server.usesAuthentication()` 是否存在
    - 影响：handleServerInfo()

24. **MinecraftServer 启动时间获取**:
    - 将 `server.getServerStartTimeMillis()` 替换为自定义时间跟踪
    - 在服务器启动时记录时间戳，然后计算运行时间
    - 影响：handleServerStatus()

25. **MinecraftServer 平均 Tick 时间获取**:
    - 将 `server.getAverageTickTime()` 替换为手动计算
    - 使用 `server.tickTimes` 数组或其他方法计算 TPS
    - 影响：handleServerStatus(), handleStats()

26. **MinecraftServer 停止方法**:
    - 确认 `server.halt(false)` 是否存在
    - 可能需要使用 `server.stopServer()` 或其他方法
    - 影响：handleServerRestart(), handleServerStop()

**File**: `connectors/forge/src/main/java/com/mochilink/connector/forge/protocol/ForgeMessageHandler.java`

**Function**: `handleWhitelistList()`, `handleServerInfo()`

**Specific Changes**:

27. **Entity 到 ServerPlayer 的类型转换**:
    - 在 ForgeEventHandler 中，确保使用 `instanceof` 检查
    - 使用安全的类型转换：`if (entity instanceof ServerPlayer player) { ... }`
    - 影响：ForgeEventHandler 中的事件处理方法

28. **PlayerList 白名单获取**:
    - 将 `server.getPlayerList().getWhiteListNames()` 替换为正确的方法
    - 可能是 `server.getPlayerList().getWhiteList()` 返回集合
    - 影响：handleWhitelistList()

29. **PlayerList 白名单状态检查**:
    - 确认 `server.getPlayerList().isUsingWhitelist()` 是否存在
    - 影响：handleWhitelistList(), handleServerInfo()

30. **PlayerList 广播消息**:
    - 确认 `server.getPlayerList().broadcastSystemMessage()` 是否存在
    - 影响：handleServerRestart(), handleServerStop()

31. **ServerLevel 维度获取**:
    - 确认 `level.dimension()` 是否存在
    - 影响：handlePlayerList(), handlePlayerInfo(), handleServerInfo()

32. **ServerLevel 难度获取**:
    - 确认 `level.getDifficulty()` 是否存在
    - 影响：handleServerInfo()

33. **ServerLevel 玩家列表获取**:
    - 确认 `level.players()` 是否存在
    - 影响：handleServerInfo()

**File**: `connectors/forge/src/main/java/com/mochilink/connector/forge/commands/MochiLinkForgeCommand.java`

**Function**: `register()`

**Specific Changes**:

34. **CommandSourceStack 服务器获取**:
    - 确认 `source.getServer()` 是否存在
    - 影响：handleStats()

35. **LiteralArgumentBuilder 权限要求**:
    - 确认 `builder.requires()` 是否存在
    - 影响：register()

**File**: `connectors/forge/src/main/java/com/mochilink/connector/forge/config/ForgeModConfig.java`

**Specific Changes**:

36. **添加缺失的 getter 方法**:
    - 添加 `getMochiLinkHost()` 方法，返回 `serverHost` 字段
    - 添加 `getMochiLinkPort()` 方法，返回 `serverPort` 字段
    - 或者将所有调用 `getMochiLinkHost()` 的地方改为 `getServerHost()`
    - 或者将所有调用 `getMochiLinkPort()` 的地方改为 `getServerPort()`
    - 影响：所有使用配置的地方

## Testing Strategy

### Validation Approach

测试策略采用两阶段方法：首先在未修复的代码上运行编译以确认错误存在，然后在修复后的代码上运行编译和功能测试以验证修复的正确性和行为保持不变。

### Exploratory Fault Condition Checking

**Goal**: 在实施修复之前，确认编译错误的存在并理解根本原因。如果我们的根因分析被反驳，需要重新假设。

**Test Plan**: 在未修复的代码上运行 Gradle 编译，收集所有编译错误信息，分析错误类型和模式。

**Test Cases**:
1. **编译 ForgeMessageHandler**: 运行编译并记录所有 API 错误（预期失败）
2. **编译 ForgeEventHandler**: 运行编译并记录所有 API 错误（预期失败）
3. **编译 MochiLinkForgeCommand**: 运行编译并记录所有 API 错误（预期失败）
4. **编译 ForgeModConfig**: 运行编译并记录缺失的 getter 方法错误（预期失败）

**Expected Counterexamples**:
- 编译器报告 "cannot find symbol" 错误，指向不存在的方法或字段
- 可能的原因：API 版本不匹配、方法名称错误、字段访问方式错误

### Fix Checking

**Goal**: 验证对于所有触发 bug 条件的代码语句，修复后的代码能够成功编译。

**Pseudocode:**
```
FOR ALL codeStatement WHERE isBugCondition(codeStatement) DO
  fixedStatement := applyAPIFix(codeStatement)
  ASSERT compilerCanResolve(fixedStatement)
  ASSERT fixedStatement.usesCorrectForgeAPI()
END FOR
```

**Test Plan**: 
1. 应用所有 API 修复
2. 运行完整的 Gradle 编译
3. 确认没有编译错误
4. 验证所有 API 调用都使用了 Forge 1.20.1 中存在的方法

**Test Cases**:
1. **编译成功测试**: 修复后的代码应该能够成功编译，没有任何错误
2. **API 验证测试**: 所有 API 调用都应该指向 Forge 1.20.1 API 中实际存在的方法
3. **类型安全测试**: 所有类型转换都应该是安全的，没有类型不匹配错误

### Preservation Checking

**Goal**: 验证对于所有不涉及 API 调用替换的代码逻辑，修复后的代码产生与原代码相同的行为。

**Pseudocode:**
```
FOR ALL functionality WHERE NOT affectedByAPIFix(functionality) DO
  ASSERT behaviorAfterFix(functionality) = behaviorBeforeFix(functionality)
END FOR
```

**Testing Approach**: 由于这是 API 替换而非逻辑修改，保持性测试主要关注功能行为是否保持不变。推荐使用集成测试和手动测试来验证。

**Test Plan**: 在修复后的代码上运行功能测试，观察所有功能是否按预期工作。

**Test Cases**:
1. **WebSocket 消息处理保持性**: 验证所有消息类型（player.list, player.info 等）的处理逻辑和响应格式保持不变
2. **事件处理保持性**: 验证玩家加入、离开、聊天等事件的处理和转发逻辑保持不变
3. **命令功能保持性**: 验证所有命令（status, reconnect, info 等）的功能保持不变
4. **配置读取保持性**: 验证配置文件的读取和使用保持不变
5. **JSON 格式保持性**: 验证生成的 JSON 数据结构与修复前完全一致
6. **通信协议保持性**: 验证与管理服务器的通信协议保持不变

### Unit Tests

- 测试每个修复的 API 调用是否返回预期的数据类型
- 测试配置类的新 getter 方法是否返回正确的值
- 测试类型转换的安全性（Entity 到 ServerPlayer）
- 测试边界情况（null 值、空列表等）

### Property-Based Tests

- 生成随机的玩家数据，验证所有 API 调用都能正确处理
- 生成随机的服务器状态，验证状态查询 API 的正确性
- 测试在各种服务器配置下，配置读取逻辑的正确性

### Integration Tests

- 测试完整的 WebSocket 消息处理流程（从接收消息到发送响应）
- 测试完整的事件处理流程（从事件触发到事件转发）
- 测试完整的命令执行流程（从命令输入到命令响应）
- 测试与真实 Forge 1.20.1 服务器的集成
- 测试与管理服务器的完整通信流程
