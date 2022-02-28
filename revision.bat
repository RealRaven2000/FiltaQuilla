@echo off
setlocal

set MYDIR=%~dp0
set BKPDIR=%MYDIR%\..\..\_Test Versions\3.4\

move *.xpi "%BKPDIR%">NUL
powershell -Version 3 -File "%MYDIR%\build.ps1" -IncrementRevision
