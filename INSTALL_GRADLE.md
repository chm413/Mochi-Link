# Gradle 安装指南

## 为什么需要 Gradle？

Gradle 是构建 Fabric 和 Forge 连接器所必需的工具。

## 快速安装

### 方法 1: 使用 Chocolatey（推荐）

如果已安装 Chocolatey：
```powershell
choco install gradle
```

### 方法 2: 使用 Scoop

如果已安装 Scoop：
```powershell
scoop install gradle
```

### 方法 3: 手动安装

1. **下载 Gradle**
   - 访问：https://gradle.org/releases/
   - 下载最新的 Binary-only 版本（例如：gradle-8.5-bin.zip）

2. **解压文件**
   - 解压到一个目录，例如：`C:\Gradle\gradle-8.5`

3. **配置环境变量**
   
   a. 打开系统环境变量设置：
   - 右键"此电脑" → "属性"
   - 点击"高级系统设置"
   - 点击"环境变量"
   
   b. 添加 GRADLE_HOME：
   - 在"系统变量"中点击"新建"
   - 变量名：`GRADLE_HOME`
   - 变量值：`C:\Gradle\gradle-8.5`（你的 Gradle 安装路径）
   
   c. 更新 PATH：
   - 在"系统变量"中找到 `Path`
   - 点击"编辑"
   - 点击"新建"
   - 添加：`%GRADLE_HOME%\bin`
   - 点击"确定"保存所有更改

4. **验证安装**
   
   打开新的 PowerShell 或 CMD 窗口：
   ```bash
   gradle --version
   ```
   
   应该看到类似输出：
   ```
   ------------------------------------------------------------
   Gradle 8.5
   ------------------------------------------------------------
   
   Build time:   2023-11-29 14:08:57 UTC
   Revision:     28aca86a7180baa17117e0e5ba01d8ea9feca598
   
   Kotlin:       1.9.20
   Groovy:       3.0.17
   Ant:          Apache Ant(TM) version 1.10.13 compiled on January 4 2023
   JVM:          17.0.9 (Eclipse Adoptium 17.0.9+9)
   OS:           Windows 11 10.0 amd64
   ```

## 验证安装

运行测试脚本：
```bash
.\test-build-environment.bat
```

或手动检查：
```bash
gradle --version
java -version
```

## 常见问题

### Q1: 命令找不到

**错误**：
```
'gradle' is not recognized as an internal or external command
```

**解决方案**：
1. 确保已添加到 PATH 环境变量
2. 重新打开终端窗口
3. 检查 GRADLE_HOME 是否正确设置

### Q2: Java 版本不兼容

**错误**：
```
Gradle requires Java 8 or later
```

**解决方案**：
安装 Java 17 或更高版本：https://adoptium.net/

### Q3: 下载速度慢

**解决方案**：
配置国内镜像。创建或编辑 `~/.gradle/init.gradle`：

```groovy
allprojects {
    repositories {
        maven { url 'https://maven.aliyun.com/repository/public/' }
        maven { url 'https://maven.aliyun.com/repository/google/' }
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin/' }
        mavenCentral()
    }
    
    buildscript {
        repositories {
            maven { url 'https://maven.aliyun.com/repository/public/' }
            maven { url 'https://maven.aliyun.com/repository/google/' }
            maven { url 'https://maven.aliyun.com/repository/gradle-plugin/' }
            mavenCentral()
        }
    }
}
```

## 使用包管理器安装 Chocolatey 或 Scoop

### 安装 Chocolatey

在管理员 PowerShell 中运行：
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

然后安装 Gradle：
```powershell
choco install gradle
```

### 安装 Scoop

在 PowerShell 中运行：
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

然后安装 Gradle：
```powershell
scoop install gradle
```

## 配置 Gradle（可选但推荐）

创建或编辑 `~/.gradle/gradle.properties`：

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

## 安装完成后

1. **验证安装**
   ```bash
   gradle --version
   ```

2. **运行构建**
   ```bash
   .\build-fabric-forge.bat
   ```

3. **查看输出**
   ```
   output/
   ├── mochi-link-connector-fabric-1.0.0.jar
   └── mochi-link-connector-forge-1.0.0.jar
   ```

## 需要帮助？

- Gradle 官方文档：https://docs.gradle.org/
- 安装指南：https://gradle.org/install/
- 项目 Issues：https://github.com/chm413/Mochi-Link/issues
