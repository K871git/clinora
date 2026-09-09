@echo off
setlocal EnableDelayedExpansion
TITLE Clinora Uninstall
COLOR 0C

SET ROOT=%~dp0..
SET BACKEND=%ROOT%\backend
SET FRONTEND=%ROOT%\frontend
SET AUTO=%~dp0
IF "%AUTO:~-1%"=="\" SET AUTO=%AUTO:~0,-1%

cls
echo.
echo  =========================================================
echo      CLINORA - Uninstall
echo  =========================================================
echo.
echo  This will:
echo    1. Stop all running Clinora servers
echo    2. Back up the database to your Desktop
echo    3. Remove desktop shortcuts and startup entry
echo    4. Optionally delete vendor and node_modules folders
echo.
echo  The project FILES will NOT be deleted automatically.
echo  You can delete the project folder manually after this.
echo.
SET /p CONFIRM=  Type YES to continue, anything else to cancel:
IF /i NOT "!CONFIRM!"=="YES" (
    echo.
    echo  Cancelled.
    timeout /t 2 /nobreak >nul
    exit /b 0
)

:: ── Stop servers ──────────────────────────────────────────────────────────
echo.
echo  Stopping Clinora servers...

taskkill /F /FI "WindowTitle eq Clinora Backend*" >nul 2>&1
taskkill /F /FI "WindowTitle eq Clinora Frontend*" >nul 2>&1

:: Load port config if available
SET BACKEND_PORT=8000
SET FRONTEND_PORT=5173
IF EXIST "%AUTO%\clinora.config.bat" call "%AUTO%\clinora.config.bat"
IF DEFINED CLINORA_BACKEND_PORT SET BACKEND_PORT=%CLINORA_BACKEND_PORT%
IF DEFINED CLINORA_FRONTEND_PORT SET FRONTEND_PORT=%CLINORA_FRONTEND_PORT%

powershell -nologo -command "Get-NetTCPConnection -LocalPort !BACKEND_PORT! -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -nologo -command "Get-NetTCPConnection -LocalPort !FRONTEND_PORT! -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo  [OK]  Servers stopped

:: ── Database backup ───────────────────────────────────────────────────────
echo.
echo  Backing up database...

SET DESKTOP=%USERPROFILE%\Desktop
SET DB_DRIVER=sqlite

IF EXIST "%BACKEND%\.env" (
    for /f "tokens=2 delims==" %%v in ('findstr /i "^DB_CONNECTION=" "%BACKEND%\.env"') do SET DB_DRIVER=%%v
)

IF /i "!DB_DRIVER!"=="sqlite" (
    SET SQLITE_FILE=%BACKEND%\database\database.sqlite
    IF EXIST "!SQLITE_FILE!" (
        SET BACKUP_NAME=clinora_backup_%DATE:~-4%-%DATE:~3,2%-%DATE:~0,2%.sqlite
        SET BACKUP_NAME=!BACKUP_NAME: =0!
        copy "!SQLITE_FILE!" "%DESKTOP%\!BACKUP_NAME!" >nul
        IF ERRORLEVEL 1 (
            echo  [WARN] Could not copy to Desktop. Trying current user folder...
            copy "!SQLITE_FILE!" "%USERPROFILE%\!BACKUP_NAME!" >nul
            IF NOT ERRORLEVEL 1 echo  [OK]  Backup saved to %USERPROFILE%\!BACKUP_NAME!
        ) ELSE (
            echo  [OK]  Database backed up to Desktop: !BACKUP_NAME!
        )
    ) ELSE (
        echo  [WARN] SQLite database file not found - nothing to back up
    )
) ELSE (
    :: MySQL backup
    SET DB_HOST=127.0.0.1
    SET DB_PORT=3306
    SET DB_DATABASE=clinora
    SET DB_USERNAME=root
    SET DB_PASSWORD=

    IF EXIST "%BACKEND%\.env" (
        for /f "tokens=2 delims==" %%v in ('findstr /i "^DB_HOST=" "%BACKEND%\.env"') do SET DB_HOST=%%v
        for /f "tokens=2 delims==" %%v in ('findstr /i "^DB_PORT=" "%BACKEND%\.env"') do SET DB_PORT=%%v
        for /f "tokens=2 delims==" %%v in ('findstr /i "^DB_DATABASE=" "%BACKEND%\.env"') do SET DB_DATABASE=%%v
        for /f "tokens=2 delims==" %%v in ('findstr /i "^DB_USERNAME=" "%BACKEND%\.env"') do SET DB_USERNAME=%%v
        for /f "tokens=2 delims==" %%v in ('findstr /i "^DB_PASSWORD=" "%BACKEND%\.env"') do SET DB_PASSWORD=%%v
    )

    mysqldump --version >nul 2>&1
    IF ERRORLEVEL 1 (
        echo  [WARN] mysqldump not found in PATH - cannot back up MySQL database automatically.
        echo         Back up the database manually before uninstalling.
    ) ELSE (
        SET BACKUP_SQL=%DESKTOP%\clinora_mysql_backup_%DATE:~-4%-%DATE:~3,2%-%DATE:~0,2%.sql
        SET BACKUP_SQL=!BACKUP_SQL: =0!
        IF "!DB_PASSWORD!"=="" (
            mysqldump -h !DB_HOST! -P !DB_PORT! -u !DB_USERNAME! !DB_DATABASE! > "!BACKUP_SQL!" 2>nul
        ) ELSE (
            mysqldump -h !DB_HOST! -P !DB_PORT! -u !DB_USERNAME! -p!DB_PASSWORD! !DB_DATABASE! > "!BACKUP_SQL!" 2>nul
        )
        IF ERRORLEVEL 1 (
            echo  [WARN] mysqldump failed - check credentials in backend\.env
        ) ELSE (
            echo  [OK]  MySQL database backed up to Desktop: clinora_mysql_backup_*.sql
        )
    )
)

:: ── Remove shortcuts ──────────────────────────────────────────────────────
echo.
echo  Removing shortcuts...

SET STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Clinora.lnk
IF EXIST "%USERPROFILE%\Desktop\Start Clinora.lnk" (
    del "%USERPROFILE%\Desktop\Start Clinora.lnk" >nul 2>&1
    echo  [OK]  Removed "Start Clinora" desktop shortcut
)
IF EXIST "%USERPROFILE%\Desktop\Stop Clinora.lnk" (
    del "%USERPROFILE%\Desktop\Stop Clinora.lnk" >nul 2>&1
    echo  [OK]  Removed "Stop Clinora" desktop shortcut
)
IF EXIST "%STARTUP_LNK%" (
    del "%STARTUP_LNK%" >nul 2>&1
    echo  [OK]  Removed auto-start entry
)

:: ── Optional: clean dependency folders ───────────────────────────────────
echo.
SET /p CLEAN=  Delete vendor and node_modules folders to free disk space? (YES/no):
IF /i "!CLEAN!"=="YES" (
    echo  Deleting vendor folder...
    IF EXIST "%BACKEND%\vendor" (
        rmdir /s /q "%BACKEND%\vendor" 2>nul
        echo  [OK]  vendor deleted
    )
    echo  Deleting node_modules folder...
    IF EXIST "%FRONTEND%\node_modules" (
        rmdir /s /q "%FRONTEND%\node_modules" 2>nul
        echo  [OK]  node_modules deleted
    )
    echo  Deleting frontend dist folder...
    IF EXIST "%FRONTEND%\dist" (
        rmdir /s /q "%FRONTEND%\dist" 2>nul
        echo  [OK]  dist deleted
    )
)

:: ── Done ──────────────────────────────────────────────────────────────────
echo.
echo  =========================================================
echo      UNINSTALL COMPLETE
echo  =========================================================
echo.
echo  Database backup saved to your Desktop.
echo.
echo  To finish: manually delete the project folder if needed:
echo    %ROOT%
echo.
pause
endlocal
