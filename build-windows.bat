@echo off
setlocal EnableDelayedExpansion

set ROOT=%~dp0
set ERRORS=0

echo ============================================================
echo  XiaoTian MedKey - Windows EXE Builder
echo ============================================================
echo.

echo [1/5] Checking uv...
where uv >NUL 2>NUL
if errorlevel 1 (
    echo [ERROR] uv not found. Install uv on the build machine.
    echo         See: https://docs.astral.sh/uv/getting-started/installation/
    set ERRORS=1
    goto summary
)
uv --version

echo.
echo [2/5] Preparing frontend assets...
where node >NUL 2>NUL
if errorlevel 1 (
    if exist "%ROOT%backend\static\index.html" (
        echo        Node.js not found. Reusing bundled backend\static assets.
    ) else (
        echo [ERROR] Node.js not found, and backend\static\index.html is missing.
        echo         Either install Node.js 18+ or use a package that includes backend\static.
        set ERRORS=1
        goto summary
    )
) else (
    node --version
    cd /d "%ROOT%frontend"
    if not exist "node_modules" (
        npm install
        if errorlevel 1 (
            echo [ERROR] npm install failed.
            set ERRORS=1
            goto summary
        )
    )
    npm run build
    if errorlevel 1 (
        echo [ERROR] Frontend build failed.
        set ERRORS=1
        goto summary
    )

    echo.
    echo [3/5] Copying frontend assets into backend...
    cd /d "%ROOT%"
    if exist "backend\static" rmdir /s /q "backend\static"
    xcopy /e /i /y "frontend\dist" "backend\static" >NUL
    if errorlevel 1 (
        echo [ERROR] Failed to copy frontend dist to backend\static.
        set ERRORS=1
        goto summary
    )
)

echo.
echo [4/5] Verifying frontend assets...
if not exist "%ROOT%backend\static\index.html" (
    echo [ERROR] backend\static\index.html is missing.
    set ERRORS=1
    goto summary
)

echo.
echo [5/5] Building Windows executable...
cd /d "%ROOT%backend"
if exist "dist\XiaoTianMedKey" rmdir /s /q "dist\XiaoTianMedKey"
uv run --extra dev --with pyinstaller pyinstaller ^
    --noconfirm ^
    --clean ^
    --name XiaoTianMedKey ^
    --onedir ^
    --add-data "static;static" ^
    --collect-all pymupdf4llm ^
    "run_app.py"
if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    set ERRORS=1
    goto summary
)

:summary
cd /d "%ROOT%"
echo.
echo ============================================================
if !ERRORS! == 0 (
    echo  Build complete:
    echo  %ROOT%backend\dist\XiaoTianMedKey\XiaoTianMedKey.exe
    echo.
    echo  Distribute the whole folder:
    echo  %ROOT%backend\dist\XiaoTianMedKey
) else (
    echo  Build failed. Check the error messages above.
)
echo ============================================================
echo.
pause
