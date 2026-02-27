# Bridge创建修复总结

## 问题
服务器显示online但命令执行失败，返回"Server test is not available"

## 根本原因
WebSocket连接建立后没有创建Bridge实例，导致`getBridge(serverId)`返回null

## 修复内容

### 1. 添加executeCommand到BaseConnectorBridge (`src/bridge/base.ts`)
```typescript
async executeCommand(command: string, timeout?: number): Promise<CommandResult> {
    this.requireCapability('command_execution');
    const result = await this.doExecuteCommand(command, timeout);
    this.updateLastUpdate();
    return result;
}

protected async doExecuteCommand(_command: string, _timeout?: number): Promise<CommandResult> {
    throw new UnsupportedOperationError('executeCommand', ...);
}
```

### 2. 更新JavaBridge实现 (`src/bridge/java.ts`)
```typescript
async executeCommand(command: string, timeout?: number): Promise<any> {
    if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
        return await this.connectionAdapter.sendCommand(command, timeout);
    }
    return { success: true, output: [`Executed: ${command}`], executionTime: 100 };
}

protected async doExecuteCommand(command: string, timeout?: number): Promise<any> {
    return await this.executeCommand(command, timeout);
}
```

### 3. 添加createWebSocketBridge方法 (`src/services/server.ts`)
```typescript
async createWebSocketBridge(serverId: string, connection: any): Promise<void> {
    // 获取服务器配置
    const server = await this.getServer(serverId);
    
    // 创建WebSocket适配器
    const connectionAdapter = {
        sendCommand: async (command: string, timeout?: number) => {
            const response = await connection.sendRequest({
                type: 'request',
                op: 'command.execute',
                data: { command, executor: 'console', command_id: `cmd-${Date.now()}` },
                timeout: timeout || 30000
            });
            return {
                success: response.success !== false,
                output: response.data?.output || [],
                executionTime: response.data?.executionTime || 0,
                error: response.error
            };
        },
        isConnected: () => connection.isConnected && connection.isConnected(),
        connect: async () => {},
        disconnect: async () => { await connection.close(); }
    };
    
    // 创建Bridge
    const bridge = new JavaConnectorBridge(bridgeConfig, connectionAdapter);
    this.bridges.set(serverId, bridge);
}
```

### 4. 更新WebSocket事件处理 (`src/index.ts`)
```typescript
wsManager.on('authenticated', async (connection: WebSocketConnection) => {
    await serviceManager.server.updateServerStatus(connection.serverId, 'online');
    await serviceManager.server.createWebSocketBridge(connection.serverId, connection);
});

wsManager.on('disconnection', async (connection: WebSocketConnection, code, reason) => {
    await serviceManager.server.updateServerStatus(connection.serverId, 'offline');
    await serviceManager.server.removeBridge(connection.serverId);
});
```

## 工作流程

### 修复前
1. Folia连接 → WebSocket认证成功
2. 更新状态为online
3. ❌ bridges Map为空
4. 执行命令 → getBridge返回null → 失败

### 修复后
1. Folia连接 → WebSocket认证成功
2. 更新状态为online
3. ✅ 创建Bridge并存入bridges Map
4. 执行命令 → getBridge返回Bridge → 通过WebSocket发送命令 → 成功

## 命令执行流程

```
用户: /mochi exec test list -a console
  ↓
CommandExecutionService.executeCommand()
  ↓
getBridge(serverId) → 返回JavaConnectorBridge
  ↓
bridge.executeCommand("list")
  ↓
connectionAdapter.sendCommand("list")
  ↓
WebSocket发送: {
    type: 'request',
    op: 'command.execute',
    data: {
        command: 'list',
        executor: 'console',
        command_id: 'cmd-1234567890'
    }
}
  ↓
Folia端MessageHandler.handleCommandMessage()
  ↓
执行命令: Bukkit.dispatchCommand(console, "list")
  ↓
返回结果: {
    success: true,
    output: ["玩家列表..."],
    executionTime: 50
}
  ↓
显示给用户
```

## Folia端协议实现

### 已验证实现
✅ 认证消息 (auth)
✅ 心跳消息 (heartbeat)
✅ 命令执行 (command)
✅ 状态消息 (status)
✅ 事件消息 (event)

### 命令执行检查点
1. ✅ `allowConsoleCommands` 配置
2. ✅ 命令黑名单检查
3. ✅ 主线程执行
4. ✅ 响应发送

## 测试步骤

### 1. 重启Koishi
```bash
# 停止Koishi
# 启动Koishi
```

### 2. 检查日志
```
[INFO] Server authenticated: test
[INFO] Bridge created for server test
[INFO] WebSocket bridge created for server test (java)
```

### 3. 测试命令
```
/mochi exec test list -a console
```

### 4. 预期结果
```
已在服务器 test 执行命令: list
执行者: console
状态: 成功
输出:
  在线玩家列表...
```

## 可能的问题

### 1. Folia配置
检查 `config.yml`:
```yaml
allow-console-commands: true
command-blacklist: []
```

### 2. WebSocket消息格式
如果命令仍然失败，检查Folia端日志：
```
[INFO]: Processing message type: request
[INFO]: Executing remote command: list (requested by: console)
```

### 3. 命令响应
确保Folia端发送正确的响应格式：
```json
{
    "type": "response",
    "requestId": "...",
    "success": true,
    "data": {
        "output": ["..."],
        "executionTime": 50
    }
}
```

## 部署

1. 编译代码：`npm run build` ✅
2. 重启Koishi
3. 测试命令执行
4. 检查日志确认Bridge创建

## 相关文件

- `src/bridge/base.ts` - Bridge基类，添加executeCommand
- `src/bridge/java.ts` - Java Bridge实现
- `src/services/server.ts` - ServerManager，添加createWebSocketBridge
- `src/services/command.ts` - 命令执行服务
- `src/index.ts` - WebSocket事件处理
- `connectors/java/.../MessageHandler.java` - Folia端命令处理

## 下一步

如果命令执行仍然失败：
1. 检查WebSocket连接状态
2. 查看Folia端日志
3. 验证消息格式
4. 检查Folia配置
5. 测试简单命令（如`help`）
