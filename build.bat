set /P FiltaQuillaRev=<revision.txt
set /a oldRev=%FiltaQuillaRev%
set /a FiltaQuillaRev+=1
rem powershell -Command "(gc -en utf8 install.rdf) -replace 'pre%oldRev%', 'pre%FiltaQuillaRev%' | Out-File install.rdf"
"C:\Program Files\7-Zip\7z" a -xr!.svn FiltaQuilla.zip install.rdf chrome.manifest content defaults locale skin license.txt icon.png 
echo %FiltaQuillaRev% > revision.txt
move *.xpi "..\..\_Test Versions\1.4\"
rename FiltaQuilla.zip FiltaQuilla-1.4.1pre%FiltaQuillaRev%.xpi