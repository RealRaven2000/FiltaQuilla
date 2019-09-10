set /P FiltaQuillaRev=<revision.txt
set /a oldRev=%FiltaQuillaRev%
set /a FiltaQuillaRev+=1
pwsh -Command "(gc -en UTF8NoBOM install.rdf) -replace 'pre%oldRev%', 'pre%FiltaQuillaRev%' | Out-File install.rdf"
pwsh -Command "(gc -en UTF8NoBOM manifest.json) -replace 'pre%oldRev%', 'pre%FiltaQuillaRev%' | Out-File manifest.json"
"C:\Program Files\7-Zip\7z" a -xr!.svn FiltaQuilla.zip install.rdf manifest.json chrome.manifest content defaults locale skin license.txt icon.png 
echo %FiltaQuillaRev% > revision.txt
move *.xpi "..\..\..\_Test Versions\1.6\"
rename FiltaQuilla.zip FiltaQuilla-1.6pre%FiltaQuillaRev%.xpi