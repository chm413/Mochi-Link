# 消息处理修复报告

## 🔍 问题诊断

用户反馈：**能够正常连接但是指令查询不到任何上报信息**

### 发现的问题

1. ❌ **Koishi 插件没有监听消息事件**
   - WebSocket 服务器发出 `message` 事件
   - 但主插件中没有注册 `message` 事件监听器
   - 导致所有来自连接器的消息都被忽略

2. ❌ **Folia 连接器使用错误的 serverId**
   - 使用 `plugin.getServer().getName()` 而不是配置的 `server.id`
   - 导致 serverId 与 Koishi 中注册的不匹配

3. ❌ **没有更新服务器状态**
   - 连接/断开时没有更新数据库中的服务器状态
   - 导致 `mochi.server.list` 显示状态不正确

## ✅ 已修复

### 1. 添加消息事件监听器

**位置**: `src/index.ts`

```typescript
wsManager.on('message', async (message: any, connection: WebSocketConnection) => {
    try {
        logger.debug(`Received message from ${connection.serverId}:`, message);
        
        // Handle different message types
        if (message.type === 'event') {
            // Handle server events
            await handleServerEvent(message, connection);
        } else if (message.type === 'request') {
            // Handle server requests
            await handleServerRequest(message, connection);
        } else if (message.type === 'response') {
            // Handle server responses
            logger.debug(`Received response from ${connection.serverId}:`, message);
        }
        
        // Update last seen time
        if (dbManager) {
            await dbManager.updateServer(connection.serverId, {
                last_seen: new Date()
            });
        }
    } catch (error) {
        logger.error(`Error handling message from ${connection.serverId}:`, error);
    }
});
```

### 2. 添加消息处理函数

**位置**: `src/index.ts`

```typescript
/**
 * Handle server events (player join/quit, chat, etc.)
 */
async function handleServerEvent(message: any, connection: any): Promise<void> {
    const { op, data } = message;
    
    // Log event for debugging
    console.log(`[Event] ${connection.serverId}: ${op}`, data);
    
    // Handle specific events
    switch (op) {
        case 'player.join':
            console.log(`Player ${data.playerName} joined ${connection.serverId}`);
            break;
        case 'player.quit':
            console.log(`Player ${data.playerName} left ${connection.serverId}`);
            break;
        case 'player.chat':
            console.log(`[${connection.serverId}] <${data.playerName}> ${data.message}`);
            break;
        case 'server.status':
            console.log(`Server ${connection.serverId} status:`, data);
            break;
        default:
            console.log(`Unknown event: ${op}`);
    }
}

/**
 * Handle server requests (need response)
 */
async function handleServerRequest(message: any, connection: any): Promise<void> {
    const { id, op, data } = message;
    
    console.log(`[Request] ${connection.serverId}: ${op}`, data);
    
    // Send response
    const response = {
        type: 'response',
        id: `response-${Date.now()}`,
        requestId: id,
        op: op,
        success: true,
        data: { message: 'Request received' },
        timestamp: Date.now(),
        serverId: connection.serverId,
        version: '2.0'
    };
    
    try {
        await connection.send(response);
    } catch (error) {
        console.error(`Failed to send response to ${connection.serverId}:`, error);
    }
}
```

### 3. 添加服务器状态更新

**认证成功时**:
```typescript
wsManager.on('authenticated', (connection: WebSocketConnection) => {
    logger.info(`Server authenticated: ${connection.serverId}`);
    
    // Update server status to online
    if (dbManager) {
        dbManager.updateServer(connection.serverId, { 
            status: 'online',
            last_seen: new Date()
        }).catch(error => {
            logger.error(`Failed to update server status: ${error}`);
        });
    }
});
```

**断开连接时**:
```typescript
wsManager.on('disconnection', (connection: WebSocketConnection, code: number, reason: string) => {
    logger.info(`Server disconnected: ${connection.serverId} (${code}: ${reason})`);
    
    // Update server status to offline
    if (dbManager) {
        dbManager.updateServer(connection.serverId, { 
            status: 'offline',
            last_seen: new Date()
        }).catch(error => {
            logger.error(`Failed to update server status: ${error}`);
        });
    }
});
```

### 4. 修复 Folia 连接器的 serverId

**位置**: `mochi-link-connector-folia/src/main/java/com/mochilink/connector/folia/connection/FoliaConnectionManager.java`

**之前**:
```java
data.addProperty("serverId", plugin.getServer().getName());  // ❌ 错误
```

**之后**:
```java
data.addProperty("serverId", config.getServerId());  // ✅ 正确
```

## 📊 消息流程

### 完整的消息流程

```
Folia 服务器
    ↓
发送 handshake 消息
    ↓
WebSocket 连接 (已认证)
    ↓
WebSocketConnection.emit('message', message)
    ↓
MochiWebSocketServer.emit('message', message, connection)
    ↓
主插件的 message 事件监听器
    ↓
handleServerEvent() 或 handleServerRequest()
    ↓
处理消息并更新数据库
```

### 支持的消息类型

1. **Event 消息** (单向通知):
   - `player.join` - 玩家加入
   - `player.quit` - 玩家退出
   - `player.chat` - 玩家聊天
   - `server.status` - 服务器状态

2. **Request 消息** (需要响应):
   - 任何需要响应的操作
   - 自动发送 response 消息

3. **System 消息**:
   - `handshake` - 握手
   - `ping/pong` - 心跳
   - `disconnect` - 断开连接

## 🧪 测试步骤

### 1. 重启 Koishi

```bash
# 重启 Koishi 以加载新代码
```

### 2. 重启 Folia 服务器

```bash
# 停止服务器
stop

# 替换 JAR 文件
cp build-output/mochi-link-connector-folia-1.0.0.jar plugins/MochiLinkConnectorFolia.jar

# 启动服务器
```

### 3. 查看 Koishi 日志

应该看到：
```
[I] mochi-link Server connected: folia-survival
[I] mochi-link Server authenticated: folia-survival
[Event] folia-survival: handshake {...}
```

### 4. 测试玩家加入

当玩家加入服务器时，Koishi 日志应该显示：
```
[Event] folia-survival: player.join {playerName: "PlayerName", ...}
Player PlayerName joined folia-survival
```

### 5. 查看服务器状态

```bash
# 在 Koishi 中执行
mochi.server.list

# 应该显示:
# [folia-survival] Folia生存服 (folia/java) - online ✅
```

### 6. 查看服务器信息

```bash
mochi.server.info folia-survival

# 应该显示:
# 状态: online
# 最后更新: 刚刚
```

## 🔍 调试方法

### 启用调试日志

在 Koishi 配置中：
```yaml
logging:
  level: debug
```

在 Folia 配置中：
```yaml
logging:
  level: "FINE"
  verbose_connection: true
```

### 查看消息流

**Koishi 日志**:
```
[D] mochi-link Received message from folia-survival: {type: "event", op: "player.join", ...}
[Event] folia-survival: player.join {playerName: "PlayerName"}
```

**Folia 日志**:
```
[FINE]: Sent message: {"type":"event","op":"player.join",...}
```

## 📝 下一步

现在消息处理已经修复，你可以：

1. **实现具体的事件处理**:
   - 玩家加入/退出通知
   - 聊天消息转发
   - 服务器状态监控

2. **实现命令执行**:
   - 从 Koishi 向服务器发送命令
   - 接收命令执行结果

3. **实现白名单同步**:
   - 从 Koishi 管理白名单
   - 自动同步到服务器

4. **实现玩家查询**:
   - 查询在线玩家列表
   - 查询玩家详细信息

## 🎯 预期结果

修复后，你应该能够：

- ✅ 在 Koishi 日志中看到来自服务器的消息
- ✅ `mochi.server.list` 显示正确的在线状态
- ✅ `mochi.server.info` 显示最新的更新时间
- ✅ 看到玩家加入/退出的事件日志
- ✅ 服务器状态自动更新

## 📚 相关文件

- `src/index.ts` - 主插件文件（已添加消息处理）
- `mochi-link-connector-folia/src/main/java/com/mochilink/connector/folia/connection/FoliaConnectionManager.java` - Folia 连接管理器（已修复 serverId）
- `build-output/mochi-link-connector-folia-1.0.0.jar` - 新编译的 JAR 文件

所有更改已提交并准备部署！🚀
