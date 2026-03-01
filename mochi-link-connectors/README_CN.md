# 大福连连接器合集

收集日期: 周六 2026/02/28 11:55:29.04

## 目录结构

```
mochi-link-connectors/
├── java-edition/           # Java 版
│   ├── forge/               # Forge 模组
│   ├── paper-spigot/        # Paper/Spigot 插件
│   └── folia/               # Folia 插件
├── bedrock-edition/         # 基岩版
│   ├── nukkit/              # Nukkit 插件
│   └── pmmp/                # PocketMine-MP 插件
└── config-templates/        # 配置文件模板
```

## 安装说明

### Java 版

**Fabric:**
1. 将 `java-edition/fabric/mochi-link-connector-fabric-*.jar` 复制到服务器的 `mods/` 文件夹

**Forge:**
1. 将 `java-edition/forge/mochi-link-connector-forge-*.jar` 复制到服务器的 `mods/` 文件夹

**Paper/Spigot:**
1. 将 `java-edition/paper-spigot/mochi-link-connector-java-*.jar` 复制到服务器的 `plugins/` 文件夹

**Folia:**
1. 将 `java-edition/folia/mochi-link-connector-folia-*.jar` 复制到服务器的 `plugins/` 文件夹

### 基岩版

**LLBDS:**
1. 将整个 `bedrock-edition/llbds/` 文件夹复制到 LLBDS 的 `plugins/` 目录
2. 在插件文件夹中运行 `npm install`
3. 重启服务器

**Nukkit:**
1. 将 `bedrock-edition/nukkit/mochi-link-connector-nukkit-*.jar` 复制到服务器的 `plugins/` 文件夹

**PMMP:**
1. 将整个 `bedrock-edition/pmmp/` 文件夹复制到 PMMP 的 `plugins/` 目录
2. 重启服务器

## 配置

配置模板位于 `config-templates/` 文件夹:

- `fabric-config.json` - Fabric 配置
- `paper-spigot-config.yml` - Paper/Spigot 配置
- `folia-config.yml` - Folia 配置
- `llbds-config.json` - LLBDS 配置
- `CORRECT_CONFIG_EXAMPLE.yml` - 通用配置示例

将相应的模板复制到服务器的插件/模组文件夹并根据需要编辑。

## 支持

- GitHub: https://github.com/chm413/Mochi-Link
- Issues: https://github.com/chm413/Mochi-Link/issues

## 版本信息

所有连接器版本: 1.0.0
构建日期: 周六 2026/02/28
