# JSON解析错误修复 - 部署检查清单

## 修复内容
✅ 修复了数据库JSON字段解析错误
✅ 添加了自动修复工具
✅ 集成到数据库初始化流程
✅ 修复了7个文件中的所有JSON.parse调用

## 部署前检查

### 1. 代码编译
```bash
npm run build
```
预期输出：无错误，Exit Code: 0

### 2. 检查生成的文件
```bash
# Windows PowerShell
Test-Path lib/database/fix-invalid-json.js
Test-Path lib/database/models.js
Test-Path lib/database/operations.js
Test-Path lib/database/init.js
```
所有应该返回 `True`

### 3. 备份数据库（可选但推荐）
在重启Koishi之前，备份当前数据库文件。

## 部署步骤

### 1. 停止Koishi服务
```bash
# 停止正在运行的Koishi实例
```

### 2. 更新插件
```bash
# 如果是开发环境
npm run build

# 如果是生产环境
npm pack
# 然后在Koishi中更新插件包
```

### 3. 启动Koishi服务
```bash
# 启动Koishi
```

### 4. 观察启动日志
查找以下日志信息：

```
[INFO] [mochi-link:db-init] Starting database initialization...
[INFO] [mochi-link:db-init] Checking database connectivity...
[INFO] [mochi-link:db-init] Database connectivity verified
[INFO] [mochi-link:db-init] Running database migrations...
[INFO] [mochi-link:db-init] Database migrations completed
[INFO] [mochi-link:db-init] Verifying table creation...
[INFO] [mochi-link:db-init] All required tables verified
[INFO] [mochi-link:db-init] Checking for invalid JSON data...
[INFO] [mochi-link:db-fix] Starting database JSON field repair...
[INFO] [mochi-link:db-fix] Fixed X server records
[INFO] [mochi-link:db-fix] Fixed X ACL records
[INFO] [mochi-link:db-fix] Fixed X token records
[INFO] [mochi-link:db-fix] Fixed X audit log records
[INFO] [mochi-link:db-fix] Fixed X pending operation records
[INFO] [mochi-link:db-fix] Database JSON field repair completed
[INFO] [mochi-link:db-init] Fixed X records with invalid JSON data
[INFO] [mochi-link:db-init] Database initialization completed successfully
```

如果看到 "No invalid JSON data found"，说明数据库已经是干净的。

## 验证功能

### 1. 检查性能监控
```bash
# 在Koishi控制台执行
mochi.server.list
```
应该不再出现 JSON 解析错误。

### 2. 测试Folia连接
- 启动Folia服务器
- 观察连接日志
- 确认认证成功
- 检查心跳消息

### 3. 检查服务器列表
在Koishi中查看服务器列表，确保所有服务器信息正确显示。

## 预期结果

### 成功指标
✅ Koishi启动无错误
✅ 数据库初始化成功
✅ JSON修复工具运行（如果有无效数据）
✅ 性能监控正常工作
✅ Folia服务器连接成功
✅ 服务器列表正确显示

### 失败处理
如果出现问题：
1. 检查日志中的具体错误信息
2. 确认数据库文件权限
3. 验证数据库连接配置
4. 如有必要，恢复数据库备份

## 回滚方案

如果需要回滚：
1. 停止Koishi
2. 恢复之前的插件版本
3. 恢复数据库备份（如果有）
4. 重启Koishi

注意：JSON修复是非破坏性的，只是规范化了数据格式，不会丢失数据。

## 监控建议

部署后持续监控：
- 检查错误日志
- 观察性能指标
- 验证服务器连接状态
- 确认所有功能正常

## 支持

如果遇到问题，请提供：
1. 完整的启动日志
2. 错误信息截图
3. 数据库类型和版本
4. Koishi版本信息

## 文档参考
- `JSON_PARSE_ERROR_FIX.md` - 详细技术说明
- `JSON_FIX_SUMMARY_CN.md` - 中文简要总结
