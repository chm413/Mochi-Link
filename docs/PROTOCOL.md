# U-WBP v2 协议

## 1. 版本与兼容规则

规范版本字符串为 `2.0`。历史实现中的 `2.0.0` 视为 U-WBP 2.0 系列兼容值，接收端可兼容读取，但新消息必须发送 `2.0`。

时间戳规范为 Unix epoch 毫秒整数，例如 `1787980800000`。历史 ISO 8601 字符串只允许作为读取兼容格式，新消息不得继续产生字符串时间戳。

## 2. 消息外壳

```json
{
  "type": "request",
  "id": "1787980800000-abcd1234",
  "op": "command.execute",
  "data": { "command": "list" },
  "timestamp": 1787980800000,
  "version": "2.0",
  "serverId": "survival-1"
}
```

公共字段：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `type` | string | `request`、`response`、`event`、`system` |
| `id` | string | 当前消息的唯一 ID |
| `op` | string | 注册的操作名 |
| `data` | object | 操作数据，允许空对象 |
| `timestamp` | number | Unix epoch 毫秒 |
| `version` | string | 新消息固定 `2.0` |
| `serverId` | string | Connector 连接与已绑定消息必须提供；缺失时拒绝握手，不生成占位身份 |

## 3. 请求与响应关联

响应有自己的 `id`，并通过 `requestId` 指向原请求：

```json
{
  "type": "response",
  "id": "response-message-id",
  "requestId": "original-request-id",
  "op": "command.execute",
  "success": true,
  "data": { "output": "There are 2 players online" },
  "timestamp": 1787980800123,
  "version": "2.0",
  "serverId": "survival-1"
}
```

请求管理器必须优先使用 `requestId` 匹配待处理请求。把响应自身 `id` 当作请求 ID 会导致正常响应超时。

## 4. 操作名

操作名使用 `domain.action`：

- `server.getInfo`、`server.getStatus`、`server.getMetrics`
- `server.shutdown`、`server.restart`
- `player.list`、`player.getInfo`、`player.kick`、`player.ban`、`player.unban`、`player.banlist`、`player.message`、`player.teleport`
- `whitelist.get`、`whitelist.add`、`whitelist.remove`、`whitelist.enable`、`whitelist.disable`
- `command.execute`、`command.suggest`、`command.batch`
- `event.subscribe`、`event.unsubscribe`
- `permission.grant`、`permission.revoke`、`permission.update`、`permission.query`、`permission.list`
- `world.list`、`world.setTime`、`world.setWeather`

`server.command` 是历史别名。兼容层可以接收它，但内部路由和新 Connector 必须使用 `command.execute`。

事件操作示例：`player.join`、`player.leave`、`player.chat`、`server.status`、`server.metrics`。系统操作示例：`ping`、`pong`、`handshake`、`capabilities`、`disconnect`、`error`。

## 5. 认证顺序

当前支持升级请求头认证和 challenge-HMAC 认证。

### 5.1 升级请求头认证

Connector 在 WebSocket upgrade 中通过查询参数 `serverId` 或请求头 `X-Server-Id` 发送稳定身份，并通过 `X-Auth-Token` 或 `Authorization: Bearer <token>` 发送令牌。缺少 `serverId` 时 Koishi 必须拒绝连接。查询参数 `token` 仅作旧客户端兼容，新 Connector 不得把凭据放进 URL。

静态 token 认证的 Connector 同时通过 `X-Capabilities` 发送逗号分隔的能力声明，例如：

```text
X-Server-Id: survival-1
X-Protocol-Version: 2.0
X-Capabilities: player_management,command_execution,event_streaming
Authorization: Bearer <token>
```

能力头在认证完成前不可信；Koishi 只在 token 校验成功后采用经过规范化的已知能力。

Koishi 对令牌做 SHA-256 后与数据库哈希比较，并检查过期时间和 IP 策略。成功后连接绑定到 `serverId`。原始 token 不得写入日志。

### 5.2 Challenge-HMAC 认证

未在 upgrade 中提供 token 时，Koishi 发送 `system/handshake`：

```json
{
  "type": "system",
  "id": "challenge-message-id",
  "op": "handshake",
  "systemOp": "handshake",
  "data": {
    "protocolVersion": "2.0",
    "serverType": "koishi",
    "authenticationRequired": true,
    "challenge": "32-byte-random-hex",
    "challengeTimestamp": 1787980800000,
    "challengeExpiresAt": 1787980830000
  },
  "timestamp": 1787980800000,
  "version": "2.0",
  "serverId": "survival-1"
}
```

Connector 使用 token 作为 HMAC-SHA256 密钥，并以 UTF-8 字符串 `${challenge}:${token}:${challengeTimestamp}` 作为消息。应答仍是 `system/handshake`，通过 `requestId` 指向 challenge 消息：

```json
{
  "type": "system",
  "id": "connector-handshake-id",
  "requestId": "challenge-message-id",
  "op": "handshake",
  "systemOp": "handshake",
  "data": {
    "serverId": "survival-1",
    "protocolVersion": "2.0",
    "authentication": { "token": "configured-token", "method": "challenge" },
    "challenge": "32-byte-random-hex",
    "challengeTimestamp": 1787980800000,
    "challengeResponse": "hex-hmac-sha256",
    "capabilities": ["command_execution", "server_control"]
  },
  "timestamp": 1787980800100,
  "version": "2.0",
  "serverId": "survival-1"
}
```

challenge 只能使用一次，成功、失败或过期后均删除。比较 HMAC 时必须使用恒定时间比较。认证消息中的 capabilities 只是声明，必须在认证成功后才可采用，并与管理端 Bridge 的真实实现能力取交集。

认证完成前只允许 `system/handshake`；普通 request、event、ping 或 capabilities 消息必须被拒绝并关闭连接。

认证证明不提供传输机密性。真实网络应在 WSS/TLS 中传输，不能依赖 Base64、XOR 或已废弃的 Node cipher API。

## 6. 标准数据分支

| 操作 | 成功响应 `data` |
| --- | --- |
| `server.getInfo` | `{ "info": ServerInfo }` |
| `server.getStatus` | `{ "status": "online|offline|starting|stopping|error", "online": boolean }`；`online` 必须且只能在 `status` 为 `online` 时为 `true` |
| `server.getMetrics` | `{ "metrics": PerformanceMetrics }` |
| `server.shutdown` | `{ "success": boolean, "delay": number }`；执行当前进程关停 |
| `server.restart` | `{ "success": boolean, "delay": number }`；只有具备进程重启能力的 Connector 才能成功，否则返回 `UNSUPPORTED_OPERATION` |
| `player.list` | `{ "players": Player[] }` |
| `player.getInfo` | `{ "player": PlayerDetail }`；未找到可返回 `null` |
| `whitelist.get` | `{ "players": string[] }`；兼容期可附带旧 `whitelist` 对象数组 |
| `command.execute` | `{ "output": string|string[], "executionTime": number }` |

`Player` 的跨核心必填字段是 `id`、`name`、`displayName`、`world`、`position`、`ping`、`isOp`、`permissions` 和 `edition`。`firstJoinAt`、`lastSeenAt`、`totalPlayTime`、正版/身份置信信息属于 `PlayerDetail` 可选增强字段，核心 API 无法可靠提供时应省略，不能伪造。

性能、人数上限或延迟等数字在目标 API 不提供时使用 `0` 表示“未报告”，不得用 `20 TPS`、`20 人`或其他看似正常的数值填充。只有 `online: true` 且来自当前运行时快照时才能报告在线。

## 7. 心跳

ping 和 pong 均使用 `type: "system"`，且 `op`/`systemOp` 分别为 `ping`、`pong`。pong 必须通过 `requestId` 指向 ping 的 `id`；不得把 pong 包装为普通 response。

## 8. 错误

错误响应应保持与请求相同的 `op` 和正确的 `requestId`，顶层 `success` 为 `false`、顶层 `error` 为可读说明，稳定错误码放在 `data.code`。认证阶段对“服务器不存在”“令牌错误”“令牌哈希缺失”等情况统一暴露 `AUTH_FAILED`。内部日志可以记录更具体原因，但不得记录原始 token。

当前稳定码包括 `AUTH_FAILED`、`BAD_REQUEST`、`UNSUPPORTED_OPERATION`、`OPERATION_FAILED`、`SERVER_UNAVAILABLE`、`PERMISSION_DENIED`、`RATE_LIMITED` 和 `INTERNAL_ERROR`。实现可补充同样采用大写下划线格式的具体码（例如 `SERVER_NOT_FOUND`），但未知操作必须使用 `UNSUPPORTED_OPERATION`，失败响应不得缺少 `data.code`。

## 9. 能力声明

capabilities 使用功能组名称，当前规范词表为：

- `player_management`
- `command_execution`
- `performance_monitoring`
- `event_streaming`
- `whitelist_management`
- `ban_management`
- `operator_management`
- `world_management`
- `plugin_integration`
- `server_control`

静态 token 路径在 `X-Capabilities` 中声明，challenge 路径在 `system/handshake.data.capabilities` 中声明；认证后也可以用 `system/capabilities` 更新。Koishi 会去重、映射少量旧名称并丢弃未知值，然后以“Connector 已认证声明 ∩ 本地 Bridge 实现”决定可执行能力。协议连接没有声明某能力时，管理端不得按核心类型自行补齐。

功能组不代表组内每个具体操作都必然可用。例如 PMMP 的 `server_control` 支持关停，但 `server.restart` 仍返回 `UNSUPPORTED_OPERATION`，因为重启需要外部进程管理器。Connector 对不支持的具体操作必须明确失败，不能返回伪造成功结果。
