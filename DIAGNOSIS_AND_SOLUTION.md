# 连接问题诊断和解决方案

## 📊 当前状态分析

### Koishi 端（正常）
```
2026-02-25 18:03:16 [I] mochi-link WebSocket server started on 0.0.0.0:8080 ✅
2026-02-25 18:05:04 [I] mochi-link Server connected: unknown-1772013904676 ⚠️
2026-02-25 18:05:14 [I] mochi-link Server disconnected: unknown-1772013904676 (1002: Authentication timeout) ❌
```

### Folia 端（连接成功但认证失败）
```
[18:05:04 INFO]: [MochiLinkConnectorFolia] Connecting to: ws://172.16.200.1:5145/ws ⚠️ 端口错误！
[18:05:04 INFO]: [MochiLinkConnectorFolia] WebSocket connection established ✅
[18:05:04 INFO]: [MochiLinkConnectorFolia] Connected to Mochi-Link management server ✅
[18:05:04 INFO]: [MochiLinkConnectorFolia] Handshake sent to management server ⚠️
```

## 🔍 问题诊断

### 问题 1: 端口不匹配 ⚠️
- **Koishi 监听**: `0.0.0.0:8080`
- **Folia 连接**: `172.16.200.1:5145`
- **结果**: 虽然连接成功（可能 5145 端口有其他服务），但不是 Mochi-Link 的 WebSocket 服务器

### 问题 2: serverId 显示为 unknown ⚠️
- **原因**: WebSocket URL 中缺少 `serverId` 和 `token` 参数
- **当前 URL**: `ws://172.16.200.1:5145/ws`
- **应该是**: `ws://172.16.200.1:8080/ws?serverId=xxx&token=yyy`

### 问题 3: 认证超时 ❌
- **原因**: 服务器在 10 秒内未收到有效的认证信息
- **当前**: 连接器发送了 handshake 消息，但没有包含 serverId 和 token
- **应该**: URL 参数中直接包含认证信息

## ✅ 解决方案

### 步骤 1: 确认 Koishi WebSocket 端口

在 Koishi 配置中检查 WebSocket 端口（默认应该是 8080）：

```yaml
# Koishi 插件配置
websocket:
  port: 8080  # 确认这个端口
  host: '0.0.0.0'
```

### 步骤 2: 在 Koishi 中注册服务器

```bash
# 在 Koishi 中执行
mochi.server.register folia-survival Folia生存服 --host 127.0.0.1 -p 25565 -t java -c folia
```

**记录输出的信息**:
- serverId: `folia-survival`
- token: `a1b2c3d4...` (64个字符)

### 步骤 3: 修改 Folia 连接器配置

编辑 `plugins/MochiLinkConnectorFolia/config.yml`:

```yaml
connection:
  host: "172.16.200.1"  # Koishi 服务器地址
  port: 8080            # ⚠️ 改为 8080，不是 5145
  ssl: false
  timeout: 30000
  path: "/ws"

server:
  id: "folia-survival"  # ⚠️ 必须与 Koishi 中注册的 ID 完全一致
  name: "Folia生存服"
  type: "Folia"

auth:
  token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"  # ⚠️ 从步骤2复制完整的 token

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

### 步骤 4: 确认使用最新的 JAR 文件

检查 JAR 文件日期：
```bash
# 应该是 2026-02-25 18:12 或更新
ls -lh plugins/MochiLinkConnectorFolia.jar
```

如果不是最新的，从 `build-output/` 复制：
```bash
# 停止服务器
stop

# 备份旧文件
mv plugins/MochiLinkConnectorFolia.jar plugins/MochiLinkConnectorFolia.jar.old

# 复制新文件
cp /path/to/build-output/mochi-link-connector-folia-1.0.0.jar plugins/MochiLinkConnectorFolia.jar
```

### 步骤 5: 重启 Folia 服务器

```bash
# 启动服务器
```

### 步骤 6: 验证连接

**成功的日志应该显示**:

Folia 端:
```
[INFO]: [MochiLinkConnectorFolia] Connecting to: ws://172.16.200.1:8080/ws
[INFO]: [MochiLinkConnectorFolia] WebSocket connection established
[INFO]: [MochiLinkConnectorFolia] Connected to Mochi-Link management server
[INFO]: [MochiLinkConnectorFolia] Authentication successful
```

Koishi 端:
```
[I] mochi-link Server connected: folia-survival
[I] mochi-link Server authenticated: folia-survival
```

## 🔧 代码验证

### 连接器代码已修复

`ConnectionManager.java` 中的 `createServerUri()` 方法：

```java
private URI createServerUri() {
    try {
        String scheme = config.isForwardSsl() ? "wss" : "ws";
        String host = config.getForwardHost();
        int port = config.getForwardPort();
        String serverId = config.getServerId();
        String token = config.getApiToken();
        
        // ✅ 正确：URL 包含 serverId 和 token 参数
        String url = String.format("%s://%s:%d/ws?serverId=%s&token=%s", 
            scheme, host, port, 
            java.net.URLEncoder.encode(serverId, "UTF-8"),
            java.net.URLEncoder.encode(token, "UTF-8"));
        
        logger.info("Connecting to: " + scheme + "://" + host + ":" + port + "/ws");
        
        return new URI(url);
    } catch (Exception e) {
        throw new RuntimeException("Failed to create server URI", e);
    }
}
```

### Token 验证流程

1. **连接器**: 在 URL 中提供 `serverId` 和 `token`
2. **WebSocket 服务器**: 提取 URL 参数
   ```typescript
   const url = new URL(request.url || '', `http://${request.headers.host}`);
   const serverId = url.searchParams.get('serverId');
   const token = url.searchParams.get('token');
   ```
3. **Token Manager**: 验证 token
   ```typescript
   const result = await this.authManager.authenticateWithToken(
       serverId,
       token,
       request.socket.remoteAddress
   );
   ```
4. **数据库查询**: 查询 `mochi_api_tokens` 表
   ```typescript
   const tokens = await this.ctx.database.get(`${prefix}api_tokens`, { 
       server_id: serverId,
       token: token
   });
   ```

## 📋 检查清单

在重启服务器前，确认以下所有项目：

- [ ] Koishi WebSocket 端口是 8080
- [ ] 已在 Koishi 中注册服务器
- [ ] 已记录 serverId 和 token
- [ ] Folia 配置文件中 `connection.port` 是 8080
- [ ] Folia 配置文件中 `server.id` 与注册的 ID 完全一致
- [ ] Folia 配置文件中 `auth.token` 是完整的 64 字符
- [ ] 使用的是最新编译的 JAR 文件（2026-02-25 18:12）
- [ ] 网络连接正常（可以 ping 通 172.16.200.1）
- [ ] 防火墙允许 8080 端口

## 🧪 测试命令

### 测试网络连接
```bash
# 从 Folia 服务器测试
ping 172.16.200.1
telnet 172.16.200.1 8080
```

### 查看 Koishi 中的服务器
```bash
# 在 Koishi 中执行
mochi.server.list
```

### 查看 token
```bash
# 在 Koishi 中执行
mochi.server.token folia-survival
```

### 重新生成 token（如果需要）
```bash
# 在 Koishi 中执行
mochi.server.token folia-survival -r
```

## ❓ 常见问题

### Q1: 为什么 serverId 显示为 unknown？
**A**: WebSocket URL 中缺少 serverId 参数。确保使用最新的 JAR 文件。

### Q2: 为什么认证超时？
**A**: Token 不正确或 serverId 不匹配。使用 `mochi.server.token` 命令查看正确的 token。

### Q3: 为什么连接到 5145 端口？
**A**: 配置文件中的端口设置错误。Koishi WebSocket 默认端口是 8080。

### Q4: 如何确认 JAR 文件是最新的？
**A**: 检查文件日期应该是 2026-02-25 18:12 或更新，文件大小约 473 KB。

### Q5: 如果还是不行怎么办？
**A**: 
1. 启用调试日志：`logging.debug: true`
2. 查看完整的错误信息
3. 确认数据库中有 token 记录
4. 检查 Koishi 日志中的详细错误

## 📚 相关文档

- `DEPLOYMENT_STEPS.md` - 完整部署步骤
- `CONNECTOR_URGENT_FIX.md` - 紧急修复说明
- `TOKEN_FEATURE_SUMMARY.md` - Token 功能说明
- `WEBSOCKET_SERVER_SETUP.md` - WebSocket 服务器设置

## 🎯 预期结果

修复后，你应该能够：
- ✅ 看到正确的 serverId（不是 unknown-xxx）
- ✅ 连接后不会在 10 秒后断开
- ✅ Koishi 显示服务器状态为 "online"
- ✅ 可以执行服务器管理命令
- ✅ 接收服务器事件推送

## 🚀 下一步

连接成功后，你可以：
1. 绑定 QQ 群组到服务器：`mochi.bind.add folia-survival`
2. 查看在线玩家：`mochi.player.list`
3. 执行服务器命令：`mochi.exec folia-survival list`
4. 管理白名单：`mochi.whitelist.list`

祝你使用愉快！
