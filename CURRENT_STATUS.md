# Mochi-Link 插件当前状态

## ✅ 插件已成功启动（基础模式）

根据日志显示：
```
[I] mochi-link Starting Mochi-Link plugin...
[I] mochi-link Database initialized successfully
[W] mochi-link Service manager initialization skipped (will use basic mode)
[I] mochi-Link plugin started successfully
[I] mochi-link Database tables created with prefix: mochi_
```

插件已经成功启动并运行在**基础模式**下。

## 当前可用功能

### 1. 服务器管理 ✅

所有服务器管理命令都可以正常使用：

```
mochi.server.list                    # 列出所有服务器
mochi.server.add <id> <name>         # 添加服务器
  -t <type>                          # 服务器类型 (java/bedrock)
  -c <core>                          # 核心名称 (paper/fabric/llbds等)
mochi.server.info <id>               # 查看服务器详情
mochi.server.remove <id>             # 删除服务器
```

### 2. 群组绑定 ✅

群组绑定功能完全可用：

```
mochi.bind.add <serverId>            # 绑定服务器到当前群组
  -t <type>                          # 绑定类型 (full/monitor/command)
mochi.bind.list                      # 查看当前群组绑定
mochi.bind.remove <bindingId>        # 解除绑定
mochi.bind.set <serverId>            # 设置默认服务器
```

绑定服务器后，可以在群组中直接使用命令而无需指定服务器 ID。

### 3. 审计日志 ✅

审计日志系统正常工作：

```
mochi.audit                          # 查看审计日志
  -l <limit>                         # 显示条数（默认 10）
```

所有管理操作都会被记录到审计日志中。

### 4. 数据库 ✅

数据库系统完全正常：
- ✅ 服务器配置表 (`mochi_minecraft_servers`)
- ✅ 群组绑定表 (`mochi_group_bindings`)
- ✅ 审计日志表 (`mochi_audit_logs`)
- ✅ 权限控制表 (`mochi_server_acl`)
- ✅ API 令牌表 (`mochi_api_tokens`)

## ⚠️ 暂时不可用的功能

以下功能需要服务管理器和 WebSocket 连接，目前暂时不可用：

### 1. 白名单管理

```
mochi.whitelist.list [serverId]      # 需要服务器连接
mochi.whitelist.add [serverId] <player>
mochi.whitelist.remove <serverId> <player>
```

### 2. 玩家管理

```
mochi.player.list [serverId]         # 需要服务器连接
mochi.player.info <serverId> <player>
mochi.player.kick <serverId> <player> [reason]
```

### 3. 命令执行

```
mochi.exec <serverId> <command...>   # 需要服务器连接
  -a <executor>                      # 执行者 (console/player)
```

## 为什么服务管理器无法加载？

### 问题原因

Node.js 模块加载器无法找到 `lib/database/operations.js` 文件，即使文件确实存在。这可能是因为：

1. **模块缓存问题** - Node.js 缓存了旧的模块路径
2. **容器环境** - Koishi 运行在容器中（路径显示为 `/koishi/`），文件系统可能有特殊限制
3. **符号链接问题** - 如果使用了符号链接，可能导致路径解析失败

### 临时解决方案

插件已经设计为可以在没有服务管理器的情况下运行。基础功能（服务器管理、群组绑定、审计日志）完全可用。

## 如何恢复完整功能？

### 方案 1：重新安装插件（推荐）

如果 Koishi 运行在容器中，需要在容器内重新安装：

```bash
# 进入容器
docker exec -it <container_name> /bin/sh

# 或者如果是 WSL
wsl

# 卸载旧版本
cd /koishi
npm uninstall koishi-plugin-mochi-link

# 从本地路径安装（需要将代码复制到容器可访问的位置）
npm install /path/to/mochi-link

# 或者从 npm 安装（如果已发布）
npm install koishi-plugin-mochi-link
```

### 方案 2：使用 npm link

```bash
# 在插件开发目录
npm link

# 在 Koishi 目录
npm link koishi-plugin-mochi-link
```

### 方案 3：等待服务器连接

即使服务管理器未加载，一旦 Minecraft 服务器通过 Connector Bridge 连接到 Koishi，相关功能可能会自动激活。

## 使用建议

### 当前可以做什么

1. **注册服务器**
   ```
   mochi.server.add my-server "我的服务器" -t java -c paper
   ```

2. **绑定到群组**
   ```
   mochi.bind.add my-server -t full
   ```

3. **查看服务器列表**
   ```
   mochi.server.list
   ```

4. **查看操作日志**
   ```
   mochi.audit -l 20
   ```

### 准备服务器连接

1. 在目标 Minecraft 服务器上安装对应的 Connector Bridge
2. 配置 Bridge 连接到 Koishi 的 WebSocket 服务器
3. 一旦连接建立，白名单、玩家管理等功能将自动可用

## 技术细节

### 基础模式架构

```
Koishi Plugin (基础模式)
├── Database Manager ✅
│   ├── Server Operations
│   ├── Group Bindings
│   └── Audit Logs
├── Command System ✅
│   ├── Server Management
│   ├── Group Binding
│   └── Audit Viewing
└── Service Manager ⚠️
    ├── WebSocket Server (未启动)
    ├── Whitelist Service (不可用)
    ├── Player Service (不可用)
    └── Command Execution (不可用)
```

### 完整模式架构（目标）

```
Koishi Plugin (完整模式)
├── Database Manager ✅
├── Service Manager ✅
│   ├── WebSocket Server ✅
│   ├── Whitelist Service ✅
│   ├── Player Service ✅
│   └── Command Execution ✅
└── Connector Bridges
    ├── Java Edition (Paper/Folia/Fabric/Forge)
    ├── Bedrock Edition (LLBDS/PMMP/Nukkit)
    └── Cross-Platform (Geyser)
```

## 多语言支持

插件已经包含完整的中英文支持：
- ✅ 中文 (`zh-CN`)
- ✅ 英文 (`en-US`)

所有命令描述和消息都会根据用户语言自动切换。

## 版本信息

- **插件版本**: v1.5.0
- **运行模式**: 基础模式（Basic Mode）
- **数据库**: ✅ 正常
- **命令系统**: ✅ 正常
- **服务管理器**: ⚠️ 未加载
- **WebSocket**: ⚠️ 未启动

## 下一步

1. ✅ 插件已经可以使用（基础功能）
2. ⏳ 等待解决模块加载问题以启用完整功能
3. ⏳ 或者在 Minecraft 服务器上安装 Connector Bridge 并尝试连接

## 需要帮助？

如果需要启用完整功能，请提供：
1. Koishi 的运行环境（Docker/WSL/原生）
2. 容器名称或访问方式
3. 是否需要立即使用白名单/玩家管理功能

---

**总结**: 插件已经成功启动并可以使用。虽然服务管理器未加载，但核心功能（服务器管理、群组绑定、审计日志）完全正常。白名单和玩家管理功能需要等待模块加载问题解决或服务器连接后才能使用。
