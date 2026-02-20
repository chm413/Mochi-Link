# Mochi-Link 命令别名 (Command Aliases)

## ✅ 完整的中英文命令支持

现在所有命令都支持中文和英文两种方式调用！

## 📋 命令别名对照表

### 主命令

| 英文命令 | 中文别名 | 说明 |
|---------|---------|------|
| `mochi` | `大福连` / `墨池` | 主命令 |

### 服务器管理

| 英文命令 | 中文别名 | 说明 |
|---------|---------|------|
| `mochi.server` | `服务器` | 服务器管理菜单 |
| `mochi.server.list` | `服务器.列表` / `服务器列表` | 列出所有服务器 |
| `mochi.server.add <id> <name>` | `服务器.添加 <id> <name>` / `添加服务器 <id> <name>` | 添加服务器 |
| `mochi.server.info <id>` | `服务器.信息 <id>` / `服务器信息 <id>` | 查看服务器信息 |
| `mochi.server.remove <id>` | `服务器.删除 <id>` / `删除服务器 <id>` | 删除服务器 |

### 审计日志

| 英文命令 | 中文别名 | 说明 |
|---------|---------|------|
| `mochi.audit` | `审计` / `日志` | 查看审计日志 |

### 白名单管理

| 英文命令 | 中文别名 | 说明 |
|---------|---------|------|
| `mochi.whitelist` | `白名单` | 白名单管理菜单 |
| `mochi.whitelist.list [serverId]` | `白名单.列表 [serverId]` / `查看白名单 [serverId]` | 查看白名单 |
| `mochi.whitelist.add [serverId] <player>` | `白名单.添加 [serverId] <player>` / `添加白名单 [serverId] <player>` | 添加到白名单 |
| `mochi.whitelist.remove <serverId> <player>` | `白名单.移除 <serverId> <player>` / `移除白名单 <serverId> <player>` | 从白名单移除 |

### 玩家管理

| 英文命令 | 中文别名 | 说明 |
|---------|---------|------|
| `mochi.player` | `玩家` | 玩家管理菜单 |
| `mochi.player.list [serverId]` | `玩家.列表 [serverId]` / `在线玩家 [serverId]` | 查看在线玩家 |
| `mochi.player.info <serverId> <player>` | `玩家.信息 <serverId> <player>` / `玩家信息 <serverId> <player>` | 查看玩家信息 |
| `mochi.player.kick <serverId> <player> [reason]` | `玩家.踢出 <serverId> <player> [reason]` / `踢出玩家 <serverId> <player> [reason]` | 踢出玩家 |

### 命令执行

| 英文命令 | 中文别名 | 说明 |
|---------|---------|------|
| `mochi.exec <serverId> <command...>` | `执行 <serverId> <command...>` | 在服务器执行命令 |
| `mochi.cmd <serverId> <command...>` | - | exec 的简写 |

### 群组绑定

| 英文命令 | 中文别名 | 说明 |
|---------|---------|------|
| `mochi.bind` | `绑定` | 群组绑定管理菜单 |
| `mochi.bind.add <serverId>` | `绑定.添加 <serverId>` / `添加绑定 <serverId>` | 绑定服务器到群组 |
| `mochi.bind.list` | `绑定.列表` / `查看绑定` | 查看群组绑定 |
| `mochi.bind.remove <bindingId>` | `绑定.移除 <bindingId>` / `解除绑定 <bindingId>` | 解除绑定 |

## 🎯 使用示例

### 英文命令
```
> mochi.server.list
Server list:
  [my-server] My Server (java/paper) - Online

> mochi.whitelist.add my-server Steve
Added Steve to whitelist on server My Server

> mochi.player.list my-server
Online players on My Server (2):
  [1] Steve
  [2] Alex
```

### 中文命令（完全相同的功能）
```
> 服务器列表
服务器列表：
  [my-server] 我的服务器 (java/paper) - 在线

> 添加白名单 my-server Steve
已将 Steve 添加到服务器 我的服务器 的白名单

> 在线玩家 my-server
服务器 我的服务器 在线玩家 (2 人)：
  [1] Steve
  [2] Alex
```

### 混合使用
```
> mochi.server.add my-server "我的服务器" -t java -c paper
服务器 我的服务器 (my-server) 创建成功

> 白名单.添加 my-server Steve
已将 Steve 添加到服务器 我的服务器 的白名单

> mochi.player.list my-server
服务器 我的服务器 在线玩家 (1 人)：
  [1] Steve
```

## 🌟 别名风格

### 1. 点号风格（推荐）
使用点号分隔，保持层级结构：
```
服务器.列表
白名单.添加 my-server Steve
玩家.信息 my-server Steve
```

### 2. 空格风格（自然）
更自然的中文表达：
```
服务器列表
添加白名单 my-server Steve
玩家信息 my-server Steve
```

### 3. 简短别名
主命令的简短别名：
```
大福连
墨池
审计
日志
```

## 💡 智能提示

### 查看可用命令
```
> help mochi
或
> help 大福连
```

### 查看子命令
```
> help mochi.server
或
> help 服务器
```

### 查看具体命令
```
> help mochi.whitelist.add
或
> help 添加白名单
```

## 🔧 技术实现

### TypeScript 代码
```typescript
ctx.command('mochi.whitelist.add [serverId] <player>', 'commands.mochi.whitelist.add.description')
  .alias('白名单.添加 [serverId] <player>')
  .alias('添加白名单 [serverId] <player>')
  .action(async ({ session }, serverIdOrPlayer, player) => {
    // 命令逻辑
  });
```

### 特点
1. **多个别名** - 每个命令可以有多个别名
2. **参数保留** - 别名保留原命令的参数结构
3. **完全等价** - 别名和原命令功能完全相同
4. **帮助系统** - help 命令支持所有别名

## 📊 别名统计

| 类型 | 数量 |
|------|------|
| 主命令 | 1 个（3 个别名） |
| 服务器管理 | 5 个命令（10 个别名） |
| 审计日志 | 1 个命令（2 个别名） |
| 白名单管理 | 4 个命令（7 个别名） |
| 玩家管理 | 4 个命令（7 个别名） |
| 命令执行 | 1 个命令（1 个别名） |
| 群组绑定 | 4 个命令（7 个别名） |
| **总计** | **20 个命令，37 个中文别名** |

## 🎨 用户体验

### 中文用户
- ✅ 可以完全使用中文命令
- ✅ 更自然的交互体验
- ✅ 降低学习成本

### 英文用户
- ✅ 使用标准英文命令
- ✅ 符合国际惯例
- ✅ 易于记忆

### 混合使用
- ✅ 可以混合使用中英文命令
- ✅ 灵活选择最方便的方式
- ✅ 团队协作更友好

## 🚀 最佳实践

### 1. 文档中使用英文命令
```markdown
# 添加服务器
使用命令：`mochi.server.add <id> <name>`
或中文：`添加服务器 <id> <name>`
```

### 2. 教程中展示两种方式
```
英文：mochi.whitelist.add my-server Steve
中文：添加白名单 my-server Steve
```

### 3. 脚本中使用英文命令
```bash
# 推荐使用英文命令，更稳定
koishi-cli exec "mochi.server.list"
```

### 4. 日常使用选择舒适的方式
```
# 中文用户可能更喜欢
> 服务器列表
> 添加白名单 my-server Steve

# 英文用户可能更喜欢
> mochi.server.list
> mochi.whitelist.add my-server Steve
```

## 🔍 命令发现

### 使用 help 命令
```
> help
显示所有可用命令（包括别名）

> help mochi
显示 mochi 相关命令

> help 白名单
显示白名单相关命令
```

### 使用 Tab 补全
```
> 白名单.<Tab>
白名单.列表
白名单.添加
白名单.移除
```

## 🎉 总结

Mochi-Link 现在支持：

- ✅ **20 个英文命令**
- ✅ **37 个中文别名**
- ✅ **完全等价的功能**
- ✅ **灵活的使用方式**
- ✅ **友好的用户体验**

无论你习惯使用中文还是英文，都能轻松使用 Mochi-Link！🎊
