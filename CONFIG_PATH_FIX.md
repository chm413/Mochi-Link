# 配置路径修复指南

## ❌ 发现的问题

配置文件模板中的路径与 Java 代码读取的路径不匹配！

### 错误的配置（旧模板）:
```yaml
server:
  id: "my-paper-server"  # ❌ 错误路径

auth:
  token: "your-api-token-here"  # ❌ 错误路径
```

### Java 代码实际读取的路径:
```java
serverId = config.getString("authentication.server_id", "my-minecraft-server");
apiToken = config.getString("authentication.token", "your-api-token-here");
```

## ✅ 正确的配置

### 必须使用以下路径:
```yaml
authentication:
  server_id: "my-paper-server"  # ✅ 正确路径
  token: "your-api-token-here"  # ✅ 正确路径
```

## 🔧 完整的正确配置示例

```yaml
# 连接配置
connection:
  mode: "forward"
  forward:
    host: "172.16.200.1"  # Koishi 服务器地址
    port: 8080            # Koishi WebSocket 端口
    ssl: false
  options:
    auto_reconnect: true
    reconnect_interval: 30
    heartbeat_interval: 30

# ⚠️ 认证配置 - 最重要！
authentication:
  # 从 Koishi 获取的 64 字符 token
  token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
  
  # 服务器 ID（必须与 Koishi 中注册的完全一致）
  server_id: "folia-survival"
  
  # IP 白名单（可选）
  ip_whitelist_enabled: false

# 功能配置
features:
  enabled_modules:
    - "player_management"
    - "command_execution"
    - "performance_monitoring"
  
  player_management:
    sync_join_leave: true
    sync_chat: true
    sync_death: true
    sync_advancement: true
  
  command_execution:
    allow_console_commands: true
    command_timeout: 30000
    command_blacklist:
      - "stop"
      - "restart"
      - "op"

# 日志配置
logging:
  level: "INFO"
  verbose_connection: false
  log_events: true
  log_commands: true

# 安全配置
security:
  enable_encryption: false
  verify_message_integrity: true

# 调试配置
debug:
  enabled: false
```

## 📝 如何修复现有配置

如果你已经有一个配置文件，需要修改：

### 步骤 1: 备份现有配置
```bash
cp plugins/MochiLinkConnectorFolia/config.yml plugins/MochiLinkConnectorFolia/config.yml.backup
```

### 步骤 2: 修改配置文件

将以下内容：
```yaml
server:
  id: "folia-survival"

auth:
  token: "your-token-here"
```

改为：
```yaml
authentication:
  server_id: "folia-survival"
  token: "your-token-here"
```

### 步骤 3: 添加连接配置

确保有完整的连接配置：
```yaml
connection:
  mode: "forward"
  forward:
    host: "172.16.200.1"
    port: 8080
    ssl: false
  options:
    auto_reconnect: true
    reconnect_interval: 30
    heartbeat_interval: 30
```

### 步骤 4: 重启服务器

```bash
stop
# 等待服务器完全停止
# 启动服务器
```

## 🧪 验证配置

启动后检查日志：

### ✅ 成功的日志:
```
[INFO]: [MochiLinkConnectorFolia] Configuration loaded successfully
[INFO]: [MochiLinkConnectorFolia] Server ID: folia-survival
[INFO]: [MochiLinkConnectorFolia] Connecting to: ws://172.16.200.1:8080/ws
[INFO]: [MochiLinkConnectorFolia] WebSocket connection established
[INFO]: [MochiLinkConnectorFolia] Authentication successful
```

### ❌ 失败的日志（配置错误）:
```
[WARN]: [MochiLinkConnectorFolia] Server ID is not configured! Please set authentication.server_id in config.yml
[WARN]: [MochiLinkConnectorFolia] API token is not configured! Please set authentication.token in config.yml
```

如果看到警告，说明配置路径仍然不正确。

## 📋 配置检查清单

在启动服务器前，确认：

- [ ] 使用 `authentication.server_id` 而不是 `server.id`
- [ ] 使用 `authentication.token` 而不是 `auth.token`
- [ ] `connection.forward.host` 是 Koishi 服务器地址
- [ ] `connection.forward.port` 是 8080（Koishi WebSocket 端口）
- [ ] `authentication.server_id` 与 Koishi 中注册的 ID 完全一致
- [ ] `authentication.token` 是完整的 64 字符
- [ ] 配置文件格式正确（YAML 缩进）

## 🔍 常见错误

### 错误 1: 使用了旧的配置路径
```yaml
server:
  id: "my-server"  # ❌ 错误
```

**修复**:
```yaml
authentication:
  server_id: "my-server"  # ✅ 正确
```

### 错误 2: 缩进不正确
```yaml
authentication:
server_id: "my-server"  # ❌ 缩进错误
```

**修复**:
```yaml
authentication:
  server_id: "my-server"  # ✅ 正确缩进（2个空格）
```

### 错误 3: 使用了 tab 而不是空格
```yaml
authentication:
	server_id: "my-server"  # ❌ 使用了 tab
```

**修复**:
```yaml
authentication:
  server_id: "my-server"  # ✅ 使用空格
```

## 📚 相关文件

- `config-templates/CORRECT_CONFIG_EXAMPLE.yml` - 完整的正确配置示例
- `config-templates/paper-spigot-config.yml` - 已更新的配置模板
- `DIAGNOSIS_AND_SOLUTION.md` - 连接问题诊断
- `DEPLOYMENT_STEPS.md` - 部署步骤

## 🎯 总结

**关键点**:
1. 必须使用 `authentication.server_id` 和 `authentication.token`
2. 不要使用 `server.id` 或 `auth.token`
3. 配置路径必须与 Java 代码匹配
4. YAML 格式必须正确（使用空格缩进）

修复配置后，连接器应该能够正确读取 serverId 和 token，并成功连接到 Koishi！
