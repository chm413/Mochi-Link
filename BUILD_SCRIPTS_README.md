# 构建脚本说明 / Build Scripts Guide

## 新的统一构建系统 / New Unified Build System

我们已经简化了构建脚本，现在只需要使用一个主脚本：

### Windows

```bash
# 构建所有连接器
build-connectors.bat

# 构建特定连接器
build-connectors.bat --java
build-connectors.bat --fabric
build-connectors.bat --forge
build-connectors.bat --folia
build-connectors.bat --nukkit
build-connectors.bat --llbds
build-connectors.bat --pmmp

# 收集已构建的连接器
build-connectors.bat --collect

# 使用本地 Gradle 8.8
build-connectors.bat --all --local-gradle
```

### Linux/Mac

```bash
# 构建所有连接器
./build-all-connectors.sh

# 查看帮助
./build-all-connectors.sh --help
```

## 已废弃的脚本 / Deprecated Scripts

以下脚本已被统一脚本替代，建议删除：

### 重复的构建脚本
- `build-fabric-forge.bat` - 使用 `build-connectors.bat --fabric --forge`
- `build-fabric-forge-cn.bat` - 使用 `build-connectors.bat --fabric --forge`
- `build-fabric-no-proxy.bat` - 代理配置现在在 gradle.properties 中
- `build-fabric-with-proxy.bat` - 代理配置现在在 gradle.properties 中
- `build-fabric-with-env-proxy.bat` - 代理配置现在在 gradle.properties 中
- `build-forge-simple.bat` - 使用 `build-connectors.bat --forge`
- `build-forge-with-local-gradle.bat` - 使用 `build-connectors.bat --forge --local-gradle`
- `build-all-with-local-gradle.bat` - 使用 `build-connectors.bat --all --local-gradle`
- `rebuild-connectors.bat` - 使用 `build-connectors.bat --java --folia`

### 重复的收集脚本
- `collect-connectors.bat` - 使用 `build-connectors.bat --collect`
- `build-all-to-collection.bat` - 使用 `build-connectors.bat --all` 然后 `build-connectors.bat --collect`

## GitHub Actions 自动构建

项目已配置 GitHub Actions 自动构建：

- **主插件**: `.github/workflows/build.yml`
- **所有连接器**: `.github/workflows/build-connectors.yml`
- **版本发布**: `.github/workflows/release.yml`

推送代码后会自动触发构建，无需手动运行脚本。

## 构建输出

### 本地构建
- 输出目录: `build-output/`
- 收集目录: `mochi-link-connectors/`

### GitHub Actions
- 构建产物会自动上传到 GitHub Actions Artifacts
- Release 时会创建完整的发布包

## 代理配置

代理配置统一在各连接器的 `gradle.properties` 文件中：

```properties
# HTTP 代理配置
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=2080
systemProp.http.proxyUser=your_username
systemProp.http.proxyPassword=your_password

systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=2080
systemProp.https.proxyUser=your_username
systemProp.https.proxyPassword=your_password
```

## 迁移指南

### 从旧脚本迁移

| 旧脚本 | 新命令 |
|--------|--------|
| `build-fabric-forge.bat` | `build-connectors.bat --fabric --forge` |
| `build-all-with-local-gradle.bat` | `build-connectors.bat --all --local-gradle` |
| `collect-connectors.bat` | `build-connectors.bat --collect` |
| `rebuild-connectors.bat` | `build-connectors.bat --java --folia` |

### 清理旧脚本

运行以下命令删除废弃的脚本：

```bash
# Windows
del build-fabric-forge.bat
del build-fabric-forge-cn.bat
del build-fabric-no-proxy.bat
del build-fabric-with-proxy.bat
del build-fabric-with-env-proxy.bat
del build-forge-simple.bat
del build-forge-with-local-gradle.bat
del build-all-with-local-gradle.bat
del build-all-to-collection.bat
del collect-connectors.bat
del rebuild-connectors.bat
```

## 故障排除

### Gradle 构建失败

1. 检查 Java 版本（需要 Java 17+）
   ```bash
   java -version
   ```

2. 检查 Gradle 版本
   ```bash
   gradle --version
   ```

3. 清理 Gradle 缓存
   ```bash
   gradle clean --no-daemon
   ```

### 代理问题

如果遇到网络问题：

1. 检查代理配置是否正确
2. 尝试不使用代理
3. 使用本地 Gradle: `--local-gradle`

### LLBDS 构建失败

确保已安装 Node.js 和 npm：

```bash
node --version
npm --version
```

## 支持

如有问题，请查看：

- [构建环境设置](docs/BUILD_ENVIRONMENT_SETUP.md)
- [快速构建指南](docs/QUICK_BUILD_GUIDE.md)
- [GitHub Issues](https://github.com/chm413/Mochi-Link/issues)
