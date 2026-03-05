# 服务器配置架构说明

## 概述

Mochi-Link 系统采用**混合存储架构**来管理服务器配置和状态信息：
- **静态配置**：存储在数据库中，很少变化
- **动态状态**：通过实时查询获取，频繁变化

## 配置分类

### 静态配置（数据库存储）

这些信息存储在 `minecraft_servers` 表中：

| 字段 | 类型 | 说明 | 更新频率 |
|------|------|------|----------|
| `id` | string | 服务器唯一标识 | 创建时 |
| `name` | string | 服务器名称 | 很少 |
| `core_type` | string | 核心类型（Java/Bedrock） | 几乎不变 |
| `core_name` | string | 核心名称（Folia/Paper/Spigot） | 升级时 |
| `core_version` | string | 核心版本 | 升级时 |
| `connection_mode` | string | 连接模式（plugin/rcon/terminal） | 很少 |
| `connection_config` | text | 连接配置（JSON） | 很少 |
| `status` | string | 连接状态（online/offline/error） | 连接变化时 |
| `owner_id` | string | 所有者 ID | 很少 |
| `tags` | text | 标签（JSON 数组） | 偶尔 |
| `created_at` | timestamp | 创建时间 | 创建时 |
| `updated_at` | timestamp | 更新时间 | 每次更新 |
| `last_seen` | timestamp | 最后在线时间 | 心跳时 |

**特点**：
- 变化频率低（小时/天/周级别）
- 需要持久化保存
- 用于服务器识别和连接管理
- 在握手时部分信息会被更新（`core_version`, `core_name`）

### 动态状态（实时查询）

这些信息通过 `server.get_info` 或 `server.get_status` 请求获取：

| 字段 | 类型 | 说明 | 更新频率 |
|------|------|------|----------|
| `whitelistEnabled` | boolean | 白名单是否开启 | 秒/分钟级 |
| `maxPlayers` | number | 最大玩家数 | 很少 |
| `onlinePlayers` | number | 当前在线玩家数 | 秒级 |
| `onlineMode` | boolean | 正版验证是否开启 | 很少 |
| `motd` | string | 服务器描述 | 偶尔 |
| `port` | number | 服务器端口 | 几乎不变 |
| `ip` | string | 服务器 IP | 几乎不变 |
| `tps` | number | 服务器 TPS | 秒级 |
| `memoryUsage` | object | 内存使用情况 | 秒级 |
| `cpuUsage` | number | CPU 使用率 | 秒级 |
| `worlds` | array | 世界列表 | 分钟级 |
| `players` | array | 玩家列表 | 秒级 |

**特点**：
- 变化频率高（秒/分钟级别）
- 不需要持久化（或短期缓存）
- 用于监控和实时管理
- 通过 WebSocket 请求实时获取

## 数据流

### 1. 服务器注册流程

```
用户注册服务器
    ↓
创建数据库记录（静态配置）
    ↓
生成 API Token
    ↓
返回 serverId 和 token
```

数据库记录示例：
```json
{
  "id": "server_001",
  "name": "主生存服",
  "core_type": "Java",
  "core_name": "Unknown",  // 初始值
  "core_version": "Unknown",  // 初始值
  "connection_mode": "plugin",
  "connection_config": {
    "plugin": {
      "host": "127.0.0.1",
      "port": 25565,
      "ssl": false
    }
  },
  "status": "offline",
  "owner_id": "user_001",
  "tags": ["生存"],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 2. 连接建立流程

```
Connector 连接到 Koishi
    ↓
发送握手消息（包含 serverInfo）
    ↓
Koishi 验证 token
    ↓
认证成功
    ↓
更新数据库（core_name, core_version, status）
    ↓
创建 WebSocket Bridge
    ↓
开始接收事件和处理请求
```

握手消息示例：
```json
{
  "type": "system",
  "op": "handshake",
  "data": {
    "serverId": "server_001",
    "authentication": {
      "token": "xxx",
      "method": "token"
    },
    "serverInfo": {
      "name": "Folia Server",
      "version": "git-Folia-1.20.4-R0.1-SNAPSHOT",
      "coreType": "Java",
      "coreName": "Folia"
    }
  }
}
```

更新后的数据库记录：
```json
{
  "id": "server_001",
  "name": "主生存服",
  "core_type": "Java",
  "core_name": "Folia",  // 已更新
  "core_version": "git-Folia-1.20.4-R0.1-SNAPSHOT",  // 已更新
  "status": "online",  // 已更新
  "last_seen": "2024-01-01T12:00:00Z",  // 已更新
  // ... 其他字段不变
}
```

### 3. 动态状态查询流程

```
用户请求服务器状态
    ↓
Koishi 发送 server.get_status 请求
    ↓
Connector 收集实时数据
    ↓
返回完整状态信息
    ↓
Koishi 返回给用户（可选短期缓存）
```

状态响应示例：
```json
{
  "type": "response",
  "op": "server.get_status",
  "data": {
    "status": "online",
    "players": {
      "online": 5,
      "max": 20,
      "list": ["Steve", "Alex"]
    },
    "performance": {
      "tps": 19.8,
      "mspt": 45.2,
      "cpuUsage": 65.5,
      "memoryUsage": 2048,
      "memoryMax": 4096
    },
    "config": {
      "whitelistEnabled": true,
      "onlineMode": true,
      "motd": "Welcome to my server"
    },
    "worlds": [
      {
        "name": "world",
        "playerCount": 5,
        "loadedChunks": 1024
      }
    ]
  }
}
```

## 为什么不在数据库中存储动态配置？

### 问题 1：数据过时

```
时间 T0: 数据库记录 whitelistEnabled = true
时间 T1: 管理员在游戏内执行 /whitelist off
时间 T2: 用户查询数据库，得到 whitelistEnabled = true（错误！）
```

### 问题 2：同步复杂

需要监听所有可能修改配置的途径：
- 游戏内命令
- 配置文件修改
- 其他插件修改
- 外部工具修改

每次修改都需要通知 Koishi 更新数据库，增加系统复杂度。

### 问题 3：存储浪费

这些信息变化频繁，存储历史记录意义不大，占用数据库空间。

### 问题 4：查询延迟

如果缓存这些信息，需要设置合理的过期时间：
- 过期时间太短：频繁查询，增加网络开销
- 过期时间太长：数据可能过时

不如直接实时查询，保证数据准确性。

## 最佳实践

### ✅ 正确做法

#### 1. 获取服务器基本信息（从数据库）
```typescript
const server = await serverManager.getServer(serverId);
console.log(server.coreName);  // "Folia"
console.log(server.coreVersion);  // "git-Folia-1.20.4"
console.log(server.status);  // "online"
```

#### 2. 获取服务器实时状态（通过 WebSocket）
```typescript
const status = await bridge.getServerStatus();
console.log(status.whitelistEnabled);  // true
console.log(status.onlinePlayers);  // 5
console.log(status.tps);  // 19.8
```

#### 3. 使用短期缓存（可选）
```typescript
// 缓存 30 秒
const cachedStatus = await cache.get(`server:${serverId}:status`, async () => {
  return await bridge.getServerStatus();
}, { ttl: 30000 });
```

### ❌ 错误做法

#### 1. 在数据库中存储动态状态
```typescript
// 不要这样做！
await db.update('minecraft_servers', serverId, {
  whitelist_enabled: true,  // 这个值很快就会过时
  online_players: 5,  // 这个值每秒都在变化
  tps: 19.8  // 这个值每秒都在变化
});
```

#### 2. 长期缓存动态状态
```typescript
// 不要这样做！
const cachedStatus = await cache.get(`server:${serverId}:status`, async () => {
  return await bridge.getServerStatus();
}, { ttl: 3600000 });  // 1 小时太长了！
```

#### 3. 在握手时交换所有配置
```java
// 不要这样做！
JsonObject handshake = new JsonObject();
// ... 基本信息 ...
handshake.addProperty("whitelistEnabled", server.hasWhitelist());  // 不需要
handshake.addProperty("onlinePlayers", server.getOnlinePlayers().size());  // 不需要
handshake.addProperty("tps", getCurrentTPS());  // 不需要
// 握手消息应该只包含静态信息
```

## 缓存策略建议

| 数据类型 | 缓存时间 | 说明 |
|---------|---------|------|
| 服务器基本信息 | 5 分钟 | 很少变化，可以较长缓存 |
| 白名单状态 | 30 秒 | 偶尔变化，短期缓存 |
| 在线玩家数 | 10 秒 | 频繁变化，极短缓存 |
| TPS/内存 | 5 秒 | 实时数据，几乎不缓存 |
| 玩家列表 | 10 秒 | 频繁变化，极短缓存 |
| 世界列表 | 1 分钟 | 很少变化，可以缓存 |

## 扩展：如果确实需要持久化动态配置

如果有特殊需求需要记录配置变化历史，应该：

### 方案 1：创建独立的配置历史表

```typescript
ctx.model.extend('server_config_history', {
  id: 'unsigned',
  server_id: 'string',
  config_key: 'string',
  config_value: 'text',
  changed_at: 'timestamp',
  changed_by: 'string'
}, {
  primary: 'id',
  autoInc: true
});
```

### 方案 2：使用时序数据库

对于 TPS、内存使用等性能指标，使用专门的时序数据库（如 InfluxDB）存储历史数据，用于性能分析和趋势预测。

### 方案 3：事件日志

记录配置变更事件到审计日志：
```json
{
  "operation": "config.change",
  "serverId": "server_001",
  "changes": {
    "whitelistEnabled": {
      "from": false,
      "to": true
    }
  },
  "changedBy": "admin",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 总结

1. **静态配置存数据库**：核心类型、版本、连接方式等
2. **动态状态实时查询**：白名单、在线玩家、TPS 等
3. **握手时更新版本信息**：确保数据库中的核心版本准确
4. **合理使用缓存**：根据数据变化频率设置缓存时间
5. **特殊需求特殊处理**：需要历史记录时使用专门的表或数据库

这种架构既保证了数据的准确性，又避免了不必要的存储和同步开销。

---

**文档版本**: 1.0.0  
**最后更新**: 2024-01-01  
**相关文档**: 
- `KOISHI_HANDSHAKE_ISSUE_ANALYSIS.md` - 握手信息处理问题分析
- `wiki/API接口文档.md` - API 接口规范
