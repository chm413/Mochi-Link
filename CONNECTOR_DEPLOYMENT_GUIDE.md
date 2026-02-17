# Mochi-Link 连接器部署指南
# Mochi-Link Connector Deployment Guide

本指南详细说明如何为不同类型的Minecraft服务器部署Mochi-Link连接器插件和模组。

This guide provides detailed instructions for deploying Mochi-Link connector plugins and mods for different types of Minecraft servers.

## 📋 目录 / Table of Contents

1. [系统要求 / System Requirements](#系统要求--system-requirements)
2. [Java版服务器 / Java Edition Servers](#java版服务器--java-edition-servers)
3. [模组服务器 / Modded Servers](#模组服务器--modded-servers)
4. [基岩版服务器 / Bedrock Edition Servers](#基岩版服务器--bedrock-edition-servers)
5. [配置说明 / Configuration](#配置说明--configuration)
6. [故障排除 / Troubleshooting](#故障排除--troubleshooting)

## 🔧 系统要求 / System Requirements

### 通用要求 / General Requirements
- **Mochi-Link管理系统**: 已部署并运行的Mochi-Link服务器
- **网络连接**: 服务器能够访问Mochi-Link管理系统
- **权限**: 服务器管理员权限

### Java版要求 / Java Edition Requirements
- **Java**: JDK/JRE 17或更高版本
- **服务器版本**: Minecraft 1.20.4+

### 基岩版要求 / Bedrock Edition Requirements
- **Node.js**: 16.0+（LLBDS）
- **PHP**: 8.0+（PMMP）
- **Java**: JDK/JRE 17+（Nukkit）

## 🎮 Java版服务器 / Java Edition Servers

### Paper/Spigot 服务器

#### 1. 下载插件
```bash
# 从构建输出目录获取
cp build-output/MochiLinkConnector-Paper.jar /path/to/server/plugins/
```

#### 2. 安装插件
1. 将 `MochiLinkConnector-Paper.jar` 复制到服务器的 `plugins/` 目录
2. 重启服务器
3. 插件将自动生成配置文件

#### 3. 配置插件
编辑 `plugins/MochiLinkConnector/config.yml`:

```yaml
# Mochi-Link管理系统连接配置
connection:
  # 管理系统WebSocket地址
  host: "localhost"
  port: 8080
  # 是否使用SSL/TLS
  ssl: false
  # 连接超时时间（毫秒）
  timeout: 30000
  
# 服务器标识
server:
  # 服务器唯一ID（在管理系统中注册）
  id: "my-paper-server"
  # 服务器显示名称
  name: "我的Paper服务器"
  # 服务器类型
  type: "Paper"
  
# 认证配置
auth:
  # API令牌（从管理系统获取）
  token: "your-api-token-here"
  
# 自动重连配置
reconnect:
  # 是否启用自动重连
  enabled: true
  # 重连间隔（秒）
  interval: 30
  # 最大重连次数
  maxAttempts: 10
  
# 功能配置
features:
  # 是否启用玩家事件推送
  playerEvents: true
  # 是否启用服务器状态监控
  serverMonitoring: true
  # 是否启用命令执行
  commandExecution: true
  # 是否启用性能监控
  performanceMonitoring: true
```

#### 4. 验证安装
```bash
# 在服务器控制台执行
/mochilink status
```

### Folia 服务器

#### 1. 安装步骤
与Paper类似，但使用 `MochiLinkConnector-Folia.jar`

#### 2. 特殊配置
Folia版本针对多线程架构进行了优化：

```yaml
# Folia特定配置
folia:
  # 是否启用区域感知功能
  regionAware: true
  # 线程池大小
  threadPoolSize: 4
```

## 🔧 模组服务器 / Modded Servers

### Fabric 服务器

#### 1. 前置要求
- Fabric Loader 0.15.3+
- Fabric API 0.91.0+

#### 2. 安装模组
```bash
# 复制模组文件
cp build-output/MochiLinkConnector-Fabric.jar /path/to/server/mods/
```

#### 3. 配置文件
配置文件位置: `config/mochi-link-connector-fabric.json`

```json
{
  "connection": {
    "host": "localhost",
    "port": 8080,
    "ssl": false,
    "timeout": 30000
  },
  "server": {
    "id": "my-fabric-server",
    "name": "我的Fabric服务器",
    "type": "Fabric"
  },
  "auth": {
    "token": "your-api-token-here"
  },
  "fabric": {
    "useAsyncScheduler": true,
    "enableMixins": false
  }
}
```

### Forge 服务器

#### 1. 前置要求
- Minecraft Forge 49.0.31+

#### 2. 安装模组
```bash
# 复制模组文件
cp build-output/MochiLinkConnector-Forge.jar /path/to/server/mods/
```

#### 3. 配置文件
配置文件位置: `config/mochi-link-connector-forge.toml`

```toml
[connection]
host = "localhost"
port = 8080
ssl = false
timeout = 30000

[server]
id = "my-forge-server"
name = "我的Forge服务器"
type = "Forge"

[auth]
token = "your-api-token-here"

[forge]
useEventBus = true
enableNetworking = true
```

## 🏗️ 基岩版服务器 / Bedrock Edition Servers

### LLBDS (LiteLoaderBDS) 服务器

#### 1. 前置要求
- Node.js 16.0+
- LLBDS 2.0+

#### 2. 安装插件
```bash
# 复制插件目录
cp -r build-output/MochiLinkConnector-LLBDS /path/to/llbds/plugins/
cd /path/to/llbds/plugins/MochiLinkConnector-LLBDS
npm install
```

#### 3. 配置文件
编辑 `plugins/MochiLinkConnector-LLBDS/config.json`:

```json
{
  "connection": {
    "host": "localhost",
    "port": 8080,
    "ssl": false,
    "timeout": 30000
  },
  "server": {
    "id": "my-llbds-server",
    "name": "我的LLBDS服务器",
    "type": "LLBDS"
  },
  "auth": {
    "token": "your-api-token-here"
  },
  "llbds": {
    "useNativeEvents": true,
    "enableScriptEngine": true
  }
}
```

### Nukkit 服务器

#### 1. 安装插件
```bash
# 复制插件文件
cp build-output/MochiLinkConnector-Nukkit.jar /path/to/nukkit/plugins/
```

#### 2. 配置文件
编辑 `plugins/MochiLinkConnector/config.yml`:

```yaml
connection:
  host: "localhost"
  port: 8080
  ssl: false
  timeout: 30000
  
server:
  id: "my-nukkit-server"
  name: "我的Nukkit服务器"
  type: "Nukkit"
  
auth:
  token: "your-api-token-here"
  
nukkit:
  useAsyncTasks: true
  enableProtocolSupport: true
```

### PMMP (PocketMine-MP) 服务器

#### 1. 安装插件
```bash
# 复制插件目录
cp -r build-output/MochiLinkConnector-PMMP /path/to/pmmp/plugins/
```

#### 2. 配置文件
编辑 `plugins/MochiLinkConnector-PMMP/config.yml`:

```yaml
connection:
  host: "localhost"
  port: 8080
  ssl: false
  timeout: 30000
  
server:
  id: "my-pmmp-server"
  name: "我的PMMP服务器"
  type: "PMMP"
  
auth:
  token: "your-api-token-here"
  
pmmp:
  useAsyncTasks: true
  enableApiVersion: "5.0.0"
```

## ⚙️ 配置说明 / Configuration

### 通用配置项 / Common Configuration

#### 连接配置 / Connection Configuration
- `host`: Mochi-Link管理系统的主机地址
- `port`: WebSocket端口（默认8080）
- `ssl`: 是否启用SSL/TLS加密
- `timeout`: 连接超时时间

#### 服务器配置 / Server Configuration
- `id`: 服务器唯一标识符（必须在管理系统中注册）
- `name`: 服务器显示名称
- `type`: 服务器类型（Paper、Folia、Fabric、Forge、LLBDS、Nukkit、PMMP）

#### 认证配置 / Authentication Configuration
- `token`: API令牌（从Mochi-Link管理系统获取）

### 获取API令牌 / Getting API Token

1. 登录Mochi-Link管理系统
2. 进入"服务器管理"页面
3. 点击"添加服务器"
4. 填写服务器信息并生成令牌
5. 复制令牌到配置文件中

### 高级配置 / Advanced Configuration

#### SSL/TLS配置
如果启用SSL，需要确保：
1. Mochi-Link管理系统配置了有效的SSL证书
2. 服务器能够验证SSL证书
3. 防火墙允许HTTPS连接

#### 性能优化
```yaml
performance:
  # 事件处理线程池大小
  eventThreads: 2
  # 监控数据上报间隔（秒）
  monitoringInterval: 30
  # 缓存大小
  cacheSize: 1000
```

## 🔍 故障排除 / Troubleshooting

### 常见问题 / Common Issues

#### 1. 连接失败
**症状**: 插件无法连接到管理系统

**解决方案**:
```bash
# 检查网络连接
ping your-mochi-link-host

# 检查端口是否开放
telnet your-mochi-link-host 8080

# 检查防火墙设置
# Linux
sudo ufw status
# Windows
netsh advfirewall show allprofiles
```

#### 2. 认证失败
**症状**: 连接建立但认证失败

**解决方案**:
1. 验证API令牌是否正确
2. 检查服务器ID是否在管理系统中注册
3. 确认令牌未过期

#### 3. 插件加载失败
**症状**: 服务器启动时插件无法加载

**解决方案**:
```bash
# 检查Java版本
java -version

# 检查插件依赖
# 对于Paper/Spigot
ls plugins/

# 对于Fabric
ls mods/
```

#### 4. 性能问题
**症状**: 服务器性能下降

**解决方案**:
1. 调整监控间隔
2. 减少事件推送频率
3. 优化缓存设置

### 日志分析 / Log Analysis

#### Java版插件日志
```bash
# 查看插件日志
tail -f logs/latest.log | grep MochiLink

# 查看详细调试信息
# 在config.yml中设置
debug: true
```

#### 基岩版插件日志
```bash
# LLBDS日志
tail -f logs/server.log | grep MochiLink

# Nukkit日志
tail -f logs/server.log | grep MochiLink

# PMMP日志
tail -f server.log | grep MochiLink
```

### 性能监控 / Performance Monitoring

#### 监控指标
- CPU使用率
- 内存使用量
- 网络延迟
- 连接状态

#### 监控命令
```bash
# 检查连接状态
/mochilink status

# 查看性能统计
/mochilink stats

# 测试连接
/mochilink test
```

## 📚 更多资源 / Additional Resources

### 文档链接 / Documentation Links
- [主项目文档](README.md)
- [API文档](API_DOCUMENTATION.md)
- [配置参考](CONFIGURATION_REFERENCE.md)

### 支持渠道 / Support Channels
- GitHub Issues: https://github.com/chm413/Mochi-Link/issues
- 讨论区: https://github.com/chm413/Mochi-Link/discussions

### 更新说明 / Update Notes
定期检查更新以获取最新功能和安全修复：

```bash
# 检查版本
/mochilink version

# 更新插件
# 1. 下载最新版本
# 2. 停止服务器
# 3. 替换插件文件
# 4. 启动服务器
```

---

**注意**: 本指南基于Mochi-Link v1.0.0编写。不同版本可能存在配置差异，请参考对应版本的文档。

**Note**: This guide is written for Mochi-Link v1.0.0. Different versions may have configuration differences, please refer to the documentation for the corresponding version.