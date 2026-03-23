@echo off
setlocal
cd /d "%~dp0\.."

echo [INFO] Building frontend (production^)...
call npm run build:prod
if errorlevel 1 exit /b 1

echo [INFO] Building Tauri...
call npm run tauri:build
if errorlevel 1 exit /b 1

echo [SUCCESS] Build completed.
exit /b 0
