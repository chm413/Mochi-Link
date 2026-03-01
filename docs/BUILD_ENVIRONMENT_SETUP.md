# Fabric 和 Forge 编译环境配置指南

本文档详细说明如何配置 Fabric 和 Forge 的完整编译环境。

## 环境要求

### 基础要求
- **Java**: JDK 17 或更高版本
- **Gradle**: 7.0 或更高版本（推荐使用 Gradle Wrapper）
- **内存**: 至少 4GB RAM（推荐 8GB）
- **磁盘空间**: 至少 3GB 可用空间
- **网络**: 稳定的互联网连接（首次编译需要下载大量依赖）

### 操作系统
- Windows 10/11
- macOS 10.14+
- Linux (Ubuntu 18.04+, Debian 10+, 等)

## 快速开始

### 1. 安装 Java 17

#### Windows
```bash
# 使用 Chocolatey
choco install openjdk17

# 或下载安装包
# https://adoptium.net/
```

#### macOS
```bash
# 使用 Homebrew
brew install openjdk@17
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-17-jdk

# Fedora/RHEL
sudo dnf install java-17-openjdk-devel
```

验证安装：
```bash
java -version
# 应显示 Java 17.x.x
```

### 2. 配置 Gradle

项目已包含 Gradle Wrapper，无需单独安装 Gradle。

#### 配置 Gradle 内存（可选但推荐）

在用户目录下创建或编辑 `~/.gradle/gradle.properties`：

```properties
# 增加 Gradle 可用内存
org.gradle.jvmargs=-Xmx4G -XX:MaxMetaspaceSize=1G

# 启用并行编译
org.gradle.parallel=true

# 启用配置缓存（加速后续编译）
org.gradle.configuration-cache=true

# 启用构建缓存
org.gradle.caching=true
```

## Fabric 编译环境

### 配置说明

Fabric 使用 **Fabric Loom** 插件进行编译，该插件会：
- 自动下载 Minecraft 客户端和服务器
- 处理 Yarn mappings（反混淆）
- 管理 Fabric API 依赖
- 生成可运行的开发环境

### 编译步骤

1. **首次编译**（需要 10-20 分钟）

```bash
cd connectors/fabric

# Windows
gradlew.bat clean build

# Linux/macOS
./gradlew clean build
```

首次编译会下载：
- Minecraft 1.20.4 客户端和服务器（约 50MB）
- Yarn mappings（约 20MB）
- Fabric Loader 和 API（约 10MB）
- 其他依赖库（约 30MB）

2. **后续编译**（1-3 分钟）

```bash
# 快速编译（跳过测试）
gradlew.bat build -x test

# 仅编译 JAR
gradlew.bat jar
```

3. **清理构建**

```bash
# 清理所有构建文件
gradlew.bat clean

# 清理 Gradle 缓存（如果遇到问题）
gradlew.bat clean --refresh-dependencies
```

### 输出文件

编译成功后，JAR 文件位于：
```
connectors/fabric/build/libs/mochi-link-connector-fabric-1.0.0.jar
```

### 开发环境

生成 IDE 配置：

```bash
# IntelliJ IDEA
gradlew.bat genSources

# Eclipse
gradlew.bat eclipse
```

运行测试服务器：

```bash
gradlew.bat runServer
```

## Forge 编译环境

### 配置说明

Forge 使用 **ForgeGradle** 插件进行编译，该插件会：
- 自动下载 Minecraft 和 Forge
- 处理 MCP mappings（反混淆）
- 配置 Forge 开发环境
- 生成可运行的测试服务器

### 编译步骤

1. **首次编译**（需要 15-30 分钟）

```bash
cd connectors/forge

# Windows
gradlew.bat clean build

# Linux/macOS
./gradlew clean build
```

首次编译会下载：
- Minecraft 1.20.1 客户端和服务器（约 50MB）
- Forge 47.2.0（约 30MB）
- MCP mappings（约 40MB）
- 其他依赖库（约 50MB）

2. **后续编译**（2-5 分钟）

```bash
# 快速编译
gradlew.bat build -x test

# 仅编译 JAR
gradlew.bat jar
```

3. **清理构建**

```bash
# 清理构建文件
gradlew.bat clean

# 重新下载依赖（如果遇到问题）
gradlew.bat clean --refresh-dependencies
```

### 输出文件

编译成功后，JAR 文件位于：
```
connectors/forge/build/libs/mochi-link-connector-forge-1.0.0.jar
```

### 开发环境

生成 IDE 配置：

```bash
# IntelliJ IDEA
gradlew.bat genIntellijRuns

# Eclipse
gradlew.bat genEclipseRuns
```

运行测试服务器：

```bash
gradlew.bat runServer
```

## 批量编译

### 使用提供的脚本

项目提供了批量编译脚本：

#### Windows
```bash
# 仅编译 Fabric 和 Forge
build-fabric-forge.bat

# 编译所有连接器
build-all-connectors.bat
```

#### Linux/macOS
```bash
# 仅编译 Fabric 和 Forge
chmod +x build-fabric-forge.sh
./build-fabric-forge.sh

# 编译所有连接器
chmod +x build-all-connectors.sh
./build-all-connectors.sh
```

## 常见问题

### 1. 内存不足错误

**症状**：
```
java.lang.OutOfMemoryError: Java heap space
```

**解决方案**：
在 `gradle.properties` 中增加内存：
```properties
org.gradle.jvmargs=-Xmx4G
```

### 2. 下载依赖失败

**症状**：
```
Could not resolve all dependencies
Connection timeout
```

**解决方案**：
- 检查网络连接
- 使用国内镜像（如阿里云）
- 重试编译：`gradlew build --refresh-dependencies`

配置镜像（在 `build.gradle` 中）：
```groovy
repositories {
    maven { url 'https://maven.aliyun.com/repository/public' }
    mavenCentral()
}
```

### 3. Gradle 版本不兼容

**症状**：
```
Unsupported Gradle version
```

**解决方案**：
使用项目提供的 Gradle Wrapper：
```bash
# 不要使用系统的 gradle 命令
# 使用 gradlew (Linux/macOS) 或 gradlew.bat (Windows)
./gradlew build
```

### 4. 找不到 Minecraft 类

**症状**：
```
cannot find symbol: class MinecraftServer
```

**解决方案**：
- 确保使用了正确的 build.gradle 配置（包含 Loom 或 ForgeGradle）
- 运行 `gradlew genSources` 生成源代码
- 刷新 IDE 项目

### 5. 编译速度慢

**优化建议**：

1. 启用 Gradle 守护进程：
```properties
org.gradle.daemon=true
```

2. 启用并行编译：
```properties
org.gradle.parallel=true
```

3. 使用本地缓存：
```properties
org.gradle.caching=true
```

4. 增加内存分配：
```properties
org.gradle.jvmargs=-Xmx4G
```

### 6. 代理配置

如果需要通过代理访问网络：

在 `~/.gradle/gradle.properties` 中添加：
```properties
systemProp.http.proxyHost=proxy.example.com
systemProp.http.proxyPort=8080
systemProp.https.proxyHost=proxy.example.com
systemProp.https.proxyPort=8080
```

## 版本更新

### 更新 Fabric 版本

编辑 `connectors/fabric/gradle.properties`：
```properties
minecraft_version=1.20.4
yarn_mappings=1.20.4+build.3
loader_version=0.15.3
fabric_version=0.91.0+1.20.4
```

查看最新版本：https://fabricmc.net/develop

### 更新 Forge 版本

编辑 `connectors/forge/gradle.properties`：
```properties
minecraft_version=1.20.1
forge_version=47.2.0
```

查看最新版本：https://files.minecraftforge.net/

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: Build Fabric and Forge

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
    
    - name: Build Fabric
      run: |
        cd connectors/fabric
        chmod +x gradlew
        ./gradlew build
    
    - name: Build Forge
      run: |
        cd connectors/forge
        chmod +x gradlew
        ./gradlew build
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: connectors
        path: |
          connectors/fabric/build/libs/*.jar
          connectors/forge/build/libs/*.jar
```

## 性能优化建议

### 1. 使用 SSD
将项目和 Gradle 缓存放在 SSD 上可以显著提升编译速度。

### 2. 增加系统内存
推荐至少 8GB RAM，16GB 更佳。

### 3. 使用多核 CPU
Gradle 支持并行编译，多核 CPU 可以加速编译过程。

### 4. 定期清理缓存
```bash
# 清理 Gradle 缓存
rm -rf ~/.gradle/caches

# 清理项目构建文件
gradlew clean
```

## 技术支持

如果遇到问题：

1. 查看详细的编译日志：
```bash
gradlew build --info
gradlew build --debug
```

2. 查看项目 Issues：
https://github.com/chm413/Mochi-Link/issues

3. 参考官方文档：
- Fabric: https://fabricmc.net/wiki/
- Forge: https://docs.minecraftforge.net/

## 总结

完整的编译环境配置后：
- **Fabric** 可以访问 Minecraft 类和 Fabric API
- **Forge** 可以访问 Minecraft 类和 Forge 事件系统
- 支持完整的开发和调试功能
- 可以生成生产环境可用的 JAR 文件

首次编译需要较长时间，但后续编译会快很多。建议在良好的网络环境下进行首次编译。
