# Mochi-Link (大福连)

Mochi-Link 是一个 Koishi 插件项目，目标是在 Koishi 中通过统一协议管理不同 Minecraft 服务端。管理端负责服务器登记、认证、权限、审计、群组路由和 API；各服务端 Connector 负责把核心原生能力转换为 U-WBP v2 消息。

> 当前版本仍处于开发和一致性修复阶段。仓库包含较完整的管理端与 7 类 Connector 源码，但测试套件仍有失败项，部分设计目标尚未接通。部署前请先阅读 [审计与实现状态](docs/AUDIT.md)。

## 当前范围

管理端已有以下实现入口：

- Koishi 命令：服务器、权限、白名单、玩家、命令执行、事件订阅、群组绑定和审计
- WebSocket 管理端和 U-WBP v2 消息处理
- HTTP API、中间件和 OpenAPI 相关代码
- Koishi 数据库模型、令牌认证、权限与审计服务
- Java/Paper、Folia、Fabric、Forge、Nukkit、LLBDS、PMMP Connector 源码

当前不能视为已完成的能力：

- Koishi 主动拨号到 Connector 的完整运行链路
- 群组到多台服务器的多对多路由；当前实现限制为一个群组绑定一台服务器
- API token scopes 的端到端授权
- 应用层 AES/RSA 加密；敏感链路应使用 WSS/TLS
- Web 管理面板
- 所有 Connector 的真实核心环境构建与运行验证

## 关键定义

连接方向一律从 **Koishi 端点** 描述：

| 能力字段 | 含义 | 旧配置别名 |
| --- | --- | --- |
| `accept_inbound_ws` | Koishi 监听，Connector 主动连接 Koishi | `forward` |
| `dial_outbound_ws` | Koishi 主动连接 Connector，Connector 监听 | `reverse` |

`forward` / `reverse` 容易因观察方不同产生相反解释，只用于兼容旧配置。新文档、日志和代码应优先使用能力字段。

`plugin`、`rcon`、`terminal` 是服务器接入方式，不是 WebSocket 连接方向。完整术语见 [架构与概念定义](docs/ARCHITECTURE.md)。

## 安装与运行

该包必须由 Koishi 加载，不是独立 Node.js 服务。仓库当前没有可用的 npm registry 发布版本，可从 GitHub 安装或在 Koishi 工作区中引用本地目录。

```bash
npm install github:chm413/Mochi-Link#master
```

Koishi 配置示例：

```yaml
plugins:
  mochi-link:
    websocket:
      host: 0.0.0.0
      port: 8080
    http:
      host: 127.0.0.1
      port: 8081
      cors: false
    database:
      prefix: mochi
```

插件声明 `database` 为必需服务。令牌明文只在生成或重新生成时展示一次；数据库只应保存哈希。生产网络应启用 WSS/TLS，并限制 HTTP 和 WebSocket 的监听地址、防火墙及反向代理访问范围。

## 常用命令

```text
mochi.server.list
mochi.server.register <id> <name>
mochi.server.token <id> [-r]
mochi.server.info [id]
mochi.player.list [serverId]
mochi.whitelist.add [serverId] <player>
mochi.exec [serverId] <command...>
mochi.bind.add <serverId>
mochi.audit
```

完整命令与权限要求见 [命令参考](docs/COMMANDS.md)。

## 开发验证

```bash
npm ci
npm run build
npx tsc -p tsconfig.json --noEmit
npm test -- --runInBand
npm run lint -- --no-fix
```

`npm run dev` 是仓库辅助脚本，必须带 `setup`、`check` 等子命令；不要用 `npm start` 或直接执行 `lib/index.js` 启动插件。详见 [开发指南](docs/DEVELOPMENT.md)。

## 文档

- [架构与概念定义](docs/ARCHITECTURE.md)
- [U-WBP v2 协议](docs/PROTOCOL.md)
- [命令参考](docs/COMMANDS.md)
- [Connector 状态](docs/CONNECTORS.md)
- [开发与验证](docs/DEVELOPMENT.md)
- [审计与实现状态](docs/AUDIT.md)
- [最初需求规格](.kiro/specs/minecraft-unified-management/requirements.md)

## License

[MIT](LICENSE)
