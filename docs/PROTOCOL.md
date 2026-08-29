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
| `serverId` | string | 已绑定服务器消息应提供 |

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
- `player.list`、`player.getInfo`、`player.kick`、`player.ban`
- `whitelist.get`、`whitelist.add`、`whitelist.remove`
- `command.execute`
- `permission.grant`、`permission.revoke`、`permission.query`
- `world.list`、`world.setTime`、`world.setWeather`

`server.command` 是历史别名。兼容层可以接收它，但内部路由和新 Connector 必须使用 `command.execute`。

事件操作示例：`player.join`、`player.leave`、`player.chat`、`server.status`、`server.metrics`。系统操作示例：`ping`、`pong`、`handshake`、`capabilities`、`disconnect`、`error`。

## 5. 认证顺序

当前可落地的最小流程：

1. WebSocket 建立。
2. Connector 提交 `serverId` 和一次性配置的 token。
3. Koishi 对 token 做 SHA-256 后与数据库哈希进行恒定时间比较，并检查过期时间和 IP 策略。
4. 认证成功后连接绑定到 `serverId`。
5. Connector 再发送 capabilities；认证前能力声明一律忽略。
6. 双方开始心跳和业务消息。

认证证明不提供传输机密性。真实网络应在 WSS/TLS 中传输，不能依赖 Base64、XOR 或已废弃的 Node cipher API。

## 6. 错误

错误响应应保持与请求相同的 `op` 和正确的 `requestId`，并提供稳定错误码。认证阶段对“服务器不存在”“令牌错误”“令牌哈希缺失”等情况统一暴露 `AUTH_FAILED`。内部日志可以记录更具体原因，但不得记录原始 token。

## 7. 能力声明

capabilities 表示当前 Connector 在当前核心版本上实际支持的操作。管理端应以声明和本地策略的交集决定可执行能力。未声明的操作必须明确失败，不能返回伪造成功结果。
