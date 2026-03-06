# Bugfix Requirements Document

## Introduction

Forge 连接器在 CI 构建时出现 97 个编译错误，这些错误是由于使用了 Forge 1.20.1 API 中不存在的方法和字段导致的。这个问题阻止了 Forge 连接器的成功编译和部署，影响了整个项目的 CI/CD 流程。

受影响的文件包括：
- `ForgeMessageHandler.java` - 主要消息处理逻辑
- `ForgeEventHandler.java` - 事件处理
- `MochiLinkForgeCommand.java` - 命令处理
- `ForgeModConfig.java` - 配置类

错误主要分为三类：
1. ServerPlayer API 错误（约 60+ 个）
2. MinecraftServer API 错误（约 20+ 个）
3. 其他 API 错误（约 17 个）

## Bug Analysis

### Current Behavior (Defect)

#### ServerPlayer API 错误

1.1 WHEN 代码调用 `ServerPlayer.getStringUUID()` THEN 编译器报错该方法不存在

1.2 WHEN 代码调用 `ServerPlayer.getName().getString()` THEN 编译器报错 String 类型没有 getString() 方法

1.3 WHEN 代码调用 `ServerPlayer.getDisplayName()` THEN 编译器报错该方法不存在

1.4 WHEN 代码调用 `ServerPlayer.level()` THEN 编译器报错该方法不存在

1.5 WHEN 代码调用 `ServerPlayer.getX()`, `getY()`, `getZ()` THEN 编译器报错这些方法不存在

1.6 WHEN 代码访问 `ServerPlayer.latency` 字段 THEN 编译器报错该字段不存在

1.7 WHEN 代码调用 `ServerPlayer.getGameProfile()` THEN 编译器报错该方法不存在

1.8 WHEN 代码调用 `ServerPlayer.getHealth()`, `getMaxHealth()` THEN 编译器报错这些方法不存在

1.9 WHEN 代码调用 `ServerPlayer.getFoodData()` THEN 编译器报错该方法不存在

1.10 WHEN 代码访问 `ServerPlayer.experienceLevel`, `experienceProgress` 字段 THEN 编译器报错这些字段不存在

1.11 WHEN 代码访问 `ServerPlayer.gameMode` 字段 THEN 编译器报错该字段不存在

1.12 WHEN 代码调用 `ServerPlayer.getAbilities()` THEN 编译器报错该方法不存在

1.13 WHEN 代码调用 `ServerPlayer.isCrouching()`, `isSprinting()` THEN 编译器报错这些方法不存在

1.14 WHEN 代码调用 `ServerPlayer.getIpAddress()` THEN 编译器报错该方法不存在

#### MinecraftServer API 错误

1.15 WHEN 代码调用 `MinecraftServer.execute()` THEN 编译器报错该方法不存在

1.16 WHEN 代码调用 `MinecraftServer.getCommands()` THEN 编译器报错该方法不存在

1.17 WHEN 代码调用 `MinecraftServer.createCommandSourceStack()` THEN 编译器报错该方法不存在

1.18 WHEN 代码调用 `MinecraftServer.getMotd()` THEN 编译器报错该方法不存在

1.19 WHEN 代码调用 `MinecraftServer.getServerVersion()` THEN 编译器报错该方法不存在

1.20 WHEN 代码调用 `MinecraftServer.getMaxPlayers()` THEN 编译器报错该方法不存在

1.21 WHEN 代码调用 `MinecraftServer.getPlayerCount()` THEN 编译器报错该方法不存在

1.22 WHEN 代码调用 `MinecraftServer.getPort()` THEN 编译器报错该方法不存在

1.23 WHEN 代码调用 `MinecraftServer.usesAuthentication()` THEN 编译器报错该方法不存在

1.24 WHEN 代码调用 `MinecraftServer.getServerStartTimeMillis()` THEN 编译器报错该方法不存在

1.25 WHEN 代码调用 `MinecraftServer.getAverageTickTime()` THEN 编译器报错该方法不存在

1.26 WHEN 代码调用 `MinecraftServer.halt()` THEN 编译器报错该方法不存在

#### 其他 API 错误

1.27 WHEN 代码尝试将 Entity 转换为 ServerPlayer THEN 编译器报错类型转换不兼容

1.28 WHEN 代码调用 `PlayerList.getWhiteListNames()` THEN 编译器报错该方法不存在

1.29 WHEN 代码调用 `PlayerList.isUsingWhitelist()` THEN 编译器报错该方法不存在

1.30 WHEN 代码调用 `PlayerList.broadcastSystemMessage()` THEN 编译器报错该方法不存在

1.31 WHEN 代码调用 `ServerLevel.dimension()` THEN 编译器报错该方法不存在

1.32 WHEN 代码调用 `ServerLevel.getDifficulty()` THEN 编译器报错该方法不存在

1.33 WHEN 代码调用 `ServerLevel.players()` THEN 编译器报错该方法不存在

1.34 WHEN 代码调用 `CommandSourceStack.getServer()` THEN 编译器报错该方法不存在

1.35 WHEN 代码调用 `LiteralArgumentBuilder.requires()` THEN 编译器报错该方法不存在

1.36 WHEN 代码访问 `ForgeModConfig` 的配置值 THEN 编译器报错缺少 getter 方法

### Expected Behavior (Correct)

#### ServerPlayer API 修复

2.1 WHEN 代码需要获取玩家 UUID 字符串 THEN 系统 SHALL 使用 `player.getUUID().toString()` 方法

2.2 WHEN 代码需要获取玩家名称 THEN 系统 SHALL 使用 `player.getName().getString()` 方法（getName() 返回 Component 类型）

2.3 WHEN 代码需要获取玩家显示名称 THEN 系统 SHALL 使用 `player.getDisplayName().getString()` 方法

2.4 WHEN 代码需要获取玩家所在世界 THEN 系统 SHALL 使用 `player.level()` 或 `player.serverLevel()` 方法

2.5 WHEN 代码需要获取玩家坐标 THEN 系统 SHALL 使用 `player.getX()`, `player.getY()`, `player.getZ()` 方法

2.6 WHEN 代码需要获取玩家延迟 THEN 系统 SHALL 使用 `player.connection.latency()` 或 `player.latency()` 方法

2.7 WHEN 代码需要获取玩家 GameProfile THEN 系统 SHALL 使用 `player.getGameProfile()` 方法

2.8 WHEN 代码需要获取玩家生命值 THEN 系统 SHALL 使用 `player.getHealth()` 和 `player.getMaxHealth()` 方法

2.9 WHEN 代码需要获取玩家饥饿值 THEN 系统 SHALL 使用 `player.getFoodData()` 方法

2.10 WHEN 代码需要获取玩家经验 THEN 系统 SHALL 使用 `player.experienceLevel` 和 `player.experienceProgress` 字段

2.11 WHEN 代码需要获取玩家游戏模式 THEN 系统 SHALL 使用 `player.gameMode.getGameModeForPlayer()` 方法

2.12 WHEN 代码需要获取玩家能力 THEN 系统 SHALL 使用 `player.getAbilities()` 方法

2.13 WHEN 代码需要检查玩家状态 THEN 系统 SHALL 使用 `player.isCrouching()` 和 `player.isSprinting()` 方法

2.14 WHEN 代码需要获取玩家 IP 地址 THEN 系统 SHALL 使用 `player.connection.getRemoteAddress()` 或 `player.getIpAddress()` 方法

#### MinecraftServer API 修复

2.15 WHEN 代码需要在主线程执行任务 THEN 系统 SHALL 使用 `server.execute()` 或 `server.submitAsync()` 方法

2.16 WHEN 代码需要获取命令管理器 THEN 系统 SHALL 使用 `server.getCommands()` 方法

2.17 WHEN 代码需要创建命令源 THEN 系统 SHALL 使用 `server.createCommandSourceStack()` 方法

2.18 WHEN 代码需要获取服务器 MOTD THEN 系统 SHALL 使用 `server.getMotd()` 方法

2.19 WHEN 代码需要获取服务器版本 THEN 系统 SHALL 使用 `server.getServerVersion()` 或 `SharedConstants.getCurrentVersion().getName()` 方法

2.20 WHEN 代码需要获取最大玩家数 THEN 系统 SHALL 使用 `server.getMaxPlayers()` 方法

2.21 WHEN 代码需要获取当前玩家数 THEN 系统 SHALL 使用 `server.getPlayerCount()` 方法

2.22 WHEN 代码需要获取服务器端口 THEN 系统 SHALL 使用 `server.getPort()` 方法

2.23 WHEN 代码需要检查是否启用正版验证 THEN 系统 SHALL 使用 `server.usesAuthentication()` 或 `server.isEnforceWhitelist()` 方法

2.24 WHEN 代码需要获取服务器启动时间 THEN 系统 SHALL 使用 `server.getServerStartTimeMillis()` 或自定义时间跟踪方法

2.25 WHEN 代码需要获取平均 Tick 时间 THEN 系统 SHALL 使用 `server.getAverageTickTime()` 或 `server.tickTimes` 数组计算

2.26 WHEN 代码需要停止服务器 THEN 系统 SHALL 使用 `server.halt(false)` 或 `server.stopServer()` 方法

#### 其他 API 修复

2.27 WHEN 代码需要将 Entity 转换为 ServerPlayer THEN 系统 SHALL 使用 `instanceof` 检查和安全类型转换

2.28 WHEN 代码需要获取白名单玩家列表 THEN 系统 SHALL 使用 `server.getPlayerList().getWhiteList()` 方法

2.29 WHEN 代码需要检查是否启用白名单 THEN 系统 SHALL 使用 `server.getPlayerList().isUsingWhitelist()` 或 `server.isEnforceWhitelist()` 方法

2.30 WHEN 代码需要广播系统消息 THEN 系统 SHALL 使用 `server.getPlayerList().broadcastSystemMessage()` 方法

2.31 WHEN 代码需要获取世界维度 THEN 系统 SHALL 使用 `level.dimension()` 方法

2.32 WHEN 代码需要获取世界难度 THEN 系统 SHALL 使用 `level.getDifficulty()` 方法

2.33 WHEN 代码需要获取世界中的玩家列表 THEN 系统 SHALL 使用 `level.players()` 方法

2.34 WHEN 代码需要从命令源获取服务器 THEN 系统 SHALL 使用 `source.getServer()` 方法

2.35 WHEN 代码需要设置命令权限要求 THEN 系统 SHALL 使用 `builder.requires()` 方法

2.36 WHEN 代码需要访问配置值 THEN 系统 SHALL 为 `ForgeModConfig` 添加 getter 方法

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Forge 连接器处理正常的 WebSocket 消息 THEN 系统 SHALL CONTINUE TO 正确处理和响应消息

3.2 WHEN Forge 连接器处理玩家事件（加入、离开、聊天等）THEN 系统 SHALL CONTINUE TO 正确捕获和转发事件

3.3 WHEN Forge 连接器执行命令 THEN 系统 SHALL CONTINUE TO 正确注册和执行命令

3.4 WHEN Forge 连接器读取配置文件 THEN 系统 SHALL CONTINUE TO 正确加载配置值

3.5 WHEN Forge 连接器在非 CI 环境（本地开发）构建 THEN 系统 SHALL CONTINUE TO 成功编译

3.6 WHEN Forge 连接器与其他 Minecraft 版本的 API 交互 THEN 系统 SHALL CONTINUE TO 保持兼容性

3.7 WHEN Forge 连接器处理玩家数据序列化 THEN 系统 SHALL CONTINUE TO 生成正确的 JSON 格式

3.8 WHEN Forge 连接器处理服务器状态查询 THEN 系统 SHALL CONTINUE TO 返回准确的服务器信息

3.9 WHEN Forge 连接器处理错误和异常 THEN 系统 SHALL CONTINUE TO 正确记录日志和处理异常

3.10 WHEN Forge 连接器与 Fabric 连接器共享通用逻辑 THEN 系统 SHALL CONTINUE TO 保持行为一致性
