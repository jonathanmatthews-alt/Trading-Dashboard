# Trading Dashboard — Planning Document

Status: **PLANNING COMPLETE.** Ready to exit plan mode and begin
implementation. Final stack and full v1 spec below.

Visual reference: `/root/.claude/uploads/1366b4d4-7a26-400d-97d3-585b4926b9e9/1abe4dc7-TradingDashbaord_Pics.docx`
(image1 = Trade Log with sidebar, image2 = Patterns detail page,
image3 = equity curve + trade log, image4 = Today landing page,
image5 = calendar, image6 = command-center HUD).

---

## 1. Foundation

- **Platform**: local web app, run on your machine, opened in browser.
- **Phone access**: dropped for v1.
- **Data entry**: manual form **and** generic CSV import (column-mapper
  with named importer profiles, works for any broker).
- **Instruments v1**: futures only (ES, MES, NQ, MNQ, RTY, M2K, YM,
  MYM, CL, MCL, GC, MGC, etc.). Pre-loaded CME/CBOT specs library
  (tick size, point value, session hours). **Options deferred to v2.**
- **Trade unit**: one trade = one round-trip position (entry → full
  exit). Scale-ins/scale-outs collapse into a single trade row.
- **Visual**: TIM DASH 2026 (image1/2/4) — dark navy + cyan/orange
  neon, monospace headers, left sidebar nav, card-based content.
- **Scope**: just you, just on your machine.

## 2. Stack (locked)

- **Framework**: Next.js 15 (App Router) + TypeScript.
- **Styling**: Tailwind v4 + shadcn/ui (themed dark/neon for the
  TIM DASH look) + Lucide icons.
- **DB**: SQLite (file in repo) + Drizzle ORM.
- **Charts**: Recharts (equity curves, drawdown, distributions,
  attribution bars, sparklines). Custom component for the calendar.
- **Tables**: TanStack Table for the dense Risk dashboard.
- **Validation**: zod on every form / API boundary.
- **Dev**: `pnpm dev`, single Node process. No worker.

## 3. Information Architecture

- One workspace.
- **Shared** across all account-types: Setups Library, Tendencies,
  Psychology, Mistakes, Goals, To-Do, Journal, Daily Log.
- **Separate per account-type**: PnL tracking — PA has its own
  Trades / Calendar / Performance views; Prop has its own.
- **Raen** is treated as a prop firm under the Prop section.

## 4. Sidebar (final)

```
Daily       Today
            Journal               (per-trade narrative reader)

History     Trades
            Calendar
            Performance
            Daily Log             (per-day reflection)

Reference   Setups Library        (absorbed Playbook + Patterns)
            Tendencies            (self-tagged behavioural biases)
            Psychology            (cognitive bias reference library)
            Mistakes              (catalogue with structured tags)
            Goals                 (process compliance %)
            To-Do                 (Today checklist + Backlog)

Account     Risk / Account State  (real-time per-firm rule status)

Macro       Economic Calendar     (auto-pulled news feed + manual)
```

Dropped: No Man's Land · Cloude Tips · Patterns (merged) ·
Cheatsheets (folded into Today) · **Watchlist** (folded into Today's
pre-market section).

## 5. Data Model

### Trade

- **`TradeEvent`** (one trade idea):
  instrument, direction, entry_time, exit_time, entry_avg, exit_avg,
  MAE_points, MFE_points, **initial_stop (required)**, setup_id,
  mistake_tag_ids[], tendency_tag_ids[], note.
- **`TradeExecution`** (per-account fan-out):
  trade_event_id, account_id, contracts. PnL/MAE/MFE in $ derived
  by default; per-execution overrides allowed when fills diverge.
- **Copy-trading**: ONE TradeEvent fans across N TradeExecutions
  simultaneously.
- **MAE / MFE**: stored in **points**; $ via instrument point value;
  R-multiple from initial_stop.
- **Timestamps stored**: entry_time + exit_time only.
- **PnLDD**: signed `PnL / MFE`, computed for ALL trades. Both
  per-trade and aggregate.

### Accounts

- **PA accounts**: multiple personal accounts (taxable, IRA, futures,
  etc.) each with own balance. **NO rules engine on PA side.**
- **Prop accounts**: under firms `Take Profit Trader, Apex, Tradeify,
  Lucid, Raen` (5 firms). 20+ concurrent. Build for scale.
- `Firm` → `Program` (e.g. "Apex 100K Eval") → `RuleTemplate`
  (versioned) → `Account`. Per-account overrides allowed on rules.
- `Account.state`: `eval` | `sim_funded` | `live_funded` |
  `payout_active` | `blown` | `archived`.
- Generic stage TYPES + per-firm display labels.
- Resets/replacements create NEW account records (preserves
  blown-rate stats over time).
- Bulk operations supported.
- Stage transitions: **manual confirm** — dashboard suggests
  "PROMOTE" when criteria met; user clicks to advance.
- Full transition history per account.

### Rule engine

- **Closed-trades only** — account state recomputes per logged trade.
  No intra-trade live equity. Distance-to-bust = realized PnL only.
- Rules covered:
  - **Core**: profit target; drawdown variants (static / trailing
    intraday / trailing EOD with locking); daily loss limit.
  - **Compliance**: min trading days; consistency % (best-day cap);
    contract scaling per stage; allowed instruments; news/holiday
    restrictions.
  - **Payout**: cadence; minimums; projected next-payout-date.
  - **Costs**: activation fees; monthly resets; payout splits;
    buffers retained; net realized PnL.

### Catalogues (seed-shipped, select-only on trade entry)

- ~10 common futures setups (Breakout Trend, Failed Test, Opening
  Drive, Fade VWAP, IB Break, OR Break, etc.)
- ~12 common mistakes (moved stop, oversized, chased, traded news,
  broke rules, didn't honor plan, etc.)
- ~8 common tendencies (revenge-trade, FOMO, anchor,
  size-up-when-green, etc.)
- ~10 cognitive biases.

User edits/deletes/adds. Trade-entry tag pickers are
**select-only** — no quick-add — so catalogues stay curated.

## 6. Tab Specs

### Today (locked)

- Hero row, 4 cards: PnL today (PA/Prop split) · Trades + WR + avg R ·
  Distance-to-bust on most-at-risk account · Process compliance.
- Section order: **Pre-market gameplan** (absorbed Cheatsheets +
  Watchlist content: rituals, key levels, expected setups, news,
  position-size calc) → Hero → 1-line takeaway → Today's trades list
  (image4 style) → End-of-day review queue → Process compliance.
- Default scope: aggregate; PA/Prop toggle.
- Per-account drill-down lives in Risk tab.

### Trades (locked)

- Default columns: date · instrument · direction · entry · exit ·
  contracts (or "across N accts") · $PnL · R · MAE · MFE · PnLDD ·
  setup · mistakes · accounts-fanned-to.
- Row click → **right-side drawer** with full detail (per-account
  execution breakdown, screenshots, journal note, bars).
- Filters v1: **Core** (date / account-type / firm / account /
  instrument) + **Outcome** (win/loss / R-bucket / PnLDD-bucket).
  Tag and time/context filters deferred to v2.

### Calendar (locked)

- Image5-style monthly grid.
- Each cell: aggregate PnL across all accounts + intraday equity
  sparkline.
- Day click → right-side drawer: header · intraday chart (full-size)
  · trades list · per-account table · link to that day's Daily Log.

### Performance (locked)

- Date range toolbar: 7D / 30D / 90D / YTD / 1Y / All + custom
  picker. Default 30D.
- Widgets v1:
  1. Equity curve (PA / Prop separate lines, drawdown shaded).
  2. Edge-attribution bars: PnL by setup / instrument / DoW / HoD /
     mistake-tag / tendency-tag.
  3. Distribution histograms: MAE (R), MFE (R), PnLDD.
- Deferred to v2: streaks, max DD vs current DD, expectancy,
  profit factor.

### Risk / Account State (locked)

- **Spreadsheet-style table.** Sortable, dense. Scales to 20+ rows.
- Default columns: identity (firm + program + #) · balance · PnL
  today · target/bust progress bars · payout countdown · projected
  payout amount.
- Toggleable additional columns: stage badge · DD type/value ·
  days traded vs min · consistency % · days-in-stage · last-payout-
  date.
- Row click → drawer with full account detail (rules, transition
  history, all trades on this account, projected payout schedule).
- Grouping: **by firm** with section headers; within each firm,
  sort by stage then danger.
- Alerts: **on the affected row** only (red border + warning icon).
  No central feed.

### Setups Library (locked)

- **Two-pane** docs-site layout: list left (collapsible categories),
  detail right.
- Detail sections (image2 'Breakout Trend' reference):
  1. Definition: criteria · anti-criteria · indicators · gotchas.
  2. Trading plan: entry · stop · target · sizing · allowed contexts.
     (Absorbs the old "Playbook" content.)
  3. Stats panel: WR · expectancy · MAE/MFE distributions · monthly
     PnL · per-setup equity curve.
  4. Linked trades: recent trades using this setup (click → Trade
     drawer).
- New setup = blank form; only `name` + `category` required.

### Mistakes (locked)

- Two-pane layout matching Setups (consistency).
- Detail sections: definition · triggers · $ cost · prevention
  checklist · stats · linked trades.

### Tendencies (deferred layout — but most likely matches Setups/
Mistakes two-pane pattern; will revisit during build).

### Psychology (deferred layout — likely two-pane read-mostly with
optional cross-links to Tendencies/Mistakes; will revisit during
build).

### Goals (locked)

- Two goal types:
  - **Mechanical** — has a machine-checkable definition (e.g. "no
    trade past 11:30 ET" → scan day's trades, auto pass/fail).
  - **Reflective** — manual checkbox at end-of-day.
- Daily compliance score = pass count / total. Surfaces in Today's
  hero card.

### To-Do (deferred depth — minimal version: recurring checklist with
streaks + simple backlog list. Decide between simple/Kanban/sub-tasks
during build.)

### Journal (per-trade reader, locked)

- Notes live ON the trade itself (markdown editor in the trade
  drawer).
- Journal sidebar = chronological reader of all trade notes with
  trade context (instrument / PnL / R) as header. Click → trade
  drawer.

### Daily Log (locked)

- One free-form markdown entry per session date.
- Small state header: mood slider · sleep hours · was-tilted Y/N.
- The 1-line takeaway on Today is the first line of this entry.
- Section view = list of past entries.

### Economic Calendar (locked)

- Auto-pulled feed (free public source / scrape) with manual
  override. High/medium/low impact flags.
- Days auto-tagged with news flag visible on the Calendar tab cells.

## 7. Trade Entry Workflow

- **Step 1 — Fast log** (8 fields, ~20s): instrument · direction ·
  entry · exit · MAE (points) · MFE (points) · initial_stop (points)
  · accounts-fanned-to with contracts each. **No tags inline.**
- **Step 2 — End-of-day review queue**: toggleable wizard / list,
  default **wizard** (one-trade-at-a-time, focused page, prompts for
  setup / mistakes / tendencies / journal note / screenshot, with
  progress bar and skip option).

## 8. Out of Scope for v1

- Options modeling.
- Phone access.
- Tag and time/context filters on Trades page.
- Streaks / max DD / expectancy / profit factor on Performance.
- Live/intra-trade rule engine.
- Per-broker CSV importers (only generic mapper).
- Account cohorts / groups.
- Outcome (PnL) goals.

---

## Implementation order (proposed)

Once the user confirms exit-plan-mode:

1. **Repo skeleton**: Next.js 15 + TS + Tailwind + shadcn/ui +
   Drizzle + SQLite + zod. Folder layout. Theme tokens for the
   TIM DASH dark/neon palette.
2. **Schema + migrations**: instruments, firms, programs, rule
   templates (versioned), accounts, account_transitions,
   trade_events, trade_executions, setups, mistakes, tendencies,
   biases, goals, daily_logs, importer_profiles, news_events.
3. **Seed data**: CME/CBOT instrument library; firms + sample
   programs; ~10 setups, ~12 mistakes, ~8 tendencies, ~10 biases.
4. **App shell**: sidebar nav + theme + layout.
5. **Trade entry fast-log + Trades page** (drawer + drawer detail).
6. **Risk dashboard** (table + drawer). This is where the rule
   engine first surfaces; keep it closed-trades-only.
7. **Today page** (hero + sections; pre-market widgets).
8. **Calendar + Performance**.
9. **Reference tabs** (Setups, Mistakes, Tendencies, Psychology,
   Goals, To-Do, Daily Log, Journal reader).
10. **CSV column-mapper importer**.
11. **Economic Calendar feed integration**.
