# Nukkit 连接器构建修复计划

## 编译错误总结

### 1. 类型推断问题（var 关键字）
- `MochiLinkNukkitCommand.java`: 多处 var 被推断为 String
- 需要替换为明确的类型声明

### 2. API 不兼容问题
- `server.getPlayer()` 返回 `Optional<Player>` 而不是 `Player`
- `player.isFlying()` 方法不存在
- `player.getLoginChainData().getDeviceOS()` 返回 int 而不是枚举
- `server.getStartTime()` 方法不存在
- `level.getDifficulty()` 方法不存在
- `whitelist.add()` 方法不存在，应使用不同的 API

### 3. 配置方法缺失
- `NukkitPluginConfig` 缺少以下方法：
  - `getServerId()`
  - `getServerName()`
  - `getMochiLinkHost()`
  - `getMochiLinkPort()`

### 4. Logger 类型不兼容
- `plugin.getLogger()` 返回 `PluginLogger` 而不是 `java.util.logging.Logger`

### 5. 事件类缺失
- `PlayerDeathEvent` 在 Nukkit 中不存在或名称不同

## 修复策略

1. 将所有 var 替换为明确类型
2. 修复 Nukkit API 调用以匹配实际 API
3. 添加缺失的配置方法或使用替代方法
4. 修复 Logger 类型问题
5. 移除或修复不存在的事件处理器

## 优先级

高优先级：
- var 类型推断问题
- 配置方法缺失
- API 不兼容问题

中优先级：
- Logger 类型问题
- 事件处理器问题
