#requires -Version 5.1
<#
.SYNOPSIS
  One-time Windows deployment setup for the Trading Dashboard.

.DESCRIPTION
  - Installs pm2 + pm2-windows-startup globally (requires Node + pnpm).
  - Runs migrations, builds, registers the dashboard with pm2.
  - Wires Windows Task Scheduler to call pnpm db:backup daily at 23:55.
  - Saves the pm2 dump so the process resurrects on reboot.

  Run from PowerShell in the repo root:
    powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1

  Re-running is safe — every step is idempotent.
#>

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot
Write-Host "Repo root: $repoRoot" -ForegroundColor Cyan

# ── 1. Verify toolchain ──────────────────────────────────────────────
foreach ($cmd in @("node", "npm", "pnpm")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "$cmd is not on PATH. Install Node.js + pnpm first."
  }
}
Write-Host "✓ node $(node -v) · pnpm $(pnpm -v)" -ForegroundColor Green

# ── 2. Install pm2 + windows-startup helpers globally ────────────────
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Write-Host "Installing pm2 globally..." -ForegroundColor Yellow
  npm install -g pm2 pm2-windows-startup | Out-Null
}
Write-Host "✓ pm2 installed" -ForegroundColor Green

# ── 3. App install + migrate + build ─────────────────────────────────
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install --frozen-lockfile

Write-Host "Running migrations..." -ForegroundColor Yellow
pnpm db:migrate

if (-not (Test-Path "$repoRoot\data.db")) {
  Write-Host "Seeding fresh data.db..." -ForegroundColor Yellow
  pnpm db:seed
} else {
  Write-Host "✓ data.db exists; skipping seed" -ForegroundColor Green
}

Write-Host "Building production bundle..." -ForegroundColor Yellow
pnpm build

# ── 4. Start with pm2 + persist on reboot ────────────────────────────
if (-not (Test-Path "$repoRoot\logs")) {
  New-Item -ItemType Directory -Path "$repoRoot\logs" | Out-Null
}

pm2 delete trading-dashboard 2>$null | Out-Null
pm2 start "$repoRoot\ecosystem.config.cjs"
pm2 save
pm2-startup install
Write-Host "✓ pm2 process started + boot-resurrection registered" -ForegroundColor Green
Write-Host "  open: http://localhost:3000" -ForegroundColor Cyan

# ── 5. Daily backup via Task Scheduler ───────────────────────────────
$taskName = "TradingDashboardBackup"
$existing = schtasks /Query /TN $taskName 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "✓ scheduled task '$taskName' already exists" -ForegroundColor Green
} else {
  $pnpmExe = (Get-Command pnpm).Source
  $action = "`"$pnpmExe`" db:backup"
  Write-Host "Registering daily backup at 23:55..." -ForegroundColor Yellow
  schtasks /Create /TN $taskName `
    /TR "cmd /c cd /d `"$repoRoot`" && $action >> `"$repoRoot\logs\backup.log`" 2>&1" `
    /SC DAILY /ST 23:55 /F | Out-Null
  Write-Host "✓ task '$taskName' scheduled daily 23:55" -ForegroundColor Green
}

Write-Host ""
Write-Host "All set. Useful commands:" -ForegroundColor Cyan
Write-Host "  pm2 status                       # process list"
Write-Host "  pm2 logs trading-dashboard       # live log tail"
Write-Host "  pm2 restart trading-dashboard    # after pulling code"
Write-Host "  pnpm db:backup                   # manual on-demand backup"
Write-Host "  schtasks /Run /TN $taskName       # trigger nightly backup now"
