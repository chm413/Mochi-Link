# Folia 连接器部署指南

## 🎯 重要更新

Folia 连接器已修复并重新编译！

### ✅ 修复内容

1. **添加了 serverId 配置** - 配置文件中新增 `server.id` 字段
2. **修复了 URL 构建** - WebSocket URL 现在包含 `serverId` 和 `token` 参数
3. **添加了配置验证** - 启动时会检查配置是否正确

### 📦 新的 JAR 文件

- **文件名**: `mochi-link-connector-folia-1.0.0.jar`
- **大小**: 474,237 字节 (463 KB)
- **构建时间**: 2026-02-26 07:27:30
- **位置**: `build-output/mochi-link-connector-folia-1.0.0.jar`

## 📋 部署步骤

### 步骤 1: 在 Koishi 中注册服务器

```bash
# 在 Koishi 中执行
mochi.server.register folia-survival Folia生存服 --host 127.0.0.1 -p 25565 -t java -c folia
```

**记录输出信息**:
```
✅ 服务器注册成功！

📋 服务器信息:
  🆔 ID: folia-survival
  📝 名称: Folia生存服
  🎮 类型: java
  ⚙️ 核心: folia

🔐 连接令牌:
  a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 步骤 2: 停止 Folia 服务器

```bash
stop
```

### 步骤 3: 替换 JAR 文件

```bash
# 备份旧文件
mv plugins/MochiLinkConnectorFolia.jar plugins/MochiLinkConnectorFolia.jar.old

# 复制新文件
cp /path/to/build-output/mochi-link-connector-folia-1.0.0.jar plugins/MochiLinkConnectorFolia.jar
```

### 步骤 4: 配置连接器

编辑 `plugins/MochiLinkConnectorFolia/config.yml`:

```yaml
# Mochi-Link Folia Connector Configuration

# Server connection settings
server:
  # Koishi 服务器地址
  host: "172.16.200.1"
  
  # Koishi WebSocket 端口（默认 8080）
  port: 8080
  
  # 服务器 ID（与 Koishi 中注册的完全一致）
  id: "folia-survival"
  
  # API 令牌（从步骤 1 复制）
  token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
  
  # 是否使用 SSL
  use-ssl: false

# Auto-reconnect settings
auto-reconnect:
  enabled: true
  interval: 30

# Performance monitoring
performance:
  monitoring-enabled: true
  report-interval: 60
```

### 步骤 5: 启动 Folia 服务器

```bash
# 启动服务器
```

### 步骤 6: 验证连接

查看日志应该显示：

```
[INFO]: [MochiLinkConnectorFolia] Enabling MochiLinkConnectorFolia v1.0.0
[INFO]: [MochiLinkConnectorFolia] Configuration loaded successfully
[INFO]: [MochiLinkConnectorFolia] Connecting to: ws://172.16.200.1:8080/ws
[INFO]: [MochiLinkConnectorFolia] WebSocket connection established
[INFO]: [MochiLinkConnectorFolia] Connected to Mochi-Link management server
```

Koishi 日志应该显示：

```
[I] mochi-link Server connected: folia-survival
[I] mochi-link Server authenticated: folia-survival
```

## ⚠️ 常见问题

### 问题 1: 配置警告

**日志显示**:
```
[WARN]: Server ID is not configured! Please set server.id in config.yml
[WARN]: Server token is not configured! Please set server.token in config.yml
```

**原因**: 配置文件中缺少 `server.id` 或 `server.token`

**解决**:
1. 确保配置文件中有 `server.id` 字段
2. 确保配置文件中有 `server.token` 字段
3. 确保值不是默认值（`my-folia-server` 或 `your-server-token-here`）

### 问题 2: serverId 显示为 unknown

**日志显示**:
```
[I] mochi-link Server connected: unknown-1772013904676
```

**原因**: 使用了旧的 JAR 文件

**解决**:
1. 确认 JAR 文件日期是 2026-02-26 07:27 或更新
2. 删除旧文件，重新复制新文件
3. 重启服务器

### 问题 3: 认证超时

**日志显示**:
```
[I] mochi-link Server disconnected: folia-survival (1002: Authentication timeout)
```

**原因**: token 不正确或 serverId 不匹配

**解决**:
1. 使用 `mochi.server.token folia-survival` 查看正确的 token
2. 确保 `server.id` 与 Koishi 中注册的完全一致（区分大小写）
3. 确保 token 是完整的 64 字符

### 问题 4: 连接被拒绝

**日志显示**:
```
[ERROR]: Failed to connect to ws://172.16.200.1:8080/ws
```

**原因**: 网络问题或端口错误

**解决**:
1. 确认 Koishi WebSocket 端口（默认 8080）
2. 测试网络连接: `ping 172.16.200.1`
3. 测试端口: `telnet 172.16.200.1 8080`
4. 检查防火墙设置

## 📝 配置文件对比

### ❌ 旧版本（不工作）

```yaml
server:
  host: "localhost"
  port: 8080
  token: "your-server-token-here"
  use-ssl: false
  # ❌ 缺少 id 字段
```

### ✅ 新版本（正确）

```yaml
server:
  host: "172.16.200.1"
  port: 8080
  id: "folia-survival"  # ✅ 新增 id 字段
  token: "a1b2c3d4..."
  use-ssl: false
```

## 🔍 配置检查清单

在启动服务器前，确认：

- [ ] 使用最新的 JAR 文件（2026-02-26 07:27）
- [ ] 配置文件中有 `server.id` 字段
- [ ] `server.id` 与 Koishi 中注册的 ID 完全一致
- [ ] 配置文件中有 `server.token` 字段
- [ ] `server.token` 是完整的 64 字符
- [ ] `server.host` 是 Koishi 服务器地址
- [ ] `server.port` 是 8080（Koishi WebSocket 端口）
- [ ] 网络连接正常

## 🧪 测试命令

### 在 Koishi 中测试

```bash
# 查看服务器列表
mochi.server.list

# 应该显示:
# [folia-survival] Folia生存服 (folia/java) - online

# 查看服务器信息
mochi.server.info folia-survival

# 查看 token
mochi.server.token folia-survival
```

### 在 Folia 服务器中测试

```bash
# 查看插件状态
/plugins

# 应该显示:
# MochiLinkConnectorFolia v1.0.0 (绿色)
```

## 📚 相关文件

- `config-templates/folia-config.yml` - Folia 配置模板
- `build-output/mochi-link-connector-folia-1.0.0.jar` - 最新的 JAR 文件
- `CONFIG_PATH_FIX.md` - 配置路径修复指南
- `DIAGNOSIS_AND_SOLUTION.md` - 连接问题诊断

## 🎉 成功标志

连接成功后，你应该能够：

- ✅ 在 Koishi 中看到服务器状态为 "online"
- ✅ serverId 显示正确（不是 unknown-xxx）
- ✅ 连接后不会在 10 秒后断开
- ✅ 可以执行服务器管理命令
- ✅ 接收服务器事件推送

## 🚀 下一步

连接成功后，你可以：

1. **绑定 QQ 群组**:
   ```bash
   mochi.bind.add folia-survival
   ```

2. **查看在线玩家**:
   ```bash
   mochi.player.list folia-survival
   ```

3. **管理白名单**:
   ```bash
   mochi.whitelist.list folia-survival
   mochi.whitelist.add folia-survival PlayerName
   ```

4. **执行服务器命令**（需要超级管理员权限）:
   ```bash
   mochi.exec folia-survival list
   ```

祝你使用愉快！🎮
