# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-02-20

### Fixed
- 修复 yarn 安装时 `locales` 目录未包含的问题
- 确保多语言功能在所有安装方式下正常工作
- 更新 `package.json` 的 `files` 字段以包含语言文件

### Documentation
- 添加 `I18N_VERIFICATION_GUIDE.md` - 多语言功能验证指南
- 完善国际化相关文档

## [1.5.0] - 2026-02-20

### Added
- 完整的多语言支持（中文和英文）
- 37 个中文命令别名
- 完整的 U-WBP v2 协议实现
- 7 个平台连接器（Paper, Folia, Fabric, Forge, Nukkit, LLBDS, PMMP）

### Changed
- 简化插件架构，使用懒加载避免模块解析问题
- 优化数据库初始化流程
- 改进错误处理和日志记录

### Documentation
- 添加完整的部署指南
- 添加连接器构建文档
- 添加多语言实现文档

## [1.0.0] - 2026-02-19

### Added
- 初始版本发布
- 基础的服务器管理功能
- WebSocket 连接支持
- 数据库集成
- 命令系统

---

**注**: 版本号遵循语义化版本规范
- 主版本号：不兼容的 API 变更
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正
