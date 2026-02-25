# 连接器认证问题修复指南

## 问题诊断

### 当前问题
从日志可以看到：
```
[I] mochi-link Server connected: unknown-1772013904676
[I] mochi-link Server disconnected: unknown-1772013904676 (1002: Authentication timeout)
```

### 问题原因
1. ❌ 连接器没有在 URL 中提供 `serverId` 参数
2. ❌ 连接器没有在 URL 中提供 `token` 参数
3. ❌ 连接器连接的 URL 格式不正确

### 正确的连接方式

连接器应该使用以下格式连接：
```
ws://host:port/ws?serverId=<server-id>&token=<auth-token>
```

## 修复步骤

### 步骤 1: 在 Koishi 中注册服务器并获取 token

```bash
# 注册服务器
mochi.server.register my-folia-server 我的Folia服务器 --host 127.0.0.1 -p 25565 -t java -c folia

# 输出会包含 token，例如：
# 🔐 连接令牌:
#   a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 步骤 2: 修改连接器配置

编辑 `plugins/MochiLinkConnectorFolia/config.yml`：

```yaml
# 连接配置
connection:
  host: "172.16.200.1"  # Koishi 服务器地址
  port: 8080            # WebSocket 端口（不是 5145！）
  ssl: false
  timeout: 30000
  path: "/ws"

# 服务器配置
server:
  id: "my-folia-server"  # 必须与注册时的 ID 一致
  name: "我的Folia服务器"
  type: "Folia"

# 认证配置
auth:
  token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"  # 从注册输出中复制
```

### 步骤 3: 修改连接器代码（如果需要）

如果连接器代码没有正确构建 URL，需要修改连接逻辑：

**错误的连接方式**:
```java
String url = "ws://" + host + ":" + port + path;
// 结果: ws://172.16.200.1:8080/ws
```

**正确的连接方式**:
```java
String serverId = config.getString("server.id");
String token = config.getString("auth.token");
String url = String.format("ws://%s:%d%s?serverId=%s&token=%s", 
    host, port, path, serverId, token);
// 结果: ws://172.16.200.1:8080/ws?serverId=my-folia-server&token=abc123...
```

### 步骤 4: 重启连接器

```bash
# 重启 Minecraft 服务器
stop
# 或使用插件重载命令（如果支持）
/mlreconnect
```

## 验证修复

### 1. 检查 Koishi 日志

成功连接后应该看到：
```
[I] mochi-link Server connected: my-folia-server
[I] mochi-link Server authenticated: my-folia-server
```

### 2. 检查连接器日志

应该看到：
```
[INFO]: [MochiLinkConnectorFolia] WebSocket connection established
[INFO]: [MochiLinkConnectorFolia] Connected to Mochi-Link management server
[INFO]: [MochiLinkConnectorFolia] Authentication successful
```

### 3. 使用命令验证

在 Koishi 中执行：
```bash
mochi.server.list
```

应该显示服务器状态为 "online"。

## 常见问题

### 问题 1: 端口错误

**症状**: 连接到 5145 端口而不是 8080

**原因**: 配置文件中的端口设置错误

**解决**: 
```yaml
connection:
  port: 8080  # 应该是 Koishi WebSocket 端口，不是其他端口
```

### 问题 2: serverId 不匹配

**症状**: 
```
[E] mochi-link Authentication failed: Invalid server ID
```

**原因**: 配置中的 `server.id` 与注册时使用的 ID 不一致

**解决**: 
1. 使用 `mochi.server.list` 查看已注册的服务器 ID
2. 确保配置文件中的 `server.id` 完全一致（区分大小写）

### 问题 3: token 不正确

**症状**:
```
[E] mochi-link Authentication failed: Invalid token
```

**原因**: token 复制错误或已过期

**解决**:
1. 使用 `mochi.server.token <id>` 重新查看 token
2. 或使用 `mochi.server.token <id> -r` 重新生成 token
3. 确保 token 完整复制（64 个字符）

### 问题 4: 连接器代码未更新

**症状**: 修改配置后仍然无法连接

**原因**: 连接器代码没有读取 serverId 和 token 参数

**解决**: 需要更新连接器代码，在构建 WebSocket URL 时添加参数

## 连接器代码示例

### Java (Paper/Spigot/Folia)

```java
public class WebSocketManager {
    private String host;
    private int port;
    private String path;
    private String serverId;
    private String token;
    
    public void connect() {
        // 构建 URL
        String url = String.format("ws://%s:%d%s?serverId=%s&token=%s",
            host, port, path, 
            URLEncoder.encode(serverId, StandardCharsets.UTF_8),
            URLEncoder.encode(token, StandardCharsets.UTF_8)
        );
        
        getLogger().info("Connecting to: " + url);
        
        // 创建 WebSocket 客户端
        WebSocketClient client = new WebSocketClient(new URI(url)) {
            @Override
            public void onOpen(ServerHandshake handshake) {
                getLogger().info("WebSocket connection established");
                // 发送握手消息
                sendHandshake();
            }
            
            @Override
            public void onMessage(String message) {
                handleMessage(message);
            }
            
            @Override
            public void onClose(int code, String reason, boolean remote) {
                getLogger().info("Connection closed: " + code + " - " + reason);
            }
            
            @Override
            public void onError(Exception ex) {
                getLogger().severe("WebSocket error: " + ex.getMessage());
            }
        };
        
        client.connect();
    }
    
    private void sendHandshake() {
        JsonObject handshake = new JsonObject();
        handshake.addProperty("type", "system");
        handshake.addProperty("op", "handshake");
        handshake.addProperty("serverId", serverId);
        
        JsonObject data = new JsonObject();
        data.addProperty("protocolVersion", "2.0");
        data.addProperty("serverType", "folia");
        data.addProperty("serverVersion", getServer().getVersion());
        
        JsonObject auth = new JsonObject();
        auth.addProperty("token", token);
        auth.addProperty("method", "token");
        data.add("authentication", auth);
        
        handshake.add("data", data);
        handshake.addProperty("timestamp", System.currentTimeMillis());
        
        send(handshake.toString());
    }
}
```

### 配置读取

```java
public void loadConfig() {
    FileConfiguration config = getConfig();
    
    this.host = config.getString("connection.host", "localhost");
    this.port = config.getInt("connection.port", 8080);
    this.path = config.getString("connection.path", "/ws");
    this.serverId = config.getString("server.id");
    this.token = config.getString("auth.token");
    
    // 验证必需配置
    if (serverId == null || serverId.isEmpty()) {
        getLogger().severe("Server ID is not configured!");
        getServer().getPluginManager().disablePlugin(this);
        return;
    }
    
    if (token == null || token.isEmpty()) {
        getLogger().severe("Auth token is not configured!");
        getServer().getPluginManager().disablePlugin(this);
        return;
    }
}
```

## 测试连接

### 使用 wscat 测试

```bash
# 安装 wscat
npm install -g wscat

# 测试连接（替换为实际的 serverId 和 token）
wscat -c "ws://172.16.200.1:8080/ws?serverId=my-folia-server&token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

成功连接后，发送握手消息：
```json
{
  "type": "system",
  "op": "handshake",
  "serverId": "my-folia-server",
  "data": {
    "protocolVersion": "2.0",
    "serverType": "folia",
    "authentication": {
      "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
      "method": "token"
    }
  },
  "timestamp": 1708862400000
}
```

## 总结

关键点：
1. ✅ WebSocket URL 必须包含 `serverId` 和 `token` 参数
2. ✅ serverId 必须与注册时的 ID 完全一致
3. ✅ token 必须是完整的 64 字符十六进制字符串
4. ✅ 端口必须是 Koishi WebSocket 端口（默认 8080）
5. ✅ 连接器代码需要正确构建 URL 和发送握手消息

修复后，连接应该成功建立并通过认证。
