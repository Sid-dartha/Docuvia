@echo off
setlocal EnableDelayedExpansion
title Docuvia - Setup
cd /d "%~dp0"

echo ============================================================
echo   Docuvia (AI Document Analyzer) - one-time setup
echo ============================================================
echo.

rem ---------------------------------------------------------------
rem 1. Find Python 3.10+ (prefers the "py" launcher, 3.11)
rem ---------------------------------------------------------------
set "PYTHON="
where py >nul 2>nul && (
    py -3.11 --version >nul 2>nul && set "PYTHON=py -3.11"
    if not defined PYTHON py -3 --version >nul 2>nul && set "PYTHON=py -3"
)
if not defined PYTHON (
    where python >nul 2>nul && set "PYTHON=python"
)
if not defined PYTHON (
    echo [ERROR] Python was not found.
    echo         Install Python 3.11 from https://www.python.org/downloads/
    echo         and tick "Add python.exe to PATH" during install. Then run setup.bat again.
    goto :fail
)
for /f "tokens=2" %%v in ('!PYTHON! --version 2^>^&1') do set "PYVER=%%v"
echo [OK] Python !PYVER! found  ^(!PYTHON!^)
!PYTHON! -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
if errorlevel 1 (
    echo [ERROR] Python 3.10 or newer is required. Install Python 3.11 and try again.
    goto :fail
)

rem ---------------------------------------------------------------
rem 2. Check Node.js
rem ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found.
    echo         Install the LTS version from https://nodejs.org/ and run setup.bat again.
    goto :fail
)
for /f %%v in ('node -v') do echo [OK] Node.js %%v found

rem ---------------------------------------------------------------
rem 3. Check Ollama
rem ---------------------------------------------------------------
where ollama >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Ollama was not found.
    echo         Install it from https://ollama.com/download , open it once, then run setup.bat again.
    goto :fail
)
echo [OK] Ollama found
echo.

rem ---------------------------------------------------------------
rem 4. Python virtual environment + backend packages
rem ---------------------------------------------------------------
if not exist ".venv\Scripts\python.exe" (
    echo [..] Creating Python virtual environment in .venv
    !PYTHON! -m venv .venv
    if errorlevel 1 goto :fail
)
echo [..] Installing backend packages ^(this downloads ~1 GB the first time, please wait^)
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Installing Python packages failed. Check your internet connection and try again.
    goto :fail
)
echo [OK] Backend packages installed
echo.

rem ---------------------------------------------------------------
rem 5. Frontend packages
rem ---------------------------------------------------------------
echo [..] Installing frontend packages
pushd frontend
call npm install
if errorlevel 1 (
    popd
    echo [ERROR] npm install failed.
    goto :fail
)
popd
echo [OK] Frontend packages installed
echo.

rem ---------------------------------------------------------------
rem 6. AI models
rem ---------------------------------------------------------------
echo [..] Downloading the local language model llama3.2:3b ^(~2 GB^)
ollama pull llama3.2:3b
if errorlevel 1 (
    echo [ERROR] Could not download the model. Make sure the Ollama app is running, then run setup.bat again.
    goto :fail
)
echo [OK] Language model ready

echo [..] Downloading the embedding model ^(~90 MB^)
".venv\Scripts\python.exe" -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
if errorlevel 1 (
    echo [WARN] Embedding model download failed. It will be retried on the first upload.
) else (
    echo [OK] Embedding model ready
)

if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\storage" mkdir "backend\storage"

echo.
echo ============================================================
echo   Setup complete!  Double-click start.bat to run Docuvia.
echo ============================================================
echo.
pause
exit /b 0

:fail
echo.
echo Setup did not finish. Fix the problem above and run setup.bat again.
pause
exit /b 1
