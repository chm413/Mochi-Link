# Mochi-Link 服务对接说明

## 📋 概述

v1.4.0 版本已将 Koishi 指令对接到实际的服务层，支持通过 WebSocket 连接与 Minecraft 服务器进行实时交互。

---

## 🔌 服务架构

### 服务层次结构

```
Koishi 指令层 (src/index.ts)
    ↓
服务管理器 (ServiceManager)
    ↓
├── WhitelistManager - 白名单管理
├── PlayerInformationService - 玩家信息
├── CommandExecutionService - 命令执行
├── ServerManager - 服务器管理
└── WebSocketConnectionManager - WebSocket 连接
    ↓
Minecraft 服务器 (通过 Connector)
```

---

## 🎯 已对接的功能

### 1. 白名单管理

#### mochi.whitelist.list
**服务**: `serviceManager.whitelist.getWhitelist(serverId)`

**功能**: 获取服务器白名单列表

**返回示例**:
```
服务器 生存服务器 的白名单 (3 人)：
  [1] Steve
  [2] Alex
  [3] Notch
```

**错误处理**:
- 服务器不存在
- 服务器未连接
- 获取失败（显示错误信息）

#### mochi.whitelist.add
**服务**: `serviceManager.whitelist.addToWhitelist(serverId, player)`

**功能**: 添加玩家到白名单

**审计日志**: 自动记录成功和失败的操作

**返回示例**:
```
已将 Steve 添加到服务器 生存服务器 的白名单
```

---

### 2. 玩家管理

#### mochi.player.list
**服务**: `serviceManager.player.getOnlinePlayers(serverId)`

**功能**: 获取在线玩家列表

**返回示例**:
```
服务器 生存服务器 在线玩家 (3 人)：
  [1] Steve - 生命: 20/20 - 等级: 30 - survival
  [2] Alex - 生命: 18/20 - 等级: 25 - survival
  [3] Notch - 生命: 20/20 - 等级: 50 - creative
```

**数据字段**:
- `name` - 玩家名称
- `health` - 生命值（可选）
- `level` - 经验等级（可选）
- `gameMode` - 游戏模式（可选）

---

### 3. 命令执行

#### mochi.exec / mochi.cmd
**服务**: `serviceManager.command.executeCommand(serverId, command, userId, options)`

**功能**: 在服务器执行命令

**参数**:
```typescript
{
  executeAs: 'console' | 'player',
  timeout: 30000  // 30秒超时
}
```

**返回示例**:
```
已在服务器 生存服务器 执行命令: say Hello World
执行者: console
状态: 成功
输出:
[Server] Hello World
```

**错误处理**:
- 命令执行失败显示错误信息
- 超时处理
- 审计日志记录

---

## 🚀 服务初始化

### 初始化流程

```typescript
// 1. 初始化数据库
const dbManager = new SimpleDatabaseManager(ctx, prefix);
await dbManager.initialize();

// 2. 初始化服务管理器
const serviceManager = new ServiceManager(ctx);
await serviceManager.initialize();

// 3. 初始化 WebSocket 管理器（可选）
if (config.websocket?.port) {
  const wsManager = new WebSocketConnectionManager(
    serviceManager.token,
    {
      server: {
        port: config.websocket.port,
        host: config.websocket.host || '0.0.0.0'
      },
      maxConnections: config.security?.maxConnections || 100
    },
    serviceManager.audit
  );
  
  await wsManager.start();
}
```

### 配置要求

**必需配置**:
- `database.prefix` - 数据库表前缀（默认: mochi）

**可选配置**:
- `websocket.port` - WebSocket 服务器端口（默认: 8080）
- `websocket.host` - WebSocket 服务器地址（默认: 0.0.0.0）
- `websocket.ssl` - SSL 配置（可选）
- `security.maxConnections` - 最大连接数（默认: 100）

---

## 🔧 服务可用性检查

### 检查逻辑

所有指令在执行前会检查：

1. **插件初始化状态**: `isInitialized`
2. **数据库管理器**: `dbManager`
3. **服务管理器**: `serviceManager`
4. **具体服务**: `serviceManager.whitelist`, `serviceManager.player`, `serviceManager.command`

### 降级策略

如果服务不可用，指令会：
1. 显示友好的错误提示
2. 说明需要服务器连接
3. 提供故障排查建议

**示例**:
```
服务器 生存服务器 的白名单功能需要服务器连接
提示: 请确保服务器已通过 WebSocket 连接
```

---

## 📊 服务状态监控

### 健康检查

通过 `ctx.provide('mochi-link')` 暴露的接口：

```typescript
{
  getHealth: async () => ({
    status: 'healthy' | 'initializing',
    initialized: boolean,
    uptime: number,
    database: 'connected' | 'disconnected',
    services: {
      whitelist: boolean,
      player: boolean,
      command: boolean,
      websocket: boolean
    }
  }),
  getConfig: () => PluginConfig,
  isReady: () => boolean,
  getDatabaseManager: () => SimpleDatabaseManager
}
```

---

## 🔐 安全性

### 审计日志

所有操作都会记录审计日志：

**成功操作**:
```typescript
await dbManager.createAuditLog({
  user_id: session?.userId,
  server_id: serverId,
  operation: 'whitelist.add',
  operation_data: JSON.stringify({ player }),
  result: 'success'
});
```

**失败操作**:
```typescript
await dbManager.createAuditLog({
  user_id: session?.userId,
  server_id: serverId,
  operation: 'whitelist.add',
  operation_data: JSON.stringify({ player }),
  result: 'failure',
  error_message: error.message
});
```

### 权限验证

- 服务器存在性验证
- 服务器状态检查（online/offline）
- 群组绑定权限验证
- 操作权限检查（通过 PermissionManager）

---

## 🌐 WebSocket 连接

### 连接模式

支持两种连接模式：

1. **正向连接** (Forward)
   - Mochi-Link 作为客户端
   - 连接到 Minecraft 服务器的 WebSocket 端口

2. **反向连接** (Reverse)
   - Mochi-Link 作为服务器
   - Minecraft 服务器连接到 Mochi-Link

### 连接配置

在 `koishi.yml` 中配置：

```yaml
plugins:
  mochi-link:
    websocket:
      port: 8080
      host: 0.0.0.0
      ssl:
        cert: /path/to/cert.pem
        key: /path/to/key.pem
    security:
      maxConnections: 100
      tokenExpiry: 86400
```

### 连接状态

服务器状态会自动更新：
- `online` - 已连接且正常
- `offline` - 未连接
- `error` - 连接错误

---

## 🔄 错误处理

### 错误类型

1. **初始化错误**
   - 插件未初始化
   - 数据库未就绪
   - 服务管理器未启动

2. **服务错误**
   - 服务不可用
   - 服务器未连接
   - 操作超时

3. **业务错误**
   - 服务器不存在
   - 服务器离线
   - 参数无效

### 错误响应

所有错误都会：
1. 记录到日志（logger.error）
2. 返回友好的错误消息
3. 记录审计日志（如果适用）
4. 提供故障排查建议

---

## 📝 使用示例

### 完整工作流程

```bash
# 1. 添加服务器
mochi.server.add survival 生存服务器 -t java -c paper

# 2. 在群组中绑定
mochi.bind.add survival

# 3. 等待服务器连接（通过 WebSocket）
# 服务器状态会自动更新为 online

# 4. 使用功能（无需指定服务器 ID）
mochi.whitelist.add Steve
mochi.player.list
mochi.exec say Hello World

# 5. 查看审计日志
mochi.audit -l 20
```

### 多服务器场景

```bash
# 绑定多个服务器
mochi.bind.add survival
mochi.bind.add creative -t monitor

# 查看绑定
mochi.bind.list

# 使用默认服务器（第一个绑定）
mochi.player.list

# 或指定服务器
mochi.player.list creative
mochi.exec survival say Hello
```

---

## 🐛 故障排查

### 常见问题

#### 1. "插件尚未初始化完成"
**原因**: 插件正在启动或启动失败

**解决**:
- 检查 Koishi 日志
- 确认数据库服务已启动
- 重启 Koishi

#### 2. "服务器 XXX 的功能需要服务器连接"
**原因**: 服务管理器未初始化或服务器未连接

**解决**:
- 检查 WebSocket 配置
- 确认服务器 Connector 已安装
- 检查网络连接
- 查看服务器日志

#### 3. "获取白名单失败: XXX"
**原因**: 服务器连接异常或命令执行失败

**解决**:
- 检查服务器状态（mochi.server.info）
- 查看审计日志（mochi.audit）
- 检查服务器权限配置
- 重启服务器连接

---

## 📚 相关文档

- [指令快速参考](./COMMAND_REFERENCE.md) - 所有指令的使用说明
- [API 文档](./KOISHI_COMMANDS_AND_API.md) - 完整的 API 接口
- [部署指南](./CONNECTOR_DEPLOYMENT_GUIDE.md) - Connector 部署说明

---

## 🔮 未来计划

### 待实现功能

1. **玩家详情查询** (`mochi.player.info`)
   - 对接 `serviceManager.player.getPlayerInfo()`
   - 显示详细的玩家数据

2. **玩家踢出** (`mochi.player.kick`)
   - 对接 `serviceManager.player.kickPlayer()`
   - 支持自定义踢出原因

3. **白名单移除** (`mochi.whitelist.remove`)
   - 对接 `serviceManager.whitelist.removeFromWhitelist()`
   - 支持批量移除

4. **服务器控制**
   - 启动/停止/重启服务器
   - 保存世界数据
   - 备份管理

5. **实时监控**
   - 性能指标推送
   - 事件通知
   - 告警管理

---

**版本**: v1.4.0  
**更新日期**: 2026-02-17  
**状态**: 核心功能已对接，待 WebSocket 连接测试
