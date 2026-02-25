# 部署步骤 - 修复后的连接器

## 🎯 问题已修复

✅ WebSocket URL 现在包含 serverId 和 token 参数  
✅ 连接器已重新编译  
✅ 代码已推送到 GitHub

## 📦 部署新的连接器

### 步骤 1: 下载新的 JAR 文件

从 GitHub 仓库下载或从本地复制：

```
build-output/mochi-link-connector-folia-1.0.0.jar  (473 KB, 2026-02-25 18:12)
build-output/mochi-link-connector-java-1.0.0.jar   (508 KB, 2026-02-25 18:12)
```

### 步骤 2: 在 Koishi 中注册服务器

```bash
# 连接到 Koishi
# 执行命令
mochi.server.register my-folia-server 我的Folia服务器 --host 127.0.0.1 -p 25565 -t java -c folia
```

**记录输出的 token**，例如：
```
🔐 连接令牌:
  a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 步骤 3: 停止 Minecraft 服务器

```bash
stop
```

### 步骤 4: 替换 JAR 文件

```bash
# 备份旧文件
mv plugins/MochiLinkConnectorFolia.jar plugins/MochiLinkConnectorFolia.jar.old

# 复制新文件
cp /path/to/mochi-link-connector-folia-1.0.0.jar plugins/MochiLinkConnectorFolia.jar
```

### 步骤 5: 配置连接器

编辑 `plugins/MochiLinkConnectorFolia/config.yml`:

```yaml
connection:
  host: "172.16.200.1"  # Koishi 服务器地址
  port: 8080            # WebSocket 端口（确认是 8080 不是 5145）
  ssl: false
  timeout: 30000
  path: "/ws"

server:
  id: "my-folia-server"  # 与注册时的 ID 完全一致
  name: "我的Folia服务器"
  type: "Folia"

auth:
  token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"  # 从步骤2复制

reconnect:
  enabled: true
  interval: 30
  maxAttempts: 10

features:
  playerEvents:
    enabled: true
  serverMonitoring:
    enabled: true
    interval: 30

logging:
  level: "INFO"
  debug: false
```

### 步骤 6: 启动 Minecraft 服务器

```bash
# 启动服务器
```

### 步骤 7: 验证连接

**Folia 服务器日志应该显示**:
```
[INFO]: [MochiLinkConnectorFolia] Enabling MochiLinkConnectorFolia v1.0.0
[INFO]: [MochiLinkConnectorFolia] Configuration loaded successfully
[INFO]: [MochiLinkConnectorFolia] Connecting to: ws://172.16.200.1:8080/ws
[INFO]: [MochiLinkConnectorFolia] WebSocket connection established
[INFO]: [MochiLinkConnectorFolia] Connected to Mochi-Link management server
[INFO]: [MochiLinkConnectorFolia] Authentication successful
```

**Koishi 日志应该显示**:
```
[I] mochi-link Server connected: my-folia-server
[I] mochi-link Server authenticated: my-folia-server
```

### 步骤 8: 测试功能

在 Koishi 中执行：
```bash
# 查看服务器列表
mochi.server.list

# 应该显示:
# my-folia-server | 我的Folia服务器 | online | folia
```

## ✅ 成功标志

- ✅ 日志中显示正确的 serverId（不是 unknown-xxx）
- ✅ 连接后不会在 10 秒后断开
- ✅ Koishi 显示服务器状态为 "online"
- ✅ 可以执行服务器管理命令

## ❌ 如果仍然失败

### 检查清单

1. **端口是否正确**
   ```yaml
   port: 8080  # 不是 5145
   ```

2. **serverId 是否匹配**
   ```bash
   # 在 Koishi 中查看
   mochi.server.list
   # 确保配置文件中的 server.id 完全一致
   ```

3. **token 是否完整**
   ```bash
   # 在 Koishi 中查看
   mochi.server.token my-folia-server
   # 确保是 64 个字符
   ```

4. **网络是否连通**
   ```bash
   # 从 Minecraft 服务器测试
   telnet 172.16.200.1 8080
   ```

5. **防火墙是否阻止**
   ```bash
   # Windows
   netsh advfirewall firewall add rule name="Mochi-Link" dir=in action=allow protocol=TCP localport=8080
   ```

## 📝 配置文件完整示例

```yaml
# Mochi-Link Connector Configuration for Folia
connection:
  host: "172.16.200.1"
  port: 8080
  ssl: false
  timeout: 30000
  path: "/ws"

server:
  id: "my-folia-server"
  name: "我的Folia服务器"
  type: "Folia"
  description: "A Folia server managed by Mochi-Link"
  tags:
    - "survival"
    - "folia"
    - "java"

auth:
  token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
  refreshInterval: 3600

reconnect:
  enabled: true
  interval: 30
  maxAttempts: 10
  exponentialBackoff: true
  maxBackoffTime: 300

features:
  playerEvents:
    enabled: true
    events:
      - "join"
      - "quit"
      - "chat"
      - "death"
  
  serverMonitoring:
    enabled: true
    interval: 30
  
  commandExecution:
    enabled: true
    whitelist:
      - "list"
      - "tps"
      - "memory"
    blacklist:
      - "stop"
      - "restart"
      - "op"
  
  performanceMonitoring:
    enabled: true
    interval: 60
    metrics:
      - "tps"
      - "memory"
      - "players"

logging:
  level: "INFO"
  debug: false
  logPerformance: true
  file:
    enabled: true
    path: "plugins/MochiLinkConnectorFolia/logs/"
    maxSize: "10MB"
    maxFiles: 5
```

## 🔧 故障排查

### 问题 1: 仍然显示 unknown-xxx

**原因**: 使用了旧的 JAR 文件

**解决**: 
1. 确认 JAR 文件日期是 2026-02-25 18:12
2. 删除旧文件重新复制
3. 重启服务器

### 问题 2: 认证超时

**原因**: token 不正确或 serverId 不匹配

**解决**:
1. 使用 `mochi.server.token <id>` 查看正确的 token
2. 确保 serverId 完全一致（区分大小写）
3. 确保 token 是 64 个字符

### 问题 3: 连接被拒绝

**原因**: 端口或地址错误

**解决**:
1. 确认 Koishi WebSocket 端口（默认 8080）
2. 确认 Koishi 服务器地址
3. 测试网络连通性

## 📚 相关文档

- `CONNECTOR_FIX_GUIDE.md` - 详细的修复指南
- `CONNECTOR_URGENT_FIX.md` - 紧急修复说明
- `TOKEN_FEATURE_SUMMARY.md` - Token 功能说明
- `WEBSOCKET_SERVER_SETUP.md` - WebSocket 服务器设置

## 🎉 完成

部署完成后，你应该能够：
- ✅ 在 Koishi 中看到服务器在线
- ✅ 执行服务器管理命令
- ✅ 查看服务器状态和玩家信息
- ✅ 接收服务器事件推送

祝你使用愉快！🚀
