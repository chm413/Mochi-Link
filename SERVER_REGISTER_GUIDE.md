# 服务器注册指南

## 概述

由于 Koishi 运行在 Docker 容器中，无法直接访问控制台，因此我们提供了通过 QQ 消息注册服务器的功能。

## 注册方式

### 方式一：通过 QQ 消息直接注册（推荐）

在 QQ 群或私聊中发送以下格式的消息：

```
/mochi register <服务器ID> --name <名称> --host <地址> --port <端口> --core <核心> [--type <类型>]
```

#### 参数说明

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `<服务器ID>` | ✅ | 服务器的唯一标识符，只能包含字母、数字、下划线和连字符 | `survival`, `creative-01` |
| `--name` | ✅ | 服务器的显示名称，可以包含中文和空格 | `生存服`, `创造服务器 1号` |
| `--host` | ✅ | 服务器的 IP 地址或域名 | `127.0.0.1`, `mc.example.com` |
| `--port` | ✅ | 服务器的端口号 | `25565`, `19132` |
| `--core` | ✅ | 服务器核心类型 | `paper`, `fabric`, `nukkit` |
| `--type` | ❌ | 服务器类型（java 或 bedrock），不填会自动识别 | `java`, `bedrock` |

#### 示例

**Java 版服务器：**
```
/mochi register survival --name 生存服 --host 127.0.0.1 --port 25565 --core paper
```

```
/mochi register creative --name 创造服务器 --host 192.168.1.100 --port 25566 --core fabric --type java
```

**基岩版服务器：**
```
/mochi register bedrock01 --name 基岩服 --host 127.0.0.1 --port 19132 --core nukkit --type bedrock
```

```
/mochi register llbds-server --name LLBDS服务器 --host 192.168.1.200 --port 19133 --core llbds
```

### 方式二：使用命令（传统方式）

如果你更喜欢使用命令，也可以使用：

```
mochi.server.add <id> <name> [-t type] [-c core]
```

但这种方式不支持配置连接地址和端口。

## 权限要求

注册服务器需要**管理员权限（等级 3）**。

如果你没有权限，会收到以下提示：
```
权限不足：需要管理员权限（等级 3）才能注册服务器
```

请联系 Koishi 管理员为你的账号设置权限。

## 注册成功后

注册成功后，你会收到类似以下的确认消息：

```
✅ 服务器注册成功！

📋 服务器信息:
  ID: survival
  名称: 生存服
  类型: Java 版
  核心: paper
  地址: 127.0.0.1:25565

📦 下一步:
1. 在服务器上安装对应的连接器插件
2. 配置连接器连接到 Koishi
3. 使用 mochi.server.list 查看服务器状态
```

## 下一步操作

### 1. 安装连接器插件

根据你的服务器核心类型，下载对应的连接器插件：

| 核心类型 | 插件文件 | 位置 |
|---------|---------|------|
| Paper/Spigot | `MochiLinkConnector-Paper.jar` | `build-output/` |
| Folia | `MochiLinkConnector-Folia.jar` | `build-output/` |
| Fabric | `MochiLinkConnector-Fabric.jar` | `build-output/` |
| Forge | `MochiLinkConnector-Forge.jar` | `build-output/` |
| Nukkit | `MochiLinkConnector-Nukkit.jar` | `build-output/` |
| LLBDS | `mochi-link-connector-llbds/` | 源码目录 |
| PMMP | `mochi-link-connector-pmmp/` | 源码目录 |

### 2. 配置连接器

在服务器的插件配置文件中设置 Koishi 的连接信息：

```yaml
# config.yml 示例
koishi:
  host: "你的Koishi地址"
  port: 8080
  server-id: "survival"  # 与注册时的 ID 一致
  ssl: false
```

### 3. 启动服务器

启动 Minecraft 服务器，连接器会自动连接到 Koishi。

### 4. 验证连接

在 QQ 中使用以下命令查看服务器状态：

```
mochi.server.list
```

如果连接成功，服务器状态会显示为 `online`。

## 常见问题

### Q: 注册时提示"格式错误"怎么办？

A: 请检查：
1. 命令格式是否正确，特别是 `--` 符号
2. 参数之间是否有空格
3. 服务器 ID 是否包含特殊字符（只允许字母、数字、下划线、连字符）
4. 端口号是否为纯数字

### Q: 注册时提示"服务器已存在"怎么办？

A: 说明该 ID 已被使用，请：
1. 使用 `mochi.server.list` 查看已注册的服务器
2. 选择一个不同的 ID
3. 或者使用 `mochi.server.remove <id>` 删除旧服务器（需要超级管理员权限）

### Q: 如何修改已注册服务器的信息？

A: 目前需要先删除再重新注册：
1. `mochi.server.remove <id>` （需要超级管理员权限）
2. 重新使用 `/mochi register` 注册

### Q: Docker 容器中的 Koishi 如何被服务器访问？

A: 有几种方式：
1. **Host 网络模式**：Docker 使用 `--network host`，服务器可以通过 `127.0.0.1` 访问
2. **桥接网络**：使用 Docker 的内部 IP，通过 `docker inspect` 查看
3. **端口映射**：映射 Koishi 的 WebSocket 端口到宿主机
4. **反向代理**：使用 Nginx 等反向代理

### Q: 支持哪些服务器核心？

A: 目前支持：

**Java 版：**
- Paper/Spigot
- Folia
- Fabric
- Forge
- Nukkit (基岩版核心)

**基岩版：**
- LLBDS
- PMMP
- Nukkit
- BDS (官方)

## 自动识别功能

系统会根据 `--core` 参数自动识别服务器类型：

- 包含 `nukkit`, `pmmp`, `bds`, `llbds` 的会被识别为基岩版
- 其他的会被识别为 Java 版
- 也可以手动指定 `--type java` 或 `--type bedrock`

## 安全提示

1. **权限控制**：只有管理员（等级 3）才能注册服务器
2. **审计日志**：所有注册操作都会记录在审计日志中
3. **ID 唯一性**：每个服务器 ID 必须唯一，不能重复
4. **连接安全**：建议使用 SSL/TLS 加密连接

## 更新日志

- **2026-02-22**: 初始版本，支持通过 QQ 消息注册服务器
