# Koishi 插件热修复 v1.0.3

## 问题描述

在 v1.0.2 中，插件加载时出现错误：
```
Error: Cannot find module './database/init'
```

## 根本原因

插件在顶层导入了所有依赖模块，这些模块又有更多的导入链，导致：
1. 模块解析路径错误
2. 循环依赖问题
3. 在 Koishi 环境中加载失败

## 解决方案

v1.0.3 采用了**延迟加载（Lazy Loading）**策略：

### 修改前（v1.0.2）
```javascript
// 顶层导入所有依赖
const init_1 = require("./database/init");
const system_integration_1 = require("./services/system-integration");
const health_monitoring_1 = require("./services/health-monitoring");

function apply(ctx, config) {
  // 直接使用已导入的模块
  const plugin = new MochiLinkPlugin(ctx, config);
  // ...
}
```

### 修改后（v1.0.3）
```javascript
// 顶层只导入 Koishi 核心
const { Schema, Logger } = require("koishi");

function apply(ctx, config) {
  // 在 ready 事件中才加载依赖
  ctx.on('ready', async () => {
    const { SystemIntegrationService } = require('./services/system-integration');
    const { HealthMonitoringService } = require('./services/health-monitoring');
    // ...
  });
}
```

## 主要改进

1. ✅ **延迟加载**: 只在需要时才加载重型依赖
2. ✅ **错误隔离**: 加载错误不会阻止插件注册
3. ✅ **纯函数式**: 移除 Service 类继承，使用纯函数
4. ✅ **更好的日志**: 详细的错误堆栈信息

## 更新方法

### 在 Koishi 容器中更新

```bash
# 进入容器
docker exec -it koishi sh

# 进入 Koishi 目录
cd /koishi

# 移除旧版本
yarn remove koishi-plugin-mochi-link

# 安装新版本
yarn add koishi-plugin-mochi-link@https://github.com/chm413/Mochi-Link.git

# 退出容器
exit

# 重启容器
docker restart koishi
```

### 验证更新

1. 打开 Koishi Web UI（通常是 http://localhost:5140）
2. 进入"插件"页面
3. 找到 "mochi-link" 插件
4. 应该能看到配置界面，没有加载错误
5. 启用插件，检查日志

## 预期行为

### 成功加载的日志
```
[mochi-link] Starting Mochi-Link plugin...
[mochi-link] Starting in production environment
[mochi-link] Mochi-Link plugin started successfully
```

### 如果仍有错误

如果更新后仍然有问题，请：

1. **清除缓存**:
```bash
docker exec koishi sh -c "cd /koishi && rm -rf .yarn/cache && yarn install"
```

2. **检查依赖**:
```bash
docker exec koishi sh -c "cd /koishi && yarn list --pattern koishi-plugin-mochi-link"
```

3. **查看完整日志**:
```bash
docker logs koishi --tail 100
```

4. **重新安装**:
```bash
docker exec koishi sh -c "cd /koishi && rm -rf node_modules/koishi-plugin-mochi-link && yarn install"
```

## 技术细节

### 延迟加载的优势

1. **避免循环依赖**: 模块在运行时才加载，避免编译时的循环引用
2. **更快的启动**: 插件注册阶段不加载重型模块
3. **更好的错误处理**: 可以捕获并记录加载错误
4. **按需加载**: 只加载实际使用的模块

### 兼容性

- ✅ Koishi v4.15.0+
- ✅ Node.js v16.0.0+
- ✅ Yarn v4 (Berry)
- ✅ npm v7+

## 版本历史

| 版本 | 日期 | 状态 | 说明 |
|------|------|------|------|
| v1.0.0 | 2026-02-17 | ❌ | 初始版本，未发布 |
| v1.0.1 | 2026-02-17 | ⚠️ | 配置导出问题 |
| v1.0.2 | 2026-02-17 | ❌ | 模块加载失败 |
| v1.0.3 | 2026-02-17 | ✅ | 延迟加载，修复加载问题 |

## 常见问题

### Q: 为什么不在编译时修复？

A: 问题不在于编译，而在于运行时的模块解析。Koishi 的模块加载机制与标准 Node.js 略有不同，延迟加载是最可靠的解决方案。

### Q: 会影响性能吗？

A: 不会。延迟加载只影响插件启动时间（增加几毫秒），但避免了加载失败的问题。运行时性能完全相同。

### Q: 其他插件也需要这样做吗？

A: 不一定。如果你的插件依赖简单，顶层导入没问题。但如果有复杂的依赖树或循环依赖，延迟加载是最佳实践。

### Q: 可以回退到旧版本吗？

A: 不建议。v1.0.2 及之前的版本都有加载问题。请使用 v1.0.3 或更高版本。

## 下一步

插件现在应该能正常加载了。接下来：

1. ✅ 配置插件参数
2. ✅ 在 MC 服务器上安装 Connector Bridge
3. ✅ 注册服务器并建立连接
4. ✅ 测试基本功能

## 支持

如果仍有问题，请提供：
- Koishi 版本
- Node.js 版本
- 完整的错误日志
- 容器环境信息

---

**修复版本**: v1.0.3  
**修复日期**: 2026-02-17  
**修复类型**: 热修复（Hotfix）  
**优先级**: 高
