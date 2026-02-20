# 连接器部署指南
# Connector Deployment Guide

**版本**: 1.0.0  
**日期**: 2026-02-20  
**协议**: U-WBP v2.0

---

## 概述 / Overview

本指南提供了所有 Mochi-Link 连接器的详细部署说明。目前已完成 5 个连接器，覆盖 Java Edition 和 Bedrock Edition 的主流服务器平台。

**已完成的连接器**:
- ✅ Paper/Spigot (Java Edition)
- ✅ Folia (Java Edition)
- ✅ Nukkit/PowerNukkit (Bedrock Edition)
- ✅ LLBDS (Bedrock Edition)
- ✅ PocketMine-MP (Bedrock Edition)

---

## 系统要求 / System Requirements

### Java Edition 连接器

| 连接器 | Java 版本 | 服务器版本 | 内存 |
|--------|-----------|------------|------|
| Paper/Spigot | 17+ | 1.20.4+ | 512MB+ |
| Folia | 17+ | 1.20.4+ | 1GB+ |
| Nukkit | 17+ | PowerNukkit 1.6.0.0-PN+ | 512MB+ |

### Bedrock Edition 连接器

| 连接器 | 运行时 | 服务器版本 | 内存 |
|--------|--------|------------|------|
| LLBDS | Node.js 16+ | LLBDS 最新版 | 512MB+ |
| PMMP | PHP 8.0+ | PocketMine-MP 5.x | 512MB+ |

---

## 部署步骤 / Deployment Steps

### 1. Paper/Spigot 连接器

#### 步骤 1: 下载产物

```bash
# 从构建目录复制
cp build-output/MochiLinkConnector-Paper.jar /path/to/server/plugins/
```

#### 步骤 2: 首次启动

```bash
cd /path/to/server
./start.sh  # 或 start.bat (Windows)
```

服务器会自动生成配置文件：
- `plugins/MochiLink/config.yml`
- `plugins/MochiLink/logs/`

#### 步骤 3: 配置连接

编辑 `plugins/MochiLink/config.yml`:

```yaml
# 管理服务器连接配置
server:
  host: "your-mochilink-server.com"  # 管理服务器地址
  port: 8080                          # WebSocket 端口
  token: "your-server-token"          # 认证令牌
  use-ssl: false                      # 是否使用 SSL/TLS

# 自动重连设置
auto-reconnect:
  enabled: true                       # 启用自动重连
  interval: 30                        # 重连间隔（秒）

# 性能监控
performance:
  monitoring-enabled: true            # 启用性能监控
  report-interval: 60                 # 报告间隔（秒）

# 插件集成（可选）
integrations:
  placeholderapi: true                # PlaceholderAPI 集成
  luckperms: true                     # LuckPerms 集成
  vault: true                         # Vault 集成
```

#### 步骤 4: 重启服务器

```bash
# 在服务器控制台执行
/stop

# 重新启动
./start.sh
```

#### 步骤 5: 验证安装

```bash
# 在服务器控制台或游戏中执行
/plugins
# 应该看到 "MochiLink" 插件显示为绿色

/mlstatus
# 查看连接状态，应该显示 "Connected"

/mlreconnect
# 测试重新连接功能
```

---

### 2. Folia 连接器

Folia 连接器的部署步骤与 Paper/Spigot 相同，但需要注意：

**特殊配置**:
- Folia 使用区域调度器，性能监控会自动适配
- 不支持某些 Paper 插件集成（如 PlaceholderAPI）

**配置文件**: 与 Paper 相同，但移除不支持的集成选项

```yaml
server:
  host: "your-mochilink-server.com"
  port: 8080
  token: "your-server-token"
  use-ssl: false

auto-reconnect:
  enabled: true
  interval: 30

performance:
  monitoring-enabled: true
  report-interval: 60

# Folia 不支持插件集成
# integrations 部分可以省略
```

---

### 3. Nukkit/PowerNukkit 连接器

#### 步骤 1: 下载产物

```bash
cp build-output/MochiLinkConnector-Nukkit.jar /path/to/nukkit/plugins/
```

#### 步骤 2: 首次启动

```bash
cd /path/to/nukkit
./start.sh  # 或 start.bat (Windows)
```

#### 步骤 3: 配置连接

编辑 `plugins/MochiLink/config.yml`:

```yaml
server:
  host: "your-mochilink-server.com"
  port: 8080
  token: "your-server-token"
  use-ssl: false

auto-reconnect:
  enabled: true
  interval: 30

performance:
  monitoring-enabled: true
  report-interval: 60
```

#### 步骤 4: 验证安装

```bash
# 在服务器控制台执行
plugins
# 应该看到 "MochiLink" 插件

mochilink status
# 查看连接状态
```

---

### 4. LLBDS 连接器

#### 步骤 1: 复制插件目录

```bash
cp -r build-output/MochiLinkConnector-LLBDS /path/to/llbds/plugins/
```

#### 步骤 2: 安装依赖

```bash
cd /path/to/llbds/plugins/MochiLinkConnector-LLBDS
npm install
```

**依赖项**:
- ws (WebSocket 客户端)
- express (HTTP 服务器)
- 其他依赖见 package.json

#### 步骤 3: 创建配置文件

创建 `config/config.json`:

```json
{
  "server": {
    "host": "your-mochilink-server.com",
    "port": 8080,
    "token": "your-server-token",
    "useSsl": false
  },
  "autoReconnect": {
    "enabled": true,
    "interval": 30
  },
  "lse": {
    "enabled": true,
    "port": 25580
  },
  "performance": {
    "monitoringEnabled": true,
    "reportInterval": 60
  },
  "httpApi": {
    "enabled": true,
    "port": 8081
  }
}
```

#### 步骤 4: 启动连接器

```bash
# 方式 1: 直接运行
node index.js

# 方式 2: 使用 PM2（推荐）
pm2 start index.js --name mochilink-llbds

# 方式 3: 后台运行
nohup node index.js > logs/connector.log 2>&1 &
```

#### 步骤 5: 验证安装

```bash
# 检查日志
tail -f logs/connector.log

# 测试 HTTP API
curl http://localhost:8081/api/status

# 测试 LSE 桥接
telnet localhost 25580
```

---

### 5. PocketMine-MP 连接器

#### 步骤 1: 复制插件目录

```bash
cp -r build-output/MochiLinkConnector-PMMP /path/to/pmmp/plugins/
```

#### 步骤 2: 启动服务器

```bash
cd /path/to/pmmp
./start.sh  # 或 start.bat (Windows)
```

#### 步骤 3: 配置连接

PocketMine-MP 会自动生成配置文件，编辑配置：

```yaml
server:
  host: "your-mochilink-server.com"
  port: 8080
  token: "your-server-token"
  use-ssl: false

auto-reconnect:
  enabled: true
  interval: 30

performance:
  monitoring-enabled: true
  report-interval: 60
```

#### 步骤 4: 验证安装

```bash
# 在服务器控制台执行
plugins
# 应该看到 "MochiLinkConnector-PMMP" 插件
```

---

## 网络配置 / Network Configuration

### 防火墙规则

确保以下端口可以访问：

| 服务 | 端口 | 协议 | 方向 |
|------|------|------|------|
| WebSocket | 8080 | TCP | 出站 |
| HTTP API (LLBDS) | 8081 | TCP | 入站 |
| LSE (LLBDS) | 25580 | TCP | 入站 |

### 代理配置

如果需要通过代理连接，可以配置：

```yaml
server:
  host: "your-mochilink-server.com"
  port: 8080
  token: "your-server-token"
  use-ssl: false
  proxy:
    enabled: true
    host: "proxy.example.com"
    port: 3128
    username: "proxy-user"
    password: "proxy-pass"
```

---

## 安全配置 / Security Configuration

### SSL/TLS 配置

启用 SSL/TLS 加密连接：

```yaml
server:
  host: "your-mochilink-server.com"
  port: 8443  # HTTPS 端口
  token: "your-server-token"
  use-ssl: true
  ssl:
    verify-certificate: true
    ca-cert: "/path/to/ca.crt"  # 可选
```

### 令牌管理

**生成令牌**:
```bash
# 使用 OpenSSL 生成随机令牌
openssl rand -hex 32
```

**令牌轮换**:
1. 在管理服务器上生成新令牌
2. 更新所有连接器的配置文件
3. 重启连接器或使用 `/mlreconnect` 命令

---

## 监控和日志 / Monitoring and Logging

### 日志位置

| 连接器 | 日志位置 |
|--------|----------|
| Paper/Spigot | `plugins/MochiLink/logs/` |
| Folia | `plugins/MochiLink/logs/` |
| Nukkit | `plugins/MochiLink/logs/` |
| LLBDS | `plugins/MochiLinkConnector-LLBDS/logs/` |
| PMMP | `plugins/MochiLinkConnector-PMMP/logs/` |

### 日志级别

配置日志级别：

```yaml
logging:
  level: INFO  # DEBUG, INFO, WARN, ERROR
  file:
    enabled: true
    max-size: 10MB
    max-files: 5
  console:
    enabled: true
```

### 性能监控

查看性能指标：

```bash
# Paper/Spigot/Folia/Nukkit
/mlstatus

# LLBDS (HTTP API)
curl http://localhost:8081/api/metrics
```

---

## 故障排除 / Troubleshooting

### 常见问题

#### 1. 连接失败

**症状**: 插件显示 "Disconnected" 状态

**解决方案**:
1. 检查管理服务器是否运行
2. 验证服务器地址和端口
3. 检查防火墙规则
4. 验证令牌是否正确
5. 查看日志文件

```bash
# 查看连接日志
tail -f plugins/MochiLink/logs/latest.log
```

#### 2. 插件无法加载

**症状**: 服务器启动时插件未加载

**解决方案**:
1. 检查 Java/Node.js/PHP 版本
2. 验证 JAR 文件完整性
3. 检查依赖是否安装（LLBDS）
4. 查看服务器启动日志

```bash
# Paper/Spigot/Folia/Nukkit
cat logs/latest.log | grep MochiLink

# LLBDS
cat logs/connector.log
```

#### 3. 性能问题

**症状**: 服务器延迟增加

**解决方案**:
1. 调整性能监控间隔
2. 减少事件上报频率
3. 检查网络延迟
4. 优化配置参数

```yaml
performance:
  monitoring-enabled: true
  report-interval: 120  # 增加到 2 分钟
  event-throttle: 100   # 限制事件频率
```

#### 4. 内存泄漏

**症状**: 内存使用持续增长

**解决方案**:
1. 更新到最新版本
2. 检查日志文件大小
3. 配置日志轮换
4. 重启连接器

```yaml
logging:
  file:
    max-size: 5MB      # 减小日志文件大小
    max-files: 3       # 减少保留文件数
```

---

## 升级指南 / Upgrade Guide

### 升级步骤

1. **备份配置文件**:
   ```bash
   cp plugins/MochiLink/config.yml plugins/MochiLink/config.yml.backup
   ```

2. **停止服务器**:
   ```bash
   /stop
   ```

3. **替换 JAR 文件**:
   ```bash
   cp build-output/MochiLinkConnector-Paper.jar /path/to/server/plugins/
   ```

4. **检查配置兼容性**:
   - 对比新旧配置文件
   - 添加新配置项
   - 移除废弃配置项

5. **启动服务器**:
   ```bash
   ./start.sh
   ```

6. **验证升级**:
   ```bash
   /mlstatus
   ```

---

## 性能优化 / Performance Optimization

### 推荐配置

**小型服务器** (< 50 玩家):
```yaml
performance:
  monitoring-enabled: true
  report-interval: 60
  event-throttle: 50
```

**中型服务器** (50-200 玩家):
```yaml
performance:
  monitoring-enabled: true
  report-interval: 90
  event-throttle: 100
```

**大型服务器** (> 200 玩家):
```yaml
performance:
  monitoring-enabled: true
  report-interval: 120
  event-throttle: 200
```

---

## 最佳实践 / Best Practices

1. **定期备份配置文件**
2. **使用 SSL/TLS 加密连接**
3. **定期轮换认证令牌**
4. **监控日志文件大小**
5. **配置自动重连**
6. **使用防火墙限制访问**
7. **定期更新到最新版本**
8. **测试环境先行部署**

---

## 技术支持 / Technical Support

- **GitHub**: https://github.com/chm413/Mochi-Link
- **Issues**: https://github.com/chm413/Mochi-Link/issues
- **文档**: 项目根目录的文档文件

---

**版本**: 1.0.0  
**最后更新**: 2026-02-20  
**维护者**: chm413
