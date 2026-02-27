# Connector 目录结构问题

## 问题描述

当前项目中存在目录结构不一致的问题：

### 当前结构

```
项目根目录/
├── connectors/
│   ├── fabric/          ✅ 正确位置
│   ├── forge/           ✅ 正确位置
│   ├── java/            ✅ 正确位置（Paper/Spigot）
│   ├── llbds/           ✅ 正确位置
│   ├── nukkit/          ✅ 正确位置
│   └── pmmp/            ✅ 正确位置
└── mochi-link-connector-folia/  ❌ 应该在 connectors/ 下
```

### 应该的结构

```
项目根目录/
└── connectors/
    ├── fabric/
    ├── folia/           ← 应该移动到这里
    ├── forge/
    ├── java/            (Paper/Spigot 通用)
    ├── llbds/
    ├── nukkit/
    └── pmmp/
```

## 影响范围

需要更新以下文件中的路径引用：

### 1. 构建脚本

- `build-all-connectors.bat` (line 215, 237)
- `build-all-connectors.sh` (line 169)
- `rebuild-connectors.bat` (line 20-30, 37)

### 2. 文档

- `README.md`
- `DIRECTORY_STRUCTURE.md`
- `BUILD_SUCCESS.md`
- `build-output/BUILD_REPORT.md`
- `build-output/ARTIFACTS_DIRECTORY.md`

## 修复步骤

### 步骤 1：移动目录

```bash
# Windows
move mochi-link-connector-folia connectors\folia

# Linux/Mac
mv mochi-link-connector-folia connectors/folia
```

### 步骤 2：更新构建脚本

**build-all-connectors.bat:**
```batch
# 修改前
call :build_java_plugin "mochi-link-connector-folia" "MochiLinkConnector-Folia"
copy /Y mochi-link-connector-folia\build\libs\*.jar build-output\

# 修改后
call :build_java_plugin "connectors\folia" "MochiLinkConnector-Folia"
copy /Y connectors\folia\build\libs\*.jar build-output\
```

**build-all-connectors.sh:**
```bash
# 修改前
build_java_plugin "mochi-link-connector-folia" "MochiLinkConnector-Folia"

# 修改后
build_java_plugin "connectors/folia" "MochiLinkConnector-Folia"
```

**rebuild-connectors.bat:**
```batch
# 修改前
echo [2/3] 编译 Folia 连接器...
cd mochi-link-connector-folia
call gradle clean build shadowJar
cd ..
copy /Y mochi-link-connector-folia\build\libs\*.jar build-output\

# 修改后
echo [2/3] 编译 Folia 连接器...
cd connectors\folia
call gradle clean build shadowJar
cd ..\..
copy /Y connectors\folia\build\libs\*.jar build-output\
```

### 步骤 3：更新 .gitignore（如果需要）

检查 `.gitignore` 是否有针对 `mochi-link-connector-folia` 的特殊规则。

### 步骤 4：测试构建

```bash
# 测试构建脚本
npm run build
./build-all-connectors.sh  # 或 build-all-connectors.bat
```

## Folia vs Java Connector 的区别

### connectors/java (Paper/Spigot 通用)
- 支持 Paper、Spigot、Purpur 等传统服务器
- 单线程架构
- 包含更多插件集成（PlaceholderAPI、LuckPerms、Vault）

### connectors/folia (Folia 专用)
- 专为 Folia 的多线程架构优化
- 需要特殊的线程安全处理
- 使用 Folia API 而不是 Paper API

## 协议一致性问题

**重要**：无论是 Java connector 还是 Folia connector，都需要更新以符合 U-WBP v2 协议规范（需求 11.1）：

### 当前 Java/Folia Connector 实现
```java
// MessageHandler.java - 当前实现
switch (message.getType()) {
    case "command":  // ❌ 不符合规范
        handleCommandMessage(message);
        break;
}
```

### 应该的实现（符合需求 11.1）
```java
// MessageHandler.java - 应该的实现
switch (message.getType()) {
    case "request":  // ✅ 符合规范
        String op = message.getOp();
        switch (op) {
            case "command.execute":
                handleCommandMessage(message);
                break;
            // 其他操作...
        }
        break;
}
```

### 响应格式也需要更新
```java
// 当前实现
{
  "type": "response",
  "version": "2.0",
  "timestamp": 1234567890,
  "data": {
    "command_id": "xxx",  // ❌ 应该在顶层
    "success": true,
    "output": "...",
    "error": ""
  }
}

// 应该的实现
{
  "type": "response",
  "id": "xxx",  // ✅ 在顶层，用于匹配请求
  "version": "2.0",
  "timestamp": 1234567890,
  "data": {
    "success": true,
    "output": "...",
    "error": ""
  }
}
```

## 建议

1. **立即修复**：移动 `mochi-link-connector-folia` 到 `connectors/folia/`
2. **更新构建脚本**：确保所有路径引用正确
3. **更新协议实现**：使 Java 和 Folia connector 都符合 U-WBP v2 规范
4. **统一测试**：确保所有 connector 使用相同的协议格式

## 相关文件

- `.kiro/specs/minecraft-unified-management/requirements.md` - 需求 11.1
- `connectors/java/src/main/java/com/mochilink/connector/protocol/MessageHandler.java`
- `connectors/java/src/main/java/com/mochilink/connector/protocol/UWBPv2Protocol.java`
- `src/services/server.ts` - Koishi 端已更新为符合规范
