@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo  XiaoTian MedKey - Starting Application
echo ============================================================
echo.

set ROOT=%~dp0

echo [0/2] Stopping existing services...

REM 按窗口标题杀掉上次启动的两个 cmd 窗口
taskkill /FI "WINDOWTITLE eq MedKey-Backend*" /F >NUL 2>&1
taskkill /FI "WINDOWTITLE eq MedKey-Frontend*" /F >NUL 2>&1

REM 释放 8000 端口（杀掉占用进程）
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING" 2^>NUL') do (
    taskkill /PID %%P /F >NUL 2>&1
)

REM 释放 5173 端口
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>NUL') do (
    taskkill /PID %%P /F >NUL 2>&1
)

echo        Existing services stopped.
echo.

where uv 2>NUL
if errorlevel 1 (
    echo [ERROR] uv not found. Run install.bat first.
    pause
    exit /b 1
)

where node 2>NUL
if errorlevel 1 (
    echo [ERROR] Node.js not found. Run install.bat first.
    pause
    exit /b 1
)

echo [1/2] Starting backend on port 8000...
cd /d "%ROOT%backend"
start "MedKey-Backend" /min cmd /c "uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 && pause"
cd /d "%ROOT%"

echo        Waiting for backend...
:wait_backend
timeout /t 1 /nobreak
curl -s http://127.0.0.1:8000/health 2>NUL
if errorlevel 1 goto wait_backend
echo        Backend ready

echo [2/2] Starting frontend on port 5173...
cd /d "%ROOT%frontend"
start "MedKey-Frontend" /min cmd /c "npm run dev && pause"
cd /d "%ROOT%"

echo        Waiting for frontend...
:wait_frontend
timeout /t 1 /nobreak
curl -s http://localhost:5173 2>NUL
if errorlevel 1 goto wait_frontend
echo        Frontend ready

echo.
echo ============================================================
echo  Backend : http://127.0.0.1:8000
echo  App     : http://localhost:5173
echo ============================================================
echo.
start "" "http://localhost:5173"
echo Opening browser...
echo Close MedKey-Backend and MedKey-Frontend windows to stop.
echo.
pause
