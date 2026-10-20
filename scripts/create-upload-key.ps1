$ErrorActionPreference = "Stop"

$keystoreDirectory = Join-Path $PSScriptRoot "..\android\keystores"
$keystorePath = Join-Path $keystoreDirectory "hearth-upload.jks"
$resolvedKeystorePath = [System.IO.Path]::GetFullPath($keystorePath)
$keytool = $null

if ($env:JAVA_HOME) {
  $javaHomeKeytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
  if (Test-Path -LiteralPath $javaHomeKeytool) {
    $keytool = $javaHomeKeytool
  }
}

if (-not $keytool) {
  $keytoolCommand = Get-Command keytool.exe -ErrorAction SilentlyContinue
  if ($null -eq $keytoolCommand) {
    throw "keytool.exe was not found. Install a JDK and set JAVA_HOME or add keytool.exe to PATH."
  }
  $keytool = $keytoolCommand.Source
}

if (Test-Path -LiteralPath $resolvedKeystorePath) {
  throw "Upload keystore already exists at $resolvedKeystorePath. It was not overwritten."
}

New-Item -ItemType Directory -Path $keystoreDirectory -Force | Out-Null

Write-Host "Creating a new Play upload key. keytool will prompt for passwords and certificate details."
Write-Host "Do not reuse a password. Store a secure offline backup of the resulting keystore."
& $keytool -genkeypair -v `
  -keystore $resolvedKeystorePath `
  -alias hearth-upload `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000

if ($LASTEXITCODE -ne 0) {
  throw "keytool failed to create the upload keystore."
}

Write-Host "Upload keystore created at $resolvedKeystorePath"
Write-Host "Alias: hearth-upload"
Write-Host "The keystore is ignored by Git and must be backed up securely."
