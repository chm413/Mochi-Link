# Mochi-Link Koishi 指令和 API 接口文档

## 📋 目录
- [Koishi 聊天指令](#koishi-聊天指令)
- [HTTP API 接口](#http-api-接口)
- [WebSocket 事件](#websocket-事件)

---

## 🎮 Koishi 聊天指令

### 1. 主命令
```
mochi
```
**描述**: Mochi-Link 管理命令  
**功能**: 显示系统简介和帮助信息  
**权限**: 所有用户  
**返回**: 系统介绍和使用提示

---

### 2. 服务器管理命令组

#### 2.1 服务器管理菜单
```
mochi.server
```
**描述**: 服务器管理  
**功能**: 显示服务器管理子命令列表  
**权限**: 所有用户  
**返回**: 可用的服务器管理命令列表

#### 2.2 列出所有服务器
```
mochi.server.list
```
**描述**: 列出所有服务器  
**功能**: 显示所有已注册的 Minecraft 服务器  
**权限**: 所有用户  
**返回**: 服务器列表，包含 ID、名称、核心类型、状态

**示例输出**:
```
服务器列表：
  [survival] 生存服务器 (java/paper) - online
  [creative] 创造服务器 (java/fabric) - offline
  [bedrock1] 基岩服务器 (bedrock/llbds) - online
```

#### 2.3 添加服务器
```
mochi.server.add <id> <name> [-t type] [-c core]
```
**描述**: 添加服务器  
**参数**:
- `<id>`: 服务器唯一标识符（必需）
- `<name>`: 服务器显示名称（必需）
- `-t, --type`: 服务器类型，可选 `java` 或 `bedrock`（默认: java）
- `-c, --core`: 核心名称，如 `paper`, `fabric`, `llbds` 等（默认: paper）

**功能**: 在数据库中注册新的 Minecraft 服务器  
**权限**: 管理员  
**返回**: 创建成功消息或错误提示

**示例**:
```
mochi.server.add survival 生存服务器 -t java -c paper
mochi.server.add bedrock1 基岩服 -t bedrock -c llbds
```

#### 2.4 查看服务器信息
```
mochi.server.info <id>
```
**描述**: 查看服务器信息  
**参数**:
- `<id>`: 服务器 ID（必需）

**功能**: 显示指定服务器的详细信息  
**权限**: 所有用户  
**返回**: 服务器详细信息

**示例输出**:
```
服务器信息：
  ID: survival
  名称: 生存服务器
  类型: java
  核心: paper
  版本: 1.20.4
  状态: online
  连接模式: reverse
  创建时间: 2026-02-17 10:30:00
  最后更新: 2026-02-17 18:20:00
```

#### 2.5 删除服务器
```
mochi.server.remove <id>
```
**描述**: 删除服务器  
**参数**:
- `<id>`: 服务器 ID（必需）

**功能**: 从数据库中删除服务器记录  
**权限**: 管理员  
**返回**: 删除成功消息或错误提示

**示例**:
```
mochi.server.remove survival
```

---

### 3. 审计日志命令

#### 3.1 查看审计日志
```
mochi.audit [-l limit]
```
**描述**: 查看审计日志  
**参数**:
- `-l, --limit`: 显示条数（默认: 10）

**功能**: 显示系统操作审计日志  
**权限**: 管理员  
**返回**: 最近的审计日志记录

**示例输出**:
```
审计日志：
  [2026-02-17 18:30:00] server.create - success (用户: 123456) (服务器: survival)
  [2026-02-17 18:25:00] server.delete - success (用户: 123456) (服务器: old_server)
  [2026-02-17 18:20:00] server.update - success (用户: 123456) (服务器: creative)
```

---

### 4. 白名单管理命令

#### 4.1 白名单管理菜单
```
mochi.whitelist
```
**描述**: 白名单管理  
**功能**: 显示白名单管理子命令列表  
**权限**: 所有用户  
**返回**: 可用的白名单管理命令列表

#### 4.2 查看白名单
```
mochi.whitelist.list <serverId>
```
**描述**: 查看服务器白名单  
**参数**:
- `<serverId>`: 服务器 ID（必需）

**功能**: 显示指定服务器的白名单  
**权限**: 管理员  
**返回**: 白名单玩家列表

**示例**:
```
mochi.whitelist.list survival
```

#### 4.3 添加到白名单
```
mochi.whitelist.add <serverId> <player>
```
**描述**: 添加玩家到白名单  
**参数**:
- `<serverId>`: 服务器 ID（必需）
- `<player>`: 玩家名称或 UUID（必需）

**功能**: 将玩家添加到服务器白名单  
**权限**: 管理员  
**返回**: 操作结果

**示例**:
```
mochi.whitelist.add survival Steve
mochi.whitelist.add survival 069a79f4-44e9-4726-a5be-fca90e38aaf5
```

#### 4.4 从白名单移除
```
mochi.whitelist.remove <serverId> <player>
```
**描述**: 从白名单移除玩家  
**参数**:
- `<serverId>`: 服务器 ID（必需）
- `<player>`: 玩家名称或 UUID（必需）

**功能**: 从服务器白名单移除玩家  
**权限**: 管理员  
**返回**: 操作结果

**示例**:
```
mochi.whitelist.remove survival Griefer
```

---

### 5. 玩家管理命令

#### 5.1 玩家管理菜单
```
mochi.player
```
**描述**: 玩家管理  
**功能**: 显示玩家管理子命令列表  
**权限**: 所有用户  
**返回**: 可用的玩家管理命令列表

#### 5.2 查看在线玩家
```
mochi.player.list <serverId>
```
**描述**: 查看服务器在线玩家  
**参数**:
- `<serverId>`: 服务器 ID（必需）

**功能**: 显示指定服务器的在线玩家列表  
**权限**: 所有用户  
**返回**: 在线玩家列表及基本信息

**示例输出**:
```
服务器 生存服务器 在线玩家 (25/100):
  [1] Steve - 生命: 20/20 - 等级: 30 - 游戏模式: survival
  [2] Alex - 生命: 18/20 - 等级: 25 - 游戏模式: survival
  [3] Notch - 生命: 20/20 - 等级: 50 - 游戏模式: creative
```

**示例**:
```
mochi.player.list survival
```

#### 5.3 查看玩家详情
```
mochi.player.info <serverId> <player>
```
**描述**: 查看玩家详细信息  
**参数**:
- `<serverId>`: 服务器 ID（必需）
- `<player>`: 玩家名称或 UUID（必需）

**功能**: 显示指定玩家的详细信息  
**权限**: 所有用户  
**返回**: 玩家详细信息

**示例输出**:
```
玩家信息：
  名称: Steve
  UUID: 069a79f4-44e9-4726-a5be-fca90e38aaf5
  显示名: §aSteve
  生命值: 20/20
  饥饿值: 20/20
  经验等级: 30
  游戏模式: survival
  位置: world (100, 64, 200)
  在线时长: 2小时30分钟
```

**示例**:
```
mochi.player.info survival Steve
```

#### 5.4 踢出玩家
```
mochi.player.kick <serverId> <player> [reason]
```
**描述**: 踢出玩家  
**参数**:
- `<serverId>`: 服务器 ID（必需）
- `<player>`: 玩家名称或 UUID（必需）
- `[reason]`: 踢出原因（可选）

**功能**: 将玩家踢出服务器  
**权限**: 管理员  
**返回**: 操作结果

**示例**:
```
mochi.player.kick survival Griefer 恶意破坏
mochi.player.kick survival AFK
```

---

### 6. 命令执行

#### 6.1 执行服务器命令
```
mochi.exec <serverId> <command...> [-a executor]
```
**别名**: `mochi.cmd`  
**描述**: 在服务器执行命令  
**参数**:
- `<serverId>`: 服务器 ID（必需）
- `<command...>`: 要执行的命令（必需）
- `-a, --as`: 执行者，可选 `console` 或 `player`（默认: console）

**功能**: 在指定服务器执行 Minecraft 命令  
**权限**: 管理员  
**返回**: 命令执行结果

**示例**:
```
mochi.exec survival say Hello World
mochi.exec survival give @a diamond 64
mochi.exec survival tp Steve 0 64 0
mochi.cmd survival weather clear
mochi.exec survival time set day -a console
```

**示例输出**:
```
已在服务器 生存服务器 执行命令: say Hello World
执行者: console
命令输出: [Server] Hello World
```

---

## 🌐 HTTP API 接口

### API 基础信息
- **基础 URL**: `http://localhost:8081/api`
- **认证方式**: Bearer Token (API Token)
- **请求格式**: JSON
- **响应格式**: JSON

### API 响应格式
```json
{
  "success": true,
  "data": { ... },
  "requestId": "uuid",
  "timestamp": 1234567890
}
```

---

### 1. 系统管理接口

#### 1.1 健康检查
```
GET /api/health
```
**功能**: 获取系统健康状态  
**认证**: 不需要  
**返回**: 系统健康信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "version": "1.1.1",
    "services": {
      "database": "connected",
      "websocket": "running"
    }
  }
}
```

#### 1.2 系统统计
```
GET /api/stats
```
**功能**: 获取系统统计信息  
**认证**: 需要  
**返回**: 系统统计数据

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalServers": 5,
    "onlineServers": 3,
    "totalPlayers": 120,
    "totalCommands": 1500,
    "uptime": 86400
  }
}
```

---

### 2. 服务器管理接口

#### 2.1 获取服务器列表
```
GET /api/servers?page=1&limit=20
```
**功能**: 获取所有服务器列表（分页）  
**认证**: 需要  
**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "survival",
        "name": "生存服务器",
        "coreType": "java",
        "coreName": "paper",
        "status": "online",
        "playerCount": 25
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

#### 2.2 创建服务器
```
POST /api/servers
```
**功能**: 注册新服务器  
**认证**: 需要  
**请求体**:
```json
{
  "id": "survival",
  "name": "生存服务器",
  "coreType": "java",
  "coreName": "paper",
  "connectionMode": "reverse",
  "connectionConfig": {}
}
```

#### 2.3 获取服务器详情
```
GET /api/servers/:serverId
```
**功能**: 获取指定服务器详细信息  
**认证**: 需要  
**路径参数**: `serverId` - 服务器 ID

#### 2.4 更新服务器
```
PUT /api/servers/:serverId
```
**功能**: 更新服务器配置  
**认证**: 需要  
**请求体**: 要更新的字段

#### 2.5 删除服务器
```
DELETE /api/servers/:serverId
```
**功能**: 删除服务器  
**认证**: 需要  
**路径参数**: `serverId` - 服务器 ID

---

### 3. 玩家管理接口

#### 3.1 获取在线玩家列表
```
GET /api/servers/:serverId/players
```
**功能**: 获取服务器在线玩家  
**认证**: 需要  
**路径参数**: `serverId` - 服务器 ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": "uuid",
        "name": "Steve",
        "displayName": "§aSteve",
        "health": 20,
        "level": 30,
        "gameMode": "survival"
      }
    ],
    "count": 25
  }
}
```

#### 3.2 获取玩家详情
```
GET /api/servers/:serverId/players/:playerId
```
**功能**: 获取指定玩家详细信息  
**认证**: 需要  
**路径参数**:
- `serverId` - 服务器 ID
- `playerId` - 玩家 ID/UUID

#### 3.3 踢出玩家
```
POST /api/servers/:serverId/players/:playerId/kick
```
**功能**: 踢出玩家  
**认证**: 需要  
**请求体**:
```json
{
  "reason": "违反服务器规则"
}
```

---

### 4. 白名单管理接口

#### 4.1 获取白名单
```
GET /api/servers/:serverId/whitelist
```
**功能**: 获取服务器白名单  
**认证**: 需要

#### 4.2 添加到白名单
```
POST /api/servers/:serverId/whitelist
```
**功能**: 添加玩家到白名单  
**认证**: 需要  
**请求体**:
```json
{
  "playerId": "uuid",
  "playerName": "Steve"
}
```

#### 4.3 从白名单移除
```
DELETE /api/servers/:serverId/whitelist/:playerId
```
**功能**: 从白名单移除玩家  
**认证**: 需要

---

### 5. 封禁管理接口

#### 5.1 获取封禁列表
```
GET /api/servers/:serverId/bans?page=1&limit=20
```
**功能**: 获取服务器封禁列表  
**认证**: 需要

#### 5.2 创建封禁
```
POST /api/servers/:serverId/bans
```
**功能**: 封禁玩家  
**认证**: 需要  
**请求体**:
```json
{
  "playerId": "uuid",
  "playerName": "Griefer",
  "reason": "恶意破坏",
  "duration": 86400,
  "banType": "player"
}
```

#### 5.3 更新封禁
```
PUT /api/servers/:serverId/bans/:banId
```
**功能**: 更新封禁信息  
**认证**: 需要

#### 5.4 解除封禁
```
DELETE /api/servers/:serverId/bans/:banId
```
**功能**: 解除封禁  
**认证**: 需要

---

### 6. 命令执行接口

#### 6.1 执行命令
```
POST /api/servers/:serverId/commands
```
**功能**: 在服务器执行命令  
**认证**: 需要  
**请求体**:
```json
{
  "command": "say Hello World",
  "executeAs": "console"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "commandId": "uuid",
    "status": "executed",
    "output": "[Server] Hello World",
    "executedAt": 1234567890
  }
}
```

#### 6.2 执行快捷操作
```
POST /api/servers/:serverId/actions
```
**功能**: 执行预定义的快捷操作  
**认证**: 需要  
**请求体**:
```json
{
  "action": "restart",
  "parameters": {}
}
```

---

### 7. 监控接口

#### 7.1 获取服务器状态
```
GET /api/servers/:serverId/status
```
**功能**: 获取服务器实时状态  
**认证**: 需要

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "online",
    "playerCount": 25,
    "maxPlayers": 100,
    "tps": 19.8,
    "uptime": 3600,
    "version": "1.20.4"
  }
}
```

#### 7.2 获取性能历史
```
GET /api/servers/:serverId/performance?period=1h
```
**功能**: 获取服务器性能历史数据  
**认证**: 需要  
**查询参数**:
- `period`: 时间段（1h, 6h, 24h, 7d）

#### 7.3 获取告警列表
```
GET /api/servers/:serverId/alerts?severity=high&status=active
```
**功能**: 获取服务器告警  
**认证**: 需要  
**查询参数**:
- `severity`: 严重程度（low, medium, high, critical）
- `status`: 状态（active, acknowledged, resolved）

#### 7.4 确认告警
```
POST /api/servers/:serverId/alerts/:alertId/acknowledge
```
**功能**: 确认告警  
**认证**: 需要

#### 7.5 获取当前指标
```
GET /api/servers/:serverId/metrics/current
```
**功能**: 获取服务器当前性能指标  
**认证**: 需要

**响应示例**:
```json
{
  "success": true,
  "data": {
    "cpu": 45.2,
    "memory": 2048,
    "tps": 19.8,
    "playerCount": 25,
    "chunkCount": 1500,
    "entityCount": 3000
  }
}
```

#### 7.6 获取指标摘要
```
GET /api/servers/:serverId/metrics/summary?period=24h
```
**功能**: 获取指标统计摘要  
**认证**: 需要

---

### 8. 批量操作接口

#### 8.1 批量执行命令
```
POST /api/batch/commands
```
**功能**: 在多个服务器执行相同命令  
**认证**: 需要  
**请求体**:
```json
{
  "serverIds": ["survival", "creative", "bedrock1"],
  "command": "say 服务器维护通知"
}
```

#### 8.2 批量执行操作
```
POST /api/batch/actions
```
**功能**: 在多个服务器执行相同操作  
**认证**: 需要  
**请求体**:
```json
{
  "serverIds": ["survival", "creative"],
  "action": "save-all"
}
```

---

### 9. 审计日志接口

#### 9.1 获取审计日志
```
GET /api/audit?page=1&limit=50&operation=server.create
```
**功能**: 获取系统审计日志  
**认证**: 需要  
**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `operation`: 操作类型过滤

---

### 10. 认证接口

#### 10.1 验证令牌
```
POST /api/auth/verify
```
**功能**: 验证 API 令牌有效性  
**认证**: 不需要  
**请求体**:
```json
{
  "token": "your-api-token"
}
```

#### 10.2 创建令牌
```
POST /api/auth/tokens
```
**功能**: 创建新的 API 令牌  
**认证**: 需要  
**请求体**:
```json
{
  "serverId": "survival",
  "description": "用于自动化脚本",
  "expiresIn": 2592000
}
```

---

### 11. 绑定管理接口

#### 11.1 获取绑定列表
```
GET /api/bindings?page=1&limit=20
```
**功能**: 获取群组-服务器绑定列表  
**认证**: 需要

#### 11.2 创建绑定
```
POST /api/bindings
```
**功能**: 创建群组-服务器绑定  
**认证**: 需要  
**请求体**:
```json
{
  "groupId": "123456",
  "serverId": "survival",
  "bindingType": "full",
  "config": {
    "syncChat": true,
    "syncEvents": true
  }
}
```

#### 11.3 获取绑定详情
```
GET /api/bindings/:bindingId
```
**功能**: 获取指定绑定详情  
**认证**: 需要

#### 11.4 更新绑定
```
PUT /api/bindings/:bindingId
```
**功能**: 更新绑定配置  
**认证**: 需要

#### 11.5 删除绑定
```
DELETE /api/bindings/:bindingId
```
**功能**: 删除绑定  
**认证**: 需要

#### 11.6 获取绑定统计
```
GET /api/bindings/stats
```
**功能**: 获取绑定统计信息  
**认证**: 需要

#### 11.7 批量创建绑定
```
POST /api/bindings/batch
```
**功能**: 批量创建绑定  
**认证**: 需要  
**请求体**:
```json
{
  "bindings": [
    {
      "groupId": "123456",
      "serverId": "survival",
      "bindingType": "full"
    },
    {
      "groupId": "789012",
      "serverId": "creative",
      "bindingType": "monitor"
    }
  ]
}
```

#### 11.8 获取群组路由
```
GET /api/groups/:groupId/routes
```
**功能**: 获取群组的消息路由配置  
**认证**: 需要

---

## 🔌 WebSocket 事件

### WebSocket 连接
- **URL**: `ws://localhost:8080`
- **协议**: U-WBP v2
- **认证**: 连接时需要提供 token

### 事件类型

#### 1. 服务器事件
- `server.status` - 服务器状态变化
- `server.start` - 服务器启动
- `server.stop` - 服务器停止
- `server.crash` - 服务器崩溃

#### 2. 玩家事件
- `player.join` - 玩家加入
- `player.quit` - 玩家离开
- `player.chat` - 玩家聊天
- `player.death` - 玩家死亡
- `player.advancement` - 玩家成就

#### 3. 性能事件
- `performance.update` - 性能指标更新
- `performance.alert` - 性能告警

#### 4. 命令事件
- `command.executed` - 命令执行完成
- `command.failed` - 命令执行失败

---

## 📊 数据库表结构

### 1. mochi_servers
服务器信息表
- `id` (主键) - 服务器 ID
- `name` - 服务器名称
- `core_type` - 核心类型 (java/bedrock)
- `core_name` - 核心名称
- `core_version` - 核心版本
- `connection_mode` - 连接模式
- `connection_config` - 连接配置 (JSON)
- `status` - 状态
- `owner_id` - 所有者 ID
- `tags` - 标签 (JSON)
- `created_at` - 创建时间
- `updated_at` - 更新时间
- `last_seen` - 最后在线时间

### 2. mochi_server_acl
服务器访问控制列表
- `id` (主键) - ACL ID
- `user_id` - 用户 ID
- `server_id` - 服务器 ID
- `role` - 角色 (owner/admin/operator/viewer)
- `permissions` - 权限列表 (JSON)
- `granted_by` - 授权者
- `granted_at` - 授权时间
- `expires_at` - 过期时间

### 3. mochi_api_tokens
API 令牌表
- `id` (主键) - 令牌 ID
- `server_id` - 服务器 ID
- `token` - 令牌
- `token_hash` - 令牌哈希
- `ip_whitelist` - IP 白名单 (JSON)
- `encryption_config` - 加密配置 (JSON)
- `created_at` - 创建时间
- `expires_at` - 过期时间
- `last_used` - 最后使用时间

### 4. mochi_audit_logs
审计日志表
- `id` (主键) - 日志 ID
- `user_id` - 用户 ID
- `server_id` - 服务器 ID
- `operation` - 操作类型
- `operation_data` - 操作数据 (JSON)
- `result` - 结果 (success/failure)
- `error_message` - 错误消息
- `ip_address` - IP 地址
- `user_agent` - User Agent
- `timestamp` - 时间戳

---

## 🔐 权限系统

### 角色类型
1. **owner** - 所有者：完全控制权限
2. **admin** - 管理员：管理服务器和玩家
3. **operator** - 操作员：执行命令和基本管理
4. **viewer** - 查看者：只读权限

### 权限列表
- `server.view` - 查看服务器信息
- `server.manage` - 管理服务器配置
- `server.control` - 控制服务器（启动/停止）
- `player.view` - 查看玩家信息
- `player.manage` - 管理玩家（踢出/封禁）
- `command.execute` - 执行命令
- `whitelist.manage` - 管理白名单
- `ban.manage` - 管理封禁
- `audit.view` - 查看审计日志

---

## 📝 使用示例

### Koishi 命令示例
```bash
# ========== 服务器管理 ==========
# 添加 Java 服务器
mochi.server.add survival 生存服务器 -t java -c paper

# 添加基岩版服务器
mochi.server.add bedrock1 基岩服 -t bedrock -c llbds

# 查看所有服务器
mochi.server.list

# 查看服务器详情
mochi.server.info survival

# 删除服务器
mochi.server.remove old_server

# ========== 白名单管理 ==========
# 查看白名单
mochi.whitelist.list survival

# 添加到白名单
mochi.whitelist.add survival Steve
mochi.whitelist.add survival 069a79f4-44e9-4726-a5be-fca90e38aaf5

# 从白名单移除
mochi.whitelist.remove survival Griefer

# ========== 玩家管理 ==========
# 查看在线玩家
mochi.player.list survival

# 查看玩家详情
mochi.player.info survival Steve

# 踢出玩家
mochi.player.kick survival Griefer 恶意破坏
mochi.player.kick survival AFK

# ========== 命令执行 ==========
# 执行服务器命令
mochi.exec survival say Hello World
mochi.exec survival give @a diamond 64
mochi.exec survival tp Steve 0 64 0
mochi.cmd survival weather clear
mochi.exec survival time set day -a console

# ========== 审计日志 ==========
# 查看审计日志（最近 20 条）
mochi.audit -l 20
```

### API 调用示例 (curl)
```bash
# 获取服务器列表
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8081/api/servers

# 创建服务器
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"survival","name":"生存服务器","coreType":"java","coreName":"paper","connectionMode":"reverse"}' \
  http://localhost:8081/api/servers

# 获取在线玩家
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8081/api/servers/survival/players

# 执行命令
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"say Hello","executeAs":"console"}' \
  http://localhost:8081/api/servers/survival/commands

# 批量执行命令
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serverIds":["survival","creative"],"command":"save-all"}' \
  http://localhost:8081/api/batch/commands
```

---

## 🎯 总结

### Koishi 指令统计
- **主命令**: 1 个
- **服务器管理**: 5 个
- **审计日志**: 1 个
- **白名单管理**: 4 个
- **玩家管理**: 4 个
- **命令执行**: 1 个
- **总计**: 16 个指令

### HTTP API 统计
- **系统管理**: 2 个端点
- **服务器管理**: 5 个端点
- **玩家管理**: 3 个端点
- **白名单管理**: 3 个端点
- **封禁管理**: 4 个端点
- **命令执行**: 2 个端点
- **监控**: 6 个端点
- **批量操作**: 2 个端点
- **审计日志**: 1 个端点
- **认证**: 2 个端点
- **绑定管理**: 8 个端点
- **总计**: 38 个 API 端点

### 数据库表
- **总计**: 4 个表

---

**文档版本**: v1.2.0  
**最后更新**: 2026-02-17  
**项目**: Mochi-Link (大福连)
