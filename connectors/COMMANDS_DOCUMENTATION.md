# Mochi-Link Connectors 控制台指令文档

## 概述

所有 Mochi-Link Connectors 现在都支持完整的控制台指令系统，用于管理连接、配置和监控。

## 版本

- **文档版本**: 2.1.0
- **更新日期**: 2024-03-01

## 通用指令格式

所有 connectors 使用统一的指令格式：

```
/mochilink <subcommand> [args]
```

**别名**: `/ml`, `/mochi`, `/mlp` (部分 connectors)

## 指令列表

### 1. 状态查询

#### `/mochilink status`

查看连接器的当前状态。

**权限**: `mochilink.admin`

**输出信息**:
- 插件启用状态
- 连接状态（已连接/未连接）
- 队列中的消息数量
- 待处理的消息数量
- 当前重连尝试次数
- 总重连尝试次数
- 重连功能状态（启用/禁用）

**示例**:
```
=== MochiLink Status ===
Plugin: Enabled
Connection: Connected
Queued Messages: 0
Pending Messages: 2
Reconnect Attempts: 0/5
Reconnection: Enabled
```

---

### 2. 手动重连

#### `/mochilink reconnect`
#### `/mochilink retry`

手动触发重新连接到管理服务器。

**权限**: `mochilink.admin`

**功能**:
- 断开当前连接
- 如果重连功能被禁用，自动重新启用
- 立即尝试重新连接
- 重置重连计数器

**使用场景**:
- 服务器配置更改后
- 网络问题恢复后
- 重连功能被禁用后需要手动恢复

**示例**:
```
> /mochilink reconnect
Reconnecting to Mochi-Link management server...
Reconnection re-enabled!
Reconnection initiated!
```

---

### 3. 信息查询

#### `/mochilink info`

显示连接器的详细信息。

**权限**: `mochilink.admin`

**输出信息**:
- 服务器 ID
- 服务器名称
- 管理服务器地址和端口
- 协议版本
- 自动重连状态
- 最大重试次数

**示例**:
```
=== MochiLink Info ===
Server ID: server-001
Server Name: My Minecraft Server
Management Host: localhost:8080
Protocol Version: U-WBP v2.0
Auto Reconnect: Enabled
Max Retry Attempts: 10
```

---

### 4. 服务器统计

#### `/mochilink stats`

显示服务器的运行统计信息。

**权限**: `mochilink.admin`

**输出信息**:
- 在线玩家数 / 最大玩家数
- TPS (每秒刻数)
- 内存使用情况
- 服务器运行时间

**示例**:
```
=== Server Statistics ===
Players: 15/100
TPS: 19.98
Memory: 2048.50 MB
Uptime: 2d 5h 30m 15s
```

---

### 5. 配置管理

#### `/mochilink config get [key]`

查看配置值。

**权限**: `mochilink.admin`

**参数**:
- `key` (可选): 配置键名。如果省略，显示所有配置

**可用的配置键**:
- `server-id` - 服务器 ID
- `server-name` - 服务器名称
- `host` - 管理服务器主机
- `port` - 管理服务器端口
- `auto-reconnect` - 自动重连开关
- `retry-attempts` - 最大重试次数
- `retry-delay` - 重试延迟（毫秒）

**示例**:
```
> /mochilink config get
=== MochiLink Configuration ===
server-id: server-001
server-name: My Server
host: localhost
port: 8080
auto-reconnect: true
retry-attempts: 10
retry-delay: 5000ms

> /mochilink config get server-id
server-id: server-001
```

#### `/mochilink config set <key> <value>`

设置配置值（需要手动编辑配置文件）。

**权限**: `mochilink.admin`

**注意**: 此指令仅显示提示信息，实际配置需要手动编辑配置文件并使用 `/mochilink reload` 重载。

**示例**:
```
> /mochilink config set server-name NewName
Setting server-name to NewName...
Note: Config changes require /mochilink reload to take effect
Please edit config.yml manually and use /mochilink reload
```

---

### 6. 配置重载

#### `/mochilink reload`

重新加载配置文件并应用更改。

**权限**: `mochilink.admin`

**功能**:
- 重新读取配置文件
- 应用新的配置
- 使用新配置重新连接

**使用场景**:
- 修改配置文件后
- 更改服务器设置后

**示例**:
```
> /mochilink reload
Reloading MochiLink configuration...
Configuration reloaded successfully!
Reconnecting with new configuration...
```

---

### 7. 订阅事件查询

#### `/mochilink subscriptions`
#### `/mochilink subs`

查看当前活跃的事件订阅。

**权限**: `mochilink.admin`

**输出信息**:
- 订阅 ID
- 订阅的事件类型列表
- 过滤器（如果有）
- 创建时间

**示例**:
```
=== Active Event Subscriptions ===
ID: sub_1234567890_abcd
  Events: player.join, player.quit, player.chat
  Filters: {"world": "world"}
  Created: 2024-03-01 10:30:45

ID: sub_0987654321_efgh
  Events: server.start, server.stop
  Created: 2024-03-01 09:15:20

Total: 2 subscriptions
```

---

### 8. 重连控制

#### `/mochilink reconnection [action]`
#### `/mochilink recon [action]`

控制自动重连功能。

**权限**: `mochilink.admin`

**可用操作**:

##### 8.1 查看重连状态

```
/mochilink reconnection
/mochilink reconnection status
```

**输出信息**:
- 重连功能是否启用
- 是否正在重连
- 当前重连尝试次数
- 总重连尝试次数
- 下次重连间隔
- 最后一次尝试时间

**示例**:
```
=== Reconnection Status ===
Enabled: Yes
Currently Reconnecting: No
Current Attempts: 0
Total Attempts: 5
Next Interval: 5000ms
Last Attempt: 2024-03-01 10:25:30
```

##### 8.2 启用重连

```
/mochilink reconnection enable
```

重新启用自动重连功能（如果之前被禁用）。

**示例**:
```
> /mochilink reconnection enable
Reconnection enabled!
```

##### 8.3 禁用重连

```
/mochilink reconnection disable
```

禁用自动重连功能。

**使用场景**:
- 维护期间
- 故意断开连接
- 调试问题

**示例**:
```
> /mochilink reconnection disable
Reconnection disabled!
```

---

### 9. 帮助信息

#### `/mochilink help`

显示所有可用指令的帮助信息。

**权限**: `mochilink.admin`

**示例**:
```
=== MochiLink Commands ===
/mochilink status - Check connection status
/mochilink reconnect - Manually retry connection
/mochilink info - Show plugin information
/mochilink stats - Show server statistics
/mochilink config <get|set> - Manage configuration
/mochilink reload - Reload configuration
/mochilink subscriptions - List event subscriptions
/mochilink reconnection <enable|disable|status> - Control reconnection
/mochilink help - Show this help message
```

---

## 权限系统

### 主权限

- `mochilink.admin` - 允许使用所有 MochiLink 指令

### 细分权限（可选实现）

- `mochilink.status` - 查看状态
- `mochilink.reconnect` - 手动重连
- `mochilink.info` - 查看信息
- `mochilink.stats` - 查看统计
- `mochilink.config` - 管理配置
- `mochilink.reload` - 重载配置
- `mochilink.subscriptions` - 查看订阅
- `mochilink.reconnection` - 控制重连

---

## 使用场景

### 场景 1: 检查连接状态

```bash
# 1. 查看当前状态
/mochilink status

# 2. 如果未连接，查看重连状态
/mochilink reconnection

# 3. 如果重连被禁用，启用它
/mochilink reconnection enable

# 4. 手动触发重连
/mochilink reconnect
```

### 场景 2: 更新配置

```bash
# 1. 查看当前配置
/mochilink config get

# 2. 编辑配置文件（在服务器文件系统中）
# 例如: plugins/MochiLink/config.yml

# 3. 重载配置
/mochilink reload

# 4. 验证新配置
/mochilink info
```

### 场景 3: 监控订阅

```bash
# 1. 查看活跃订阅
/mochilink subscriptions

# 2. 查看连接状态
/mochilink status

# 3. 查看服务器统计
/mochilink stats
```

### 场景 4: 维护模式

```bash
# 1. 禁用自动重连
/mochilink reconnection disable

# 2. 进行维护工作...

# 3. 完成后重新启用
/mochilink reconnection enable

# 4. 手动重连
/mochilink reconnect
```

### 场景 5: 故障排查

```bash
# 1. 查看详细状态
/mochilink status

# 2. 查看重连历史
/mochilink reconnection

# 3. 查看配置
/mochilink config get

# 4. 查看订阅
/mochilink subscriptions

# 5. 尝试手动重连
/mochilink reconnect
```

---

## 各 Connector 实现状态

| Connector | 状态 | 文件路径 |
|-----------|------|----------|
| Fabric | ✅ 已实现 | `connectors/fabric/src/main/java/com/mochilink/connector/fabric/commands/MochiLinkFabricCommand.java` |
| Folia | ✅ 已实现 | `connectors/folia/src/main/java/com/mochilink/connector/folia/commands/MochiLinkFoliaCommand.java` |
| Forge | ✅ 已实现 | `connectors/forge/src/main/java/com/mochilink/connector/forge/commands/MochiLinkForgeCommand.java` |
| Nukkit | ✅ 已实现 | `connectors/nukkit/src/main/java/com/mochilink/connector/nukkit/commands/MochiLinkNukkitCommand.java` |
| Java (通用) | ✅ 已实现 | `connectors/java/src/main/java/com/mochilink/connector/commands/MochiLinkCommand.java` |
| LLBDS | ✅ 已实现 | `connectors/llbds/src/commands/CommandHandler.ts` |
| PMMP | ✅ 已实现 | `connectors/pmmp/src/com/mochilink/connector/pmmp/commands/MochiLinkPMMPCommand.php` |

---

## Tab 补全（Java Connectors）

Java 版本的 connectors 支持 Tab 补全功能：

```bash
/mochilink <TAB>
# 显示: status, reconnect, info, stats, config, reload, subscriptions, reconnection, help

/mochilink config <TAB>
# 显示: get, set

/mochilink reconnection <TAB>
# 显示: enable, disable, status
```

---

## 配置文件示例

### Folia/Paper/Spigot (config.yml)

```yaml
# 服务器标识
server-id: "server-001"
server-name: "My Minecraft Server"

# Mochi-Link 管理服务器配置
mochilink:
  host: "localhost"
  port: 8080
  path: "/ws"
  
  # 认证
  auth-token: "your-auth-token-here"
  
  # 重连配置
  auto-reconnect: true
  retry-attempts: 10
  retry-delay: 5000  # 毫秒
  
  # 超时配置
  timeout: 30000  # 毫秒
```

### PMMP (config.yml)

```yaml
# 服务器标识
server-id: "bedrock-001"
server-name: "My Bedrock Server"

# Mochi-Link 管理服务器配置
mochilink:
  host: "localhost"
  port: 8080
  path: "/ws"
  
  # 认证
  auth-token: "your-auth-token-here"
  
  # 重连配置
  auto-reconnect: true
  retry-attempts: 10
  retry-delay: 5000
  
  # 超时配置
  timeout: 30000
```

---

## 常见问题

### Q1: 为什么 `/mochilink config set` 不能直接修改配置？

A: 为了安全性和一致性，配置修改需要手动编辑配置文件。这样可以：
- 防止意外的配置更改
- 保持配置文件的完整性
- 允许添加注释和文档
- 支持版本控制

### Q2: 重连被禁用后如何恢复？

A: 使用以下指令：
```bash
/mochilink reconnection enable
/mochilink reconnect
```

### Q3: 如何查看重连失败的原因？

A: 查看服务器日志文件，重连失败时会记录详细的错误信息。

### Q4: 配置重载会断开当前连接吗？

A: 是的，`/mochilink reload` 会断开当前连接并使用新配置重新连接。

### Q5: 订阅信息从哪里来？

A: 订阅信息由管理服务器创建，通过 U-WBP 协议的 `event.subscribe` 请求建立。

---

## 开发指南

### 为新 Connector 添加指令支持

1. **创建指令类**:
   - 实现 `CommandExecutor` 接口（Java）
   - 继承 `Command` 类（PHP）

2. **注册指令**:
   - 在 `plugin.yml` 中注册（Java）
   - 在插件主类中注册（PHP）

3. **实现子指令**:
   - 参考 `MochiLinkFoliaCommand.java` 或 `MochiLinkPMMPCommand.php`
   - 实现所有标准子指令

4. **添加 Tab 补全**（可选，Java）:
   - 实现 `TabCompleter` 接口
   - 提供子指令和参数的补全

5. **测试**:
   - 测试所有子指令
   - 验证权限检查
   - 测试错误处理

---

## 更新日志

### v2.1.0 (2024-03-01)
- ✨ 新增完整的指令系统
- ✨ 新增配置管理指令
- ✨ 新增订阅查询指令
- ✨ 新增重连控制指令
- ✨ 新增 Tab 补全支持（Java）
- 📝 完善文档

### v1.0.0 (2024-02-01)
- 🎉 初始版本
- ✅ 基础状态查询
- ✅ 基础重连功能

---

**维护者**: Mochi-Link 开发团队  
**最后更新**: 2024-03-01  
**版本**: 2.1.0
