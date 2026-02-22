# 命令结构修复报告

## 问题描述

用户反馈：
1. 输入任何命令都返回 "Mochi-Link (大福连) - Minecraft 统一管理系统 使用 mochi.help 查看可用命令"
2. 子命令的用法和参数提示不完整
3. 一级指令覆盖了次级指令

## 问题原因

在 Koishi 中，如果父命令定义了 `.action()`，它会拦截所有没有匹配到具体子命令的调用。

### 问题代码示例

```typescript
// 错误：父命令有 action
ctx.command('mochi', 'Minecraft 统一管理系统')
  .action(() => {
    return 'Mochi-Link (大福连) - Minecraft 统一管理系统\n使用 mochi.help 查看可用命令';
  });

ctx.command('mochi.server', '服务器管理')
  .action(() => {
    return '服务器管理命令：\n  mochi.server.list - 列出所有服务器\n...';
  });
```

这会导致：
- 用户输入 `mochi` → 返回欢迎信息（正确）
- 用户输入 `mochi.server` → 也返回欢迎信息（错误！应该显示子命令列表）
- 用户输入 `mochi.help` → 无法正确显示帮助信息

## 解决方案

移除所有父命令的 `.action()`，让 Koishi 自动处理：
- 当用户输入父命令时，Koishi 会自动显示子命令列表
- 当用户输入 `help` 时，会显示完整的命令帮助
- 子命令的参数和用法会正确显示

### 修复后的代码

```typescript
// 正确：父命令没有 action
ctx.command('mochi', 'Minecraft 统一管理系统')
  .alias('大福连')
  .alias('墨池')
  .userFields(['authority']);

ctx.command('mochi.server', '服务器管理')
  .userFields(['authority']);

// 子命令正常定义
ctx.command('mochi.server.list', '列出所有服务器')
  .userFields(['authority'])
  .action(async ({ session }) => {
    // 实际逻辑
  });
```

## 修复的命令

1. **mochi** - 根命令
   - 移除了固定的欢迎信息
   - 现在会自动显示所有子命令

2. **mochi.server** - 服务器管理
   - 移除了手动的子命令列表
   - 现在会自动显示 list、add、info、remove 等子命令

3. **mochi.whitelist** - 白名单管理
   - 移除了手动的子命令列表
   - 现在会自动显示 list、add、remove 等子命令

4. **mochi.player** - 玩家管理
   - 移除了手动的子命令列表
   - 现在会自动显示 list、info、kick 等子命令

5. **mochi.bind** - 频道绑定管理
   - 移除了手动的子命令列表
   - 现在会自动显示 add、list、remove 等子命令

## 效果对比

### 修复前

```
用户: mochi
机器人: Mochi-Link (大福连) - Minecraft 统一管理系统
使用 mochi.help 查看可用命令

用户: mochi.server
机器人: Mochi-Link (大福连) - Minecraft 统一管理系统  ← 错误！
使用 mochi.help 查看可用命令

用户: mochi.help
机器人: [显示不完整的帮助信息]
```

### 修复后

```
用户: mochi
机器人: [自动显示所有子命令列表]
可用命令：
  mochi.server - 服务器管理
  mochi.whitelist - 白名单管理
  mochi.player - 玩家管理
  mochi.bind - 频道绑定管理
  mochi.audit - 审计日志
  mochi.exec - 执行服务器命令

用户: mochi.server
机器人: [自动显示服务器管理的子命令]
可用命令：
  mochi.server.list - 列出所有服务器
  mochi.server.add <id> <name> - 添加服务器
  mochi.server.info <id> - 查看服务器信息
  mochi.server.remove <id> - 删除服务器

用户: mochi.help
机器人: [显示完整的命令帮助，包括参数说明]
```

## Koishi 命令系统最佳实践

### 1. 父命令不要定义 action

```typescript
// ✅ 正确
ctx.command('parent', '父命令描述');

// ❌ 错误
ctx.command('parent', '父命令描述')
  .action(() => '这会覆盖子命令');
```

### 2. 只在叶子命令定义 action

```typescript
// ✅ 正确
ctx.command('parent.child', '子命令描述')
  .action(async () => {
    // 实际逻辑
  });
```

### 3. 使用描述字段

```typescript
// 描述会自动显示在帮助信息中
ctx.command('command <arg>', '命令描述')
  .option('opt', '-o <value> 选项描述')
  .action(async ({ options }, arg) => {
    // 逻辑
  });
```

### 4. 参数和选项的正确定义

```typescript
// 必填参数
ctx.command('cmd <required>', '描述')

// 可选参数
ctx.command('cmd [optional]', '描述')

// 剩余参数
ctx.command('cmd <first> [...rest]', '描述')

// 选项
ctx.command('cmd', '描述')
  .option('name', '-n <value> 描述', { fallback: 'default' })
```

## 用户体验改进

### 1. 自动帮助信息
- 用户输入父命令时，自动显示子命令列表
- 用户输入 `help` 时，显示完整的命令帮助
- 参数和选项的说明自动显示

### 2. 命令补全
- Koishi 会自动提供命令补全
- 参数提示会正确显示

### 3. 错误提示
- 参数缺失时，自动提示正确的用法
- 参数类型错误时，自动提示正确的类型

## 测试建议

### 1. 测试父命令
```
mochi
mochi.server
mochi.whitelist
mochi.player
mochi.bind
```
预期：显示对应的子命令列表

### 2. 测试帮助命令
```
mochi.help
mochi.server.help
mochi.server.list.help
```
预期：显示完整的命令帮助和参数说明

### 3. 测试子命令
```
mochi.server.list
mochi.whitelist.list
mochi.player.list
```
预期：正确执行命令逻辑

### 4. 测试参数提示
```
mochi.server.add
mochi.server.info
```
预期：提示缺少必填参数

## 注意事项

1. **不要在父命令定义 action**
   - 这是最常见的错误
   - 会导致子命令无法正常工作

2. **使用 Koishi 的自动帮助系统**
   - 不要手动编写帮助信息
   - Koishi 会自动生成更好的帮助

3. **正确定义参数和选项**
   - 使用 `<>` 表示必填参数
   - 使用 `[]` 表示可选参数
   - 使用 `.option()` 定义选项

4. **描述要清晰简洁**
   - 命令描述会显示在帮助列表中
   - 选项描述会显示在详细帮助中

## 更新日志

- **2026-02-22**: 修复命令结构问题
  - 移除所有父命令的 `.action()`
  - 让 Koishi 自动处理命令帮助
  - 改善用户体验和命令提示

