# ──────────────────────────────────────────────
# CollabEdit — One-click startup script
# Run from the project root:  .\start.ps1
# ──────────────────────────────────────────────

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CollabEdit — Real-Time Collab Editor  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Initialize DB if first run ────────
$dbFile = Join-Path $root "backend\prisma\dev.db"
if (-not (Test-Path $dbFile)) {
    Write-Host "[ DB ] First run — initializing SQLite database..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "backend")
    npx prisma db push --accept-data-loss | Out-Host
    npx prisma generate | Out-Host
    Pop-Location
    Write-Host "[ DB ] Done." -ForegroundColor Green
} else {
    Write-Host "[ DB ] Database already initialized." -ForegroundColor Green
}

# ── Step 2: Start backend in a new terminal ────
Write-Host "[ BE ] Starting backend on http://localhost:3001 ..." -ForegroundColor Yellow
$backendCmd = "cd `"$root\backend`"; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Start-Sleep -Seconds 2

# ── Step 3: Start frontend in a new terminal ──
Write-Host "[ FE ] Starting frontend on http://localhost:5173 ..." -ForegroundColor Yellow
$frontendCmd = "cd `"$root\frontend`"; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 3

# ── Step 4: Open browser ───────────────────────
Write-Host ""
Write-Host "[ OK ] Both servers starting!" -ForegroundColor Green
Write-Host "[ -> ] Opening http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Start-Process "http://localhost:5173"
