@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo  XiaoTian MedKey - Dependency Installer
echo ============================================================
echo.

set ROOT=%~dp0
set ERRORS=0

echo [1/4] Checking Python 3.11+...
where python 2>NUL
if errorlevel 1 (
    echo [ERROR] Python not found.
    echo         Download: https://www.python.org/downloads/
    echo         Check Add Python to PATH when installing.
    set ERRORS=1
    goto check_node
)
python --version
echo        Python OK

echo.
echo [2/4] Checking uv...
where uv 2>NUL
if errorlevel 1 (
    echo        Installing uv via pip...
    pip install uv
    if errorlevel 1 (
        echo [ERROR] pip install uv failed.
        set ERRORS=1
        goto check_node
    )
    echo        uv installed OK
) else (
    uv --version
    echo        uv OK
)

echo        Installing backend dependencies...
cd /d "%ROOT%backend"
uv sync
if errorlevel 1 (
    echo [ERROR] uv sync failed.
    set ERRORS=1
)
cd /d "%ROOT%"

:check_node
echo.
echo [3/4] Checking Node.js 18+...
where node 2>NUL
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo         Download: https://nodejs.org/
    echo         Re-run this script after installing.
    set ERRORS=1
    goto summary
)
node --version
echo        Node.js OK

echo.
echo [4/4] Installing frontend dependencies...
cd /d "%ROOT%frontend"
npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    set ERRORS=1
)
cd /d "%ROOT%"

:summary
echo.
echo ============================================================
if !ERRORS! == 0 (
    echo  All done! Run start.bat to launch.
) else (
    echo  Some steps failed. Fix errors above and re-run.
)
echo ============================================================
echo.
pause
