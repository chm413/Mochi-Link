# Mochi-Link (大福连) - API 接口文档

## 概述

Mochi-Link（大福连）是一个 Minecraft 统一管理与监控系统，通过标准化的 U-WBP v2 协议提供跨核心、跨版本、跨平台的统一管理接口。本文档详细描述了系统的所有 API 接口，包括 HTTP REST API 和 WebSocket 实时通信接口。

## 目录

1. [U-WBP v2 协议规范](#u-wbp-v2-协议规范)
2. [HTTP REST API](#http-rest-api)
3. [WebSocket 实时接口](#websocket-实时接口)
4. [数据模型](#数据模型)
5. [错误处理](#错误处理)
6. [认证与权限](#认证与权限)
7. [事件系统](#事件系统)

## U-WBP v2 协议规范

### 协议概述

U-WBP v2（统一 WebSocket 协议版本 2）是 Mochi-Link 系统的核心通信协议，用于在 Koishi 插件和 Connector Bridge 之间进行标准化通信。

### 消息格式

所有 U-WBP v2 消息都使用 JSON 格式，包含以下标准字段：

```json
{
  "type": "request|response|event",
  "id": "消息唯一标识符",
  "op": "操作类型",
  "data": {}, // 操作数据
  "timestamp": "ISO 8601 时间戳",
  "version": "协议版本"
}
```

### 消息类型

#### 1. 请求消息 (request)
```json
{
  "type": "request",
  "id": "req_1234567890",
  "op": "server.get_status",
  "data": {
    "serverId": "server_001"
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "2.0.0"
}
```

#### 2. 响应消息 (response)
```json
{
  "type": "response",
  "id": "req_1234567890", // 对应请求的 ID
  "op": "server.get_status",
  "data": {
    "status": "online",
    "players": 5,
    "tps": 20.0
  },
  "timestamp": "2024-01-01T00:00:01Z",
  "version": "2.0.0"
}
```

#### 3. 事件消息 (event)
```json
{
  "type": "event",
  "id": "evt_1234567890",
  "op": "player.join",
  "data": {
    "playerId": "uuid_1234567890",
    "playerName": "Steve",
    "serverId": "server_001"
  },
  "timestamp": "2024-01-01T00:00:02Z",
  "version": "2.0.0"
}
```

### 握手流程

#### 正向连接模式
1. Koishi 插件连接到 Connector Bridge
2. Connector Bridge 发送握手响应 + 能力声明
3. Koishi 插件发送认证信息
4. Connector Bridge 返回认证成功

#### 反向连接模式
1. Connector Bridge 连接到 Koishi 插件
2. Koishi 插件发送握手响应
3. Connector Bridge 发送认证信息 + 能力声明
4. Koishi 插件返回认证成功

### 心跳机制

系统使用 `system.ping` 和 `system.pong` 操作维持连接：

```json
// Ping 消息
{
  "type": "request",
  "id": "ping_1234567890",
  "op": "system.ping",
  "data": {},
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "2.0.0"
}

// Pong 响应
{
  "type": "response",
  "id": "ping_1234567890",
  "op": "system.pong",
  "data": {
    "latency": 50
  },
  "timestamp": "2024-01-01T00:00:00.050Z",
  "version": "2.0.0"
}
```

## HTTP REST API

### 基础信息

- **基础路径**: `/api`
- **认证方式**: Bearer Token
- **内容类型**: `application/json`
- **响应格式**: JSON

### 认证头

```http
Authorization: Bearer <api_token>
X-Server-ID: <server_id>  # 可选，用于服务器级操作
```

### 服务器管理 API

#### 1. 获取服务器列表
```http
GET /api/servers
```

**查询参数**:
- `page` (可选): 页码，默认 1
- `limit` (可选): 每页数量，默认 20
- `status` (可选): 过滤状态 (online/offline/error)
- `coreType` (可选): 过滤核心类型 (Java/Bedrock)

**响应**:
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": "server_001",
        "name": "主生存服",
        "coreType": "Java",
        "coreName": "Paper",
        "coreVersion": "1.20.4",
        "connectionMode": "plugin",
        "status": "online",
        "ownerId": "user_001",
        "tags": ["生存", "主服"],
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
        "lastSeen": "2024-01-01T12:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

#### 2. 注册新服务器
```http
POST /api/servers
```

**请求体**:
```json
{
  "name": "新服务器",
  "coreType": "Java",
  "coreName": "Paper",
  "coreVersion": "1.20.4",
  "connectionMode": "plugin",
  "connectionConfig": {
    "plugin": {
      "host": "127.0.0.1",
      "port": 25565,
      "ssl": false
    }
  },
  "tags": ["生存", "测试"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "server_002",
    "token": "generated_token_here",
    "message": "服务器注册成功"
  }
}
```

#### 3. 获取服务器详情
```http
GET /api/servers/{serverId}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "server_001",
    "name": "主生存服",
    "coreType": "Java",
    "coreName": "Paper",
    "coreVersion": "1.20.4",
    "connectionMode": "plugin",
    "connectionConfig": {
      "plugin": {
        "host": "127.0.0.1",
        "port": 25565,
        "ssl": false
      }
    },
    "status": "online",
    "ownerId": "user_001",
    "tags": ["生存", "主服"],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "lastSeen": "2024-01-01T12:00:00Z",
    "statistics": {
      "uptime": 86400,
      "totalPlayers": 50,
      "averageTPS": 19.8
    }
  }
}
```

#### 4. 更新服务器配置
```http
PUT /api/servers/{serverId}
```

**请求体**:
```json
{
  "name": "更新后的服务器名",
  "connectionConfig": {
    "plugin": {
      "host": "192.168.1.100",
      "port": 25566,
      "ssl": true
    }
  },
  "tags": ["生存", "主服", "更新"]
}
```

#### 5. 删除服务器
```http
DELETE /api/servers/{serverId}
```

### 玩家管理 API

#### 1. 获取玩家列表
```http
GET /api/servers/{serverId}/players
```

**查询参数**:
- `onlineOnly` (可选): 仅在线玩家，默认 false
- `page` (可选): 页码，默认 1
- `limit` (可选): 每页数量，默认 50

**响应**:
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": "uuid_1234567890",
        "name": "Steve",
        "displayName": "§aSteve",
        "world": "world",
        "position": {
          "x": 100.5,
          "y": 64.0,
          "z": -200.3
        },
        "ping": 50,
        "isOp": true,
        "permissions": ["minecraft.command.gamemode"],
        "isOnline": true,
        "joinTime": "2024-01-01T12:00:00Z"
      }
    ],
    "online": 5,
    "total": 50,
    "page": 1,
    "limit": 50
  }
}
```

#### 2. 获取玩家详情
```http
GET /api/servers/{serverId}/players/{playerId}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "player": {
      "id": "uuid_1234567890",
      "name": "Steve",
      "displayName": "§aSteve",
      "world": "world",
      "position": {
        "x": 100.5,
        "y": 64.0,
        "z": -200.3
      },
      "ping": 50,
      "isOp": true,
      "permissions": ["minecraft.command.gamemode"],
      "firstJoinAt": "2024-01-01T00:00:00Z",
      "lastSeenAt": "2024-01-01T12:00:00Z",
      "totalPlayTime": 3600,
      "ipAddress": "192.168.1.100",
      "deviceType": "PC",
      "edition": "Java",
      "isPremium": true,
      "identityConfidence": 1.0
    },
    "identity": {
      "uuid": "uuid_1234567890",
      "name": "Steve",
      "confidence": 1.0,
      "markers": {
        "ip": "192.168.1.100",
        "device": "PC",
        "firstSeen": "2024-01-01T00:00:00Z"
      },
      "conflicts": []
    }
  }
}
```

#### 3. 踢出玩家
```http
POST /api/servers/{serverId}/players/{playerId}/kick
```

**请求体**:
```json
{
  "reason": "违反服务器规则"
}
```

#### 4. 发送私聊消息
```http
POST /api/servers/{serverId}/players/{playerId}/message
```

**请求体**:
```json
{
  "message": "欢迎来到服务器！"
}
```

### 白名单管理 API

#### 1. 获取白名单
```http
GET /api/servers/{serverId}/whitelist
```

**响应**:
```json
{
  "success": true,
  "data": {
    "whitelist": [
      "uuid_1234567890",
      "uuid_0987654321"
    ],
    "synced": true,
    "lastSync": "2024-01-01T12:00:00Z",
    "pendingOperations": 0
  }
}
```

#### 2. 添加白名单
```http
POST /api/servers/{serverId}/whitelist
```

**请求体**:
```json
{
  "playerId": "uuid_newplayer123",
  "playerName": "NewPlayer"
}
```

#### 3. 移除白名单
```http
DELETE /api/servers/{serverId}/whitelist/{playerId}
```

### 命令执行 API

#### 1. 执行命令
```http
POST /api/servers/{serverId}/commands
```

**请求体**:
```json
{
  "command": "say 服务器维护中",
  "timeout": 5000
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "output": [
      "[Server] 服务器维护中"
    ],
    "executionTime": 100,
    "command": "say 服务器维护中"
  }
}
```

#### 2. 批量执行命令
```http
POST /api/servers/{serverId}/commands/batch
```

**请求体**:
```json
{
  "commands": [
    "save-all",
    "say 服务器保存完成"
  ],
  "parallel": false
}
```

### 服务器状态 API

#### 1. 获取服务器状态
```http
GET /api/servers/{serverId}/status
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "online",
    "players": {
      "online": 5,
      "max": 20,
      "list": ["Steve", "Alex", "Bob"]
    },
    "performance": {
      "tps": 19.8,
      "mspt": 45.2,
      "cpuUsage": 65.5,
      "memoryUsage": 2048,
      "memoryMax": 4096
    },
    "world": {
      "name": "world",
      "time": 6000,
      "weather": "clear"
    },
    "uptime": 86400,
    "version": "Paper 1.20.4"
  }
}
```

#### 2. 获取性能历史数据
```http
GET /api/servers/{serverId}/metrics
```

**查询参数**:
- `metric` (必需): 指标类型 (tps/players/memory/cpu)
- `from` (可选): 开始时间 (ISO 8601)
- `to` (可选): 结束时间 (ISO 8601)
- `interval` (可选): 时间间隔 (1m/5m/1h/1d)

### 权限管理 API

#### 1. 获取用户权限
```http
GET /api/servers/{serverId}/permissions/{userId}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "user_001",
    "serverId": "server_001",
    "roles": ["owner"],
    "permissions": [
      "server_001.player.kick",
      "server_001.command.execute",
      "server_001.whitelist.manage"
    ],
    "grantedBy": "system",
    "grantedAt": "2024-01-01T00:00:00Z",
    "expiresAt": null
  }
}
```

#### 2. 分配权限
```http
POST /api/servers/{serverId}/permissions
```

**请求体**:
```json
{
  "userId": "user_002",
  "role": "admin",
  "permissions": [
    "server_001.player.kick",
    "server_001.command.execute"
  ],
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

#### 3. 移除权限
```http
DELETE /api/servers/{serverId}/permissions/{userId}
```

### 审计日志 API

#### 1. 查询审计日志
```http
GET /api/audit-logs
```

**查询参数**:
- `serverId` (可选): 服务器ID过滤
- `userId` (可选): 用户ID过滤
- `operation` (可选): 操作类型过滤
- `from` (可选): 开始时间
- `to` (可选): 结束时间
- `page` (可选): 页码
- `limit` (可选): 每页数量

**响应**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "userId": "user_001",
        "serverId": "server_001",
        "operation": "player.kick",
        "operationData": {
          "playerId": "uuid_1234567890",
          "reason": "违反规则"
        },
        "result": "success",
        "errorMessage": null,
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

#### 2. 导出审计日志
```http
GET /api/audit-logs/export
```

**查询参数**: 同查询接口
**响应**: CSV 或 JSON 格式的导出文件

## WebSocket 实时接口

### 连接建立

#### 连接URL
```
ws://<host>:<port>/ws
wss://<host>:<port>/ws  # SSL
```

#### 连接参数
- `serverId`: 服务器ID
- `token`: 认证令牌
- `mode`: 连接模式 (forward/reverse)

### 核心操作

#### 1. 服务器状态查询
```json
{
  "type": "request",
  "id": "req_001",
  "op": "server.get_status",
  "data": {
    "serverId": "server_001"
  }
}
```

#### 2. 玩家列表查询
```json
{
  "type": "request",
  "id": "req_002",
  "op": "player.list",
  "data": {
    "serverId": "server_001",
    "onlineOnly": true
  }
}
```

#### 3. 执行命令
```json
{
  "type": "request",
  "id": "req_003",
  "op": "command.execute",
  "data": {
    "serverId": "server_001",
    "command": "say Hello World",
    "timeout": 5000
  }
}
```

#### 4. 白名单操作
```json
// 添加白名单
{
  "type": "request",
  "id": "req_004",
  "op": "whitelist.add",
  "data": {
    "serverId": "server_001",
    "playerId": "uuid_newplayer123"
  }
}

// 移除白名单
{
  "type": "request",
  "id": "req_005",
  "op": "whitelist.remove",
  "data": {
    "serverId": "server_001",
    "playerId": "uuid_newplayer123"
  }
}
```

#### 5. 玩家管理操作
```json
// 踢出玩家
{
  "type": "request",
  "id": "req_006",
  "op": "player.kick",
  "data": {
    "serverId": "server_001",
    "playerId": "uuid_1234567890",
    "reason": "违反规则"
  }
}

// 发送私聊
{
  "type": "request",
  "id": "req_007",
  "op": "player.message",
  "data": {
    "serverId": "server_001",
    "playerId": "uuid_1234567890",
    "message": "欢迎回来！"
  }
}
```

#### 6. 服务器控制操作
```json
// 保存世界
{
  "type": "request",
  "id": "req_008",
  "op": "server.save",
  "data": {
    "serverId": "server_001"
  }
}

// 重启服务器
{
  "type": "request",
  "id": "req_009",
  "op": "server.restart",
  "data": {
    "serverId": "server_001",
    "delay": 10
  }
}

// 停止服务器
{
  "type": "request",
  "id": "req_010",
  "op": "server.stop",
  "data": {
    "serverId": "server_001"
  }
}
```

### 事件订阅

#### 1. 订阅事件
```json
{
  "type": "request",
  "id": "req_011",
  "op": "event.subscribe",
  "data": {
    "serverId": "server_001",
    "eventTypes": ["player.join", "player.leave", "player.chat"],
    "useDefaults": false  // 可选，true 则使用默认基础事件
  }
}
```

**响应**:
```json
{
  "type": "response",
  "id": "req_011",
  "op": "event.subscribe",
  "data": {
    "subscriptionId": "sub_1234567890",
    "serverId": "server_001",
    "eventTypes": ["player.join", "player.leave", "player.chat"],
    "message": "Successfully subscribed to events"
  },
  "metadata": {
    "isDefaultSubscription": false,
    "availableBasicEvents": [
      "server.start",
      "server.stop",
      "server.status",
      "player.join",
      "player.leave"
    ],
    "availableExtendedEvents": [
      "player.chat",
      "player.death",
      "player.advancement",
      "server.logLine",
      "alert.tpsLow",
      "alert.memoryHigh",
      "alert.playerFlood"
    ]
  }
}
```

**默认订阅行为**:
- 如果 `eventTypes` 为空或未指定，且 `useDefaults` 不为 `false`，则自动订阅基础事件
- 基础事件包括：`server.start`, `server.stop`, `server.status`, `player.join`, `player.leave`
- 扩展事件需要明确指定，避免增加服务器负担

#### 2. 取消订阅
```json
{
  "type": "request",
  "id": "req_012",
  "op": "event.unsubscribe",
  "data": {
    "subscriptionId": "sub_1234567890"
  }
}
```

## 数据模型

### 服务器配置
```typescript
interface ServerConfig {
  id: string
  name: string
  coreType: 'Java' | 'Bedrock'
  coreName: string
  coreVersion: string
  connectionMode: 'plugin' | 'rcon' | 'terminal'
  connectionConfig: ConnectionConfig
  ownerId: string
  tags: string[]
  status: 'online' | 'offline' | 'error'
  createdAt: Date
  updatedAt: Date
  lastSeen: Date
}
```

### 连接配置
```typescript
interface ConnectionConfig {
  plugin?: {
    host: string
    port: number
    ssl: boolean
  }
  rcon?: {
    host: string
    port: number
    password: string
  }
  terminal?: {
    processId: number
    workingDir: string
    command: string
  }
}
```

### 玩家信息
```typescript
interface Player {
  id: string  // UUID 或 XUID
  name: string
  displayName: string
  world: string
  position: {
    x: number
    y: number
    z: number
  }
  ping: number
  isOp: boolean
  permissions: string[]
  isOnline: boolean
  joinTime?: Date
}
```

### 玩家详细信息
```typescript
interface PlayerDetail extends Player {
  firstJoinAt: Date
  lastSeenAt: Date
  totalPlayTime: number
  ipAddress: string
  deviceType: string
  edition: 'Java' | 'Bedrock'
  isPremium: boolean
  identityConfidence: number
}
```

### 玩家身份识别
```typescript
interface PlayerIdentity {
  uuid?: string
  xuid?: string
  name: string
  confidence: number
  markers: {
    ip?: string
    device?: string
    firstSeen?: Date
  }
  conflicts: PlayerIdentity[]
}
```

### 服务器状态
```typescript
interface ServerStatus {
  status: 'online' | 'offline' | 'error' | 'starting' | 'stopping'
  players: {
    online: number
    max: number
    list: string[]
  }
  performance: {
    tps: number
    mspt: number
    cpuUsage: number
    memoryUsage: number
    memoryMax: number
  }
  world: {
    name: string
    time: number
    weather: string
  }
  uptime: number
  version: string
}
```

## 错误处理

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {} // 可选，详细错误信息
  }
}
```

### 常见错误码

#### 认证错误
- `AUTH_REQUIRED`: 需要认证
- `INVALID_TOKEN`: 无效的令牌
- `TOKEN_EXPIRED`: 令牌已过期
- `IP_NOT_ALLOWED`: IP不在白名单中

#### 权限错误
- `PERMISSION_DENIED`: 权限不足
- `SERVER_ACCESS_DENIED`: 无权访问该服务器
- `OPERATION_NOT_ALLOWED`: 操作不被允许

#### 服务器错误
- `SERVER_NOT_FOUND`: 服务器不存在
- `SERVER_OFFLINE`: 服务器离线
- `SERVER_BUSY`: 服务器繁忙
- `CONNECTION_FAILED`: 连接失败

#### 数据错误
- `PLAYER_NOT_FOUND`: 玩家不存在
- `INVALID_PLAYER_ID`: 无效的玩家ID
- `DATA_VALIDATION_ERROR`: 数据验证失败

#### 系统错误
- `INTERNAL_ERROR`: 内部错误
- `DATABASE_ERROR`: 数据库错误
- `RATE_LIMIT_EXCEEDED`: 请求频率超限

### WebSocket 错误消息
```json
{
  "type": "response",
  "id": "req_001",
  "op": "error",
  "data": {
    "code": "PERMISSION_DENIED",
    "message": "用户无权执行此操作",
    "details": {
      "userId": "user_001",
      "operation": "player.kick"
    }
  }
}
```

## 认证与权限

### 认证方式

#### 1. API Token 认证
- 用于 HTTP API 访问
- Bearer Token 格式
- 支持 IP 白名单限制

#### 2. WebSocket 认证
- 连接时传递 serverId 和 token
- 支持双向认证（正向/反向连接）
- 支持加密通信

### 权限模型

#### 权限格式
```
<serverId>.<resource>.<action>
```

#### 示例权限
- `server_001.player.kick`: 踢出玩家
- `server_001.command.execute`: 执行命令
- `server_001.whitelist.manage`: 管理白名单
- `server_001.server.restart`: 重启服务器

#### 角色定义
- `owner`: 服主，拥有所有权限
- `admin`: 管理员，拥有大部分权限
- `moderator`:  moderator，拥有玩家管理权限
- `viewer`: 查看者，只读权限

### 权限检查流程
1. 验证用户是否可访问目标服务器
2. 检查用户是否拥有操作权限
3. 验证操作参数是否有效
4. 执行操作并记录审计日志

## 事件系统

### 事件类型

#### 玩家事件
- `player.join`: 玩家加入服务器
- `player.leave`: 玩家离开服务器
- `player.chat`: 玩家发送聊天消息
- `player.death`: 玩家死亡
- `player.advancement`: 玩家获得成就
- `player.kick`: 玩家被踢出
- `player.ban`: 玩家被封禁

#### 服务器事件
- `server.start`: 服务器启动
- `server.stop`: 服务器停止
- `server.status`: 服务器状态变化
- `server.log`: 服务器日志输出
- `server.backup`: 服务器备份完成

#### 性能事件
- `performance.tps_low`: TPS过低
- `performance.memory_high`: 内存使用过高
- `performance.cpu_high`: CPU使用过高
- `performance.player_flood`: 玩家涌入

#### 系统事件
- `system.connection_established`: 连接建立
- `system.connection_lost`: 连接丢失
- `system.heartbeat`: 心跳事件
- `system.error`: 系统错误

### 事件格式
```json
{
  "type": "event",
  "id": "evt_001",
  "op": "player.join",
  "data": {
    "serverId": "server_001",
    "player": {
      "id": "uuid_1234567890",
      "name": "Steve",
      "displayName": "§aSteve"
    },
    "timestamp": "2024-01-01T12:00:00Z",
    "details": {
      "ipAddress": "192.168.1.100",
      "joinMessage": "Steve joined the game"
    }
  }
}
```

### 事件订阅管理

#### 订阅请求
```json
{
  "type": "request",
  "id": "sub_001",
  "op": "event.subscribe",
  "data": {
    "serverId": "server_001",
    "eventTypes": ["player.join", "player.leave", "player.chat"],
    "filters": {
      "minPlayerLevel": 10
    }
  }
}
```

#### 取消订阅
```json
{
  "type": "request",
  "id": "unsub_001",
  "op": "event.unsubscribe",
  "data": {
    "subscriptionId": "sub_001"
  }
}
```

## 附录

### 状态码参考

#### HTTP 状态码
- `200 OK`: 请求成功
- `201 Created`: 资源创建成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未认证
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `429 Too Many Requests`: 请求频率超限
- `500 Internal Server Error`: 服务器内部错误

#### WebSocket 关闭码
- `1000`: 正常关闭
- `1001`: 端点离开
- `1002`: 协议错误
- `1003`: 不支持的数据类型
- `1008`: 策略违规
- `1011`: 服务器内部错误

### 速率限制

#### HTTP API 限制
- 认证请求: 10次/分钟
- 普通请求: 60次/分钟
- 批量操作: 5次/分钟

#### WebSocket 限制
- 消息频率: 100条/秒
- 连接数: 每个服务器最多10个连接
- 数据大小: 单条消息最大16KB

### 版本兼容性

#### 协议版本
- U-WBP v2.0.0: 当前稳定版本
- U-WBP v1.x: 向后兼容（有限支持）

#### API 版本
- 通过 `Accept` 头指定版本: `application/vnd.mochi-link.v2+json`
- URL 路径版本: `/api/v2/...`

### 更新日志

#### v2.0.0 (2024-01-01)
- 引入 U-WBP v2 协议
- 支持双向连接模式
- 完善权限系统
- 增加事件订阅机制

#### v1.5.0 (2023-12-01)
- 基础 HTTP API
- 简单 WebSocket 通信
- 基本玩家管理功能

---

**文档版本**: 2.0.0  
**最后更新**: 2024-01-01  
**维护者**: Mochi-Link 开发团队