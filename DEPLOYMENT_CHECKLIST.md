# Koishi 插件部署检查清单
# Deployment Checklist for Koishi Plugin

## 📋 准备发布前的检查清单

### 1. ✅ 代码准备

- [ ] 所有功能已完成并测试
- [ ] 所有测试通过 (`npm test`)
- [ ] 代码已通过 lint 检查 (`npm run lint`)
- [ ] TypeScript 编译无错误 (`npm run build`)
- [ ] 文档已更新

### 2. ✅ 版本管理

- [ ] 更新 `package.json` 中的版本号
- [ ] 更新 `CHANGELOG.md`（如果有）
- [ ] 创建 Git 标签

```bash
# 更新版本
npm version patch  # 或 minor, major

# 创建标签
git tag v1.0.0
git push origin v1.0.0
```

### 3. ✅ 构建和提交

- [ ] 运行构建命令
- [ ] 确认 `lib/` 目录已生成
- [ ] 提交编译后的代码

```bash
# 构建
npm run build

# 检查 lib 目录
ls -la lib/

# 提交
git add lib/
git commit -m "chore: add compiled files for v1.0.0"
git push
```

### 4. ✅ GitHub 配置

- [ ] `.gitignore` 中 `lib/` 已取消忽略
- [ ] GitHub Actions 工作流已配置（可选）
- [ ] README.md 包含安装说明
- [ ] LICENSE 文件存在

### 5. ✅ package.json 检查

- [ ] `name` 字段正确
- [ ] `version` 字段已更新
- [ ] `main` 字段指向 `lib/index.js`
- [ ] `typings` 字段指向 `lib/index.d.ts`
- [ ] `files` 字段包含 `lib`
- [ ] `repository` 字段正确
- [ ] `keywords` 字段完整
- [ ] `peerDependencies` 正确

```json
{
  "name": "koishi-plugin-mochi-link",
  "version": "1.0.0",
  "main": "lib/index.js",
  "typings": "lib/index.d.ts",
  "files": [
    "lib",
    "readme.md"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/chm413/Mochi-Link.git"
  }
}
```

### 6. ✅ 文档完整性

- [ ] README.md 包含：
  - [ ] 项目简介
  - [ ] 安装说明（npm 和 GitHub）
  - [ ] 配置示例
  - [ ] 使用说明
  - [ ] API 文档（如果需要）
- [ ] KOISHI_INSTALLATION_GUIDE.md 存在
- [ ] QUICK_INSTALL.md 存在
- [ ] LICENSE 文件存在

### 7. ✅ 测试安装

#### 测试本地安装

```bash
# 在测试项目中
npm install file:../Mochi-Link

# 验证安装
npm list koishi-plugin-mochi-link

# 测试运行
npx koishi start
```

#### 测试 GitHub 安装

```bash
# 在测试项目中
npm install git+https://github.com/chm413/Mochi-Link.git

# 验证安装
npm list koishi-plugin-mochi-link

# 测试运行
npx koishi start
```

### 8. ✅ 功能验证

- [ ] 插件可以正常加载
- [ ] 配置文件可以正确解析
- [ ] 核心功能正常工作
- [ ] WebSocket 连接正常
- [ ] HTTP API 正常响应
- [ ] 数据库操作正常

### 9. ✅ 性能检查

- [ ] 内存使用合理
- [ ] CPU 使用合理
- [ ] 无内存泄漏
- [ ] 响应时间可接受

### 10. ✅ 安全检查

- [ ] 无硬编码的密钥或密码
- [ ] 敏感配置使用环境变量
- [ ] 依赖包无已知漏洞 (`npm audit`)
- [ ] 输入验证完整

---

## 🚀 发布流程

### 方案 A: GitHub Only（当前）

```bash
# 1. 更新版本
npm version patch

# 2. 构建
npm run build

# 3. 提交
git add .
git commit -m "chore: release v1.0.0"
git push

# 4. 创建标签
git tag v1.0.0
git push origin v1.0.0

# 5. 创建 GitHub Release（可选）
# 在 GitHub 网页上创建 Release，附加说明
```

### 方案 B: 发布到 npm（未来）

```bash
# 1. 登录 npm
npm login

# 2. 发布
npm publish

# 3. 验证
npm info koishi-plugin-mochi-link
```

---

## 📝 发布后

### 1. 通知用户

- [ ] 更新 README.md 的安装说明
- [ ] 在 GitHub Releases 中发布说明
- [ ] 在相关社区发布公告

### 2. 监控

- [ ] 检查 GitHub Issues
- [ ] 监控安装错误
- [ ] 收集用户反馈

### 3. 维护

- [ ] 及时修复 bug
- [ ] 定期更新依赖
- [ ] 响应用户问题

---

## 🔧 自动化脚本

### 发布脚本

创建 `scripts/release.sh`:

```bash
#!/bin/bash

# 发布脚本
set -e

echo "🚀 Starting release process..."

# 1. 检查工作目录是否干净
if [[ -n $(git status -s) ]]; then
  echo "❌ Working directory is not clean. Please commit or stash changes."
  exit 1
fi

# 2. 运行测试
echo "🧪 Running tests..."
npm test

# 3. 运行 lint
echo "🔍 Running lint..."
npm run lint

# 4. 构建
echo "🔨 Building..."
npm run build

# 5. 询问版本类型
echo "📦 Select version bump type:"
echo "1) patch (1.0.0 -> 1.0.1)"
echo "2) minor (1.0.0 -> 1.1.0)"
echo "3) major (1.0.0 -> 2.0.0)"
read -p "Enter choice [1-3]: " choice

case $choice in
  1) VERSION_TYPE="patch";;
  2) VERSION_TYPE="minor";;
  3) VERSION_TYPE="major";;
  *) echo "Invalid choice"; exit 1;;
esac

# 6. 更新版本
echo "📝 Updating version..."
npm version $VERSION_TYPE

# 7. 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version")

# 8. 提交
echo "💾 Committing..."
git add .
git commit -m "chore: release v$NEW_VERSION" --allow-empty

# 9. 创建标签
echo "🏷️  Creating tag..."
git tag "v$NEW_VERSION"

# 10. 推送
echo "⬆️  Pushing to remote..."
git push
git push origin "v$NEW_VERSION"

echo "✅ Release v$NEW_VERSION completed!"
echo "📝 Don't forget to create a GitHub Release!"
```

使用方法：

```bash
chmod +x scripts/release.sh
./scripts/release.sh
```

---

## 🆘 常见问题

### Q: lib/ 目录应该提交吗？

A: 对于从 GitHub 安装的插件，**必须**提交 `lib/` 目录。确保：
1. `.gitignore` 中 `lib/` 已注释掉
2. 运行 `npm run build` 生成 `lib/`
3. 提交 `lib/` 目录

### Q: 如何自动构建？

A: 使用 GitHub Actions：
1. 创建 `.github/workflows/build.yml`
2. 配置自动构建和提交
3. 推送代码后自动构建

### Q: 如何测试安装？

A: 在另一个目录创建测试项目：

```bash
mkdir test-install
cd test-install
npm init -y
npm install koishi
npm install git+https://github.com/chm413/Mochi-Link.git
```

### Q: 版本号如何管理？

A: 遵循语义化版本：
- **patch** (1.0.0 -> 1.0.1): Bug 修复
- **minor** (1.0.0 -> 1.1.0): 新功能，向后兼容
- **major** (1.0.0 -> 2.0.0): 破坏性变更

---

## ✅ 最终检查

在发布前，确认：

- [x] ✅ 代码已构建 (`npm run build`)
- [x] ✅ 测试已通过 (`npm test`)
- [x] ✅ `lib/` 目录已提交
- [x] ✅ 版本号已更新
- [x] ✅ Git 标签已创建
- [x] ✅ 文档已更新
- [x] ✅ 安装测试通过

**准备就绪！** 🎉

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-16
