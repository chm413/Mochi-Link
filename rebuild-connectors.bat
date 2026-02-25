@echo off
echo ========================================
echo 重新编译 Mochi-Link 连接器
echo ========================================
echo.

echo [1/3] 编译 Java 连接器...
cd mochi-link-connector-java
call gradle clean build shadowJar
if %ERRORLEVEL% NEQ 0 (
    echo 错误: Java 连接器编译失败
    cd ..
    pause
    exit /b 1
)
cd ..
echo Java 连接器编译完成
echo.

echo [2/3] 编译 Folia 连接器...
cd mochi-link-connector-folia
call gradle clean build shadowJar
if %ERRORLEVEL% NEQ 0 (
    echo 错误: Folia 连接器编译失败
    cd ..
    pause
    exit /b 1
)
cd ..
echo Folia 连接器编译完成
echo.

echo [3/3] 复制到 build-output 目录...
if not exist build-output mkdir build-output

copy /Y mochi-link-connector-java\build\libs\*.jar build-output\
copy /Y mochi-link-connector-folia\build\libs\*.jar build-output\

echo.
echo ========================================
echo 编译完成！
echo ========================================
echo.
echo 输出文件位于 build-output\ 目录
echo.
dir /B build-output\*.jar
echo.
pause
