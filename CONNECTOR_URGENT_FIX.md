# 连接器紧急修复指南

## 问题

Folia 连接器无法通过认证，原因是 WebSocket URL 中缺少 `serverId` 和 `token` 参数。

## 已修复的代码

### 修改文件
`mochi-link-connector-java/src/main/java/com/mochilink/connector/connection/ConnectionManager.java`

### 修改内容

**之前（错误）**:
```java
String url = String.format("%s://%s:%d/ws/minecraft", scheme, host, port);
```

**之后（正确）**:
```java
String url = String.format("%s://%s:%d/ws?serverId=%s&token=%s", 
    scheme, host, port, 
    java.net.URLEncoder.encode(serverId, "UTF-8"),
    java.net.URLEncoder.encode(token, "UTF-8"));
```

## 快速修复步骤

### 方案 1: 重新编译连接器（推荐）

1. **运行编译脚本**:
   ```bash
   rebuild-connectors.bat
   ```

2. **复制新的 JAR 文件到服务器**:
   ```bash
   # 从 build-output/ 目录复制
   build-output/MochiLinkConnector-Folia.jar
   ```

3. **替换服务器上的旧文件**:
   ```bash
   # 停止服务器
   # 替换 plugins/MochiLinkConnectorFolia.jar
   # 启动服务器
   ```

### 方案 2: 手动修改（临时）

如果无法重新编译，可以手动修改配置文件（但这不是标准方案）：

1. **在 Koishi 中注册服务器**:
   ```bash
   mochi.server.register my-folia-server 我的Folia服务器
   ```

2. **记录输出的 token**

3. **修改连接器配置** `plugins/MochiLinkConnectorFolia/config.yml`:
   ```yaml
   connection:
     host: "172.16.200.1"
     port: 8080  # 确保是正确的端口
     ssl: false
     path: "/ws"
   
   server:
     id: "my-folia-server"
   
   auth:
     token: "你的64字符token"
   ```

4. **重启服务器**

## 验证修复

### 成功的日志应该显示

**Folia 端**:
```
[INFO]: [MochiLinkConnectorFolia] Connecting to: ws://172.16.200.1:8080/ws
[INFO]: [MochiLinkConnectorFolia] WebSocket connection established
[INFO]: [MochiLinkConnectorFolia] Connected to Mochi-Link management server
[INFO]: [MochiLinkConnectorFolia] Authentication successful
```

**Koishi 端**:
```
[I] mochi-link Server connected: my-folia-server
[I] mochi-link Server authenticated: my-folia-server
```

### 失败的日志（修复前）

**Folia 端**:
```
[INFO]: [MochiLinkConnectorFolia] Connecting to: ws://172.16.200.1:5145/ws
[INFO]: [MochiLinkConnectorFolia] WebSocket connection established
[INFO]: [MochiLinkConnectorFolia] Handshake sent to management server
```

**Koishi 端**:
```
[I] mochi-link Server connected: unknown-1772013904676
[I] mochi-link Server disconnected: unknown-1772013904676 (1002: Authentication timeout)
```

## 编译要求

- Java JDK 17 或更高版本
- Gradle 7.0 或更高版本

## 编译命令

### Windows
```bash
cd mochi-link-connector-java
gradle clean build shadowJar

cd ../mochi-link-connector-folia
gradle clean build shadowJar
```

### Linux/Mac
```bash
cd mochi-link-connector-java
./gradlew clean build shadowJar

cd ../mochi-link-connector-folia
./gradlew clean build shadowJar
```

## 输出文件位置

- Java 连接器: `mochi-link-connector-java/build/libs/mochi-link-connector-java-1.0.0.jar`
- Folia 连接器: `mochi-link-connector-folia/build/libs/mochi-link-connector-folia-1.0.0.jar`

## 配置示例

### 完整的 config.yml

```yaml
# Mochi-Link Connector Configuration for Folia
connection:
  host: "172.16.200.1"  # Koishi 服务器地址
  port: 8080            # WebSocket 端口
  ssl: false
  timeout: 30000
  path: "/ws"

server:
  id: "my-folia-server"  # 必须与 Koishi 中注册的 ID 一致
  name: "我的Folia服务器"
  type: "Folia"

auth:
  token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"  # 64字符token

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
  commandExecution:
    enabled: true

logging:
  level: "INFO"
  debug: false
```

## 注意事项

1. ✅ 确保 `server.id` 与 Koishi 中注册的完全一致
2. ✅ 确保 `auth.token` 是完整的 64 字符
3. ✅ 确保 `connection.port` 是 Koishi WebSocket 端口（默认 8080）
4. ✅ 确保 `connection.path` 是 "/ws"（不是 "/ws/minecraft"）
5. ⚠️ 修改代码后必须重新编译才能生效

## 其他连接器

相同的修复需要应用到所有 Java 基础的连接器：
- ✅ mochi-link-connector-java (已修复)
- ⏳ mochi-link-connector-folia (使用相同代码)
- ⏳ mochi-link-connector-fabric (需要检查)
- ⏳ mochi-link-connector-forge (需要检查)
- ⏳ mochi-link-connector-nukkit (需要检查)

## 技术细节

### URL 编码

使用 `URLEncoder.encode()` 确保特殊字符正确编码：
```java
java.net.URLEncoder.encode(serverId, "UTF-8")
java.net.URLEncoder.encode(token, "UTF-8")
```

### 认证流程

1. 连接器在 URL 中提供 serverId 和 token
2. Koishi WebSocket 服务器提取参数
3. 调用 `SimpleTokenManager.validateToken(serverId, token)`
4. 查询数据库验证 token
5. 验证成功则标记连接为已认证
6. 验证失败则关闭连接（1002: Authentication timeout）

## 支持

如果修复后仍然无法连接，请检查：
1. Koishi 日志中的详细错误信息
2. 连接器配置文件是否正确
3. 网络连接是否正常
4. 防火墙是否阻止连接
5. 端口是否正确

## 相关文档

- `CONNECTOR_FIX_GUIDE.md` - 详细的修复指南
- `TOKEN_FEATURE_SUMMARY.md` - Token 功能说明
- `CONNECTOR_TOKEN_AUTH.md` - 连接器配置指南
