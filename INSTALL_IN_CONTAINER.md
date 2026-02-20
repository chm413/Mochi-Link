# 在 Koishi 容器中安装插件

## 方法 1：从本地 .tgz 文件安装（推荐）

### 步骤 1：将打包文件复制到容器

在 Windows PowerShell 中执行：

```powershell
# 复制 .tgz 文件到容器的 /tmp 目录
docker cp koishi-plugin-mochi-link-1.5.0.tgz <container_name>:/tmp/
```

如果不知道容器名称，先查看运行中的容器：
```powershell
docker ps
```

### 步骤 2：在容器中安装

进入容器：
```bash
docker exec -it <container_name> /bin/sh
```

然后在容器中执行：
```bash
cd /koishi

# 卸载旧版本（如果存在）
yarn remove koishi-plugin-mochi-link

# 从本地文件安装
yarn add file:/tmp/koishi-plugin-mochi-link-1.5.0.tgz

# 或者使用 npm
npm install /tmp/koishi-plugin-mochi-link-1.5.0.tgz
```

### 步骤 3：重启 Koishi

```bash
# 退出容器
exit

# 重启容器
docker restart <container_name>
```

## 方法 2：从 GitHub 安装

### 前提条件
- 代码已推送到 GitHub
- 仓库是公开的或者容器有访问权限

### 安装命令

```bash
cd /koishi

# 从 GitHub 主分支安装
yarn add https://github.com/chm413/Mochi-Link

# 或者指定分支
yarn add https://github.com/chm413/Mochi-Link#main

# 或者指定 commit
yarn add https://github.com/chm413/Mochi-Link#<commit-hash>
```

## 方法 3：挂载本地目录（开发模式）

### 修改 docker-compose.yml

```yaml
services:
  koishi:
    volumes:
      - ./koishi:/koishi
      - E:/mc_nekobridge:/workspace/mochi-link  # 挂载插件目录
```

### 在容器中链接

```bash
cd /koishi
yarn add file:/workspace/mochi-link
```

## 验证安装

安装完成后，检查日志应该看到：

```
[I] mochi-link Starting Mochi-Link plugin...
[I] mochi-link Database initialized successfully
[I] mochi-link Service manager initialized successfully  # 这次应该成功
[I] mochi-link WebSocket server started on 0.0.0.0:8080
[I] mochi-link Mochi-Link plugin started successfully
```

## 如果仍然出现模块加载错误

### 清除 Node.js 缓存

```bash
cd /koishi

# 删除 node_modules
rm -rf node_modules

# 删除 yarn 缓存
yarn cache clean

# 重新安装所有依赖
yarn install

# 重新安装插件
yarn add file:/tmp/koishi-plugin-mochi-link-1.5.0.tgz
```

### 检查文件是否存在

```bash
# 检查插件目录
ls -la /koishi/node_modules/koishi-plugin-mochi-link/

# 检查 lib 目录
ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/

# 检查 database 目录
ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/database/

# 检查 operations.js 文件
ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/database/operations.js
```

## 快速安装脚本

创建一个脚本文件 `install-plugin.sh`：

```bash
#!/bin/sh

# 设置变量
CONTAINER_NAME="koishi"  # 修改为你的容器名称
PLUGIN_FILE="koishi-plugin-mochi-link-1.5.0.tgz"

# 复制文件到容器
echo "Copying plugin to container..."
docker cp $PLUGIN_FILE $CONTAINER_NAME:/tmp/

# 在容器中安装
echo "Installing plugin in container..."
docker exec -it $CONTAINER_NAME sh -c "
  cd /koishi && \
  yarn remove koishi-plugin-mochi-link 2>/dev/null || true && \
  yarn add file:/tmp/$PLUGIN_FILE && \
  echo 'Plugin installed successfully'
"

# 重启容器
echo "Restarting container..."
docker restart $CONTAINER_NAME

echo "Done! Check logs with: docker logs -f $CONTAINER_NAME"
```

在 Windows PowerShell 中运行：
```powershell
# 给脚本执行权限（如果在 WSL 中）
chmod +x install-plugin.sh

# 运行脚本
./install-plugin.sh
```

或者直接在 PowerShell 中执行：

```powershell
# 设置变量
$CONTAINER_NAME = "koishi"  # 修改为你的容器名称
$PLUGIN_FILE = "koishi-plugin-mochi-link-1.5.0.tgz"

# 复制文件
docker cp $PLUGIN_FILE ${CONTAINER_NAME}:/tmp/

# 安装插件
docker exec -it $CONTAINER_NAME sh -c "cd /koishi && yarn remove koishi-plugin-mochi-link; yarn add file:/tmp/$PLUGIN_FILE"

# 重启容器
docker restart $CONTAINER_NAME

# 查看日志
docker logs -f $CONTAINER_NAME
```

## 常见问题

### Q: 找不到容器名称
A: 运行 `docker ps` 查看所有运行中的容器

### Q: 权限被拒绝
A: 确保 Docker 有权限访问文件，或者使用 `sudo`

### Q: yarn 命令不存在
A: 使用 `npm` 代替：
```bash
npm install /tmp/koishi-plugin-mochi-link-1.5.0.tgz
```

### Q: 安装后仍然报错
A: 尝试完全重建容器：
```bash
docker-compose down
docker-compose up -d
```

## 下一步

安装成功后：

1. 使用 `mochi.server.add` 注册服务器
2. 使用 `mochi.bind.add` 绑定到群组
3. 在 Minecraft 服务器上安装对应的 Connector Bridge
4. 配置 Bridge 连接到 Koishi 的 WebSocket 服务器（默认端口 8080）

---

**提示**: 如果你的 Koishi 不是运行在 Docker 容器中，而是直接安装的，可以直接在 Koishi 目录中运行：
```bash
yarn add file:/path/to/koishi-plugin-mochi-link-1.5.0.tgz
```
