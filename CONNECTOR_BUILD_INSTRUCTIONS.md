# Mochi-Link 连接器构建说明
# Mochi-Link Connector Build Instructions

## 构建状态 / Build Status

**日期 / Date**: 2026-02-20

### 系统环境 / System Environment

- ✅ Java: 已安装 / Installed
- ❌ Maven: 未安装 / Not Installed
- ✅ Gradle: 已安装 (v9.1.0) / Installed (v9.1.0)
- ✅ Node.js: 需要检查 / Need to check

### 连接器项目 / Connector Projects

#### Java Edition (需要 Maven / Requires Maven)

1. **mochi-link-connector-java** (Paper/Spigot)
   - 构建系统: Maven
   - 状态: ⏸️ 等待 Maven 安装
   - 构建命令: `mvn clean package -DskipTests`

2. **mochi-link-connector-folia** (Folia)
   - 构建系统: Maven
   - 状态: ⏸️ 等待 Maven 安装
   - 构建命令: `mvn clean package -DskipTests`

3. **mochi-link-connector-nukkit** (Nukkit)
   - 构建系统: Maven
   - 状态: ⏸️ 等待 Maven 安装
   - 构建命令: `mvn clean package -DskipTests`

#### Modded Java Edition (需要特殊 Gradle 插件 / Requires Special Gradle Plugins)

4. **mochi-link-connector-fabric** (Fabric)
   - 构建系统: Gradle + Fabric Loom
   - 状态: ⏸️ 需要配置 Fabric Loom 仓库
   - 错误: Plugin 'fabric-loom' version '1.4-SNAPSHOT' not found
   - 构建命令: `gradle clean build -x test`

5. **mochi-link-connector-forge** (Forge)
   - 构建系统: Gradle + ForgeGradle
   - 状态: ⏸️ 需要配置 ForgeGradle
   - 构建命令: `gradle clean build -x test`

#### Bedrock Edition

6. **mochi-link-connector-llbds** (LLBDS)
   - 构建系统: Node.js/TypeScript
   - 状态: ✅ 可以构建
   - 构建命令: `npm install && npm run build`

7. **mochi-link-connector-pmmp** (PocketMine-MP)
   - 构建系统: PHP (无需编译)
   - 状态: ✅ 直接复制源码
   - 部署: 复制到 PMMP plugins 目录

## 安装 Maven / Install Maven

### Windows 安装方法 / Windows Installation Methods

#### 方法 1: 使用 Chocolatey (推荐)
```powershell
# 安装 Chocolatey (如果未安装)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安装 Maven
choco install maven -y
```

#### 方法 2: 手动下载
1. 访问: https://maven.apache.org/download.cgi
2. 下载 Binary zip archive
3. 解压到 `C:\Program Files\Apache\maven`
4. 添加到 PATH:
   - 系统变量 `MAVEN_HOME` = `C:\Program Files\Apache\maven`
   - 添加 `%MAVEN_HOME%\bin` 到 PATH

#### 方法 3: 使用 Scoop
```powershell
# 安装 Scoop (如果未安装)
iwr -useb get.scoop.sh | iex

# 安装 Maven
scoop install maven
```

## 构建所有连接器 / Build All Connectors

### 安装 Maven 后 / After Installing Maven

```batch
# Windows
.\build-all-connectors.bat

# 或者手动构建每个项目
# Or build each project manually

# Maven 项目
cd mochi-link-connector-java
mvn clean package -DskipTests
cd ..

cd mochi-link-connector-folia
mvn clean package -DskipTests
cd ..

cd mochi-link-connector-nukkit
mvn clean package -DskipTests
cd ..

# Gradle 项目 (需要先修复仓库配置)
cd mochi-link-connector-fabric
gradle clean build -x test
cd ..

cd mochi-link-connector-forge
gradle clean build -x test
cd ..

# Node.js 项目
cd mochi-link-connector-llbds
npm install
npm run build
cd ..
```

## 修复 Fabric/Forge 构建 / Fix Fabric/Forge Build

### Fabric Loom 仓库配置

在 `mochi-link-connector-fabric/build.gradle` 的 `plugins` 块之前添加:

```groovy
pluginManagement {
    repositories {
        maven {
            name = 'Fabric'
            url = 'https://maven.fabricmc.net/'
        }
        gradlePluginPortal()
    }
}
```

或者在 `settings.gradle` 中配置。

### ForgeGradle 配置

ForgeGradle 应该可以自动从 Maven Central 下载，但可能需要网络代理。

## 构建产物位置 / Build Artifacts Location

构建成功后，产物将位于:

- **Maven 项目**: `<project>/target/<project>-<version>.jar`
- **Gradle 项目**: `<project>/build/libs/<project>-<version>.jar`
- **Node.js 项目**: `<project>/dist/`
- **PHP 项目**: `<project>/src/` (源码)

所有产物将被复制到: `build-output/`

## 快速构建 LLBDS 连接器 / Quick Build LLBDS Connector

如果只需要 LLBDS 连接器 (Node.js 项目):

```powershell
cd mochi-link-connector-llbds
npm install
npm run build

# 复制到输出目录
New-Item -ItemType Directory -Force -Path ..\build-output\MochiLinkConnector-LLBDS
Copy-Item -Recurse -Force dist\* ..\build-output\MochiLinkConnector-LLBDS\
Copy-Item package.json ..\build-output\MochiLinkConnector-LLBDS\
```

## 故障排除 / Troubleshooting

### Maven 命令未找到
- 确认 Maven 已安装: `mvn -version`
- 检查 PATH 环境变量
- 重启终端/PowerShell

### Gradle 插件下载失败
- 检查网络连接
- 配置代理 (如果需要):
  ```
  gradle.properties:
  systemProp.http.proxyHost=127.0.0.1
  systemProp.http.proxyPort=2080
  systemProp.https.proxyHost=127.0.0.1
  systemProp.https.proxyPort=2080
  ```

### Java 版本问题
- 所有项目需要 Java 17+
- 检查: `java -version`
- 设置 JAVA_HOME 环境变量

## 下一步 / Next Steps

1. ✅ 安装 Maven
2. ⏸️ 运行 `build-all-connectors.bat`
3. ⏸️ 检查 `build-output/` 目录中的产物
4. ⏸️ 按照 `CONNECTOR_DEPLOYMENT_GUIDE.md` 部署连接器
