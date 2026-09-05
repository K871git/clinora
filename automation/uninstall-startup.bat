@echo off
TITLE Clinora - Remove Startup Prompt

SET STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
SET SHORTCUT=%STARTUP%\Clinora.lnk

echo.
IF EXIST "%SHORTCUT%" (
    del "%SHORTCUT%"
    echo  [OK] Clinora startup prompt removed.
) ELSE (
    echo  Clinora startup prompt was not registered — nothing to remove.
)
echo.
pause
