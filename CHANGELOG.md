# Changelog

本文件只记录可由 Git 历史和验证结果支持的变更。旧版散落的发布总结包含互相矛盾的日期、版本和“全部通过”声明，已不再作为事实来源。

## Unreleased

- 收敛 README、架构、协议、命令、Connector、开发和审计文档。
- 明确 U-WBP `2.0`、毫秒时间戳、`requestId` 和连接方向能力字段。
- 标记多对多绑定、token scopes、Web Dashboard、应用层加密等未完成目标。
- 清理重复报告、过时 Wiki 和无法复现的完成声明。
- 统一数据库表名前缀、U-WBP 版本/时间戳/响应关联和命令操作名。
- 新签发 token 改为只持久化哈希，并移除无活动适配器时的模拟成功结果。
- 修复 Koishi 卸载阶段的服务、连接和认证定时器泄漏。
- 修复事件模板动态字段被安全校验错误拒绝的问题。
- 删除错误的独立启动/PM2 部署脚本，收敛 Koishi 与运行依赖。
- 在 Koishi 4.18.11 + memory database 上验证 HTTP、WebSocket、表初始化和正常卸载。
- 修正 Koishi 与 Java/LLBDS/PMMP 的 challenge-HMAC、系统 ping/pong、响应关联和标准数据分支。
- Java、LLBDS、PMMP 的升级认证改用请求头，避免 token 出现在 URL 或详细消息日志中。
- 修复部分服务器更新生成未定义主键并清空无关字段的问题，同时禁止更新主键和创建时间。
- Java Connector 增加协议单测，LLBDS 与 PMMP 增加可重复协议烟测；PMMP API 调用按 API 5 源码核对。
- 移除 Java/基岩桥的伪造状态与性能数据，优先消费 Connector 的 `server.getInfo`、`server.getStatus` 和 `server.getMetrics` 响应。
- 完成认证后能力声明链路：请求头/challenge 声明经规范化后与 Bridge 实现取交集，认证前只允许握手消息。
- Java、LLBDS、PMMP 增加 `X-Capabilities`；LLBDS 移除 20 TPS、20 人和玩家状态等伪默认值。
- 收尾 U-WBP v2 协议处理器：修复响应回调关联、pong correlation、状态布尔一致性、失败码校验和不兼容版本拒绝；同步记录未完成的真实核心验收边界。

- 修复 Folia/Fabric/Forge/Nukkit 连接器时间戳从 ISO 字符串改为 Unix 毫秒整数，事件版本对齐 `2.0`
- 让 SSL/WSS 配置真实生效：提供证书时经 `https.createServer` 内建 TLS 并接管服务生命周期
- 通过 URL 查询参数携带 token 接入时发出安全告警
- 权限处理器校验 `serverId` 与连接一致，阻断跨服务器越权
- 新增 `alert.cpuHigh` 事件类型，修正 CPU 告警复用 `alert.memoryHigh`
- `unban` / `banlist` 改为明确失败而非假成功或误踢
- `getCurrentMetrics` 从桥接获取实时 CPU/延迟而非读取不存在的缓存字段
- 能力交集授权落地：`applyDeclaredCapabilities` 收紧桥接能力，未声明操作明确失败
- 反向连接 `dial_outbound_ws` 接入主生命周期：`mochi.server.register --reverse --endpoint --token` 注册即主动拨号并自动重连
- 记录本轮遗留问题（RCON 密码明文存储、连接器发起权限操作的操作者身份、Fabric/Forge 配置加载空实现）见 `docs/AUDIT.md`
后续发布应从本节生成版本条目，并附构建、测试和 Connector 验证证据。
