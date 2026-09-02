# 文档与实现审计

审计日期：2026-09-02
审计对象：Koishi 管理端、U-WBP 定义、数据库与认证路径、Connector 源码、测试和现有文档。

## 结论

Mochi-Link 的设计目标合理：通过 Koishi 与统一 Connector 协议管理多核心 Minecraft 服务器。当前仓库已经具备可装载的 Koishi 插件、入站 WebSocket、HTTP API、基础管理服务和多类 Connector 源码，但整体仍是“部分实现”，不能称为生产就绪或所有 Connector 已验证。

本轮先收敛概念和文档，再修复会破坏基础正确性的实现，随后在 Koishi 4.18.11 与内存数据库上完成真实启动，并用三个独立 WebSocket 客户端验证 Java、Bedrock 和 challenge 认证方向的双向协议互通。U-WBP v2 的认证、能力协商、请求关联、心跳、错误响应和状态一致性闭环已在管理端完成；目标 Minecraft 服务端本体仍未装载，因此不能把本轮结果表述为 Paper、LLBDS 或 PMMP 运行时验收。

## 本轮已修复

| 问题 | 修复结果 |
| --- | --- |
| 表名前缀分裂 | 所有已核对路径统一经过表名构造器；`mochi`、`mochi_`、`mochi.` 均生成 `mochi_*` |
| token 明文持久化 | 新签发路径只保存哈希，原始 token 仅在创建/轮换响应中返回一次；保留旧明文行的兼容读取 |
| 连接方向冲突 | 以 Koishi 为观察点定义 `accept_inbound_ws` 与 `dial_outbound_ws`，旧 `forward`/`reverse` 仅作兼容映射 |
| U-WBP 字段漂移 | 新消息统一为版本 `2.0`、Unix 毫秒整数时间戳、响应 `requestId` 和 `command.execute` |
| 无适配器伪成功 | Java Bridge 没有活动适配器时返回明确失败，健康检查返回不健康 |
| Koishi 生命周期泄漏 | 服务清理逐项执行；白名单、玩家缓存、连接管理器和认证挑战定时器均进入卸载路径 |
| 事件模板失效 | 允许使用事件数据中真实存在且名称合法的动态占位符，同时保留危险内容检查 |
| 部署模型错误 | 删除把 Koishi 插件当独立 Node.js/PM2 服务的脚本，Koishi 仅保留 peer/dev dependency |
| Challenge 认证不可互通 | Java、LLBDS、PMMP 与 Koishi 统一使用 `system/handshake` 和 `${challenge}:${token}:${challengeTimestamp}` HMAC |
| 心跳类型与关联漂移 | ping/pong 统一为 system 消息，pong 使用 `requestId` 指向 ping |
| Java/基岩数据伪造 | Bridge 优先使用规范 `server.getInfo/getStatus/getMetrics`；无真实快照时不再构造随机或默认在线数据 |
| 部分更新破坏主键/标签 | 数据库映射只输出显式字段，更新路径强制移除主键和创建时间 |
| Connector 凭据暴露面 | Java、LLBDS、PMMP 新连接使用 upgrade 请求头传 token，不再放入 URL；Java verbose 日志不再输出消息正文 |
| Java/PMMP API 漂移 | Java 在 Paper 1.20.4 API 下构建；PMMP 的命令发送者、白名单、UUID、权限和性能 API 按 API 5 源码修正 |
| 能力声明与认证边界漂移 | 能力词表独立于认证实现；请求头/challenge 声明认证后规范化，并与 Bridge 实现能力取交集；认证前只允许握手 |
| 协议处理器关联缺陷 | 修复响应处理器自递归覆写、请求响应操作不匹配、system pong 返回丢失和旧适配器延迟关联错误 |
| 状态与错误响应不完整 | `server.getStatus` 强制 `status`/`online` 一致；失败响应强制大写下划线 `data.code`；不兼容协议版本在 upgrade 阶段拒绝 |

## 仍存在问题

### P1

1. **完整测试套件未通过**：全量 Jest 仍包含安全服务、插件集成解析、随机高延迟属性和旧超时默认值等失败；本轮 Connector/协议定向测试已通过，但不能替代全量回归。
2. **ESLint 基线较差**：当前为 810 个问题（124 errors、686 warnings），主要是未使用变量、显式 `any` 和调试输出；本轮未把既有 lint 基线扩大为发布阻断。
3. **两套数据库模型并存**：`simple-init.ts` 与完整 models/operations 路径仍有字段和职责漂移，尚未形成唯一迁移真源。

### P2

1. **绑定基数不一致**：设计目标是群组与服务器多对多，当前主要命令流程仍按一群一服选择主服务器。
2. **scopes 未形成闭环**：HTTP 中间件存在权限概念，但 token 模型、签发、迁移和路由授权尚未贯通。
3. **应用层加密不可用**：仓库仍含 Base64/XOR 模拟和废弃 cipher API；当前机密性只能依赖正确部署的 TLS/WSS。
4. **RCON 密码明文落库**：`connection_config` 中 RCON 密码仍以明文存储；本轮按决定跳过，需密钥派生/密钥库方案后再处理。
5. **连接器发起权限操作的操作者身份不可溯源**：连接器作为服务器（而非用户）认证，权限写操作的操作者仍记为 `system`；已通过跨服校验与 owner 校验保证写操作失败关闭，但无法溯源到具体管理员。
6. **Fabric/Forge 配置加载为空实现**：`FabricModConfig.load()`、`ForgeModConfig.load()` 仍是 TODO 空桩；且 Loom/ForgeGradle 不兼容 Gradle 9.1.0，当前无法编译验证。
7. **国际化未落地**：语言文件被打包，但主要命令文本仍以硬编码为主。
8. **Connector 缺少目标运行时证据**：Java 已构建，LLBDS/PMMP 已完成协议烟测和 API 核对，但尚未在对应 Minecraft 服务端装载；其余 Connector 仍只有不同程度的源码证据。
9. **Web Dashboard 未实现**：当前仅保留路线图规格。
10. **开发依赖审计告警**：完整 `npm audit` 有 10 个 moderate，均来自 Koishi 开发工具链的 `file-type` 传递依赖；生产依赖审计为 0。

## 当前能力矩阵

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Koishi 插件装载、HTTP/WS 监听与卸载 | 已验证 | Koishi 4.18.11 + memory database 烟雾测试通过 |
| Connector 主动连接 Koishi | 协议互通已验证 | 静态 token、challenge-HMAC、系统心跳及在线状态已由独立 WebSocket 客户端实测；目标游戏运行时未验证 |
| Koishi 主动连接 Connector | 部分实现 | 客户端类存在，未完整接入主生命周期 |
| 服务器/玩家/白名单/命令命令组 | 部分实现 | 跨端字段和路由已核对，仍需目标游戏运行时端到端验证 |
| 权限与审计 | 部分实现 | 服务存在，边界和全量测试仍需收敛 |
| HTTP API | 部分实现 | `/api/health` 已真实监听验证，scopes 和其余路由仍需端到端核对 |
| 群服多对多 | 未实现 | 当前主要流程仍是一群一服 |
| Web Dashboard | 未实现 | 仅保留路线图规格 |
| Java Connector | 构建/协议已验证 | Gradle 构建与 3 项协议单测通过，尚未装载 Paper/Spigot |
| LLBDS Connector | 编译/协议已验证 | TypeScript 编译与 HMAC/pong 烟测通过，尚未装载 LiteLoaderBDS |
| PMMP Connector | 语法/API/协议已验证 | PHP 8.2 lint、API 5 源码核对和协议/帧烟测通过，尚未装载 PocketMine-MP |
| 其余 Connector | 源码存在 | 不等于构建和运行验证 |

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `npm run build` | exit 0 |
| 协议/WebSocket/Bridge/数据库/适配器定向 Jest suite | 14 suites / 149 tests passed，exit 0 |
| `gradle clean test --no-daemon`（Java） | BUILD SUCCESSFUL；3 tests passed，exit 0 |
| `npm run build` + `npm run test:protocol`（LLBDS） | `LLBDS_PROTOCOL_RESULT=PASS`，exit 0 |
| `php tests/protocol-smoke.php`（PMMP） | `PMMP_PROTOCOL_RESULT=PASS`，exit 0 |
| PMMP `src/` 与 `tests/` 全部 PHP 文件 `php -l` | 12 files syntax valid，exit 0 |
| 本地 Koishi Connector 互通脚本 | `INTEROP_RESULT=PASS`，exit 0 |
| `npm run lint -- --no-fix` | 810 problems（124 errors、686 warnings），exit 1；记录为既有基线问题 |
| `npm audit --omit=dev --json` | 生产依赖 0 vulnerabilities，exit 0 |
| `npm pack --dry-run --json` | `koishi-plugin-mochi-link-1.7.0.tgz`、193 entries、unpacked 1817358 bytes，exit 0 |
| `npm test -- --runInBand --forceExit` | 多个既有 suite 失败；监控属性 suite 运行 194.889s 并连续超时，随后人工中止，exit 1 |

本地 Koishi 烟雾测试的关键输出如下：

```text
KOISHI_VERSION=4.18.11
PLUGIN_NAME=mochi-link
HTTP_HEALTH=200 success=true
WS_PORT=18080 reachable=true
DATABASE_TABLE=smoke_servers rows=0
SMOKE_RESULT=PASS
```

本轮 Connector 互通关键输出：

```text
KOISHI_WS=18280
JAVA_REQUESTS=1
BEDROCK_REQUESTS=server.getInfo
JAVA_RESPONSE=requestId:connector-request-1,ownId:true
SYSTEM_PONG=requestId:connector-ping-1,type:system
CHALLENGE_AUTH=PASS
SERVER_STATUSES={"java-real":"online","bedrock-real":"online","challenge-real":"online"}
INTEROP_RESULT=PASS
```

烟雾环境位于 Git 已忽略的 `build-output/koishi-smoke/`，使用内存数据库，不属于仓库交付物，也不会进入 GitHub 提交。

## 收尾边界

- 本次提交包含管理端源码、同步后的 `lib/`、Java/LLBDS/PMMP 相关 Connector 源码、测试和正式文档。
- 各 Connector 的 `.gradle/`、Node 依赖、Koishi smoke 环境、互通脚本输出和回滚审计副本均为本地验证产物，不进入 GitHub。
- 全量 Jest、真实 Minecraft 核心装载、token scopes、主动外连完整生命周期、应用层加密和其余 Connector 构建仍是后续工作；这些事项不影响本轮已验证的 U-WBP v2 核心闭环结论。
