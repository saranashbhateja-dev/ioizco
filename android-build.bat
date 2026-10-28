@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22+ is required to build the Android APK.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing IOI OS Android wrapper dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
if not exist www mkdir www
copy /Y index.html www\index.html >nul
copy /Y styles.css www\styles.css >nul
copy /Y app.js www\app.js >nul
copy /Y ioi-curriculum.js www\ioi-curriculum.js >nul
copy /Y manifest.webmanifest www\manifest.webmanifest >nul
if not exist android (
  call npx cap add android
  if errorlevel 1 exit /b 1
)
call npx cap sync android
if errorlevel 1 exit /b 1
cd android
call gradlew.bat assembleDebug
if errorlevel 1 exit /b 1
cd ..
echo.
echo APK created at:
echo android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
endlocal
