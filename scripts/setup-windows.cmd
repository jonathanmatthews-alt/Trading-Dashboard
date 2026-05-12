@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  One-time Windows setup for the Trading Dashboard. Works in cmd.exe.
REM  Run from the repo root:
REM     scripts\setup-windows.cmd
REM  Re-running is safe — every step is idempotent.
REM
REM  This script uses npm exclusively (NOT pnpm) because pnpm v10+
REM  silently blocks better-sqlite3's native-binding postinstall script,
REM  and re-blocks it every time pnpm is invoked. npm has no such gating.
REM ─────────────────────────────────────────────────────────────────────
setlocal EnableExtensions EnableDelayedExpansion

REM Move to repo root (the parent of scripts\)
pushd "%~dp0\.."
set "REPO_ROOT=%CD%"
echo Repo root: %REPO_ROOT%
echo.

REM ── 1. Verify toolchain ─────────────────────────────────────────────
where /Q node || (
  echo [X] node is not on PATH.
  echo     Install Node.js 22 LTS from https://nodejs.org then re-open cmd.
  goto :fail
)
where /Q npm || (
  echo [X] npm is not on PATH.
  goto :fail
)
echo.
for /f "tokens=*" %%v in ('node -v') do set "NODE_V=%%v"
for /f "tokens=*" %%v in ('npm -v') do set "NPM_V=%%v"
echo [OK] node %NODE_V% / npm %NPM_V%
echo.

REM ── 2. Install pm2 + windows-startup helpers globally ───────────────
where /Q pm2
if errorlevel 1 (
  echo Installing pm2 globally...
  call npm install -g pm2 pm2-windows-startup || goto :fail
)
echo [OK] pm2 ready
echo.

REM ── 3. App install + migrate + build (all npm) ──────────────────────
echo Installing dependencies...
call npm install --no-audit --no-fund --loglevel=error || goto :fail

echo Verifying better-sqlite3 native binding...
if not exist "%REPO_ROOT%\node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo [!] Native binding missing; rebuilding...
  call npm rebuild better-sqlite3 || goto :fail
)
if not exist "%REPO_ROOT%\node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo [X] better-sqlite3 binding still missing after rebuild.
  echo     This usually means prebuild-install could not download the .node
  echo     file and there are no Visual Studio C++ Build Tools to compile
  echo     from source. Install "Build Tools for Visual Studio" with the
  echo     Desktop development with C++ workload, then re-run this script.
  goto :fail
)
echo [OK] better-sqlite3 native binding present
echo.

echo Running migrations...
call npm run db:migrate || goto :fail

if not exist "%REPO_ROOT%\data.db" (
  echo Seeding fresh data.db...
  call npm run db:seed || goto :fail
) else (
  echo [OK] data.db exists; skipping seed
)

echo Building production bundle...
call npm run build || goto :fail
echo.

REM ── 4. Start with pm2 + persist on reboot ───────────────────────────
if not exist "%REPO_ROOT%\logs" mkdir "%REPO_ROOT%\logs"

call pm2 delete trading-dashboard >nul 2>&1
call pm2 start "%REPO_ROOT%\ecosystem.config.cjs" || goto :fail
call pm2 save || goto :fail
call pm2-startup install
echo.
echo [OK] pm2 running. Open http://localhost:3000
echo.

REM ── 5. Daily backup via Task Scheduler ──────────────────────────────
set "TASK_NAME=TradingDashboardBackup"
schtasks /Query /TN %TASK_NAME% >nul 2>&1
if not errorlevel 1 (
  echo [OK] scheduled task '%TASK_NAME%' already exists
) else (
  echo Registering daily backup at 23:55...
  schtasks /Create /TN %TASK_NAME% ^
    /TR "cmd /c cd /d \"%REPO_ROOT%\" ^&^& npm run db:backup >> \"%REPO_ROOT%\logs\backup.log\" 2>&1" ^
    /SC DAILY /ST 23:55 /F >nul || goto :fail
  echo [OK] task '%TASK_NAME%' scheduled daily 23:55
)
echo.

echo ─────────────────────────────────────────────────────────────────────
echo All set. Useful commands:
echo   pm2 status                       (process list)
echo   pm2 logs trading-dashboard       (live log tail)
echo   pm2 restart trading-dashboard    (after pulling code)
echo   npm run db:backup                (manual on-demand backup)
echo   schtasks /Run /TN %TASK_NAME%    (trigger nightly backup now)
echo ─────────────────────────────────────────────────────────────────────
popd
endlocal
exit /b 0

:fail
echo.
echo [X] Setup failed. See output above.
popd
endlocal
exit /b 1
