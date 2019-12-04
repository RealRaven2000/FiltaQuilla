@echo off
setlocal

set MYDIR=%~dp0
powershell -File "%MYDIR%\build.ps1"
