# Mochi-Link 插件安装脚本
# 用于将插件安装到 Koishi 容器中

param(
    [string]$ContainerName = "koishi",
    [string]$PluginFile = "koishi-plugin-mochi-link-1.5.0.tgz"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Mochi-Link 插件安装脚本" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 检查插件文件是否存在
if (-not (Test-Path $PluginFile)) {
    Write-Host "错误: 找不到插件文件 $PluginFile" -ForegroundColor Red
    Write-Host "正在打包插件..." -ForegroundColor Yellow
    npm pack
    if ($LASTEXITCODE -ne 0) {
        Write-Host "打包失败！" -ForegroundColor Red
        exit 1
    }
    Write-Host "打包成功！" -ForegroundColor Green
}

# 检查 Docker 是否可用
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker 不可用"
    }
} catch {
    Write-Host "错误: Docker 不可用或未运行" -ForegroundColor Red
    Write-Host "请确保 Docker Desktop 已启动" -ForegroundColor Yellow
    exit 1
}

# 检查容器是否存在
Write-Host "检查容器 '$ContainerName'..." -ForegroundColor Yellow
$containerExists = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$ContainerName$"
if (-not $containerExists) {
    Write-Host "错误: 找不到容器 '$ContainerName'" -ForegroundColor Red
    Write-Host "可用的容器:" -ForegroundColor Yellow
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    exit 1
}

# 检查容器是否运行
$containerRunning = docker ps --format "{{.Names}}" | Select-String -Pattern "^$ContainerName$"
if (-not $containerRunning) {
    Write-Host "容器 '$ContainerName' 未运行，正在启动..." -ForegroundColor Yellow
    docker start $ContainerName
    Start-Sleep -Seconds 3
}

Write-Host "容器状态: 运行中" -ForegroundColor Green
Write-Host ""

# 步骤 1: 复制插件文件到容器
Write-Host "步骤 1/4: 复制插件文件到容器..." -ForegroundColor Cyan
docker cp $PluginFile ${ContainerName}:/tmp/
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 复制文件失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 文件复制成功" -ForegroundColor Green
Write-Host ""

# 步骤 2: 卸载旧版本
Write-Host "步骤 2/4: 卸载旧版本..." -ForegroundColor Cyan
docker exec $ContainerName sh -c "cd /koishi && (yarn remove koishi-plugin-mochi-link 2>/dev/null || true)"
Write-Host "✓ 旧版本已卸载" -ForegroundColor Green
Write-Host ""

# 步骤 3: 安装新版本
Write-Host "步骤 3/4: 安装新版本..." -ForegroundColor Cyan
docker exec $ContainerName sh -c "cd /koishi && yarn add file:/tmp/$PluginFile"
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 安装失败" -ForegroundColor Red
    Write-Host "尝试使用 npm 安装..." -ForegroundColor Yellow
    docker exec $ContainerName sh -c "cd /koishi && npm install /tmp/$PluginFile"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: npm 安装也失败了" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ 插件安装成功" -ForegroundColor Green
Write-Host ""

# 步骤 4: 验证安装
Write-Host "步骤 4/4: 验证安装..." -ForegroundColor Cyan
$verifyResult = docker exec $ContainerName sh -c "ls -la /koishi/node_modules/koishi-plugin-mochi-link/lib/database/operations.js 2>&1"
if ($verifyResult -match "operations.js") {
    Write-Host "✓ 文件验证成功" -ForegroundColor Green
} else {
    Write-Host "⚠ 警告: 无法验证文件" -ForegroundColor Yellow
    Write-Host $verifyResult
}
Write-Host ""

# 重启容器
Write-Host "重启容器以应用更改..." -ForegroundColor Cyan
docker restart $ContainerName
Write-Host "✓ 容器已重启" -ForegroundColor Green
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "查看日志:" -ForegroundColor Yellow
Write-Host "  docker logs -f $ContainerName" -ForegroundColor White
Write-Host ""
Write-Host "预期日志输出:" -ForegroundColor Yellow
Write-Host "  [I] mochi-link Starting Mochi-Link plugin..." -ForegroundColor Gray
Write-Host "  [I] mochi-link Database initialized successfully" -ForegroundColor Gray
Write-Host "  [I] mochi-link Service manager initialized successfully" -ForegroundColor Gray
Write-Host "  [I] mochi-link WebSocket server started on 0.0.0.0:8080" -ForegroundColor Gray
Write-Host "  [I] mochi-link Mochi-Link plugin started successfully" -ForegroundColor Gray
Write-Host ""

# 询问是否查看日志
$response = Read-Host "是否立即查看日志? (Y/n)"
if ($response -eq "" -or $response -eq "Y" -or $response -eq "y") {
    Write-Host ""
    Write-Host "按 Ctrl+C 退出日志查看" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    docker logs -f $ContainerName
}
