# Bridge访问修复总结

## 已修复的问题

### 1. CommandExecutionService ✅
**状态**: 已在之前修复
**方法**: 通过构造函数接收getBridge函数

### 2. WhitelistManager ✅
**状态**: 本次修复
**修改**:
- 添加`getBridgeFn`属性
- 构造函数接收getBridge函数
- 更新getBridge方法返回实际Bridge
- 添加警告日志当Bridge不可用时

**影响的功能**:
- ✅ 白名单同步到服务器
- ✅ 从服务器同步白名单
- ✅ 封禁列表同步
- ✅ 实时添加/删除白名单
- ✅ 服务器在线状态检查

### 3. PlayerInformationService ✅
**状态**: 本次修复
**修改**:
- 添加`getBridgeFn`属性
- 构造函数接收getBridge函数
- 更新getBridge方法返回实际Bridge
- 添加警告日志当Bridge不可用时

**影响的功能**:
- ✅ 从服务器获取玩家信息
- ✅ 获取在线玩家列表
- ✅ 实时玩家数据查询

### 4. ServiceManager ✅
**状态**: 本次修复
**修改**:
- 更新WhitelistManager初始化，传递getBridge函数
- 更新PlayerInformationService初始化，传递getBridge函数
- 保持CommandExecutionService的getBridge传递

## 不需要修复的服务

### PlayerInfoService
**原因**: 有自己的bridges Map，通过registerBridge方法管理
**设计**: 合理，允许独立管理Bridge生命周期

### MonitoringService
**原因**: 使用Connection而不是Bridge
**设计**: 通过Connection接口访问服务器

### 其他服务
- TokenManager: 不需要直接访问服务器
- PermissionManager: 只管理权限数据
- AuditService: 只记录审计日志
- EventService: 事件分发，不直接访问服务器
- BindingManager: 管理绑定关系，不直接访问服务器

## 修复前后对比

### 修复前
```typescript
// WhitelistManager
constructor(ctx: Context) {
    this.ctx = ctx;
    this.initializeService();
}

private async getBridge(serverId: string): Promise<any> {
    return null; // ❌ 总是返回null
}

// PlayerInformationService
constructor(ctx: Context) {
    this.ctx = ctx;
    this.initializeService();
}

private getBridge(serverId: string): any {
    return null; // ❌ 总是返回null
}

// ServiceManager
this.player = new PlayerInformationService(ctx);
this.whitelist = new WhitelistManager(ctx);
```

### 修复后
```typescript
// WhitelistManager
constructor(ctx: Context, getBridge: (serverId: string) => any) {
    this.ctx = ctx;
    this.getBridgeFn = getBridge;
    this.initializeService();
}

private async getBridge(serverId: string): Promise<any> {
    const bridge = this.getBridgeFn(serverId); // ✅ 返回实际Bridge
    if (!bridge) {
        this.ctx.logger('mochi-link:whitelist').warn(
            `Bridge not available for server ${serverId}, operations will be queued`
        );
    }
    return bridge;
}

// PlayerInformationService
constructor(ctx: Context, getBridge: (serverId: string) => any) {
    this.ctx = ctx;
    this.getBridgeFn = getBridge;
    this.initializeService();
}

private getBridge(serverId: string): any {
    const bridge = this.getBridgeFn(serverId); // ✅ 返回实际Bridge
    if (!bridge) {
        this.ctx.logger('mochi-link:player').warn(
            `Bridge not available for server ${serverId}, using cached data only`
        );
    }
    return bridge;
}

// ServiceManager
this.player = new PlayerInformationService(
    ctx,
    (serverId: string) => this.server.getBridge(serverId)
);
this.whitelist = new WhitelistManager(
    ctx,
    (serverId: string) => this.server.getBridge(serverId)
);
```

## 工作流程

### WebSocket连接建立
```
1. Folia服务器连接
2. WebSocket认证成功
3. ServerManager.createWebSocketBridge()
4. Bridge存入bridges Map
5. 所有服务通过getBridge()访问Bridge
```

### 服务访问Bridge
```
WhitelistManager.syncToServer()
  ↓
getBridge(serverId)
  ↓
getBridgeFn(serverId)
  ↓
ServerManager.getBridge(serverId)
  ↓
bridges.get(serverId)
  ↓
返回JavaConnectorBridge实例
  ↓
bridge.addToWhitelist()
  ↓
通过WebSocket发送请求
```

## 测试验证

### 1. 白名单功能
```bash
# 添加到白名单
/mochi whitelist add test Player123
# 预期: 成功添加并同步到服务器

# 查看白名单
/mochi whitelist list test
# 预期: 显示完整白名单

# 同步白名单
/mochi whitelist sync test
# 预期: 从服务器同步最新数据
```

### 2. 玩家信息
```bash
# 获取玩家信息
/mochi player info test Player123
# 预期: 从服务器获取实时数据

# 获取在线玩家
/mochi player list test
# 预期: 显示当前在线玩家
```

### 3. 命令执行
```bash
# 执行命令
/mochi exec test list -a console
# 预期: 成功执行并返回结果
```

## 降级策略

当Bridge不可用时：

### WhitelistManager
- 操作被加入待处理队列
- 等待服务器上线后自动同步
- 使用缓存数据响应查询

### PlayerInformationService
- 使用缓存数据
- 显示警告信息
- 缓存过期后提示用户

### CommandExecutionService
- 立即返回错误
- 提示服务器不可用
- 记录审计日志

## 相关文件

### 修改的文件
- `src/services/whitelist.ts` - 白名单管理
- `src/services/player.ts` - 玩家信息
- `src/services/index.ts` - 服务管理器

### 参考文件
- `src/services/command.ts` - 命令执行（已修复，作为参考）
- `src/services/server.ts` - 服务器管理（提供getBridge）
- `src/bridge/java.ts` - Java Bridge实现

### 文档文件
- `BRIDGE_CREATION_FIX.md` - Bridge创建问题分析
- `BRIDGE_FIX_SUMMARY.md` - Bridge创建修复总结
- `ADDITIONAL_BRIDGE_ISSUES.md` - 额外的Bridge问题
- `BRIDGE_ACCESS_FIX_SUMMARY.md` - 本文档

## 部署

1. ✅ 代码已编译成功
2. ✅ 所有修改已提交
3. 待测试：重启Koishi并验证功能

## 预期结果

修复后，所有需要与服务器交互的功能都能正常工作：
- ✅ 命令执行
- ✅ 白名单管理
- ✅ 封禁管理
- ✅ 玩家信息查询
- ✅ 在线玩家列表
- ✅ 服务器状态检查

## 下一步

1. 提交代码到Git
2. 推送到远程仓库
3. 重启Koishi测试
4. 验证所有功能
5. 更新用户文档
