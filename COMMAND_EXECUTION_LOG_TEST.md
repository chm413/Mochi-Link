# Command Execution Logging Test Guide

## 测试目的
验证 exec 指令从管理端到连接器的完整执行链路，确保双端都有对应的日志记录。

## 测试环境准备

### 1. 启动管理端 (Koishi)
```bash
npm run dev
```

### 2. 启动测试服务器 (任选一个)
- Fabric 服务器
- Forge 服务器  
- Paper/Spigot 服务器
- Folia 服务器

### 3. 确保连接器已加载并连接到管理端

## 测试步骤

### 1. 执行简单命令
```bash
# 通过 Koishi 执行命令
/mochilink exec <server-id> "list"
```

### 2. 执行复杂命令
```bash
# 执行带参数的命令
/mochilink exec <server-id> "give @a minecraft:diamond 1"
```

### 3. 执行无效命令
```bash
# 执行不存在的命令
/mochilink exec <server-id> "invalidcommand"
```

## 预期日志输出

### 管理端日志 (Koishi)

#### 命令服务日志 (`src/services/command.ts`)
```
[INFO] Command executed on server-123: list (45ms) - Success: true
[DEBUG] Command output: There are 2 of a max of 20 players online: Player1, Player2
```

#### 服务器管理日志 (`src/services/server.ts`)
```
[INFO] [cmd-1234567890-abc123] Sending command to server-123: list
[INFO] [cmd-1234567890-abc123] Received response from server-123: success=true
```

#### 审计日志
```
[AUDIT] command.execute SUCCESS: { command: "list", success: true, executionTime: 45, outputLines: 1 }
```

### 连接器端日志

#### 连接管理器日志
```
[INFO] [cmd-1234567890-abc123] Processing request: op=command.execute
[INFO] [cmd-1234567890-abc123] Request completed: op=command.execute, time=45ms
```

#### 消息处理器日志
```
[INFO] [cmd-1234567890-abc123] Command execution request: command=list
[INFO] [cmd-1234567890-abc123] Executing command: list
[DEBUG] [cmd-1234567890-abc123] Command execution started on server thread
[DEBUG] [cmd-1234567890-abc123] Command execution completed on server thread
[INFO] [cmd-1234567890-abc123] Command execution response prepared: success=true, time=2ms
```

## 日志追踪验证

### 1. 请求ID一致性
- 管理端和连接器端的日志应该包含相同的请求ID
- 格式: `[cmd-timestamp-randomstring]`

### 2. 时间戳顺序
- 管理端发送 → 连接器接收 → 连接器处理 → 连接器响应 → 管理端接收
- 时间戳应该按照这个顺序递增

### 3. 执行状态一致性
- 管理端和连接器端记录的执行状态应该一致
- 成功/失败状态应该匹配

## 故障排查

### 1. 日志缺失
如果某个环节的日志缺失，检查：
- 日志级别配置
- Logger 初始化
- 异常处理

### 2. 请求ID不匹配
如果请求ID不一致，检查：
- 请求ID传递机制
- 日志格式化

### 3. 执行时间异常
如果执行时间不合理，检查：
- 时间计算逻辑
- 异步执行处理

## 性能监控

### 关键指标
- 请求处理时间
- 命令执行时间
- 网络传输时间
- 错误率

### 告警阈值
- 执行时间 > 5秒: 警告
- 执行时间 > 30秒: 错误
- 错误率 > 5%: 告警

## 日志分析工具

### 1. 日志聚合
```bash
# 提取特定请求ID的所有日志
grep "cmd-1234567890-abc123" *.log
```

### 2. 性能分析
```bash
# 分析命令执行时间分布
grep "Command executed" *.log | awk '{print $NF}' | sort -n
```

### 3. 错误统计
```bash
# 统计错误类型
grep "ERROR" *.log | cut -d' ' -f3- | sort | uniq -c
```