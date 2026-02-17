# 无 Git 环境安装指南
# Installation Guide Without Git

**适用场景**: Docker 容器、受限环境、无法安装 Git 的服务器

---

## 问题说明

当你尝试运行 `npm install git+https://...` 时遇到以下错误：

```
npm error syscall spawn git
npm error errno -2
npm error enoent An unknown git error occurred
```

这表明你的环境中没有安装 Git。

---

## 解决方案

### 方案 1: 安装 Git（推荐）

#### Alpine Linux (常见于 Docker)

```bash
apk add git
```

#### Debian/Ubuntu

```bash
apt-get update
apt-get install -y git
```

#### CentOS/RHEL

```bash
yum install -y git
```

安装后重试：

```bash
npm install git+https://github.com/chm413/Mochi-Link.git
```

---

### 方案 2: 使用 tarball 包（无需 Git）

#### 步骤 1: 在有 Git 的机器上打包

在你的开发机器上（有 Git 的地方）：

```bash
# 克隆仓库
git clone https://github.com/chm413/Mochi-Link.git
cd Mochi-Link

# 运行打包脚本
# Windows:
scripts\pack-for-distribution.bat

# Linux/Mac:
chmod +x scripts/pack-for-distribution.sh
./scripts/pack-for-distribution.sh
```

这会生成 `koishi-plugin-mochi-link-1.0.0.tgz` 文件。

#### 步骤 2: 传输到目标服务器

```bash
# 使用 scp
scp koishi-plugin-mochi-link-1.0.0.tgz user@server:/path/to/koishi/

# 或使用 FTP/SFTP 工具上传
```

#### 步骤 3: 在目标服务器上安装

```bash
cd /path/to/koishi
npm install ./koishi-plugin-mochi-link-1.0.0.tgz
```

---

### 方案 3: 手动下载和构建

#### 步骤 1: 下载源码

```bash
# 使用 wget
wget https://github.com/chm413/Mochi-Link/archive/refs/heads/main.zip

# 或使用 curl
curl -L https://github.com/chm413/Mochi-Link/archive/refs/heads/main.zip -o main.zip
```

#### 步骤 2: 解压

```bash
# 安装 unzip（如果没有）
# Alpine: apk add unzip
# Debian/Ubuntu: apt-get install unzip

unzip main.zip
mv Mochi-Link-main Mochi-Link
cd Mochi-Link
```

#### 步骤 3: 构建

```bash
# 安装依赖
npm install

# 构建
npm run build
```

#### 步骤 4: 安装到 Koishi

```bash
cd /path/to/koishi
npm install /path/to/Mochi-Link
```

---

### 方案 4: 使用 GitHub API 下载（推荐用于自动化）

创建一个安装脚本：

```bash
#!/bin/bash

# 无 Git 安装脚本
set -e

REPO="chm413/Mochi-Link"
BRANCH="main"
TEMP_DIR="/tmp/mochi-link-install"

echo "📦 下载 Mochi-Link..."

# 创建临时目录
mkdir -p $TEMP_DIR
cd $TEMP_DIR

# 下载源码
curl -L "https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" -o source.zip

# 解压
unzip -q source.zip
cd Mochi-Link-$BRANCH

# 构建
echo "🔨 构建插件..."
npm install
npm run build

# 打包
echo "📦 打包..."
npm pack

# 安装
PACKAGE=$(ls -t *.tgz | head -1)
echo "✅ 安装 $PACKAGE..."
npm install -g "$PACKAGE"

# 清理
cd /
rm -rf $TEMP_DIR

echo "✅ 安装完成！"
```

保存为 `install-mochi-link.sh`，然后运行：

```bash
chmod +x install-mochi-link.sh
./install-mochi-link.sh
```

---

## Docker 环境特别说明

### Dockerfile 示例

如果你使用 Docker，可以在 Dockerfile 中添加 Git：

```dockerfile
FROM node:18-alpine

# 安装 Git
RUN apk add --no-cache git

# 安装 Koishi
RUN npm install -g koishi

# 安装 Mochi-Link
RUN npm install -g git+https://github.com/chm413/Mochi-Link.git

# ... 其他配置
```

### docker-compose.yml 示例

```yaml
version: '3'
services:
  koishi:
    image: node:18-alpine
    command: sh -c "apk add --no-cache git && npm install -g koishi && npm install -g git+https://github.com/chm413/Mochi-Link.git && koishi start"
    volumes:
      - ./data:/app/data
    ports:
      - "5140:5140"
```

---

## 预构建包下载

### 从 GitHub Releases 下载（如果可用）

1. 访问 https://github.com/chm413/Mochi-Link/releases
2. 下载最新的 `.tgz` 文件
3. 上传到服务器
4. 运行 `npm install ./koishi-plugin-mochi-link-*.tgz`

---

## 验证安装

安装完成后，验证：

```bash
# 检查是否安装成功
npm list koishi-plugin-mochi-link

# 查看版本
npm info koishi-plugin-mochi-link version

# 测试运行
npx koishi start
```

---

## 常见问题

### Q: 为什么需要 Git？

A: `npm install git+https://...` 命令使用 Git 协议从 GitHub 克隆仓库。如果没有 Git，npm 无法执行此操作。

### Q: 可以不安装 Git 吗？

A: 可以！使用方案 2（tarball 包）或方案 3（手动下载）即可。

### Q: tarball 包和 Git 安装有什么区别？

A: 
- **Git 安装**: 直接从 GitHub 安装，始终获取最新代码
- **tarball 包**: 预先打包的版本，不需要 Git，适合离线环境

### Q: 如何更新插件？

A: 
- **Git 安装**: `npm update koishi-plugin-mochi-link`
- **tarball 包**: 下载新版本的 `.tgz` 文件，重新安装

### Q: Alpine Linux 安装 Git 后仍然报错？

A: 尝试安装完整的 Git 工具链：

```bash
apk add --no-cache git openssh-client
```

---

## 自动化安装脚本

### 完整的一键安装脚本

```bash
#!/bin/bash

# Mochi-Link 一键安装脚本（无需 Git）
set -e

echo "🚀 Mochi-Link 一键安装脚本"
echo "=========================="

# 检查是否有 Git
if command -v git &> /dev/null; then
    echo "✅ 检测到 Git，使用 Git 安装..."
    npm install git+https://github.com/chm413/Mochi-Link.git
    exit 0
fi

echo "⚠️  未检测到 Git，使用备用方案..."

# 检查必需工具
for cmd in curl unzip npm; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ 错误: 需要 $cmd 但未安装"
        exit 1
    fi
done

# 下载和安装
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

echo "📥 下载源码..."
curl -L "https://github.com/chm413/Mochi-Link/archive/refs/heads/main.zip" -o source.zip

echo "📦 解压..."
unzip -q source.zip
cd Mochi-Link-main

echo "🔨 构建..."
npm install --silent
npm run build --silent

echo "📦 打包..."
PACKAGE=$(npm pack --silent)

echo "✅ 安装..."
npm install -g "$TEMP_DIR/Mochi-Link-main/$PACKAGE"

echo "🧹 清理..."
cd /
rm -rf $TEMP_DIR

echo ""
echo "✅ 安装完成！"
echo "📝 运行 'npx koishi start' 启动 Koishi"
```

保存为 `install.sh`，运行：

```bash
curl -fsSL https://raw.githubusercontent.com/chm413/Mochi-Link/main/install.sh | bash
```

---

## 总结

| 方案 | 需要 Git | 难度 | 适用场景 |
|------|----------|------|----------|
| 安装 Git | ❌ | ⭐ | 有权限安装软件 |
| tarball 包 | ❌ | ⭐⭐ | 离线环境、受限环境 |
| 手动下载 | ❌ | ⭐⭐⭐ | 完全控制构建过程 |
| 自动化脚本 | ❌ | ⭐⭐ | 批量部署 |

**推荐**: 
- 如果可以安装软件 → 安装 Git（方案 1）
- 如果不能安装 Git → 使用 tarball 包（方案 2）

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-17  
**作者**: Kiro AI Assistant
