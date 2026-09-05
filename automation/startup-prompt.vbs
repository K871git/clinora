' Clinora Startup Prompt
' Shows a dialog when Windows starts, asking whether to launch Clinora.
' Placed in the Windows Startup folder via install-startup.bat.

Dim scriptDir, startBat, result

' Resolve start.bat relative to this script's location
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
startBat  = scriptDir & "start.bat"

' Ask the user
result = MsgBox( _
    "Start Clinora Clinic Management System?" & vbCrLf & vbCrLf & _
    "Click Yes to start the server and open the app.", _
    vbYesNo + vbQuestion + vbSystemModal, _
    "Clinora" _
)

If result = vbYes Then
    Dim shell
    Set shell = CreateObject("WScript.Shell")
    ' Run start.bat in a normal window (1 = SW_NORMAL)
    shell.Run Chr(34) & startBat & Chr(34), 1, False
    Set shell = Nothing
End If
