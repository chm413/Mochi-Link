# 连接器产物目录
# Connector Artifacts Directory

**最后更新**: 2026-02-20  
**状态**: ✅ 全部完成 (7/7)

---

## 产物列表 / Artifacts List

### ✅ Java Edition 连接器 (5 个)

1. **MochiLinkConnector-Paper.jar** (0.48 MB)
   - 平台: Paper / Spigot
   - 版本: 1.0.0
   - Java 版本: 17
   - 支持: Paper 1.20.4+, Spigot 1.20.4+
   - 特性: 完整功能，插件集成（PlaceholderAPI, LuckPerms, Vault）

2. **MochiLinkConnector-Folia.jar** (0.45 MB)
   - 平台: Folia
   - 版本: 1.0.0
   - Java 版本: 17
   - 支持: Folia 1.20.4+
   - 特性: 区域调度器支持，多线程优化

3. **MochiLinkConnector-Fabric.jar** (0.44 MB)
   - 平台: Fabric
   - 版本: 1.0.0
   - Java 版本: 17
   - 支持: Fabric 1.20.4+
   - 特性: 轻量级模组，快速加载

4. **MochiLinkConnector-Forge.jar** (0.44 MB)
   - 平台: Forge
   - 版本: 1.0.0
   - Java 版本: 17
   - 支持: Forge 1.20.4+
   - 特性: 强大的模组平台

5. **MochiLinkConnector-Nukkit.jar** (0.45 MB)
   - 平台: Nukkit / PowerNukkit
   - 版本: 1.0.0
   - Java 版本: 17
   - 支持: PowerNukkit 1.6.0.0-PN+
   - 特性: Bedrock Edition 支持

### ✅ Bedrock Edition 连接器 (2 个)

6. **MochiLinkConnector-LLBDS/** (~0.5 MB)
   - 平台: LLBDS (LiteLoaderBDS)
   - 版本: 1.0.0
   - 运行时: Node.js 16+
   - 特性: LSE 桥接，HTTP API，TypeScript

7. **MochiLinkConnector-PMMP/** (~0.2 MB)
   - 平台: PocketMine-MP
   - 版本: 1.0.0
   - 运行时: PHP 8.0+
   - 特性: 基础功能，轻量级

---

## 产物大小统计 / Size Statistics

| 连接器 | 大小 | 类型 | 平台 |
|--------|------|------|------|
| Paper | 0.48 MB | JAR | Java Edition |
| Folia | 0.45 MB | JAR | Java Edition |
| Fabric | 0.44 MB | JAR | Java Edition |
| Forge | 0.44 MB | JAR | Java Edition |
| Nukkit | 0.45 MB | JAR | Bedrock Edition |
| LLBDS | ~0.5 MB | Node.js | Bedrock Edition |
| PMMP | ~0.2 MB | PHP | Bedrock Edition |
| **总计** | **~3.1 MB** | - | - |

---

## U-WBP v2 协议支持 / Protocol Support

所有已完成的连接器都实现了 U-WBP v2 协议：

- ✅ 协议版本: 2.0
- ✅ 消息类型: request, response, event, system
- ✅ 系统操作: handshake, disconnect, ping/pong
- ✅ 事件类型: player.join, player.leave, player.chat, player.death, server.metrics
- ✅ 命令执行: command.execute

---

## 部署说明 / Deployment Instructions

### Java Edition (Paper/Spigot/Folia/Fabric/Forge/Nukkit)

1. 复制 JAR 文件到服务器的 `plugins/` 或 `mods/` 目录
2. 启动服务器，插件会自动生成配置文件
3. 编辑 `plugins/MochiLink/config.yml` 或 `config/mochilink.yml` 配置连接信息
4. 重启服务器或使用 `/mlreconnect` 命令重新连接

### LLBDS (Node.js)

1. 复制整个 `MochiLinkConnector-LLBDS/` 目录到 LLBDS 服务器
2. 运行 `npm install` 安装依赖
3. 编辑 `config/config.json` 配置连接信息
4. 运行 `node index.js` 启动连接器

### PocketMine-MP (PHP)

1. 复制整个 `MochiLinkConnector-PMMP/` 目录到 PocketMine-MP 的 `plugins/` 目录
2. 启动服务器，插件会自动生成配置文件
3. 编辑配置文件
4. 重启服务器

---

## 配置示例 / Configuration Example

```yaml
server:
  host: "your-server.com"
  port: 8080
  token: "your-token"
  use-ssl: false

auto-reconnect:
  enabled: true
  interval: 30

performance:
  monitoring-enabled: true
  report-interval: 60
```

---

## 验证安装 / Verify Installation

### Paper/Spigot/Folia/Nukkit

```
/plugins
# 应该看到 "MochiLink" 插件

/mlstatus
# 查看连接状态

/mlreconnect
# 重新连接到管理服务器
```

### Fabric/Forge

```
/mods
# 应该看到 "MochiLink Connector" 模组

# 查看日志确认连接状态
```

### LLBDS

```bash
# 检查日志
tail -f logs/connector.log

# 检查 HTTP API
curl http://localhost:8081/api/status
```

---

## 技术规格 / Technical Specifications

### 依赖项

**Java 连接器**:
- Java 17+
- WebSocket 客户端: Java-WebSocket 1.5.3
- JSON 处理: Gson 2.10.1

**LLBDS 连接器**:
- Node.js 16+
- WebSocket: ws 8.x
- HTTP 服务器: express 4.x
- TypeScript 5.x

**PMMP 连接器**:
- PHP 8.0+
- PocketMine-MP API 5.x

### 网络要求

- WebSocket 连接: ws:// 或 wss://
- 默认端口: 8080
- 支持代理: 是
- 支持 SSL/TLS: 是

---

## 平台兼容性 / Platform Compatibility

### Java Edition

| 平台 | 最低版本 | 推荐版本 | 状态 |
|------|----------|----------|------|
| Paper | 1.20.4 | 1.20.4+ | ✅ 完全支持 |
| Spigot | 1.20.4 | 1.20.4+ | ✅ 完全支持 |
| Folia | 1.20.4 | 1.20.4+ | ✅ 完全支持 |
| Fabric | 1.20.4 | 1.20.4+ | ✅ 完全支持 |
| Forge | 1.20.4 | 1.20.4+ | ✅ 完全支持 |

### Bedrock Edition

| 平台 | 最低版本 | 推荐版本 | 状态 |
|------|----------|----------|------|
| Nukkit | - | PowerNukkit 1.6.0.0-PN+ | ✅ 完全支持 |
| LLBDS | - | 最新版 | ✅ 完全支持 |
| PocketMine-MP | 5.0 | 5.x | ✅ 完全支持 |

---

## 故障排除 / Troubleshooting

### 连接失败

1. 检查服务器地址和端口是否正确
2. 检查防火墙设置
3. 检查令牌是否正确
4. 查看插件日志文件

### 性能问题

1. 调整性能监控间隔
2. 检查服务器资源使用情况
3. 优化配置参数

### 兼容性问题

1. 确认服务器版本符合要求
2. 检查依赖插件是否安装
3. 查看控制台错误信息

---

## 更新日志 / Changelog

### v1.0.0 (2026-02-20)

- ✅ 初始版本发布
- ✅ 支持 7 个平台
- ✅ 实现 U-WBP v2 协议
- ✅ 完整的配置管理
- ✅ 自动重连功能
- ✅ 性能监控功能

---

## 技术支持 / Technical Support

- **GitHub**: https://github.com/chm413/Mochi-Link
- **Issues**: https://github.com/chm413/Mochi-Link/issues
- **文档**: 项目根目录的文档文件

---

**构建日期**: 2026-02-20  
**构建工具**: Gradle 9.1.0  
**协议版本**: U-WBP v2.0  
**完成度**: 100% (7/7)
