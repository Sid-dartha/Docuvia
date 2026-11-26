@echo off
title Docuvia - Launcher
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Setup has not been run yet. Double-click setup.bat first.
    pause
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo Frontend packages are missing. Double-click setup.bat first.
    pause
    exit /b 1
)

rem Make sure Ollama is running (starting it twice is harmless).
where ollama >nul 2>nul && (
    start "Ollama" /min ollama serve
)

echo Starting the backend on http://127.0.0.1:8000 ...
start "Docuvia backend" cmd /k "cd /d "%~dp0backend" && "%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo Starting the frontend on http://localhost:5173 ...
start "Docuvia frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

rem Give both servers a moment, then open the browser.
timeout /t 8 /nobreak >nul
start "" http://localhost:5173

echo.
echo Docuvia is running in the two new windows.
echo Close those windows to stop it.
timeout /t 5 >nul
