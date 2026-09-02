# Connector 状态

## 源码清单

| 目录 | 目标核心 | 当前结论 |
| --- | --- | --- |
| `connectors/java` | Paper/Spigot 类 Bukkit 核心 | Paper 1.20.4 API 下编译及 3 项协议单测通过；尚未在真实服务端装载 |
| `connectors/folia` | Folia | 有源码和构建配置，需真实调度模型验证 |
| `connectors/fabric` | Fabric | 有源码；配置加载仍有 TODO，完整构建依赖 Loom |
| `connectors/forge` | Forge | 有源码；配置加载仍有 TODO，完整构建依赖 ForgeGradle |
| `connectors/nukkit` | Nukkit | 有源码和构建配置，需目标 API 版本验证 |
| `connectors/llbds` | LiteLoaderBDS | TypeScript 编译与 HMAC/pong 协议烟测通过；尚未在 LiteLoaderBDS 中装载 |
| `connectors/pmmp` | PocketMine-MP | PHP 8.2 语法、协议/帧烟测及 PMMP API 5 源码核对通过；尚未在 PMMP 服务端装载 |

仓库没有独立 Mohist、Geyser 或原生 BDS Connector。兼容某个衍生核心必须以实际构建和运行测试为依据，不能由 Bukkit/Bedrock 分类直接推导。

## 一致性要求

所有 Connector 新实现应满足：

1. 发送 U-WBP 版本 `2.0`。
2. 发送 Unix epoch 毫秒时间戳。
3. 使用 `command.execute`，仅兼容读取 `server.command`。
4. 响应通过 `requestId` 指向请求。
5. capabilities 可随 upgrade 请求头或 challenge 握手发送，但 Koishi 只能在认证成功后采信。
6. 不支持的操作返回明确失败，不返回模拟成功或占位数据。
7. token 不写日志、不写配置模板默认值以外的生成产物。
8. 网络跨主机时使用 WSS/TLS。
9. token 通过 upgrade 请求头传输，不写入新客户端 URL 或消息日志。

## 本轮已核对的跨端契约

- Java、LLBDS、PMMP 均生成 `system/handshake` challenge 应答，HMAC 消息固定为 `${challenge}:${token}:${challengeTimestamp}`。
- Java、LLBDS、PMMP 的静态 token 连接均通过 `X-Capabilities` 声明实际能力；Koishi 认证后将声明与本地 Bridge 支持集合取交集。
- Java、LLBDS、PMMP 对 `system/ping` 返回带 `requestId` 的 `system/pong`。
- Java、LLBDS、PMMP 均支持规范 `server.getInfo`、`server.getStatus`、`server.getMetrics`、`player.list`、`player.getInfo` 和 `command.execute`；历史别名只作输入兼容。
- Java 白名单响应以 `players: string[]` 为规范字段，并在兼容期保留旧 `whitelist` 对象数组。
- LLBDS 优先使用 `runcmdEx` 的真实成功状态和输出；无运行时快照时返回不可用，不制造在线数据。
- LLBDS 不再把 API 缺失伪装成 `20 TPS`、`20 人上限`、默认世界/难度、满血或当前加入时间。
- PMMP 命令输出由 `ConsoleCommandSender` 捕获，API 调用按 PocketMine-MP API 5 核对；CPU 指标使用相邻样本的进程 CPU 时间差，首个样本或平台不支持时为 0。

## 构建原则

Java 类 Connector 应提交 Gradle Wrapper 并锁定目标 Minecraft/API 版本。当前 `connectors/java` 尚无 Wrapper，本轮使用系统 Gradle 9.1.0 和 Java 21 启动器执行 Java 17 toolchain 构建。Fabric 与 Forge 的简化 Gradle 配置只能验证与核心无关的逻辑，不能证明插件可装载。

PMMP、LLBDS 等非 JVM Connector 需要各自运行时和 SDK；语法、协议烟测和 API 源码核对仍不等同于真实 Minecraft 服务端装载。PMMP 可以关停当前进程，但不能自行启动替代进程，因此 `server.restart` 必须返回 `UNSUPPORTED_OPERATION`；重启由外部进程管理器负责。

本次审计的构建结果会记录在 [AUDIT.md](AUDIT.md)，未列出成功证据的 Connector 一律视为“未验证”。
