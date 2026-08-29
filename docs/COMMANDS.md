# Koishi 命令参考

以下命令来自当前 `src/index.ts` 注册项。实际可用性仍取决于数据库、服务器连接、Connector capabilities 和 Koishi authority。

## 服务器

```text
mochi.server.list
mochi.server.add <id> <name> [-t type] [-c core]
mochi.server.register <id> <name> [--host host] [-p port] [-t type] [-c core]
mochi.server.info [id]
mochi.server.token <id> [-r]
mochi.server.remove <id>
```

`mochi.server.token` 默认只显示令牌状态和指纹。`-r` 使旧令牌立即失效并生成新令牌；明文只在这次命令响应中显示，之后无法查看。

## 权限与审计

```text
mochi.permission.grant <userId> <serverId> <role> [-e date] [-r reason]
mochi.permission.revoke <userId> <serverId> [-r reason]
mochi.permission.update <userId> <serverId> <role> [-e date] [-r reason]
mochi.permission.query [userId] [serverId]
mochi.permission.list <serverId> [role]
mochi.permission.roles
mochi.audit [-l limit]
```

角色模型包含 `owner`、`admin`、`sm`、`pm`、`moderator`、`viewer`。命令注册的 Koishi authority 只是第一层检查，服务器 ACL 和具体操作权限仍必须执行。

## 玩家与白名单

```text
mochi.player.list [serverId]
mochi.player.info [serverId] <player>
mochi.player.kick [serverId] <player> [reason]
mochi.whitelist.list [serverId]
mochi.whitelist.add [serverId] <player>
mochi.whitelist.remove [serverId] <player>
添加白名单 <player>
在线
```

省略 `serverId` 时，命令会尝试使用当前群组绑定。当前实现一个群组最多有一台主服务器，因此不存在自动向多台服务器广播的语义。

## 命令执行

```text
mochi.exec [serverId] <command...> [-a console|player]
```

协议操作名为 `command.execute`。只有 Connector 返回真实执行结果时才能报告成功；没有活动适配器或能力时必须失败。

## 事件

```text
mochi.event.types
mochi.event.list [serverId]
mochi.event.subscribe [serverId] <events...> [-d]
mochi.event.unsubscribe <subscriptionId>
mochi.event.stats [serverId]
```

## 群组绑定

```text
mochi.bind.add <serverId> [-t full|chat|event]
mochi.bind.list
mochi.bind.remove <bindingId>
```

最初规格要求群组与服务器多对多绑定；当前服务层明确限制为“一个群组一台服务器，一台服务器可绑定多个群组”。在路由层支持集合结果并补充冲突选择策略前，不应在文档中宣称多对多已完成。
