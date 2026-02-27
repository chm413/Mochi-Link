# Bridge创建问题分析和修复方案

## 问题描述

从截图可以看到：
1. 服务器显示为 `online` 状态
2. 执行 `/mochi exec test list -a console` 返回 "Server test is not available"

## 根本原因

通过代码分析发现：

### 1. WebSocket认证流程
```typescript
// src/index.ts:201
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    logger.info(`Server authenticated: ${connection.serverId}`);
    
    // 只更新了状态，没有创建bridge
    await serviceManager.server.updateServerStatus(connection.serverId, 'online');
});
```

### 2. 命令执行流程
```typescript
// src/services/command.ts:136
const bridge = this.getBridge(serverId);
if (!bridge || !bridge.isConnectedToBridge()) {
    return {
        success: false,
        error: `Server ${serverId} is not available`
    };
}
```

### 3. Bridge获取
```typescript
// src/services/server.ts:991
getBridge(serverId: string): BaseConnectorBridge | null {
    return this.bridges.get(serverId) || null;
}
```

**问题**：`bridges` Map在WebSocket连接建立时没有被填充！

## 缺失的功能

### 1. BaseConnectorBridge缺少executeCommand方法

查看 `src/bridge/base.ts`，BaseConnectorBridge类没有定义executeCommand方法，但JavaBridge有：

```typescript
// src/bridge/java.ts:73
async executeCommand(command: string): Promise<any> {
    if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
        return await this.connectionAdapter.sendCommand(command);
    }
    
    return {
        success: true,
        output: [`Executed: ${command}`],
        executionTime: 100
    };
}
```

### 2. WebSocket连接没有创建Bridge

当Folia服务器通过WebSocket连接并认证成功后：
- ✅ 连接被建立
- ✅ 认证成功
- ✅ 服务器状态更新为online
- ❌ 没有创建对应的Bridge实例
- ❌ bridges Map为空
- ❌ 命令执行失败

## 修复方案

### 方案1：在WebSocket认证成功后创建Bridge（推荐）

```typescript
// src/index.ts
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    logger.info(`Server authenticated: ${connection.serverId}`);
    
    if (serviceManager) {
        try {
            // 更新服务器状态
            await serviceManager.server.updateServerStatus(connection.serverId, 'online');
            
            // 创建WebSocket Bridge
            await serviceManager.server.createWebSocketBridge(connection.serverId, connection);
            
            logger.info(`Bridge created for server ${connection.serverId}`);
        } catch (error) {
            logger.error(`Failed to setup server ${connection.serverId}:`, error);
        }
    }
});
```

### 方案2：在ServerManager中添加createWebSocketBridge方法

```typescript
// src/services/server.ts
async createWebSocketBridge(serverId: string, connection: WebSocketConnection): Promise<void> {
    const server = await this.getServer(serverId);
    if (!server) {
        throw new Error(`Server ${serverId} not found`);
    }
    
    // 创建WebSocket适配器
    const adapter = new WebSocketConnectionAdapter(connection);
    
    // 根据服务器类型创建Bridge
    let bridge: BaseConnectorBridge;
    
    switch (server.coreType) {
        case 'java':
            bridge = new JavaConnectorBridge({
                serverId: server.id,
                coreName: server.coreName,
                coreVersion: server.coreVersion
            }, adapter);
            break;
        case 'bedrock':
            bridge = new BedrockConnectorBridge({
                serverId: server.id,
                coreName: server.coreName,
                coreVersion: server.coreVersion
            }, adapter);
            break;
        default:
            throw new Error(`Unsupported core type: ${server.coreType}`);
    }
    
    // 存储Bridge
    this.bridges.set(serverId, bridge);
    
    // 设置插件集成
    await this.setupPluginIntegration(serverId, bridge);
}
```

### 方案3：添加executeCommand到BaseConnectorBridge

```typescript
// src/bridge/base.ts
abstract class BaseConnectorBridge {
    // ... 现有代码 ...
    
    /**
     * Execute a console command
     */
    async executeCommand(command: string, timeout?: number): Promise<CommandResult> {
        this.requireCapability('command_execution');
        return await this.doExecuteCommand(command, timeout);
    }
    
    /**
     * Implementation hook for command execution
     */
    protected async doExecuteCommand(
        _command: string, 
        _timeout?: number
    ): Promise<CommandResult> {
        throw new Error('Command execution not implemented');
    }
}
```

### 方案4：创建WebSocketConnectionAdapter

```typescript
// src/connection/adapters/websocket.ts
export class WebSocketConnectionAdapter implements ConnectionAdapter {
    constructor(private connection: WebSocketConnection) {}
    
    async sendCommand(command: string): Promise<CommandResult> {
        // 发送命令请求到WebSocket连接
        const response = await this.connection.sendRequest({
            type: 'request',
            op: 'command.execute',
            data: {
                command,
                executor: 'console'
            }
        });
        
        return {
            success: response.success,
            output: response.data?.output || [],
            executionTime: response.data?.executionTime || 0,
            error: response.error
        };
    }
    
    async connect(): Promise<void> {
        // WebSocket已连接
    }
    
    async disconnect(): Promise<void> {
        await this.connection.close();
    }
    
    isConnected(): boolean {
        return this.connection.isConnected();
    }
}
```

## Folia端协议实现检查

### 已实现的消息类型

根据 `connectors/java/src/main/java/com/mochilink/connector/protocol/MessageHandler.java`：

✅ **已实现**：
- `auth` - 认证消息
- `heartbeat` - 心跳消息
- `command` - 命令执行
- `status` - 状态消息
- `event` - 事件消息

### 命令执行实现

```java
// MessageHandler.java:89
private void handleCommandMessage(ProtocolMessage message) {
    String commandId = message.getDataString("command_id");
    String command = message.getDataString("command");
    String executor = message.getDataString("executor");
    
    // 检查配置
    if (!plugin.getPluginConfig().isAllowConsoleCommands()) {
        sendCommandResponse(commandId, false, "", "Console commands are disabled");
        return;
    }
    
    // 检查黑名单
    if (plugin.getPluginConfig().isCommandBlacklisted(baseCommand)) {
        sendCommandResponse(commandId, false, "", "Command is blacklisted");
        return;
    }
    
    // 执行命令
    executeCommand(commandId, command);
}
```

### 可能的问题

1. **配置问题**：`allowConsoleCommands` 可能被禁用
2. **命令黑名单**：`list` 命令可能在黑名单中
3. **消息格式**：服务端发送的消息格式可能不匹配

## 测试步骤

### 1. 检查Folia配置

```yaml
# config.yml
allow-console-commands: true
command-blacklist: []
```

### 2. 检查WebSocket消息

在服务端添加日志：
```typescript
wsManager.on('message', async (message: any, connection: WebSocketConnection) => {
    logger.info(`Received message type: ${message.type}, op: ${message.op}`);
    logger.debug(`Message data:`, JSON.stringify(message, null, 2));
});
```

### 3. 检查Bridge创建

```typescript
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    logger.info(`Server authenticated: ${connection.serverId}`);
    const bridge = serviceManager.server.getBridge(connection.serverId);
    logger.info(`Bridge exists: ${bridge !== null}`);
});
```

### 4. 测试命令执行

```typescript
// 在命令执行前添加日志
const bridge = this.getBridge(serverId);
logger.info(`Bridge for ${serverId}: ${bridge ? 'found' : 'not found'}`);
if (bridge) {
    logger.info(`Bridge connected: ${bridge.isConnectedToBridge()}`);
    logger.info(`Bridge capabilities: ${bridge.getCapabilities().join(', ')}`);
}
```

## 实施优先级

1. **高优先级**：添加executeCommand到BaseConnectorBridge
2. **高优先级**：在WebSocket认证成功后创建Bridge
3. **中优先级**：创建WebSocketConnectionAdapter
4. **低优先级**：检查Folia端配置

## 预期结果

修复后：
1. WebSocket连接建立 → 认证成功 → 创建Bridge → bridges Map有值
2. 执行命令 → getBridge返回有效Bridge → executeCommand成功
3. 命令通过WebSocket发送到Folia → Folia执行 → 返回结果

## 相关文件

- `src/index.ts` - WebSocket事件处理
- `src/services/server.ts` - ServerManager和Bridge管理
- `src/services/command.ts` - 命令执行服务
- `src/bridge/base.ts` - Bridge基类
- `src/bridge/java.ts` - Java Bridge实现
- `connectors/java/src/main/java/com/mochilink/connector/protocol/MessageHandler.java` - Folia端消息处理
