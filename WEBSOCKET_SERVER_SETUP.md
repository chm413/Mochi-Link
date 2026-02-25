# WebSocket 服务器设置指南

## 已实现的功能

### 1. WebSocket 服务器自动启动

插件启动时会自动初始化并启动 WebSocket 服务器：

```typescript
// 初始化流程
1. 初始化数据库
2. 创建 SimpleTokenManager（token 验证）
3. 创建 AuthenticationManager（认证管理）
4. 创建 MochiWebSocketServer（WebSocket 服务器）
5. 启动服务器监听端口
```

### 2. 默认配置

- **端口**: 8080
- **主机**: 0.0.0.0（监听所有网络接口）
- **认证**: 必需（authenticationRequired: true）
- **最大连接数**: 100
- **心跳间隔**: 30 秒
- **心跳超时**: 5 秒

### 3. 配置方式

在 Koishi 配置面板中修改：

```yaml
plugins:
  mochi-link:
    websocket:
      port: 8080          # WebSocket 端口
      host: 0.0.0.0       # 监听地址
      ssl:                # SSL 配置（可选）
        cert: /path/to/cert.pem
        key: /path/to/key.pem
    security:
      maxConnections: 100 # 最大连接数
```

## 验证服务器是否启动

### 方法 1: 查看 Koishi 日志

启动 Koishi 后，应该看到以下日志：

```
[I] mochi-link Starting Mochi-Link plugin...
[I] mochi-link Database initialized successfully
[I] mochi-link WebSocket server started on 0.0.0.0:8080
[I] mochi-link Mochi-Link plugin initialized successfully
```

### 方法 2: 检查端口监听

**Windows (PowerShell)**:
```powershell
netstat -ano | findstr :8080
```

**Linux/Mac**:
```bash
netstat -tuln | grep 8080
# 或
lsof -i :8080
```

应该看到类似输出：
```
TCP    0.0.0.0:8080    0.0.0.0:0    LISTENING    12345
```

### 方法 3: 使用 WebSocket 客户端测试

**使用 wscat (需要安装)**:
```bash
npm install -g wscat
wscat -c "ws://localhost:8080/ws?serverId=test&token=test123"
```

**使用浏览器控制台**:
```javascript
const ws = new WebSocket('ws://localhost:8080/ws?serverId=test&token=test123');
ws.onopen = () => console.log('Connected');
ws.onerror = (e) => console.error('Error:', e);
ws.onmessage = (e) => console.log('Message:', e.data);
```

## 连接流程

### 1. 注册服务器并获取 Token

```bash
# 注册服务器
mochi.server.register survival 生存服 --host 127.0.0.1 -p 25565

# 输出会包含 token:
# 🔐 连接令牌:
#   a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 2. 配置连接器

在 Minecraft 服务器的连接器配置中设置：

**Paper/Spigot/Folia** (`plugins/MochiLink/config.yml`):
```yaml
connection:
  websocket:
    url: "ws://koishi-host:8080/ws"
    serverId: "survival"
    token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

### 3. 启动连接器

启动 Minecraft 服务器后，连接器会自动连接到 Koishi。

### 4. 验证连接

在 Koishi 日志中应该看到：

```
[I] mochi-link Server connected: survival
[I] mochi-link Server authenticated: survival
```

使用命令查看：
```bash
mochi.server.list
```

应该显示服务器状态为 "online"。

## 事件监听

WebSocket 服务器会触发以下事件：

### connection
新连接建立时触发（认证前）
```
[I] mochi-link Server connected: <serverId>
```

### authenticated
连接认证成功后触发
```
[I] mochi-link Server authenticated: <serverId>
```

### disconnection
连接断开时触发
```
[I] mochi-link Server disconnected: <serverId> (1000: Normal closure)
```

### error
发生错误时触发
```
[E] mochi-link WebSocket server error: <error message>
```

## 故障排查

### 问题 1: 端口已被占用

**错误信息**:
```
[E] mochi-link Failed to start WebSocket server: Error: listen EADDRINUSE: address already in use :::8080
```

**解决方法**:
1. 检查是否有其他程序占用 8080 端口
2. 修改配置使用其他端口
3. 停止占用端口的程序

**查找占用端口的程序**:
```powershell
# Windows
netstat -ano | findstr :8080
tasklist | findstr <PID>

# Linux/Mac
lsof -i :8080
```

### 问题 2: 防火墙阻止连接

**症状**: 本地可以连接，远程无法连接

**解决方法**:

**Windows 防火墙**:
```powershell
# 添加入站规则
New-NetFirewallRule -DisplayName "Mochi-Link WebSocket" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

**Linux (iptables)**:
```bash
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables-save
```

**Linux (firewalld)**:
```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### 问题 3: WebSocket 服务器未启动

**症状**: 日志中没有 "WebSocket server started" 消息

**可能原因**:
1. 数据库初始化失败
2. 模块导入失败
3. 配置错误

**解决方法**:
1. 检查完整的错误日志
2. 确认数据库服务正常运行
3. 验证配置文件格式正确
4. 重启 Koishi

### 问题 4: 连接器无法连接

**症状**: 连接器报错 "Connection refused" 或 "Connection timeout"

**排查步骤**:

1. **验证服务器是否启动**:
   ```bash
   netstat -ano | findstr :8080
   ```

2. **验证网络连通性**:
   ```bash
   # 从连接器所在机器测试
   telnet koishi-host 8080
   # 或
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://koishi-host:8080/ws
   ```

3. **检查 URL 格式**:
   - 正确: `ws://host:8080/ws`
   - 错误: `ws://host:8080` (缺少 /ws 路径)
   - 错误: `http://host:8080/ws` (应该用 ws:// 不是 http://)

4. **验证 token**:
   ```bash
   mochi.server.token survival
   ```
   确认 token 与连接器配置中的一致

### 问题 5: 认证失败

**症状**: 连接建立但立即断开，日志显示 "Authentication failed"

**可能原因**:
1. Token 不正确
2. ServerId 不匹配
3. Token 已过期（如果设置了过期时间）
4. IP 不在白名单内（如果设置了白名单）

**解决方法**:
1. 重新查看 token: `mochi.server.token <id>`
2. 确认 serverId 与注册时一致
3. 重新生成 token: `mochi.server.token <id> -r`
4. 检查 IP 白名单配置

## 高级配置

### SSL/TLS 加密

生产环境建议启用 SSL：

```yaml
websocket:
  port: 8443
  host: 0.0.0.0
  ssl:
    cert: /path/to/fullchain.pem
    key: /path/to/privkey.pem
```

连接器配置改为：
```yaml
connection:
  websocket:
    url: "wss://koishi-host:8443/ws"  # 注意是 wss:// 不是 ws://
```

### 反向代理

如果使用 Nginx 反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /ws {
        proxy_pass http://localhost:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

### Docker 部署

如果在 Docker 中运行 Koishi，需要映射端口：

```bash
docker run -d \
  -p 8080:8080 \
  -v /path/to/data:/koishi/data \
  koishi/koishi
```

或在 docker-compose.yml 中：
```yaml
services:
  koishi:
    image: koishi/koishi
    ports:
      - "8080:8080"
    volumes:
      - ./data:/koishi/data
```

## 性能优化

### 连接数限制

根据服务器性能调整最大连接数：

```yaml
security:
  maxConnections: 100  # 默认值，可根据需要调整
```

### 心跳配置

调整心跳间隔以平衡连接稳定性和网络开销：

```yaml
# 在代码中配置（未来可能添加到配置文件）
heartbeatInterval: 30000  # 30 秒
heartbeatTimeout: 5000    # 5 秒
```

## 监控和日志

### 查看连接状态

```bash
# 查看所有服务器
mochi.server.list

# 查看特定服务器
mochi.server.info <id>
```

### 审计日志

所有连接和认证事件都会记录到审计日志：

```bash
mochi.audit
```

## 相关文档

- `TOKEN_FEATURE_SUMMARY.md` - Token 功能完整说明
- `CONNECTOR_TOKEN_AUTH.md` - 连接器配置指南
- `TOKEN_AUTH_IMPLEMENTATION.md` - 技术实现细节
