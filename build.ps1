param([string]$Topdir=(Split-Path $script:MyInvocation.MyCommand.Path),
      [string]$Zip = "C:\Program Files\7-zip\7z",
      [switch]$IncrementRevision)

# Parameters:
#
# $Topdir (-Topdir ".")
#   Top directory with the source code. This is where we get the source files
#   from. The top directory may be given as the first argument. By default it's
#   the directory where this script is found.
#
# $Zip (-Zip "C:\Program Files\7-zip\7z")
#   A path to 7zip.exe.
#
# $InrementRevision (-IncrementRevision)
#   If present, the revision number in "manifest.json" gets incremented before
#   package gets built.

If (!([System.IO.Directory]::Exists($Topdir))) {
  Write-Error "'$Topdir': no such directory"
  exit 1
}

$manifest_json = "$Topdir\manifest.json"
If (!([System.IO.File]::Exists($manifest_json))) {
  Write-Error "'$manifest_json': no such file"
  exit 1
}

$build_manifest = "$Topdir\build.manifest"
If (!([System.IO.File]::Exists($build_manifest))) {
  Write-Error "'$build_manifest': no such file"
  exit 1
}

$versionLineRe = '^ *"version" *: *"([0-9\.]+(-?\w+)?)" *, *$';
$line = (Get-Content -en UTF8 $manifest_json) | Select-String -Pattern $versionLineRe



If ($line) {
  $version = $line.Matches.Groups[1].Value
} Else {
  $version = $null
}

If ($IncrementRevision.IsPresent) {
  if ($version -eq $null) {
    Write-Error "can't increment revision number, version is missing"
    exit 1
  }

  # increment revision number in manifest.json
  $preVersionRe = '^[0-9\.]+-?pre(\d+)$'
  
  $preMatch = ([regex]::Match($version, $preVersionRe))
  if ($preMatch) {
    $oldRev = [int]($preMatch.Groups[1].Value)
    $newRev = $oldRev + 1
    $content=((Get-Content -en UTF8 $manifest_json) -replace "pre$oldRev", "pre$newRev")

    $encoding = New-Object System.Text.UTF8Encoding $False
    [System.IO.File]::WriteAllLines($manifest_json, $content, $encoding)
  } else {
    Write-Error "can't increment revision number, version does not match pattern"
    exit 1
  }

  # re-read the version number from manifest.json
  $line = (Get-Content -en UTF8 $manifest_json) | Select-String -Pattern $versionLineRe
  $version = $line.Matches.Groups[1].Value
}

$fileNames = @(Get-Content -en UTF8 $build_manifest)

If ($version -eq $null) {
  $xpi = "filtaquilla.xpi"
} Else {
  $xpi = "filtaquilla-$version.xpi"
}

$cwd = Get-Location
$xpi = "$cwd\$xpi"


Write-Host "build.ps1: building $xpi... "
Push-Location -Path $Topdir
  & "$Zip" a -y "-xr@.gitignore" "-xr!.git" "$xpi" $fileNames > 7z.log
Pop-Location
Write-Host "done"
