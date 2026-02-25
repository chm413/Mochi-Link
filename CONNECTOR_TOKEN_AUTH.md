# 连接器 Token 认证配置指南

## 概述

Mochi-Link 使用 token 认证机制来保护 WebSocket 连接的安全性。每个服务器都有一个唯一的认证令牌，连接器在建立 WebSocket 连接时需要提供此令牌。

## 获取服务器 Token

使用以下命令查看或生成服务器的认证令牌：

```bash
# 查看现有令牌（如果不存在会自动生成）
mochi.server.token <server_id>

# 重新生成令牌
mochi.server.token <server_id> -r
```

示例：
```bash
mochi.server.token survival
```

输出：
```
🔐 服务器连接令牌:
  服务器: 生存服务器 (survival)
  令牌: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

📝 使用说明:
  1. 在连接器配置文件中设置此令牌
  2. 令牌用于服务器连接认证
  3. 请妥善保管，不要泄露

💡 提示: 使用 -r 选项可以重新生成令牌
```

## 连接器配置

### 方式 1: URL 参数（推荐）

在 WebSocket 连接 URL 中添加 token 参数：

```
ws://koishi-host:8080/ws?serverId=survival&token=YOUR_TOKEN_HERE
```

### 方式 2: HTTP 头部

在 WebSocket 握手请求中添加自定义头部：

```
X-Server-ID: survival
X-Auth-Token: YOUR_TOKEN_HERE
```

## 各核心连接器配置示例

### Paper/Spigot/Folia (Java 版)

编辑 `plugins/MochiLink/config.yml`：

```yaml
connection:
  mode: reverse
  websocket:
    url: "ws://koishi-host:8080/ws"
    serverId: "survival"
    token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

### Fabric (Java 版)

编辑 `config/mochi-link.json`：

```json
{
  "connection": {
    "mode": "reverse",
    "websocket": {
      "url": "ws://koishi-host:8080/ws",
      "serverId": "survival",
      "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
    }
  }
}
```

### LLBDS (基岩版)

编辑 `plugins/MochiLink/config.json`：

```json
{
  "connection": {
    "mode": "reverse",
    "websocket": {
      "url": "ws://koishi-host:8080/ws",
      "serverId": "bedrock-survival",
      "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
    }
  }
}
```

### PMMP (基岩版)

编辑 `plugin_data/MochiLink/config.yml`：

```yaml
connection:
  mode: reverse
  websocket:
    url: "ws://koishi-host:8080/ws"
    serverId: "bedrock-survival"
    token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

## 认证流程

### 简单 Token 认证（推荐）

1. 连接器在 WebSocket 连接 URL 或头部中提供 `serverId` 和 `token`
2. Koishi 插件验证 token 是否与数据库中存储的匹配
3. 验证成功后建立连接，失败则关闭连接

### 挑战-响应认证（高级）

1. 连接器建立 WebSocket 连接
2. Koishi 插件发送认证挑战（challenge）
3. 连接器使用 token 计算挑战响应
4. Koishi 插件验证响应是否正确
5. 验证成功后建立连接

## 安全建议

1. **保护 Token 安全**
   - 不要在公开的地方分享 token
   - 不要将 token 提交到版本控制系统
   - 定期更换 token（使用 `-r` 选项）

2. **使用 SSL/TLS**
   - 在生产环境中使用 `wss://` 而不是 `ws://`
   - 配置 SSL 证书保护传输安全

3. **网络隔离**
   - 如果可能，将 Koishi 和 Minecraft 服务器部署在同一内网
   - 使用防火墙限制 WebSocket 端口的访问

4. **监控异常**
   - 定期检查审计日志
   - 监控未授权的连接尝试

## 故障排查

### 连接被拒绝

错误信息：`Authentication failed` 或 `Invalid token`

解决方法：
1. 确认 token 是否正确复制（注意空格和换行）
2. 使用 `mochi.server.token <id>` 重新查看 token
3. 如果 token 已更改，使用 `-r` 重新生成

### 服务器已连接

错误信息：`Server already connected`

解决方法：
1. 检查是否有其他连接器实例正在运行
2. 等待旧连接超时（约 30 秒）
3. 在 Koishi 端使用 `mochi.server.disconnect <id>` 强制断开

### Token 不存在

错误信息：`unknown field "auth_token"`

解决方法：
1. 这是数据库字段问题，需要重启 Koishi 插件
2. 如果问题持续，可能需要重建数据库表
3. 联系管理员检查插件版本

## 相关命令

- `mochi.server.token <id>` - 查看服务器 token
- `mochi.server.token <id> -r` - 重新生成 token
- `mochi.server.list` - 列出所有服务器
- `mochi.audit` - 查看审计日志（包括认证失败记录）

## 技术细节

### Token 格式

- 长度：64 个十六进制字符（32 字节）
- 生成方式：`crypto.randomBytes(32).toString('hex')`
- 存储位置：数据库 `mochi_servers` 表的 `auth_token` 字段

### 验证逻辑

```typescript
// 简单验证
if (server.auth_token === providedToken) {
  // 认证成功
}

// 挑战-响应验证
const expectedResponse = HMAC-SHA256(challenge + token + timestamp, token);
if (providedResponse === expectedResponse) {
  // 认证成功
}
```

### WebSocket 连接参数

| 参数 | 位置 | 必需 | 说明 |
|------|------|------|------|
| `serverId` | URL 参数或头部 | 是 | 服务器唯一标识符 |
| `token` | URL 参数或头部 | 是 | 认证令牌 |

URL 参数示例：
```
ws://host:port/ws?serverId=survival&token=abc123...
```

HTTP 头部示例：
```
X-Server-ID: survival
X-Auth-Token: abc123...
```
