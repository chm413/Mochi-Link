# Mochi-Link 多语言支持说明

## ✅ 已实现的多语言功能

Mochi-Link 插件完整实现了 Koishi 的多语言（i18n）系统。

## 📁 语言文件

### 位置
```
locales/
├── zh-CN.yml  # 简体中文
└── en-US.yml  # 英文
```

### 支持的语言

1. **简体中文 (zh-CN)** - 完整翻译 ✅
2. **英文 (en-US)** - 完整翻译 ✅

## 🎯 翻译覆盖范围

### 1. 命令描述
所有命令的描述都已翻译：
```yaml
commands:
  mochi:
    description: Mochi-Link 管理命令  # 中文
    description: Mochi-Link management commands  # 英文
```

### 2. 命令消息
所有命令的输出消息都已翻译：
```yaml
commands:
  mochi.server.list:
    messages:
      no-servers: 暂无服务器  # 中文
      no-servers: No servers found  # 英文
```

### 3. 选项说明
命令选项的说明也已翻译：
```yaml
commands:
  mochi.server.add:
    options:
      type: 服务器类型 (java/bedrock)  # 中文
      type: Server type (java/bedrock)  # 英文
```

### 4. 状态和枚举
系统状态和枚举值都已翻译：
```yaml
server-status:
  online: 在线  # 中文
  online: Online  # 英文
```

## 🔧 实现方式

### 1. Koishi 原生支持

使用 Koishi 的 `session.text()` 方法：

```typescript
// 命令描述使用 i18n 键
ctx.command('mochi', 'commands.mochi.description')

// 消息使用 session.text() 并提供降级
return session?.text('commands.mochi.messages.welcome') || 
       'Mochi-Link (大福连) - Minecraft 统一管理系统';
```

### 2. 参数化消息

支持带参数的翻译：

```typescript
// 使用参数
session?.text('commands.mochi.server.add.messages.exists', [id])

// 对应的翻译
// zh-CN: "服务器 {0} 已存在"
// en-US: "Server {0} already exists"
```

### 3. 降级机制

如果翻译不可用，自动使用中文降级：

```typescript
return session?.text('common.not-initialized') || '插件尚未初始化完成';
```

## 📋 翻译内容清单

### 服务器管理 (Server Management)
- ✅ mochi.server.list - 列出服务器
- ✅ mochi.server.add - 添加服务器
- ✅ mochi.server.info - 查看服务器信息
- ✅ mochi.server.remove - 删除服务器

### 群组绑定 (Group Binding)
- ✅ mochi.bind.add - 绑定服务器
- ✅ mochi.bind.list - 查看绑定
- ✅ mochi.bind.remove - 解除绑定

### 白名单管理 (Whitelist Management)
- ✅ mochi.whitelist.list - 查看白名单
- ✅ mochi.whitelist.add - 添加到白名单
- ✅ mochi.whitelist.remove - 从白名单移除

### 玩家管理 (Player Management)
- ✅ mochi.player.list - 查看在线玩家
- ✅ mochi.player.info - 查看玩家详情
- ✅ mochi.player.kick - 踢出玩家

### 命令执行 (Command Execution)
- ✅ mochi.exec - 执行命令

### 审计日志 (Audit Logs)
- ✅ mochi.audit - 查看审计日志

### 通用消息 (Common Messages)
- ✅ 成功/失败消息
- ✅ 错误提示
- ✅ 状态显示

## 🌍 语言切换

### 自动检测
Koishi 会根据用户的语言设置自动选择对应的翻译：

```
用户语言设置 → Koishi → 选择对应的 locale 文件 → 显示翻译
```

### 支持的场景

1. **私聊** - 使用用户的语言设置
2. **群聊** - 使用群组的语言设置
3. **降级** - 如果翻译不存在，使用中文

## 📝 翻译示例

### 中文用户看到：
```
> mochi.server.list
服务器列表：
  [my-server] 我的服务器 (java/paper) - 在线
```

### 英文用户看到：
```
> mochi.server.list
Server list:
  [my-server] My Server (java/paper) - Online
```

## 🔍 翻译键结构

### 命令翻译
```yaml
commands:
  <command-name>:
    description: 命令描述
    options:
      <option-name>: 选项说明
    messages:
      <message-key>: 消息内容
```

### 通用翻译
```yaml
common:
  <key>: 通用消息

server-status:
  <status>: 状态翻译

binding-type:
  <type>: 类型翻译
```

## 🎨 添加新语言

### 步骤 1：创建语言文件

在 `locales/` 目录创建新文件：
```
locales/ja-JP.yml  # 日语
locales/ko-KR.yml  # 韩语
```

### 步骤 2：复制并翻译

复制 `zh-CN.yml` 或 `en-US.yml`，翻译所有内容。

### 步骤 3：更新 package.json

```json
{
  "koishi": {
    "locales": [
      "zh-CN",
      "en-US",
      "ja-JP",  // 新增
      "ko-KR"   // 新增
    ]
  }
}
```

### 步骤 4：重新打包

```bash
npm run build
npm pack
```

## 📊 翻译统计

| 语言 | 完成度 | 命令数 | 消息数 | 状态 |
|------|--------|--------|--------|------|
| 简体中文 (zh-CN) | 100% | 20 | 150+ | ✅ 完成 |
| 英文 (en-US) | 100% | 20 | 150+ | ✅ 完成 |

## 🚀 使用建议

### 1. 保持一致性
- 使用统一的术语
- 保持消息格式一致
- 参数位置保持对应

### 2. 提供降级
- 始终提供中文降级文本
- 确保在翻译缺失时仍可用

### 3. 测试翻译
- 在不同语言环境下测试
- 检查参数替换是否正确
- 验证格式是否正确

## 🔗 相关文档

- [Koishi i18n 文档](https://koishi.chat/zh-CN/guide/i18n/)
- [YAML 语法](https://yaml.org/)
- [命令参考](./COMMAND_REFERENCE.md)

## 📞 贡献翻译

如果你想为 Mochi-Link 贡献新的语言翻译：

1. Fork 项目
2. 创建新的语言文件
3. 翻译所有内容
4. 提交 Pull Request

我们欢迎所有语言的翻译贡献！

---

**总结**：Mochi-Link 已经完整实现了 Koishi 多语言支持，包含中英文完整翻译，支持自动语言切换和降级机制。
