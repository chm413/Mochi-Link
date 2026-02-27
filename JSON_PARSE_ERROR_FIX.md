# JSON解析错误修复说明

## 问题描述

在性能优化服务中出现了JSON解析错误：

```
SyntaxError: Unexpected end of JSON input
at JSON.parse (<anonymous>)
at dbServerToModel (/koishi/node_modules/koishi-plugin-mochi-link/lib/database/models.js:160:24)
```

## 根本原因

数据库中的某些文本字段（用于存储JSON数据）可能包含：
- 空字符串 `""`
- `null` 值
- 格式不正确的JSON字符串

当这些字段被 `JSON.parse()` 解析时，会抛出 "Unexpected end of JSON input" 错误。

## 修复内容

### 1. 增强的JSON解析（`src/database/models.ts`）

为所有数据库模型转换函数添加了安全的JSON解析逻辑：

#### `dbServerToModel` 函数
- 安全解析 `connection_config` 字段
- 安全解析 `tags` 字段
- 空字符串返回默认值（`{}` 或 `[]`）
- 解析失败时记录错误并返回默认值

#### `dbACLToModel` 函数
- 安全解析 `permissions` 字段

#### `dbAuditToModel` 函数
- 安全解析 `operation_data` 字段

### 2. Token和Operation模型（`src/database/operations.ts`）

#### `dbTokenToModel` 函数
- 安全解析 `ip_whitelist` 字段
- 安全解析 `encryption_config` 字段

#### `dbOperationToModel` 函数
- 安全解析 `parameters` 字段

### 3. 数据库修复工具（`src/database/fix-invalid-json.ts`）

创建了一个新的修复工具，用于清理数据库中的无效JSON数据：

- 扫描所有表中的JSON字段
- 将空字符串替换为有效的JSON（`{}` 或 `[]`）
- 修复格式不正确的JSON字符串
- 记录所有修复操作

### 4. 自动修复集成（`src/database/init.ts`）

在数据库初始化过程中自动运行修复：

```typescript
// Step 4: Fix invalid JSON fields in existing data
await this.fixInvalidJsonData();
```

## 安全解析模式

所有JSON字段现在使用以下安全模式：

```typescript
let parsedValue: any = defaultValue;
if (dbField) {
  if (typeof dbField === 'string') {
    try {
      // 只解析非空字符串
      if (dbField.trim()) {
        parsedValue = JSON.parse(dbField);
      }
    } catch (error) {
      console.error(`Failed to parse field:`, error);
      console.error(`Raw value: "${dbField}"`);
      parsedValue = defaultValue;
    }
  } else {
    parsedValue = dbField;
  }
}
```

## 影响的表和字段

| 表名 | 字段 | 默认值 | 修复位置 |
|------|------|--------|----------|
| `minecraft_servers` | `connection_config` | `{}` | `models.ts`, `fix-invalid-json.ts` |
| `minecraft_servers` | `tags` | `[]` | `models.ts`, `fix-invalid-json.ts` |
| `server_acl` | `permissions` | `[]` | `models.ts`, `fix-invalid-json.ts` |
| `api_tokens` | `ip_whitelist` | `null` | `operations.ts`, `token-manager.ts`, `fix-invalid-json.ts` |
| `api_tokens` | `encryption_config` | `null` | `operations.ts`, `token-manager.ts`, `fix-invalid-json.ts` |
| `audit_logs` | `operation_data` | `{}` | `models.ts`, `fix-invalid-json.ts` |
| `pending_operations` | `parameters` | `{}` | `operations.ts`, `whitelist.ts`, `fix-invalid-json.ts` |
| `server_bindings` | `config` | `{}` | `binding.ts` |

## Folia客户端消息格式

根据Java连接器代码（`UWBPv2Protocol.java`），认证消息格式为：

```json
{
  "type": "auth",
  "version": "2.0",
  "timestamp": 1234567890,
  "data": {
    "token": "server-token",
    "server_id": "server-id",
    "server_type": "minecraft_java",
    "plugin_version": "1.0.0",
    "minecraft_version": "1.20.1",
    "online_players": 0,
    "max_players": 20
  }
}
```

心跳消息格式：

```json
{
  "type": "heartbeat",
  "version": "2.0",
  "timestamp": 1234567890,
  "data": {
    "online_players": 5,
    "tps": 20.0,
    "memory_used": 1024000000,
    "memory_max": 2048000000
  }
}
```

## 测试建议

1. 重启Koishi服务，观察日志中的修复信息
2. 检查是否还有JSON解析错误
3. 验证Folia服务器连接和认证是否正常
4. 确认性能监控数据是否正确显示

## 预防措施

1. 所有新的JSON字段写入都应该确保写入有效的JSON字符串
2. 使用 `JSON.stringify()` 时确保输入不是 `undefined`
3. 数据库写入前验证JSON格式
4. 定期运行数据库维护脚本

## 部署步骤

1. 编译代码：`npm run build`
2. 重启Koishi服务
3. 观察日志中的修复信息
4. 验证所有功能正常

## 回滚方案

如果出现问题，可以：
1. 恢复到之前的版本
2. 数据库数据不会丢失（只是JSON字段被规范化）
3. 手动检查和修复特定的服务器配置

## 相关文件

- `src/database/models.ts` - 模型转换函数（服务器、ACL、审计日志）
- `src/database/operations.ts` - 数据库操作（Token、待处理操作）
- `src/database/fix-invalid-json.ts` - JSON修复工具
- `src/database/init.ts` - 数据库初始化（集成自动修复）
- `src/websocket/token-manager.ts` - WebSocket Token管理
- `src/services/binding.ts` - 服务器绑定服务
- `src/services/whitelist.ts` - 白名单和封禁服务
- `connectors/java/src/main/java/com/mochilink/connector/protocol/UWBPv2Protocol.java` - 协议定义

## 修复的文件总结

共修复了 **7个文件** 中的JSON解析问题：

1. `src/database/models.ts` - 3个函数
2. `src/database/operations.ts` - 2个函数
3. `src/database/fix-invalid-json.ts` - 新建修复工具
4. `src/database/init.ts` - 集成自动修复
5. `src/websocket/token-manager.ts` - 2个函数
6. `src/services/binding.ts` - 2个函数
7. `src/services/whitelist.ts` - 3个函数
