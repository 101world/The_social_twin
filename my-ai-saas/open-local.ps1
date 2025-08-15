Param(
  [int]$Port = 3000,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'

function Test-UrlReachable {
  param([string]$Url)
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

$projectPath = $PSScriptRoot
$url = "http://localhost:$Port"

Write-Host "Checking $url ..."
if (-not (Test-UrlReachable -Url $url)) {
  if ($NoStart) {
    Write-Warning "Dev server not reachable and -NoStart specified. Opening browser anyway."
  } else {
    Write-Host "Dev server not detected. Starting it in a new PowerShell window..."
    $startCmd = "cd `"$projectPath`"; npm run dev"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $startCmd | Out-Null
  }

  # Wait up to ~120s for the server to come online
  for ($i = 0; $i -lt 120; $i++) {
    if (Test-UrlReachable -Url $url) { break }
    Start-Sleep -Seconds 1
  }
}

Write-Host "Opening $url in your default browser..."
Start-Process $url


