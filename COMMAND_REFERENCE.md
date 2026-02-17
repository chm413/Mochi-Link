# Mochi-Link Koishi 指令快速参考

## 📋 指令总览

v1.2.0 版本共有 **16 个指令**，分为 6 大类：

| 类别 | 指令数 | 说明 |
|------|--------|------|
| 主命令 | 1 | 系统帮助 |
| 服务器管理 | 5 | 服务器 CRUD 操作 |
| 白名单管理 | 4 | 白名单增删查 |
| 玩家管理 | 4 | 玩家查询和踢出 |
| 命令执行 | 1 | 远程命令执行 |
| 审计日志 | 1 | 操作日志查询 |

---

## 🎯 主命令

### mochi
显示系统简介和帮助信息

```bash
mochi
```

---

## 🖥️ 服务器管理

### mochi.server
显示服务器管理命令列表

```bash
mochi.server
```

### mochi.server.list
列出所有已注册的服务器

```bash
mochi.server.list
```

**输出示例**:
```
服务器列表：
  [survival] 生存服务器 (java/paper) - online
  [creative] 创造服务器 (java/fabric) - offline
```

### mochi.server.add
添加新服务器

```bash
mochi.server.add <id> <name> [-t type] [-c core]
```

**参数**:
- `<id>`: 服务器唯一标识符
- `<name>`: 服务器显示名称
- `-t, --type`: 服务器类型 (java/bedrock)，默认: java
- `-c, --core`: 核心名称 (paper/fabric/llbds等)，默认: paper

**示例**:
```bash
mochi.server.add survival 生存服务器
mochi.server.add creative 创造服 -t java -c fabric
mochi.server.add bedrock1 基岩服 -t bedrock -c llbds
```

### mochi.server.info
查看服务器详细信息

```bash
mochi.server.info <id>
```

**示例**:
```bash
mochi.server.info survival
```

**输出示例**:
```
服务器信息：
  ID: survival
  名称: 生存服务器
  类型: java
  核心: paper
  版本: 1.20.4
  状态: online
  连接模式: reverse
  创建时间: 2026-02-17 10:30:00
  最后更新: 2026-02-17 18:20:00
```

### mochi.server.remove
删除服务器

```bash
mochi.server.remove <id>
```

**示例**:
```bash
mochi.server.remove old_server
```

---

## 📝 白名单管理

### mochi.whitelist
显示白名单管理命令列表

```bash
mochi.whitelist
```

### mochi.whitelist.list
查看服务器白名单

```bash
mochi.whitelist.list <serverId>
```

**示例**:
```bash
mochi.whitelist.list survival
```

### mochi.whitelist.add
添加玩家到白名单

```bash
mochi.whitelist.add <serverId> <player>
```

**参数**:
- `<serverId>`: 服务器 ID
- `<player>`: 玩家名称或 UUID

**示例**:
```bash
mochi.whitelist.add survival Steve
mochi.whitelist.add survival 069a79f4-44e9-4726-a5be-fca90e38aaf5
```

### mochi.whitelist.remove
从白名单移除玩家

```bash
mochi.whitelist.remove <serverId> <player>
```

**示例**:
```bash
mochi.whitelist.remove survival Griefer
```

---

## 👥 玩家管理

### mochi.player
显示玩家管理命令列表

```bash
mochi.player
```

### mochi.player.list
查看服务器在线玩家

```bash
mochi.player.list <serverId>
```

**示例**:
```bash
mochi.player.list survival
```

**输出示例**:
```
服务器 生存服务器 在线玩家 (25/100):
  [1] Steve - 生命: 20/20 - 等级: 30 - 游戏模式: survival
  [2] Alex - 生命: 18/20 - 等级: 25 - 游戏模式: survival
```

### mochi.player.info
查看玩家详细信息

```bash
mochi.player.info <serverId> <player>
```

**示例**:
```bash
mochi.player.info survival Steve
```

**输出示例**:
```
玩家信息：
  名称: Steve
  UUID: 069a79f4-44e9-4726-a5be-fca90e38aaf5
  显示名: §aSteve
  生命值: 20/20
  饥饿值: 20/20
  经验等级: 30
  游戏模式: survival
  位置: world (100, 64, 200)
  在线时长: 2小时30分钟
```

### mochi.player.kick
踢出玩家

```bash
mochi.player.kick <serverId> <player> [reason]
```

**参数**:
- `<serverId>`: 服务器 ID
- `<player>`: 玩家名称或 UUID
- `[reason]`: 踢出原因（可选）

**示例**:
```bash
mochi.player.kick survival Griefer 恶意破坏
mochi.player.kick survival AFK
```

---

## ⚡ 命令执行

### mochi.exec / mochi.cmd
在服务器执行命令

```bash
mochi.exec <serverId> <command...> [-a executor]
mochi.cmd <serverId> <command...> [-a executor]
```

**参数**:
- `<serverId>`: 服务器 ID
- `<command...>`: 要执行的命令（支持空格和多个参数）
- `-a, --as`: 执行者 (console/player)，默认: console

**示例**:
```bash
# 基础命令
mochi.exec survival say Hello World
mochi.cmd survival weather clear

# 给予物品
mochi.exec survival give @a diamond 64

# 传送玩家
mochi.exec survival tp Steve 0 64 0

# 设置时间
mochi.exec survival time set day

# 指定执行者
mochi.exec survival gamemode creative Steve -a console
```

**输出示例**:
```
已在服务器 生存服务器 执行命令: say Hello World
执行者: console
命令输出: [Server] Hello World
```

---

## 📊 审计日志

### mochi.audit
查看系统审计日志

```bash
mochi.audit [-l limit]
```

**参数**:
- `-l, --limit`: 显示条数，默认: 10

**示例**:
```bash
mochi.audit
mochi.audit -l 20
mochi.audit -l 50
```

**输出示例**:
```
审计日志：
  [2026-02-17 18:30:00] server.create - success (用户: 123456) (服务器: survival)
  [2026-02-17 18:28:00] whitelist.add - success (用户: 123456) (服务器: survival)
  [2026-02-17 18:25:00] player.kick - success (用户: 123456) (服务器: survival)
  [2026-02-17 18:20:00] command.execute - success (用户: 123456) (服务器: survival)
```

---

## 🔍 常用操作流程

### 1. 初次设置服务器

```bash
# 1. 添加服务器
mochi.server.add survival 生存服务器 -t java -c paper

# 2. 查看服务器信息
mochi.server.info survival

# 3. 添加白名单玩家
mochi.whitelist.add survival Steve
mochi.whitelist.add survival Alex

# 4. 查看白名单
mochi.whitelist.list survival
```

### 2. 日常管理操作

```bash
# 查看在线玩家
mochi.player.list survival

# 查看特定玩家信息
mochi.player.info survival Steve

# 执行服务器命令
mochi.exec survival say 服务器将在5分钟后重启
mochi.exec survival save-all

# 踢出违规玩家
mochi.player.kick survival Griefer 违反服务器规则
```

### 3. 批量管理

```bash
# 添加多个玩家到白名单
mochi.whitelist.add survival Steve
mochi.whitelist.add survival Alex
mochi.whitelist.add survival Notch

# 执行多个命令
mochi.exec survival say 准备维护
mochi.exec survival save-all
mochi.exec survival stop
```

### 4. 查看操作记录

```bash
# 查看最近的操作
mochi.audit -l 20

# 查看服务器列表
mochi.server.list

# 查看特定服务器详情
mochi.server.info survival
```

---

## 💡 使用技巧

### 1. 命令别名
- `mochi.exec` = `mochi.cmd` （命令执行）

### 2. 参数格式
- 服务器 ID: 使用创建时指定的 ID，如 `survival`, `creative`
- 玩家标识: 支持玩家名称或完整 UUID
- 命令参数: 支持空格和特殊字符，会自动拼接

### 3. 权限说明
- 查询类命令（list, info）: 所有用户可用
- 管理类命令（add, remove, kick, exec）: 需要管理员权限

### 4. 状态检查
- 大部分操作会自动检查服务器是否在线
- 离线服务器无法执行玩家相关操作和命令

### 5. 审计日志
- 所有管理操作都会自动记录到审计日志
- 包含操作者、时间、服务器、操作内容等信息
- 可用于追溯和审计

---

## ⚠️ 注意事项

### 当前版本限制 (v1.2.0)

1. **服务器连接**: 当前版本为框架实现，实际功能需要服务器通过 WebSocket 连接后才能使用
2. **数据同步**: 白名单、玩家信息等需要服务器在线并连接后才能获取实时数据
3. **命令执行**: 命令会被记录但需要服务器连接后才能实际执行

### 已实现功能

✅ 服务器信息管理（数据库 CRUD）  
✅ 审计日志记录  
✅ 参数验证和错误处理  
✅ 命令注册和帮助系统  

### 待实现功能

🔄 WebSocket 服务器连接  
🔄 实时玩家数据获取  
🔄 实时命令执行  
🔄 白名单同步  
🔄 性能监控数据  

---

## 📚 相关文档

- [完整 API 文档](./KOISHI_COMMANDS_AND_API.md) - 包含 HTTP API 和 WebSocket 事件
- [安装指南](./KOISHI_INSTALLATION_GUIDE.md) - 插件安装和配置
- [部署指南](./CONNECTOR_DEPLOYMENT_GUIDE.md) - Connector 部署说明

---

**版本**: v1.2.0  
**更新日期**: 2026-02-17  
**项目**: Mochi-Link (大福连) - Minecraft 统一管理与监控系统
