@echo off
setlocal EnableDelayedExpansion
TITLE Clinora - Starting...

SET AUTOMATION=%~dp0
SET ROOT=%~dp0..
SET BACKEND=%ROOT%\backend
SET FRONTEND=%ROOT%\frontend

:: Load saved config if available
IF EXIST "%AUTOMATION%clinora.config.bat" (
    call "%AUTOMATION%clinora.config.bat"
) ELSE (
    SET CLINORA_IP=localhost
    SET CLINORA_BACKEND_PORT=8000
    SET CLINORA_FRONTEND_PORT=5173
)

cls
echo.
echo  =====================================================
echo      CLINORA - Clinic Management System
echo  =====================================================
echo.

:: ── Kill any existing processes on the ports ──────────────────────────────

echo  Checking for existing server processes...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%CLINORA_BACKEND_PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%CLINORA_FRONTEND_PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a > nul 2>&1
)

:: ── Start backend (Laravel) ───────────────────────────────────────────────

echo  [1/2] Starting backend server  (port %CLINORA_BACKEND_PORT%)...

start "Clinora-Backend" /min cmd /k ^
    "TITLE Clinora Backend [port %CLINORA_BACKEND_PORT%] && ^
     cd /d "%BACKEND%" && ^
     php artisan serve --host=0.0.0.0 --port=%CLINORA_BACKEND_PORT%"

:: Wait for PHP to initialise
timeout /t 4 /nobreak > nul

:: ── Start frontend (Vite dev server) ─────────────────────────────────────

echo  [2/2] Starting frontend server (port %CLINORA_FRONTEND_PORT%)...

start "Clinora-Frontend" /min cmd /k ^
    "TITLE Clinora Frontend [port %CLINORA_FRONTEND_PORT%] && ^
     cd /d "%FRONTEND%" && ^
     npm run dev -- --host 0.0.0.0 --port %CLINORA_FRONTEND_PORT%"

:: Wait for Vite to compile
echo  Waiting for frontend to compile...
timeout /t 7 /nobreak > nul

:: ── Open browser ──────────────────────────────────────────────────────────

echo  Opening browser...
start http://localhost:%CLINORA_FRONTEND_PORT%

:: ── Show access info ──────────────────────────────────────────────────────

cls
echo.
echo  =====================================================
echo      CLINORA IS RUNNING
echo  =====================================================
echo.
echo  ACCESS URLS
echo  -----------
echo  Doctor (this PC)     : http://localhost:%CLINORA_FRONTEND_PORT%
echo  Pharmacist (this PC) : http://localhost:%CLINORA_FRONTEND_PORT%
echo  LAN (other PCs)      : http://%CLINORA_IP%:%CLINORA_FRONTEND_PORT%
echo.
echo  MULTIPLE SIMULTANEOUS LOGINS
echo  -----------------------------
echo  Doctor     -- open CHROME
echo  Pharmacist -- open MICROSOFT EDGE  (or Firefox)
echo.
echo  Using different browsers keeps each login independent.
echo  They will NOT log each other out.
echo.
echo  STOPPING THE SERVERS
echo  ---------------------
echo  Run stop.bat  --or--  close the two minimised
echo  "Clinora Backend" and "Clinora Frontend" windows.
echo.
echo  =====================================================
echo  Close this window when done reading.
echo  =====================================================
echo.
pause
endlocal
