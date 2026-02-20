#!/bin/sh
# 调试脚本 - 在容器中运行

echo "==================================="
echo "Mochi-Link 插件调试信息"
echo "==================================="
echo ""

echo "1. 检查插件目录是否存在:"
ls -la /koishi/node_modules/koishi-plugin-mochi-link/ 2>&1
echo ""

echo "2. 检查 lib 目录:"
ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/ 2>&1
echo ""

echo "3. 检查 lib/database 目录:"
ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/database/ 2>&1
echo ""

echo "4. 检查 operations.js 文件:"
ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/database/operations.js 2>&1
echo ""

echo "5. 检查 lib/services 目录:"
ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/services/ 2>&1
echo ""

echo "6. 检查 audit.js 文件内容（前 15 行）:"
head -n 15 /koishi/node_modules/koishi-plugin-mochi-link/lib/services/audit.js 2>&1
echo ""

echo "7. 测试相对路径解析:"
cd /koishi/node_modules/koishi-plugin-mochi-link/lib/services
echo "当前目录: $(pwd)"
echo "目标文件: ../database/operations.js"
ls -la ../database/operations.js 2>&1
echo ""

echo "8. 检查 package.json:"
cat /koishi/node_modules/koishi-plugin-mochi-link/package.json 2>&1
echo ""

echo "9. Node.js 版本:"
node --version
echo ""

echo "10. 尝试手动 require:"
node -e "try { require('/koishi/node_modules/koishi-plugin-mochi-link/lib/database/operations.js'); console.log('✓ 直接 require 成功'); } catch(e) { console.log('✗ 直接 require 失败:', e.message); }"
echo ""

echo "==================================="
echo "调试信息收集完成"
echo "==================================="
