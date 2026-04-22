@echo off
cd /d "%~dp0"
echo ========================================
echo   Terrarium Backend (WebSocket:30001)
echo   Press Ctrl+C to stop.
echo ========================================
echo.
node backend/server.js
if errorlevel 1 (
    echo.
    echo Failed to start. Make sure node is installed.
    pause
)
