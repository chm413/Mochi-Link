# Mochi-Link 插件状态 v1.0.5

## 当前状态：基础模式 ✅

插件现在以**基础模式**运行，可以成功加载并显示配置界面。

### ✅ 可用功能

1. **插件加载** - 插件可以正常加载到 Koishi
2. **配置界面** - 完整的配置选项界面
3. **基础服务** - 插件服务注册和健康检查
4. **日志记录** - 基本的日志输出

### ⏳ 待实现功能

以下高级功能将在后续版本中逐步添加：

1. **数据库集成** - 服务器配置、玩家数据存储
2. **WebSocket 服务器** - 与 MC 服务器的实时通信
3. **HTTP API** - RESTful API 接口
4. **服务器管理** - 多服务器注册和管理
5. **权限系统** - 基于角色的访问控制
6. **监控服务** - 性能监控和健康检查
7. **审计日志** - 操作记录和审计

## 安装方法

### 在 Koishi 容器中安装

```bash
# 进入容器
docker exec -it koishi sh

# 安装插件
cd /koishi
yarn add koishi-plugin-mochi-link@https://github.com/chm413/Mochi-Link.git

# 退出容器
exit

# 重启容器
docker restart koishi
```

### 验证安装

1. 打开 Koishi Web UI（通常是 http://localhost:5140）
2. 进入"插件"页面
3. 找到 "mochi-link" 插件
4. 应该能看到配置界面
5. 启用插件

### 预期日志

启用插件后，你应该在日志中看到：

```
[mochi-link] Starting Mochi-Link plugin...
[mochi-link] Plugin loaded successfully. Advanced features will be initialized when needed.
[mochi-link] Mochi-Link plugin started successfully (basic mode)
[mochi-link] Note: Full feature set requires additional configuration. See documentation for details.
```

## 配置选项

虽然是基础模式，但所有配置选项都已定义并可以设置：

### WebSocket 配置
- `websocket.port` - WebSocket 服务端口（默认：8080）
- `websocket.host` - WebSocket 服务地址（默认：0.0.0.0）
- `websocket.ssl` - SSL 配置（可选）

### HTTP 配置
- `http.port` - HTTP API 端口（默认：8081）
- `http.host` - HTTP API 地址（默认：0.0.0.0）
- `http.cors` - 启用 CORS（默认：true）

### 数据库配置
- `database.prefix` - 数据库表前缀（默认：mochi_）

### 安全配置
- `security.tokenExpiry` - 令牌过期时间（默认：86400秒）
- `security.maxConnections` - 最大连接数（默认：100）
- `security.rateLimiting` - 速率限制配置

### 监控配置
- `monitoring.reportInterval` - 状态上报间隔（默认：30秒）
- `monitoring.historyRetention` - 历史保留天数（默认：30天）

### 日志配置
- `logging.level` - 日志级别（默认：info）
- `logging.auditRetention` - 审计日志保留天数（默认：90天）

## 开发路线图

### v1.1.0（计划中）
- ✅ 数据库初始化
- ✅ 基础 WebSocket 服务器
- ✅ 简单的服务器注册

### v1.2.0（计划中）
- ✅ HTTP API 基础端点
- ✅ 服务器状态查询
- ✅ 基础权限检查

### v1.3.0（计划中）
- ✅ 完整的服务器管理
- ✅ 玩家数据同步
- ✅ 事件推送

### v2.0.0（长期目标）
- ✅ 完整的监控系统
- ✅ 高级权限管理
- ✅ 审计日志
- ✅ Web 管理面板

## 为什么是基础模式？

v1.0.5 采用基础模式的原因：

1. **模块依赖复杂** - 完整版本有 100+ 个 TypeScript 编译错误
2. **加载失败** - 复杂的服务依赖导致插件无法加载
3. **渐进式开发** - 先确保插件能加载，再逐步添加功能

### 技术细节

原来的实现尝试在插件加载时初始化所有服务：
- 数据库操作层
- WebSocket 服务器
- HTTP API 服务器
- 监控服务
- 权限系统
- 审计日志

这导致了复杂的模块依赖链和循环引用问题。

基础模式简化了启动流程：
```javascript
ctx.on('ready', async () => {
    logger.info('Starting Mochi-Link plugin...');
    // 只做最基本的初始化
    isInitialized = true;
    logger.info('Mochi-Link plugin started successfully (basic mode)');
});
```

## 常见问题

### Q: 为什么配置了但没有效果？

A: 当前是基础模式，配置项已定义但功能尚未实现。配置会被保存，当功能实现后会自动生效。

### Q: 如何知道什么时候有新功能？

A: 关注 GitHub 仓库的 Releases 页面，每个新版本都会有详细的更新说明。

### Q: 可以帮助开发吗？

A: 当然！欢迎提交 Pull Request。主要需要帮助的领域：
- 修复 TypeScript 编译错误
- 实现数据库操作
- 实现 WebSocket 服务器
- 编写测试用例

### Q: 基础模式有什么用？

A: 基础模式确保：
1. 插件可以正常安装和加载
2. 配置界面可以正常显示
3. 为后续功能开发打下基础
4. 用户可以提前配置，等功能实现后直接使用

## 技术支持

- 📧 GitHub Issues: https://github.com/chm413/Mochi-Link/issues
- 📖 文档: 查看仓库中的 README.md 和其他 .md 文件
- 🔧 调试: 查看 Koishi 日志获取详细信息

## 版本历史

| 版本 | 日期 | 状态 | 说明 |
|------|------|------|------|
| v1.0.0 | 2026-02-17 | ❌ | 初始版本，未发布 |
| v1.0.1 | 2026-02-17 | ❌ | 配置导出问题 |
| v1.0.2 | 2026-02-17 | ❌ | 模块加载失败 |
| v1.0.3 | 2026-02-17 | ❌ | 延迟加载，仍有错误 |
| v1.0.4 | 2026-02-17 | ❌ | 减少编译错误，运行时失败 |
| v1.0.5 | 2026-02-17 | ✅ | 基础模式，可正常加载 |

---

**当前版本**: v1.0.5  
**状态**: 基础模式可用  
**下一步**: 逐步实现高级功能  
**最后更新**: 2026-02-17
