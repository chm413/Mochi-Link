#!/bin/bash

# Mochi-Link 打包脚本
# 用于创建可分发的 npm 包

set -e

echo "🎁 Mochi-Link 打包脚本"
echo "======================="

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 清理旧的构建
echo "🧹 清理旧的构建..."
rm -rf lib/
rm -f *.tgz

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建项目
echo "🔨 构建项目..."
npm run build

# 检查 lib 目录
if [ ! -d "lib" ]; then
    echo "❌ 错误: lib 目录不存在，构建失败"
    exit 1
fi

# 打包
echo "📦 打包..."
npm pack

# 获取生成的文件名
PACKAGE_FILE=$(ls -t *.tgz | head -1)

if [ -z "$PACKAGE_FILE" ]; then
    echo "❌ 错误: 打包失败"
    exit 1
fi

echo ""
echo "✅ 打包完成！"
echo "📦 文件: $PACKAGE_FILE"
echo ""
echo "📋 安装方法:"
echo "   npm install ./$PACKAGE_FILE"
echo ""
echo "📤 分发方法:"
echo "   1. 将 $PACKAGE_FILE 上传到服务器"
echo "   2. 在目标机器上运行: npm install ./$PACKAGE_FILE"
echo ""
