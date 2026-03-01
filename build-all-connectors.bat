@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM Mochi-Link Connector Build Script for Windows
REM 大福连连接器Windows构建脚本
REM 
REM This script builds all connector plugins and mods for different Minecraft server types
REM 此脚本为不同类型的Minecraft服务器构建所有连接器插件和模组

echo ==========================================
echo Mochi-Link Connector Build Script
echo 大福连连接器构建脚本
echo ==========================================

REM Build output directory
set BUILD_DIR=.\build-output
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"

REM Function to print status messages
:print_status
echo [INFO] %~1
goto :eof

:print_success
echo [SUCCESS] %~1
goto :eof

:print_warning
echo [WARNING] %~1
goto :eof

:print_error
echo [ERROR] %~1
goto :eof

REM Function to build Java-based plugins
:build_java_plugin
set plugin_dir=%~1
set plugin_name=%~2

call :print_status "Building %plugin_name%..."

if not exist "%plugin_dir%" (
    call :print_warning "%plugin_dir% not found, skipping..."
    goto :eof
)

cd "%plugin_dir%"

if exist "pom.xml" (
    REM Maven build
    where mvn >nul 2>nul
    if !errorlevel! equ 0 (
        mvn clean package -q
        if !errorlevel! equ 0 (
            REM Copy built JAR to output directory
            for /r target %%f in (*.jar) do (
                if not "%%~nf"=="*-sources" (
                    copy "%%f" "..\%BUILD_DIR%\%plugin_name%.jar" >nul
                )
            )
            call :print_success "%plugin_name% built successfully"
        ) else (
            call :print_error "Failed to build %plugin_name%"
        )
    ) else (
        call :print_error "Maven not found, cannot build %plugin_name%"
    )
) else if exist "build.gradle" (
    REM Gradle build
    if exist "gradlew.bat" (
        gradlew.bat build -q
    ) else (
        where gradle >nul 2>nul
        if !errorlevel! equ 0 (
            gradle build -q
        ) else (
            call :print_error "Gradle not found, cannot build %plugin_name%"
            cd ..
            goto :eof
        )
    )
    
    if !errorlevel! equ 0 (
        REM Copy built JAR to output directory
        for /r build\libs %%f in (*.jar) do (
            if not "%%~nf"=="*-sources" (
                copy "%%f" "..\%BUILD_DIR%\%plugin_name%.jar" >nul
            )
        )
        call :print_success "%plugin_name% built successfully"
    ) else (
        call :print_error "Failed to build %plugin_name%"
    )
) else (
    call :print_warning "No build file found for %plugin_name%"
)

cd ..
goto :eof

REM Function to build Node.js/TypeScript plugins
:build_nodejs_plugin
set plugin_dir=%~1
set plugin_name=%~2

call :print_status "Building %plugin_name%..."

if not exist "%plugin_dir%" (
    call :print_warning "%plugin_dir% not found, skipping..."
    goto :eof
)

cd "%plugin_dir%"

if exist "package.json" (
    REM Node.js build
    where npm >nul 2>nul
    if !errorlevel! equ 0 (
        npm install --silent
        npm run build --silent
        if !errorlevel! equ 0 (
            REM Create plugin package
            mkdir "..\%BUILD_DIR%\%plugin_name%"
            xcopy /s /e /q dist\* "..\%BUILD_DIR%\%plugin_name%\" >nul
            copy package.json "..\%BUILD_DIR%\%plugin_name%\" >nul
            if exist "node_modules" xcopy /s /e /q node_modules "..\%BUILD_DIR%\%plugin_name%\node_modules\" >nul 2>nul
            call :print_success "%plugin_name% built successfully"
        ) else (
            call :print_error "Failed to build %plugin_name%"
        )
    ) else (
        call :print_error "npm not found, cannot build %plugin_name%"
    )
) else (
    call :print_warning "No package.json found for %plugin_name%"
)

cd ..
goto :eof

REM Function to build PHP plugins
:build_php_plugin
set plugin_dir=%~1
set plugin_name=%~2

call :print_status "Building %plugin_name%..."

if not exist "%plugin_dir%" (
    call :print_warning "%plugin_dir% not found, skipping..."
    goto :eof
)

REM For PHP plugins, we just copy the source files
mkdir "%BUILD_DIR%\%plugin_name%"
xcopy /s /e /q "%plugin_dir%\*" "%BUILD_DIR%\%plugin_name%\" >nul
call :print_success "%plugin_name% copied successfully"
goto :eof

REM Check dependencies
:check_dependencies
call :print_status "Checking build dependencies..."
call :print_status "检查构建依赖..."

set missing_deps=

REM Check for Java
where java >nul 2>nul
if !errorlevel! neq 0 (
    set missing_deps=!missing_deps! java
)

REM Check for Maven
where mvn >nul 2>nul
if !errorlevel! neq 0 (
    call :print_warning "Maven not found - Java plugins may not build"
    call :print_warning "未找到Maven - Java插件可能无法构建"
)

REM Check for Node.js
where node >nul 2>nul
if !errorlevel! neq 0 (
    call :print_warning "Node.js not found - LLBDS plugin may not build"
    call :print_warning "未找到Node.js - LLBDS插件可能无法构建"
)

REM Check for npm
where npm >nul 2>nul
if !errorlevel! neq 0 (
    call :print_warning "npm not found - LLBDS plugin may not build"
    call :print_warning "未找到npm - LLBDS插件可能无法构建"
)

if not "%missing_deps%"=="" (
    call :print_error "Missing required dependencies:%missing_deps%"
    call :print_error "缺少必需的依赖:%missing_deps%"
    exit /b 1
)

call :print_success "All required dependencies found"
call :print_success "找到所有必需的依赖"
goto :eof

REM Main build process
:main
call :print_status "Starting build process..."
call :print_status "开始构建过程..."

REM Build Java Edition plugins
call :print_status "Building Java Edition plugins..."
call :print_status "构建Java版插件..."

call :build_java_plugin "connectors\java" "MochiLinkConnector-Paper"
call :build_java_plugin "connectors\folia" "MochiLinkConnector-Folia"

REM Build Fabric mod
call :print_status "Building Fabric mod..."
call :print_status "构建Fabric模组..."

call :build_java_plugin "mochi-link-connector-fabric" "MochiLinkConnector-Fabric"

REM Build Forge mod
call :print_status "Building Forge mod..."
call :print_status "构建Forge模组..."

call :build_java_plugin "mochi-link-connector-forge" "MochiLinkConnector-Forge"

REM Build Bedrock Edition plugins
call :print_status "Building Bedrock Edition plugins..."
call :print_status "构建基岩版插件..."

call :build_nodejs_plugin "mochi-link-connector-llbds" "MochiLinkConnector-LLBDS"
call :build_java_plugin "mochi-link-connector-nukkit" "MochiLinkConnector-Nukkit"
call :build_php_plugin "mochi-link-connector-pmmp" "MochiLinkConnector-PMMP"

REM Create version info
call :print_status "Creating version information..."
(
echo Mochi-Link Connector Build Information
echo 大福连连接器构建信息
echo.
echo Build Date: %date% %time%
echo 构建日期: %date% %time%
echo.
echo Built Connectors:
echo 构建的连接器:
echo.
echo Java Edition ^(Java版^):
echo - Paper/Spigot: MochiLinkConnector-Paper.jar
echo - Folia: MochiLinkConnector-Folia.jar
echo.
echo Modded Java Edition ^(模组Java版^):
echo - Fabric: MochiLinkConnector-Fabric.jar
echo - Forge: MochiLinkConnector-Forge.jar
echo.
echo Bedrock Edition ^(基岩版^):
echo - LLBDS: MochiLinkConnector-LLBDS/
echo - Nukkit: MochiLinkConnector-Nukkit.jar
echo - PMMP: MochiLinkConnector-PMMP/
echo.
echo Installation Instructions:
echo 安装说明:
echo.
echo 1. Java Edition plugins ^(.jar files^):
echo    Java版插件 ^(.jar文件^):
echo    - Copy to your server's plugins/ directory
echo    - 复制到服务器的 plugins/ 目录
echo.
echo 2. Fabric/Forge mods ^(.jar files^):
echo    Fabric/Forge模组 ^(.jar文件^):
echo    - Copy to your server's mods/ directory
echo    - 复制到服务器的 mods/ 目录
echo.
echo 3. LLBDS plugin ^(directory^):
echo    LLBDS插件 ^(目录^):
echo    - Copy to your LLBDS plugins/ directory
echo    - 复制到LLBDS的 plugins/ 目录
echo.
echo 4. PMMP plugin ^(directory^):
echo    PMMP插件 ^(目录^):
echo    - Copy to your PMMP plugins/ directory
echo    - 复制到PMMP的 plugins/ 目录
echo.
echo Configuration:
echo 配置:
echo.
echo All connectors use similar configuration files. Please refer to the
echo main project documentation for detailed configuration instructions.
echo.
echo 所有连接器都使用类似的配置文件。详细配置说明请参考主项目文档。
) > "%BUILD_DIR%\VERSION.txt"

REM Create README
(
echo # Mochi-Link Connectors
echo # 大福连连接器
echo.
echo This directory contains all built connector plugins and mods for different Minecraft server types.
echo.
echo 此目录包含为不同类型Minecraft服务器构建的所有连接器插件和模组。
echo.
echo ## Supported Platforms / 支持的平台
echo.
echo ### Java Edition / Java版
echo - **Paper/Spigot**: Universal plugin for Paper, Spigot, and compatible servers
echo - **Folia**: Optimized plugin for Folia's multi-threaded architecture
echo.
echo ### Modded Java Edition / 模组Java版
echo - **Fabric**: Fabric mod for Fabric servers
echo - **Forge**: Forge mod for Forge servers
echo.
echo ### Bedrock Edition / 基岩版
echo - **LLBDS**: Plugin for LiteLoaderBDS servers
echo - **Nukkit**: Plugin for Nukkit servers
echo - **PMMP**: Plugin for PocketMine-MP servers
echo.
echo ## Installation / 安装
echo.
echo 1. Choose the appropriate connector for your server type
echo 2. Follow the installation instructions in VERSION.txt
echo 3. Configure the connector using the provided configuration files
echo 4. Restart your server
echo.
echo 1. 为您的服务器类型选择合适的连接器
echo 2. 按照VERSION.txt中的安装说明操作
echo 3. 使用提供的配置文件配置连接器
echo 4. 重启服务器
echo.
echo ## Support / 支持
echo.
echo For support and documentation, please visit:
echo 如需支持和文档，请访问:
echo.
echo - GitHub: https://github.com/chm413/Mochi-Link
echo - Issues: https://github.com/chm413/Mochi-Link/issues
) > "%BUILD_DIR%\README.md"

call :print_success "Build process completed!"
call :print_success "构建过程完成！"

call :print_status "Build output directory: %BUILD_DIR%"
call :print_status "构建输出目录: %BUILD_DIR%"

REM List built files
call :print_status "Built files:"
call :print_status "构建的文件:"
dir "%BUILD_DIR%"

goto :eof

REM Script entry point
if "%1"=="--help" goto :help
if "%1"=="-h" goto :help
if "%1"=="--check-deps" goto :check_only

call :check_dependencies
call :main
goto :end

:help
echo Usage: %0 [options]
echo 用法: %0 [选项]
echo.
echo Options:
echo 选项:
echo   --help, -h    Show this help message
echo   --help, -h    显示此帮助信息
echo   --check-deps  Check build dependencies only
echo   --check-deps  仅检查构建依赖
echo.
echo This script builds all Mochi-Link connector plugins and mods.
echo 此脚本构建所有大福连连接器插件和模组。
goto :end

:check_only
call :check_dependencies
goto :end

:end
pause