# Mochi-Link 多语言支持

## 📋 概述

Mochi-Link v1.5.0 使用 Koishi 内置的 i18n 系统，支持完整的多语言功能。Koishi 会自动加载 `locales/` 目录下的语言文件。

---

## 🌍 支持的语言

| 语言 | 代码 | 文件 | 状态 |
|------|------|------|------|
| 简体中文 | zh-CN | locales/zh-CN.yml | ✅ 完整 |
| English | en-US | locales/en-US.yml | ✅ 完整 |

---

## 🎯 Koishi i18n 系统

### 自动加载

Koishi 会自动加载 `locales/` 目录下的所有 `.yml` 文件：

```
mochi-link/
├── locales/
│   ├── zh-CN.yml    # 自动加载
│   └── en-US.yml    # 自动加载
└── package.json     # 声明支持的语言
```

### 使用方式

在代码中使用 `session.text()` 方法：

```typescript
// 简单文本
session.text('commands.mochi.description')

// 带参数的文本
session.text('commands.mochi.server.add.messages.success', [name, id])

// 带降级的文本（如果翻译不存在，使用默认值）
session?.text('common.not-initialized') || '插件尚未初始化完成'
```

### 命令描述

命令描述直接使用 i18n 键：

```typescript
ctx.command('mochi', 'commands.mochi.description')
ctx.command('mochi.server', 'commands.mochi.server.description')
```

Koishi 会根据用户的语言设置自动显示对应的描述。

---

## 🎯 翻译内容

### 1. 命令描述

所有 Koishi 命令的描述都已翻译：

**中文**:
```yaml
commands:
  mochi:
    description: Mochi-Link 管理命令
```

**English**:
```yaml
commands:
  mochi:
    description: Mochi-Link management commands
```

### 2. 命令消息

所有命令的输出消息都已翻译：

**中文**:
```yaml
commands:
  mochi.server.add:
    messages:
      success: "服务器 {0} ({1}) 创建成功"
      exists: "服务器 {0} 已存在"
```

**English**:
```yaml
commands:
  mochi.server.add:
    messages:
      success: "Server {0} ({1}) created successfully"
      exists: "Server {0} already exists"
```

### 3. 选项说明

命令选项的描述也已翻译：

**中文**:
```yaml
commands:
  mochi.server.add:
    options:
      type: 服务器类型 (java/bedrock)
      core: 核心名称
```

**English**:
```yaml
commands:
  mochi.server.add:
    options:
      type: Server type (java/bedrock)
      core: Core name
```

---

## 🔧 使用方法

### Koishi 自动语言检测

Koishi 会根据以下优先级自动选择语言：

1. 用户设置的语言偏好
2. 频道/群组的语言设置
3. 系统默认语言

### 手动设置语言

用户可以通过 Koishi 的语言设置功能切换语言：

```bash
# 在 Koishi 控制台中
locale zh-CN  # 切换到简体中文
locale en-US  # 切换到英文
```

---

## 📝 翻译覆盖范围

### 命令类别

| 类别 | 命令数 | 翻译状态 |
|------|--------|----------|
| 主命令 | 1 | ✅ 完整 |
| 服务器管理 | 5 | ✅ 完整 |
| 群组绑定 | 4 | ✅ 完整 |
| 白名单管理 | 4 | ✅ 完整 |
| 玩家管理 | 4 | ✅ 完整 |
| 命令执行 | 1 | ✅ 完整 |
| 审计日志 | 1 | ✅ 完整 |
| **总计** | **20** | **✅ 100%** |

### 消息类型

- ✅ 成功消息
- ✅ 错误消息
- ✅ 使用说明
- ✅ 列表输出
- ✅ 详细信息
- ✅ 提示信息

### 通用术语

| 中文 | English |
|------|---------|
| 在线 | Online |
| 离线 | Offline |
| 成功 | Success |
| 失败 | Failure |
| 未知 | Unknown |
| 无 | None |

---

## 🎨 消息格式化

### 参数替换

使用 `{0}`, `{1}`, `{2}` 等占位符：

```yaml
# 中文
success: "服务器 {0} ({1}) 创建成功"

# English
success: "Server {0} ({1}) created successfully"
```

**使用示例**:
```typescript
// 中文输出: 服务器 survival (生存服务器) 创建成功
// English output: Server survival (Survival Server) created successfully
session.text('commands.mochi.server.add.messages.success', 'survival', '生存服务器')
```

### 多行消息

使用 `|-` 语法：

```yaml
messages:
  menu: |-
    服务器管理命令：
      mochi.server.list - 列出所有服务器
      mochi.server.add <id> <name> - 添加服务器
```

---

## 🌐 添加新语言

### 1. 创建语言文件

复制 `locales/zh-CN.yml` 或 `locales/en-US.yml`：

```bash
cp locales/en-US.yml locales/ja-JP.yml
```

### 2. 翻译内容

编辑新文件，翻译所有文本：

```yaml
# locales/ja-JP.yml
commands:
  mochi:
    description: Mochi-Link 管理コマンド
    messages:
      welcome: |-
        Mochi-Link - Minecraft 統合管理システム
        mochi.help でコマンドを確認
```

### 3. 更新 package.json

添加新语言到 locales 列表：

```json
{
  "koishi": {
    "locales": [
      "zh-CN",
      "en-US",
      "ja-JP"
    ]
  }
}
```

### 4. 测试

重启 Koishi 并测试新语言：

```bash
locale ja-JP
mochi
```

---

## 📊 翻译质量保证

### 一致性检查

确保所有语言文件包含相同的键：

```bash
# 检查键的数量
grep -c "description:" locales/zh-CN.yml
grep -c "description:" locales/en-US.yml
```

### 参数占位符

确保所有翻译使用相同数量的占位符：

```yaml
# ✅ 正确
zh-CN: "服务器 {0} ({1}) 创建成功"
en-US: "Server {0} ({1}) created successfully"

# ❌ 错误 - 参数数量不匹配
zh-CN: "服务器 {0} ({1}) 创建成功"
en-US: "Server {0} created successfully"
```

### 格式一致性

保持相同的格式风格：

```yaml
# ✅ 正确 - 都使用列表格式
zh-CN: |-
  服务器管理命令：
    mochi.server.list - 列出所有服务器
en-US: |-
  Server management commands:
    mochi.server.list - List all servers

# ❌ 错误 - 格式不一致
zh-CN: |-
  服务器管理命令：
    mochi.server.list - 列出所有服务器
en-US: "Server management commands: mochi.server.list - List all servers"
```

---

## 🔍 常见问题

### Q: 如何查看当前使用的语言？

A: 使用 Koishi 的 `locale` 命令：

```bash
locale
# 输出: 当前语言: zh-CN
```

### Q: 为什么切换语言后没有生效？

A: 可能需要：
1. 重启 Koishi
2. 清除缓存
3. 检查语言文件是否正确加载

### Q: 如何为特定群组设置语言？

A: 在 Koishi 控制台中：

```bash
# 为群组设置语言
channel.locale <channelId> zh-CN
```

### Q: 翻译文件支持哪些格式？

A: Koishi 支持 YAML 格式的翻译文件（.yml）。

---

## 📚 参考资源

### Koishi 国际化文档

- [Koishi 国际化指南](https://koishi.chat/zh-CN/guide/i18n/)
- [Koishi 插件开发](https://koishi.chat/zh-CN/guide/plugin/)

### YAML 语法

- [YAML 官方文档](https://yaml.org/)
- [YAML 在线验证器](https://www.yamllint.com/)

---

## 🎯 翻译示例

### 命令输出对比

#### 服务器列表

**中文 (zh-CN)**:
```
服务器列表：
  [survival] 生存服务器 (java/paper) - 在线
  [creative] 创造服务器 (java/fabric) - 离线
```

**English (en-US)**:
```
Server list:
  [survival] Survival Server (java/paper) - Online
  [creative] Creative Server (java/fabric) - Offline
```

#### 白名单操作

**中文 (zh-CN)**:
```
已将 Steve 添加到服务器 生存服务器 的白名单
```

**English (en-US)**:
```
Added Steve to whitelist of server Survival Server
```

#### 命令执行

**中文 (zh-CN)**:
```
已在服务器 生存服务器 执行命令: say Hello World
执行者: console
状态: 成功
输出:
[Server] Hello World
```

**English (en-US)**:
```
Executed command on server Survival Server: say Hello World
Executor: console
Status: Success
Output:
[Server] Hello World
```

---

## 🚀 未来计划

### 计划支持的语言

- 🔄 日语 (ja-JP)
- 🔄 韩语 (ko-KR)
- 🔄 繁体中文 (zh-TW)
- 🔄 法语 (fr-FR)
- 🔄 德语 (de-DE)
- 🔄 西班牙语 (es-ES)
- 🔄 俄语 (ru-RU)

### 改进计划

1. **动态语言切换** - 支持运行时切换语言
2. **自定义翻译** - 允许用户自定义翻译
3. **翻译贡献** - 建立社区翻译贡献流程
4. **翻译工具** - 开发翻译辅助工具

---

## 🤝 贡献翻译

欢迎贡献新语言的翻译！

### 贡献步骤

1. Fork 项目
2. 创建新的语言文件
3. 翻译所有内容
4. 测试翻译
5. 提交 Pull Request

### 翻译指南

- 保持术语一致性
- 使用自然的表达方式
- 保留技术术语（如 WebSocket, API）
- 注意文化差异
- 测试所有命令输出

---

**版本**: v1.5.0  
**更新日期**: 2026-02-17  
**翻译覆盖率**: 100%  
**支持语言**: 2 (简体中文, English)
