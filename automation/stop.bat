@echo off
setlocal EnableDelayedExpansion
TITLE Clinora - Stopping Servers

SET AUTOMATION=%~dp0

:: Load saved config for port numbers
IF EXIST "%AUTOMATION%clinora.config.bat" (
    call "%AUTOMATION%clinora.config.bat"
) ELSE (
    SET CLINORA_BACKEND_PORT=8000
    SET CLINORA_FRONTEND_PORT=5173
)

echo.
echo  Stopping Clinora servers...
echo.

:: Kill by window title first (closes the cmd windows cleanly)
taskkill /F /FI "WindowTitle eq Clinora-Backend*" > nul 2>&1
taskkill /F /FI "WindowTitle eq Clinora-Frontend*" > nul 2>&1
taskkill /F /FI "WindowTitle eq Clinora Backend*" > nul 2>&1
taskkill /F /FI "WindowTitle eq Clinora Frontend*" > nul 2>&1

:: Kill any remaining process listening on the ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%CLINORA_BACKEND_PORT% " ^| findstr "LISTENING"') do (
    echo  Stopping backend process (PID %%a)...
    taskkill /F /PID %%a > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%CLINORA_FRONTEND_PORT% " ^| findstr "LISTENING"') do (
    echo  Stopping frontend process (PID %%a)...
    taskkill /F /PID %%a > nul 2>&1
)

echo.
echo  All Clinora servers stopped.
echo.
timeout /t 2 /nobreak > nul
endlocal
