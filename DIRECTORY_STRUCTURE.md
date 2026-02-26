# Mochi-Link 项目目录结构

## 📁 目录说明

```
mochi-link/
├── src/                          # 源代码目录
│   ├── bridge/                   # 连接器桥接层
│   ├── config/                   # 配置管理
│   ├── connection/               # 连接模式管理
│   ├── database/                 # 数据库层
│   ├── http/                     # HTTP API 服务器
│   ├── plugins/                  # Minecraft 插件集成
│   ├── protocol/                 # U-WBP v2 协议实现
│   ├── services/                 # 业务服务层
│   ├── types/                    # TypeScript 类型定义
│   ├── websocket/                # WebSocket 服务器
│   └── index.ts                  # 插件入口文件
│
├── connectors/                   # Minecraft 服务器连接器
│   ├── java/                     # Paper/Spigot 连接器
│   ├── folia/                    # Folia 连接器
│   ├── fabric/                   # Fabric 连接器
│   ├── forge/                    # Forge 连接器
│   ├── nukkit/                   # Nukkit 连接器
│   ├── pmmp/                     # PMMP 连接器
│   └── llbds/                    # LLBDS 连接器
│
├── lib/                          # 编译输出目录
│   └── (编译后的 JavaScript 文件)
│
├── wiki/                         # 项目文档
│   ├── CHANGELOG.md              # 更新日志
│   ├── KOISHI_INSTALLATION_GUIDE.md  # Koishi 安装指南
│   ├── QUICK_INSTALL.md          # 快速安装指南
│   ├── LOCALIZATION.md           # 本地化说明
│   ├── MULTILINGUAL_SUPPORT.md   # 多语言支持
│   ├── SUPPORTED_CORES.md        # 支持的核心列表
│   ├── FIXED_VERSION_INSTALL.md  # 固定版本安装
│   └── 项目介绍与部署指南.md      # 中文部署指南
│
├── tests/                        # 测试文件
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   └── property/                 # 属性测试
│
├── scripts/                      # 构建和部署脚本
│   ├── build-all-connectors.sh   # 构建所有连接器（Linux/Mac）
│   ├── build-all-connectors.bat  # 构建所有连接器（Windows）
│   └── rebuild-connectors.bat    # 重新构建连接器
│
├── config-templates/             # 配置文件模板
│   ├── paper-spigot-config.yml   # Paper/Spigot 配置模板
│   ├── folia-config.yml          # Folia 配置模板
│   ├── fabric-config.json        # Fabric 配置模板
│   ├── llbds-config.json         # LLBDS 配置模板
│   └── CORRECT_CONFIG_EXAMPLE.yml # 正确配置示例
│
├── build-output/                 # 连接器构建输出
│   └── (编译后的连接器 JAR/插件文件)
│
├── locales/                      # 国际化语言文件
│   ├── zh-CN.yml                 # 简体中文
│   ├── en-US.yml                 # 英文
│   └── (其他语言文件)
│
├── .github/                      # GitHub 配置
│   └── workflows/                # CI/CD 工作流
│
├── .kiro/                        # Kiro AI 配置
│
├── node_modules/                 # Node.js 依赖（不提交）
│
├── .gitignore                    # Git 忽略文件
├── .npmignore                    # npm 忽略文件
├── .eslintrc.js                  # ESLint 配置
├── tsconfig.json                 # TypeScript 配置
├── jest.config.js                # Jest 测试配置
├── jest.integration.config.js    # Jest 集成测试配置
├── package.json                  # npm 包配置
├── package-lock.json             # npm 依赖锁定
├── LICENSE                       # MIT 许可证
├── README.md                     # 项目说明
└── DIRECTORY_STRUCTURE.md        # 本文档

```

## 📝 目录详细说明

### src/ - 源代码

#### bridge/ - 连接器桥接层
提供统一的服务器操作接口，抽象 Java 和 Bedrock 版本差异。

**主要文件**:
- `base.ts` - 基础桥接类
- `java.ts` - Java 版桥接实现
- `bedrock.ts` - 基岩版桥接实现
- `types.ts` - 桥接层类型定义

#### config/ - 配置管理
管理插件配置和部署配置。

**主要文件**:
- `deployment.ts` - 部署配置管理器
- `index.ts` - 配置模块导出

#### connection/ - 连接模式管理
管理不同的服务器连接模式（Plugin、RCON、Terminal）。

**主要文件**:
- `manager.ts` - 连接模式管理器
- `pool.ts` - 连接池
- `types.ts` - 连接类型定义
- `adapters/` - 连接适配器实现

#### database/ - 数据库层
数据库操作和模型定义。

**主要文件**:
- `simple-init.ts` - 简化的数据库管理器
- `operations.ts` - 完整的数据库操作
- `models.ts` - 数据模型定义
- `optimization.ts` - 查询优化

#### http/ - HTTP API 服务器
提供 RESTful API 接口。

**主要文件**:
- `server.ts` - HTTP 服务器实现
- `router.ts` - API 路由器
- `versioning.ts` - API 版本管理
- `docs.ts` - API 文档服务器
- `middleware/` - 中间件（认证、验证、CORS 等）

#### plugins/ - Minecraft 插件集成
集成 Minecraft 插件（PlaceholderAPI、Plan、LuckPerms、Vault）。

**主要文件**:
- `manager.ts` - 插件管理器
- `registry.ts` - 插件注册表
- `types.ts` - 插件类型定义
- `integrations/` - 具体插件集成实现

#### protocol/ - U-WBP v2 协议
实现 Unified WebSocket Bridge Protocol version 2。

**主要文件**:
- `handler.ts` - 协议处理器
- `messages.ts` - 消息工厂
- `serialization.ts` - 消息序列化
- `validation.ts` - 消息验证
- `router.ts` - 消息路由器

#### services/ - 业务服务层
核心业务逻辑服务。

**主要服务**:
- `audit.ts` - 审计日志服务
- `binding.ts` - 绑定管理服务
- `command.ts` - 命令执行服务
- `event.ts` - 事件订阅服务
- `monitoring.ts` - 性能监控服务
- `permission.ts` - 权限管理服务
- `player-info.ts` - 玩家信息服务
- `server.ts` - 服务器管理服务
- `token.ts` - Token 管理服务
- `whitelist.ts` - 白名单管理服务
- `index.ts` - 服务管理器

#### types/ - TypeScript 类型
全局类型定义。

**主要文件**:
- `index.ts` - 所有类型定义

#### websocket/ - WebSocket 服务器
WebSocket 连接管理。

**主要文件**:
- `server.ts` - WebSocket 服务器
- `client.ts` - WebSocket 客户端
- `connection.ts` - 连接对象
- `auth.ts` - 认证管理器
- `token-manager.ts` - Token 管理器
- `heartbeat.ts` - 心跳管理器
- `manager.ts` - 连接管理器

### connectors/ - 连接器

每个连接器都是独立的项目，用于在 Minecraft 服务器上运行。

#### Java 版连接器
- `java/` - Paper/Spigot 通用连接器
- `folia/` - Folia 专用连接器
- `fabric/` - Fabric Mod
- `forge/` - Forge Mod

#### 基岩版连接器
- `nukkit/` - Nukkit 插件
- `pmmp/` - PMMP 插件
- `llbds/` - LLBDS 插件

### wiki/ - 文档

项目文档和指南。

**主要文档**:
- `CHANGELOG.md` - 版本更新日志
- `KOISHI_INSTALLATION_GUIDE.md` - 详细安装指南
- `QUICK_INSTALL.md` - 快速安装指南
- `LOCALIZATION.md` - 本地化说明
- `MULTILINGUAL_SUPPORT.md` - 多语言支持文档
- `SUPPORTED_CORES.md` - 支持的服务器核心列表

### tests/ - 测试

测试文件组织。

**测试类型**:
- `unit/` - 单元测试（Jest）
- `integration/` - 集成测试（Jest）
- `property/` - 属性测试（fast-check）

### scripts/ - 脚本

构建和部署脚本。

**主要脚本**:
- `build-all-connectors.sh` - 构建所有连接器（Linux/Mac）
- `build-all-connectors.bat` - 构建所有连接器（Windows）
- `rebuild-connectors.bat` - 重新构建连接器

### config-templates/ - 配置模板

各种服务器核心的配置文件模板。

**模板文件**:
- `paper-spigot-config.yml` - Paper/Spigot 配置
- `folia-config.yml` - Folia 配置
- `fabric-config.json` - Fabric 配置
- `llbds-config.json` - LLBDS 配置

### build-output/ - 构建输出

连接器编译后的输出文件（JAR、插件包等）。

**注意**: 此目录不提交到 Git，但保留在 .gitignore 中。

### locales/ - 国际化

多语言支持文件。

**语言文件**:
- `zh-CN.yml` - 简体中文
- `en-US.yml` - 英文
- 其他语言文件...

## 🔧 开发工作流

### 1. 修改源代码
```bash
# 编辑 src/ 目录下的文件
vim src/services/server.ts
```

### 2. 运行测试
```bash
# 单元测试
npm test

# 集成测试
npm run test:integration

# 覆盖率报告
npm run test:coverage
```

### 3. 构建项目
```bash
# 构建 TypeScript
npm run build

# 构建连接器
npm run build:connectors
```

### 4. 本地测试
```bash
# 在 Koishi 项目中测试
cd /path/to/koishi-project
npm install file:../mochi-link
```

### 5. 发布
```bash
# 发布到 npm
npm publish
```

## 📦 构建产物

### Koishi 插件
- `lib/` - 编译后的 JavaScript 文件
- `package.json` - npm 包配置

### 连接器
- `build-output/mochi-link-connector-java-1.0.0.jar`
- `build-output/mochi-link-connector-folia-1.0.0.jar`
- `build-output/mochi-link-connector-fabric-1.0.0.jar`
- `build-output/mochi-link-connector-forge-1.0.0.jar`
- `build-output/mochi-link-connector-nukkit-1.0.0.jar`
- `build-output/mochi-link-connector-pmmp-1.0.0.phar`
- `build-output/mochi-link-connector-llbds-1.0.0.zip`

## 🚫 忽略文件

### .gitignore
- `node_modules/` - Node.js 依赖
- `lib/` - 编译输出
- `build-output/` - 连接器构建输出
- `*.tsbuildinfo` - TypeScript 构建信息
- `*.log` - 日志文件
- `.DS_Store` - macOS 文件
- `temp/` - 临时文件

### .npmignore
- `src/` - 源代码（发布时只包含编译后的 lib/）
- `tests/` - 测试文件
- `connectors/` - 连接器源码
- `wiki/` - 文档
- `scripts/` - 脚本
- `*.md` - Markdown 文件（除了 README.md）

## 📚 相关文档

- [README.md](../README.md) - 项目说明
- [wiki/KOISHI_INSTALLATION_GUIDE.md](wiki/KOISHI_INSTALLATION_GUIDE.md) - 安装指南
- [wiki/CHANGELOG.md](wiki/CHANGELOG.md) - 更新日志
- [LICENSE](../LICENSE) - MIT 许可证

---

**最后更新**: 2026-02-26
