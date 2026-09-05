@echo off
TITLE Clinora - Register Startup Prompt

SET VBS=%~dp0startup-prompt.vbs
SET STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
SET SHORTCUT=%STARTUP%\Clinora.lnk

echo.
echo  Registering Clinora startup prompt...

:: Create a shortcut in the Startup folder pointing to startup-prompt.vbs
powershell -nologo -command ^
    "$s = New-Object -COM WScript.Shell; ^
     $lnk = $s.CreateShortcut('%SHORTCUT%'); ^
     $lnk.TargetPath = 'wscript.exe'; ^
     $lnk.Arguments = '\""%VBS%\""; ^
     $lnk.Description = 'Clinora startup prompt'; ^
     $lnk.Save()"

IF EXIST "%SHORTCUT%" (
    echo  [OK] Clinora will now prompt to start on every Windows login.
    echo.
    echo  Shortcut location:
    echo    %SHORTCUT%
) ELSE (
    echo  [FAIL] Could not create startup shortcut.
    echo  Try running this script as Administrator.
)

echo.
pause
