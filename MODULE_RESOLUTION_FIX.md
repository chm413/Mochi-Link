# 模块解析错误修复说明

## 问题描述

Koishi 插件启动时出现以下错误：
```
Service manager initialization skipped (will use basic mode): Error: Cannot find module '../database/operations'
```

## 根本原因

当插件安装到 Koishi 的 `node_modules` 目录时，`lib` 文件夹的子目录（如 `lib/database`、`lib/services` 等）没有被正确复制，导致模块无法找到依赖文件。

## 已执行的修复

### 1. 改进错误处理

修改了 `src/index.ts` 中的服务管理器初始化代码，使错误信息更清晰：

```typescript
} catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn('Service manager initialization skipped (will use basic mode):', errorMsg);
    if (error instanceof Error && error.stack) {
        logger.debug('Stack trace:', error.stack);
    }
}
```

### 2. 复制完整的 lib 文件夹

已将完整的 `lib` 文件夹（包含所有子目录）复制到 Koishi 安装目录：
```
E:\mc_nekobridge\lib → E:\koishi\node_modules\koishi-plugin-mochi-link\lib
```

复制了 184 个文件，包括：
- `lib/database/` - 数据库操作模块
- `lib/services/` - 服务层模块
- `lib/websocket/` - WebSocket 管理模块
- 其他所有必需的模块

### 3. 复制语言文件

已将语言文件复制到 Koishi 安装目录：
```
E:\mc_nekobridge\locales → E:\koishi\node_modules\koishi-plugin-mochi-link\locales
```

## 需要执行的操作

### 重启 Koishi

请重启 Koishi 服务以加载更新后的插件文件。

### 预期结果

重启后，插件应该能够正常加载，日志应显示：

```
[I] mochi-link Starting Mochi-Link plugin...
[I] mochi-link Database initialized successfully
[I] mochi-link Service manager initialized successfully
[I] mochi-link Mochi-link plugin started successfully
[I] mochi-link Database tables created with prefix: mochi_
```

如果服务管理器仍然无法初始化，插件会降级到基础模式运行，但不会影响核心功能（数据库和命令系统）。

## 功能状态

### ✅ 可用功能（基础模式）

即使服务管理器未初始化，以下功能仍然可用：

1. **服务器管理**
   - `mochi.server.list` - 列出服务器
   - `mochi.server.add` - 添加服务器
   - `mochi.server.info` - 查看服务器信息
   - `mochi.server.remove` - 删除服务器

2. **群组绑定**
   - `mochi.bind.add` - 绑定服务器到群组
   - `mochi.bind.list` - 查看群组绑定
   - `mochi.bind.remove` - 解除绑定
   - `mochi.bind.set` - 设置默认服务器

3. **审计日志**
   - `mochi.audit` - 查看审计日志

4. **数据库**
   - 所有数据库表已创建
   - 审计日志记录正常

### ⚠️ 需要服务管理器的功能

以下功能需要服务管理器和 WebSocket 连接：

1. **白名单管理**
   - `mochi.whitelist.list` - 查看白名单
   - `mochi.whitelist.add` - 添加到白名单
   - `mochi.whitelist.remove` - 从白名单移除

2. **玩家管理**
   - `mochi.player.list` - 查看在线玩家
   - `mochi.player.info` - 查看玩家详情
   - `mochi.player.kick` - 踢出玩家

3. **命令执行**
   - `mochi.exec` - 在服务器执行命令

这些功能在服务器通过 WebSocket 连接后才能使用。

## 长期解决方案

为了避免将来出现类似问题，建议：

1. **使用 npm link 进行开发**
   ```bash
   # 在插件目录
   npm link
   
   # 在 Koishi 目录
   npm link koishi-plugin-mochi-link
   ```

2. **或者使用本地路径安装**
   ```bash
   # 在 Koishi 目录
   npm install E:/mc_nekobridge
   ```

3. **发布到 npm 后使用正式版本**
   ```bash
   npm install koishi-plugin-mochi-link
   ```

## 版本信息

- 插件版本: v1.5.0
- 修复日期: 2026-02-19
- 修复内容: 模块解析错误 + 完整文件复制

## 技术细节

### 模块解析路径

Node.js 的 `require()` 使用相对路径解析模块：
- `lib/services/audit.js` 需要 `../database/operations`
- 解析为 `lib/database/operations.js`

如果 `lib/database/` 目录不存在，就会出现 "Cannot find module" 错误。

### package.json 配置

`package.json` 中的 `files` 字段应该包含：
```json
{
  "files": [
    "lib",
    "locales",
    "README.md"
  ]
}
```

这确保 `npm pack` 和 `npm publish` 时包含所有必需的文件。

## 联系支持

如果问题仍然存在，请提供以下信息：

1. Koishi 启动日志
2. 插件版本信息
3. Node.js 版本
4. 操作系统信息

---

**注意**: 此修复是临时解决方案。建议在下次更新时修复 TypeScript 编译错误并重新构建完整的 `lib` 目录。
