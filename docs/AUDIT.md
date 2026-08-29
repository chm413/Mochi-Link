# 文档与实现审计

审计日期：2026-08-29
审计对象：Koishi 管理端、U-WBP 定义、数据库与认证路径、Connector 源码、测试和现有文档。

## 结论

Mochi-Link 的设计目标合理：通过 Koishi 与统一 Connector 协议管理多核心 Minecraft 服务器。当前仓库已经具备可装载的 Koishi 插件、入站 WebSocket、HTTP API、基础管理服务和多类 Connector 源码，但整体仍是“部分实现”，不能称为生产就绪或所有 Connector 已验证。

本轮先收敛概念和文档，再修复会破坏基础正确性的实现，最后在 Koishi 4.18.11 与内存数据库上完成真实启动、健康检查、数据库表访问和正常卸载测试。

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

## 仍存在问题

### P1

1. **完整测试套件未通过**：全量 Jest 仍包含安全服务断言、插件集成解析、白名单缓存、监控/事件状态泄漏、旧接口类型和缺失测试夹具等失败，并在属性测试阶段出现长时间无新输出。
2. **ESLint 基线较差**：当前为 781 个问题（129 errors、652 warnings），主要是未使用变量、显式 `any` 和调试输出。
3. **两套数据库模型并存**：`simple-init.ts` 与完整 models/operations 路径仍有字段和职责漂移，尚未形成唯一迁移真源。

### P2

1. **绑定基数不一致**：设计目标是群组与服务器多对多，当前主要命令流程仍按一群一服选择主服务器。
2. **scopes 未形成闭环**：HTTP 中间件存在权限概念，但 token 模型、签发、迁移和路由授权尚未贯通。
3. **应用层加密不可用**：仓库仍含 Base64/XOR 模拟和废弃 cipher API；当前机密性只能依赖正确部署的 TLS/WSS。
4. **主动外连未完整接入**：`dial_outbound_ws` 相关客户端类存在，但注册、配置、生命周期和重连没有形成完整运行路径。
5. **国际化未落地**：语言文件被打包，但主要命令文本仍以硬编码为主。
6. **Connector 缺少目标环境证据**：七类源码存在不等于已在对应服务端版本构建、装载并互操作通过，部分实现仍有 TODO 或占位数据。
7. **Web Dashboard 未实现**：当前仅保留路线图规格。
8. **开发依赖审计告警**：完整 `npm audit` 有 10 个 moderate，均来自 Koishi 开发工具链的 `file-type` 传递依赖；生产依赖审计为 0。

## 当前能力矩阵

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Koishi 插件装载、HTTP/WS 监听与卸载 | 已验证 | Koishi 4.18.11 + memory database 烟雾测试通过 |
| Connector 主动连接 Koishi | 部分实现 | WebSocket 服务端、token 与挑战认证路径存在，尚缺真实 Connector 握手 |
| Koishi 主动连接 Connector | 部分实现 | 客户端类存在，未完整接入主生命周期 |
| 服务器/玩家/白名单/命令命令组 | 部分实现 | 命令入口存在，仍需真实 Connector 端到端验证 |
| 权限与审计 | 部分实现 | 服务存在，边界和全量测试仍需收敛 |
| HTTP API | 部分实现 | `/api/health` 已真实监听验证，scopes 和其余路由仍需端到端核对 |
| 群服多对多 | 未实现 | 当前主要流程仍是一群一服 |
| Web Dashboard | 未实现 | 仅保留路线图规格 |
| 七类 Connector 源码 | 已存在 | 不等于全部构建和运行验证 |

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `npm run build` | exit 0 |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| 本轮 15 个定向 Jest suite | 15 suites / 146 tests passed，exit 0 |
| `npm run lint -- --no-fix` | 781 problems（129 errors、652 warnings），exit 1 |
| `npm audit --omit=dev --json` | 生产依赖 0 vulnerabilities，exit 0 |
| `npm pack --dry-run --json` | 191 entries，仅包含 LICENSE、README、package、`lib/`、`locales/`，exit 0 |
| `npm test -- --runInBand --forceExit --silent` | 多个 suite 失败后长时间停滞，人工中止，exit 1 |

本地 Koishi 烟雾测试的关键输出如下：

```text
KOISHI_VERSION=4.18.11
PLUGIN_NAME=mochi-link
HTTP_HEALTH=200 success=true
WS_PORT=18080 reachable=true
DATABASE_TABLE=smoke_servers rows=0
SMOKE_RESULT=PASS
```

烟雾环境位于 Git 已忽略的 `build-output/koishi-smoke/`，使用内存数据库，不属于仓库交付物，也不会进入 GitHub 提交。
