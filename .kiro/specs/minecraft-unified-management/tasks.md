# Mochi-Link 实施状态与任务

## 状态规则

本文不再使用“源码文件存在即完成”的判定方式。

- `[x]`：本轮已由代码检查和可复现命令验证。
- `[ ]`：未实现、仅部分实现、测试失败或缺少目标运行环境验证。
- 详细问题、命令和结果见 [`docs/AUDIT.md`](../../../docs/AUDIT.md)。

## 1. Koishi 插件基础

- [x] 建立 TypeScript Koishi 插件入口、配置 Schema 和 `database` 服务注入
- [x] 在真实 Koishi 4.18.11 实例中完成加载和卸载烟雾验证
- [ ] 完成 Koishi 热重载验证
- [x] 删除把插件当独立 Node.js/PM2 服务的部署脚本
- [x] 将 Koishi 仅保留为 peer/dev dependency，避免作为插件运行依赖重复加载框架

## 2. 数据库

- [ ] 统一 `simple-init.ts` 与 `models.ts` 为一套模型和迁移真源
- [x] 统一表名前缀生成，保证 `mochi`、`mochi_`、`mochi.` 指向同一组表
- [ ] 为服务器、ACL、token、审计、绑定、离线操作和玩家缓存补齐一致字段
- [ ] 验证 sqlite、mysql、postgres 的迁移和升级路径
- [ ] 明确 `group_bindings` 与 `server_bindings` 的唯一职责并迁移重复数据

## 3. U-WBP v2 与连接

- [x] 统一管理端新消息为版本 `2.0` 和 Unix epoch 毫秒时间戳
- [x] 统一管理端响应通过 `requestId` 匹配原请求
- [x] 统一管理端命令操作名为 `command.execute`，兼容读取历史 `server.command`
- [ ] 完成 `accept_inbound_ws`（Connector 主动连接 Koishi）真实握手验证
- [ ] 将 `dial_outbound_ws`（Koishi 主动连接 Connector）接入配置、注册、生命周期和重连
- [ ] 让 capabilities 实际约束请求路由，而不是只存储/展示
- [ ] 验证心跳、超时、重连上限、切换和关闭时的在途请求处理

## 4. 认证与安全

- [x] 确保已核对的 token 签发路径只保存哈希，明文只展示一次
- [ ] 统一 WebSocket 与 HTTP 的 token 查找、过期、IP 和失败错误语义
- [ ] 为 token scopes 建立数据模型、签发、迁移和中间件授权闭环
- [ ] 移除 Base64/XOR 和已废弃 cipher API 的安全能力声明
- [ ] 补充 WSS/TLS 部署与反向代理集成测试
- [ ] 验证日志、审计和异常中不泄露 token、密码或玩家敏感字段

## 5. 管理能力

- [ ] 服务器登记、查看、删除和 token 轮换端到端通过
- [ ] 玩家列表、详情、踢出和跨服身份匹配端到端通过
- [ ] 白名单在线执行、离线缓存、抵消优化和重放端到端通过
- [x] 命令执行无适配器时明确失败，不返回模拟成功
- [ ] 权限角色、委派深度、过期和服务器隔离端到端通过
- [ ] 审计查询、过滤、导出和追加写约束端到端通过
- [ ] 事件订阅、过滤、统计和群组转发端到端通过
- [ ] 实现规格要求的群组与服务器多对多绑定及冲突选择策略

## 6. HTTP API

- [ ] 对照实际路由校准 OpenAPI 文档
- [ ] 接通 scopes、限流、CORS、输入校验和统一错误响应
- [ ] 验证批量与异步任务语义，或从当前需求中移除未采用的设计
- [x] 增加本地真实 HTTP 健康检查、监听与关闭烟雾验证
- [ ] 为其余 HTTP 管理路由增加真实服务集成测试

## 7. Connector

- [ ] Java/Paper Connector 在目标核心上构建、装载、认证和执行验证
- [ ] Folia Connector 在区域调度约束下完成同等验证
- [ ] Fabric Connector 完成配置加载并通过 Loom 构建/运行验证
- [ ] Forge Connector 完成配置加载并通过 ForgeGradle 构建/运行验证
- [ ] Nukkit Connector 在锁定 API 版本上完成构建/运行验证
- [ ] LLBDS Connector 在对应 SDK 和服务端版本上完成构建/运行验证
- [ ] PMMP Connector 移除占位指标并完成 PHAR 构建/运行验证
- [ ] 建立跨 Connector 的 U-WBP 互操作测试矩阵

## 8. 质量门槛

- [x] `npm run build` 通过并保证 `src/` 与 `lib/` 同步
- [x] TypeScript 类型检查通过
- [ ] Jest 全量测试通过且无强制中断或开放句柄
- [ ] ESLint 无 error；warning 数量有明确基线和收敛计划
- [x] `npm pack --dry-run` 仅包含运行所需文件
- [x] 当前 15 个 Markdown 文件的内部链接检查通过
- [ ] 发布前在至少一个 Java 核心和一个 Bedrock 核心完成真实冒烟测试

## 9. Web Dashboard

- [ ] Dashboard 未开始；见 `../web-dashboard/` 路线图

Dashboard 必须等待 HTTP/OpenAPI、scopes 和实时事件契约稳定后再实现。
