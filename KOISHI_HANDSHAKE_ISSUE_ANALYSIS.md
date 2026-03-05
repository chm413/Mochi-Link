# Koishi 端握手信息处理问题分析

## 问题概述

Folia 插件在连接建立后正确发送了包含服务器版本信息的握手消息，但 Koishi 端在接收并认证后，**没有将握手消息中的 `serverInfo` 数据更新到数据库**。

### 额外发现：白名单等配置信息问题

经过进一步检查，发现：

1. **握手消息中不包含白名单配置**：Folia 插件的握手消息只包含基本的版本信息（`name`, `version`, `coreType`, `coreName`），不包含白名单是否开启、最大玩家数、MOTD 等服务器配置信息。

2. **配置信息在 `server.info` 操作中**：这些详细配置（`whitelistEnabled`, `maxPlayers`, `onlineMode`, `motd` 等）是通过 `server.info` 请求获取的，而不是在握手时交换。

3. **数据库模型不支持存储这些配置**：当前的 `minecraft_servers` 表只有基本字段（`id`, `name`, `core_type`, `core_name`, `core_version`, `connection_mode`, `connection_config`, `status`, `owner_id`, `tags`），**没有字段存储白名单状态、最大玩家数等服务器配置**。

4. **ServerInfo 接口与 ServerConfig 接口分离**：
   - `ServerConfig`：数据库持久化的服务器配置（基本信息）
   - `ServerInfo`：运行时的服务器状态信息（包含 `maxPlayers`, `onlinePlayers`, `tps` 等）

这是一个**设计决策**，而不是 bug：
- 静态配置（核心类型、版本）存储在数据库中
- 动态状态（白名单开启、在线玩家数、TPS）通过实时查询获取
- 避免数据库中的信息过时

## 当前实现情况

### 1. Folia 端发送的握手消息 ✅

位置：`connectors/folia/src/main/java/com/mochilink/connector/folia/connection/FoliaConnectionManager.java:164-204`

```java
private void sendHandshake() {
    JsonObject handshake = new JsonObject();
    handshake.addProperty("type", "system");
    handshake.addProperty("op", "handshake");
    handshake.addProperty("version", "2.0");
    
    JsonObject data = new JsonObject();
    data.addProperty("protocolVersion", "2.0");
    data.addProperty("serverType", "connector");
    data.addProperty("serverId", config.getServerId());
    
    // 认证信息
    JsonObject authentication = new JsonObject();
    authentication.addProperty("token", config.getServerToken());
    data.add("authentication", authentication);
    
    // 服务器信息 - 包含版本信息
    JsonObject serverInfo = new JsonObject();
    serverInfo.addProperty("name", plugin.getServer().getName());
    serverInfo.addProperty("version", plugin.getServer().getVersion());
    serverInfo.addProperty("coreType", "Java");
    serverInfo.addProperty("coreName", "Folia");
    data.add("serverInfo", serverInfo);
    
    handshake.add("data", data);
    sendMessage(handshake.toString());
}
```

发送的数据结构：
```json
{
  "type": "system",
  "op": "handshake",
  "version": "2.0",
  "data": {
    "protocolVersion": "2.0",
    "serverType": "connector",
    "serverId": "server_001",
    "authentication": {
      "token": "xxx",
      "method": "token"
    },
    "serverInfo": {
      "name": "Folia Server",
      "version": "git-Folia-1.20.4",
      "coreType": "Java",
      "coreName": "Folia"
    }
  }
}
```

### 2. Koishi 端认证处理 ⚠️

位置：`src/websocket/auth.ts:305-362`

```typescript
async handleAuthenticationMessage(
  message: UWBPSystemMessage,
  clientIP?: string
): Promise<UWBPSystemMessage | null> {
  if (message.op !== 'handshake') {
    return null;
  }

  const data = message.data;
  
  // 提取认证数据
  if (!data.authentication || !data.serverId) {
    return this.createAuthErrorResponse(message.id, 'Missing authentication data');
  }

  const { token, method } = data.authentication;
  const serverId = data.serverId;

  // 执行认证
  let result: AuthenticationResult;
  if (method === 'challenge') {
    result = await this.validateAuthenticationResponse(...);
  } else {
    result = await this.authenticateWithToken(serverId, token, clientIP);
  }

  if (result.success) {
    return this.createAuthSuccessResponse(message.id, result);
  } else {
    return this.createAuthErrorResponse(message.id, result.error);
  }
}
```

**问题：** 认证管理器只处理了 `authentication` 和 `serverId`，**完全忽略了 `serverInfo` 字段**！

### 3. 认证成功后的处理 ⚠️

位置：`src/index.ts:201-217`

```typescript
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    logger.info(`Server authenticated: ${connection.serverId}`);
    
    // 更新服务器状态为在线
    if (serviceManager) {
        try {
            await serviceManager.server.updateServerStatus(connection.serverId, 'online');
            
            // 创建 WebSocket bridge
            await serviceManager.server.createWebSocketBridge(connection.serverId, connection);
            
            logger.info(`Bridge created for server ${connection.serverId}`);
        } catch (error) {
            logger.error(`Failed to setup server ${connection.serverId}:`, error);
        }
    }
});
```

**问题：** 认证成功后只更新了服务器状态为 `online`，**没有更新服务器的版本信息**（`coreVersion`, `coreName` 等）！

### 4. 数据库模型支持 ✅

位置：`src/database/models.ts:177-254`

数据库模型完全支持存储这些信息：
- `core_type` (coreType)
- `core_name` (coreName)
- `core_version` (coreVersion)

## 问题根源

1. **认证处理器不提取 serverInfo**
   - `AuthenticationManager.handleAuthenticationMessage()` 只关注认证相关字段
   - 没有将 `serverInfo` 传递给后续处理流程

2. **认证成功事件不包含 serverInfo**
   - `authenticated` 事件只传递 `connection` 对象
   - `connection` 对象中没有存储握手消息的 `serverInfo`

3. **缺少更新服务器信息的逻辑**
   - 认证成功后只调用 `updateServerStatus()` 更新状态
   - 没有调用 `updateServer()` 更新版本信息

## 影响

### 版本信息未更新的影响

1. **数据不一致**：数据库中的服务器版本信息可能过时或不准确
2. **监控不准确**：管理面板显示的版本信息可能错误
3. **功能受限**：基于版本的功能判断可能失效

### 白名单等配置信息的说明

白名单状态、最大玩家数等配置信息**不存在问题**，因为：

1. **设计上不存储在数据库**：这些是动态配置，应该实时查询而不是持久化
2. **通过 `server.info` 获取**：当需要这些信息时，通过 WebSocket 发送 `server.get_info` 请求获取最新数据
3. **避免数据过时**：服务器管理员可能在游戏内或通过其他方式修改这些配置，数据库中的值很快就会过时

**当前架构是合理的**：
- 数据库存储：服务器 ID、名称、核心类型/版本、连接配置、所有者等静态信息
- 实时查询：白名单状态、在线玩家、TPS、内存使用等动态信息

## 解决方案

### 方案 1：在认证流程中提取并存储 serverInfo（推荐）

#### 步骤 1：修改 AuthenticationResult 接口
```typescript
// src/websocket/auth.ts
interface AuthenticationResult {
  success: boolean;
  serverId?: string;
  token?: APIToken;
  capabilities?: string[];
  error?: string;
  serverInfo?: {  // 新增
    name?: string;
    version?: string;
    coreType?: string;
    coreName?: string;
  };
}
```

#### 步骤 2：在认证处理中提取 serverInfo
```typescript
// src/websocket/auth.ts
async handleAuthenticationMessage(
  message: UWBPSystemMessage,
  clientIP?: string
): Promise<UWBPSystemMessage | null> {
  // ... 现有认证逻辑 ...
  
  if (result.success) {
    // 提取 serverInfo
    if (data.serverInfo) {
      result.serverInfo = {
        name: data.serverInfo.name,
        version: data.serverInfo.version,
        coreType: data.serverInfo.coreType,
        coreName: data.serverInfo.coreName
      };
    }
    return this.createAuthSuccessResponse(message.id, result);
  }
}
```

#### 步骤 3：在 WebSocketConnection 中存储 serverInfo
```typescript
// src/websocket/connection.ts
class WebSocketConnection {
  private serverInfo?: {
    name?: string;
    version?: string;
    coreType?: string;
    coreName?: string;
  };
  
  setServerInfo(info: any): void {
    this.serverInfo = info;
  }
  
  getServerInfo(): any {
    return this.serverInfo;
  }
}
```

#### 步骤 4：在认证成功后更新数据库
```typescript
// src/index.ts
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    logger.info(`Server authenticated: ${connection.serverId}`);
    
    if (serviceManager) {
        try {
            // 更新服务器状态
            await serviceManager.server.updateServerStatus(connection.serverId, 'online');
            
            // 更新服务器版本信息（新增）
            const serverInfo = connection.getServerInfo();
            if (serverInfo) {
                await serviceManager.server.updateServer(connection.serverId, {
                    coreVersion: serverInfo.version,
                    coreName: serverInfo.coreName,
                    coreType: serverInfo.coreType
                });
                logger.info(`Updated server info for ${connection.serverId}: ${serverInfo.coreName} ${serverInfo.version}`);
            }
            
            // 创建 WebSocket bridge
            await serviceManager.server.createWebSocketBridge(connection.serverId, connection);
            
        } catch (error) {
            logger.error(`Failed to setup server ${connection.serverId}:`, error);
        }
    }
});
```

### 方案 2：通过独立的 server.info 请求获取（备选）

在认证成功后，主动向 connector 发送 `server.get_info` 请求获取服务器信息。

**优点**：
- 不修改认证流程
- 可以随时刷新服务器信息

**缺点**：
- 需要额外的网络请求
- 增加连接建立时间
- connector 需要实现 `server.get_info` 处理器

## 推荐实施方案

采用**方案 1**，原因：
1. 符合 U-WBP v2 协议设计（握手时交换服务器信息）
2. 不增加额外网络开销
3. 实现简单，改动最小
4. 信息更新及时

## 需要修改的文件

1. `src/websocket/auth.ts` - 提取 serverInfo
2. `src/websocket/connection.ts` - 存储 serverInfo
3. `src/index.ts` - 认证成功后更新数据库
4. `src/types/index.ts` - 更新类型定义（如需要）

## 测试要点

### 版本信息更新测试

1. 验证握手消息中的 serverInfo 被正确提取
2. 验证数据库中的版本信息被正确更新
3. 验证管理面板显示正确的版本信息
4. 验证重连后版本信息仍然正确
5. 验证不同核心类型（Folia, Paper, Spigot 等）都能正确更新

### 动态配置查询测试

1. 验证 `server.get_info` 请求能正确返回白名单状态
2. 验证白名单状态变化后，查询能获取最新值
3. 验证最大玩家数、MOTD 等配置能正确获取
4. 验证在线玩家数、TPS 等实时数据准确

## 相关文档

- API 文档：`wiki/API接口文档.md` - U-WBP v2 握手流程
- 数据库模型：`src/database/models.ts` - ServerConfig 定义
- 认证流程：`src/websocket/auth.ts` - 认证管理器

---

**分析日期**: 2024-01-01  
**问题严重程度**: 
- 版本信息未更新：中等（功能性问题，不影响核心功能但导致数据不一致）
- 白名单等配置：无问题（设计合理，通过实时查询获取）
**修复优先级**: 高（版本信息应在下一个版本中修复）

## 附录：白名单配置的正确使用方式

如果需要获取服务器的白名单状态等配置信息，应该：

### 方法 1：通过 WebSocket 请求（推荐）

```typescript
// 发送 server.get_info 请求
const response = await connection.sendRequest({
  type: 'request',
  id: generateId(),
  op: 'server.get_info',
  data: {
    serverId: 'server_001'
  }
});

// 响应包含完整的服务器配置
console.log(response.data.info.whitelistEnabled);
console.log(response.data.info.maxPlayers);
console.log(response.data.info.onlineMode);
```

### 方法 2：通过 HTTP API

```http
GET /api/servers/{serverId}/status
```

响应中包含实时的服务器状态和配置信息。

### 不应该做的事

❌ 在数据库中存储白名单状态、在线玩家数等动态信息
❌ 在握手时交换所有服务器配置（增加握手消息大小和复杂度）
❌ 缓存这些动态配置（很快就会过时）

### 应该做的事

✅ 通过实时查询获取动态配置
✅ 在数据库中只存储静态配置（核心类型、版本、连接方式等）
✅ 使用缓存时设置合理的过期时间（如 30 秒）
