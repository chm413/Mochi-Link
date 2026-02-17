@echo off
REM Mochi-Link 打包脚本 (Windows)
REM 用于创建可分发的 npm 包

echo 🎁 Mochi-Link 打包脚本
echo =======================

REM 检查是否在项目根目录
if not exist "package.json" (
    echo ❌ 错误: 请在项目根目录运行此脚本
    exit /b 1
)

REM 清理旧的构建
echo 🧹 清理旧的构建...
if exist "lib\" rmdir /s /q lib
del /q *.tgz 2>nul

REM 安装依赖
echo 📦 安装依赖...
call npm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    exit /b 1
)

REM 构建项目
echo 🔨 构建项目...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    exit /b 1
)

REM 检查 lib 目录
if not exist "lib\" (
    echo ❌ 错误: lib 目录不存在，构建失败
    exit /b 1
)

REM 打包
echo 📦 打包...
call npm pack
if errorlevel 1 (
    echo ❌ 打包失败
    exit /b 1
)

REM 获取生成的文件名
for /f "delims=" %%i in ('dir /b /o-d *.tgz 2^>nul') do (
    set PACKAGE_FILE=%%i
    goto :found
)

:found
if "%PACKAGE_FILE%"=="" (
    echo ❌ 错误: 打包失败
    exit /b 1
)

echo.
echo ✅ 打包完成！
echo 📦 文件: %PACKAGE_FILE%
echo.
echo 📋 安装方法:
echo    npm install ./%PACKAGE_FILE%
echo.
echo 📤 分发方法:
echo    1. 将 %PACKAGE_FILE% 上传到服务器
echo    2. 在目标机器上运行: npm install ./%PACKAGE_FILE%
echo.

pause
