@echo off
REM Koishi Container Lockfile Fix Script
REM This script fixes the Yarn v1/v4 lockfile conflict

echo ========================================
echo Koishi Container Lockfile Fix
echo ========================================
echo.

REM Replace 'koishi' with your actual container name
set CONTAINER_NAME=koishi

echo Step 1: Starting container...
docker start %CONTAINER_NAME%
timeout /t 2 /nobreak >nul

echo Step 2: Removing corrupted lockfile...
docker exec %CONTAINER_NAME% sh -c "cd /koishi && rm -f yarn.lock"

echo Step 3: Installing Git...
docker exec %CONTAINER_NAME% sh -c "apk add --no-cache git"

echo Step 4: Regenerating lockfile...
docker exec %CONTAINER_NAME% sh -c "cd /koishi && yarn install"

echo Step 5: Restarting container...
docker restart %CONTAINER_NAME%

echo.
echo ========================================
echo Fix completed!
echo ========================================
echo.
echo Next steps:
echo 1. Wait for container to fully start
echo 2. Run: docker exec -it %CONTAINER_NAME% sh
echo 3. Inside container: yarn add git+https://github.com/chm413/Mochi-Link.git
echo 4. Configure the plugin in Koishi web UI
echo.

pause
