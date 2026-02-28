# Fabric 连接器编译指南

## 环境要求

- Java 17 或更高版本
- Gradle 7.0 或更高版本
- 互联网连接（用于下载依赖）

## 编译步骤

### 方法 1: 使用 Fabric Loom（推荐）

1. **安装 Fabric Loom 插件**

编辑 `build.gradle`，添加 Fabric Loom 插件：

```groovy
plugins {
    id 'fabric-loom' version '1.5-SNAPSHOT'
    id 'maven-publish'
}
```

2. **配置依赖**

```groovy
dependencies {
    minecraft "com.mojang:minecraft:${project.minecraft_version}"
    mappings "net.fabricmc:yarn:${project.yarn_mappings}:v2"
    modImplementation "net.fabricmc:fabric-loader:${project.loader_version}"
    modImplementation "net.fabricmc.fabric-api:fabric-api:${project.fabric_version}"
    
    // 嵌入依赖
    include 'org.java-websocket:Java-WebSocket:1.5.3'
    include 'com.google.code.gson:gson:2.10.1'
}
```

3. **运行编译**

```bash
gradle clean build
```

生成的 JAR 文件位于 `build/libs/` 目录。

### 方法 2: 简化编译（当前配置）

当前的 `build.gradle` 配置为简化编译，不需要 Fabric Loom。但是：

**限制**:
- 无法访问 Minecraft 类
- 无法使用 Fabric API 事件
- 仅用于开发和测试核心逻辑

**编译命令**:
```bash
gradle clean build
```

## 推荐的完整构建配置

创建一个新的 `build.gradle.loom` 文件：

```groovy
plugins {
    id 'fabric-loom' version '1.5-SNAPSHOT'
    id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

base {
    archivesName = project.archives_base_name
}

repositories {
    mavenCentral()
}

dependencies {
    minecraft "com.mojang:minecraft:${project.minecraft_version}"
    mappings "net.fabricmc:yarn:${project.yarn_mappings}:v2"
    modImplementation "net.fabricmc:fabric-loader:${project.loader_version}"
    modImplementation "net.fabricmc.fabric-api:fabric-api:${project.fabric_version}"
    
    include implementation('org.java-websocket:Java-WebSocket:1.5.3')
    include implementation('com.google.code.gson:gson:2.10.1')
}

processResources {
    inputs.property "version", project.version
    
    filesMatching("fabric.mod.json") {
        expand "version": project.version
    }
}

tasks.withType(JavaCompile).configureEach {
    it.options.release = 17
}

java {
    withSourcesJar()
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

jar {
    from("LICENSE") {
        rename { "${it}_${project.archivesBaseName}"}
    }
}
```

## 使用 Loom 配置编译

```bash
# 重命名配置文件
mv build.gradle build.gradle.simple
mv build.gradle.loom build.gradle

# 编译
gradle clean build

# 恢复简单配置
mv build.gradle build.gradle.loom
mv build.gradle.simple build.gradle
```

## 故障排除

### 问题 1: 找不到 Minecraft 类

**原因**: 未使用 Fabric Loom 插件

**解决**: 使用上面的 Loom 配置

### 问题 2: 找不到 Fabric API 类

**原因**: Fabric API 版本不匹配

**解决**: 检查 `gradle.properties` 中的版本号

### 问题 3: 编译速度慢

**原因**: 首次编译需要下载 Minecraft 和依赖

**解决**: 耐心等待，后续编译会快很多

## 部署

编译成功后，将 `build/libs/mochi-link-connector-fabric-1.0.0.jar` 复制到 Fabric 服务器的 `mods/` 目录。

## 开发环境

如果需要开发和调试：

```bash
# 生成 IDE 配置
gradle genSources

# 运行测试服务器
gradle runServer
```
