# Connector 重连机制优化文档

## 概述

本文档描述了 Mochi-Link Connector 的优化重连机制，包括指数退避重连、重连次数上限和自动禁用功能。

## 核心特性

### 1. 指数退避重连 (Exponential Backoff)

重连间隔会随着失败次数指数增长，避免对服务器造成过大压力。

**计算公式**:
```
nextInterval = min(baseInterval × (multiplier ^ (attempts - 1)), maxInterval)
```

**默认配置**:
- `baseInterval`: 5000ms (5秒)
- `multiplier`: 1.5
- `maxInterval`: 60000ms (60秒)

**示例重连时间序列**:
- 第1次: 5秒后
- 第2次: 7.5秒后
- 第3次: 11.25秒后
- 第4次: 16.875秒后
- 第5次: 25.3秒后
- 第6次: 37.9秒后
- 第7次及以后: 60秒后 (达到上限)

### 2. 重连次数上限

系统会跟踪两种重连计数：

- **attempts**: 当前重连周期的尝试次数（连接成功后重置）
- **totalAttempts**: 生命周期内的总尝试次数（不重置）

**默认最大尝试次数**: 10次

### 3. 自动禁用重连

当达到最大重连次数后，系统会自动禁用重连功能，防止无限重连。

**默认行为**: 启用 (`disableReconnectOnMaxAttempts: true`)

## 配置选项

### WebSocket 客户端配置

```typescript
interface WebSocketClientConfig {
  // 基础重连设置
  autoReconnect?: boolean;                    // 是否启用自动重连，默认: true
  reconnectInterval?: number;                 // 基础重连间隔(ms)，默认: 5000
  maxReconnectAttempts?: number;              // 最大重连次数，默认: 10
  
  // 指数退避设置
  reconnectBackoffMultiplier?: number;        // 退避倍数，默认: 1.5
  maxReconnectInterval?: number;              // 最大重连间隔(ms)，默认: 60000
  
  // 自动禁用设置
  disableReconnectOnMaxAttempts?: boolean;    // 达到上限后自动禁用，默认: true
}
```

### 连接管理器配置

```typescript
interface ConnectionManagerConfig {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectInterval?: number;
  disableReconnectOnMaxAttempts?: boolean;
}
```

## API 使用

### 获取重连状态

```typescript
// 通过客户端
const status = client.getReconnectionStatus();
console.log(status);
// {
//   isReconnecting: false,
//   attempts: 3,
//   totalAttempts: 15,
//   nextAttemptIn: 11250,
//   lastError: "Connection timeout",
//   disabled: false,
//   lastAttemptTime: 1704067200000
// }

// 通过连接管理器
const status = connectionManager.getReconnectionStatus('server_001');
```

### 手动控制重连

```typescript
// 启用重连（重置尝试计数）
client.enableReconnection();
connectionManager.enableReconnection('server_001');

// 禁用重连
client.disableReconnection();
connectionManager.disableReconnection('server_001');

// 手动触发重连
await client.reconnect();
```

### 监听重连事件

```typescript
// 重连开始
client.on('reconnecting', (attempt, interval) => {
  console.log(`第 ${attempt} 次重连，${interval}ms 后执行`);
});

// 重连失败（达到上限）
client.on('reconnectionFailed', (error, attempts) => {
  console.log(`重连失败，已尝试 ${attempts} 次`);
});

// 重连被禁用
client.on('reconnectionDisabled', (error, totalAttempts) => {
  console.log(`重连已禁用，总尝试次数: ${totalAttempts}`);
});

// 重连被启用
client.on('reconnectionEnabled', () => {
  console.log('重连已重新启用');
});
```

## 状态机

```
[已连接] ──断开──> [断开连接]
                      │
                      ├──autoReconnect=false──> [停止]
                      │
                      └──autoReconnect=true──> [重连中]
                                                  │
                                                  ├──成功──> [已连接]
                                                  │
                                                  ├──失败 & attempts < max──> [等待] ──> [重连中]
                                                  │
                                                  └──失败 & attempts >= max──> [重连失败]
                                                                                  │
                                                                                  ├──disableOnMax=true──> [已禁用]
                                                                                  │
                                                                                  └──disableOnMax=false──> [停止]
```

## 最佳实践

### 1. 生产环境配置

```typescript
const config = {
  autoReconnect: true,
  reconnectInterval: 5000,           // 5秒
  maxReconnectAttempts: 10,
  reconnectBackoffMultiplier: 1.5,
  maxReconnectInterval: 60000,       // 60秒
  disableReconnectOnMaxAttempts: true
};
```

### 2. 开发环境配置

```typescript
const config = {
  autoReconnect: true,
  reconnectInterval: 2000,           // 2秒（更快）
  maxReconnectAttempts: 5,           // 更少次数
  reconnectBackoffMultiplier: 2,     // 更快增长
  maxReconnectInterval: 30000,       // 30秒
  disableReconnectOnMaxAttempts: false  // 不自动禁用
};
```

### 3. 监控和告警

```typescript
client.on('reconnecting', (attempt, interval) => {
  if (attempt >= 5) {
    // 发送告警：重连次数过多
    alertService.warn(`服务器 ${serverId} 重连次数达到 ${attempt}`);
  }
});

client.on('reconnectionDisabled', (error, totalAttempts) => {
  // 发送严重告警：重连已禁用
  alertService.critical(`服务器 ${serverId} 重连已禁用，总尝试: ${totalAttempts}`);
});
```

### 4. 手动恢复

```typescript
// 定期检查被禁用的连接
setInterval(() => {
  const status = connectionManager.getReconnectionStatus(serverId);
  
  if (status?.disabled) {
    // 检查服务器是否恢复
    const isServerHealthy = await checkServerHealth(serverId);
    
    if (isServerHealthy) {
      // 重新启用重连
      connectionManager.enableReconnection(serverId);
      
      // 尝试连接
      await connectionManager.connectToServer(serverConfig);
    }
  }
}, 300000); // 每5分钟检查一次
```

## 与心跳机制的集成

重连机制与心跳监控紧密集成：

```typescript
heartbeatManager.on('reconnectRequired', (serverId, reason) => {
  // 心跳失败触发重连
  const client = clients.get(serverId);
  if (client) {
    client.reconnect();
  }
});
```

## 性能考虑

### 资源消耗

- **内存**: 每个重连状态约占用 200 bytes
- **CPU**: 指数计算开销可忽略不计
- **网络**: 退避机制显著减少无效连接尝试

### 优化建议

1. **合理设置最大间隔**: 避免等待时间过长
2. **监控总尝试次数**: 识别持续性问题
3. **实现健康检查**: 在重新启用前验证服务器状态
4. **日志记录**: 记录所有重连事件用于分析

## 故障排查

### 问题: 重连过于频繁

**原因**: 退避倍数太小或基础间隔太短

**解决方案**:
```typescript
reconnectBackoffMultiplier: 2.0,  // 增加到2.0
reconnectInterval: 10000          // 增加到10秒
```

### 问题: 重连被过早禁用

**原因**: 最大尝试次数太少

**解决方案**:
```typescript
maxReconnectAttempts: 20,                    // 增加次数
disableReconnectOnMaxAttempts: false         // 或禁用自动禁用
```

### 问题: 无法自动恢复

**原因**: 重连已被禁用

**解决方案**:
```typescript
// 检查状态
const status = client.getReconnectionStatus();
if (status.disabled) {
  // 重新启用
  client.enableReconnection();
  await client.reconnect();
}
```

## 测试

### 单元测试示例

```typescript
describe('Reconnection Mechanism', () => {
  it('should use exponential backoff', async () => {
    const delays: number[] = [];
    
    client.on('reconnecting', (attempt, interval) => {
      delays.push(interval);
    });
    
    // 触发多次重连
    for (let i = 0; i < 5; i++) {
      await simulateConnectionFailure();
    }
    
    // 验证指数增长
    expect(delays[0]).toBe(5000);
    expect(delays[1]).toBe(7500);
    expect(delays[2]).toBe(11250);
  });
  
  it('should disable after max attempts', async () => {
    let disabled = false;
    
    client.on('reconnectionDisabled', () => {
      disabled = true;
    });
    
    // 触发超过最大次数的重连
    for (let i = 0; i < 11; i++) {
      await simulateConnectionFailure();
    }
    
    expect(disabled).toBe(true);
    expect(client.getReconnectionStatus().disabled).toBe(true);
  });
});
```

## 更新日志

### v2.1.0 (2024-03-01)
- ✨ 新增指数退避重连机制
- ✨ 新增重连次数上限
- ✨ 新增自动禁用功能
- ✨ 新增手动启用/禁用 API
- ✨ 新增详细的重连状态跟踪
- 🐛 修复重连间隔计算错误
- 📝 完善文档和示例

---

**维护者**: Mochi-Link 开发团队  
**最后更新**: 2024-03-01
