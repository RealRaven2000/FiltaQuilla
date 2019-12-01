set /P FiltaQuillaRev=<revision.txt
set /a oldRev=%FiltaQuillaRev%
set /a FiltaQuillaRev+=1
pwsh -Command "(gc -en UTF8NoBOM install.rdf) -replace 'pre%oldRev%', 'pre%FiltaQuillaRev%' | Out-File install.rdf"
"C:\Program Files\7-Zip\7z" a -xr!.svn FiltaQuilla.zip install.rdf chrome.manifest content defaults locale skin license.txt icon.png
echo %FiltaQuillaRev% > revision.txt
move *.xpi "..\..\_Test Versions\1.5\"
rename FiltaQuilla.zip FiltaQuilla-1.5pre%FiltaQuillaRev%.xpi