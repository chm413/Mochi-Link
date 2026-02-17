# 需求文档

## 介绍

Web Dashboard（网页仪表板）是为 Mochi-Link（大福连）Minecraft 统一管理系统设计的现代化 React 网页界面。它为管理员和操作员提供直观的实时界面，通过响应式网页应用程序监控和管理 Minecraft 服务器、玩家和系统操作，并与现有的 HTTP API 和 WebSocket 基础设施集成。

## 术语表

- **Web_Dashboard**: 基于 React 的前端网页应用程序
- **Management_System**: 现有的 Mochi-Link Minecraft 统一管理后端系统
- **Server_Instance**: 系统中管理的 Minecraft 服务器实例（支持 Vanilla、Paper/Spigot/Bukkit、Fabric、Forge、NeoForge、PMMP、Nukkit、LLBDS）
- **Server_Type**: 服务器平台类型（Vanilla、Paper、Spigot、Bukkit、Fabric、Forge、NeoForge、PMMP、Nukkit、LLBDS）
- **Connector_Config**: 特定服务器类型的连接器配置设置
- **Player_Record**: 跨所有管理服务器的玩家信息记录
- **Command_Interface**: 基于网页的命令执行系统
- **Event_Log**: 实时系统事件和通知日志
- **User_Session**: 已认证用户的访问会话
- **Role_Permission**: 不同用户类型的访问控制级别
- **Metric_Dashboard**: 实时监控图表和统计数据仪表板
- **API_Client**: 用于后端通信的前端 HTTP 客户端
- **WebSocket_Client**: 用于实时更新的前端 WebSocket 客户端

## 需求

### 需求 1: 网页界面基础

**用户故事:** 作为系统管理员，我希望有一个现代化的基于 React 的网页界面，以便我可以通过直观且响应式的网页应用程序管理 Minecraft 服务器。

#### 验收标准

1. Web_Dashboard 应当使用现代 JavaScript/TypeScript 的 React 构建
2. 当应用程序加载时，Web_Dashboard 应当显示适应不同屏幕尺寸的响应式布局
3. Web_Dashboard 应当提供导航系统以访问不同的管理部分
4. 当在移动设备上访问时，Web_Dashboard 应当保持完整功能并具有触摸优化控件
5. Web_Dashboard 应当与现有 Management_System HTTP API 集成以进行所有数据操作

### 需求 2: 实时监控仪表板

**用户故事:** 作为服务器操作员，我希望有带图表和指标的实时监控仪表板，以便我可以一目了然地跟踪服务器性能和玩家活动。

#### 验收标准

1. 当查看监控仪表板时，Metric_Dashboard 应当显示实时服务器性能图表
2. Metric_Dashboard 应当显示所有管理服务器的玩家数量统计
3. 当服务器指标更新时，Metric_Dashboard 应当通过 WebSocket 连接自动刷新
4. Metric_Dashboard 应当显示系统资源使用情况，包括 CPU、内存和网络统计
5. 当历史数据可用时，Metric_Dashboard 应当提供时间范围选择以查看趋势

### 需求 3: 全版本服务器管理界面

**用户故事:** 作为管理员，我希望有支持全版本 Minecraft 服务器的管理界面，以便我可以通过网页界面管理不同类型的服务器基础设施。

#### 验收标准

1. 当访问服务器管理时，Web_Dashboard 应当显示所有管理的 Server_Instances 列表，包括服务器类型标识
2. 当添加新服务器时，Web_Dashboard 应当支持以下服务器类型：Vanilla、Paper/Spigot/Bukkit、Fabric、Forge、NeoForge、PMMP、Nukkit、LLBDS
3. 当选择服务器类型时，Web_Dashboard 应当显示该类型特定的配置选项和连接器设置
4. 当编辑现有服务器时，Web_Dashboard 应当根据服务器类型显示相应的配置界面
5. Web_Dashboard 应当验证每种服务器类型的特定配置要求

### 需求 4: 玩家管理系统

**用户故事:** 作为版主，我希望有带搜索和过滤功能的玩家管理，以便我可以高效地查找和管理所有服务器上的玩家。

#### 验收标准

1. 当查看玩家管理时，Web_Dashboard 应当显示所有 Player_Records 的可搜索列表
2. 当搜索玩家时，Web_Dashboard 应当按用户名、UUID 或服务器过滤结果
3. Web_Dashboard 应当为玩家列表提供按各种标准排序的选项
4. 当选择玩家时，Web_Dashboard 应当显示详细的玩家信息和活动历史
5. Web_Dashboard 应当允许版主执行玩家管理操作，如踢出、封禁和警告

### 需求 5: 命令执行界面

**用户故事:** 作为操作员，我希望有带历史记录的命令执行界面，以便我可以运行服务器命令并跟踪已执行的命令。

#### 验收标准

1. 当访问命令界面时，Command_Interface 应当提供用于输入服务器命令的文本输入
2. 当执行命令时，Command_Interface 应当通过 API 将命令发送到指定的 Server_Instance
3. Command_Interface 应当实时显示命令输出和响应
4. Command_Interface 应当为当前会话维护已执行命令的历史记录
5. 当命令执行失败时，Command_Interface 应当显示清晰的错误消息

### 需求 6: 实时事件日志和通知

**用户故事:** 作为系统管理员，我希望有实时事件日志和通知，以便我可以监控系统活动并立即响应重要事件。

#### 验收标准

1. 当系统事件发生时，Event_Log 应当通过 WebSocket 连接实时显示它们
2. Event_Log 应当按类型分类事件（玩家操作、服务器事件、系统警报）
3. 当关键事件发生时，Web_Dashboard 应当向用户显示突出的通知
4. Event_Log 应当提供过滤选项以查看特定类型的事件
5. Event_Log 应当维护带时间戳的最近事件的可滚动历史记录

### 需求 7: 用户认证和访问控制

**用户故事:** 作为系统管理员，我希望有用户认证和基于角色的访问控制，以便我可以保护管理界面并控制用户权限。

#### 验收标准

1. 当访问 Web_Dashboard 时，Web_Dashboard 应当要求通过登录凭据进行用户认证
2. Web_Dashboard 应当与 Management_System 现有的认证系统集成
3. 当用户登录时，应当建立具有适当 Role_Permissions 的 User_Session
4. Web_Dashboard 应当根据用户分配的角色限制对功能的访问
5. 当会话过期时，Web_Dashboard 应当将用户重定向到登录页面

### 需求 8: API 集成层

**用户故事:** 作为开发者，我希望与现有 HTTP API 和 WebSocket 事件无缝集成，以便网页仪表板可以利用所有后端功能。

#### 验收标准

1. API_Client 应当与 Management_System HTTP API 通信以进行所有 CRUD 操作
2. WebSocket_Client 应当建立持久连接以进行实时数据更新
3. 当 API 请求失败时，Web_Dashboard 应当优雅地处理错误并显示用户友好的消息
4. Web_Dashboard 应当实现带加载状态的适当请求/响应处理
5. Web_Dashboard 应当维护 WebSocket 连接健康状况并在必要时自动重连

### 需求 9: 数据持久化和状态管理

**用户故事:** 作为用户，我希望仪表板记住我的偏好并维护状态，以便我在会话间有一致的体验。

#### 验收标准

1. Web_Dashboard 应当持久化用户偏好，如仪表板布局和过滤器设置
2. 当在页面间导航时，Web_Dashboard 应当维护相关的应用程序状态
3. Web_Dashboard 应当缓存频繁访问的数据以提高性能
4. 当浏览器刷新时，Web_Dashboard 应当恢复用户之前的视图状态
### 需求 10: 全版本连接器支持

**用户故事:** 作为系统管理员，我希望支持所有主流 Minecraft 服务器版本和平台，以便我可以统一管理不同类型的服务器。

#### 验收标准

1. Web_Dashboard 应当支持 Java 版服务器：Vanilla、Paper、Spigot、Bukkit、Fabric、Forge、NeoForge
2. Web_Dashboard 应当支持基岩版服务器：PMMP（PocketMine-MP）、Nukkit、LLBDS（LeviLamina Bedrock Dedicated Server）
3. 当配置 Forge 服务器时，Web_Dashboard 应当区分传统 Forge 和 NeoForge 并提供相应的配置选项
4. 当添加服务器时，Web_Dashboard 应当根据选择的服务器类型显示相应的连接器安装指南
5. Web_Dashboard 应当显示每个服务器的连接器状态和版本信息