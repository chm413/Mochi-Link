# 支持的服务器核心类型

## 概述

Mochi-Link 支持多种 Minecraft 服务器核心，包括 Java 版和基岩版。

## 服务器类型 (type)

| 类型 | 值 | 说明 |
|------|-----|------|
| Java 版 | `java` | Minecraft Java Edition 服务器 |
| 基岩版 | `bedrock` | Minecraft Bedrock Edition 服务器 |

## Java 版核心 (core)

### Paper 系列

| 核心名称 | 值 | 说明 | 连接器 |
|---------|-----|------|--------|
| Paper | `paper` | 高性能 Spigot 分支 | MochiLinkConnector-Paper.jar |
| Spigot | `spigot` | 经典服务器核心 | MochiLinkConnector-Paper.jar |
| Folia | `folia` | Paper 的多线程版本 | MochiLinkConnector-Folia.jar |

### 模组加载器

| 核心名称 | 值 | 说明 | 连接器 |
|---------|-----|------|--------|
| Fabric | `fabric` | 轻量级模组加载器 | MochiLinkConnector-Fabric.jar |
| Forge | `forge` | 经典模组加载器 | MochiLinkConnector-Forge.jar |

### 混合端

| 核心名称 | 值 | 说明 | 连接器 |
|---------|-----|------|--------|
| Mohist | `mohist` | Forge + Paper 混合端 | MochiLinkConnector-Paper.jar |
| Arclight | `arclight` | Forge + Spigot 混合端 | MochiLinkConnector-Paper.jar |
| CatServer | `catserver` | Forge + Spigot 混合端 | MochiLinkConnector-Paper.jar |

## 基岩版核心 (core)

### Nukkit 系列

| 核心名称 | 值 | 说明 | 连接器 |
|---------|-----|------|--------|
| Nukkit | `nukkit` | Java 编写的基岩版服务器 | MochiLinkConnector-Nukkit.jar |
| PowerNukkit | `powernukkit` | Nukkit 的增强版本 | MochiLinkConnector-Nukkit.jar |
| Cloudburst | `cloudburst` | Nukkit 的分支 | MochiLinkConnector-Nukkit.jar |

### 其他基岩版核心

| 核心名称 | 值 | 说明 | 连接器 |
|---------|-----|------|--------|
| PMMP | `pmmp` | PHP 编写的基岩版服务器 | mochi-link-connector-pmmp |
| LLBDS | `llbds` | LiteLoaderBDS | mochi-link-connector-llbds |
| BDS | `bds` | 官方基岩版服务器 | mochi-link-connector-llbds |

## 使用示例

### mochi.server.add 命令

```bash
# Java 版 - Paper
mochi.server.add survival 生存服 -t java -c paper

# Java 版 - Fabric
mochi.server.add modded 模组服 -t java -c fabric

# Java 版 - Forge
mochi.server.add forge-server Forge服务器 -t java -c forge

# Java 版 - Folia
mochi.server.add folia-server Folia服务器 -t java -c folia

# 基岩版 - Nukkit
mochi.server.add bedrock 基岩服 -t bedrock -c nukkit

# 基岩版 - PMMP
mochi.server.add pmmp-server PMMP服务器 -t bedrock -c pmmp

# 基岩版 - LLBDS
mochi.server.add llbds-server LLBDS服务器 -t bedrock -c llbds
```

### /mochi register 命令

```bash
# Java 版 - Paper
/mochi register survival --name 生存服 --host 127.0.0.1 --port 25565 --core paper

# Java 版 - Fabric
/mochi register modded --name 模组服 --host 127.0.0.1 --port 25566 --core fabric

# Java 版 - Forge
/mochi register forge-server --name Forge服务器 --host 127.0.0.1 --port 25567 --core forge

# 基岩版 - Nukkit（自动识别类型）
/mochi register bedrock --name 基岩服 --host 127.0.0.1 --port 19132 --core nukkit

# 基岩版 - PMMP（手动指定类型）
/mochi register pmmp-server --name PMMP服务器 --host 127.0.0.1 --port 19133 --core pmmp --type bedrock

# 基岩版 - LLBDS
/mochi register llbds-server --name LLBDS服务器 --host 127.0.0.1 --port 19134 --core llbds
```

## 自动类型识别

系统会根据 `core` 参数自动识别服务器类型：

### 自动识别为基岩版的核心

- `nukkit`
- `powernukkit`
- `cloudburst`
- `pmmp`
- `bds`
- `llbds`

### 自动识别为 Java 版的核心

- `paper`
- `spigot`
- `folia`
- `fabric`
- `forge`
- `mohist`
- `arclight`
- `catserver`
- 其他未列出的核心

## 连接器下载

所有连接器都位于 `build-output/` 目录：

### Java 版连接器

- `MochiLinkConnector-Paper.jar` - 适用于 Paper/Spigot/Mohist/Arclight
- `MochiLinkConnector-Folia.jar` - 适用于 Folia
- `MochiLinkConnector-Fabric.jar` - 适用于 Fabric
- `MochiLinkConnector-Forge.jar` - 适用于 Forge

### 基岩版连接器

- `MochiLinkConnector-Nukkit.jar` - 适用于 Nukkit/PowerNukkit/Cloudburst
- `mochi-link-connector-pmmp/` - 适用于 PMMP（PHP 源码）
- `mochi-link-connector-llbds/` - 适用于 LLBDS/BDS（Node.js 源码）

## 端口说明

### 默认端口

| 服务器类型 | 默认端口 |
|-----------|---------|
| Java 版 | 25565 |
| 基岩版 | 19132 |

### 自定义端口

可以使用任意 1-65535 范围内的端口，只要不与其他服务冲突即可。

常见端口分配：
- 主服务器：25565 (Java) / 19132 (Bedrock)
- 第二服务器：25566 (Java) / 19133 (Bedrock)
- 第三服务器：25567 (Java) / 19134 (Bedrock)

## 核心版本兼容性

### Java 版

| 核心 | Minecraft 版本 | Java 版本 |
|------|---------------|-----------|
| Paper | 1.8+ | Java 8+ (1.17+ 需要 Java 17+) |
| Spigot | 1.8+ | Java 8+ (1.17+ 需要 Java 17+) |
| Folia | 1.19.4+ | Java 17+ |
| Fabric | 1.14+ | Java 8+ (1.17+ 需要 Java 17+) |
| Forge | 1.5.2+ | Java 8+ (1.17+ 需要 Java 17+) |

### 基岩版

| 核心 | Minecraft 版本 | 运行环境 |
|------|---------------|---------|
| Nukkit | 1.0+ | Java 8+ |
| PowerNukkit | 1.0+ | Java 8+ |
| PMMP | 1.0+ | PHP 7.4+ |
| LLBDS | 1.16+ | Node.js 14+ |
| BDS | 最新版 | 原生 |

## 常见问题

### Q: 如何选择合适的核心？

A: 根据需求选择：
- **纯插件服务器**：推荐 Paper（性能最好）
- **模组服务器**：Fabric（轻量）或 Forge（兼容性好）
- **插件+模组**：Mohist 或 Arclight
- **多线程**：Folia（适合大型服务器）
- **基岩版**：Nukkit（稳定）或 PMMP（功能丰富）

### Q: 可以同时管理多个不同核心的服务器吗？

A: 可以！Mochi-Link 支持同时管理多个不同核心的服务器，每个服务器使用对应的连接器即可。

### Q: 如何更换服务器核心？

A: 目前需要：
1. 删除旧服务器：`mochi.server.remove <id>`（需要超级管理员权限）
2. 重新注册新核心的服务器
3. 安装对应的连接器

### Q: 核心名称大小写敏感吗？

A: 不敏感。系统会自动转换为小写，所以 `Paper`、`paper`、`PAPER` 都是一样的。

### Q: 可以使用自定义核心吗？

A: 可以输入任意核心名称，但需要确保：
1. 有对应的连接器支持
2. 或者核心兼容现有连接器（如 Paper 兼容的核心可以使用 Paper 连接器）

## 更新日志

- **2026-02-22**: 初始版本
  - 列出所有支持的核心类型
  - 提供详细的使用示例
  - 说明自动类型识别规则

