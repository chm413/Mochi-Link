# 服务器事件功能添加完成

## 更新时间
2026-03-03

## 更新内容

为所有连接器添加了服务器启动和停止事件支持。

---

## 新增事件

### 1. server.start - 服务器启动事件

当连接器成功连接到 Koishi 后自动发送。

**事件格式**:
```json
{
  "type": "event",
  "id": "1234567890-abc123",
  "op": "server.start",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {
    "serverName": "My Minecraft Server",
    "serverVersion": "1.20.1",
    "coreType": "Java",
    "coreName": "Fabric",
    "onlinePlayers": 0,
    "maxPlayers": 20,
    "startTime": "2026-03-03T10:00:00.000Z"
  }
}
```

**触发时机**:
- 连接器启动并成功连接到 Koishi 后 5 秒

**用途**:
- 通知 Koishi 服务器已上线
- 记录服务器启动时间
- 初始化服务器状态监控

---

### 2. server.stop - 服务器停止事件

当连接器关闭前自动发送。

**事件格式**:
```json
{
  "type": "event",
  "id": "1234567890-abc123",
  "op": "server.stop",
  "timestamp": "2026-03-03T12:00:00.000Z",
  "version": "2.0",
  "data": {
    "serverName": "My Minecraft Server",
    "reason": "Plugin disabled",
    "stopTime": "2026-03-03T12:00:00.000Z"
  }
}
```

**触发时机**:
- 连接器关闭/禁用时
- 服务器停止时

**用途**:
- 通知 Koishi 服务器已下线
- 记录服务器停止时间和原因
- 清理服务器状态

---

## 实现细节

### Folia
- **文件**: `MochiLinkFoliaPlugin.java`
- **启动**: 使用 Folia 的 AsyncScheduler，延迟 5 秒发送
- **停止**: 在 onDisable() 中发送，等待 500ms 确保发送完成

### Fabric
- **文件**: `MochiLinkFabricMod.java`
- **启动**: 使用独立线程，延迟 5 秒发送
- **停止**: 在 onShutdown() 中发送，等待 500ms 确保发送完成

### Forge
- **文件**: `MochiLinkForgeMod.java`
- **启动**: 使用独立线程，延迟 5 秒发送
- **停止**: 在 onShutdown() 中发送，等待 500ms 确保发送完成

### Nukkit
- **文件**: `MochiLinkNukkitPlugin.java`
- **启动**: 使用 Nukkit Scheduler，延迟 100 ticks (5秒) 发送
- **停止**: 在 onDisable() 中发送，等待 500ms 确保发送完成

---

## 配置要求

无需额外配置，事件会自动发送。

如果需要禁用这些事件，可以在 Koishi 端配置事件过滤。

---

## 测试建议

### 1. 测试 server.start 事件
```bash
# 启动服务器
# 检查 Koishi 日志，应该看到：
[INFO] Received event: server.start from server-id
```

### 2. 测试 server.stop 事件
```bash
# 停止服务器或禁用插件
# 检查 Koishi 日志，应该看到：
[INFO] Received event: server.stop from server-id
```

### 3. 事件订阅测试
在 Koishi 端订阅这些事件：
```javascript
// 订阅服务器启动事件
await connector.subscribe({
  eventTypes: ['server.start', 'server.stop']
});
```

---

## 兼容性

- ✅ 与现有事件系统完全兼容
- ✅ 不影响其他操作和事件
- ✅ 遵循 U-WBP v2 协议规范
- ✅ 使用 ISO 8601 时间格式

---

## 相关文档

- `KOISHI_INTEGRATION_COMPLETE.md` - 完整对接报告
- `FINAL_FIX_SUMMARY.md` - 修复总结
- `wiki/API接口文档.md` - API 文档

---

**状态**: ✅ 已完成并通过编译检查  
**创建时间**: 2026-03-03  
**负责人**: AI Assistant
