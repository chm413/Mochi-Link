#!/bin/bash
# Fabric 和 Forge 连接器编译脚本
# 此脚本尝试编译 Fabric 和 Forge 连接器

echo "========================================"
echo "Mochi-Link Fabric/Forge 连接器编译脚本"
echo "========================================"
echo ""

# 检查 Java 版本
echo "[1/4] 检查 Java 环境..."
if ! command -v java &> /dev/null; then
    echo "[错误] 未找到 Java，请先安装 Java 17 或更高版本"
    exit 1
fi
echo "[成功] Java 环境检测通过"
echo ""

# 检查 Gradle
echo "[2/4] 检查 Gradle 环境..."
if ! command -v gradle &> /dev/null; then
    echo "[错误] 未找到 Gradle，请先安装 Gradle"
    exit 1
fi
echo "[成功] Gradle 环境检测通过"
echo ""

# 尝试编译 Fabric
echo "[3/4] 尝试编译 Fabric 连接器..."
echo ""
echo "注意: Fabric 需要 Fabric Loom 插件才能完整编译"
echo "当前配置为简化编译，可能会失败"
echo ""
cd connectors/fabric
gradle clean build --no-daemon --warning-mode all
FABRIC_RESULT=$?
cd ../..

if [ $FABRIC_RESULT -eq 0 ]; then
    echo "[成功] Fabric 连接器编译成功"
    if [ -f connectors/fabric/build/libs/*.jar ]; then
        echo "[复制] 复制 Fabric JAR 到 output 目录..."
        cp connectors/fabric/build/libs/*.jar output/
    fi
else
    echo "[失败] Fabric 连接器编译失败"
    echo ""
    echo "可能的原因:"
    echo "1. 缺少 Fabric Loom 插件"
    echo "2. 缺少 Minecraft 依赖"
    echo "3. 网络连接问题"
    echo ""
    echo "请参考 connectors/fabric/README_BUILD.md 获取详细说明"
fi
echo ""

# 尝试编译 Forge
echo "[4/4] 尝试编译 Forge 连接器..."
echo ""
echo "注意: Forge 需要 ForgeGradle 插件才能完整编译"
echo "当前配置为简化编译，可能会失败"
echo ""
cd connectors/forge
gradle clean build --no-daemon --warning-mode all
FORGE_RESULT=$?
cd ../..

if [ $FORGE_RESULT -eq 0 ]; then
    echo "[成功] Forge 连接器编译成功"
    if [ -f connectors/forge/build/libs/*.jar ]; then
        echo "[复制] 复制 Forge JAR 到 output 目录..."
        cp connectors/forge/build/libs/*.jar output/
    fi
else
    echo "[失败] Forge 连接器编译失败"
    echo ""
    echo "可能的原因:"
    echo "1. 缺少 ForgeGradle 插件"
    echo "2. 缺少 Minecraft 依赖"
    echo "3. 网络连接问题"
    echo ""
    echo "请参考 connectors/forge/README_BUILD.md 获取详细说明"
fi
echo ""

# 总结
echo "========================================"
echo "编译总结"
echo "========================================"
if [ $FABRIC_RESULT -eq 0 ]; then
    echo "Fabric: 成功"
else
    echo "Fabric: 失败"
fi
if [ $FORGE_RESULT -eq 0 ]; then
    echo "Forge: 成功"
else
    echo "Forge: 失败"
fi
echo "========================================"
echo ""

if [ $FABRIC_RESULT -ne 0 ]; then
    echo "提示: Fabric 编译失败是正常的，因为需要 Fabric Loom 环境"
fi
if [ $FORGE_RESULT -ne 0 ]; then
    echo "提示: Forge 编译失败是正常的，因为需要 ForgeGradle 环境"
fi
echo ""
echo "如需完整编译 Fabric/Forge，请参考对应的 README_BUILD.md 文件"
echo ""
