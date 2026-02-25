# Token 认证实现总结

## 问题描述

用户报告错误：`unknown field "auth_token" in model mochi_servers`

这是因为：
1. 数据库表已经存在，但没有 `auth_token` 字段
2. Koishi 的 Minato ORM 不会自动为已存在的表添加新字段
3. 需要将字段标记为可空（nullable）以支持现有数据

## 解决方案

### 1. 修复数据库字段定义

**文件**: `src/database/simple-init.ts`

将 `auth_token` 字段标记为可空：

```typescript
auth_token: { type: 'string', nullable: true },
```

这样：
- 新服务器可以没有 token（首次查看时自动生成）
- 现有服务器不会因为缺少字段而报错
- Minato 会自动添加这个字段到表结构

### 2. 实现 Token Manager

**文件**: `src/websocket/token-manager.ts`

创建了 `SimpleTokenManager` 类，实现 `TokenManager` 接口：

```typescript
export class SimpleTokenManager implements TokenManager {
  async validateToken(serverId: string, token: string): Promise<APIToken | null>
  async getTokenByHash(tokenHash: string): Promise<APIToken | null>
  async updateTokenLastUsed(tokenId: number): Promise<void>
  isTokenExpired(token: APIToken): boolean
  checkIPWhitelist(token: APIToken, clientIP: string): boolean
}
```

特点：
- 直接从数据库 `mochi_servers` 表验证 token
- 不使用单独的 token 表（简化模式）
- 不支持 token 过期和 IP 白名单（可后续扩展）

### 3. 实现 WebSocket Token 验证

**文件**: `src/websocket/server.ts`

修改 `handleNewConnection` 方法，支持两种认证方式：

#### 方式 1: URL 参数或 HTTP 头部（简单认证）

```typescript
// 从 URL 参数或头部提取 token
const token = url.searchParams.get('token') || 
             request.headers['x-auth-token'] as string;

// 如果提供了 token，立即验证
if (token) {
  const result = await this.authManager.authenticateWithToken(
    serverId,
    token,
    request.socket.remoteAddress
  );
  
  if (result.success) {
    // 认证成功
  } else {
    // 认证失败，关闭连接
    ws.close(1008, result.error || 'Authentication failed');
  }
}
```

#### 方式 2: 挑战-响应认证（高级）

如果没有提供 token，使用现有的挑战-响应机制：

```typescript
else {
  // 发送认证挑战
  await this.initiateAuthentication(connection);
}
```

## 使用方法

### 1. 查看或生成 Token

```bash
# 查看 token（不存在会自动生成）
mochi.server.token survival

# 重新生成 token
mochi.server.token survival -r
```

### 2. 配置连接器

在连接器配置中添加 token：

**Paper/Spigot/Folia** (`plugins/MochiLink/config.yml`):
```yaml
connection:
  websocket:
    url: "ws://koishi-host:8080/ws"
    serverId: "survival"
    token: "your-token-here"
```

**Fabric** (`config/mochi-link.json`):
```json
{
  "connection": {
    "websocket": {
      "url": "ws://koishi-host:8080/ws",
      "serverId": "survival",
      "token": "your-token-here"
    }
  }
}
```

### 3. WebSocket 连接

连接器可以通过以下方式提供 token：

**URL 参数**:
```
ws://koishi-host:8080/ws?serverId=survival&token=abc123...
```

**HTTP 头部**:
```
X-Server-ID: survival
X-Auth-Token: abc123...
```

## 认证流程

```
连接器                          Koishi 插件
  |                                |
  |-- WebSocket 连接 + token ----->|
  |                                |
  |                          验证 token
  |                          (查询数据库)
  |                                |
  |<---- 认证成功/失败 ------------|
  |                                |
  |-- 正常通信 ------------------>|
```

## 安全特性

1. **Token 生成**: 使用 `crypto.randomBytes(32)` 生成 64 位十六进制字符串
2. **Token 存储**: 存储在数据库 `mochi_servers.auth_token` 字段
3. **Token 验证**: 连接时验证 token 是否匹配
4. **审计日志**: 记录 token 生成和重新生成操作

## 后续扩展

可以添加的功能：

1. **Token 过期**: 添加 `token_expires_at` 字段
2. **IP 白名单**: 添加 `token_ip_whitelist` 字段
3. **Token 哈希**: 存储 token 的哈希值而不是明文
4. **多 Token 支持**: 为每个服务器支持多个 token
5. **Token 权限**: 不同 token 有不同的权限级别

## 文件清单

- `src/database/simple-init.ts` - 数据库字段定义（已修改）
- `src/websocket/token-manager.ts` - Token 管理器实现（新建）
- `src/websocket/server.ts` - WebSocket 服务器认证逻辑（已修改）
- `CONNECTOR_TOKEN_AUTH.md` - 连接器配置指南（新建）
- `TOKEN_AUTH_IMPLEMENTATION.md` - 实现总结（本文件）

## 测试步骤

1. 重启 Koishi 插件（让数据库字段生效）
2. 注册一个测试服务器：
   ```bash
   mochi.server.register test-server --host 127.0.0.1 -p 25565
   ```
3. 查看 token：
   ```bash
   mochi.server.token test-server
   ```
4. 配置连接器使用该 token
5. 启动连接器，验证连接成功

## 故障排查

### 问题 1: `unknown field "auth_token"`

**原因**: 数据库表结构未更新

**解决**: 重启 Koishi 插件，让 Minato 更新表结构

### 问题 2: 连接被拒绝

**原因**: Token 不匹配或格式错误

**解决**: 
1. 重新查看 token：`mochi.server.token <id>`
2. 确认 token 完整复制（无空格、换行）
3. 检查 serverId 是否正确

### 问题 3: 服务器已连接

**原因**: 已有连接存在

**解决**: 等待旧连接超时或使用 `mochi.server.disconnect <id>` 强制断开

## 相关文档

- `CONNECTOR_TOKEN_AUTH.md` - 详细的连接器配置指南
- `src/websocket/auth.ts` - 认证管理器接口定义
- `src/websocket/server.ts` - WebSocket 服务器实现
