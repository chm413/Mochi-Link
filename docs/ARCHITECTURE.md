# 架构与概念定义

## 1. 设计目的

Mochi-Link 的最初目标是构建一个由 Koishi 驱动的 Minecraft 统一管理层：不同 Java/Bedrock 核心通过 Connector 暴露统一能力，Koishi 在同一套权限、审计、群组路由、WebSocket 和 HTTP API 上管理多台服务器。

该目标是规范，不代表当前版本已经全部实现。当前差距以 [AUDIT.md](AUDIT.md) 为准。

## 2. 组件边界

### Koishi 插件

运行在 Koishi 生命周期内，依赖 Koishi `database` 服务，负责：

- 服务器登记与配置持久化
- Connector 认证和连接管理
- 命令、权限、审计、群组路由
- WebSocket 和 HTTP API
- 跨核心数据标准化

它不是可通过 `node lib/index.js` 或 PM2 单独启动的服务。

### Connector

运行在 Minecraft 服务端或与其同机，负责：

- 将 Paper/Folia/Fabric/Forge/Nukkit/LLBDS/PMMP 等原生 API 转换为 U-WBP
- 执行命令和玩家/白名单操作
- 上报事件、状态和性能指标
- 维护与 Koishi 的认证连接

### U-WBP v2

Unified WebSocket Bridge Protocol v2。它定义消息外壳、操作名、请求响应关联、认证、心跳和能力声明。协议定义见 [PROTOCOL.md](PROTOCOL.md)。

## 3. 连接方向

方向定义必须声明观察方。本项目统一从 **Koishi 端点** 描述：

| 字段 | Koishi 行为 | Connector 行为 | 旧别名 |
| --- | --- | --- | --- |
| `accept_inbound_ws=true` | 监听并接受连接 | 主动拨号 | `forward` |
| `dial_outbound_ws=true` | 主动拨号 | 监听并接受连接 | `reverse` |

规则：

1. 新配置、接口、日志和文档使用能力字段，不使用“正向/反向”推导行为。
2. `forward` / `reverse` 只作为兼容别名，含义固定为上表，不随观察方变化。
3. 当前配置要求两项能力中恰有一项为 `true`，不支持同一配置双活。
4. 当前主要可用路径是 `accept_inbound_ws`；`dial_outbound_ws` 尚未完整接入插件启动与服务器注册流程。

## 4. 接入方式

接入方式描述 Koishi 如何操作 Minecraft 服务端，与 WebSocket 谁主动连接无关：

| 模式 | 定义 | 当前状态 |
| --- | --- | --- |
| `plugin` | 通过 U-WBP Connector 调用核心 API | 主路径，仍需逐 Connector 验证 |
| `rcon` | 通过 Minecraft RCON 执行有限命令 | 有适配器，能力小于插件模式 |
| `terminal` | 通过本机进程终端执行有限命令 | 有适配器，部署和权限边界需额外控制 |

能力协商应决定可调用操作，不能用接入模式名称假定所有能力都存在。

## 5. 身份与数据定义

- `serverId`：Mochi-Link 内的稳定服务器标识，不等同于主机名、端口或 Minecraft MOTD。
- `userId`：Koishi 会话中的用户标识；必须结合平台/频道上下文处理，不应假定全局唯一。
- `playerId`：优先使用在线模式 UUID 或 Bedrock XUID。名称和 IP 只能作为辅助线索。
- `capabilities`：Connector 可随请求头或握手声明，Koishi 仅在认证成功后采信，并与 Bridge 本地实现能力取交集；认证前声明不可信。
- `binding`：群组/频道与服务器的路由记录。设计目标是多对多；当前实现是一个群组最多绑定一台服务器，而一台服务器可绑定多个群组。
- `token`：一次性展示的认证秘密。持久化层只允许保存 `token_hash`、过期时间和策略字段。

## 6. 数据模型真源

表名必须通过统一表名生成器产生：去掉配置前缀末尾的 `.` 或 `_`，再用单个 `_` 连接基础表名。例如 `mochi`、`mochi_` 和 `mochi.` 都应解析为 `mochi_servers`。

当前仓库曾同时存在简化初始化器和完整模型定义，两者字段不一致。修复期间以运行时实际注册到 `ctx.model` 的表结构为准，后续应合并为一套迁移驱动的模型。

## 7. 安全边界

- 认证哈希不能替代传输加密。跨主机部署应使用 WSS/TLS。
- 当前应用层 AES/RSA 实现不构成可用的安全协议，不纳入当前能力承诺。
- Connector 认证失败对外统一返回 `AUTH_FAILED`，避免泄露 serverId 是否存在。
- 管理操作需要 Koishi authority、服务器 ACL 和操作权限共同约束。
- 审计表当前提供应用层追加写约束，不等同于不可篡改日志。
- API token scopes 是设计目标；在数据模型和中间件端到端接通前不能作为已实现能力。

## 8. 生命周期

1. Koishi 注入数据库服务并加载插件。
2. 插件注册模型、服务、命令、WebSocket 和 HTTP 处理器。
3. 管理员登记服务器并一次性取得 Connector token。
4. Connector 建立连接并完成认证。
5. Koishi 采用已认证的能力声明，并与 Bridge 实现能力取交集后决定可路由操作。
6. 请求使用 `requestId` 关联响应；断线时未完成请求超时失败。
7. 插件卸载时关闭监听器、连接、计时器和服务。
