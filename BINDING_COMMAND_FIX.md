# 群组绑定后命令自动识别服务器ID修复

## 问题描述

部分命令已经支持从群组绑定自动获取服务器ID，但还有一些命令没有实现这个功能。

## 当前状态

### ✅ 已支持自动识别的命令

1. **mochi.whitelist.list [serverId]**
   - 可选参数serverId
   - 未提供时从群组绑定获取

2. **mochi.whitelist.add [serverId] <player>**
   - 可选参数serverId
   - 未提供时从群组绑定获取

3. **mochi.player.list [serverId]**
   - 可选参数serverId
   - 未提供时从群组绑定获取

### ❌ 未支持自动识别的命令

1. **mochi.exec <serverId> <command...>**
   - serverId是必需参数
   - 应该改为可选参数

2. **mochi.whitelist.remove <serverId> <player>**
   - serverId是必需参数
   - 应该改为可选参数

3. **mochi.player.info <serverId> <player>**
   - serverId是必需参数
   - 应该改为可选参数

4. **mochi.player.kick <serverId> <player> [reason]**
   - serverId是必需参数
   - 应该改为可选参数

5. **mochi.server.info <id>**
   - id是必需参数
   - 应该改为可选参数

## getServerId函数

已实现的辅助函数：

```typescript
async function getServerId(session: any, providedId?: string): Promise<string | null> {
    if (providedId) {
        return providedId;
    }
    
    // Try to get from group binding
    if (session?.guildId && dbManager) {
        const serverId = await dbManager.getGroupPrimaryServer(session.guildId);
        return serverId;
    }
    
    return null;
}
```

## 修复方案

### 1. mochi.exec 命令

**修改前**:
```typescript
ctx.command('mochi.exec <serverId> <command...>', '执行服务器命令')
  .action(async ({ session, options }, serverId, ...commandParts) => {
    if (!serverId || !commandParts || commandParts.length === 0) {
      return '用法: mochi.exec <serverId> <command...>';
    }
    // ...
  });
```

**修改后**:
```typescript
ctx.command('mochi.exec [serverId] <command...>', '执行服务器命令')
  .action(async ({ session, options }, serverIdOrCommand, ...commandParts) => {
    let targetServerId: string | null;
    let command: string;
    
    // 判断第一个参数是serverId还是command
    if (commandParts.length === 0) {
      // 只有一个参数，从群组绑定获取serverId
      targetServerId = await getServerId(session);
      command = serverIdOrCommand;
    } else {
      // 有多个参数，第一个是serverId
      targetServerId = await getServerId(session, serverIdOrCommand);
      command = commandParts.join(' ');
    }
    
    if (!targetServerId) {
      return '请指定服务器 ID 或在群组中绑定服务器';
    }
    // ...
  });
```

### 2. mochi.whitelist.remove 命令

**修改前**:
```typescript
ctx.command('mochi.whitelist.remove <serverId> <player>', '移除白名单')
  .action(async ({ session }, serverId, player) => {
    // ...
  });
```

**修改后**:
```typescript
ctx.command('mochi.whitelist.remove [serverId] <player>', '移除白名单')
  .action(async ({ session }, serverIdOrPlayer, player) => {
    let targetServerId: string | null;
    let targetPlayer: string;
    
    if (!player) {
      // 只有一个参数，从群组绑定获取serverId
      targetServerId = await getServerId(session);
      targetPlayer = serverIdOrPlayer;
    } else {
      // 有两个参数
      targetServerId = await getServerId(session, serverIdOrPlayer);
      targetPlayer = player;
    }
    
    if (!targetServerId) {
      return '请指定服务器 ID 或在群组中绑定服务器';
    }
    // ...
  });
```

### 3. mochi.player.info 命令

**修改前**:
```typescript
ctx.command('mochi.player.info <serverId> <player>', '查看玩家信息')
  .action(async ({ session }, serverId, player) => {
    // ...
  });
```

**修改后**:
```typescript
ctx.command('mochi.player.info [serverId] <player>', '查看玩家信息')
  .action(async ({ session }, serverIdOrPlayer, player) => {
    let targetServerId: string | null;
    let targetPlayer: string;
    
    if (!player) {
      targetServerId = await getServerId(session);
      targetPlayer = serverIdOrPlayer;
    } else {
      targetServerId = await getServerId(session, serverIdOrPlayer);
      targetPlayer = player;
    }
    
    if (!targetServerId) {
      return '请指定服务器 ID 或在群组中绑定服务器';
    }
    // ...
  });
```

### 4. mochi.player.kick 命令

**修改前**:
```typescript
ctx.command('mochi.player.kick <serverId> <player> [reason]', '踢出玩家')
  .action(async ({ session }, serverId, player, reason) => {
    // ...
  });
```

**修改后**:
```typescript
ctx.command('mochi.player.kick [serverId] <player> [reason]', '踢出玩家')
  .action(async ({ session }, serverIdOrPlayer, playerOrReason, reason) => {
    let targetServerId: string | null;
    let targetPlayer: string;
    let kickReason: string | undefined;
    
    if (!playerOrReason) {
      // 只有一个参数
      targetServerId = await getServerId(session);
      targetPlayer = serverIdOrPlayer;
      kickReason = undefined;
    } else if (!reason) {
      // 两个参数，可能是 serverId+player 或 player+reason
      // 尝试从绑定获取serverId
      const boundServerId = await getServerId(session);
      if (boundServerId) {
        // 有绑定，第一个参数是player，第二个是reason
        targetServerId = boundServerId;
        targetPlayer = serverIdOrPlayer;
        kickReason = playerOrReason;
      } else {
        // 无绑定，第一个是serverId，第二个是player
        targetServerId = serverIdOrPlayer;
        targetPlayer = playerOrReason;
        kickReason = undefined;
      }
    } else {
      // 三个参数
      targetServerId = await getServerId(session, serverIdOrPlayer);
      targetPlayer = playerOrReason;
      kickReason = reason;
    }
    
    if (!targetServerId) {
      return '请指定服务器 ID 或在群组中绑定服务器';
    }
    // ...
  });
```

### 5. mochi.server.info 命令

**修改前**:
```typescript
ctx.command('mochi.server.info <id>', '查看服务器信息')
  .action(async ({ session }, id) => {
    // ...
  });
```

**修改后**:
```typescript
ctx.command('mochi.server.info [id]', '查看服务器信息')
  .action(async ({ session }, id) => {
    const targetServerId = await getServerId(session, id);
    
    if (!targetServerId) {
      return '请指定服务器 ID 或在群组中绑定服务器';
    }
    // ...
  });
```

## 使用示例

### 绑定前（需要指定serverId）

```bash
# 执行命令
/mochi exec survival list -a console

# 查看白名单
/mochi whitelist list survival

# 移除白名单
/mochi whitelist remove survival Player123

# 查看玩家信息
/mochi player info survival Player123

# 踢出玩家
/mochi player kick survival Player123 违规行为
```

### 绑定后（自动识别serverId）

```bash
# 先绑定服务器到群组
/mochi bind add survival

# 执行命令（省略serverId）
/mochi exec list -a console

# 查看白名单
/mochi whitelist list

# 移除白名单
/mochi whitelist remove Player123

# 查看玩家信息
/mochi player info Player123

# 踢出玩家
/mochi player kick Player123 违规行为

# 查看服务器信息
/mochi server info
```

### 绑定后仍可指定serverId（覆盖绑定）

```bash
# 即使绑定了survival，也可以操作其他服务器
/mochi exec creative say Hello -a console
/mochi whitelist list creative
```

## 优先级

1. **高优先级**: mochi.exec - 最常用的命令
2. **高优先级**: mochi.whitelist.remove - 白名单管理
3. **中优先级**: mochi.player.info - 玩家信息查询
4. **中优先级**: mochi.player.kick - 玩家管理
5. **低优先级**: mochi.server.info - 服务器信息查询

## 注意事项

1. **参数歧义处理**: 对于有多个可选参数的命令（如kick），需要智能判断参数含义
2. **错误提示**: 当无法获取serverId时，提示用户绑定或指定serverId
3. **向后兼容**: 修改后仍然支持显式指定serverId
4. **文档更新**: 需要更新命令帮助文档

## 测试计划

### 1. 无绑定测试
- 不指定serverId → 应提示错误
- 指定serverId → 应正常执行

### 2. 有绑定测试
- 不指定serverId → 使用绑定的serverId
- 指定serverId → 使用指定的serverId（覆盖绑定）

### 3. 多服务器测试
- 绑定server1
- 不指定serverId → 操作server1
- 指定server2 → 操作server2

## 相关文件

- `src/index.ts` - 命令定义
- `src/database/simple-init.ts` - getGroupPrimaryServer实现
- `src/services/binding.ts` - 绑定服务
