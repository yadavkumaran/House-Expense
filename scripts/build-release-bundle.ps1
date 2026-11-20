$ErrorActionPreference = "Stop"

$keystorePath = Join-Path $PSScriptRoot "..\android\keystores\hearth-upload.jks"
$resolvedKeystore = [System.IO.Path]::GetFullPath($keystorePath)

if (-not (Test-Path -LiteralPath $resolvedKeystore)) {
  throw "Keystore not found at $resolvedKeystore. Please run create-upload-key.ps1 first."
}

Write-Host "Found upload keystore: $resolvedKeystore" -ForegroundColor Cyan

$secureStorePassword = Read-Host -AsSecureString "Enter upload keystore password"
$storePassword = [System.Net.NetworkCredential]::new("", $secureStorePassword).Password

$sameKey = Read-Host "Is the key password the same as keystore password? (Y/n)"
if ($sameKey.Trim().ToLower() -eq "n") {
  $secureKeyPassword = Read-Host -AsSecureString "Enter key password"
  $keyPassword = [System.Net.NetworkCredential]::new("", $secureKeyPassword).Password
} else {
  $keyPassword = $storePassword
}

$env:HEARTH_UPLOAD_KEYSTORE = $resolvedKeystore
$env:HEARTH_UPLOAD_KEY_ALIAS = "hearth-upload"
$env:HEARTH_UPLOAD_STORE_PASSWORD = $storePassword
$env:HEARTH_UPLOAD_KEY_PASSWORD = $keyPassword

try {
  Write-Host "Building release bundle with Gradle..." -ForegroundColor Green
  npm run android:bundleRelease

  $bundlePath = Join-Path $PSScriptRoot "..\android\app\build\outputs\bundle\release\app-release.aab"
  $resolvedBundle = [System.IO.Path]::GetFullPath($bundlePath)

  if (Test-Path -LiteralPath $resolvedBundle) {
    $bundleFile = Get-Item $resolvedBundle
    $sizeMb = [math]::Round($bundleFile.Length / 1MB, 2)
    Write-Host "`nSUCCESS! Release bundle generated successfully:" -ForegroundColor Green
    Write-Host "Path: $resolvedBundle" -ForegroundColor Yellow
    Write-Host "Size: $sizeMb MB" -ForegroundColor Yellow
    Write-Host "`nReady for upload to Google Play Console!" -ForegroundColor Green
  } else {
    Write-Warning "Build finished, but app-release.aab was not found at expected path."
  }
} finally {
  Remove-Item Env:HEARTH_UPLOAD_KEYSTORE -ErrorAction SilentlyContinue
  Remove-Item Env:HEARTH_UPLOAD_KEY_ALIAS -ErrorAction SilentlyContinue
  Remove-Item Env:HEARTH_UPLOAD_STORE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:HEARTH_UPLOAD_KEY_PASSWORD -ErrorAction SilentlyContinue
  $storePassword = $null
  $keyPassword = $null
  $secureStorePassword = $null
  $secureKeyPassword = $null
}
