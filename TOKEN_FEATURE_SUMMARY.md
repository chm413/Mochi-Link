# Token 功能完整总结

## 功能概述

Mochi-Link 使用 `api_tokens` 表管理服务器连接认证令牌，确保 WebSocket 连接的安全性。

## 数据库结构

### api_tokens 表

```sql
CREATE TABLE mochi_api_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL,      -- 服务器 ID
  token VARCHAR(128) NOT NULL UNIQUE,  -- 认证令牌（64字节十六进制）
  token_hash VARCHAR(256) NOT NULL,    -- 令牌哈希（SHA-256）
  ip_whitelist TEXT,                   -- IP 白名单（JSON 数组）
  encryption_config TEXT,              -- 加密配置（JSON）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,                -- 过期时间（可选）
  last_used TIMESTAMP,                 -- 最后使用时间
  FOREIGN KEY (server_id) REFERENCES mochi_servers(id) ON DELETE CASCADE,
  INDEX idx_server (server_id),
  INDEX idx_token_hash (token_hash)
);
```

## Token 生命周期

### 1. Token 生成（自动）

**触发时机**:
- 执行 `mochi.server.add` 命令时
- 执行 `mochi.server.register` 命令时
- 首次执行 `mochi.server.token <id>` 时（如果不存在）

**生成方式**:
```typescript
const token = crypto.randomBytes(32).toString('hex');  // 64 字符十六进制
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
await dbManager.createAPIToken(serverId, token, tokenHash);
```

**权限要求**: 等级 3（管理员）

### 2. Token 查看

**命令**: `mochi.server.token <id>`

**功能**:
- 显示服务器的所有 token
- 显示 token 详细信息（创建时间、过期时间、最后使用、IP 白名单）
- 提供 WebSocket 连接配置示例

**权限要求**: 等级 3（管理员）

**输出示例**:
```
🔐 服务器连接令牌:
  服务器: 生存服务器 (survival)

令牌 #1:
  ID: 1
  令牌: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
  创建时间: 2024-02-24 18:00:00
  最后使用: 2024-02-24 18:30:00

📝 连接配置:
  URL: ws://your-host:8080/ws?serverId=survival&token=a1b2c3d4...

💡 提示: 使用 -r 选项可以重新生成令牌
```

### 3. Token 重新生成

**命令**: `mochi.server.token <id> -r`

**功能**:
- 删除服务器的所有旧 token
- 生成新的 token
- 记录审计日志

**权限要求**: 等级 3（管理员）

**注意事项**:
- 旧 token 立即失效
- 需要立即更新连接器配置
- 已建立的连接会断开

### 4. Token 验证（自动）

**触发时机**: WebSocket 连接建立时

**验证流程**:
```
1. 连接器发起 WebSocket 连接
   URL: ws://host:port/ws?serverId=xxx&token=yyy
   或使用 HTTP 头部: X-Server-ID, X-Auth-Token

2. WebSocket 服务器提取 serverId 和 token
   位置: src/websocket/server.ts -> handleNewConnection()

3. 调用认证管理器验证
   位置: src/websocket/auth.ts -> authenticateWithToken()

4. Token 管理器查询数据库
   位置: src/websocket/token-manager.ts -> validateToken()
   查询: SELECT * FROM mochi_api_tokens WHERE server_id = ? AND token = ?

5. 验证检查:
   - Token 是否存在
   - Token 是否过期（如果设置了 expires_at）
   - IP 是否在白名单内（如果设置了 ip_whitelist）

6. 验证成功:
   - 更新 last_used 时间
   - 标记连接为已认证
   - 触发 'authenticated' 事件

7. 验证失败:
   - 关闭 WebSocket 连接
   - 返回错误信息
   - 记录失败日志
```

## 命令权限等级

| 命令 | 权限等级 | 说明 |
|------|---------|------|
| `mochi.server.list` | 1（所有用户） | 查看服务器列表 |
| `mochi.server.info <id>` | 1（所有用户） | 查看服务器信息 |
| `mochi.server.add` | 3（管理员） | 添加服务器（自动生成 token） |
| `mochi.server.register` | 3（管理员） | 注册服务器（自动生成 token） |
| `mochi.server.token <id>` | 3（管理员） | 查看服务器 token |
| `mochi.server.token <id> -r` | 3（管理员） | 重新生成 token |
| `mochi.server.remove <id>` | 4（超级管理员） | 删除服务器（级联删除 token） |

## 代码位置

### 核心文件

1. **数据库管理** (`src/database/simple-init.ts`)
   - `createAPIToken()` - 创建 token
   - `getAPITokens()` - 查询服务器的所有 token
   - `deleteAPIToken()` - 删除单个 token
   - `deleteServerAPITokens()` - 删除服务器的所有 token

2. **Token 管理器** (`src/websocket/token-manager.ts`)
   - `validateToken()` - 验证 token
   - `getTokenByHash()` - 通过哈希查询 token
   - `updateTokenLastUsed()` - 更新最后使用时间
   - `isTokenExpired()` - 检查是否过期
   - `checkIPWhitelist()` - 检查 IP 白名单

3. **认证管理器** (`src/websocket/auth.ts`)
   - `authenticateWithToken()` - 使用 token 认证
   - `validateAuthenticationResponse()` - 验证挑战-响应认证

4. **WebSocket 服务器** (`src/websocket/server.ts`)
   - `handleNewConnection()` - 处理新连接，提取和验证 token

5. **命令实现** (`src/index.ts`)
   - `mochi.server.add` - 创建服务器并生成 token
   - `mochi.server.register` - 注册服务器并生成 token
   - `mochi.server.token` - 查看/重新生成 token

## Token 功能无重叠确认

### 已移除的冗余功能

1. ~~`mochi_servers.auth_token` 字段~~ - 已删除
   - 原因：使用专门的 `api_tokens` 表管理
   - 好处：支持多 token、过期时间、IP 白名单等高级功能

### 功能分离

1. **Token 生成**: 仅在服务器创建/注册时自动生成
2. **Token 查看**: 仅通过 `mochi.server.token` 命令
3. **Token 重新生成**: 仅通过 `mochi.server.token -r` 命令
4. **Token 验证**: 仅在 WebSocket 连接时自动执行
5. **Token 删除**: 仅在服务器删除时级联删除

### 无重叠验证

- ✅ 没有多个地方生成 token
- ✅ 没有多个地方存储 token
- ✅ 没有多个地方验证 token
- ✅ 没有冗余的 token 字段
- ✅ 所有 token 操作都有审计日志

## 安全特性

### 1. Token 生成安全

- 使用 `crypto.randomBytes(32)` 生成 256 位随机数
- 转换为 64 字符十六进制字符串
- 存储 SHA-256 哈希值用于索引

### 2. Token 传输安全

- 支持 URL 参数传输（适合简单场景）
- 支持 HTTP 头部传输（更安全）
- 建议生产环境使用 WSS（WebSocket over TLS）

### 3. Token 验证安全

- 验证 serverId 和 token 的匹配
- 支持 token 过期检查
- 支持 IP 白名单限制
- 记录最后使用时间

### 4. Token 管理安全

- 需要管理员权限（等级 3）才能查看/管理 token
- 重新生成 token 会记录审计日志
- 删除服务器会级联删除所有 token

## 使用流程

### 管理员操作流程

```bash
# 1. 注册服务器（自动生成 token）
mochi.server.register survival 生存服 --host 127.0.0.1 -p 25565 -t java -c paper

# 输出包含 token:
# 🔐 连接令牌:
#   a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# 2. 查看 token（如果忘记了）
mochi.server.token survival

# 3. 重新生成 token（如果泄露）
mochi.server.token survival -r

# 4. 查看服务器列表
mochi.server.list

# 5. 删除服务器（需要超级管理员）
mochi.server.remove survival
```

### 连接器配置流程

```yaml
# Paper/Spigot/Folia: plugins/MochiLink/config.yml
connection:
  websocket:
    url: "ws://koishi-host:8080/ws"
    serverId: "survival"
    token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

```json
// Fabric: config/mochi-link.json
{
  "connection": {
    "websocket": {
      "url": "ws://koishi-host:8080/ws",
      "serverId": "survival",
      "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
    }
  }
}
```

## 故障排查

### 问题 1: Token 验证失败

**症状**: 连接器无法连接，提示 "Authentication failed"

**排查步骤**:
1. 使用 `mochi.server.token <id>` 查看正确的 token
2. 检查连接器配置中的 token 是否完整（64 字符）
3. 检查 serverId 是否匹配
4. 查看 Koishi 日志中的详细错误信息

### 问题 2: Token 不存在

**症状**: 执行 `mochi.server.token <id>` 提示 token 不存在

**原因**: 服务器是在旧版本创建的，没有自动生成 token

**解决**: 命令会自动生成 token，直接使用即可

### 问题 3: 旧连接未断开

**症状**: 重新生成 token 后，旧连接仍然活跃

**原因**: WebSocket 连接已建立，不会主动检查 token

**解决**: 
1. 重启连接器
2. 或等待心跳超时自动断开
3. 或使用 `mochi.server.disconnect <id>` 强制断开（如果实现了）

## 后续扩展

可以添加的功能：

1. **Token 过期管理**
   - 添加 `--expires` 选项设置过期时间
   - 自动清理过期 token
   - 过期前提醒

2. **IP 白名单**
   - 添加 `--ip-whitelist` 选项
   - 支持 CIDR 格式
   - 动态更新白名单

3. **Token 权限**
   - 不同 token 有不同权限
   - 只读 token vs 完全控制 token
   - 临时 token

4. **Token 统计**
   - 查看 token 使用频率
   - 检测异常使用
   - 生成使用报告

5. **多 Token 支持**
   - 每个服务器支持多个 token
   - 不同 token 用于不同用途
   - Token 标签和描述

## 相关文档

- `CONNECTOR_TOKEN_AUTH.md` - 连接器配置详细指南
- `TOKEN_AUTH_IMPLEMENTATION.md` - 技术实现细节
- `src/websocket/auth.ts` - 认证管理器源码
- `src/websocket/token-manager.ts` - Token 管理器源码
