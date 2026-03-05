# 白名单配置存储分析

## 问题澄清

**问题**：服务器是否启用了白名单机制（`whitelistEnabled`）这个配置项，是否也因为握手时未传递而没有存储到数据库？

**答案**：是的，存在同样的问题。但这个问题的性质需要重新评估。

## 配置项的分类重新审视

### 1. 完全静态的配置（应该存储）

这些配置几乎不会改变，或者改变时需要重启服务器：

| 配置项 | 说明 | 变化频率 | 当前状态 |
|--------|------|----------|----------|
| `coreType` | 核心类型 | 几乎不变 | ✅ 已存储 |
| `coreName` | 核心名称 | 升级时 | ⚠️ 握手时未更新 |
| `coreVersion` | 核心版本 | 升级时 | ⚠️ 握手时未更新 |
| `port` | 服务器端口 | 很少 | ❌ 未存储 |

### 2. 半静态的配置（可以考虑存储）

这些配置可以动态修改，但修改频率较低，且对服务器管理有重要意义：

| 配置项 | 说明 | 变化频率 | 当前状态 |
|--------|------|----------|----------|
| `whitelistEnabled` | 白名单是否启用 | 偶尔（天/周级别） | ❌ 未存储 |
| `onlineMode` | 正版验证是否启用 | 很少 | ❌ 未存储 |
| `maxPlayers` | 最大玩家数 | 偶尔 | ❌ 未存储 |
| `motd` | 服务器描述 | 偶尔 | ❌ 未存储 |
| `difficulty` | 游戏难度 | 偶尔 | ❌ 未存储 |
| `pvpEnabled` | PVP 是否启用 | 偶尔 | ❌ 未存储 |

### 3. 动态状态（不应该存储）

这些是实时变化的状态，不应该持久化：

| 状态项 | 说明 | 变化频率 | 当前状态 |
|--------|------|----------|----------|
| `onlinePlayers` | 当前在线玩家数 | 秒级 | ✅ 实时查询 |
| `tps` | 服务器 TPS | 秒级 | ✅ 实时查询 |
| `memoryUsage` | 内存使用 | 秒级 | ✅ 实时查询 |
| `cpuUsage` | CPU 使用 | 秒级 | ✅ 实时查询 |

## 当前问题分析

### 问题 1：握手消息不包含配置信息

查看 Folia 的握手消息：

```java
// connectors/folia/src/main/java/com/mochilink/connector/folia/connection/FoliaConnectionManager.java
JsonObject serverInfo = new JsonObject();
serverInfo.addProperty("name", plugin.getServer().getName());
serverInfo.addProperty("version", plugin.getServer().getVersion());
serverInfo.addProperty("coreType", "Java");
serverInfo.addProperty("coreName", "Folia");
data.add("serverInfo", serverInfo);
```

**只包含**：
- ✅ `name`
- ✅ `version`
- ✅ `coreType`
- ✅ `coreName`

**不包含**：
- ❌ `whitelistEnabled`
- ❌ `onlineMode`
- ❌ `maxPlayers`
- ❌ `port`
- ❌ `motd`

### 问题 2：数据库模型不支持存储这些配置

查看数据库表定义：

```typescript
// src/database/models.ts
ctx.model.extend('minecraft_servers', {
  id: 'string',
  name: 'string',
  core_type: 'string',
  core_name: 'string',
  core_version: 'string',
  connection_mode: 'string',
  connection_config: 'text',
  status: 'string',
  owner_id: 'string',
  tags: 'text',
  created_at: 'timestamp',
  updated_at: 'timestamp',
  last_seen: 'timestamp'
});
```

**缺少的字段**：
- ❌ `whitelist_enabled`
- ❌ `online_mode`
- ❌ `max_players`
- ❌ `port`
- ❌ `motd`
- ❌ `difficulty`
- ❌ `pvp_enabled`

### 问题 3：这些配置只能通过 `server.get_info` 获取

```java
// connectors/folia/src/main/java/com/mochilink/connector/folia/protocol/FoliaMessageHandler.java
public JsonObject handleServerInfo(String requestId) {
    JsonObject serverInfo = new JsonObject();
    serverInfo.addProperty("whitelistEnabled", plugin.getServer().hasWhitelist());
    serverInfo.addProperty("onlineMode", plugin.getServer().getOnlineMode());
    serverInfo.addProperty("maxPlayers", plugin.getServer().getMaxPlayers());
    serverInfo.addProperty("port", plugin.getServer().getPort());
    serverInfo.addProperty("motd", plugin.getServer().getMotd());
    // ...
}
```

这意味着每次需要这些信息时，都要发送 WebSocket 请求。

## 是否应该存储这些配置？

### 支持存储的理由

1. **管理需求**：
   - 管理员可能想在面板上快速查看哪些服务器开启了白名单
   - 可以批量筛选"开启白名单的服务器"
   - 可以在服务器离线时仍然看到配置信息

2. **性能优化**：
   - 避免每次查询都发送 WebSocket 请求
   - 减少网络开销
   - 提高响应速度

3. **历史记录**：
   - 可以记录配置变更历史
   - 用于审计和分析

4. **变化频率适中**：
   - 白名单开关不是每秒都在变
   - 通常是天/周级别的变化
   - 可以接受短期的数据不一致

### 反对存储的理由

1. **数据一致性**：
   - 管理员可能在游戏内修改配置
   - 需要同步机制保持一致
   - 增加系统复杂度

2. **存储冗余**：
   - 这些信息可以实时查询
   - 存储可能导致数据过时

3. **同步成本**：
   - 需要监听配置变更事件
   - 需要实现配置同步逻辑

## 推荐方案

### 方案 A：扩展数据库模型 + 握手时同步（推荐）

#### 优点
- 提供快速查询能力
- 支持离线查看配置
- 支持批量筛选和统计

#### 实现步骤

**步骤 1：扩展数据库模型**

```typescript
// src/database/models.ts
ctx.model.extend('minecraft_servers', {
  // ... 现有字段 ...
  
  // 新增服务器配置字段
  whitelist_enabled: 'boolean',
  online_mode: 'boolean',
  max_players: 'integer',
  server_port: 'integer',
  server_motd: 'text',
  difficulty: 'string',
  pvp_enabled: 'boolean',
  
  // 配置最后更新时间
  config_updated_at: 'timestamp'
});
```

**步骤 2：在握手消息中包含配置**

```java
// connectors/folia/src/main/java/com/mochilink/connector/folia/connection/FoliaConnectionManager.java
JsonObject serverInfo = new JsonObject();
serverInfo.addProperty("name", plugin.getServer().getName());
serverInfo.addProperty("version", plugin.getServer().getVersion());
serverInfo.addProperty("coreType", "Java");
serverInfo.addProperty("coreName", "Folia");

// 新增：服务器配置
JsonObject serverConfig = new JsonObject();
serverConfig.addProperty("whitelistEnabled", plugin.getServer().hasWhitelist());
serverConfig.addProperty("onlineMode", plugin.getServer().getOnlineMode());
serverConfig.addProperty("maxPlayers", plugin.getServer().getMaxPlayers());
serverConfig.addProperty("port", plugin.getServer().getPort());
serverConfig.addProperty("motd", plugin.getServer().getMotd());
serverConfig.addProperty("difficulty", plugin.getServer().getWorlds().get(0).getDifficulty().name());
serverConfig.addProperty("pvpEnabled", plugin.getServer().isPVPEnabled());
serverInfo.add("config", serverConfig);

data.add("serverInfo", serverInfo);
```

**步骤 3：在认证成功后更新数据库**

```typescript
// src/index.ts
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    logger.info(`Server authenticated: ${connection.serverId}`);
    
    if (serviceManager) {
        try {
            await serviceManager.server.updateServerStatus(connection.serverId, 'online');
            
            // 更新服务器信息和配置
            const serverInfo = connection.getServerInfo();
            if (serverInfo) {
                await serviceManager.server.updateServer(connection.serverId, {
                    coreVersion: serverInfo.version,
                    coreName: serverInfo.coreName,
                    coreType: serverInfo.coreType,
                    // 新增：更新配置
                    whitelistEnabled: serverInfo.config?.whitelistEnabled,
                    onlineMode: serverInfo.config?.onlineMode,
                    maxPlayers: serverInfo.config?.maxPlayers,
                    serverPort: serverInfo.config?.port,
                    serverMotd: serverInfo.config?.motd,
                    difficulty: serverInfo.config?.difficulty,
                    pvpEnabled: serverInfo.config?.pvpEnabled,
                    configUpdatedAt: new Date()
                });
            }
            
            await serviceManager.server.createWebSocketBridge(connection.serverId, connection);
        } catch (error) {
            logger.error(`Failed to setup server ${connection.serverId}:`, error);
        }
    }
});
```

**步骤 4：定期同步配置（可选）**

```typescript
// 每 5 分钟同步一次配置
setInterval(async () => {
    const onlineServers = await serverManager.getOnlineServers();
    for (const server of onlineServers) {
        try {
            const bridge = serverManager.getBridge(server.id);
            if (bridge) {
                const info = await bridge.getServerInfo();
                await serverManager.updateServer(server.id, {
                    whitelistEnabled: info.whitelistEnabled,
                    onlineMode: info.onlineMode,
                    maxPlayers: info.maxPlayers,
                    // ... 其他配置
                    configUpdatedAt: new Date()
                });
            }
        } catch (error) {
            logger.error(`Failed to sync config for ${server.id}:`, error);
        }
    }
}, 5 * 60 * 1000);
```

### 方案 B：使用缓存层（备选）

不修改数据库，使用 Redis 或内存缓存存储配置：

```typescript
// 缓存 5 分钟
const serverConfig = await cache.get(
  `server:${serverId}:config`,
  async () => {
    const bridge = serverManager.getBridge(serverId);
    return await bridge.getServerInfo();
  },
  { ttl: 5 * 60 * 1000 }
);
```

#### 优点
- 不修改数据库结构
- 自动过期，减少数据不一致
- 实现简单

#### 缺点
- 服务器离线时无法查看配置
- 不支持历史记录
- 缓存失效后需要重新查询

### 方案 C：混合方案（最佳）

- **数据库**：存储关键配置（`whitelistEnabled`, `onlineMode`, `maxPlayers`）
- **实时查询**：获取实时状态（`onlinePlayers`, `tps`）
- **缓存**：短期缓存配置查询结果（1-5 分钟）

## 推荐实施方案

采用**方案 A（扩展数据库模型）**，原因：

1. **管理需求明确**：白名单状态对服务器管理很重要
2. **变化频率适中**：不会频繁变化，适合存储
3. **离线可查**：服务器离线时仍能查看配置
4. **支持筛选**：可以批量查询"开启白名单的服务器"
5. **实现成本可控**：握手时同步，定期更新

## 需要修改的文件

### Connector 端（所有核心）

1. `connectors/folia/src/main/java/com/mochilink/connector/folia/connection/FoliaConnectionManager.java`
2. `connectors/paper/src/main/java/com/mochilink/connector/paper/connection/PaperConnectionManager.java`
3. `connectors/spigot/src/main/java/com/mochilink/connector/spigot/connection/SpigotConnectionManager.java`
4. 其他核心的连接管理器...

### Koishi 端

1. `src/database/models.ts` - 扩展数据库模型
2. `src/types/index.ts` - 更新 TypeScript 类型
3. `src/websocket/auth.ts` - 提取配置信息
4. `src/websocket/connection.ts` - 存储配置信息
5. `src/index.ts` - 认证成功后更新配置
6. `src/services/server.ts` - 添加配置同步方法

## 数据库迁移

```typescript
// 添加新字段的迁移脚本
export async function migrateAddServerConfig(ctx: Context): Promise<void> {
  const logger = ctx.logger('mochi-link:migration');
  
  try {
    // 添加新字段
    await ctx.database.query(`
      ALTER TABLE minecraft_servers
      ADD COLUMN whitelist_enabled BOOLEAN DEFAULT NULL,
      ADD COLUMN online_mode BOOLEAN DEFAULT NULL,
      ADD COLUMN max_players INTEGER DEFAULT NULL,
      ADD COLUMN server_port INTEGER DEFAULT NULL,
      ADD COLUMN server_motd TEXT DEFAULT NULL,
      ADD COLUMN difficulty VARCHAR(20) DEFAULT NULL,
      ADD COLUMN pvp_enabled BOOLEAN DEFAULT NULL,
      ADD COLUMN config_updated_at TIMESTAMP DEFAULT NULL
    `);
    
    logger.info('Server config fields added successfully');
  } catch (error) {
    logger.error('Failed to add server config fields:', error);
    throw error;
  }
}
```

## 总结

1. **问题确认**：白名单启用状态确实没有存储到数据库
2. **原因**：握手消息中不包含，数据库模型也不支持
3. **性质评估**：这是一个**功能缺失**，而不是设计决策
4. **推荐方案**：扩展数据库模型，在握手时同步配置
5. **实施优先级**：中高（对服务器管理有重要意义）

---

**分析日期**: 2024-01-01  
**问题类型**: 功能缺失  
**修复优先级**: 中高
