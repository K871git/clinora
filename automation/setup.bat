@echo off
setlocal EnableDelayedExpansion
TITLE Clinora Setup
COLOR 0A

SET ROOT=%~dp0..
SET BACKEND=%ROOT%\backend
SET FRONTEND=%ROOT%\frontend
SET AUTO=%~dp0
IF "%AUTO:~-1%"=="\" SET AUTO=%AUTO:~0,-1%

cls
echo.
echo  =========================================================
echo      CLINORA - Clinic Management System
echo      Full Setup Script
echo  =========================================================
echo.
echo  Existing .env settings (DB, keys) will be preserved.
echo  Only network URLs will be updated for this machine.
echo.
pause

:: ── STEP 1: Prerequisites ──────────────────────────────────────────────────
echo.
echo  [1/7] Checking prerequisites...
echo  ---------------------------------------------------------

php --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo  [FAIL] PHP not found. Install PHP 8.3+ Thread Safe x64:
    echo         https://windows.php.net/download/
    echo         Extract to C:\php, add C:\php to PATH, enable extensions in php.ini
    pause & exit /b 1
)
for /f "tokens=2 delims= " %%v in ('php --version 2^>nul ^| findstr /i "^PHP"') do (
    echo  [OK]  PHP %%v
    goto :php_done
)
:php_done

:: Check required PHP extensions
for %%e in (fileinfo mbstring openssl pdo zip curl) do (
    php -r "if(!extension_loaded('%%e')){exit(1);}" >nul 2>&1
    IF ERRORLEVEL 1 echo  [WARN] PHP extension missing: %%e  ^(enable in php.ini^)
)

:: Detect DB driver from backend .env
SET DB_DRIVER=sqlite
IF EXIST "%BACKEND%\.env" (
    for /f "tokens=2 delims==" %%v in ('findstr /i "^DB_CONNECTION=" "%BACKEND%\.env"') do SET DB_DRIVER=%%v
)

:: Check DB-specific extension
IF /i "!DB_DRIVER!"=="mysql" (
    php -r "if(!extension_loaded('pdo_mysql')){exit(1);}" >nul 2>&1
    IF ERRORLEVEL 1 (
        echo  [FAIL] pdo_mysql extension not enabled. Enable in php.ini then retry.
        pause & exit /b 1
    )
    echo  [OK]  pdo_mysql extension found ^(MySQL mode^)
) ELSE (
    php -r "if(!extension_loaded('pdo_sqlite')||!extension_loaded('sqlite3')){exit(1);}" >nul 2>&1
    IF ERRORLEVEL 1 (
        echo  [FAIL] pdo_sqlite / sqlite3 not enabled. Enable in php.ini then retry.
        pause & exit /b 1
    )
    echo  [OK]  pdo_sqlite extension found ^(SQLite mode^)
)

composer --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo  [FAIL] Composer not found. Install: https://getcomposer.org/Composer-Setup.exe
    pause & exit /b 1
)
echo  [OK]  Composer found

node --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo  [FAIL] Node.js not found. Install LTS: https://nodejs.org/
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo  [OK]  Node.js %%v

npm --version >nul 2>&1
IF ERRORLEVEL 1 ( echo  [FAIL] npm not found. Reinstall Node.js. & pause & exit /b 1 )
echo  [OK]  npm found

:: ── STEP 2: Detect LAN IP ─────────────────────────────────────────────────
echo.
echo  [2/7] Detecting network IP...
echo  ---------------------------------------------------------

for /f "usebackq tokens=*" %%i in (`powershell -nologo -command ^
    "try { (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.' -and $_.PrefixOrigin -eq 'Dhcp' } | Sort-Object { (Get-NetRoute -InterfaceIndex $_.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue).Count } -Descending | Select-Object -First 1).IPAddress } catch { '127.0.0.1' }"`) do SET LOCAL_IP=%%i
IF "!LOCAL_IP!"=="" SET LOCAL_IP=127.0.0.1

SET BACKEND_PORT=8000
SET FRONTEND_PORT=5173

echo  [OK]  LAN IP: !LOCAL_IP!
IF "!LOCAL_IP!"=="127.0.0.1" echo  [WARN] No LAN IP found - LAN access from other PCs will not work.

:: ── STEP 3: Configure .env files ──────────────────────────────────────────
echo.
echo  [3/7] Configuring environment...
echo  ---------------------------------------------------------

IF NOT EXIST "%BACKEND%\.env" (
    IF EXIST "%BACKEND%\.env.example" (
        copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
        echo  [OK]  Created backend .env from example
    ) ELSE (
        echo  [FAIL] No backend .env or .env.example found.
        pause & exit /b 1
    )
) ELSE (
    echo  [OK]  Backend .env exists - preserving existing settings
)

:: Update only network-related values in backend .env
powershell -nologo -command ^
    "$f='%BACKEND%\.env'; $c=Get-Content $f -Raw;" ^
    "$c=$c -replace '(?m)^APP_URL=.*$','APP_URL=http://!LOCAL_IP!:!BACKEND_PORT!';" ^
    "$c=$c -replace '(?m)^APP_NAME=.*$','APP_NAME=Clinora';" ^
    "if($c -match '(?m)^CORS_ALLOWED_ORIGINS='){$c=$c -replace '(?m)^CORS_ALLOWED_ORIGINS=.*$','CORS_ALLOWED_ORIGINS=http://!LOCAL_IP!:!FRONTEND_PORT!,http://localhost:!FRONTEND_PORT!'}" ^
    "else{$c+=[System.Environment]::NewLine+'CORS_ALLOWED_ORIGINS=http://!LOCAL_IP!:!FRONTEND_PORT!,http://localhost:!FRONTEND_PORT!'};" ^
    "$domains='localhost,localhost:!FRONTEND_PORT!,localhost:!BACKEND_PORT!,127.0.0.1,!LOCAL_IP!,!LOCAL_IP!:!FRONTEND_PORT!,!LOCAL_IP!:!BACKEND_PORT!';" ^
    "if($c -match '(?m)^SANCTUM_STATEFUL_DOMAINS='){$c=$c -replace '(?m)^SANCTUM_STATEFUL_DOMAINS=.*$',\"SANCTUM_STATEFUL_DOMAINS=$domains\"}" ^
    "else{$c+=[System.Environment]::NewLine+\"SANCTUM_STATEFUL_DOMAINS=$domains\"};" ^
    "Set-Content $f $c -NoNewline"
echo  [OK]  Backend .env network settings updated

:: Write frontend .env
(echo VITE_API_URL=http://!LOCAL_IP!:!BACKEND_PORT!/api) > "%FRONTEND%\.env"
echo  [OK]  Frontend .env written  (API: http://!LOCAL_IP!:!BACKEND_PORT!/api)

:: Save config for generated scripts
(
    echo SET CLINORA_IP=!LOCAL_IP!
    echo SET CLINORA_BACKEND_PORT=!BACKEND_PORT!
    echo SET CLINORA_FRONTEND_PORT=!FRONTEND_PORT!
    echo SET CLINORA_ROOT=%ROOT%
    echo SET CLINORA_BACKEND=%BACKEND%
    echo SET CLINORA_FRONTEND=%FRONTEND%
    echo SET CLINORA_AUTO=%AUTO%
) > "%AUTO%\clinora.config.bat"
echo  [OK]  Config saved

:: ── STEP 4: Backend setup ─────────────────────────────────────────────────
echo.
echo  [4/7] Setting up backend...
echo  ---------------------------------------------------------

cd /d "%BACKEND%"

echo  Installing PHP dependencies...
composer install --no-interaction --prefer-dist --optimize-autoloader
IF ERRORLEVEL 1 (
    echo  [FAIL] composer install failed - see errors above.
    pause & exit /b 1
)
echo  [OK]  Composer dependencies installed

:: Generate APP_KEY only if missing
powershell -nologo -command ^
    "$env=Get-Content '%BACKEND%\.env' -Raw; if($env -match '(?m)^APP_KEY=\s*$' -or $env -notmatch '(?m)^APP_KEY=.+'){Write-Host 'GENERATE'}" > "%TEMP%\clinora_keychk.tmp"
findstr "GENERATE" "%TEMP%\clinora_keychk.tmp" >nul 2>&1
IF NOT ERRORLEVEL 1 (
    php artisan key:generate --force --no-interaction >nul 2>&1
    echo  [OK]  Application key generated
) ELSE (
    echo  [OK]  Application key already set - skipping
)
del "%TEMP%\clinora_keychk.tmp" >nul 2>&1

:: Database setup
IF /i "!DB_DRIVER!"=="sqlite" (
    SET SQLITE_PATH=%BACKEND%\database\database.sqlite
    IF NOT EXIST "!SQLITE_PATH!" (
        type nul > "!SQLITE_PATH!"
        echo  [OK]  SQLite database file created
    ) ELSE (
        echo  [OK]  SQLite database file exists
    )
) ELSE (
    echo  Verifying MySQL connection...
    php artisan db:show >nul 2>&1
    IF ERRORLEVEL 1 (
        echo  [WARN] Cannot connect to MySQL. Check DB_HOST/DB_USERNAME/DB_PASSWORD in backend\.env
        echo         Make sure MySQL service is running, then re-run setup.bat
        pause & exit /b 1
    )
    echo  [OK]  MySQL connection verified
)

echo  Running database migrations...
php artisan migrate --force --no-interaction
IF ERRORLEVEL 1 (
    echo  [FAIL] Migration failed - see errors above.
    pause & exit /b 1
)
echo  [OK]  Database migrated

php artisan storage:link --force >nul 2>&1
echo  [OK]  Storage linked

php artisan config:clear >nul 2>&1
php artisan route:clear >nul 2>&1

:: ── STEP 5: Frontend build ────────────────────────────────────────────────
echo.
echo  [5/7] Building frontend...
echo  ---------------------------------------------------------

cd /d "%FRONTEND%"

echo  Installing frontend dependencies...
npm install --prefer-offline
IF ERRORLEVEL 1 (
    echo  Retrying without offline cache...
    npm install
    IF ERRORLEVEL 1 (
        echo  [FAIL] npm install failed.
        pause & exit /b 1
    )
)
echo  [OK]  Frontend dependencies installed

echo  Building production bundle...
npm run build
IF ERRORLEVEL 1 (
    echo  [FAIL] Frontend build failed - see errors above.
    pause & exit /b 1
)
echo  [OK]  Frontend built

:: ── STEP 6: Generate start.bat and stop.bat ───────────────────────────────
echo.
echo  [6/7] Generating launcher scripts...
echo  ---------------------------------------------------------

:: Write start.bat via PowerShell to avoid escaping hell
powershell -nologo -command ^
    "$b='%BACKEND%'; $f='%FRONTEND%'; $ip='!LOCAL_IP!'; $bp=!BACKEND_PORT!; $fp=!FRONTEND_PORT!;" ^
    "$nl=[System.Environment]::NewLine;" ^
    "$s=('@echo off'+$nl+'setlocal EnableDelayedExpansion'+$nl+'TITLE Clinora - Starting...'+$nl+$nl+'SET BACKEND='+$b+$nl+'SET FRONTEND='+$f+$nl+'SET CLINORA_IP='+$ip+$nl+'SET BACKEND_PORT='+$bp+$nl+'SET FRONTEND_PORT='+$fp+$nl+$nl+'cls'+$nl+'echo.'+$nl+'echo  ========================================================='+$nl+'echo      CLINORA IS STARTING'+$nl+'echo  ========================================================='+$nl+'echo.'+$nl+$nl+':: Kill existing server windows'+$nl+'taskkill /F /FI \"WindowTitle eq Clinora Backend*\" >nul 2>&1'+$nl+'taskkill /F /FI \"WindowTitle eq Clinora Frontend*\" >nul 2>&1'+$nl+$nl+':: Free the ports'+$nl+'powershell -nologo -command \"Get-NetTCPConnection -LocalPort '+$bp+' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"'+$nl+'powershell -nologo -command \"Get-NetTCPConnection -LocalPort '+$fp+' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"'+$nl+$nl+':: Start backend'+$nl+'echo  Starting backend...'+$nl+'start \"Clinora Backend\" /min cmd /k \"TITLE Clinora Backend [port '+$bp+'] && cd /d \"%BACKEND%\" && php artisan serve --host=0.0.0.0 --port='+$bp+'\"'+$nl+$nl+':: Wait for backend to be ready'+$nl+'echo  Waiting for backend...'+$nl+'SET /a TRIES=0'+$nl+':wait_backend'+$nl+'SET /a TRIES+=1'+$nl+'IF !TRIES! GTR 30 (echo  [FAIL] Backend did not start. Check the backend window. & pause & exit /b 1)'+$nl+'powershell -nologo -command \"try{$t=New-Object Net.Sockets.TcpClient;$t.Connect(''127.0.0.1'','+$bp+');$t.Close();exit 0}catch{exit 1}\" >nul 2>&1'+$nl+'IF ERRORLEVEL 1 (timeout /t 1 /nobreak >nul & goto wait_backend)'+$nl+'echo  [OK]  Backend ready'+$nl+$nl+':: Start frontend'+$nl+'echo  Starting frontend...'+$nl+'start \"Clinora Frontend\" /min cmd /k \"TITLE Clinora Frontend [port '+$fp+'] && cd /d \"%FRONTEND%\" && npm run preview -- --host 0.0.0.0 --port '+$fp+'\"'+$nl+$nl+':: Wait for frontend to be ready'+$nl+'SET /a TRIES=0'+$nl+':wait_frontend'+$nl+'SET /a TRIES+=1'+$nl+'IF !TRIES! GTR 30 (echo  [FAIL] Frontend did not start. Check the frontend window. & pause & exit /b 1)'+$nl+'powershell -nologo -command \"try{$t=New-Object Net.Sockets.TcpClient;$t.Connect(''127.0.0.1'','+$fp+');$t.Close();exit 0}catch{exit 1}\" >nul 2>&1'+$nl+'IF ERRORLEVEL 1 (timeout /t 1 /nobreak >nul & goto wait_frontend)'+$nl+'echo  [OK]  Frontend ready'+$nl+$nl+':: Open browser'+$nl+'start http://localhost:'+$fp+$nl+$nl+'cls'+$nl+'echo.'+$nl+'echo  ========================================================='+$nl+'echo      CLINORA IS RUNNING'+$nl+'echo  ========================================================='+$nl+'echo.'+$nl+'echo  Doctor ^(this PC^)   : http://localhost:'+$fp+$nl+'echo  Pharmacist ^(LAN^)   : http://'+$ip+':'+$fp+$nl+'echo.'+$nl+'echo  IMPORTANT: Use DIFFERENT browsers for Doctor and Pharmacist'+$nl+'echo    Doctor     = Chrome'+$nl+'echo    Pharmacist = Edge or Firefox'+$nl+'echo.'+$nl+'echo  To stop: run stop.bat or close the two minimised windows'+$nl+'echo.'+$nl+'pause'+$nl+'endlocal');" ^
    "Set-Content '%AUTO%\start.bat' $s -Encoding ASCII"
echo  [OK]  start.bat written

:: Write stop.bat
powershell -nologo -command ^
    "$bp=!BACKEND_PORT!; $fp=!FRONTEND_PORT!;" ^
    "$nl=[System.Environment]::NewLine;" ^
    "$s=('@echo off'+$nl+'TITLE Clinora - Stopping'+$nl+'echo.'+$nl+'echo  Stopping Clinora servers...'+$nl+'echo.'+$nl+'taskkill /F /FI \"WindowTitle eq Clinora Backend*\" >nul 2>&1'+$nl+'taskkill /F /FI \"WindowTitle eq Clinora Frontend*\" >nul 2>&1'+$nl+'powershell -nologo -command \"Get-NetTCPConnection -LocalPort '+$bp+' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"'+$nl+'powershell -nologo -command \"Get-NetTCPConnection -LocalPort '+$fp+' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"'+$nl+'echo  All Clinora servers stopped.'+$nl+'echo.'+$nl+'timeout /t 2 /nobreak >nul');" ^
    "Set-Content '%AUTO%\stop.bat' $s -Encoding ASCII"
echo  [OK]  stop.bat written

:: Write startup-prompt.vbs
powershell -nologo -command ^
    "$startBat='%AUTO%\start.bat';" ^
    "$s=('Dim result'+[char]13+[char]10+'result = MsgBox(\"Start Clinora Clinic Management System?\",4+32+4096,\"Clinora\")'+[char]13+[char]10+'If result = 6 Then'+[char]13+[char]10+'  CreateObject(\"WScript.Shell\").Run Chr(34) & \"'+$startBat+'\" & Chr(34), 1, False'+[char]13+[char]10+'End If');" ^
    "Set-Content '%AUTO%\startup-prompt.vbs' $s -Encoding ASCII"
echo  [OK]  startup-prompt.vbs written

:: ── STEP 7: Shortcuts ─────────────────────────────────────────────────────
echo.
echo  [7/7] Creating shortcuts...
echo  ---------------------------------------------------------

:: Detect icon
SET ICON_PATH=%SystemRoot%\system32\shell32.dll,23
IF EXIST "%AUTO%\clinora.ico" SET ICON_PATH=%AUTO%\clinora.ico

:: Desktop shortcut - Start Clinora
powershell -nologo -command ^
    "$q=[char]34; $sh=New-Object -COM WScript.Shell;" ^
    "$lnk=$sh.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Start Clinora.lnk');" ^
    "$lnk.TargetPath='%AUTO%\start.bat';" ^
    "$lnk.WorkingDirectory='%AUTO%';" ^
    "$lnk.IconLocation='%ICON_PATH%';" ^
    "$lnk.Description='Start Clinora Clinic Management System';" ^
    "$lnk.Save()"
IF EXIST "%USERPROFILE%\Desktop\Start Clinora.lnk" (
    echo  [OK]  Desktop shortcut: "Start Clinora"
) ELSE (
    echo  [WARN] Desktop shortcut failed - try running as Administrator
)

:: Desktop shortcut - Stop Clinora
powershell -nologo -command ^
    "$sh=New-Object -COM WScript.Shell;" ^
    "$lnk=$sh.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Stop Clinora.lnk');" ^
    "$lnk.TargetPath='%AUTO%\stop.bat';" ^
    "$lnk.WorkingDirectory='%AUTO%';" ^
    "$lnk.IconLocation='%SystemRoot%\system32\shell32.dll,131';" ^
    "$lnk.Description='Stop Clinora Servers';" ^
    "$lnk.Save()"
echo  [OK]  Desktop shortcut: "Stop Clinora"

:: Windows Startup folder shortcut (optional auto-launch prompt)
SET STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Clinora.lnk
powershell -nologo -command ^
    "$sh=New-Object -COM WScript.Shell;" ^
    "$lnk=$sh.CreateShortcut('%STARTUP_LNK%');" ^
    "$lnk.TargetPath='wscript.exe';" ^
    "$lnk.Arguments=[char]34+'%AUTO%\startup-prompt.vbs'+[char]34;" ^
    "$lnk.Description='Clinora startup prompt';" ^
    "$lnk.Save()"
IF EXIST "%STARTUP_LNK%" (
    echo  [OK]  Auto-start prompt registered for Windows login
) ELSE (
    echo  [WARN] Auto-start shortcut failed - run as Administrator to enable
)

:: ── Done ──────────────────────────────────────────────────────────────────
echo.
echo  =========================================================
echo      SETUP COMPLETE!
echo  =========================================================
echo.
echo  Access URLs:
echo    Doctor    ^(this PC^) : http://localhost:!FRONTEND_PORT!
echo    Pharmacist ^(LAN^)    : http://!LOCAL_IP!:!FRONTEND_PORT!
echo.
echo  Start:  Double-click "Start Clinora" on the desktop
echo  Stop:   Double-click "Stop Clinora" on the desktop
echo.
echo  Doctor uses CHROME, Pharmacist uses EDGE or FIREFOX
echo  ^(Different browsers = separate sessions = no conflict^)
echo.
pause
endlocal
