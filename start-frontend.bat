@echo off
cd /d "%~dp0"
echo ========================================
echo   Terrarium Frontend (HTTP:18080)
echo   Open http://localhost:18080 to play!
echo   Press Ctrl+C to stop.
echo ========================================
echo.
cd frontend
python3 -m http.server 18080
if errorlevel 1 (
    echo.
    echo Failed to start. Make sure python3 is installed.
    pause
)
