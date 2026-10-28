@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PORT=8766"
set "BUILD_ID=ioi-cloud-8766-v1.1"
set "APP_URL=http://127.0.0.1:%PORT%/index.html"

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
if %errorlevel%==0 goto check_existing
goto start_server

:check_existing
set "RUNNING_BUILD="
for /f "usebackq delims=" %%B in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$v = try { (Invoke-RestMethod -Uri 'http://127.0.0.1:%PORT%/__ioi_version' -TimeoutSec 2).build } catch { '' }; Write-Output $v"`) do set "RUNNING_BUILD=%%B"
if "%RUNNING_BUILD%"=="%BUILD_ID%" goto launch_existing
echo.
echo ERROR: Port %PORT% is already in use by another app or an older IOI OS copy.
echo Close the earlier server window, then run this launcher again.
echo This launcher will not terminate arbitrary processes.
echo.
pause
exit /b 2

:launch_existing
start "" "%APP_URL%"
echo IOI OS %BUILD_ID% is already running. Opened the current app.
endlocal
exit /b 0

:start_server
where node >nul 2>nul
if %errorlevel%==0 goto node_server
where py >nul 2>nul
if %errorlevel%==0 goto python_launcher
where python >nul 2>nul
if %errorlevel%==0 goto python_plain
echo IOI OS needs Node.js 22+ or Python 3 to launch locally.
echo Install either runtime, then double-click this file again.
pause
exit /b 1

:node_server
start "IOI OS Local Server" /min cmd /c "cd /d ""%~dp0"" && set PORT=%PORT% && node server.cjs"
goto launch

:python_launcher
start "IOI OS Local Server" /min cmd /c "cd /d ""%~dp0"" && set PORT=%PORT% && py -3 server.py"
goto launch

:python_plain
start "IOI OS Local Server" /min cmd /c "cd /d ""%~dp0"" && set PORT=%PORT% && python server.py"

:launch
timeout /t 2 /nobreak >nul
start "" "%APP_URL%"
echo IOI OS is opening in your browser.
echo Build: %BUILD_ID%
echo Local URL: %APP_URL%
echo Keep the local server window open while using the PC app.
endlocal
