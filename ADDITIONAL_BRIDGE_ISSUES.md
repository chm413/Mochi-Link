# 额外的Bridge访问问题

## 发现的问题

### 1. WhitelistManager.getBridge() 返回null

**位置**: `src/services/whitelist.ts:1070`

```typescript
private async getBridge(serverId: string): Promise<any> {
    // This would integrate with the connection manager to get the bridge
    // For now, return null to indicate no bridge available
    return null;
}
```

**影响**:
- 所有白名单同步功能无法工作
- `syncFromServer()` 无法获取服务器数据
- `syncToServer()` 无法推送更改
- 封禁系统同样受影响

**调用位置**:
- Line 594: `syncToServer()` - 同步到服务器
- Line 674: `syncBansToServer()` - 同步封禁到服务器
- Line 745: `syncFromServer()` - 从服务器同步
- Line 785: `syncBansFromServer()` - 从服务器同步封禁
- Line 994: `addToWhitelist()` - 添加到白名单
- Line 1060: `isServerOnline()` - 检查服务器在线状态

### 2. PlayerInformationService.getBridge() 返回null

**位置**: `src/services/player.ts:452`

```typescript
private getBridge(serverId: string): any {
    // This would integrate with the connection manager to get the bridge
    // For now, return a mock
    return null;
}
```

**影响**:
- 无法从服务器获取玩家信息
- `getPlayerInfo()` 只能返回缓存数据
- `getOnlinePlayers()` 无法获取实时在线玩家

**调用位置**:
- Line 84: `getPlayerInfo()` - 获取玩家信息
- Line 112: `getOnlinePlayers()` - 获取在线玩家列表

## 根本原因

这些服务在构造时没有接收ServerManager或getBridge函数引用：

```typescript
// src/services/index.ts:212
this.player = new PlayerInformationService(ctx);
this.whitelist = new WhitelistManager(ctx);
```

而CommandExecutionService正确接收了getBridge函数：

```typescript
// src/services/index.ts:216
this.command = new CommandExecutionService(
    ctx,
    this.audit,
    this.permission,
    (serverId: string) => this.server.getBridge(serverId)
);
```

## 修复方案

### 方案1: 传递getBridge函数（推荐）

#### 1.1 更新WhitelistManager构造函数

```typescript
// src/services/whitelist.ts
export class WhitelistManager {
  private ctx: Context;
  private getBridgeFn: (serverId: string) => any;
  // ... 其他属性

  constructor(
    ctx: Context,
    getBridge: (serverId: string) => any
  ) {
    this.ctx = ctx;
    this.getBridgeFn = getBridge;
    this.initializeService();
  }

  private async getBridge(serverId: string): Promise<any> {
    return this.getBridgeFn(serverId);
  }
}
```

#### 1.2 更新PlayerInformationService构造函数

```typescript
// src/services/player.ts
export class PlayerInformationService {
  private ctx: Context;
  private getBridgeFn: (serverId: string) => any;
  // ... 其他属性

  constructor(
    ctx: Context,
    getBridge: (serverId: string) => any
  ) {
    this.ctx = ctx;
    this.getBridgeFn = getBridge;
    this.initializeService();
  }

  private getBridge(serverId: string): any {
    return this.getBridgeFn(serverId);
  }
}
```

#### 1.3 更新ServiceManager初始化

```typescript
// src/services/index.ts
constructor(private ctx: Context) {
    this.db = new DatabaseManager(ctx);
    this.audit = new AuditService(ctx);
    this.permission = new PermissionManager(ctx);
    this.token = new TokenManager(ctx);
    this.pluginIntegration = new PluginIntegrationService();
    this.server = new ServerManager(ctx, this.db, this.audit, this.permission, this.token, this.pluginIntegration);
    
    // 传递getBridge函数
    this.player = new PlayerInformationService(
        ctx,
        (serverId: string) => this.server.getBridge(serverId)
    );
    this.whitelist = new WhitelistManager(
        ctx,
        (serverId: string) => this.server.getBridge(serverId)
    );
    
    this.command = new CommandExecutionService(
        ctx,
        this.audit,
        this.permission,
        (serverId: string) => this.server.getBridge(serverId)
    );
    // ... 其他服务
}
```

### 方案2: 传递ServerManager引用

```typescript
// 更简单但耦合度更高
this.player = new PlayerInformationService(ctx, this.server);
this.whitelist = new WhitelistManager(ctx, this.server);
```

## 影响范围

### 当前无法工作的功能

#### WhitelistManager
- ❌ 白名单同步到服务器
- ❌ 从服务器同步白名单
- ❌ 封禁列表同步
- ❌ 实时添加/删除白名单
- ❌ 服务器在线状态检查

#### PlayerInformationService
- ❌ 从服务器获取玩家信息
- ❌ 获取在线玩家列表
- ⚠️ 只能使用缓存数据（可能过期）

#### CommandExecutionService
- ✅ 已修复（通过getBridge函数）

## 测试计划

### 1. 白名单功能测试

```bash
# 添加玩家到白名单
/mochi whitelist add test Player123

# 从白名单移除
/mochi whitelist remove test Player123

# 查看白名单
/mochi whitelist list test

# 同步白名单
/mochi whitelist sync test
```

### 2. 玩家信息测试

```bash
# 获取玩家信息
/mochi player info test Player123

# 获取在线玩家
/mochi player list test
```

### 3. 封禁功能测试

```bash
# 封禁玩家
/mochi ban test Player123 "违规行为"

# 解封玩家
/mochi unban test Player123

# 查看封禁列表
/mochi ban list test
```

## 实施优先级

1. **高优先级**: 修复WhitelistManager.getBridge()
   - 白名单是核心功能
   - 影响服务器管理

2. **高优先级**: 修复PlayerInformationService.getBridge()
   - 玩家信息查询是常用功能
   - 影响用户体验

3. **中优先级**: 添加错误处理和降级策略
   - 当Bridge不可用时使用缓存
   - 提供友好的错误提示

## 降级策略

在Bridge不可用时：

```typescript
private async getBridge(serverId: string): Promise<any> {
    const bridge = this.getBridgeFn(serverId);
    if (!bridge) {
        this.ctx.logger('mochi-link:whitelist').warn(
            `Bridge not available for server ${serverId}, using cached data`
        );
    }
    return bridge;
}
```

## 相关文件

- `src/services/whitelist.ts` - 白名单管理服务
- `src/services/player.ts` - 玩家信息服务
- `src/services/index.ts` - 服务管理器
- `src/services/command.ts` - 命令执行服务（已修复，可作为参考）

## 预期结果

修复后：
1. 白名单同步功能正常工作
2. 玩家信息可以从服务器实时获取
3. 封禁系统可以正常同步
4. 所有功能都能访问到WebSocket Bridge

## 下一步

1. 实施方案1（传递getBridge函数）
2. 更新所有受影响的服务
3. 添加单元测试验证Bridge访问
4. 测试所有白名单和玩家信息功能
5. 更新文档说明修复内容
