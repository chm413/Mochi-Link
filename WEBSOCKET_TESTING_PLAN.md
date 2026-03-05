# WebSocket 连接器测试计划

## 测试概述

本文档描述如何测试 Mochi-Link 的 WebSocket 连接器（Folia、Fabric、Forge、Nukkit）。

## 测试环境要求

### 1. 测试工具选择

由于这是 WebSocket 协议，推荐使用以下工具：

#### 选项 A: WebSocket 客户端工具
- **Postman** (支持 WebSocket，推荐)
- **wscat** (命令行工具)
- **WebSocket King** (Chrome 扩展)
- **Insomnia** (支持 WebSocket)

#### 选项 B: 自定义测试脚本
- Node.js + ws 库
- Python + websockets 库

### 2. 测试服务器要求

需要运行以下任一服务器：
- Folia 服务器 + MochiLink 插件
- Fabric 服务器 + MochiLink Mod
- Forge 服务器 + MochiLink Mod
- Nukkit 服务器 + MochiLink 插件

### 3. 配置要求

每个连接器需要正确配置：
```yaml
server:
  id: "test-server-001"
  name: "Test Server"
  token: "test-api-token-12345"
  host: "localhost"  # Koishi 地址
  port: 8080
  use-ssl: false
```

---

## 测试场景

### 场景 1: 连接和握手测试

#### 测试目标
验证连接器能否成功连接并完成握手。

#### 测试步骤

1. **启动服务器**
   ```bash
   # 启动 Minecraft 服务器（带连接器）
   # 检查日志输出
   ```

2. **模拟 Koishi 端 WebSocket 服务器**
   
   使用 Node.js 创建简单的 WebSocket 服务器：
   ```javascript
   const WebSocket = require('ws');
   const wss = new WebSocket.Server({ port: 8080 });
   
   wss.on('connection', (ws) => {
     console.log('Client connected');
     
     ws.on('message', (message) => {
       console.log('Received:', message.toString());
       const msg = JSON.parse(message);
       
       // 处理握手
       if (msg.op === 'handshake') {
         console.log('Handshake received:', JSON.stringify(msg, null, 2));
         
         // 验证握手格式
         if (msg.type === 'system' && 
             msg.systemOp === 'handshake' &&
             msg.data.authentication &&
             msg.data.authentication.token) {
           console.log('✓ Handshake format correct');
           console.log('✓ Authentication present');
           console.log('  Token:', msg.data.authentication.token);
           console.log('  Server ID:', msg.data.serverId);
         }
       }
     });
   });
   
   console.log('WebSocket server listening on port 8080');
   ```

3. **预期结果**
   - 连接器成功连接
   - 收到握手消息
   - 握手消息格式正确：
     ```json
     {
       "type": "system",
       "id": "...",
       "op": "handshake",
       "systemOp": "handshake",
       "timestamp": "2026-03-03T10:00:00.000Z",
       "version": "2.0",
       "data": {
         "protocolVersion": "2.0",
         "serverType": "connector",
         "serverId": "test-server-001",
         "authentication": {
           "token": "test-api-token-12345",
           "method": "token"
         },
         "serverInfo": {
           "name": "Test Server",
           "version": "...",
           "coreType": "Java/Bedrock",
           "coreName": "Fabric/Forge/Folia/Nukkit"
         }
       }
     }
     ```

---

### 场景 2: 操作命令测试

#### 测试目标
验证所有操作命令是否正常工作。

#### 使用 Postman 测试

1. **创建 WebSocket 请求**
   - 打开 Postman
   - 新建请求，选择 "WebSocket"
   - URL: `ws://localhost:8080/ws`

2. **连接后发送测试消息**

#### 测试用例列表

##### 2.1 玩家列表查询
```json
{
  "type": "request",
  "id": "test-001",
  "op": "player.list",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {}
}
```

**预期响应**:
```json
{
  "type": "response",
  "id": "test-001",
  "op": "player.list",
  "timestamp": "2026-03-03T10:00:00.100Z",
  "version": "2.0",
  "data": {
    "players": [...],
    "online": 0,
    "max": 20
  }
}
```

##### 2.2 玩家信息查询（Koishi 命名）
```json
{
  "type": "request",
  "id": "test-002",
  "op": "player.getInfo",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {
    "playerId": "player-uuid-here"
  }
}
```

##### 2.3 玩家信息查询（旧命名 - 向后兼容）
```json
{
  "type": "request",
  "id": "test-003",
  "op": "player.info",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {
    "playerId": "player-uuid-here"
  }
}
```

##### 2.4 白名单查询（Koishi 命名）
```json
{
  "type": "request",
  "id": "test-004",
  "op": "whitelist.get",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {}
}
```

##### 2.5 白名单查询（旧命名）
```json
{
  "type": "request",
  "id": "test-005",
  "op": "whitelist.list",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {}
}
```

##### 2.6 命令执行
```json
{
  "type": "request",
  "id": "test-006",
  "op": "command.execute",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {
    "command": "list"
  }
}
```

##### 2.7 服务器信息（Koishi 命名）
```json
{
  "type": "request",
  "id": "test-007",
  "op": "server.getInfo",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {}
}
```

##### 2.8 服务器状态（Koishi 命名）
```json
{
  "type": "request",
  "id": "test-008",
  "op": "server.getStatus",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {}
}
```

##### 2.9 事件订阅
```json
{
  "type": "request",
  "id": "test-009",
  "op": "event.subscribe",
  "timestamp": "2026-03-03T10:00:00.000Z",
  "version": "2.0",
  "data": {
    "eventTypes": ["player.join", "player.leave"]
  }
}
```

---

### 场景 3: 服务器事件测试

#### 测试目标
验证服务器启动和停止事件是否正常发送。

#### 测试步骤

1. **监听 WebSocket 连接**
   ```javascript
   ws.on('message', (message) => {
     const msg = JSON.parse(message);
     
     if (msg.type === 'event') {
       console.log('Event received:', msg.op);
       console.log('Event data:', JSON.stringify(msg.data, null, 2));
     }
   });
   ```

2. **启动服务器**
   - 启动 Minecraft 服务器
   - 等待 5 秒
   - 应该收到 `server.start` 事件

3. **停止服务器**
   - 停止 Minecraft 服务器
   - 应该收到 `server.stop` 事件

#### 预期事件格式

**server.start**:
```json
{
  "type": "event",
  "id": "...",
  "op": "server.start",
  "timestamp": "2026-03-03T10:00:05.000Z",
  "version": "2.0",
  "data": {
    "serverName": "Test Server",
    "serverVersion": "1.20.1",
    "coreType": "Java",
    "coreName": "Fabric",
    "onlinePlayers": 0,
    "maxPlayers": 20,
    "startTime": "2026-03-03T10:00:05.000Z"
  }
}
```

**server.stop**:
```json
{
  "type": "event",
  "id": "...",
  "op": "server.stop",
  "timestamp": "2026-03-03T10:05:00.000Z",
  "version": "2.0",
  "data": {
    "serverName": "Test Server",
    "reason": "Plugin disabled / Mod shutdown",
    "stopTime": "2026-03-03T10:05:00.000Z"
  }
}
```

---

### 场景 4: 心跳测试

#### 测试目标
验证心跳机制是否正常工作。

#### 测试步骤

1. **等待心跳消息**
   - 连接建立后等待 30 秒
   - 应该收到 `system.ping` 消息

2. **响应心跳**
   ```json
   {
     "type": "response",
     "id": "ping-message-id",
     "op": "system.pong",
     "timestamp": "2026-03-03T10:00:30.050Z",
     "version": "2.0",
     "data": {}
   }
   ```

---

## 自动化测试脚本

### Node.js 完整测试脚本

```javascript
const WebSocket = require('ws');

class ConnectorTester {
  constructor(port = 8080) {
    this.port = port;
    this.wss = null;
    this.testResults = [];
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });
    console.log(`Test server listening on port ${this.port}`);

    this.wss.on('connection', (ws) => {
      console.log('\n=== Client Connected ===\n');
      
      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        console.log('\n=== Client Disconnected ===\n');
        this.printResults();
      });
    });
  }

  handleMessage(ws, message) {
    try {
      const msg = JSON.parse(message.toString());
      console.log(`Received: ${msg.type} - ${msg.op}`);

      // 测试握手
      if (msg.op === 'handshake') {
        this.testHandshake(msg);
      }

      // 测试服务器事件
      if (msg.type === 'event') {
        this.testEvent(msg);
      }

      // 测试心跳
      if (msg.op === 'system.ping') {
        this.testHeartbeat(ws, msg);
      }

      // 发送测试命令
      if (msg.op === 'handshake') {
        setTimeout(() => this.sendTestCommands(ws), 2000);
      }

    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  testHandshake(msg) {
    const tests = [
      {
        name: 'Handshake type is system',
        pass: msg.type === 'system'
      },
      {
        name: 'Handshake op is correct',
        pass: msg.op === 'handshake' && msg.systemOp === 'handshake'
      },
      {
        name: 'Timestamp is ISO 8601',
        pass: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(msg.timestamp)
      },
      {
        name: 'Authentication present',
        pass: msg.data && msg.data.authentication && msg.data.authentication.token
      },
      {
        name: 'Server ID present',
        pass: msg.data && msg.data.serverId
      },
      {
        name: 'Server info present',
        pass: msg.data && msg.data.serverInfo && msg.data.serverInfo.name
      }
    ];

    tests.forEach(test => {
      this.testResults.push(test);
      console.log(`  ${test.pass ? '✓' : '✗'} ${test.name}`);
    });
  }

  testEvent(msg) {
    const tests = [
      {
        name: `Event ${msg.op} format correct`,
        pass: msg.type === 'event' && msg.data
      },
      {
        name: `Event ${msg.op} has timestamp`,
        pass: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(msg.timestamp)
      }
    ];

    tests.forEach(test => {
      this.testResults.push(test);
      console.log(`  ${test.pass ? '✓' : '✗'} ${test.name}`);
    });

    console.log('  Event data:', JSON.stringify(msg.data, null, 2));
  }

  testHeartbeat(ws, msg) {
    console.log('  ✓ Heartbeat received');
    
    // 响应 pong
    const pong = {
      type: 'response',
      id: msg.id,
      op: 'system.pong',
      timestamp: new Date().toISOString(),
      version: '2.0',
      data: {}
    };
    
    ws.send(JSON.stringify(pong));
    console.log('  ✓ Pong sent');
  }

  sendTestCommands(ws) {
    console.log('\n=== Sending Test Commands ===\n');

    const commands = [
      {
        name: 'Player List',
        message: {
          type: 'request',
          id: 'test-001',
          op: 'player.list',
          timestamp: new Date().toISOString(),
          version: '2.0',
          data: {}
        }
      },
      {
        name: 'Whitelist Get (Koishi naming)',
        message: {
          type: 'request',
          id: 'test-002',
          op: 'whitelist.get',
          timestamp: new Date().toISOString(),
          version: '2.0',
          data: {}
        }
      },
      {
        name: 'Server Info (Koishi naming)',
        message: {
          type: 'request',
          id: 'test-003',
          op: 'server.getInfo',
          timestamp: new Date().toISOString(),
          version: '2.0',
          data: {}
        }
      },
      {
        name: 'Server Status (Koishi naming)',
        message: {
          type: 'request',
          id: 'test-004',
          op: 'server.getStatus',
          timestamp: new Date().toISOString(),
          version: '2.0',
          data: {}
        }
      }
    ];

    commands.forEach((cmd, index) => {
      setTimeout(() => {
        console.log(`Sending: ${cmd.name}`);
        ws.send(JSON.stringify(cmd.message));
      }, index * 1000);
    });
  }

  printResults() {
    console.log('\n=== Test Results ===\n');
    
    const passed = this.testResults.filter(t => t.pass).length;
    const total = this.testResults.length;
    
    console.log(`Passed: ${passed}/${total}`);
    console.log(`Failed: ${total - passed}/${total}`);
    
    const failed = this.testResults.filter(t => !t.pass);
    if (failed.length > 0) {
      console.log('\nFailed tests:');
      failed.forEach(t => console.log(`  ✗ ${t.name}`));
    }
  }
}

// 启动测试服务器
const tester = new ConnectorTester(8080);
tester.start();

console.log('Connector test server started');
console.log('Start your Minecraft server with the connector plugin/mod');
console.log('Press Ctrl+C to stop');
```

---

## 测试检查清单

### 所有连接器通用测试

- [ ] 连接建立成功
- [ ] 握手消息格式正确
- [ ] 认证信息存在
- [ ] Timestamp 使用 ISO 8601 格式
- [ ] 心跳机制正常工作
- [ ] server.start 事件正常发送
- [ ] server.stop 事件正常发送

### 操作命令测试

- [ ] player.list 正常工作
- [ ] player.getInfo / player.info 都能工作
- [ ] whitelist.get / whitelist.list 都能工作
- [ ] command.execute 正常工作
- [ ] server.getInfo / server.info 都能工作
- [ ] server.getStatus / server.status 都能工作
- [ ] event.subscribe 正常工作
- [ ] event.unsubscribe 正常工作

### 各连接器特定测试

#### Folia
- [ ] 使用 GlobalRegionScheduler 执行命令
- [ ] 性能监控事件格式正确

#### Fabric
- [ ] Mod 正确加载
- [ ] 服务器事件正常发送

#### Forge
- [ ] Mod 正确加载
- [ ] 服务器事件正常发送

#### Nukkit
- [ ] 插件正确加载
- [ ] Bedrock 特定功能正常

---

## 故障排除

### 连接失败
- 检查服务器配置中的 host 和 port
- 确认防火墙没有阻止连接
- 检查服务器日志

### 握手失败
- 检查 token 配置是否正确
- 检查 serverId 配置是否正确
- 查看服务器日志中的错误信息

### 命令无响应
- 检查服务器是否在线
- 确认命令格式正确
- 查看服务器日志

---

## 测试报告模板

```markdown
# 连接器测试报告

## 测试信息
- 连接器: [Folia/Fabric/Forge/Nukkit]
- 版本: [版本号]
- 测试日期: [日期]
- 测试人员: [姓名]

## 测试结果

### 连接测试
- [ ] 连接建立: [通过/失败]
- [ ] 握手完成: [通过/失败]
- [ ] 认证成功: [通过/失败]

### 操作测试
- [ ] player.list: [通过/失败]
- [ ] player.getInfo: [通过/失败]
- [ ] whitelist.get: [通过/失败]
- [ ] command.execute: [通过/失败]
- [ ] server.getInfo: [通过/失败]
- [ ] server.getStatus: [通过/失败]

### 事件测试
- [ ] server.start: [通过/失败]
- [ ] server.stop: [通过/失败]
- [ ] 心跳机制: [通过/失败]

## 问题记录
[记录发现的问题]

## 建议
[改进建议]
```

---

**创建时间**: 2026-03-03  
**负责人**: AI Assistant
