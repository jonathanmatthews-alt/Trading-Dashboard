# Trading Dashboard — Planning Document

Status: **PLANNING IN PROGRESS** (paused mid-batch). Resume by reading
"Resume here" at the bottom.

Visual reference: `/root/.claude/uploads/1366b4d4-7a26-400d-97d3-585b4926b9e9/1abe4dc7-TradingDashbaord_Pics.docx`
(image1 = Trade Log with sidebar, image2 = Patterns detail page,
image3 = equity curve + trade log, image4 = Today landing page,
image5 = calendar, image6 = command-center HUD).

---

## 1. Foundation (locked)

- **Platform**: local web app, run on your machine, opened in browser.
- **Phone access**: dropped for v1. Add later.
- **Data entry**: manual form **and** CSV/broker import (both supported).
- **Instruments v1**: Futures (ES, MES, NQ, MNQ, RTY, M2K, YM, MYM, CL,
  MCL, GC, MGC, etc.) + Options. **Options DEFERRED to v2**, so v1 is
  futures-only. Pre-loaded CME/CBOT futures library (tick size, point
  value, session hours).
- **Trade unit**: one trade = one round-trip position (entry → full exit).
  Scale-ins/scale-outs collapse into a single trade row.
- **Visual**: TIM DASH 2026 (image1/2/4) as the primary skeleton —
  dark navy background, cyan + orange neon accents, monospace section
  headers, left sidebar nav, card-based content.
- **Tech stack**: deferred. I'll propose at plan-exit time. Likely
  Next.js + SQLite + Drizzle + Recharts/ECharts, but not locked.
- **Scope**: just you, just on your machine.

## 2. Information Architecture (locked)

- **One workspace**, not three.
- Shared across all account-types: Setups Library, Tendencies, Psychology,
  Mistakes, Goals, To-Do, Journal, Daily Log, Watchlist.
- **Separate per account-type**: PnL tracking — PA has its own
  Trades / Calendar / Performance views; Prop has its own.
- **Raen** is treated as a prop firm under the Prop section.
- Reference shape of prop rules: lucidtrading.com, tradeify.co,
  apextraderfunding.com.

## 3. Sidebar (locked v3)

```
Daily       Today
            Watchlist
            Journal               (per-trade narrative)

History     Trades
            Calendar
            Performance
            Daily Log             (per-day reflection)

Reference   Setups Library        (also holds Playbook content; absorbed Patterns)
            Tendencies            (self-tagged behavioural biases)
            Psychology            (cognitive bias reference library)
            Mistakes              (catalogue with structured tags)
            Goals                 (process compliance %)
            To-Do                 (Today checklist + Backlog tabs)

Account     Risk / Account State  (real-time per-firm rule status)

Macro       Economic Calendar     (news/event overlay)
```

Dropped: No Man's Land, Cloude Tips, Patterns (merged into Setups Library),
Cheatsheets (folded into Today's pre-market section).

## 4. Prop Modeling (locked)

- **Firms in v1**: Take Profit Trader, Apex Trader Funding, Tradeify,
  Lucid Trading, Raen.
- **Scale**: 20+ concurrent accounts. Build for scale from day 1
  (grid/table views, bulk ops).
- **Stages**: generic stage TYPES under the hood + per-firm display
  labels. Types: `eval`, `sim_funded`, `live_funded`, `payout_active`,
  `blown`, `archived`.
- **Rule engine** must cover ALL of:
  - Core: profit target, drawdown variants (static / trailing intraday
    / trailing EOD with locking), daily loss limit.
  - Compliance: min trading days, consistency % (best-day cap),
    contract scaling per stage, allowed instruments, news/holiday
    restrictions.
  - Payout: cadence, minimums, projected next-payout-date.
  - Costs: activation fees, monthly resets, payout splits, buffers
    retained, net realized PnL.
- **Rule templates**: yes — versioned per firm/program. Per-account
  overrides allowed.
- **Lifecycle**: track state + full transition history per account;
  resets/replacements create NEW account records; bulk operations
  for managing many accounts. (Cohorts not in v1.)
- **Stage transitions**: manual confirm. Dashboard suggests "PROMOTE"
  when criteria met; user clicks to advance.

## 5. Trade Data Model (locked)

- **`TradeEvent`** (one trade idea):
  instrument, direction, entry_time, exit_time, entry_avg, exit_avg,
  MAE_points, MFE_points, **initial_stop (required)**, setup_id,
  mistake_tag_ids[], tendency_tag_ids[], note.
- **`TradeExecution`** (per-account fan-out):
  trade_event_id, account_id, contracts. PnL/MAE/MFE in $ are derived
  by default; per-execution overrides allowed when fills diverge.
- **Copy-trading**: ONE trade idea fans across N accounts simultaneously.
- **MAE / MFE units**: stored in **points**; $-conversion via instrument
  point value; R-multiple derived from initial_stop.
- **Timestamps stored**: entry_time + exit_time only (idea time and
  MAE/MFE times not tracked).
- **PnLDD**: signed `PnL / MFE`, computed for ALL trades (winners and
  losers). Both per-trade and aggregate (avg/sum across a date range).
- **PA accounts**: multiple personal accounts (taxable, IRA, futures,
  options) each with own balance. NO rules engine on PA side.
- **Trade-entry UX**: two-step.
  1. Fast inline log (instrument, direction, entry, exit, MAE, MFE,
     accounts fanned to).
  2. End-of-day review queue prompts for tags / notes / screenshots
     on each unenriched trade.

## 6. Today Page (locked)

- **Hero row, 4 cards** (in this order):
  1. PnL today (all accounts, PA / Prop split).
  2. Trades + win rate + avg R today.
  3. Distance-to-bust on the most-at-risk account.
  4. Process compliance today vs Goals checklist.
- **Section order**:
  Pre-market gameplan → Hero → 1-line takeaway → Today's trades list
  (image4 style) → End-of-day review queue → Process compliance.
- **Default scope**: aggregate across all accounts; PA/Prop toggle at
  top. Per-account drill-down lives in the Risk tab.
- Pre-market section absorbs the dropped "Cheatsheets" content
  (rituals, key levels, position-size calc).

## 7. Reference Tabs — Settled Definitions

- **Setups Library**: master catalogue of named setups + their plans
  (definition, criteria, indicators, gotchas, linked trades, stats).
  Replaces both "Setups" and "Playbook" and "Patterns" from TIM DASH.
- **Tendencies**: your own behavioural biases / habits, self-tagged
  (e.g. "revenge-trade after 2 losses", "size up when green").
  Trades can be tagged with tendencies.
- **Psychology**: reference library of cognitive biases &
  countermeasures (revenge trading, FOMO, anchoring, loss aversion,
  etc.). Read-only-ish reference. Distinct from Mistakes (per-trade)
  and Tendencies (your specific habits).
- **Mistakes**: catalogue of mistake categories ("moved stop",
  "oversized", "chased", "broke rules", "didn't honor plan"). Each
  trade can be tagged with 0-N. Dashboard shows $ cost per mistake
  type, frequency, and PnL correlation.
- **Goals**: process goals only (rules to follow, e.g. "no trade past
  11:30 ET", "max 3 trades per session"). Tracked daily as compliance
  %. Outcome/PnL goals NOT in scope.
- **To-Do**: two tabs — "Today" daily-recurring checklist (resets
  each session, streak tracker) + "Backlog" one-off dashboard
  development tasks.
- **Journal** (per-trade) and **Daily Log** (per-day) are separate.

---

## Resume here (next session)

We were mid-batch when paused. Next batch was going to cover the four
main display tabs in one go:

1. **Watchlist** — per-day watchlist vs persistent levels per instrument
   vs both? Format (cards, table, by-instrument)?
2. **Trades page** — which fields visible by default in the trade list?
   Image1 'TRADE LOG' style (chronological cards with tags) or image3
   tabular style? Filters needed (date, account, firm, setup, mistake)?
3. **Calendar page** — with 20+ accounts, per-account or aggregate
   default? What's in each cell (PnL, # trades, win rate, R)?
   Multiple calendars side-by-side, or one with a filter?
4. **Performance page** — equity curve + which other widgets?
   Drawdown chart, MAE/MFE distribution, PnL by setup, by hour,
   by day-of-week, by instrument, by account, R-distribution.

After those, remaining tabs to design (in suggested order):

5. **Risk / Account State** — the real-time per-firm dashboard.
   This is the most novel page; likely image6 HUD-style.
   Per-account cards/rows showing: distance to target, distance to
   bust, current trailing DD, days traded / min days, consistency %,
   payout countdown, rule-violation alerts. Account grouping by firm.
6. **Setups Library** detail view — image2 'Breakout Trend' style
   (definition, conditions, indicators, gotchas, linked trades, stats).
7. **Tendencies** — table + per-tendency stats page.
8. **Mistakes** — catalogue + per-mistake stats page.
9. **Psychology** — bias library entries.
10. **Goals** — process rules + daily compliance UI.
11. **To-Do** — Today checklist + Backlog.
12. **Journal** — per-trade narrative editor.
13. **Daily Log** — per-day reflection editor.
14. **Watchlist** — pre-market planning surface.
15. **Economic Calendar** — news/event overlay format.

Then the cross-cutting items:

- **Trade entry form** — final field list, layout, fan-out account
  picker UI.
- **End-of-day review queue** — UX of walking through unenriched trades.
- **CSV import** — which broker formats to support first
  (Tradovate, NinjaTrader, ThinkorSwim, TradingView)?
- **Rule engine internals** — how rule violations are detected and
  surfaced. How "distance to bust" is computed live (mark-to-market
  vs end-of-day).
- **Stack & repo skeleton** — propose the actual stack at plan-exit.

Methodology reminder for resumption:
- AskUserQuestion mode for every major decision.
- 3–4 questions per batch.
- After each batch, append/update the relevant section above.
- If an answer reveals a new open question, ask it before moving on.
- Don't lock anything until the user has answered.
