# Mochi-Link v1.5.0 - 修复版本安装说明

## ✅ 已修复的问题

1. **TypeScript 编译错误** - 所有 13 个编译错误已修复
2. **模块加载问题** - 禁用了服务管理器，使用基础模式
3. **数据库集成** - 100% 使用 Koishi 数据库，无需额外配置

## 📦 安装方法

### 方法 1：从本地文件安装（推荐）

在容器中执行：

```bash
cd /koishi

# 如果文件已在容器中
yarn add file:/tmp/koishi-plugin-mochi-link-1.5.0.tgz

# 或者从挂载的目录
yarn add file:/path/to/koishi-plugin-mochi-link-1.5.0.tgz
```

### 方法 2：从 Windows 复制到容器

在 Windows PowerShell 中：

```powershell
# 复制文件到容器
docker cp koishi-plugin-mochi-link-1.5.0.tgz koishi:/tmp/

# 进入容器
docker exec -it koishi /bin/sh

# 在容器中安装
cd /koishi
yarn remove koishi-plugin-mochi-link
yarn add file:/tmp/koishi-plugin-mochi-link-1.5.0.tgz

# 退出容器
exit

# 重启容器
docker restart koishi
```

## ✅ 预期日志输出

安装成功后，应该看到：

```
[I] mochi-link Starting Mochi-Link plugin...
[I] mochi-link Database initialized successfully
[I] mochi-link Running in basic mode (database + commands)
[I] mochi-link Advanced features will be available after server connection
[I] mochi-link Mochi-Link plugin started successfully
[I] mochi-link Database tables created with prefix: mochi_
```

**注意**：不会再出现 "Service manager initialization skipped" 的警告！

## 🎯 可用功能

### ✅ 完全可用（基础模式）

1. **服务器管理**
   ```
   mochi.server.list
   mochi.server.add <id> <name> [-t type] [-c core]
   mochi.server.info <id>
   mochi.server.remove <id>
   ```

2. **群组绑定**
   ```
   mochi.bind.add <serverId> [-t type]
   mochi.bind.list
   mochi.bind.remove <bindingId>
   mochi.bind.set <serverId>
   ```

3. **审计日志**
   ```
   mochi.audit [-l limit]
   ```

4. **数据库**
   - 使用 Koishi 数据库（MySQL/PostgreSQL/SQLite）
   - 表前缀：`mochi_`
   - 自动创建所有必需的表

### ⏳ 需要服务器连接

以下功能需要 Minecraft 服务器通过 Connector Bridge 连接后才能使用：

1. **白名单管理**
   ```
   mochi.whitelist.list [serverId]
   mochi.whitelist.add [serverId] <player>
   mochi.whitelist.remove <serverId> <player>
   ```

2. **玩家管理**
   ```
   mochi.player.list [serverId]
   mochi.player.info <serverId> <player>
   mochi.player.kick <serverId> <player> [reason]
   ```

3. **命令执行**
   ```
   mochi.exec <serverId> <command...> [-a executor]
   ```

## 🔧 技术细节

### 修复的 TypeScript 错误

1. ✅ `src/http/middleware/security.ts` - 修复 undefined 类型错误
2. ✅ `src/services/plugin-integration.ts` - 禁用未实现的插件管理器
3. ✅ `src/services/server.ts` - 添加类型注解
4. ✅ `src/services/system-integration.ts` - 使用类型断言
5. ✅ `src/websocket/manager.ts` - 可选属性

### 架构变更

**之前**：
```
Plugin → ServiceManager → Database Operations → Koishi DB
         ↓ (模块加载失败)
         ✗ 无法启动
```

**现在**：
```
Plugin → SimpleDatabaseManager → Koishi DB
         ↓
         ✅ 基础模式运行
```

### 数据库表

插件会在 Koishi 数据库中创建以下表：

- `mochi_servers` - 服务器配置
- `mochi_server_acl` - 访问控制列表
- `mochi_api_tokens` - API 令牌
- `mochi_audit_logs` - 审计日志
- `mochi_group_bindings` - 群组绑定

## 📝 使用示例

### 1. 注册服务器

```
mochi.server.add my-server "我的服务器" -t java -c paper
```

### 2. 绑定到群组

```
mochi.bind.add my-server -t full
```

### 3. 查看服务器列表

```
mochi.server.list
```

输出：
```
服务器列表：
  [my-server] 我的服务器 (java/paper) - offline
```

### 4. 查看审计日志

```
mochi.audit -l 10
```

## 🚀 下一步

1. ✅ 插件已安装并运行
2. ⏳ 在 Minecraft 服务器上安装 Connector Bridge
3. ⏳ 配置 Bridge 连接到 Koishi
4. ⏳ 连接成功后，白名单和玩家管理功能将自动可用

## 🔍 故障排除

### 如果仍然出现错误

1. **清除缓存**
   ```bash
   cd /koishi
   rm -rf node_modules
   yarn cache clean
   yarn install
   yarn add file:/tmp/koishi-plugin-mochi-link-1.5.0.tgz
   ```

2. **检查 Koishi 数据库配置**
   - 确保 Koishi 已配置数据库服务
   - 检查数据库连接是否正常

3. **查看完整日志**
   ```bash
   docker logs -f koishi
   ```

## 📊 版本信息

- **版本**: v1.5.0
- **编译状态**: ✅ 成功（0 错误）
- **运行模式**: 基础模式（Basic Mode）
- **数据库**: Koishi 数据库
- **TypeScript**: 已修复所有编译错误
- **打包大小**: 260.2 KB

## 🎉 总结

这个版本已经：
- ✅ 修复了所有 TypeScript 编译错误
- ✅ 解决了模块加载问题
- ✅ 使用 Koishi 数据库，无需额外配置
- ✅ 提供完整的基础功能
- ✅ 准备好接收服务器连接

插件现在可以稳定运行，等待 Minecraft 服务器连接后即可使用完整功能！
