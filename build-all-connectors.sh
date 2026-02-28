#!/bin/bash

# Mochi-Link Connector Build Script
# 大福连连接器构建脚本
# 
# This script builds all connector plugins and mods for different Minecraft server types
# 此脚本为不同类型的Minecraft服务器构建所有连接器插件和模组

set -e

echo "=========================================="
echo "Mochi-Link Connector Build Script"
echo "大福连连接器构建脚本"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build output directory
BUILD_DIR="./build-output"
mkdir -p "$BUILD_DIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build Java-based plugins
build_java_plugin() {
    local plugin_dir=$1
    local plugin_name=$2
    
    print_status "Building $plugin_name..."
    
    if [ ! -d "$plugin_dir" ]; then
        print_warning "$plugin_dir not found, skipping..."
        return
    fi
    
    cd "$plugin_dir"
    
    if [ -f "pom.xml" ]; then
        # Maven build
        if command -v mvn &> /dev/null; then
            mvn clean package -q
            if [ $? -eq 0 ]; then
                # Copy built JAR to output directory
                find target -name "*.jar" -not -name "*-sources.jar" -exec cp {} "../$BUILD_DIR/${plugin_name}.jar" \;
                print_success "$plugin_name built successfully"
            else
                print_error "Failed to build $plugin_name"
            fi
        else
            print_error "Maven not found, cannot build $plugin_name"
        fi
    elif [ -f "build.gradle" ]; then
        # Gradle build
        if command -v ./gradlew &> /dev/null; then
            ./gradlew build -q
        elif command -v gradle &> /dev/null; then
            gradle build -q
        else
            print_error "Gradle not found, cannot build $plugin_name"
            cd ..
            return
        fi
        
        if [ $? -eq 0 ]; then
            # Copy built JAR to output directory
            find build/libs -name "*.jar" -not -name "*-sources.jar" -exec cp {} "../$BUILD_DIR/${plugin_name}.jar" \;
            print_success "$plugin_name built successfully"
        else
            print_error "Failed to build $plugin_name"
        fi
    else
        print_warning "No build file found for $plugin_name"
    fi
    
    cd ..
}

# Function to build Node.js/TypeScript plugins
build_nodejs_plugin() {
    local plugin_dir=$1
    local plugin_name=$2
    
    print_status "Building $plugin_name..."
    
    if [ ! -d "$plugin_dir" ]; then
        print_warning "$plugin_dir not found, skipping..."
        return
    fi
    
    cd "$plugin_dir"
    
    if [ -f "package.json" ]; then
        # Node.js build
        if command -v npm &> /dev/null; then
            npm install --silent
            npm run build --silent
            if [ $? -eq 0 ]; then
                # Create plugin package
                mkdir -p "../$BUILD_DIR/$plugin_name"
                cp -r dist/* "../$BUILD_DIR/$plugin_name/"
                cp package.json "../$BUILD_DIR/$plugin_name/"
                cp -r node_modules "../$BUILD_DIR/$plugin_name/" 2>/dev/null || true
                print_success "$plugin_name built successfully"
            else
                print_error "Failed to build $plugin_name"
            fi
        else
            print_error "npm not found, cannot build $plugin_name"
        fi
    else
        print_warning "No package.json found for $plugin_name"
    fi
    
    cd ..
}

# Function to build PHP plugins
build_php_plugin() {
    local plugin_dir=$1
    local plugin_name=$2
    
    print_status "Building $plugin_name..."
    
    if [ ! -d "$plugin_dir" ]; then
        print_warning "$plugin_dir not found, skipping..."
        return
    fi
    
    # For PHP plugins, we just copy the source files
    mkdir -p "$BUILD_DIR/$plugin_name"
    cp -r "$plugin_dir"/* "$BUILD_DIR/$plugin_name/"
    print_success "$plugin_name copied successfully"
}

# Main build process
main() {
    print_status "Starting build process..."
    print_status "开始构建过程..."
    
    # Clean previous builds
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    
    # Build Java Edition plugins
    print_status "Building Java Edition plugins..."
    print_status "构建Java版插件..."
    
    build_java_plugin "connectors/java" "MochiLinkConnector-Paper"
    build_java_plugin "connectors/folia" "MochiLinkConnector-Folia"
    
    # Build Fabric mod
    print_status "Building Fabric mod..."
    print_status "构建Fabric模组..."
    
    build_java_plugin "mochi-link-connector-fabric" "MochiLinkConnector-Fabric"
    
    # Build Forge mod
    print_status "Building Forge mod..."
    print_status "构建Forge模组..."
    
    build_java_plugin "mochi-link-connector-forge" "MochiLinkConnector-Forge"
    
    # Build Bedrock Edition plugins
    print_status "Building Bedrock Edition plugins..."
    print_status "构建基岩版插件..."
    
    build_nodejs_plugin "mochi-link-connector-llbds" "MochiLinkConnector-LLBDS"
    build_java_plugin "mochi-link-connector-nukkit" "MochiLinkConnector-Nukkit"
    build_php_plugin "mochi-link-connector-pmmp" "MochiLinkConnector-PMMP"
    
    # Create version info
    print_status "Creating version information..."
    cat > "$BUILD_DIR/VERSION.txt" << EOF
Mochi-Link Connector Build Information
大福连连接器构建信息

Build Date: $(date)
构建日期: $(date)

Built Connectors:
构建的连接器:

Java Edition (Java版):
- Paper/Spigot: MochiLinkConnector-Paper.jar
- Folia: MochiLinkConnector-Folia.jar

Modded Java Edition (模组Java版):
- Fabric: MochiLinkConnector-Fabric.jar
- Forge: MochiLinkConnector-Forge.jar

Bedrock Edition (基岩版):
- LLBDS: MochiLinkConnector-LLBDS/
- Nukkit: MochiLinkConnector-Nukkit.jar
- PMMP: MochiLinkConnector-PMMP/

Installation Instructions:
安装说明:

1. Java Edition plugins (.jar files):
   Java版插件 (.jar文件):
   - Copy to your server's plugins/ directory
   - 复制到服务器的 plugins/ 目录

2. Fabric/Forge mods (.jar files):
   Fabric/Forge模组 (.jar文件):
   - Copy to your server's mods/ directory
   - 复制到服务器的 mods/ 目录

3. LLBDS plugin (directory):
   LLBDS插件 (目录):
   - Copy to your LLBDS plugins/ directory
   - 复制到LLBDS的 plugins/ 目录

4. PMMP plugin (directory):
   PMMP插件 (目录):
   - Copy to your PMMP plugins/ directory
   - 复制到PMMP的 plugins/ 目录

Configuration:
配置:

All connectors use similar configuration files. Please refer to the
main project documentation for detailed configuration instructions.

所有连接器都使用类似的配置文件。详细配置说明请参考主项目文档。

EOF
    
    # Create README
    cat > "$BUILD_DIR/README.md" << EOF
# Mochi-Link Connectors
# 大福连连接器

This directory contains all built connector plugins and mods for different Minecraft server types.

此目录包含为不同类型Minecraft服务器构建的所有连接器插件和模组。

## Supported Platforms / 支持的平台

### Java Edition / Java版
- **Paper/Spigot**: Universal plugin for Paper, Spigot, and compatible servers
- **Folia**: Optimized plugin for Folia's multi-threaded architecture

### Modded Java Edition / 模组Java版
- **Fabric**: Fabric mod for Fabric servers
- **Forge**: Forge mod for Forge servers

### Bedrock Edition / 基岩版
- **LLBDS**: Plugin for LiteLoaderBDS servers
- **Nukkit**: Plugin for Nukkit servers
- **PMMP**: Plugin for PocketMine-MP servers

## Installation / 安装

1. Choose the appropriate connector for your server type
2. Follow the installation instructions in VERSION.txt
3. Configure the connector using the provided configuration files
4. Restart your server

1. 为您的服务器类型选择合适的连接器
2. 按照VERSION.txt中的安装说明操作
3. 使用提供的配置文件配置连接器
4. 重启服务器

## Support / 支持

For support and documentation, please visit:
如需支持和文档，请访问:

- GitHub: https://github.com/chm413/Mochi-Link
- Issues: https://github.com/chm413/Mochi-Link/issues

EOF
    
    print_success "Build process completed!"
    print_success "构建过程完成！"
    
    print_status "Build output directory: $BUILD_DIR"
    print_status "构建输出目录: $BUILD_DIR"
    
    # List built files
    print_status "Built files:"
    print_status "构建的文件:"
    ls -la "$BUILD_DIR"
}

# Check dependencies
check_dependencies() {
    print_status "Checking build dependencies..."
    print_status "检查构建依赖..."
    
    local missing_deps=()
    
    # Check for Java
    if ! command -v java &> /dev/null; then
        missing_deps+=("java")
    fi
    
    # Check for Maven
    if ! command -v mvn &> /dev/null; then
        print_warning "Maven not found - Java plugins may not build"
        print_warning "未找到Maven - Java插件可能无法构建"
    fi
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_warning "Node.js not found - LLBDS plugin may not build"
        print_warning "未找到Node.js - LLBDS插件可能无法构建"
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        print_warning "npm not found - LLBDS plugin may not build"
        print_warning "未找到npm - LLBDS插件可能无法构建"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_error "缺少必需的依赖: ${missing_deps[*]}"
        exit 1
    fi
    
    print_success "All required dependencies found"
    print_success "找到所有必需的依赖"
}

# Script entry point
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [options]"
    echo "用法: $0 [选项]"
    echo ""
    echo "Options:"
    echo "选项:"
    echo "  --help, -h    Show this help message"
    echo "  --help, -h    显示此帮助信息"
    echo "  --check-deps  Check build dependencies only"
    echo "  --check-deps  仅检查构建依赖"
    echo ""
    echo "This script builds all Mochi-Link connector plugins and mods."
    echo "此脚本构建所有大福连连接器插件和模组。"
    exit 0
elif [ "$1" = "--check-deps" ]; then
    check_dependencies
    exit 0
else
    check_dependencies
    main
fi