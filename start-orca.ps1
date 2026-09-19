# ORCA — one-command demo launcher (Windows PowerShell)
#
#   .\start-orca.ps1              # demo mode (default, offline-safe)
#   .\start-orca.ps1 -Live        # try live public marine/weather providers
#
# Serves the pre-built UI and the API together on http://127.0.0.1:8000

param(
    [switch]$Live,
    [int]$Port = 8000,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$dist = Join-Path $root "frontend\dist"

Write-Host ""
Write-Host "  ORCA - Marine EcOsystem Reasoning with Collaborative Agents" -ForegroundColor Cyan
Write-Host "  SIH26176 | Team Random" -ForegroundColor DarkCyan
Write-Host ""

if (-not (Test-Path $dist)) {
    Write-Host "  ! Frontend not built. Building now..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend")
    if (-not (Test-Path "node_modules")) { npm install --no-audit --no-fund }
    npm run build
    Pop-Location
}

$env:PYTHONIOENCODING = "utf-8"
if ($Live) {
    $env:ORCA_DATA_MODE = "LIVE"
    Write-Host "  Data mode : LIVE (falls back to cached demo data on any failure)" -ForegroundColor Green
} else {
    $env:ORCA_DATA_MODE = "DEMO"
    Write-Host "  Data mode : DEMO (cached, clearly labelled - stage safe)" -ForegroundColor Yellow
}
Write-Host "  URL       : http://127.0.0.1:$Port"
Write-Host "  API docs  : http://127.0.0.1:$Port/docs"
Write-Host ""
Write-Host "  Demo links:" -ForegroundColor DarkGray
Write-Host "    /?demo=safe     Goa      - LOW"
Write-Host "    /?demo=danger   Mumbai   - HIGH   (Marathi, the main demo)"
Write-Host "    /?demo=cyclone  Paradip  - EXTREME"
Write-Host "    /?demo=pfz      Kochi    - fishing zones (Hindi)"
Write-Host "    /?demo=route    Mumbai   - safest route + geofence"
Write-Host ""
Write-Host "  Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
        param($p)
        Start-Sleep -Seconds 3
        Start-Process "http://127.0.0.1:$p"
    } -ArgumentList $Port | Out-Null
}

Set-Location $backend
python -m uvicorn app.main:app --host 127.0.0.1 --port $Port
