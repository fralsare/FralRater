@echo off
rem FralRater launcher (Windows) - opens the app in its own window.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [FralRater] Node.js is required. Install it from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo [FralRater] First run: installing Electron (one-time download)...
  call npm install
  if errorlevel 1 (
    echo [FralRater] npm install failed. Check your network and retry.
    pause
    exit /b 1
  )
)

call "node_modules\.bin\electron.cmd" .
endlocal
