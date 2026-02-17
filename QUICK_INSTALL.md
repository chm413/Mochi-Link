# Koishi 插件快速安装
# Quick Installation Guide

## 🚀 最快安装方式

### 开发环境（推荐）

```bash
# 1. 克隆并构建
git clone https://github.com/chm413/Mochi-Link.git
cd Mochi-Link
npm install && npm run build

# 2. 在 Koishi 项目中安装
cd /path/to/koishi-project
npm install file:../Mochi-Link
```

### 生产环境（推荐）

```bash
# 直接从 GitHub 安装
npm install git+https://github.com/chm413/Mochi-Link.git

# 或安装特定版本
npm install git+https://github.com/chm413/Mochi-Link.git#v1.0.0
```

---

## 📋 前提条件

在安装之前，确保：

1. ✅ Mochi-Link 仓库中的 `lib/` 目录已提交（或配置了 GitHub Actions）
2. ✅ 你的 Koishi 项目已初始化
3. ✅ Node.js 版本 >= 16.0

---

## 🔧 配置 Koishi

在 `koishi.yml` 中添加：

```yaml
plugins:
  mochi-link:
    websocket:
      port: 25565
      host: 0.0.0.0
    http:
      port: 25566
      enabled: true
    database:
      type: sqlite
      path: ./data/mochi-link.db
```

---

## ⚠️ 重要提示

### 如果使用 GitHub 安装

确保 `lib/` 目录已提交到 GitHub：

```bash
# 在 Mochi-Link 项目中
npm run build
git add lib/
git commit -m "chore: add compiled files"
git push
```

### 或使用 GitHub Actions 自动构建

创建 `.github/workflows/build.yml`:

```yaml
name: Build
on:
  push:
    branches: [ main ]
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

---

## 🔄 更新插件

### 本地安装

```bash
cd /path/to/Mochi-Link
git pull && npm install && npm run build
```

### GitHub 安装

```bash
npm update koishi-plugin-mochi-link
# 或
npm install git+https://github.com/chm413/Mochi-Link.git --force
```

---

## 🆘 常见问题

### 找不到模块？

```bash
# 重新安装
npm install git+https://github.com/chm413/Mochi-Link.git --force
```

### 编译文件缺失？

```bash
# 在 Mochi-Link 项目中
npm run build
git add lib/
git commit -m "chore: add compiled files"
git push
```

---

## 📚 完整文档

查看 `KOISHI_INSTALLATION_GUIDE.md` 获取详细说明。

---

**快速帮助**: 如有问题，请访问 https://github.com/chm413/Mochi-Link/issues
