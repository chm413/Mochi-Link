# 服务使用情况报告

## ✅ 已正确引用的服务

### 1. ServiceManager ✅
**位置**: `src/index.ts` 行 164
```typescript
serviceManager = new ServiceManager(ctx);
await serviceManager.initialize();
```

**用途**: 统一管理所有服务

---

### 2. ServerManager ✅
**使用位置**:
- 行 200: `serviceManager.server.updateServerStatus(connection.serverId, 'online')`
- 行 232: `serviceManager.server.updateServerStatus(connection.serverId, 'offline')`

**功能**: 
- ✅ 更新服务器在线/离线状态
- ✅ 自动记录最后活动时间

**未使用的功能**:
- ⚠️ `registerServer()` - 服务器注册（当前使用 dbManager 直接操作）
- ⚠️ `getServer()` - 获取服务器信息（当前使用 dbManager）
- ⚠️ `getAllServers()` - 获取所有服务器（当前使用 dbManager）
- ⚠️ `deleteServer()` - 删除服务器（当前使用 dbManager）
- ⚠️ `connectServer()` - 连接服务器
- ⚠️ `disconnectServer()` - 断开服务器
- ⚠️ `broadcastCommand()` - 广播命令到多个服务器

---

### 3. MessageRouter ✅
**使用位置**:
- 行 213: `serviceManager.messageRouter.handleServerEvent()`

**功能**:
- ✅ 处理服务器事件
- ✅ 路由消息到绑定的群组

**未使用的功能**:
- ⚠️ `handleGroupMessage()` - 处理群组消息（需要在群组消息事件中调用）
- ⚠️ `getRoutingStats()` - 获取路由统计

---

### 4. WhitelistManager ✅
**使用位置**:
- 行 802: `serviceManager.whitelist.getWhitelist(targetServerId)`
- 行 873: `serviceManager.whitelist.addToWhitelist()`

**功能**:
- ✅ 获取白名单列表
- ✅ 添加玩家到白名单

**未使用的功能**:
- ⚠️ `removeFromWhitelist()` - 从白名单移除（命令已定义但未实现）
- ⚠️ `syncWhitelist()` - 同步白名单
- ⚠️ `isWhitelisted()` - 检查是否在白名单中

---

### 5. PlayerInformationService ✅
**使用位置**:
- 行 991: `serviceManager.player.getOnlinePlayers(targetServerId)`

**功能**:
- ✅ 获取在线玩家列表

**未使用的功能**:
- ⚠️ `getPlayerInfo()` - 获取玩家详细信息（命令已定义但未实现）
- ⚠️ `searchPlayer()` - 搜索玩家
- ⚠️ `getPlayerHistory()` - 获取玩家历史

---

### 6. CommandExecutionService ✅
**使用位置**:
- 行 1132: `serviceManager.command.executeCommand()`

**功能**:
- ✅ 执行服务器命令
- ✅ 权限检查
- ✅ 审计日志

**未使用的功能**:
- ⚠️ `executeQuickAction()` - 执行快捷操作
- ⚠️ `executeBatchCommands()` - 批量执行命令
- ⚠️ `getCommandHistory()` - 获取命令历史

---

## ⚠️ 未使用的服务

### 7. EventService ❌
**功能**: 事件订阅和分发
**建议**: 可以用于订阅服务器事件并转发到群组

**示例用法**:
```typescript
// 订阅玩家加入事件
serviceManager.event.subscribe('player.join', async (event) => {
    // 发送通知到绑定的群组
});
```

---

### 8. MonitoringService ❌
**功能**: 性能监控和告警
**建议**: 可以用于监控服务器性能并发送告警

**示例用法**:
```typescript
// 启动监控
await serviceManager.monitoring.startMonitoring('server-id', {
    interval: 60,
    metrics: ['tps', 'memory', 'players']
});
```

---

### 9. BindingManager ❌
**功能**: 群组绑定管理
**建议**: 当前命令中使用 dbManager 直接操作，应该使用 BindingManager

**应该替换**:
```typescript
// ❌ 当前
await dbManager.createGroupBinding({...});

// ✅ 应该
await serviceManager.binding.createBinding({...});
```

---

### 10. AuditService ❌
**功能**: 审计日志管理
**建议**: 当前使用 dbManager 直接操作，应该使用 AuditService

**应该替换**:
```typescript
// ❌ 当前
await dbManager.createAuditLog({...});

// ✅ 应该
await serviceManager.audit.logOperation({...});
```

---

### 11. PermissionManager ❌
**功能**: 权限管理
**建议**: 当前使用 Koishi 的 authority 系统，可以集成 PermissionManager

---

### 12. TokenManager ❌
**功能**: Token 管理
**建议**: 当前使用 SimpleTokenManager，可以考虑迁移到 TokenManager

---

## 🔧 建议的改进

### 优先级 1: 替换直接数据库操作

#### 1.1 使用 AuditService 替代 dbManager.createAuditLog

**当前代码**:
```typescript
await dbManager.createAuditLog({
    user_id: session?.userId,
    server_id: serverId,
    operation: 'server.create',
    operation_data: JSON.stringify({ name, type, core }),
    result: 'success'
});
```

**应该改为**:
```typescript
await serviceManager.audit.logOperation({
    userId: session?.userId,
    serverId: serverId,
    operation: 'server.create',
    operationData: { name, type, core },
    result: 'success'
});
```

#### 1.2 使用 BindingManager 替代 dbManager 绑定操作

**当前代码**:
```typescript
const binding = await dbManager.createGroupBinding({
    group_id: session.guildId,
    server_id: serverId,
    binding_type: 'full',
    config: JSON.stringify({}),
    created_by: session.userId,
    status: 'active'
});
```

**应该改为**:
```typescript
const binding = await serviceManager.binding.createBinding({
    groupId: session.guildId,
    serverId: serverId,
    bindingType: 'full',
    config: {},
    createdBy: session.userId
});
```

#### 1.3 使用 ServerManager 替代 dbManager 服务器操作

**当前代码**:
```typescript
await dbManager.createServer({
    id,
    name,
    core_type: 'java',
    core_name: 'paper',
    connection_mode: 'reverse',
    connection_config: JSON.stringify({}),
    status: 'offline',
    owner_id: session?.userId
});
```

**应该改为**:
```typescript
await serviceManager.server.registerServer({
    id,
    name,
    coreType: 'java',
    coreName: 'paper',
    connectionMode: 'reverse',
    connectionConfig: {},
    ownerId: session?.userId
}, session?.userId || 'system');
```

### 优先级 2: 添加事件订阅

在 WebSocket 服务器初始化后添加事件订阅：

```typescript
// 订阅玩家加入事件
serviceManager.event.subscribe('player.join', async (event) => {
    logger.info(`Player ${event.data.playerName} joined ${event.serverId}`);
    // 可以发送通知到绑定的群组
});

// 订阅玩家退出事件
serviceManager.event.subscribe('player.quit', async (event) => {
    logger.info(`Player ${event.data.playerName} left ${event.serverId}`);
});

// 订阅聊天消息
serviceManager.event.subscribe('player.chat', async (event) => {
    logger.info(`[${event.serverId}] <${event.data.playerName}> ${event.data.message}`);
    // 转发到绑定的群组
});
```

### 优先级 3: 启用性能监控

```typescript
// 为每个连接的服务器启动监控
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    // ... 现有代码 ...
    
    // 启动性能监控
    if (serviceManager) {
        await serviceManager.monitoring.startMonitoring(connection.serverId, {
            interval: 60,
            metrics: ['tps', 'memory', 'players']
        });
    }
});
```

### 优先级 4: 实现群组消息路由

在 Koishi 的消息中间件中添加：

```typescript
ctx.middleware(async (session, next) => {
    if (session.content && serviceManager) {
        // 路由群组消息到绑定的服务器
        await serviceManager.messageRouter.handleGroupMessage({
            groupId: session.guildId,
            userId: session.userId,
            userName: session.username,
            content: session.content,
            timestamp: Date.now()
        });
    }
    return next();
});
```

## 📊 服务使用统计

| 服务 | 状态 | 使用率 | 优先级 |
|------|------|--------|--------|
| ServiceManager | ✅ 已使用 | 100% | - |
| ServerManager | ⚠️ 部分使用 | 20% | 高 |
| MessageRouter | ✅ 已使用 | 50% | 中 |
| WhitelistManager | ✅ 已使用 | 40% | 中 |
| PlayerInformationService | ✅ 已使用 | 30% | 中 |
| CommandExecutionService | ✅ 已使用 | 30% | 中 |
| EventService | ❌ 未使用 | 0% | 高 |
| MonitoringService | ❌ 未使用 | 0% | 中 |
| BindingManager | ❌ 未使用 | 0% | 高 |
| AuditService | ❌ 未使用 | 0% | 高 |
| PermissionManager | ❌ 未使用 | 0% | 低 |
| TokenManager | ❌ 未使用 | 0% | 低 |

## ✅ 编译状态

- ✅ 所有 TypeScript 错误已修复
- ✅ 服务方法调用签名正确
- ✅ 类型定义匹配

## 🎯 下一步行动

1. **立即**: 无需操作，当前代码可以正常运行
2. **短期**: 替换直接数据库操作为服务调用（优先级 1）
3. **中期**: 添加事件订阅和监控（优先级 2-3）
4. **长期**: 实现完整的消息路由和群组集成（优先级 4）

## 📝 总结

当前状态：
- ✅ 核心功能已正确引用服务层
- ✅ 编译错误已全部修复
- ⚠️ 仍有部分功能直接操作数据库，建议迁移到服务层
- ⚠️ 部分高级功能（事件订阅、监控）尚未启用

建议：
1. 保持当前实现，确保基本功能正常工作
2. 逐步迁移直接数据库操作到服务层
3. 根据需求逐步启用高级功能
