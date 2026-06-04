# PP-Lebon — Google Sheets dashboard

Google Apps Script port of the **PP-Lebon** TradingView Pine Script:
extension via EMA-deviation STD bands + compression via BBW squeeze, across a
user-defined list of tickers.

## Tabs

- **Summary** — one row per ticker. Columns: Symbol, Score, Current Close,
  Current Price, then price bands at STD multiples −2 … +2.
- **Model** — one column per ticker. All Pine-Script calculations
  (EMA center, STD of deviation, STD-level price grid, BBW compression, buy/sell
  signals) plus the GOOGLEFINANCE-spilled close history starting at row 40.
- **Settings** — named ranges for the Pine Script parameters
  (`MA_Period`, `STD_Lookback`, `STD_Level`, `BB_Length`, `BB_Mult`, `BB_Std`,
  `BB_Lookback`).

## Deploy

This is a **container-bound** Apps Script project. There's no script ID in
this repo — you push it once per Sheet using
[`clasp`](https://github.com/google/clasp):

```bash
# one-time
npm i -g @google/clasp
clasp login

# in a fresh Google Sheet, Extensions → Apps Script. Copy the script ID from
# Project Settings, then:
cd gas/pp-lebon
cp .clasp.json.example .clasp.json    # then paste your scriptId
clasp push -f
```

Reload the Sheet → a **PP-Lebon** menu appears via `onOpen`.

## Use

1. **PP-Lebon → Setup Workbook** — builds Summary / Model / Settings tabs and
   seeds `.INX` as the first ticker.
2. **PP-Lebon → Add Ticker…** — enter `LYC`, `MP`, etc. A column is appended to
   Model and a row to Summary; GOOGLEFINANCE populates close history within
   ~30 s.
3. **PP-Lebon → Remove Ticker…** — clears the Model column and deletes the
   Summary row.
4. **PP-Lebon → Refresh** — calls `SpreadsheetApp.flush()`. GOOGLEFINANCE
   prices update on Google's own ~20 min cadence; this does not bypass that.

## Score interpretation

- `Score = (Current Price − EMA Center) / STD` — signed # of standard
  deviations from the EMA trend.
- **Sign** = direction: negative = price below trend (potential buy), positive
  = above trend (potential sell).
- **Magnitude** = strength: `|score| ≥ 1.5` (the Pine Script threshold) is
  rendered red and bold; `|score| ≥ 2` adds a red background.
- **Yellow background** = BBW compression firing — Bollinger Band Width sits
  below its lower band; pairs with the script's "yellow bar" condition.

## Calculations (Pine Script → Sheets)

| Pine                         | Sheets                                                   |
|------------------------------|----------------------------------------------------------|
| `_src = close`               | column 2 of `GOOGLEFINANCE(ticker,"close",start,today)`  |
| `_sma = ema(_src, 20)`       | `SCAN(0, closes, LAMBDA(a,x, IF(a=0, x, a*(1-α)+x*α)))` |
| `_rate = _src - _sma`        | element-wise array subtraction                           |
| `_std = stdev(_rate, 1000)`  | `STDEV` over the last `STD_Lookback` values of `_rate`   |
| `buy = _rate[1] <= -1.5σ`    | `INDEX(devSeries, n-1) <= -STD_Level * STD`              |
| `sell = _rate[1] >=  1.5σ`   | `INDEX(devSeries, n-1) >=  STD_Level * STD`              |
| `bbw < SMA(bbw)-2σ` (yellow) | `MAP`/`STDEV`/`AVERAGE` over a rolling BBW series        |

## Notes / limitations

- Source = `close` (not `hlc3` as in Pine) because `GOOGLEFINANCE` returns one
  series per column. Adding high/low fetches is straightforward but doubles
  the column count.
- Heikin Ashi confirmation arrows (`long`/`short` in Pine) are not ported;
  the raw `buy_signal` / `sell_signal` rows on Model expose the threshold
  crossings directly.
- GOOGLEFINANCE only supports daily / weekly history. Intraday timeframes
  aren't available.
- Live price (`Current Price`) is `GOOGLEFINANCE(symbol, "price")` and is
  subject to its ~20 min delay.
