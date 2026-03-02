# Nukkit 连接器修复计划

## 需要修复的问题

### 1. Logger 类型不兼容
**错误**: `PluginLogger cannot be converted to Logger`
**位置**: NukkitMessageHandler.java:29
**修复**: 将 Logger 类型改为 PluginLogger 或使用适配器

### 2. Optional<Player> 类型问题
**错误**: `Optional<Player> cannot be converted to Player`
**位置**: NukkitMessageHandler.java:80, 133, 169
**修复**: 使用 Optional 的 get() 或 orElse() 方法

### 3. 缺失的方法
- `player.isFlying()` - 不存在
- `player.getLoginChainData().getDeviceOS().name()` - getDeviceOS() 返回 int
- `level.getDifficulty()` - 不存在
- `server.getStartTime()` - 不存在
- `whitelist.add(String)` - 不存在

### 4. 配置方法缺失
- `getServerId()`
- `getServerName()`
- `getMochiLinkHost()`
- `getMochiLinkPort()`

### 5. var 类型推断问题
多处 var 被推断为 String

### 6. PlayerDeathEvent 不存在
需要检查 Nukkit 的正确事件名称

## 修复顺序
1. 配置类方法
2. Logger 类型
3. Optional<Player> 处理
4. 缺失的 API 方法
5. var 类型推断
6. 事件处理器
