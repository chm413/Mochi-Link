# 开发与验证

## Koishi 插件

```bash
npm ci
npm run build
npx tsc -p tsconfig.json --noEmit
npm test -- --runInBand --forceExit
npm run lint -- --no-fix
npm pack --dry-run
```

`npm run build` 生成并更新 `lib/`。仓库提交了构建产物，因此源码变更后必须检查 `src/` 与 `lib/` 是否同步。

## 辅助脚本

```bash
npm run setup
npm run check
npm run dev -- <subcommand>
```

`scripts/dev.js` 要求子命令，直接执行 `npm run dev` 会失败。Mochi-Link 必须由 Koishi 加载；`node lib/index.js` 正常退出不代表插件成功启动。

独立进程用的 `start` / PM2 部署脚本已移除。正确部署方式是在 Koishi 配置中启用插件并由 Koishi 管理生命周期。

## 测试分层

1. 类型检查：发现 TypeScript 接口和构建错误。
2. 单元/属性测试：验证协议、数据库、认证、权限和服务行为。
3. 集成测试：必须明确外部依赖是否真实或模拟，不得把全模拟测试写成真实端到端验证。
4. Connector 构建：只证明目标 SDK 下可编译。
5. 真实运行测试：在对应 Minecraft 核心上完成握手、命令、事件、重连和关闭验证。

所有报告必须记录命令、提交、环境、退出码和失败项。只写“全部通过”而没有原始命令与结果，不构成验证证据。

## 文档规则

- `README.md`：入口、安装、能力边界。
- `docs/ARCHITECTURE.md`：当前统一术语和架构约束。
- `docs/PROTOCOL.md`：协议真源。
- `.kiro/specs/`：最初目标和路线图，不代表完成状态。
- `docs/AUDIT.md`：当前实现差距和最近验证结果。

临时修复报告、会话总结、自动生成的“完成”文档不提交到根目录。可复用结论应合并到上述文档或提交信息。
