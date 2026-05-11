# Trading Dashboard — Session Resume

Last commit: `b713f96` on branch `claude/trading-dashboard-setup-8KrnX`.

Everything below was the live state when you stopped to reboot.

---

## Deploy on Windows (cmd shell, after reboot)

### Prerequisites — install once

1. **Node.js LTS** — https://nodejs.org. Run the installer, then **open a
   fresh cmd window** so PATH refreshes.
2. **Git** (only if you don't already have it) — https://git-scm.com.

Verify in cmd:
```cmd
node -v
npm -v
```
Both should print versions.

### Run the installer

From the repo root in cmd:
```cmd
git pull
scripts\setup-windows.cmd
```

That single script:
- installs `pnpm`, `pm2`, `pm2-windows-startup` if missing
- runs migrations
- seeds if `data.db` doesn't yet exist
- builds the production bundle
- registers + starts the pm2 process, saves the dump, installs boot
  resurrection
- creates a daily Task Scheduler job `TradingDashboardBackup` that runs
  `pnpm db:backup` at 23:55 (logs to `logs\backup.log`)

Open http://localhost:3000.

### If the script fails

Paste the exact error message and resume. Most likely failure: Node not
on PATH (reopen cmd) or corporate antivirus blocking npm globals.

Manual fallback (paste line-by-line from repo root):
```cmd
npm install -g pnpm pm2 pm2-windows-startup
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
pm2-startup install
```

### Daily ops

```cmd
pm2 status                       :: is it running?
pm2 logs trading-dashboard       :: live log tail
pm2 restart trading-dashboard    :: after pulling new code
pnpm db:backup                   :: on-demand backup now
schtasks /Run /TN TradingDashboardBackup   :: trigger nightly backup now
```

### After pulling new code

```cmd
git pull
pnpm install
pnpm db:migrate
pnpm build
pm2 restart trading-dashboard
```

### Backups

- Land in `.\backups\data-<timestamp>.db`
- Auto-pruned after 30 days
- Each is a complete standalone SQLite — hot-copied via better-sqlite3's
  online `.backup()` (safe even while pm2 is serving live trades)
- **To restore:** `pm2 stop trading-dashboard`, copy a backup over
  `data.db`, `pm2 start trading-dashboard`

---

## Where we landed feature-wise

Shipped in this branch:
- v1: Today, Trades, Risk, Calendar, Performance, Setups, Mistakes,
  Tendencies, Psychology, Goals, To-Do, Journal, Daily Log, Econ
  Calendar, Import, Fees, Trades Review
- Stage transitions (PROMOTE / Mark Blown / undo + history)
- Full CRUD for accounts, setups, mistakes, tendencies, goals
- Sim/live/payout rule templates per firm
- Goal auto-evaluator (no_trade_after / max_trades_per_day /
  no_mistake_tag) wired into trade actions + Today re-check button
- Per-setup stats panel (linked trades, MAE/MFE histos, monthly PnL,
  equity curve)
- Per-firm fee schedules + per-PA-account fee schedules.
  **Apex MNQ $1.02, PA Tradovate/IBKR MNQ $0.75** confirmed.
  Net PnL everywhere; gross/fees visible in trade drawer per execution.
- Sierra Chart CSV import preset with multi-account routing via
  `accounts.sierraAccountId`. Drop one Apex TSV → it fans out to every
  Apex account once you've set their Sierra IDs.
- Calendar day drawer: per-account net PnL table + news event list +
  impact dots on the cells.
- End-of-day review queue (`/trades/review`) with wizard + list modes.
- Pre-market notes textarea on Today (richer surface deferred per your
  request).
- Windows deployment: pm2 ecosystem, daily backup script, cmd + ps1
  setup scripts.

## Known small gaps you can still do later

- **CSV multi-account auto-routing requires the `sierraAccountId`
  field set on each Apex account.** First import after setup: open each
  Apex row on /risk → Edit → put their Sierra ID (e.g. `E6151`). After
  that the importer auto-maps every file.
- **To-Do interactivity** (checkboxes are read-only today) — you
  dropped this; resurface if you want it.
- **Bulk account ops, options modeling, mobile/phone access** — all
  explicitly out-of-scope.
- **No auth.** The app binds to `localhost:3000` so only your machine
  sees it. If you ever expose it (VPS, port-forward), add auth or use
  Tailscale.

## How to brief a future session

> "Continue from RESUME.md on branch `claude/trading-dashboard-setup-8KrnX`."
