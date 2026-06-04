# PP-Lebon — Google Sheets dashboard

Google Apps Script port of the **PP-Lebon** TradingView Pine Script. Surfaces
exactly the two signals the script produces:

- **Extension** — deviation from EMA crosses `±STD_Level × STDEV(deviation)`
  - above the band → "Extension Above" (sell-side) → **red row**
  - below the band → "Extension Below" (buy-side) → **blue row**
- **Compression** — BBW squeeze below `SMA(BBW) − BB_Std × STDEV(BBW)`
  → **yellow row**

## Files

- **`Code.gs`** — everything: menu wiring, sheet setup, ticker management,
  signal computation. Single file, single paste per update.
- **`appsscript.json`** — manifest (OAuth scopes).

> Earlier versions split into `Setup.gs` / `Tickers.gs` / `Formulas.gs`.
> Those have been consolidated; delete them from your Apps Script project
> after pasting the new `Code.gs`.

## How to use

1. **Setup**: PP-Lebon → Setup Workbook (seeds MSFT).
2. **Add a ticker**: just type the symbol into Summary column A. An onEdit
   trigger registers the ticker on the Model tab and writes the
   `GOOGLEFINANCE` formula.
3. **Refresh**: PP-Lebon → Refresh All. GOOGLEFINANCE history needs ~30 s
   to populate after a new ticker; once it's there, Refresh computes EMA,
   STD, signals, and the Status string.
4. **Remove**: PP-Lebon → Remove Ticker… (or just delete the row on Summary
   and the corresponding column on Model).

## Summary tab columns

| Col | Header | Source |
|-----|--------|--------|
| A | Symbol | you type it |
| B | Price | `GOOGLEFINANCE(symbol,"price")` (live, ~20 min lag) |
| C | Close | last bar's close from Model |
| D | Score | signed STD distance from band centre |
| E | Status | "Extension Above" / "Extension Below" / "Compression" / "Neutral" |
| F | As Of | time the Model row was last refreshed |

**Conditional formatting** (row-wide):
- Yellow when Status contains "Compression"
- Blue when Status contains "Below"
- Red when Status contains "Above"
- Score cell bold red ≥ +1.5, bold blue ≤ −1.5

## Model tab (per-column, one ticker each)

Inputs at the top (Ticker / Start Date / Interval), then computed scalars
(EMA Center, STD Center, STD, Score, 52-week stats, Extension Above,
Extension Below, Compression, Status). The `GOOGLEFINANCE` formula spills
historical closes starting at row 21.

All scalars are written by JavaScript on Refresh — no fragile sheet array
formulas. That means signals don't auto-update on every recalc; click
Refresh All when you want a fresh read.

## Architecture & updates

This is a **single-file Apps Script** project. To update:
1. Pull the latest `Code.gs` from this repo (or copy from GitHub web UI).
2. Paste over the contents of `Code.gs` in your Apps Script project.
3. Save. Reload the Sheet for menu changes to take effect.

For a fully automated push, install [clasp](https://github.com/google/clasp)
locally:
```bash
npm i -g @google/clasp
clasp login
cd gas/pp-lebon
cp .clasp.json.example .clasp.json   # paste your Script ID
clasp push -f
```

## Settings

The `Settings` tab exposes the seven Pine parameters as named ranges
(`MA_Period`, `STD_Lookback`, `STD_Level`, `BB_Length`, `BB_Mult`,
`BB_Std`, `BB_Lookback`). Change values in column B, then Refresh All.
