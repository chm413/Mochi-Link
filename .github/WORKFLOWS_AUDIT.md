# GitHub Actions 工作流审计报告

## 工作流概览

项目当前有 **2 个工作流文件**：

1. `build-connectors.yml` - 连接器构建工作流
2. `release.yml` - 发布工作流

---

## 1. build-connectors.yml

### 触发条件
✅ **正确** - 多种触发方式，无重复
- `push` - 推送到 main/master/develop 分支，且修改了 connectors/** 或工作流文件本身
- `pull_request` - PR 到主要分支，且修改了 connectors/**
- `workflow_dispatch` - 手动触发
- `workflow_call` - 被其他工作流调用（用于 release.yml）

### 构建任务

#### ✅ build-java-connectors (Matrix 策略)
- **连接器**: java, folia, nukkit
- **环境**: Ubuntu + Java 17
- **构建工具**: Gradle
- **产物**: JAR 文件
- **保留期**: 30 天
- **问题**: 使用 `continue-on-error: true` + `if: success()` 组合
  - ⚠️ **潜在问题**: 如果构建失败，不会上传产物，但也不会报错
  - 💡 **建议**: 移除 `continue-on-error` 或改为 `if: always()`

#### ✅ build-fabric
- **连接器**: Fabric
- **环境**: Ubuntu + Java 17
- **构建工具**: Gradle
- **产物**: JAR 文件
- **保留期**: 30 天
- **问题**: 同上

#### ✅ build-forge
- **连接器**: Forge
- **环境**: Ubuntu + Java 17
- **构建工具**: Gradle
- **产物**: JAR 文件
- **保留期**: 30 天
- **问题**: 同上

#### ✅ build-llbds
- **连接器**: LLBDS
- **环境**: Ubuntu + Node.js 18
- **构建工具**: npm + TypeScript
- **产物**: dist/ 目录 + package.json
- **保留期**: 30 天
- **状态**: ✅ 已修复（使用 npm install 而非 npm ci）

#### ✅ build-pmmp
- **连接器**: PMMP
- **环境**: Ubuntu
- **操作**: 复制源代码
- **产物**: 完整源代码目录
- **保留期**: 30 天

#### ✅ create-release-package
- **依赖**: 所有构建任务
- **触发条件**: 仅在推送到 main/master 时
- **功能**: 
  - 下载所有产物
  - 创建版本信息
  - 创建 README
  - 上传统一包（保留 90 天）
  - 尝试提交产物到仓库（可能失败，使用 continue-on-error）

---

## 2. release.yml

### 触发条件
✅ **正确** - 无重复
- `push` - 推送版本标签（v*.*.*）
- `workflow_dispatch` - 手动触发

### 发布任务

#### ✅ build-connectors
- **类型**: 工作流调用
- **调用**: build-connectors.yml
- **目的**: 复用构建逻辑，避免重复

#### ✅ create-release
- **依赖**: build-connectors
- **功能**:
  1. 确定版本号（从标签或 package.json）
  2. 下载所有构建产物
  3. 组织和重命名文件
  4. 打包 LLBDS 和 PMMP（tar.gz）
  5. 重命名 JAR 文件（添加版本号）
  6. 创建版本信息文件
  7. 创建 README
  8. 生成更新日志
  9. 创建 GitHub Release
  10. 上传所有文件

---

## 问题和建议

### ⚠️ 问题 1: continue-on-error + if: success() 组合
**位置**: build-connectors.yml 中的 Java 构建任务

**问题**:
```yaml
- name: Build with Gradle
  run: gradle build
  continue-on-error: true

- name: Upload artifacts
  if: success()  # 这个条件永远不会满足，因为上一步允许失败
```

**影响**: 如果构建失败，产物不会上传，但工作流显示成功

**建议**:
```yaml
# 选项 1: 移除 continue-on-error，让构建失败时工作流失败
- name: Build with Gradle
  run: gradle build

- name: Upload artifacts
  if: success()

# 选项 2: 改为 always() 以便即使构建失败也上传（如果有部分产物）
- name: Build with Gradle
  run: gradle build
  continue-on-error: true

- name: Upload artifacts
  if: always()
```

### ⚠️ 问题 2: 文件重命名逻辑可能不准确
**位置**: release.yml 的文件重命名步骤

**问题**:
```bash
if [[ "$jar" == *"java"* ]]; then
  mv "$jar" "MochiLink-java-${{ steps.version.outputs.version }}.jar"
```

**影响**: 如果 JAR 文件名不包含预期的关键字，重命名会失败

**建议**: 使用更可靠的命名约定或从 artifact 名称推断

### ✅ 优点 3: 工作流复用
**位置**: release.yml 调用 build-connectors.yml

**优点**:
- 单一构建逻辑来源
- 避免代码重复
- 易于维护

### ⚠️ 问题 4: 自动提交产物
**位置**: build-connectors.yml 的最后一步

**问题**:
```yaml
- name: Commit artifacts (if changed)
  uses: stefanzweifel/git-auto-commit-action@v5
  with:
    file_pattern: "connectors/**/build/libs/*.jar connectors/llbds/dist/**"
```

**影响**: 
- 会将构建产物提交到仓库
- 可能导致仓库体积快速增长
- 通常不推荐将构建产物提交到 Git

**建议**: 
- 移除此步骤
- 只通过 GitHub Releases 分发构建产物
- 或使用 Git LFS 管理大文件

---

## 总体评估

### ✅ 优点
1. **结构清晰**: 两个工作流职责明确
2. **无重复**: 使用 workflow_call 避免重复
3. **并行构建**: 使用 matrix 策略加速构建
4. **完整覆盖**: 支持所有连接器类型
5. **自动化**: 从构建到发布全自动

### ⚠️ 需要改进
1. **错误处理**: continue-on-error 的使用需要优化
2. **文件命名**: 重命名逻辑需要更健壮
3. **产物管理**: 考虑移除自动提交产物的步骤
4. **缓存优化**: 可以添加更多缓存以加速构建

### 📊 统计
- **工作流文件**: 2 个
- **构建任务**: 6 个（3 Java + 1 Fabric + 1 Forge + 1 LLBDS + 1 PMMP）
- **总步骤数**: 约 40 个
- **重复代码**: 最小化（通过 workflow_call）
- **触发方式**: 4 种（push, pull_request, workflow_dispatch, workflow_call）

---

## 建议的优化

### 优先级 1: 修复错误处理
```yaml
# 在 build-connectors.yml 中
- name: Build with Gradle
  working-directory: connectors/${{ matrix.connector }}
  run: |
    if [ -f "gradlew" ]; then
      ./gradlew build --no-daemon --warning-mode all
    else
      gradle build --no-daemon --warning-mode all
    fi
  # 移除 continue-on-error: true

- name: Upload artifacts
  if: success()  # 现在这个条件有意义了
  uses: actions/upload-artifact@v4
```

### 优先级 2: 移除自动提交产物
```yaml
# 删除或注释掉这一步
# - name: Commit artifacts (if changed)
#   uses: stefanzweifel/git-auto-commit-action@v5
```

### 优先级 3: 改进文件重命名
```yaml
# 在 release.yml 中使用更可靠的方法
- name: Organize release files
  run: |
    mkdir -p release-package
    
    # 使用 artifact 名称而非文件名模式匹配
    [ -d "release-artifacts/java-connector" ] && \
      cp release-artifacts/java-connector/*.jar \
      release-package/MochiLink-java-${{ steps.version.outputs.version }}.jar
    
    [ -d "release-artifacts/folia-connector" ] && \
      cp release-artifacts/folia-connector/*.jar \
      release-package/MochiLink-folia-${{ steps.version.outputs.version }}.jar
    # ... 等等
```

---

## 结论

✅ **总体状态**: 良好
- 工作流结构合理，无明显重复
- 使用了现代 GitHub Actions 最佳实践
- 自动化程度高

⚠️ **需要注意**:
- 错误处理逻辑需要优化
- 考虑移除自动提交产物的功能
- 文件重命名逻辑可以更健壮

📝 **建议**: 实施优先级 1 和 2 的优化，以提高工作流的可靠性和可维护性。
