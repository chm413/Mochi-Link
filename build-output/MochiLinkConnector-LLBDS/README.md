# Mochi-Link LLBDS Connector
# 大福连 LLBDS 连接器

## 版本信息
- 版本: 1.0.0
- 编译日期: 2026-02-16
- 协议: U-WBP v2

## 架构说明

LLBDS 连接器采用独特的双进程架构：

```
LLBDS Server (Minecraft)
    ↓
LSE Plugin (轻量级，在 LLBDS 进程内)
    ↓ HTTP API
External Node.js Service (独立进程，处理网络通信)
    ↓ WebSocket
Mochi-Link Management System (Koishi)
```

### LSE 插件入口

LSE 通过 `package.json` 的 `main` 字段识别插件入口：

```json
{
  "name": "mochi-link-connector-llbds",
  "main": "src/index.js",
  ...
}
```

当 LLBDS 加载插件时，会：
1. 读取 `package.json` 找到 `main` 字段
2. 加载 `src/index.js` 文件
3. 调用导出的 `main()` 函数初始化插件
4. 卸载时调用 `cleanup()` 函数清理资源

### 为什么使用这种架构？

1. **零性能影响**: 所有网络通信在独立的 Node.js 进程中处理，不影响 Minecraft 服务器性能
2. **稳定性**: 网络问题不会导致 Minecraft 服务器崩溃
3. **灵活性**: 可以独立重启网络服务而不影响游戏服务器

## 安装步骤

### 1. 安装 Node.js 依赖

```bash
cd MochiLinkConnector-LLBDS
npm install --production
```

### 2. 配置连接器

编辑 `src/config/config.json` (如果不存在，创建它):

```json
{
  "serverId": "llbds-server-001",
  "serverName": "My LLBDS Server",
  "connection": {
    "mochiLinkHost": "localhost",
    "mochiLinkPort": 25565,
    "httpPort": 25580,
    "externalServicePort": 25581
  },
  "authentication": {
    "token": "your-server-token-here"
  },
  "features": {
    "playerManagement": true,
    "commandExecution": true,
    "performanceMonitoring": true,
    "eventStreaming": true
  }
}
```

### 3. 部署到 LLBDS

将整个 `MochiLinkConnector-LLBDS` 目录复制到 LLBDS 的 `plugins/` 目录：

```bash
# Windows
xcopy /s /e MochiLinkConnector-LLBDS "C:\LLBDS\plugins\MochiLinkConnector-LLBDS\"

# Linux
cp -r MochiLinkConnector-LLBDS /path/to/llbds/plugins/
```

### 4. 启动外部服务

在 LLBDS 服务器**外部**启动 Node.js 服务：

```bash
cd /path/to/llbds/plugins/MochiLinkConnector-LLBDS
node src/external-service.js
```

**重要**: 外部服务必须在 LLBDS 服务器启动之前或同时启动。

### 5. 启动 LLBDS 服务器

正常启动 LLBDS 服务器，LSE 插件会自动加载。

## 验证安装

### 检查 LSE 插件状态

在 LLBDS 控制台中运行：

```
mochilink status
```

### 检查外部服务状态

访问健康检查端点：

```bash
curl http://localhost:25581/health
```

应该返回：

```json
{
  "status": "ok",
  "service": "mochi-link-external-service",
  "version": "1.0.0",
  "connected": true
}
```

## 游戏内命令

### 玩家命令

- `/mochilink status` - 查看连接状态
- `/mochilink help` - 显示帮助信息
- `/mlstatus` - 快速查看状态
- `/mlreload` - 重新加载配置

### 控制台命令

- `mochilink status` - 查看详细状态
- `mochilink connect` - 连接到 Mochi-Link
- `mochilink disconnect` - 断开连接
- `mochilink reload` - 重新加载配置

## 文件结构

```
MochiLinkConnector-LLBDS/
├── src/
│   ├── index.js                    # LSE 插件入口
│   ├── external-service.js         # 外部网络服务
│   ├── bridge/
│   │   └── LSEBridge.js            # LSE 桥接器
│   ├── config/
│   │   └── LLBDSConfig.js          # 配置管理
│   ├── handlers/
│   │   ├── LLBDSEventHandler.js    # 事件处理
│   │   └── LLBDSCommandHandler.js  # 命令处理
│   ├── monitoring/
│   │   ├── LLBDSPerformanceMonitor.js      # LLBDS 性能监控
│   │   └── ExternalPerformanceMonitor.js   # 外部性能监控
│   └── network/
│       └── MochiLinkConnectionManager.js   # 连接管理
├── package.json
├── package-lock.json
└── README.md (本文件)
```

## 端口说明

- **25580**: LSE Bridge HTTP API 端口（LLBDS 进程内）
- **25581**: External Service HTTP API 端口（独立进程）
- **25565**: Mochi-Link WebSocket 端口（可配置）

确保这些端口没有被其他程序占用。

## 故障排除

### LSE 插件无法加载

1. 检查 LLBDS 日志中的错误信息
2. 确认文件权限正确
3. 验证 LLBDS 版本兼容性

### 外部服务无法启动

1. 检查 Node.js 版本 (需要 16.0+)
2. 确认端口 25581 未被占用
3. 检查 `logs/external-service.log` 日志文件

### 无法连接到 Mochi-Link

1. 验证 Mochi-Link 服务器地址和端口
2. 检查防火墙设置
3. 确认认证 token 正确
4. 查看外部服务日志

### 性能问题

1. 检查外部服务的 CPU 和内存使用
2. 调整性能监控频率
3. 禁用不需要的功能

## 日志文件

- `logs/external-service.log` - 外部服务日志
- `logs/external-service-error.log` - 外部服务错误日志
- LLBDS 控制台 - LSE 插件日志

## 更新连接器

1. 停止外部服务
2. 停止 LLBDS 服务器
3. 备份当前配置文件
4. 替换连接器文件
5. 恢复配置文件
6. 重新启动服务

## 技术支持

- GitHub: https://github.com/chm413/Mochi-Link
- Issues: https://github.com/chm413/Mochi-Link/issues

## 许可证

MIT License

---

**编译状态**: ✅ 已编译为 JavaScript
**最后更新**: 2026-02-16
