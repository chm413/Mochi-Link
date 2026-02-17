# Koishi 插件安装指南（未发布到 npm）
# Koishi Plugin Installation Guide (Not Published to npm)

**插件名称**: koishi-plugin-mochi-link  
**GitHub 仓库**: https://github.com/chm413/Mochi-Link

---

## 方法概览

对于未发布到 npm 的 Koishi 插件，有以下几种安装方式：

| 方法 | 难度 | 推荐度 | 适用场景 |
|------|------|--------|----------|
| 方法 1: 本地路径安装 | ⭐ 简单 | ⭐⭐⭐⭐⭐ | 开发和测试 |
| 方法 2: GitHub 直接安装 | ⭐⭐ 中等 | ⭐⭐⭐⭐ | 生产环境 |
| 方法 3: Git 子模块 | ⭐⭐⭐ 复杂 | ⭐⭐⭐ | 多项目管理 |
| 方法 4: 本地 npm 包 | ⭐⭐ 中等 | ⭐⭐⭐⭐ | 离线部署 |

---

## 方法 1: 本地路径安装（推荐用于开发）

### 步骤 1: 克隆仓库

```bash
# 克隆到本地
git clone https://github.com/chm413/Mochi-Link.git
cd Mochi-Link

# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

### 步骤 2: 在 Koishi 项目中安装

在你的 Koishi 项目目录中：

```bash
# 使用相对路径或绝对路径安装
npm install /path/to/Mochi-Link

# 或者使用 file: 协议
npm install file:../Mochi-Link
```

### 步骤 3: 在 Koishi 配置中启用

编辑 `koishi.yml`:

```yaml
plugins:
  mochi-link:
    # 插件配置
    database:
      type: sqlite
      path: ./data/mochi-link.db
    http:
      port: 25565
      host: 0.0.0.0
```

### 优点
- ✅ 简单快速
- ✅ 适合开发和调试
- ✅ 可以实时修改代码

### 缺点
- ❌ 需要手动更新
- ❌ 路径依赖可能导致部署问题

---

## 方法 2: GitHub 直接安装（推荐用于生产）

### 步骤 1: 确保代码已编译

在你的 GitHub 仓库中，确保 `lib/` 目录已提交（或使用 GitHub Actions 自动构建）。

#### 选项 A: 提交编译后的代码

```bash
# 在 Mochi-Link 项目中
npm run build

# 提交 lib 目录
git add lib/
git commit -m "Add compiled files"
git push
```

#### 选项 B: 使用 GitHub Actions 自动构建

创建 `.github/workflows/build.yml`:

```yaml
name: Build

on:
  push:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: "chore: build artifacts"
          file_pattern: lib/**
```

### 步骤 2: 在 Koishi 项目中安装

```bash
# 从 GitHub 安装（使用 main 分支）
npm install git+https://github.com/chm413/Mochi-Link.git

# 或指定分支
npm install git+https://github.com/chm413/Mochi-Link.git#main

# 或指定 tag/版本
npm install git+https://github.com/chm413/Mochi-Link.git#v1.0.0

# 或指定 commit
npm install git+https://github.com/chm413/Mochi-Link.git#abc1234
```

### 步骤 3: 在 package.json 中固定版本

编辑 Koishi 项目的 `package.json`:

```json
{
  "dependencies": {
    "koishi-plugin-mochi-link": "git+https://github.com/chm413/Mochi-Link.git#v1.0.0"
  }
}
```

### 优点
- ✅ 适合生产环境
- ✅ 可以指定版本/分支/commit
- ✅ 支持 npm install 和 package-lock.json

### 缺点
- ❌ 需要提交编译后的代码或配置 CI/CD
- ❌ 更新需要重新安装

---

## 方法 3: Git 子模块（适合多项目）

### 步骤 1: 添加为子模块

在 Koishi 项目中：

```bash
# 添加子模块到 plugins 目录
git submodule add https://github.com/chm413/Mochi-Link.git plugins/mochi-link

# 初始化子模块
git submodule update --init --recursive
```

### 步骤 2: 构建插件

```bash
cd plugins/mochi-link
npm install
npm run build
cd ../..
```

### 步骤 3: 链接到 node_modules

```bash
# 创建符号链接
npm link ./plugins/mochi-link

# 或在 package.json 中添加
npm install file:./plugins/mochi-link
```

### 步骤 4: 更新子模块

```bash
# 更新到最新版本
git submodule update --remote plugins/mochi-link

# 重新构建
cd plugins/mochi-link
npm install
npm run build
```

### 优点
- ✅ 版本控制集成
- ✅ 适合管理多个自定义插件
- ✅ 团队协作友好

### 缺点
- ❌ 配置相对复杂
- ❌ 需要了解 Git 子模块

---

## 方法 4: 本地 npm 包（适合离线部署）

### 步骤 1: 打包插件

在 Mochi-Link 项目中：

```bash
# 构建项目
npm run build

# 打包为 .tgz 文件
npm pack
```

这会生成 `koishi-plugin-mochi-link-1.0.0.tgz` 文件。

### 步骤 2: 安装打包文件

将 `.tgz` 文件复制到 Koishi 项目目录，然后：

```bash
# 安装本地包
npm install ./koishi-plugin-mochi-link-1.0.0.tgz
```

### 步骤 3: 更新插件

```bash
# 重新打包
npm pack

# 重新安装
npm install ./koishi-plugin-mochi-link-1.0.0.tgz --force
```

### 优点
- ✅ 适合离线环境
- ✅ 可以分发给其他用户
- ✅ 版本控制清晰

### 缺点
- ❌ 更新需要重新打包和安装
- ❌ 需要手动管理 .tgz 文件

---

## 推荐方案

### 开发环境

**推荐**: 方法 1（本地路径安装）

```bash
# 1. 克隆仓库
git clone https://github.com/chm413/Mochi-Link.git
cd Mochi-Link
npm install
npm run build

# 2. 在 Koishi 项目中安装
cd /path/to/koishi-project
npm install file:../Mochi-Link

# 3. 开发时使用 watch 模式
cd ../Mochi-Link
npm run watch
```

### 生产环境

**推荐**: 方法 2（GitHub 直接安装）

#### 方案 A: 提交编译代码（简单）

```bash
# 在 Mochi-Link 项目中
npm run build
git add lib/
git commit -m "chore: add compiled files"
git push

# 在 Koishi 项目中
npm install git+https://github.com/chm413/Mochi-Link.git#v1.0.0
```

#### 方案 B: 使用 GitHub Actions（推荐）

1. 创建 `.github/workflows/build.yml`（见上文）
2. 推送代码，GitHub Actions 自动构建
3. 在 Koishi 项目中安装：

```bash
npm install git+https://github.com/chm413/Mochi-Link.git
```

---

## 配置 package.json

### 确保 files 字段正确

在 `Mochi-Link/package.json` 中：

```json
{
  "name": "koishi-plugin-mochi-link",
  "version": "1.0.0",
  "main": "lib/index.js",
  "typings": "lib/index.d.ts",
  "files": [
    "lib",           // ✅ 包含编译后的代码
    "readme.md"
  ]
}
```

### 添加 prepare 脚本（可选）

自动在安装时构建：

```json
{
  "scripts": {
    "prepare": "npm run build"
  }
}
```

**注意**: 这会在每次 `npm install` 时自动构建，可能增加安装时间。

---

## 完整示例：生产环境部署

### 1. 准备 Mochi-Link 仓库

```bash
# 克隆仓库
git clone https://github.com/chm413/Mochi-Link.git
cd Mochi-Link

# 安装依赖
npm install

# 构建
npm run build

# 提交编译后的代码（如果不使用 GitHub Actions）
git add lib/
git commit -m "chore: add compiled files"
git push

# 创建版本标签
git tag v1.0.0
git push origin v1.0.0
```

### 2. 创建 Koishi 项目

```bash
# 创建新的 Koishi 项目
mkdir my-koishi-bot
cd my-koishi-bot
npm init -y

# 安装 Koishi
npm install koishi

# 安装 Mochi-Link 插件
npm install git+https://github.com/chm413/Mochi-Link.git#v1.0.0

# 安装数据库适配器（如果需要）
npm install @koishijs/plugin-database-sqlite
```

### 3. 配置 Koishi

创建 `koishi.yml`:

```yaml
# Koishi 配置
port: 5140

plugins:
  # 数据库
  database-sqlite:
    path: ./data/koishi.db

  # Mochi-Link 插件
  mochi-link:
    # WebSocket 服务器配置
    websocket:
      port: 25565
      host: 0.0.0.0
      
    # HTTP API 配置
    http:
      port: 25566
      enabled: true
      
    # 数据库配置
    database:
      type: sqlite
      path: ./data/mochi-link.db
      
    # 安全配置
    security:
      enableTokenAuth: true
      tokenExpiry: 86400000
```

### 4. 启动 Koishi

```bash
# 启动
npx koishi start

# 或添加到 package.json scripts
npm start
```

---

## 更新插件

### 方法 1: 本地路径安装

```bash
cd /path/to/Mochi-Link
git pull
npm install
npm run build

# Koishi 会自动使用最新代码
```

### 方法 2: GitHub 安装

```bash
cd /path/to/koishi-project

# 更新到最新版本
npm update koishi-plugin-mochi-link

# 或重新安装指定版本
npm install git+https://github.com/chm413/Mochi-Link.git#v1.1.0 --force
```

---

## 故障排除

### 问题 1: 找不到模块

**错误**: `Cannot find module 'koishi-plugin-mochi-link'`

**解决**:
```bash
# 检查是否正确安装
npm list koishi-plugin-mochi-link

# 重新安装
npm install git+https://github.com/chm413/Mochi-Link.git --force
```

### 问题 2: 编译文件缺失

**错误**: `Cannot find module './lib/index.js'`

**解决**:
```bash
# 确保 lib 目录存在
cd /path/to/Mochi-Link
npm run build

# 或在 GitHub 仓库中提交 lib 目录
git add lib/
git commit -m "chore: add compiled files"
git push
```

### 问题 3: 版本冲突

**错误**: `peer dependency conflict`

**解决**:
```bash
# 使用 --legacy-peer-deps
npm install git+https://github.com/chm413/Mochi-Link.git --legacy-peer-deps

# 或使用 --force
npm install git+https://github.com/chm413/Mochi-Link.git --force
```

---

## 最佳实践

### 1. 使用版本标签

```bash
# 创建版本标签
git tag v1.0.0
git push origin v1.0.0

# 安装特定版本
npm install git+https://github.com/chm413/Mochi-Link.git#v1.0.0
```

### 2. 使用 GitHub Releases

1. 在 GitHub 上创建 Release
2. 附加编译后的 .tgz 文件
3. 用户可以下载并安装

### 3. 文档化安装步骤

在 `README.md` 中添加安装说明：

```markdown
## 安装

### 从 GitHub 安装

\`\`\`bash
npm install git+https://github.com/chm413/Mochi-Link.git
\`\`\`

### 从本地安装

\`\`\`bash
git clone https://github.com/chm413/Mochi-Link.git
cd Mochi-Link
npm install
npm run build
cd /path/to/koishi-project
npm install file:../Mochi-Link
\`\`\`
```

---

## 总结

| 场景 | 推荐方法 | 命令 |
|------|----------|------|
| 开发和调试 | 本地路径安装 | `npm install file:../Mochi-Link` |
| 生产部署 | GitHub 直接安装 | `npm install git+https://github.com/chm413/Mochi-Link.git#v1.0.0` |
| 离线环境 | 本地 npm 包 | `npm install ./koishi-plugin-mochi-link-1.0.0.tgz` |
| 多项目管理 | Git 子模块 | `git submodule add https://github.com/chm413/Mochi-Link.git` |

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-16  
**作者**: Kiro AI Assistant
