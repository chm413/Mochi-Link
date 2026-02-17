@echo off
REM Koishi Workspace Configuration Fix Script
REM This fixes the Yarn v4 workspace configuration issue

echo ========================================
echo Koishi Workspace Fix - Advanced
echo ========================================
echo.

set CONTAINER_NAME=koishi

echo Step 1: Stopping container...
docker stop %CONTAINER_NAME%

echo Step 2: Cleaning Yarn cache and lockfile...
docker run --rm --volumes-from %CONTAINER_NAME% alpine:latest sh -c "cd /koishi && rm -rf yarn.lock .yarn/cache .yarn/install-state.gz .pnp.* node_modules"

echo Step 3: Starting container with manual intervention...
docker start %CONTAINER_NAME%
timeout /t 3 /nobreak >nul

echo Step 4: Installing Git...
docker exec %CONTAINER_NAME% apk add --no-cache git

echo Step 5: Checking package.json configuration...
docker exec %CONTAINER_NAME% cat /koishi/package.json

echo.
echo Step 6: Running yarn install with verbose output...
docker exec %CONTAINER_NAME% sh -c "cd /koishi && yarn install --no-immutable"

echo.
echo Step 7: Restarting container...
docker restart %CONTAINER_NAME%

echo.
echo ========================================
echo Fix completed!
echo ========================================
echo.
echo If the error persists, you may need to:
echo 1. Check if .yarnrc.yml exists and is configured correctly
echo 2. Verify package.json has correct workspace configuration
echo 3. Consider recreating the container from scratch
echo.

pause
