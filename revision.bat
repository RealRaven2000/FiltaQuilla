@echo off
setlocal

set MYDIR=%~dp0
set BKPDIR=%MYDIR%\..\..\_Test Versions\4.0\

move *.xpi "%BKPDIR%">NUL
powershell -Version 3 -File "%MYDIR%\build.ps1" -IncrementRevision
