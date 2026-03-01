@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ========================================
REM Mochi-Link 连接器统一构建脚本
REM Unified Build Script for All Connectors
REM ========================================

echo ========================================
echo Mochi-Link Connector Build Script
echo 大福连连接器构建脚本
echo ========================================
echo.

REM 解析命令行参数
set BUILD_ALL=0
set BUILD_JAVA=0
set BUILD_FABRIC=0
set BUILD_FORGE=0
set BUILD_FOLIA=0
set BUILD_NUKKIT=0
set BUILD_LLBDS=0
set BUILD_PMMP=0
set COLLECT_ONLY=0
set USE_LOCAL_GRADLE=0

if "%1"=="" set BUILD_ALL=1
if "%1"=="--all" set BUILD_ALL=1
if "%1"=="--java" set BUILD_JAVA=1
if "%1"=="--fabric" set BUILD_FABRIC=1
if "%1"=="--forge" set BUILD_FORGE=1
if "%1"=="--folia" set BUILD_FOLIA=1
if "%1"=="--nukkit" set BUILD_NUKKIT=1
if "%1"=="--llbds" set BUILD_LLBDS=1
if "%1"=="--pmmp" set BUILD_PMMP=1
if "%1"=="--collect" set COLLECT_ONLY=1
if "%1"=="--help" goto :show_help
if "%1"=="-h" goto :show_help

if "%2"=="--local-gradle" set USE_LOCAL_GRADLE=1

REM 设置 Gradle
if %USE_LOCAL_GRADLE%==1 (
    set GRADLE_CMD=%~dp0gradle-8.8\bin\gradle
    echo [INFO] Using local Gradle 8.8
) else (
    set GRADLE_CMD=gradle
)

REM 创建输出目录
set OUTPUT_DIR=build-output
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM 如果只是收集，跳过构建
if %COLLECT_ONLY%==1 goto :collect_connectors

REM 检查依赖
call :check_dependencies

REM 构建连接器
if %BUILD_ALL%==1 (
    set BUILD_JAVA=1
    set BUILD_FABRIC=1
    set BUILD_FORGE=1
    set BUILD_FOLIA=1
    set BUILD_NUKKIT=1
    set BUILD_LLBDS=1
    set BUILD_PMMP=1
)

if %BUILD_JAVA%==1 call :build_java_connector
if %BUILD_FOLIA%==1 call :build_folia_connector
if %BUILD_NUKKIT%==1 call :build_nukkit_connector
if %BUILD_FABRIC%==1 call :build_fabric_connector
if %BUILD_FORGE%==1 call :build_forge_connector
if %BUILD_LLBDS%==1 call :build_llbds_connector
if %BUILD_PMMP%==1 call :build_pmmp_connector

REM 显示总结
call :show_summary

goto :end

REM ========================================
REM 函数定义
REM ========================================

:check_dependencies
echo [INFO] Checking dependencies...
where java >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java not found
    exit /b 1
)
where %GRADLE_CMD% >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Gradle not found, some builds may fail
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [WARNING] npm not found, LLBDS build will be skipped
)
echo [SUCCESS] Dependencies checked
echo.
goto :eof

:build_java_connector
echo [1/7] Building Java (Paper/Spigot) connector...
cd connectors\java
%GRADLE_CMD% clean build --no-daemon
set JAVA_RESULT=%errorlevel%
if %JAVA_RESULT%==0 (
    copy build\libs\*.jar ..\..\%OUTPUT_DIR%\ >nul 2>&1
    echo [SUCCESS] Java connector built
) else (
    echo [FAILED] Java connector build failed
)
cd ..\..
echo.
goto :eof

:build_folia_connector
echo [2/7] Building Folia connector...
cd connectors\folia
%GRADLE_CMD% clean build --no-daemon
set FOLIA_RESULT=%errorlevel%
if %FOLIA_RESULT%==0 (
    copy build\libs\*.jar ..\..\%OUTPUT_DIR%\ >nul 2>&1
    echo [SUCCESS] Folia connector built
) else (
    echo [FAILED] Folia connector build failed
)
cd ..\..
echo.
goto :eof

:build_nukkit_connector
echo [3/7] Building Nukkit connector...
cd connectors\nukkit
%GRADLE_CMD% clean build --no-daemon
set NUKKIT_RESULT=%errorlevel%
if %NUKKIT_RESULT%==0 (
    copy build\libs\*.jar ..\..\%OUTPUT_DIR%\ >nul 2>&1
    echo [SUCCESS] Nukkit connector built
) else (
    echo [FAILED] Nukkit connector build failed
)
cd ..\..
echo.
goto :eof

:build_fabric_connector
echo [4/7] Building Fabric connector...
cd connectors\fabric
%GRADLE_CMD% clean build --no-daemon
set FABRIC_RESULT=%errorlevel%
if %FABRIC_RESULT%==0 (
    copy build\libs\*.jar ..\..\%OUTPUT_DIR%\ >nul 2>&1
    echo [SUCCESS] Fabric connector built
) else (
    echo [FAILED] Fabric connector build failed
)
cd ..\..
echo.
goto :eof

:build_forge_connector
echo [5/7] Building Forge connector...
cd connectors\forge
%GRADLE_CMD% clean build --no-daemon
set FORGE_RESULT=%errorlevel%
if %FORGE_RESULT%==0 (
    copy build\libs\*.jar ..\..\%OUTPUT_DIR%\ >nul 2>&1
    echo [SUCCESS] Forge connector built
) else (
    echo [FAILED] Forge connector build failed
)
cd ..\..
echo.
goto :eof

:build_llbds_connector
echo [6/7] Building LLBDS connector...
where npm >nul 2>&1
if errorlevel 1 (
    echo [SKIPPED] npm not found
    set LLBDS_RESULT=1
    goto :eof
)
cd connectors\llbds
call npm install --silent
call npm run build
set LLBDS_RESULT=%errorlevel%
if %LLBDS_RESULT%==0 (
    if not exist "..\..\%OUTPUT_DIR%\llbds" mkdir "..\..\%OUTPUT_DIR%\llbds"
    xcopy /s /e /q dist\* "..\..\%OUTPUT_DIR%\llbds\" >nul
    copy package.json "..\..\%OUTPUT_DIR%\llbds\" >nul
    echo [SUCCESS] LLBDS connector built
) else (
    echo [FAILED] LLBDS connector build failed
)
cd ..\..
echo.
goto :eof

:build_pmmp_connector
echo [7/7] Copying PMMP connector...
if not exist "%OUTPUT_DIR%\pmmp" mkdir "%OUTPUT_DIR%\pmmp"
xcopy /s /e /q connectors\pmmp\* "%OUTPUT_DIR%\pmmp\" >nul
set PMMP_RESULT=0
echo [SUCCESS] PMMP connector copied
echo.
goto :eof

:collect_connectors
echo [INFO] Collecting built connectors...
set COLLECT_DIR=mochi-link-connectors
if exist "%COLLECT_DIR%" rmdir /s /q "%COLLECT_DIR%"

mkdir "%COLLECT_DIR%\java-edition\fabric"
mkdir "%COLLECT_DIR%\java-edition\forge"
mkdir "%COLLECT_DIR%\java-edition\paper-spigot"
mkdir "%COLLECT_DIR%\java-edition\folia"
mkdir "%COLLECT_DIR%\bedrock-edition\llbds"
mkdir "%COLLECT_DIR%\bedrock-edition\nukkit"
mkdir "%COLLECT_DIR%\bedrock-edition\pmmp"
mkdir "%COLLECT_DIR%\config-templates"

REM 复制构建产物
if exist "connectors\fabric\build\libs\*.jar" copy "connectors\fabric\build\libs\*.jar" "%COLLECT_DIR%\java-edition\fabric\" >nul
if exist "connectors\forge\build\libs\*.jar" copy "connectors\forge\build\libs\*.jar" "%COLLECT_DIR%\java-edition\forge\" >nul
if exist "connectors\java\build\libs\*.jar" copy "connectors\java\build\libs\*.jar" "%COLLECT_DIR%\java-edition\paper-spigot\" >nul
if exist "connectors\folia\build\libs\*.jar" copy "connectors\folia\build\libs\*.jar" "%COLLECT_DIR%\java-edition\folia\" >nul
if exist "connectors\llbds\dist" xcopy /s /e /q "connectors\llbds\dist\*" "%COLLECT_DIR%\bedrock-edition\llbds\" >nul
if exist "connectors\nukkit\build\libs\*.jar" copy "connectors\nukkit\build\libs\*.jar" "%COLLECT_DIR%\bedrock-edition\nukkit\" >nul
if exist "connectors\pmmp" xcopy /s /e /q "connectors\pmmp\*" "%COLLECT_DIR%\bedrock-edition\pmmp\" >nul
if exist "config-templates" xcopy /s /e /q "config-templates\*" "%COLLECT_DIR%\config-templates\" >nul

echo [SUCCESS] Connectors collected to: %COLLECT_DIR%
echo.
goto :end

:show_summary
echo ========================================
echo Build Summary
echo ========================================
if defined JAVA_RESULT (
    if %JAVA_RESULT%==0 (echo [✓] Java/Paper/Spigot) else (echo [✗] Java/Paper/Spigot)
)
if defined FOLIA_RESULT (
    if %FOLIA_RESULT%==0 (echo [✓] Folia) else (echo [✗] Folia)
)
if defined NUKKIT_RESULT (
    if %NUKKIT_RESULT%==0 (echo [✓] Nukkit) else (echo [✗] Nukkit)
)
if defined FABRIC_RESULT (
    if %FABRIC_RESULT%==0 (echo [✓] Fabric) else (echo [✗] Fabric)
)
if defined FORGE_RESULT (
    if %FORGE_RESULT%==0 (echo [✓] Forge) else (echo [✗] Forge)
)
if defined LLBDS_RESULT (
    if %LLBDS_RESULT%==0 (echo [✓] LLBDS) else (echo [✗] LLBDS)
)
if defined PMMP_RESULT (
    if %PMMP_RESULT%==0 (echo [✓] PMMP) else (echo [✗] PMMP)
)
echo ========================================
echo.
echo Output directory: %OUTPUT_DIR%
echo.
goto :eof

:show_help
echo Usage: %~nx0 [options]
echo.
echo Options:
echo   --all            Build all connectors (default)
echo   --java           Build Java (Paper/Spigot) connector only
echo   --folia          Build Folia connector only
echo   --nukkit         Build Nukkit connector only
echo   --fabric         Build Fabric connector only
echo   --forge          Build Forge connector only
echo   --llbds          Build LLBDS connector only
echo   --pmmp           Copy PMMP connector only
echo   --collect        Collect all built connectors (no build)
echo   --local-gradle   Use local Gradle 8.8
echo   --help, -h       Show this help message
echo.
echo Examples:
echo   %~nx0                    Build all connectors
echo   %~nx0 --java             Build Java connector only
echo   %~nx0 --fabric --forge   Build Fabric and Forge only
echo   %~nx0 --collect          Collect built connectors
echo.
goto :end

:end
pause
