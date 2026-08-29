# Mochi-Link PMMP Connector

这是 Mochi-Link 面向 PocketMine-MP 5 / PHP 8.1+ 的 Connector 源码目录。

## 当前状态

目录中包含插件清单、配置、U-WBP 消息、连接管理、命令处理、事件处理和性能采集代码，但本仓库尚未提供可复现的 PHAR 构建与真实 PMMP 装载结果。当前实现还存在以下已知限制：

- WebSocket 客户端包含简化实现和 `null` 回退路径，生产使用前应替换为经过维护的库并完成互操作测试。
- CPU 指标目前返回占位值 `0.0`，不能用于告警或容量判断。
- 源码存在不等于所有玩家、白名单、事件和重连操作已经在目标 PMMP 版本验证。

总体 Connector 状态和协议要求见 [`../../docs/CONNECTORS.md`](../../docs/CONNECTORS.md)。

## 配置

默认配置位于 `resources/config.yml`。连接方向按 Koishi 端点解释：PMMP Connector 主动连接 Koishi 时，Koishi 能力为 `accept_inbound_ws`，旧配置别名为 `forward`。

必须从 Koishi 的服务器登记/令牌轮换命令取得 token。原始 token 只展示一次，不应提交到仓库或写入日志。跨主机连接应使用 WSS/TLS。

## 协议

新消息必须使用：

- U-WBP 版本 `2.0`
- Unix epoch 毫秒时间戳
- `requestId` 关联响应
- `command.execute` 作为命令操作名

完整定义见 [`../../docs/PROTOCOL.md`](../../docs/PROTOCOL.md)。

## 开发验证

完成状态至少需要以下证据：

1. PHP 语法检查通过。
2. 构建出可安装 PHAR。
3. 在目标 PocketMine-MP 5.x 中成功装载和卸载。
4. 与当前 Koishi 插件完成认证、心跳、命令、事件和断线重连测试。
5. 不支持的能力返回明确错误，不返回占位成功结果。
