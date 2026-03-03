# Mochi-Link 权限系统文档导航

## 📚 文档概览

本目录包含 Mochi-Link 权限管理系统的完整文档。根据您的需求选择合适的文档：

## 🎯 快速开始

### 我是新用户，想快速了解
👉 **[快速参考](PERMISSION_QUICK_REFERENCE.md)**
- 角色速查表
- 命令速查表
- 常用场景示例
- 1 页纸搞定基础操作

### 我想学习如何使用命令
👉 **[命令使用指南](PERMISSION_COMMANDS_GUIDE.md)**
- 详细的命令说明
- 完整的参数解释
- 丰富的使用示例
- 常见问题解答

### 我想了解技术实现
👉 **[实现报告](PERMISSION_SYSTEM_IMPLEMENTATION.md)**
- 系统架构设计
- 代码实现细节
- API 接口说明
- 技术决策说明

### 我想查看 API 规范
👉 **[API 接口文档](wiki/API接口文档.md)**
- WebSocket 协议规范
- HTTP REST API（预留）
- 完整的数据模型
- 错误码参考

### 我想查看完成状态
👉 **[完成总结](PERMISSION_SYSTEM_COMPLETE.md)**
- 已完成功能清单
- 功能统计数据
- 测试建议
- 待办事项

## 📖 文档详情

### 1. 快速参考 (PERMISSION_QUICK_REFERENCE.md)
**适合**: 所有用户  
**阅读时间**: 5 分钟  
**内容**:
- 角色速查表
- 命令速查表
- 权限矩阵
- 常用场景
- WebSocket 操作示例
- 错误代码速查

### 2. 命令使用指南 (PERMISSION_COMMANDS_GUIDE.md)
**适合**: 管理员、服务器所有者  
**阅读时间**: 15 分钟  
**内容**:
- 命令列表和说明
- 详细的参数解释
- 完整的使用示例
- 常见使用场景
- 错误处理方法
- 最佳实践建议

### 3. 实现报告 (PERMISSION_SYSTEM_IMPLEMENTATION.md)
**适合**: 开发者、技术人员  
**阅读时间**: 30 分钟  
**内容**:
- 系统设计概述
- 新增功能详情
- 代码修改清单
- WebSocket API 接口
- 使用示例
- 后续工作建议

### 4. API 接口文档 (wiki/API接口文档.md)
**适合**: 开发者、集成人员  
**阅读时间**: 60 分钟  
**内容**:
- U-WBP v2 协议规范
- WebSocket 操作定义
- HTTP REST API（预留）
- 完整的数据模型
- 错误处理机制
- 认证与权限系统

### 5. 完成总结 (PERMISSION_SYSTEM_COMPLETE.md)
**适合**: 项目管理者、开发者  
**阅读时间**: 10 分钟  
**内容**:
- 已完成功能清单
- 功能统计数据
- 核心特性说明
- 安全特性
- 测试建议
- 待办事项

## 🎓 学习路径

### 路径 1: 用户学习路径
```
快速参考 → 命令使用指南 → 实践操作
```
适合：服务器管理员、运维人员

### 路径 2: 开发者学习路径
```
实现报告 → API 接口文档 → 代码阅读
```
适合：开发者、技术人员

### 路径 3: 快速上手路径
```
快速参考 → 实践操作 → 遇到问题查阅详细文档
```
适合：有经验的用户

## 🔍 按需查找

### 我想知道...

#### 如何授予权限？
- 📖 [命令使用指南 - 授予权限](PERMISSION_COMMANDS_GUIDE.md#2-授予权限)
- 📋 [快速参考 - 命令速查](PERMISSION_QUICK_REFERENCE.md#命令速查)

#### 有哪些角色？
- 📖 [命令使用指南 - 角色说明](PERMISSION_COMMANDS_GUIDE.md#角色说明)
- 📋 [快速参考 - 角色速查](PERMISSION_QUICK_REFERENCE.md#角色速查)

#### 如何查询权限？
- 📖 [命令使用指南 - 查询权限](PERMISSION_COMMANDS_GUIDE.md#5-查询权限)
- 📋 [快速参考 - 基础命令](PERMISSION_QUICK_REFERENCE.md#基础命令)

#### WebSocket 如何调用？
- 🌐 [API 接口文档 - WebSocket 接口](wiki/API接口文档.md#websocket-实时接口)
- 📋 [快速参考 - WebSocket 操作](PERMISSION_QUICK_REFERENCE.md#websocket-操作速查)

#### 遇到错误怎么办？
- 📖 [命令使用指南 - 错误处理](PERMISSION_COMMANDS_GUIDE.md#错误处理)
- 📋 [快速参考 - 错误代码](PERMISSION_QUICK_REFERENCE.md#错误代码速查)

#### 系统如何实现的？
- 📄 [实现报告](PERMISSION_SYSTEM_IMPLEMENTATION.md)
- 🌐 [API 接口文档](wiki/API接口文档.md)

## 💡 使用建议

### 首次使用
1. 阅读 [快速参考](PERMISSION_QUICK_REFERENCE.md) 了解基础
2. 查看 [命令使用指南](PERMISSION_COMMANDS_GUIDE.md) 学习详细用法
3. 参考常用场景进行实践

### 日常使用
1. 使用 [快速参考](PERMISSION_QUICK_REFERENCE.md) 作为速查表
2. 遇到问题查阅 [命令使用指南](PERMISSION_COMMANDS_GUIDE.md)
3. 复杂场景参考示例代码

### 开发集成
1. 阅读 [实现报告](PERMISSION_SYSTEM_IMPLEMENTATION.md) 了解架构
2. 查看 [API 接口文档](wiki/API接口文档.md) 了解接口
3. 参考代码示例进行集成

## 📝 文档更新

### 版本历史
- **v2.0.0** (2024-01-01) - 初始版本
  - 完整的权限系统实现
  - 6 个角色定义
  - 完整的命令接口
  - WebSocket API 接口

### 更新计划
- [ ] 添加视频教程
- [ ] 添加交互式示例
- [ ] 添加故障排查指南
- [ ] 添加性能优化指南

## 🤝 贡献

### 文档改进
如果您发现文档中的错误或有改进建议：
1. 提交 Issue 说明问题
2. 提交 Pull Request 修改文档
3. 在社区讨论中提出建议

### 示例贡献
欢迎贡献更多使用示例：
1. 实际使用场景
2. 最佳实践案例
3. 常见问题解决方案

## 📞 获取帮助

### 文档问题
- 查看 [命令使用指南 - 错误处理](PERMISSION_COMMANDS_GUIDE.md#错误处理)
- 查看 [快速参考 - 错误代码](PERMISSION_QUICK_REFERENCE.md#错误代码速查)

### 技术支持
- GitHub Issues
- 社区论坛
- 技术文档

### 反馈渠道
- 文档改进建议
- 功能需求反馈
- Bug 报告

## 🎯 文档目标

### 易用性
- ✅ 清晰的结构
- ✅ 丰富的示例
- ✅ 友好的语言
- ✅ 快速查找

### 完整性
- ✅ 覆盖所有功能
- ✅ 详细的说明
- ✅ 完整的参考
- ✅ 实用的示例

### 可维护性
- ✅ 模块化组织
- ✅ 版本控制
- ✅ 更新记录
- ✅ 贡献指南

## 📊 文档统计

- **文档数量**: 5 个
- **总字数**: 约 15,000 字
- **代码示例**: 50+ 个
- **使用场景**: 10+ 个
- **命令说明**: 6 个
- **角色定义**: 6 个

## 🎉 开始使用

选择适合您的文档开始学习：

- 🚀 **快速上手**: [快速参考](PERMISSION_QUICK_REFERENCE.md)
- 📖 **详细学习**: [命令使用指南](PERMISSION_COMMANDS_GUIDE.md)
- 🔧 **技术深入**: [实现报告](PERMISSION_SYSTEM_IMPLEMENTATION.md)
- 🌐 **API 集成**: [API 接口文档](wiki/API接口文档.md)
- ✅ **查看进度**: [完成总结](PERMISSION_SYSTEM_COMPLETE.md)

---

**文档版本**: 2.0.0  
**最后更新**: 2024-01-01  
**维护者**: Mochi-Link 开发团队
