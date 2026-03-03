# Mochi-Link 权限管理快速参考

## 角色速查

| 角色 | 等级 | 专长 | 主要权限 |
|------|------|------|----------|
| **Owner** | 5 | 完全控制 | 所有权限 + 授权管理 |
| **Admin** | 4 | 全面管理 | 服务器 + 玩家 + 命令 |
| **SM** | 3 | 服务器运维 | 重启/停止/命令/日志 |
| **PM** | 3 | 玩家管理 | 踢出/封禁/白名单/消息 |
| **Moderator** | 2 | 基础管理 | 踢出/警告/查看 |
| **Viewer** | 1 | 只读 | 查看状态和信息 |

## 命令速查

### 基础命令
```bash
# 查看角色说明
mochi.op.roles

# 查询自己的权限
mochi.op.query

# 查询特定服务器权限
mochi.op.query "" server_001
```

### 权限管理（仅 Owner）
```bash
# 授予权限
mochi.op.grant <用户ID> <服务器ID> <角色>

# 授予带过期时间的权限
mochi.op.grant <用户ID> <服务器ID> <角色> -e 2024-12-31T23:59:59Z

# 撤销权限
mochi.op.revoke <用户ID> <服务器ID>

# 更新权限
mochi.op.update <用户ID> <服务器ID> <新角色>
```

### 权限查询（管理员）
```bash
# 列出服务器所有权限
mochi.op.list <服务器ID>

# 按角色过滤
mochi.op.list <服务器ID> pm
```

## 权限矩阵速查

| 操作 | Owner | Admin | SM | PM | Mod | Viewer |
|------|:-----:|:-----:|:--:|:--:|:---:|:------:|
| 授予权限 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 重启服务器 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| 执行命令 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| 封禁玩家 | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| 踢出玩家 | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| 管理白名单 | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| 查看信息 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 常用场景

### 招募玩家管理员
```bash
mochi.op.grant player_123 server_001 pm -r "新招募的玩家管理员"
```

### 招募服务器运维
```bash
mochi.op.grant admin_456 server_001 sm -r "负责服务器运维"
```

### 临时权限（30天）
```bash
mochi.op.grant temp_user server_001 moderator -e 2024-02-01T00:00:00Z -r "临时协管"
```

### 权限降级
```bash
mochi.op.update user_123 server_001 moderator -r "调整职责范围"
```

### 权限审计
```bash
# 查看所有权限
mochi.op.list server_001

# 查看特定角色
mochi.op.list server_001 pm
```

## WebSocket 操作速查

### 授予权限
```json
{
  "type": "request",
  "op": "permission.grant",
  "data": {
    "userId": "user_123",
    "serverId": "server_001",
    "role": "pm",
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

### 查询权限
```json
{
  "type": "request",
  "op": "permission.query",
  "data": {
    "userId": "user_123",
    "serverId": "server_001"
  }
}
```

### 封禁玩家
```json
{
  "type": "request",
  "op": "player.ban",
  "data": {
    "serverId": "server_001",
    "playerId": "uuid_player",
    "reason": "违反规则",
    "duration": 86400,
    "banType": "uuid"
  }
}
```

## 重要提示

⚠️ **只有 Owner 可以授予权限**
- Owner 角色由服务器创建者自动获得
- 不能通过命令授予 Owner 角色
- 不能修改 Owner 的权限

💡 **最小权限原则**
- 优先使用专业化角色（SM、PM）
- 只授予完成工作所需的最小权限

⏰ **使用临时权限**
- 对临时工作设置过期时间
- 定期审查和清理权限

📝 **记录授权原因**
- 使用 `-r` 选项记录原因
- 便于后续审计和管理

## 错误代码速查

| 错误码 | 说明 | 解决方法 |
|--------|------|----------|
| `PERMISSION_DENIED` | 权限不足 | 联系服务器所有者 |
| `ONLY_OWNER_CAN_GRANT` | 只有所有者可授权 | 联系服务器所有者 |
| `INVALID_ROLE` | 无效角色 | 使用 `mochi.op.roles` 查看 |
| `SERVER_NOT_FOUND` | 服务器不存在 | 检查服务器 ID |
| `PERMISSION_EXPIRED` | 权限已过期 | 重新申请权限 |

## 相关文档

- 📖 [完整命令指南](PERMISSION_COMMANDS_GUIDE.md)
- 📋 [实现报告](PERMISSION_SYSTEM_IMPLEMENTATION.md)
- 🌐 [API 文档](wiki/API接口文档.md)

---

**版本**: 2.0.0 | **更新**: 2024-01-01
