# Fabric 和 Forge 编译环境配置说明

## 概述

本项目已经配置了完整的 Fabric 和 Forge 编译环境，支持：
- ✅ 访问 Minecraft 类和 API
- ✅ 使用 Fabric API 和 Forge 事件系统
- ✅ 完整的开发和调试功能
- ✅ 生成生产环境可用的 JAR 文件

## 主要变更

### 1. Fabric 配置更新

**文件**: `connectors/fabric/build.gradle`

**主要变更**:
- ✅ 添加 Fabric Loom 插件 (v1.5-SNAPSHOT)
- ✅ 配置 Minecraft 和 Yarn mappings
- ✅ 添加 Fabric Loader 和 API 依赖
- ✅ 使用 `include` 嵌入 WebSocket 和 Gson 库
- ✅ 配置 processResources 任务

**版本配置**: `connectors/fabric/gradle.properties`
```properties
minecraft_version=1.20.4
yarn_mappings=1.20.4+build.3
loader_version=0.15.3
fabric_version=0.91.0+1.20.4
```

### 2. Forge 配置更新

**文件**: `connectors/forge/build.gradle`

**主要变更**:
- ✅ 添加 ForgeGradle 插件 (v6.0+)
- ✅ 配置 Minecraft 和 Forge 依赖
- ✅ 配置 runs 任务（测试服务器）
- ✅ 添加 reobfJar 任务
- ✅ 配置发布设置

**新增文件**: `connectors/forge/gradle.properties`
```properties
minecraft_version=1.20.1
forge_version=47.2.0
org.gradle.jvmargs=-Xmx3G
```

### 3. 构建脚本更新

**文件**: `build-fabric-forge.bat` 和 `build-fabric-forge.sh`

**主要变更**:
- ✅ 使用 Gradle Wrapper (`gradlew`) 而不是系统 Gradle
- ✅ 更新提示信息，说明首次编译时间和要求
- ✅ 改进错误处理和日志输出
- ✅ 添加文档链接

### 4. 新增文档

1. **BUILD_ENVIRONMENT_SETUP.md** - 完整的环境配置指南
   - 环境要求
   - 安装步骤
   - 编译说明
   - 故障排除
   - 性能优化

2. **QUICK_BUILD_GUIDE.md** - 快速参考指南
   - 一键编译命令
   - 常用命令
   - 快速故障排除

3. **FABRIC_FORGE_SETUP_CN.md** - 本文档
   - 变更说明
   - 使用指南

## 快速开始

### 前置要求

1. **安装 Java 17**
   ```bash
   java -version
   # 应显示 Java 17.x.x
   ```

2. **配置内存**（可选但推荐）
   
   创建或编辑 `~/.gradle/gradle.properties`:
   ```properties
   org.gradle.jvmargs=-Xmx4G
   org.gradle.parallel=true
   org.gradle.caching=true
   ```

### 编译步骤

#### 方法 1: 使用批处理脚本（推荐）

**Windows**:
```bash
build-fabric-forge.bat
```

**Linux/macOS**:
```bash
chmod +x build-fabric-forge.sh
./build-fabric-forge.sh
```

#### 方法 2: 单独编译

**Fabric**:
```bash
cd connectors/fabric
gradlew.bat clean build  # Windows
./gradlew clean build    # Linux/macOS
```

**Forge**:
```bash
cd connectors/forge
gradlew.bat clean build  # Windows
./gradlew clean build    # Linux/macOS
```

### 输出文件

编译成功后，JAR 文件位于：
- Fabric: `connectors/fabric/build/libs/mochi-link-connector-fabric-1.0.0.jar`
- Forge: `connectors/forge/build/libs/mochi-link-connector-forge-1.0.0.jar`

如果使用批处理脚本，文件会被复制到 `output/` 目录。

## 首次编译注意事项

### 时间要求
- **Fabric**: 10-20 分钟
- **Forge**: 15-30 分钟

后续编译只需 1-5 分钟。

### 下载内容
首次编译会自动下载：
- Minecraft 客户端和服务器（约 50MB）
- Fabric Loom / ForgeGradle 插件
- Yarn / MCP mappings（约 20-40MB）
- 依赖库（约 30-50MB）

### 磁盘空间
- **Fabric**: 约 2GB
- **Forge**: 约 3GB

### 内存要求
- 最低: 2GB RAM
- 推荐: 4GB RAM
- 最佳: 8GB RAM

如果内存不足，会出现 `OutOfMemoryError`。

### 网络要求
需要稳定的互联网连接。如果在国内，建议配置镜像：

编辑 `build.gradle`，在 `repositories` 块最前面添加：
```groovy
repositories {
    maven { url 'https://maven.aliyun.com/repository/public' }
    // ... 其他仓库
}
```

## 开发环境配置

### IntelliJ IDEA

1. **导入项目**
   - File → Open → 选择项目根目录
   - 选择 "Import Gradle project"

2. **生成源代码**（Fabric）
   ```bash
   cd connectors/fabric
   gradlew genSources
   ```

3. **生成运行配置**（Forge）
   ```bash
   cd connectors/forge
   gradlew genIntellijRuns
   ```

4. **刷新 Gradle 项目**
   - 右键项目 → Gradle → Refresh Gradle Project

### Eclipse

1. **生成 Eclipse 配置**（Fabric）
   ```bash
   cd connectors/fabric
   gradlew eclipse
   ```

2. **生成 Eclipse 配置**（Forge）
   ```bash
   cd connectors/forge
   gradlew genEclipseRuns
   ```

3. **导入项目**
   - File → Import → Existing Projects into Workspace

### Visual Studio Code

1. **安装扩展**
   - Extension Pack for Java
   - Gradle for Java

2. **打开项目**
   - File → Open Folder → 选择项目根目录

3. **等待 Gradle 同步完成**

## 运行测试服务器

### Fabric
```bash
cd connectors/fabric
gradlew runServer
```

服务器会在 `run/` 目录启动。

### Forge
```bash
cd connectors/forge
gradlew runServer
```

服务器会在 `run/` 目录启动。

## 常见问题

### 1. 内存不足

**错误信息**:
```
java.lang.OutOfMemoryError: Java heap space
```

**解决方案**:
在项目根目录或 `~/.gradle/` 下的 `gradle.properties` 中添加：
```properties
org.gradle.jvmargs=-Xmx4G
```

### 2. 下载依赖失败

**错误信息**:
```
Could not resolve all dependencies
Connection timeout
```

**解决方案**:
1. 检查网络连接
2. 配置国内镜像（见上文）
3. 重试: `gradlew build --refresh-dependencies`

### 3. Gradle 版本不兼容

**错误信息**:
```
Unsupported Gradle version
```

**解决方案**:
使用项目自带的 Gradle Wrapper:
```bash
# Windows
gradlew.bat build

# Linux/macOS
./gradlew build
```

不要使用系统的 `gradle` 命令。

### 4. 找不到 Minecraft 类

**错误信息**:
```
cannot find symbol: class MinecraftServer
```

**解决方案**:
1. 确保使用了更新后的 `build.gradle`
2. 运行 `gradlew genSources`（Fabric）或 `gradlew genIntellijRuns`（Forge）
3. 刷新 IDE 项目

### 5. 编译卡住不动

**可能原因**:
- 正在下载大文件
- 正在处理 mappings

**解决方案**:
1. 耐心等待（首次编译可能需要 30 分钟）
2. 查看详细日志: `gradlew build --info`
3. 如果确实卡住，按 Ctrl+C 中断，然后重试

## 版本更新

### 更新 Minecraft 版本

#### Fabric
1. 访问 https://fabricmc.net/develop
2. 选择目标 Minecraft 版本
3. 更新 `connectors/fabric/gradle.properties`:
   ```properties
   minecraft_version=1.20.4
   yarn_mappings=1.20.4+build.3
   loader_version=0.15.3
   fabric_version=0.91.0+1.20.4
   ```

#### Forge
1. 访问 https://files.minecraftforge.net/
2. 选择目标 Minecraft 版本和 Forge 版本
3. 更新 `connectors/forge/gradle.properties`:
   ```properties
   minecraft_version=1.20.1
   forge_version=47.2.0
   ```

### 更新插件版本

#### Fabric Loom
编辑 `connectors/fabric/build.gradle`:
```groovy
plugins {
    id 'fabric-loom' version '1.5-SNAPSHOT'
}
```

#### ForgeGradle
编辑 `connectors/forge/build.gradle`:
```groovy
plugins {
    id 'net.minecraftforge.gradle' version '[6.0,6.2)'
}
```

## 性能优化

### 1. Gradle 配置优化

在 `~/.gradle/gradle.properties` 中添加：
```properties
# 增加内存
org.gradle.jvmargs=-Xmx4G -XX:MaxMetaspaceSize=1G

# 启用并行编译
org.gradle.parallel=true

# 启用配置缓存
org.gradle.configuration-cache=true

# 启用构建缓存
org.gradle.caching=true

# 启用守护进程
org.gradle.daemon=true
```

### 2. 使用 SSD
将项目和 Gradle 缓存（`~/.gradle/`）放在 SSD 上。

### 3. 定期清理
```bash
# 清理项目构建文件
gradlew clean

# 清理 Gradle 缓存（如果遇到问题）
rm -rf ~/.gradle/caches
```

## CI/CD 集成

### GitHub Actions 示例

创建 `.github/workflows/build.yml`:
```yaml
name: Build Connectors

on: [push, pull_request]

jobs:
  build-fabric-forge:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
        cache: 'gradle'
    
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
    
    - name: Upload Fabric artifact
      uses: actions/upload-artifact@v3
      with:
        name: fabric-connector
        path: connectors/fabric/build/libs/*.jar
    
    - name: Upload Forge artifact
      uses: actions/upload-artifact@v3
      with:
        name: forge-connector
        path: connectors/forge/build/libs/*.jar
```

## 技术支持

### 文档
- [完整配置指南](BUILD_ENVIRONMENT_SETUP.md)
- [快速参考](QUICK_BUILD_GUIDE.md)
- [Fabric 官方文档](https://fabricmc.net/wiki/)
- [Forge 官方文档](https://docs.minecraftforge.net/)

### 问题反馈
- GitHub Issues: https://github.com/chm413/Mochi-Link/issues

### 查看日志
```bash
# 详细日志
gradlew build --info

# 调试日志
gradlew build --debug

# 查看构建报告
# Fabric: connectors/fabric/build/reports/
# Forge: connectors/forge/build/reports/
```

## 总结

现在你的项目已经配置了完整的 Fabric 和 Forge 编译环境：

✅ **Fabric**
- 使用 Fabric Loom 1.5
- 支持 Minecraft 1.20.4
- 可以访问 Minecraft 类和 Fabric API

✅ **Forge**
- 使用 ForgeGradle 6.0+
- 支持 Minecraft 1.20.1
- 可以访问 Minecraft 类和 Forge 事件系统

✅ **开发功能**
- 完整的 IDE 支持
- 可运行的测试服务器
- 源代码生成和调试

✅ **生产部署**
- 生成可用的 JAR 文件
- 自动嵌入依赖库
- 正确的 manifest 配置

首次编译需要较长时间，但后续编译会快很多。建议在良好的网络环境下进行首次编译。
