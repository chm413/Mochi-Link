# 服务器注册功能改进报告

## 改进时间
2026-02-22

## 改进内容

### 1. 增强名称识别功能

#### 支持三种名称格式

1. **引号包裹格式**（推荐）
   ```
   --name "我的 Minecraft 服务器"
   --name '生存服 #1'
   ```
   - 支持双引号和单引号
   - 可以包含任意字符（空格、特殊符号等）
   - 最安全的方式

2. **自动识别格式**
   ```
   --name 我的服务器 --host 127.0.0.1
   ```
   - 自动识别到下一个 `--` 参数为止
   - 适合包含空格但不包含特殊符号的名称

3. **单词格式**
   ```
   --name 生存服 --host 127.0.0.1
   ```
   - 适合单个词的名称
   - 最简洁的方式

#### 正则表达式改进

```typescript
// 支持引号包裹
let nameMatch = content.match(/--name\s+"([^"]+)"/);
if (!nameMatch) {
  nameMatch = content.match(/--name\s+'([^']+)'/);
}
// 支持自动识别
if (!nameMatch) {
  nameMatch = content.match(/--name\s+([^\s-]+(?:\s+[^\s-]+)*?)(?:\s+--|$)/);
}
```

### 2. 增强 ID 验证

#### ID 格式规则
- ✅ 只能包含：字母（a-z, A-Z）、数字（0-9）、下划线（_）、连字符（-）
- ❌ 不能包含：空格、中文、特殊符号

#### 验证代码
```typescript
// 验证 ID 格式
if (!/^[\w-]+$/.test(id)) {
  return null;
}
```

### 3. 增强端口验证

```typescript
// 验证端口范围
if (port < 1 || port > 65535) {
  return null;
}
```

### 4. 扩展核心类型识别

#### 自动识别为基岩版的核心
```typescript
const bedrockCores = ['nukkit', 'pmmp', 'bds', 'llbds', 'powernukkit', 'cloudburst'];
```

新增支持：
- `powernukkit` - PowerNukkit
- `cloudburst` - Cloudburst Nukkit

### 5. 改进错误提示

#### 格式错误提示
```
❌ 注册信息格式错误

📝 正确格式:
/mochi register <服务器ID> --name <名称> --host <地址> --port <端口> --core <核心>

📋 参数说明:
  <服务器ID>: 唯一标识符（字母、数字、下划线、连字符）
  --name: 服务器名称（支持中文和空格）
  --host: IP地址或域名
  --port: 端口号（1-65535）
  --core: 核心类型（paper/fabric/nukkit/pmmp等）
  --type: [可选] 服务器类型（java/bedrock，不填自动识别）

💡 示例:
  /mochi register survival --name 生存服 --host 127.0.0.1 --port 25565 --core paper
  /mochi register creative --name "创造服务器 1号" --host 192.168.1.100 --port 25566 --core fabric
  /mochi register bedrock01 --name 基岩服 --host 127.0.0.1 --port 19132 --core nukkit --type bedrock
```

#### 服务器已存在提示
```
❌ 服务器 ID "survival" 已存在

💡 提示:
  • 使用 mochi.server.list 查看已注册的服务器
  • 选择一个不同的 ID
  • 或使用 mochi.server.remove survival 删除旧服务器（需要超级管理员权限）
```

#### 注册成功提示
```
✅ 服务器注册成功！

📋 服务器信息:
  🆔 ID: survival
  📝 名称: 生存服
  🎮 类型: Java 版
  ⚙️ 核心: paper
  🌐 地址: 127.0.0.1:25565
  👤 所有者: 用户名

📦 下一步:
  1️⃣ 在服务器上安装连接器: MochiLinkConnector-Paper.jar
  2️⃣ 配置连接器连接到 Koishi (WebSocket 端口: 8080)
  3️⃣ 启动服务器，等待连接建立
  4️⃣ 使用 mochi.server.list 查看连接状态

💡 提示: 连接器配置文件中的 server-id 必须设置为 "survival"
```

### 6. 智能连接器推荐

根据核心类型自动推荐对应的连接器：

```typescript
const connectorMap: Record<string, string> = {
  'paper': 'MochiLinkConnector-Paper.jar',
  'spigot': 'MochiLinkConnector-Paper.jar',
  'folia': 'MochiLinkConnector-Folia.jar',
  'fabric': 'MochiLinkConnector-Fabric.jar',
  'forge': 'MochiLinkConnector-Forge.jar',
  'nukkit': 'MochiLinkConnector-Nukkit.jar',
  'powernukkit': 'MochiLinkConnector-Nukkit.jar',
  'llbds': 'mochi-link-connector-llbds',
  'pmmp': 'mochi-link-connector-pmmp'
};
```

### 7. 移除冗余命令

移除了 `mochi.server.register` 命令，因为：
- 消息中间件已经处理了 `/mochi register` 格式
- 避免功能重复
- 简化代码维护

### 8. 更新文档

#### SERVER_REGISTER_GUIDE.md 更新内容

1. **参数说明表格**
   - 添加了更详细的示例
   - 说明了端口范围（1-65535）
   - 强调了核心类型要小写

2. **名称格式说明**
   - 详细说明了三种名称格式
   - 提供了使用建议

3. **ID 格式规则**
   - 明确了允许和不允许的字符
   - 提供了正确和错误的示例

4. **示例扩展**
   - 增加了更多实际使用场景
   - 包含了域名、内网 IP 等复杂情况

5. **常见问题扩展**
   - 详细的格式错误排查步骤
   - 常见错误示例及修正方法

6. **自动识别功能说明**
   - 详细说明了类型自动识别规则
   - 说明了名称自动识别机制
   - 添加了 ID 和名称的对比表格

## 测试用例

### 基本功能测试

1. **简单名称（无空格）**
   ```
   /mochi register survival --name 生存服 --host 127.0.0.1 --port 25565 --core paper
   ```
   预期：✅ 成功注册

2. **名称包含空格（引号）**
   ```
   /mochi register creative --name "创造服务器 1号" --host 192.168.1.100 --port 25566 --core fabric
   ```
   预期：✅ 成功注册

3. **名称包含空格（自动识别）**
   ```
   /mochi register skyblock --name 空岛服务器 --host 192.168.1.101 --port 25567 --core paper
   ```
   预期：✅ 成功注册

4. **基岩版服务器**
   ```
   /mochi register bedrock01 --name 基岩服 --host 127.0.0.1 --port 19132 --core nukkit
   ```
   预期：✅ 成功注册，自动识别为 bedrock 类型

### 错误处理测试

1. **ID 包含中文**
   ```
   /mochi register 生存服 --name 生存服 --host 127.0.0.1 --port 25565 --core paper
   ```
   预期：❌ 格式错误

2. **端口超出范围**
   ```
   /mochi register survival --name 生存服 --host 127.0.0.1 --port 99999 --core paper
   ```
   预期：❌ 格式错误

3. **缺少必填参数**
   ```
   /mochi register survival --name 生存服 --host 127.0.0.1 --core paper
   ```
   预期：❌ 格式错误

4. **服务器已存在**
   ```
   /mochi register survival --name 生存服2 --host 127.0.0.1 --port 25566 --core paper
   ```
   预期：❌ 服务器已存在（如果 survival 已注册）

5. **权限不足**
   ```
   普通用户（等级 1）执行注册命令
   ```
   预期：❌ 权限不足

## 技术细节

### 正则表达式说明

1. **ID 提取**
   ```typescript
   const idMatch = content.match(/^([\w-]+)/);
   ```
   - `[\w-]+`：匹配字母、数字、下划线、连字符

2. **名称提取（引号）**
   ```typescript
   let nameMatch = content.match(/--name\s+"([^"]+)"/);
   ```
   - `\s+`：匹配一个或多个空格
   - `"([^"]+)"`：匹配引号内的内容

3. **名称提取（自动识别）**
   ```typescript
   nameMatch = content.match(/--name\s+([^\s-]+(?:\s+[^\s-]+)*?)(?:\s+--|$)/);
   ```
   - `[^\s-]+`：匹配非空格非连字符的字符
   - `(?:\s+[^\s-]+)*?`：匹配后续的词（非贪婪）
   - `(?:\s+--|$)`：匹配到下一个 `--` 或行尾

4. **Host 提取**
   ```typescript
   const hostMatch = content.match(/--host\s+([\w\.\-:]+)/);
   ```
   - `[\w\.\-:]+`：匹配域名或 IP（包含点、连字符、冒号）

5. **端口提取**
   ```typescript
   const portMatch = content.match(/--port\s+(\d+)/);
   ```
   - `\d+`：匹配一个或多个数字

6. **核心提取**
   ```typescript
   const coreMatch = content.match(/--core\s+([\w\-]+)/);
   ```
   - `[\w\-]+`：匹配字母、数字、下划线、连字符

## 兼容性

- ✅ 向后兼容：旧的注册格式仍然有效
- ✅ 多平台支持：Windows、Linux、macOS
- ✅ 多语言支持：中文、英文名称
- ✅ 特殊字符：支持引号、空格、表情符号等

## 安全性

1. **权限检查**：需要管理员权限（等级 3）
2. **输入验证**：严格验证 ID、端口等参数
3. **审计日志**：记录所有注册操作
4. **唯一性检查**：防止 ID 重复

## 性能

- 正则表达式优化：使用非贪婪匹配
- 早期返回：验证失败立即返回
- 数据库查询：只在必要时查询

## 后续改进建议

1. **批量注册**：支持一次注册多个服务器
2. **配置导入**：从配置文件导入服务器信息
3. **服务器编辑**：支持修改已注册服务器的信息
4. **连接测试**：注册时自动测试连接
5. **模板系统**：预设常用服务器配置模板

## 更新日志

- **2026-02-22**: 初始版本
  - 增强名称识别（支持引号和自动识别）
  - 增强 ID 和端口验证
  - 改进错误提示
  - 智能连接器推荐
  - 更新文档

