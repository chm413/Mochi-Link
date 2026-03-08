# 操作名一致性审计报告

## 审计日期
2024-01-XX

## 审计范围
- Koishi 插件端（TypeScript）
- Folia 连接器（Java）
- Forge 连接器（Java）
- Fabric 连接器（Java）
- Nukkit 连接器（Java）

## 操作名对照表

### 1. 服务器管理操作

| 功能 | Koishi 定义 | 连接器支持 | 状态 | 备注 |
|------|------------|-----------|------|------|
| 获取服务器信息 | `server.getInfo` | `server.getInfo`, `server.info` | ✅ 一致 | 连接器支持两种命名 |
| 获取服务器状态 | `server.getStatus` | `server.getStatus`, `server.status` | ✅ 一致 | 连接器支持两种命名 |
| 获取性能指标 | `server.getMetrics` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 关闭服务器 | `server.shutdown` | `server.shutdown`, `server.stop` | ✅ 一致 | 连接器支持两种命名 |
| 重启服务器 | `server.restart` | `server.restart` | ✅ 一致 | |
| 重载配置 | `server.reload` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 保存世界 | `server.save` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |

### 2. 玩家管理操作

| 功能 | Koishi 定义 | 连接器支持 | 状态 | 备注 |
|------|------------|-----------|------|------|
| 获取玩家列表 | `player.list` | `player.list` | ✅ 一致 | |
| 获取玩家信息 | `player.getInfo` | `player.getInfo`, `player.info` | ✅ 一致 | 连接器支持两种命名 |
| 踢出玩家 | `player.kick` | `player.kick` | ✅ 一致 | |
| 封禁玩家 | `player.ban` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 解封玩家 | `player.unban` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 获取封禁列表 | `player.banlist` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 发送私聊 | `player.message` | `player.message` | ✅ 一致 | |
| 传送玩家 | `player.teleport` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |

### 3. 白名单操作

| 功能 | Koishi 定义 | 连接器支持 | 状态 | 备注 |
|------|------------|-----------|------|------|
| 获取白名单 | `whitelist.get` | `whitelist.get`, `whitelist.list` | ✅ 一致 | 连接器支持两种命名 |
| 添加白名单 | `whitelist.add` | `whitelist.add` | ✅ 一致 | |
| 移除白名单 | `whitelist.remove` | `whitelist.remove` | ✅ 一致 | |
| 启用白名单 | `whitelist.enable` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 禁用白名单 | `whitelist.disable` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |

### 4. 指令操作

| 功能 | Koishi 定义 | Plugin Adapter 发送 | 连接器支持 | 状态 | 备注 |
|------|------------|-------------------|-----------|------|------|
| 执行指令 | `command.execute` | `server.command` | `command.execute`, `server.command` | ✅ 已修复 | 已添加 server.command 支持 |
| 指令建议 | `command.suggest` | ❌ 未使用 | ❌ 未实现 | ⚠️ 缺失 | 两端都未实现 |
| 批量执行 | `command.batch` | ❌ 未使用 | ❌ 未实现 | ⚠️ 缺失 | 两端都未实现 |

### 5. 权限操作

| 功能 | Koishi 定义 | 连接器支持 | 状态 | 备注 |
|------|------------|-----------|------|------|
| 授予权限 | `permission.grant` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现，由 Koishi 端管理 |
| 撤销权限 | `permission.revoke` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现，由 Koishi 端管理 |
| 更新权限 | `permission.update` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现，由 Koishi 端管理 |
| 查询权限 | `permission.query` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现，由 Koishi 端管理 |
| 列出权限 | `permission.list` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现，由 Koishi 端管理 |

### 6. 世界操作

| 功能 | Koishi 定义 | 连接器支持 | 状态 | 备注 |
|------|------------|-----------|------|------|
| 获取世界列表 | `world.list` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 获取世界信息 | `world.getInfo` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 设置时间 | `world.setTime` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 设置天气 | `world.setWeather` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |
| 广播消息 | `world.broadcast` | ❌ 未实现 | ⚠️ 缺失 | 连接器未实现此操作 |

### 7. 事件订阅

| 功能 | Koishi 定义 | 连接器支持 | 状态 | 备注 |
|------|------------|-----------|------|------|
| 订阅事件 | `event.subscribe` | `event.subscribe` | ✅ 一致 | |
| 取消订阅 | `event.unsubscribe` | `event.unsubscribe` | ✅ 一致 | |

### 8. 系统操作

| 功能 | Koishi 定义 | 连接器支持 | 状态 | 备注 |
|------|------------|-----------|------|------|
| Ping | `ping` | `ping` | ✅ 一致 | 系统消息 |
| Pong | `pong` | `pong` | ✅ 一致 | 系统消息 |
| 握手 | `handshake` | `handshake` | ✅ 一致 | 系统消息 |
| 能力声明 | `capabilities` | ✅ 支持 | ✅ 一致 | 系统消息 |
| 断开连接 | `disconnect` | ✅ 支持 | ✅ 一致 | 系统消息 |

## 发现的问题

### 1. 指令执行操作名不一致 ✅ 已修复
**问题**：Koishi Plugin Adapter 发送 `server.command`，但连接器只处理 `command.execute`

**影响**：指令无法执行

**修复**：在所有连接器中添加对 `server.command` 的支持

**修复文件**：
- `connectors/folia/src/main/java/com/mochilink/connector/folia/connection/FoliaConnectionManager.java`
- `connectors/forge/src/main/java/com/mochilink/connector/forge/connection/ForgeConnectionManager.java`
- `connectors/fabric/src/main/java/com/mochilink/connector/fabric/connection/FabricConnectionManager.java`
- `connectors/nukkit/src/main/java/com/mochilink/connector/nukkit/connection/NukkitConnectionManager.java`

### 2. 连接器缺少部分操作实现 ⚠️ 待实现

以下操作在 Koishi 端定义但连接器未实现：

**服务器操作**：
- `server.getMetrics` - 获取性能指标
- `server.reload` - 重载配置
- `server.save` - 保存世界

**玩家操作**：
- `player.ban` - 封禁玩家
- `player.unban` - 解封玩家
- `player.banlist` - 获取封禁列表
- `player.teleport` - 传送玩家

**白名单操作**：
- `whitelist.enable` - 启用白名单
- `whitelist.disable` - 禁用白名单

**指令操作**：
- `command.suggest` - 指令建议
- `command.batch` - 批量执行

**世界操作**：
- `world.list` - 获取世界列表
- `world.getInfo` - 获取世界信息
- `world.setTime` - 设置时间
- `world.setWeather` - 设置天气
- `world.broadcast` - 广播消息

### 3. 操作名命名不统一 ⚠️ 建议统一

**现状**：连接器同时支持多种命名方式（如 `server.getInfo` 和 `server.info`）

**建议**：
1. 在 U-WBP v2 协议中明确标准命名
2. 推荐使用 `动词.名词` 格式（如 `get`, `set`, `list`）
3. 保持向后兼容，但在文档中标注推荐用法

**推荐命名规范**：
- 获取信息：`*.getInfo` 或 `*.info`
- 获取状态：`*.getStatus` 或 `*.status`
- 获取列表：`*.list`
- 添加：`*.add`
- 移除：`*.remove`
- 启用：`*.enable`
- 禁用：`*.disable`
- 执行：`*.execute`

## 建议的修复优先级

### P0 - 关键问题（已修复）
- ✅ 指令执行操作名不一致

### P1 - 高优先级（建议实现）
- `player.ban` / `player.unban` / `player.banlist` - 玩家封禁管理
- `server.save` - 保存世界
- `whitelist.enable` / `whitelist.disable` - 白名单开关

### P2 - 中优先级（可选实现）
- `server.getMetrics` - 性能指标
- `server.reload` - 重载配置
- `player.teleport` - 传送玩家
- `command.batch` - 批量执行

### P3 - 低优先级（未来考虑）
- `world.*` - 世界管理操作
- `command.suggest` - 指令建议

## 测试建议

### 1. 集成测试
为每个操作创建端到端测试，验证：
- Koishi 端发送请求
- 连接器正确接收和处理
- 连接器返回正确响应
- Koishi 端正确解析响应

### 2. 兼容性测试
测试所有支持的操作名变体：
- `server.getInfo` 和 `server.info`
- `server.getStatus` 和 `server.status`
- `player.getInfo` 和 `player.info`
- `whitelist.get` 和 `whitelist.list`
- `command.execute` 和 `server.command`

### 3. 错误处理测试
测试未实现操作的错误响应：
- 连接器应返回明确的错误消息
- 错误消息应指明操作未实现
- 建议提供替代方案（如果有）

## 文档更新建议

### 1. API 文档
- 明确标注每个操作的支持状态
- 列出所有支持的操作名变体
- 说明哪些操作由 Koishi 端管理（如权限操作）

### 2. 连接器文档
- 列出每个连接器支持的操作
- 说明不同核心的限制（如 Folia 的线程模型）
- 提供操作示例和最佳实践

### 3. 迁移指南
- 如果更改操作名，提供迁移指南
- 说明向后兼容策略
- 提供版本对照表

## 总结

1. **已修复**：指令执行操作名不一致问题
2. **待实现**：15+ 个操作在连接器端缺失
3. **建议**：统一操作命名规范，优先实现高优先级操作
4. **测试**：需要完善的集成测试和兼容性测试
5. **文档**：需要更新 API 文档和连接器文档

## 附录：完整操作名列表

### Koishi 端定义的所有操作（src/protocol/messages.ts）

**请求操作（RequestOperation）**：
```typescript
'server.getInfo', 'server.getStatus', 'server.getMetrics', 'server.shutdown',
'server.restart', 'server.reload', 'server.save', 'player.list', 'player.getInfo',
'player.kick', 'player.ban', 'player.unban', 'player.banlist', 'player.message',
'player.teleport', 'whitelist.get', 'whitelist.add', 'whitelist.remove',
'whitelist.enable', 'whitelist.disable', 'command.execute', 'command.suggest',
'command.batch', 'permission.grant', 'permission.revoke', 'permission.update',
'permission.query', 'permission.list', 'world.list', 'world.getInfo',
'world.setTime', 'world.setWeather', 'world.broadcast'
```

**事件操作（EventOperation）**：
```typescript
'player.join', 'player.leave', 'player.chat', 'player.death',
'player.advancement', 'player.move', 'server.status', 'server.logLine',
'server.metrics', 'alert.tpsLow', 'alert.memoryHigh', 'alert.playerFlood',
'alert.diskSpace', 'alert.connectionLost'
```

**系统操作（SystemOperation）**：
```typescript
'ping', 'pong', 'handshake', 'capabilities', 'disconnect', 'error'
```

### 连接器实现的操作

**已实现**：
- `player.list`, `player.getInfo/info`, `player.kick`, `player.message`
- `whitelist.get/list`, `whitelist.add`, `whitelist.remove`
- `command.execute`, `server.command` (新增)
- `server.getInfo/info`, `server.getStatus/status`
- `server.restart`, `server.shutdown/stop`
- `event.subscribe`, `event.unsubscribe`

**未实现**：
- 所有 `player.ban*` 操作
- 所有 `whitelist.enable/disable` 操作
- 所有 `world.*` 操作
- 所有 `permission.*` 操作（由 Koishi 端管理）
- `server.getMetrics`, `server.reload`, `server.save`
- `command.suggest`, `command.batch`
- `player.teleport`
