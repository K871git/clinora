@echo off
setlocal EnableDelayedExpansion
TITLE Clinora Setup
COLOR 0A

SET ROOT=%~dp0..
SET BACKEND=%ROOT%\backend
SET FRONTEND=%ROOT%\frontend
SET AUTOMATION=%~dp0

cls
echo.
echo  =======================================================
echo      CLINORA - Clinic Management System
echo      One-Time Setup
echo  =======================================================
echo.
echo  This sets up the backend, database, and frontend.
echo  Run this ONCE before first use, or after re-installation.
echo.
pause

:: ── 1. Check prerequisites ─────────────────────────────────────────────────

echo.
echo  [Step 1/6] Checking prerequisites...
echo  -------------------------------------------------------

php --version > nul 2>&1
IF ERRORLEVEL 1 (
    echo  [FAIL] PHP not found in PATH.
    echo.
    echo  Install PHP 8.3+ from: https://windows.php.net/download/
    echo  Choose the "Thread Safe" x64 zip, extract to C:\php,
    echo  and add C:\php to your system PATH.
    echo.
    pause
    exit /b 1
)
for /f "tokens=2 delims= " %%v in ('php --version 2^>nul ^| findstr /i "PHP"') do (
    echo  [OK] PHP %%v
    goto :php_ok
)
:php_ok

composer --version > nul 2>&1
IF ERRORLEVEL 1 (
    echo  [FAIL] Composer not found.
    echo  Install from: https://getcomposer.org/Composer-Setup.exe
    pause
    exit /b 1
)
echo  [OK] Composer found

node --version > nul 2>&1
IF ERRORLEVEL 1 (
    echo  [FAIL] Node.js not found.
    echo  Install LTS from: https://nodejs.org/
    pause
    exit /b 1
)
for /f %%v in ('node --version') do echo  [OK] Node.js %%v

npm --version > nul 2>&1
IF ERRORLEVEL 1 (
    echo  [FAIL] npm not found. Reinstall Node.js.
    pause
    exit /b 1
)
echo  [OK] npm found

:: ── 2. Detect local IP ──────────────────────────────────────────────────────

echo.
echo  [Step 2/6] Detecting network configuration...
echo  -------------------------------------------------------

for /f "usebackq tokens=*" %%i in (`powershell -nologo -command "try { (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.' -and $_.PrefixOrigin -ne 'WellKnown' } | Sort-Object InterfaceIndex | Select-Object -First 1).IPAddress } catch { '127.0.0.1' }"`) do set LOCAL_IP=%%i

IF "%LOCAL_IP%"=="" set LOCAL_IP=127.0.0.1
echo  [OK] Server LAN IP: %LOCAL_IP%

:: ── 3. Setup backend ────────────────────────────────────────────────────────

echo.
echo  [Step 3/6] Configuring backend...
echo  -------------------------------------------------------

IF NOT EXIST "%BACKEND%\.env" (
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" > nul
    echo  [OK] Created backend .env
) ELSE (
    echo  [OK] Backend .env already exists
)

:: Update APP_URL and APP_NAME
powershell -nologo -command ^
    "(Get-Content '%BACKEND%\.env') ^
     -replace 'APP_NAME=.*', 'APP_NAME=Clinora' ^
     -replace 'APP_URL=.*', 'APP_URL=http://%LOCAL_IP%:8000' ^
     | Set-Content '%BACKEND%\.env'"

:: Ensure CORS_ALLOWED_ORIGINS is set
powershell -nologo -command ^
    "$env = Get-Content '%BACKEND%\.env'; ^
     if ($env -match 'CORS_ALLOWED_ORIGINS') { ^
         ($env -replace 'CORS_ALLOWED_ORIGINS=.*', 'CORS_ALLOWED_ORIGINS=*') | Set-Content '%BACKEND%\.env' ^
     } else { ^
         Add-Content '%BACKEND%\.env' \"`nCORS_ALLOWED_ORIGINS=*\" ^
     }"

:: Ensure SANCTUM_STATEFUL_DOMAINS covers the LAN IP
powershell -nologo -command ^
    "$domains = 'localhost,localhost:5173,localhost:8000,127.0.0.1,%LOCAL_IP%,%LOCAL_IP%:5173,%LOCAL_IP%:8000'; ^
     $env = Get-Content '%BACKEND%\.env'; ^
     if ($env -match 'SANCTUM_STATEFUL_DOMAINS') { ^
         ($env -replace 'SANCTUM_STATEFUL_DOMAINS=.*', \"SANCTUM_STATEFUL_DOMAINS=$domains\") | Set-Content '%BACKEND%\.env' ^
     } else { ^
         Add-Content '%BACKEND%\.env' \"`nSANCTUM_STATEFUL_DOMAINS=$domains\" ^
     }"

echo  [OK] Backend .env updated

:: Install Composer dependencies
echo  Installing backend dependencies (this may take a minute)...
cd /d "%BACKEND%"
composer install --no-interaction --prefer-dist --optimize-autoloader --quiet
IF ERRORLEVEL 1 (
    echo  [FAIL] composer install failed. Check internet connection.
    pause
    exit /b 1
)
echo  [OK] Backend dependencies installed

:: Generate app key
php artisan key:generate --force --no-interaction > nul 2>&1
echo  [OK] Application key generated

:: Run migrations + seed defaults
echo  Setting up database...
php artisan migrate --force --no-interaction
IF ERRORLEVEL 1 (
    echo  [WARN] Migration may have had issues. Check output above.
) ELSE (
    echo  [OK] Database migrated
)

:: Create storage symlink
php artisan storage:link --force > nul 2>&1
echo  [OK] Storage linked

:: ── 4. Setup frontend ───────────────────────────────────────────────────────

echo.
echo  [Step 4/6] Configuring frontend...
echo  -------------------------------------------------------

:: Write frontend .env — API URL MUST end in /api
(
    echo VITE_API_URL=http://%LOCAL_IP%:8000/api
) > "%FRONTEND%\.env"
echo  [OK] Frontend .env written (API: http://%LOCAL_IP%:8000/api)

:: Install npm dependencies
echo  Installing frontend dependencies (this may take a couple of minutes)...
cd /d "%FRONTEND%"
npm install --silent
IF ERRORLEVEL 1 (
    echo  [FAIL] npm install failed.
    pause
    exit /b 1
)
echo  [OK] Frontend dependencies installed

:: ── 5. Save config for start.bat ────────────────────────────────────────────

echo.
echo  [Step 5/6] Saving server configuration...
echo  -------------------------------------------------------

(
    echo SET CLINORA_IP=%LOCAL_IP%
    echo SET CLINORA_BACKEND_PORT=8000
    echo SET CLINORA_FRONTEND_PORT=5173
) > "%AUTOMATION%\clinora.config.bat"
echo  [OK] Config saved to automation\clinora.config.bat

:: ── 6. Create desktop shortcut ──────────────────────────────────────────────

echo.
echo  [Step 6/6] Creating desktop shortcut...
echo  -------------------------------------------------------

SET START_BAT=%AUTOMATION%start.bat
SET ICON=%AUTOMATION%clinora.ico
IF NOT EXIST "%ICON%" SET ICON=%SystemRoot%\system32\shell32.dll,23

powershell -nologo -command ^
    "$s = New-Object -COM WScript.Shell; ^
     $lnk = $s.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Start Clinora.lnk'); ^
     $lnk.TargetPath = '%START_BAT%'; ^
     $lnk.WorkingDirectory = '%AUTOMATION%'; ^
     $lnk.IconLocation = '%ICON%'; ^
     $lnk.Description = 'Start Clinora Clinic Management System'; ^
     $lnk.Save()"
echo  [OK] Desktop shortcut created: "Start Clinora"

:: ── Done ────────────────────────────────────────────────────────────────────

echo.
echo  =======================================================
echo      SETUP COMPLETE!
echo  =======================================================
echo.
echo  Start Clinora:
echo    Double-click "Start Clinora" on your desktop
echo    — or run automation\start.bat
echo.
echo  Access URLs after starting:
echo    This PC (Doctor):       http://localhost:5173
echo    LAN (Pharmacist PC):    http://%LOCAL_IP%:5173
echo.
echo  IMPORTANT — Multiple simultaneous logins:
echo    Doctor    uses CHROME
echo    Pharmacist uses MICROSOFT EDGE (or Firefox)
echo    (Different browsers = separate sessions = no conflict)
echo.
echo  To auto-start with Windows:
echo    Run automation\install-startup.bat
echo.
pause
endlocal
