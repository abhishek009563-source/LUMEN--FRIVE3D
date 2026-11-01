@echo off
title LumenDrive 3D - Vehicle Headlight Control Simulator
cd /d "%~dp0backend"

echo ====================================================================
echo    LUMEN-DRIVE 3D - VEHICLE HEADLIGHT CONTROL SIMULATOR
echo    Embedded C Backend + Mongoose + SQLite + Three.js 3D Viewport
echo ====================================================================
echo.

REM Check if server.exe exists; if not, compile it with GCC
if not exist "server.exe" (
    echo [*] Compiling C Backend with Mongoose and SQLite...
    gcc -O2 -Wall -Wextra -std=c99 -DSQLITE_THREADSAFE=0 -DMG_ENABLE_LINES=1 main.c server.c database.c headlights.c sensor.c indicators.c mongoose.c sqlite3.c -lws2_32 -o server.exe
    if errorlevel 1 (
        echo [ERROR] Compilation failed. Please ensure GCC is installed and on your PATH.
        pause
        exit /b 1
    )
    echo [*] C Backend compiled successfully!
    echo.
)

echo [*] Starting Mongoose HTTP Server on http://localhost:8001
echo [*] Database path: ../database/headlights.db
echo [*] Frontend static root: ../frontend
echo.

REM Automatically launch browser
start "" "http://localhost:8001/"

REM Start C server
server.exe 8001 ../frontend ../database/headlights.db

echo.
pause

