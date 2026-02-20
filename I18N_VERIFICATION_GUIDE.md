# 多语言功能验证指南
# I18n Verification Guide

**日期**: 2026-02-20  
**问题**: yarn 安装时无法激活 Koishi 多语言化  
**状态**: ✅ 已修复

---

## 问题描述 / Problem Description

使用 `yarn add koishi-plugin-mochi-link` 安装插件时，`locales` 目录没有被包含在发布包中，导致多语言功能无法正常工作。

---

## 修复内容 / Fix Applied

### 修改 package.json

在 `package.json` 的 `files` 字段中添加了 `locales` 目录：

```json
{
  "files": [
    "lib",
    "locales",  // ← 新增
    "README.md"
  ]
}
```

这样在发布和安装时，`locales` 目录会被正确包含。

---

## 验证步骤 / Verification Steps

### 1. 本地验证

#### 检查文件是否存在

```bash
# 检查语言文件
ls locales/
# 应该看到:
# zh-CN.yml
# en-US.yml
```

#### 检查 package.json 配置

```bash
# 查看 files 字段
cat package.json | grep -A 5 '"files"'
# 应该包含 "locales"
```

#### 检查 koishi 配置

```bash
# 查看 koishi 配置
cat package.json | grep -A 10 '"koishi"'
# 应该看到:
# "locales": ["zh-CN", "en-US"]
```

### 2. 构建验证

```bash
# 清理并重新构建
npm run clean
npm run build

# 检查构建产物
ls lib/
# 应该看到编译后的 .js 和 .d.ts 文件
```

### 3. 打包验证

```bash
# 创建 npm 包（不发布）
npm pack

# 解压查看内容
tar -tzf koishi-plugin-mochi-link-*.tgz | grep locales
# 应该看到:
# package/locales/zh-CN.yml
# package/locales/en-US.yml
```

### 4. 安装验证

#### 方式 1: 本地安装测试

```bash
# 在另一个目录创建测试项目
mkdir test-i18n
cd test-i18n
npm init -y

# 从本地安装
npm install /path/to/koishi-plugin-mochi-link-*.tgz

# 检查安装的文件
ls node_modules/koishi-plugin-mochi-link/locales/
# 应该看到语言文件
```

#### 方式 2: Koishi 实例测试

```bash
# 在 Koishi 实例中安装
cd /path/to/koishi
yarn add koishi-plugin-mochi-link

# 检查插件目录
ls node_modules/koishi-plugin-mochi-link/locales/
# 应该看到语言文件
```

### 5. 运行时验证

#### 启动 Koishi

```bash
# 启动 Koishi
yarn start
```

#### 测试中文命令

在 Koishi 控制台或聊天中执行：

```
mochi
# 应该显示中文欢迎消息

大福连
# 中文别名应该工作

服务器列表
# 中文别名应该工作

mochi.server.list
# 应该显示中文消息
```

#### 测试英文命令

切换到英文环境（如果支持）：

```
mochi
# 应该显示英文欢迎消息

mochi.server.list
# 应该显示英文消息
```

---

## 语言文件结构 / Language File Structure

### zh-CN.yml (中文)

```yaml
commands:
  mochi:
    description: Mochi-Link 管理命令
    messages:
      welcome: |-
        Mochi-Link (大福连) - Minecraft 统一管理系统
        使用 mochi.help 查看可用命令
  
  mochi.server:
    description: 服务器管理
    messages:
      menu: |-
        服务器管理命令：
          mochi.server.list - 列出所有服务器
          mochi.server.add <id> <name> - 添加服务器
```

### en-US.yml (英文)

```yaml
commands:
  mochi:
    description: Mochi-Link management commands
    messages:
      welcome: |-
        Mochi-Link - Minecraft Unified Management System
        Use mochi.help to view available commands
  
  mochi.server:
    description: Server management
    messages:
      menu: |-
        Server management commands:
          mochi.server.list - List all servers
          mochi.server.add <id> <name> - Add a server
```

---

## 代码中的使用 / Usage in Code

### 正确的用法

```typescript
// 使用 session.text() 调用国际化文本
ctx.command('mochi', 'commands.mochi.description')
  .action(({ session }) => {
    return session?.text('commands.mochi.messages.welcome') || 
           'Mochi-Link (大福连) - Minecraft 统一管理系统';
  });
```

### 带参数的用法

```typescript
// 使用参数
ctx.command('mochi.server.info <id>', 'commands.mochi.server.info.description')
  .action(async ({ session }, id) => {
    const server = await getServer(id);
    return session?.text('commands.mochi.server.info.messages.info', [
      server.name,
      server.status,
      server.players
    ]) || `服务器: ${server.name}`;
  });
```

### 降级处理

```typescript
// 始终提供降级文本
return session?.text('key') || '默认中文文本';
```

---

## 常见问题 / Troubleshooting

### 问题 1: 语言文件未加载

**症状**: 命令显示的是 key 而不是翻译文本

**解决方案**:
1. 检查 `locales` 目录是否存在
2. 检查 `package.json` 的 `files` 字段
3. 重新安装插件: `yarn remove koishi-plugin-mochi-link && yarn add koishi-plugin-mochi-link`

### 问题 2: 中文别名不工作

**症状**: 使用中文别名时命令无法识别

**解决方案**:
1. 检查命令注册时是否添加了 `.alias()` 
2. 确认别名没有与其他插件冲突
3. 重启 Koishi 实例

### 问题 3: 显示英文而不是中文

**症状**: 即使在中文环境下也显示英文

**解决方案**:
1. 检查 Koishi 的语言设置
2. 检查用户的语言偏好设置
3. 确认 `zh-CN.yml` 文件存在且格式正确

### 问题 4: YAML 格式错误

**症状**: 插件加载失败或语言文件无法解析

**解决方案**:
1. 使用 YAML 验证工具检查格式
2. 确保缩进使用空格而不是制表符
3. 检查特殊字符是否正确转义

---

## 发布前检查清单 / Pre-publish Checklist

在发布新版本前，请确认：

- [ ] `package.json` 的 `files` 字段包含 `locales`
- [ ] `package.json` 的 `koishi.locales` 配置正确
- [ ] 所有语言文件存在且格式正确
- [ ] 代码中使用 `session?.text()` 调用国际化文本
- [ ] 所有命令都有对应的翻译
- [ ] 中文别名已添加
- [ ] 运行 `npm pack` 验证打包内容
- [ ] 本地测试安装和运行
- [ ] 更新版本号
- [ ] 更新 CHANGELOG

---

## 测试命令清单 / Test Commands Checklist

### 基础命令

- [ ] `mochi` - 显示欢迎消息
- [ ] `大福连` - 中文别名
- [ ] `墨池` - 中文别名

### 服务器管理

- [ ] `mochi.server` - 显示菜单
- [ ] `服务器` - 中文别名
- [ ] `mochi.server.list` - 列出服务器
- [ ] `服务器列表` - 中文别名
- [ ] `mochi.server.add` - 添加服务器
- [ ] `服务器.添加` - 中文别名

### 玩家管理

- [ ] `mochi.player` - 显示菜单
- [ ] `玩家` - 中文别名
- [ ] `mochi.player.list` - 列出玩家
- [ ] `玩家列表` - 中文别名

### 白名单管理

- [ ] `mochi.whitelist` - 显示菜单
- [ ] `白名单` - 中文别名
- [ ] `mochi.whitelist.list` - 列出白名单
- [ ] `白名单列表` - 中文别名

---

## 版本更新 / Version Update

修复此问题后，建议更新版本号：

```json
{
  "version": "1.5.1"  // 从 1.5.0 更新到 1.5.1
}
```

并在 CHANGELOG 中记录：

```markdown
## [1.5.1] - 2026-02-20

### Fixed
- 修复 yarn 安装时 locales 目录未包含的问题
- 确保多语言功能正常工作
```

---

## 相关文档 / Related Documentation

- `COMPLETE_I18N_IMPLEMENTATION.md` - 完整的国际化实现文档
- `COMMAND_ALIASES.md` - 命令别名列表
- `locales/zh-CN.yml` - 中文语言文件
- `locales/en-US.yml` - 英文语言文件

---

**修复状态**: ✅ 已完成  
**验证状态**: ⏸️ 待测试  
**发布状态**: ⏸️ 待发布

---

**最后更新**: 2026-02-20  
**维护者**: chm413
