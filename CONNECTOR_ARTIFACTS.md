# Mochi-Link Connector 产物清单

## 概述

本文档列出了 Mochi-Link 连接器系统的所有源代码文件和配置文件。由于连接器依赖特定的服务器运行时环境，源代码已准备就绪，可在目标环境中进行编译。

## 产物结构

```
mochi-link/
├── mochi-link-connector-java/          # Paper/Spigot 连接器
│   ├── src/main/java/                  # Java 源代码
│   │   └── com/mochilink/connector/
│   │       ├── MochiLinkPlugin.java    # 主插件类
│   │       ├── commands/               # 命令处理
│   │       ├── config/                 # 配置管理
│   │       ├── connection/             # 连接管理
│   │       ├── handlers/               # 事件和命令处理器
│   │       ├── integrations/           # 插件集成
│   │       ├── monitoring/             # 性能监控
│   │       ├── protocol/               # U-WBP v2 协议
│   │       └── websocket/              # WebSocket 客户端
│   ├── src/main/resources/
│   │   ├── plugin.yml                  # 插件配置
│   │   └── config.yml                  # 默认配置
│   └── pom.xml                         # Maven 构建配置
│
├── mochi-link-connector-folia/         # Folia 连接器
│   ├── src/main/java/                  # Java 源代码（Folia 优化）
│   │   └── com/mochilink/connector/folia/
│   │       └── MochiLinkFoliaPlugin.java
│   ├── src/main/resources/
│   │   └── plugin.yml
│   └── pom.xml
│
├── mochi-link-connector-fabric/        # Fabric 模组
│   ├── src/main/java/                  # Java 源代码
│   │   └── com/mochilink/connector/fabric/
│   │       └── MochiLinkFabricMod.java
│   ├── src/main/resources/
│   │   └── fabric.mod.json             # Fabric 模组配置
│   └── build.gradle                    # Gradle 构建配置
│
├── mochi-link-connector-forge/         # Forge 模组
│   ├── src/main/java/                  # Java 源代码
│   │   └── com/mochilink/connector/forge/
│   │       └── MochiLinkForgeMod.java
│   ├── src/main/resources/
│   │   └── META-INF/
│   │       └── mods.toml               # Forge 模组配置
│   └── build.gradle                    # Gradle 构建配置
│
├── mochi-link-connector-llbds/         # LLBDS 连接器
│   ├── src/
│   │   ├── index.ts                    # LSE 插件入口
│   │   ├── external-service.ts         # 外部网络服务
│   │   ├── bridge/
│   │   │   └── LSEBridge.ts            # LSE 桥接器
│   │   ├── config/
│   │   │   └── LLBDSConfig.ts          # 配置管理
│   │   ├── handlers/
│   │   │   ├── LLBDSEventHandler.ts    # 事件处理
│   │   │   └── LLBDSCommandHandler.ts  # 命令处理
│   │   ├── monitoring/
│   │   │   ├── LLBDSPerformanceMonitor.ts      # LLBDS 性能监控
│   │   │   └── ExternalPerformanceMonitor.ts   # 外部性能监控
│   │   └── network/
│   │       └── MochiLinkConnectionManager.ts   # 连接管理
│   ├── package.json                    # npm 配置
│   └── tsconfig.json                   # TypeScript 配置
│
├── mochi-link-connector-nukkit/        # Nukkit 连接器
│   ├── src/main/java/                  # Java 源代码
│   │   └── com/mochilink/connector/nukkit/
│   │       └── MochiLinkNukkitPlugin.java
│   ├── src/main/resources/
│   │   └── plugin.yml
│   └── pom.xml
│
├── mochi-link-connector-pmmp/          # PMMP 连接器
│   ├── src/com/mochilink/connector/pmmp/
│   │   └── MochiLinkPMMPPlugin.php     # PHP 主类
│   └── plugin.yml                      # PMMP 插件配置
│
├── config-templates/                   # 配置模板
│   ├── paper-spigot-config.yml         # Java 服务器配置
│   ├── fabric-config.json              # Fabric 配置
│   └── llbds-config.json               # LLBDS 配置
│
├── build-all-connectors.bat            # Windows 构建脚本
├── build-all-connectors.sh             # Linux/Mac 构建脚本
│
└── 文档文件
    ├── CONNECTOR_DEPLOYMENT_GUIDE.md   # 部署指南
    ├── CONNECTOR_IMPLEMENTATION_SUMMARY.md  # 实现总结
    ├── CONNECTOR_COMPLETION_SUMMARY.md      # 完成总结
    ├── CONNECTOR_BUILD_STATUS.md            # 构建状态
    └── CONNECTOR_ARTIFACTS.md               # 本文件
```

## 详细文件清单

### 1. Java Edition Connectors

#### Paper/Spigot Connector (mochi-link-connector-java/)

**核心文件**:
- `MochiLinkPlugin.java` - 主插件类，生命周期管理
- `commands/MochiLinkCommand.java` - 插件命令处理
- `config/PluginConfig.java` - 配置管理器
- `connection/ConnectionManager.java` - WebSocket 连接管理
- `handlers/CommandHandler.java` - 命令执行处理
- `handlers/EventHandler.java` - 服务器事件监听
- `websocket/WebSocketClient.java` - WebSocket 客户端实现
- `protocol/UWBPv2Protocol.java` - U-WBP v2 协议实现
- `monitoring/PerformanceMonitor.java` - 性能监控

**集成模块**:
- `integrations/IntegrationManager.java` - 集成管理器
- `integrations/PlaceholderAPIIntegration.java` - PAPI 集成
- `integrations/LuckPermsIntegration.java` - LuckPerms 集成
- `integrations/VaultIntegration.java` - Vault 集成
- `integrations/PlanIntegration.java` - Plan 集成

**配置文件**:
- `plugin.yml` - Bukkit 插件描述
- `config.yml` - 默认配置模板
- `pom.xml` - Maven 项目配置

**依赖**:
- Paper API 1.20.4
- Java-WebSocket 1.5.3
- Gson 2.10.1
- PlaceholderAPI 2.11.5 (可选)
- LuckPerms API 5.4 (可选)
- Vault API 1.7 (可选)

#### Folia Connector (mochi-link-connector-folia/)

**核心文件**:
- `MochiLinkFoliaPlugin.java` - Folia 优化的主插件类
- 其他文件结构类似 Paper 连接器，但针对 Folia 的多线程架构优化

**特性**:
- 区域感知的命令执行
- 线程安全的事件处理
- 异步性能监控

### 2. Modded Java Edition Connectors

#### Fabric Connector (mochi-link-connector-fabric/)

**核心文件**:
- `MochiLinkFabricMod.java` - Fabric 模组入口
- `fabric.mod.json` - Fabric 模组配置
- `build.gradle` - Gradle 构建配置

**特性**:
- Fabric API 集成
- 客户端兼容性检查
- 模组特定配置

#### Forge Connector (mochi-link-connector-forge/)

**核心文件**:
- `MochiLinkForgeMod.java` - Forge 模组主类
- `mods.toml` - Forge 模组配置
- `build.gradle` - Gradle 构建配置

**特性**:
- Forge 事件总线集成
- 仅服务器端实现
- Forge 配置系统

### 3. Bedrock Edition Connectors

#### LLBDS Connector (mochi-link-connector-llbds/)

**架构**: LSE Plugin (轻量级) + External Node.js Service (网络通信)

**LSE 插件文件**:
- `index.ts` - LSE 插件入口点
- `bridge/LSEBridge.ts` - 轻量级 HTTP API 桥接器
- `handlers/LLBDSEventHandler.ts` - LLBDS 事件捕获
- `handlers/LLBDSCommandHandler.ts` - 命令注册和执行
- `monitoring/LLBDSPerformanceMonitor.ts` - LLBDS 内部性能监控

**外部服务文件**:
- `external-service.ts` - Node.js 外部网络服务主文件
- `network/MochiLinkConnectionManager.ts` - WebSocket 连接管理
- `monitoring/ExternalPerformanceMonitor.ts` - 系统性能监控
- `config/LLBDSConfig.ts` - 配置管理

**配置文件**:
- `package.json` - npm 项目配置
- `tsconfig.json` - TypeScript 编译配置

**依赖**:
- ws 8.14.2 - WebSocket 客户端
- express 4.18.2 - HTTP 服务器
- winston 3.11.0 - 日志系统
- node-cron 3.0.3 - 定时任务
- systeminformation 5.21.20 - 系统信息

**特点**:
- 零性能影响设计（网络操作在外部进程）
- LSE 桥接器提供 HTTP API
- 外部服务处理所有网络通信

#### Nukkit Connector (mochi-link-connector-nukkit/)

**核心文件**:
- `MochiLinkNukkitPlugin.java` - Nukkit 插件主类
- `plugin.yml` - Nukkit 插件配置
- `pom.xml` - Maven 项目配置

**特性**:
- Nukkit API 集成
- 基岩版特定事件处理
- 跨平台玩家管理

#### PMMP Connector (mochi-link-connector-pmmp/)

**核心文件**:
- `MochiLinkPMMPPlugin.php` - PHP 插件主类
- `plugin.yml` - PMMP 插件配置

**特性**:
- PHP 原生实现
- HTTP 客户端通信
- PMMP 事件监听器

## 配置模板

### paper-spigot-config.yml
```yaml
# Mochi-Link Paper/Spigot Connector Configuration
server:
  id: "server-001"
  name: "My Minecraft Server"
  
connection:
  mode: "reverse"  # reverse or forward
  host: "localhost"
  port: 25565
  ssl: false
  
authentication:
  token: "your-server-token-here"
  
features:
  player-management: true
  command-execution: true
  performance-monitoring: true
  event-streaming: true
```

### llbds-config.json
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

### fabric-config.json
```json
{
  "serverId": "fabric-server-001",
  "serverName": "My Fabric Server",
  "connection": {
    "host": "localhost",
    "port": 25565,
    "ssl": false
  },
  "authentication": {
    "token": "your-server-token-here"
  }
}
```

## 构建产物

### 预期产物

当在适当的环境中构建后，将生成以下产物：

1. **Java 连接器** (Paper/Spigot/Folia/Nukkit):
   - `MochiLinkConnector-Paper.jar` (~2-3 MB)
   - `MochiLinkConnector-Folia.jar` (~2-3 MB)
   - `MochiLinkConnector-Nukkit.jar` (~2-3 MB)

2. **Fabric 模组**:
   - `MochiLinkConnector-Fabric.jar` (~1-2 MB)

3. **Forge 模组**:
   - `MochiLinkConnector-Forge.jar` (~1-2 MB)

4. **LLBDS 连接器**:
   - `MochiLinkConnector-LLBDS/` 目录
     - `dist/` - 编译后的 JavaScript 文件
     - `node_modules/` - Node.js 依赖
     - `package.json` - 项目配置

5. **PMMP 连接器**:
   - `MochiLinkConnector-PMMP/` 目录（PHP 源代码）

## 使用说明

### 获取源代码

所有源代码已在项目目录中准备就绪：

```bash
# 查看所有连接器
ls -la mochi-link-connector-*/

# 查看配置模板
ls -la config-templates/
```

### 构建连接器

参考 `CONNECTOR_BUILD_STATUS.md` 中的详细构建说明。

### 部署连接器

参考 `CONNECTOR_DEPLOYMENT_GUIDE.md` 中的详细部署说明。

## 版本信息

- **版本**: 1.0.0
- **协议**: U-WBP v2
- **最低 Java 版本**: 17
- **最低 Node.js 版本**: 16.0
- **最低 PHP 版本**: 8.0

## 许可证

MIT License

## 技术支持

- GitHub: https://github.com/chm413/Mochi-Link
- Issues: https://github.com/chm413/Mochi-Link/issues

---

**状态**: 源代码完成，可在目标环境中构建
**最后更新**: 2024年
