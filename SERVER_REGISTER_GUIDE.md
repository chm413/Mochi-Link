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
| `<服务器ID>` | ✅ | 服务器的唯一标识符，只能包含字母、数字、下划线和连字符 | `survival`, `creative-01`, `server_1` |
| `--name` | ✅ | 服务器的显示名称，支持中文、空格和特殊字符 | `生存服`, `创造服务器 1号`, `"我的世界服务器"` |
| `--host` | ✅ | 服务器的 IP 地址或域名 | `127.0.0.1`, `mc.example.com`, `192.168.1.100` |
| `--port` | ✅ | 服务器的端口号（1-65535） | `25565`, `19132`, `25566` |
| `--core` | ✅ | 服务器核心类型（小写） | `paper`, `fabric`, `nukkit`, `pmmp`, `llbds` |
| `--type` | ❌ | 服务器类型（java 或 bedrock），不填会自动识别 | `java`, `bedrock` |

#### 名称格式说明

服务器名称支持三种格式：

1. **使用引号包裹**（推荐，支持任意字符）
   ```
   --name "我的 Minecraft 服务器"
   --name '生存服 #1'
   ```

2. **不使用引号**（自动识别到下一个参数）
   ```
   --name 生存服务器 --host 127.0.0.1
   ```
   注意：名称会自动识别到下一个 `--` 参数为止

3. **单个词**（无空格）
   ```
   --name 生存服 --host 127.0.0.1
   ```

#### ID 格式规则

服务器 ID 必须遵循以下规则：
- ✅ 只能包含：字母（a-z, A-Z）、数字（0-9）、下划线（_）、连字符（-）
- ✅ 示例：`survival`, `creative-01`, `server_1`, `mc-server-2024`
- ❌ 不能包含：空格、中文、特殊符号（@#$%等）
- ❌ 错误示例：`生存服`, `server 1`, `mc@server`

#### 示例

**Java 版服务器：**

1. 基本格式（名称无空格）
```
/mochi register survival --name 生存服 --host 127.0.0.1 --port 25565 --core paper
```

2. 名称包含空格（使用引号）
```
/mochi register creative --name "创造服务器 1号" --host 192.168.1.100 --port 25566 --core fabric
```

3. 名称包含空格（不使用引号，自动识别）
```
/mochi register skyblock --name 空岛服务器 --host 192.168.1.101 --port 25567 --core paper
```

4. 手动指定类型
```
/mochi register modded --name 模组服 --host 127.0.0.1 --port 25568 --core forge --type java
```

**基岩版服务器：**

1. Nukkit 服务器
```
/mochi register bedrock01 --name 基岩服 --host 127.0.0.1 --port 19132 --core nukkit
```

2. LLBDS 服务器
```
/mochi register llbds-server --name "LLBDS 服务器" --host 192.168.1.200 --port 19133 --core llbds
```

3. PMMP 服务器
```
/mochi register pmmp01 --name PMMP服务器 --host 127.0.0.1 --port 19134 --core pmmp --type bedrock
```

**复杂示例：**

1. 域名 + 自定义端口
```
/mochi register main --name "主服务器" --host mc.example.com --port 25565 --core paper
```

2. 内网 IP + 特殊名称
```
/mochi register test --name "测试服 [开发中]" --host 192.168.1.50 --port 25570 --core fabric
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
1. **命令格式**：确保以 `/mochi register` 开头
2. **参数符号**：使用两个连字符 `--`，不是一个 `-`
3. **参数顺序**：服务器 ID 必须在第一个位置
4. **ID 格式**：只能包含字母、数字、下划线、连字符（不能有空格或中文）
5. **端口号**：必须是 1-65535 之间的纯数字
6. **参数间隔**：参数之间要有空格
7. **名称格式**：
   - 如果名称包含空格，建议使用引号：`--name "我的服务器"`
   - 或确保名称后面紧跟下一个 `--` 参数

**正确示例：**
```
/mochi register survival --name 生存服 --host 127.0.0.1 --port 25565 --core paper
```

**错误示例及修正：**
- ❌ `/mochi register 生存服 -name ...` → ✅ 使用英文 ID，使用 `--name`
- ❌ `/mochi register survival -name ...` → ✅ 使用 `--name`（两个连字符）
- ❌ `/mochi register survival --name生存服...` → ✅ `--name` 后要有空格
- ❌ `/mochi register survival --name 生存服--host...` → ✅ 参数之间要有空格

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

### 服务器类型自动识别

系统会根据 `--core` 参数自动识别服务器类型：

**自动识别为基岩版的核心：**
- `nukkit`, `powernukkit`, `cloudburst` - Nukkit 系列
- `pmmp` - PocketMine-MP
- `bds` - 官方基岩版服务器
- `llbds` - LiteLoaderBDS

**其他核心自动识别为 Java 版：**
- `paper`, `spigot` - Paper/Spigot 系列
- `folia` - Folia（Paper 的多线程版本）
- `fabric` - Fabric 模组加载器
- `forge` - Forge 模组加载器
- `mohist`, `arclight` - 混合端

**手动指定类型：**
如果自动识别不准确，可以手动指定：
```
--type java    # 强制指定为 Java 版
--type bedrock # 强制指定为基岩版
```

### 名称自动识别

系统支持三种名称格式，会自动识别：

1. **引号包裹**（最安全）
   ```
   --name "我的 Minecraft 服务器"
   ```
   系统会提取引号内的所有内容作为名称

2. **自动识别到下一个参数**
   ```
   --name 我的服务器 --host 127.0.0.1
   ```
   系统会自动识别从 `--name` 后到下一个 `--` 之间的所有内容

3. **单个词**
   ```
   --name 生存服 --host 127.0.0.1
   ```
   如果名称是单个词（无空格），可以直接写

### ID 和名称的区别

| 项目 | 服务器 ID | 服务器名称 |
|------|----------|-----------|
| 用途 | 系统内部唯一标识 | 显示给用户看的名称 |
| 格式限制 | 只能是字母、数字、下划线、连字符 | 可以包含中文、空格、特殊字符 |
| 是否唯一 | 必须唯一，不能重复 | 可以重复 |
| 示例 | `survival`, `creative-01` | `生存服`, `创造服务器 1号` |
| 修改 | 不能修改（需要删除重建） | 可以修改（未来版本） |

**最佳实践：**
- ID 使用英文，简短易记：`survival`, `creative`, `skyblock`
- 名称使用中文，描述清晰：`生存服务器`, `创造模式`, `空岛生存`

## 安全提示

1. **权限控制**：只有管理员（等级 3）才能注册服务器
2. **审计日志**：所有注册操作都会记录在审计日志中
3. **ID 唯一性**：每个服务器 ID 必须唯一，不能重复
4. **连接安全**：建议使用 SSL/TLS 加密连接

## 更新日志

- **2026-02-22**: 初始版本，支持通过 QQ 消息注册服务器
