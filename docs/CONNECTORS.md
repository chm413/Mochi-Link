# Connector 状态

## 源码清单

| 目录 | 目标核心 | 当前结论 |
| --- | --- | --- |
| `connectors/java` | Paper/Spigot 类 Bukkit 核心 | 有源码和构建配置，需真实服务端验证 |
| `connectors/folia` | Folia | 有源码和构建配置，需真实调度模型验证 |
| `connectors/fabric` | Fabric | 有源码；配置加载仍有 TODO，完整构建依赖 Loom |
| `connectors/forge` | Forge | 有源码；配置加载仍有 TODO，完整构建依赖 ForgeGradle |
| `connectors/nukkit` | Nukkit | 有源码和构建配置，需目标 API 版本验证 |
| `connectors/llbds` | LiteLoaderBDS | 有源码，需对应 SDK/运行环境验证 |
| `connectors/pmmp` | PocketMine-MP | 有源码；部分性能指标仍是占位实现 |

仓库没有独立 Mohist、Geyser 或原生 BDS Connector。兼容某个衍生核心必须以实际构建和运行测试为依据，不能由 Bukkit/Bedrock 分类直接推导。

## 一致性要求

所有 Connector 新实现应满足：

1. 发送 U-WBP 版本 `2.0`。
2. 发送 Unix epoch 毫秒时间戳。
3. 使用 `command.execute`，仅兼容读取 `server.command`。
4. 响应通过 `requestId` 指向请求。
5. 认证成功后再发送 capabilities。
6. 不支持的操作返回明确失败，不返回模拟成功或占位数据。
7. token 不写日志、不写配置模板默认值以外的生成产物。
8. 网络跨主机时使用 WSS/TLS。

## 构建原则

Java 类 Connector 应优先使用仓库自带 Gradle Wrapper，并锁定目标 Minecraft/API 版本。Fabric 与 Forge 的简化 Gradle 配置只能验证与核心无关的逻辑，不能证明插件可装载。

PMMP、LLBDS 等非 JVM Connector 需要各自运行时和 SDK；仅做语法检查不等同于协议和服务端 API 兼容。

本次审计的构建结果会记录在 [AUDIT.md](AUDIT.md)，未列出成功证据的 Connector 一律视为“未验证”。
