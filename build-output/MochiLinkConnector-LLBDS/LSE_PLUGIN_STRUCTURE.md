# LSE 插件结构说明
# LSE Plugin Structure Documentation

## LSE 插件识别机制

LSE (LegacyScriptEngine) 通过以下方式识别和加载 Node.js 插件：

### 1. 目录结构

```
MochiLinkConnector-LLBDS/          # 插件根目录（放在 LLBDS 的 plugins/ 下）
├── package.json                    # ✅ LSE 识别入口
├── src/
│   ├── index.js                    # ✅ LSE 插件主文件（由 package.json 的 main 字段指定）
│   ├── external-service.js         # 外部网络服务
│   ├── bridge/
│   ├── config/
│   ├── handlers/
│   ├── monitoring/
│   └── network/
└── node_modules/                   # npm 依赖
```

### 2. package.json 配置

LSE 读取 `package.json` 来识别插件：

```json
{
  "name": "mochi-link-connector-llbds",
  "version": "1.0.0",
  "main": "src/index.js",           // ⭐ 关键：指定 LSE 插件入口文件
  "dependencies": {
    // npm 依赖会被自动安装
  }
}
```

**重要字段**:
- `name`: 插件名称（必需）
- `version`: 插件版本（必需）
- `main`: **LSE 插件入口文件路径**（必需，相对于 package.json）
- `dependencies`: npm 依赖包（可选，LSE 会自动安装）

### 3. 插件入口文件 (src/index.js)

LSE 加载插件时会执行 `main` 字段指定的文件，并期望以下导出：

```javascript
// 插件初始化函数
function main() {
    // 插件启动逻辑
    logger.info('Plugin loaded!');
}

// 插件清理函数
function cleanup() {
    // 插件卸载逻辑
    logger.info('Plugin unloaded!');
}

// 导出给 LSE
module.exports = {
    main,           // ✅ 必需：插件初始化入口
    cleanup,        // ✅ 推荐：插件清理函数
    // 其他导出（可选）
};
```

### 4. LSE 加载流程

```
1. LLBDS 启动
   ↓
2. LSE 扫描 plugins/ 目录
   ↓
3. 发现 MochiLinkConnector-LLBDS/ 目录
   ↓
4. 读取 package.json
   ↓
5. 检查 dependencies，运行 npm install（如果需要）
   ↓
6. 加载 main 字段指定的文件 (src/index.js)
   ↓
7. 调用 module.exports.main() 初始化插件
   ↓
8. 插件运行中...
   ↓
9. LLBDS 关闭或重载插件时
   ↓
10. 调用 module.exports.cleanup() 清理资源
```

## Mochi-Link LLBDS 连接器的特殊架构

### 双进程设计

本插件采用双进程架构：

1. **LSE 插件进程** (src/index.js)
   - 运行在 LLBDS 进程内
   - 轻量级，最小化性能影响
   - 监听游戏事件
   - 注册游戏命令
   - 提供 HTTP API (端口 25580)

2. **外部 Node.js 服务** (src/external-service.js)
   - 独立的 Node.js 进程
   - 处理所有网络通信
   - WebSocket 连接到 Mochi-Link
   - 性能监控
   - HTTP API (端口 25581)

### 为什么这样设计？

1. **性能隔离**: 网络操作不影响 Minecraft 服务器性能
2. **稳定性**: 网络问题不会导致游戏服务器崩溃
3. **可维护性**: 可以独立重启网络服务而不影响游戏

### 启动顺序

```
1. 启动外部 Node.js 服务
   $ node src/external-service.js
   
2. 启动 LLBDS 服务器
   LSE 自动加载插件 (src/index.js)
   
3. LSE 插件通过 HTTP 与外部服务通信
   
4. 外部服务通过 WebSocket 连接到 Mochi-Link
```

## LSE 全局对象

LSE 在插件运行时提供以下全局对象：

### logger

```javascript
logger.info('信息日志');
logger.warn('警告日志');
logger.error('错误日志');
logger.debug('调试日志');
```

### mc (Minecraft 服务器接口)

```javascript
// 监听事件
mc.listen('onJoin', (player) => {
    logger.info(`${player.name} joined the game`);
});

// 注册玩家命令
mc.regPlayerCmd('mycommand', 'Command description', (player, args) => {
    player.tell('Hello!');
});

// 注册控制台命令
mc.regConsoleCmd('mycommand', 'Command description', (args) => {
    logger.info('Console command executed');
});

// 获取服务器信息
const version = mc.getBDSVersion();
const tps = mc.getTPS();
const players = mc.getOnlinePlayers();
```

### HttpServer (HTTP 服务器)

```javascript
// 创建 HTTP 服务器
const server = new HttpServer();
server.onGet('/api/status', (req, res) => {
    res.write(JSON.stringify({ status: 'ok' }));
});
server.listen(25580);
```

### network (网络工具)

```javascript
// HTTP POST 请求
network.httpPost('http://localhost:25581/api/event', JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
});
```

## 常见问题

### Q: 为什么 main 字段必须指向 src/index.js？

A: LSE 通过 `package.json` 的 `main` 字段找到插件入口。如果指向错误的文件（如 external-service.js），LSE 会加载错误的代码，导致插件无法正常工作。

### Q: 可以不使用 package.json 吗？

A: 不可以。LSE 的 Node.js 插件必须使用 package.json 来声明插件信息和依赖。

### Q: 外部服务必须手动启动吗？

A: 是的。外部服务是独立的 Node.js 进程，需要在 LLBDS 外部手动启动。这是设计的一部分，用于隔离网络操作。

### Q: 可以只使用 LSE 插件，不使用外部服务吗？

A: 理论上可以，但不推荐。将网络操作放在外部服务中可以避免影响 Minecraft 服务器性能。

### Q: 如何调试 LSE 插件？

A: 
1. 查看 LLBDS 控制台输出
2. 使用 `logger.info()` 输出调试信息
3. 检查外部服务的日志文件 `logs/external-service.log`

## 参考资料

- [LSE 官方文档](https://lse.liteldev.com/)
- [LSE 多语言支持](https://lse.liteldev.com/apis/LanguageSupport/)
- [LiteLoaderBDS GitHub](https://github.com/LiteLDev/LeviLamina)

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-16
