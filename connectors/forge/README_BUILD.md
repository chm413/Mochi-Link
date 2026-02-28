# Forge 连接器编译指南

## 环境要求

- Java 17 或更高版本
- Gradle 7.0 或更高版本
- 互联网连接（用于下载依赖）

## 编译步骤

### 方法 1: 使用 ForgeGradle（推荐）

1. **安装 ForgeGradle 插件**

编辑 `build.gradle`，添加 ForgeGradle 插件：

```groovy
plugins {
    id 'net.minecraftforge.gradle' version '6.0.+'
    id 'maven-publish'
}
```

2. **配置 Minecraft 和 Forge**

```groovy
minecraft {
    mappings channel: 'official', version: '1.20.1'
    
    runs {
        server {
            workingDirectory project.file('run')
            property 'forge.logging.console.level', 'debug'
            mods {
                mochilink {
                    source sourceSets.main
                }
            }
        }
    }
}

dependencies {
    minecraft 'net.minecraftforge:forge:1.20.1-47.2.0'
    
    implementation 'org.java-websocket:Java-WebSocket:1.5.3'
    implementation 'com.google.code.gson:gson:2.10.1'
}
```

3. **运行编译**

```bash
gradle clean build
```

生成的 JAR 文件位于 `build/libs/` 目录。

### 方法 2: 简化编译（当前配置）

当前的 `build.gradle` 配置为简化编译，不需要 ForgeGradle。但是：

**限制**:
- 无法访问 Minecraft 类
- 无法使用 Forge 事件系统
- 仅用于开发和测试核心逻辑

**编译命令**:
```bash
gradle clean build
```

## 推荐的完整构建配置

创建一个新的 `build.gradle.forge` 文件：

```groovy
plugins {
    id 'net.minecraftforge.gradle' version '[6.0,6.2)'
    id 'maven-publish'
}

version = '1.0.0'
group = 'com.mochilink'

base {
    archivesName = 'mochi-link-connector-forge'
}

java.toolchain.languageVersion = JavaLanguageVersion.of(17)

minecraft {
    mappings channel: 'official', version: '1.20.1'
    
    runs {
        server {
            workingDirectory project.file('run')
            property 'forge.logging.markers', 'REGISTRIES'
            property 'forge.logging.console.level', 'debug'
            
            mods {
                mochilink {
                    source sourceSets.main
                }
            }
        }
    }
}

repositories {
    mavenCentral()
}

dependencies {
    minecraft 'net.minecraftforge:forge:1.20.1-47.2.0'
    
    implementation 'org.java-websocket:Java-WebSocket:1.5.3'
    implementation 'com.google.code.gson:gson:2.10.1'
}

tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
}

jar {
    manifest {
        attributes([
            "Specification-Title": "mochi-link-connector-forge",
            "Specification-Vendor": "mochilink",
            "Specification-Version": "1",
            "Implementation-Title": project.name,
            "Implementation-Version": project.version,
            "Implementation-Vendor": "mochilink"
        ])
    }
    
    finalizedBy 'reobfJar'
}

publishing {
    publications {
        mavenJava(MavenPublication) {
            artifact jar
        }
    }
    repositories {
        maven {
            url "file://${project.projectDir}/mcmodsrepo"
        }
    }
}
```

## 使用 ForgeGradle 配置编译

```bash
# 重命名配置文件
mv build.gradle build.gradle.simple
mv build.gradle.forge build.gradle

# 首次编译（会下载 Minecraft 和 Forge）
gradle clean build

# 恢复简单配置
mv build.gradle build.gradle.forge
mv build.gradle.simple build.gradle
```

## 故障排除

### 问题 1: 找不到 Minecraft 类

**原因**: 未使用 ForgeGradle 插件

**解决**: 使用上面的 ForgeGradle 配置

### 问题 2: 找不到 Forge 事件类

**原因**: Forge 版本不匹配

**解决**: 检查 Forge 版本号，确保与 Minecraft 版本匹配

### 问题 3: 编译速度慢

**原因**: 首次编译需要下载 Minecraft、Forge 和 MCP mappings

**解决**: 耐心等待，后续编译会快很多（可能需要 10-30 分钟）

### 问题 4: 内存不足

**原因**: ForgeGradle 需要较多内存

**解决**: 在 `gradle.properties` 中增加内存：
```properties
org.gradle.jvmargs=-Xmx3G
```

## 部署

编译成功后，将 `build/libs/mochi-link-connector-forge-1.0.0.jar` 复制到 Forge 服务器的 `mods/` 目录。

## 开发环境

如果需要开发和调试：

```bash
# 生成 IDE 配置（IntelliJ IDEA）
gradle genIntellijRuns

# 生成 IDE 配置（Eclipse）
gradle genEclipseRuns

# 运行测试服务器
gradle runServer
```

## 注意事项

1. **首次编译时间长**: ForgeGradle 需要下载和处理大量文件，首次编译可能需要 10-30 分钟
2. **网络要求**: 需要稳定的互联网连接
3. **磁盘空间**: 确保有至少 2GB 的可用磁盘空间
4. **内存要求**: 建议至少 4GB RAM
