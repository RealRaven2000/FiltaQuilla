REM  create a new build for QuickFolders
set /P filtquillaRev=<revision.txt
set /a oldRev=%filtquillaRev%
set /a filtquillaRev+=1
REM replace previous rev with new
powershell -Command "(gc -en UTF8 manifest.json) -replace 'pre%oldRev%', 'pre%filtquillaRev%' | Out-File manifest.json  -encoding utf8"
"C:\Program Files\7-Zip\7z" a -xr!.svn filtaQuilla-FX.zip manifest.json _locales content defaults locale skin license.txt *.js *.html
echo %filtquillaRev% > revision.txt
move filtaQuilla*.xpi "..\..\..\_Test Versions\4.0\"
powershell -Command "Start-Sleep -m 150"
rename filtaQuilla-FX.zip filtaquilla-4.0pre%filtquillaRev%.xpi