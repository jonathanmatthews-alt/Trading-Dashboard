/**
 * Formula builders for the Model and Summary tabs.
 * All formula text is generated here so Setup.gs / Tickers.gs stay layout-only.
 *
 * Pine Script port (PP-Lebon, using close as source):
 *   ema     = EMA(close, MA_Period)              alpha = 2/(MA_Period+1)
 *   dev     = close - ema
 *   std     = STDEV(dev_last_N)                  N = STD_Lookback
 *   buy[t]  = dev[t-1] <= -STD_Level * std
 *   sell[t] = dev[t-1] >=  STD_Level * std
 *
 * Bands shown on Summary are centered on current EMA:
 *   band(k) = EMA_now + k * std       for k in STD_LEVELS
 *
 * BBW compression (Yellow):
 *   bbw   = 2 * BB_Mult * STDEV(close, BB_Length) / SMA(close, BB_Length) * 100
 *   yellow= bbw_now < SMA(bbw, BB_Lookback) - BB_Std * STDEV(bbw, BB_Lookback)
 */

/**
 * Closes range starts at the GOOGLEFINANCE spill cell (DATA_START).
 * The first spilled value is the literal "Close" header, which ISNUMBER() filters out.
 */
function _closeRange(colA1) {
  // Use open-ended range so a longer history won't overflow.
  return `${colA1}${MODEL_ROWS.DATA_START}:${colA1}`;
}

/**
 * Shared LET prelude evaluating closes / EMA series / deviation series.
 * Caller wraps with a final return expression.
 */
function _letCore(colA1) {
  const range = _closeRange(colA1);
  return [
    `closesRaw, FILTER(${range}, ISNUMBER(${range}))`,
    `alpha, 2/(MA_Period+1)`,
    // SCAN seeded with 0; first close (non-zero) primes the EMA recurrence.
    `emaSeries, SCAN(0, closesRaw, LAMBDA(a, x, IF(a=0, x, a*(1-alpha) + x*alpha)))`,
    `devSeries, closesRaw - emaSeries`,
    `n, ROWS(closesRaw)`,
    `lbStart, MAX(1, n - STD_Lookback + 1)`,
    `lbLen, MIN(STD_Lookback, n)`,
    `lookbackDev, INDEX(devSeries, SEQUENCE(lbLen, 1, lbStart))`,
  ].join(', ');
}

/**
 * Build formula strings for one ticker column on the Model tab.
 * @param {string} colA1 - column letter on Model, e.g. "B"
 * @return {Object} map of row -> formula (no leading '=')
 */
function buildModelColumnFormulas(colA1) {
  const C = colA1;
  const range = _closeRange(C);
  const closesOnly = `FILTER(${range}, ISNUMBER(${range}))`;

  const f = {};

  // Data length
  f[MODEL_ROWS.DATA_LENGTH] = `IFERROR(ROWS(${closesOnly}), 0)`;

  // Slope / Intercept of close vs index (kept for reference, not used by bands)
  f[MODEL_ROWS.SLOPE]     = `IFERROR(SLOPE(${closesOnly}, SEQUENCE(ROWS(${closesOnly}))),)`;
  f[MODEL_ROWS.INTERCEPT] = `IFERROR(INTERCEPT(${closesOnly}, SEQUENCE(ROWS(${closesOnly}))),)`;

  // STD of deviation over STD_Lookback
  f[MODEL_ROWS.STD] = `IFERROR(LET(${_letCore(C)}, STDEV(lookbackDev)),)`;

  // EMA center (last value of EMA series)
  f[MODEL_ROWS.EMA_CENTER] = `IFERROR(LET(${_letCore(C)}, INDEX(emaSeries, n)),)`;

  // L2L = projected close at end-of-data using slope/intercept
  f[MODEL_ROWS.L2L] = `IFERROR(${C}${MODEL_ROWS.INTERCEPT} + ${C}${MODEL_ROWS.SLOPE} * ${C}${MODEL_ROWS.DATA_LENGTH},)`;

  // STD_Level passthrough (so the model column self-documents its setting)
  f[MODEL_ROWS.STD_LEVEL] = `STD_Level`;

  // 52-week high/low over last 252 closes
  const last252 = `INDEX(${closesOnly}, SEQUENCE(MIN(252, ROWS(${closesOnly})), 1, MAX(1, ROWS(${closesOnly})-252+1)))`;
  f[MODEL_ROWS.WK52_LOW]      = `IFERROR(MIN(${last252}),)`;
  f[MODEL_ROWS.WK52_HIGH]     = `IFERROR(MAX(${last252}),)`;
  f[MODEL_ROWS.PCT_FROM_LOW]  = `IFERROR((${C}${MODEL_ROWS.CLOSE} / ${C}${MODEL_ROWS.WK52_LOW}) - 1,)`;
  f[MODEL_ROWS.PCT_FROM_HIGH] = `IFERROR((${C}${MODEL_ROWS.CLOSE} / ${C}${MODEL_ROWS.WK52_HIGH}) - 1,)`;

  // Current close = last numeric value in the close column
  f[MODEL_ROWS.CLOSE]      = `IFERROR(LOOKUP(2, 1/(ISNUMBER(${range})), ${range}),)`;
  f[MODEL_ROWS.AS_OF_DATE] = `TODAY()`;

  // STD-level price grid: row 19=+2, descending to row 31=-2.
  for (let i = 0; i < STD_LEVELS.length; i++) {
    const row = MODEL_ROWS.STD_GRID_TOP + i;
    const k = STD_LEVELS[STD_LEVELS.length - 1 - i];
    f[row] = `IFERROR(${C}${MODEL_ROWS.EMA_CENTER} + (${k}) * ${C}${MODEL_ROWS.STD},)`;
  }

  // Model High / Low across full history
  f[MODEL_ROWS.MODEL_HIGH] = `IFERROR(MAX(${closesOnly}),)`;
  f[MODEL_ROWS.MODEL_LOW]  = `IFERROR(MIN(${closesOnly}),)`;

  // Signals — evaluate deviation at the previous bar
  f[MODEL_ROWS.BUY_SIGNAL]  = `IFERROR(LET(${_letCore(C)}, INDEX(devSeries, n-1) <= -STD_Level * ${C}${MODEL_ROWS.STD}), FALSE)`;
  f[MODEL_ROWS.SELL_SIGNAL] = `IFERROR(LET(${_letCore(C)}, INDEX(devSeries, n-1) >=  STD_Level * ${C}${MODEL_ROWS.STD}), FALSE)`;

  // Compression (BBW squeeze) — build BBW series over BB_Lookback windows ending at each
  // recent bar, then test the latest against its band threshold.
  const bbwSeries = [
    `MAP(SEQUENCE(MIN(BB_Lookback, ROWS(${closesOnly}) - BB_Length + 1)),`,
    `  LAMBDA(i,`,
    `    LET(`,
    `      tail, MIN(BB_Lookback, ROWS(${closesOnly}) - BB_Length + 1),`,
    `      endIdx, ROWS(${closesOnly}) - tail + i,`,
    `      win, INDEX(${closesOnly}, SEQUENCE(BB_Length, 1, endIdx - BB_Length + 1)),`,
    `      2 * BB_Mult * STDEV(win) / AVERAGE(win) * 100`,
    `    )`,
    `  )`,
    `)`,
  ].join(' ');
  f[MODEL_ROWS.COMPRESSION] = `IFERROR(LET(s, ${bbwSeries}, INDEX(s, ROWS(s)) < AVERAGE(s) - BB_Std * STDEV(s)), FALSE)`;

  // Historical close: GOOGLEFINANCE spill (first row will be the literal "Close" label).
  f[MODEL_ROWS.DATA_START] = `IFERROR(INDEX(GOOGLEFINANCE(${C}${MODEL_ROWS.TICKER}, "close", ${C}${MODEL_ROWS.START_DATE}, TODAY(), LOWER(${C}${MODEL_ROWS.INTERVAL})), , 2), "")`;

  return f;
}

/**
 * Build the formulas for one Summary row.
 * Summary column layout: A Symbol | B Score | C Current Close | D Current Price | E..S STD bands
 */
function buildSummaryRowFormulas(rowIdx, symbol, modelColA1) {
  const f = {};
  const M = modelColA1;

  // Score: signed # of STDs from EMA center.
  f['B'] = `IFERROR((D${rowIdx} - Model!${M}${MODEL_ROWS.EMA_CENTER}) / Model!${M}${MODEL_ROWS.STD},)`;

  // Current close from Model
  f['C'] = `Model!${M}${MODEL_ROWS.CLOSE}`;

  // Live price; fall back to last close if GOOGLEFINANCE("price") doesn't support the symbol.
  f['D'] = `IFERROR(GOOGLEFINANCE(A${rowIdx}, "price"), Model!${M}${MODEL_ROWS.CLOSE})`;

  // STD-level columns E..Q correspond to STD_LEVELS in display order (-2..+2).
  // Model rows 19..31 are descending +2..-2, so STD_LEVELS[i] maps to row 31-i.
  const cols = ['E','F','G','H','I','J','K','L','M','N','O','P','Q'];
  for (let i = 0; i < STD_LEVELS.length; i++) {
    const modelRow = MODEL_ROWS.STD_GRID_BOTTOM - i; // i=0 (-2) -> 31, i=12 (+2) -> 19
    f[cols[i]] = `Model!${M}${modelRow}`;
  }

  return f;
}

/**
 * Settings tab content: [label, value, namedRange].
 */
function getSettingsRows() {
  return [
    ['MA Period',    20,   'MA_Period'],
    ['STD Lookback', 1000, 'STD_Lookback'],
    ['STD Level',    1.5,  'STD_Level'],
    ['BB Length',    20,   'BB_Length'],
    ['BB Mult',      2.0,  'BB_Mult'],
    ['BB Std',       2.0,  'BB_Std'],
    ['BB Lookback',  20,   'BB_Lookback'],
  ];
}

/**
 * Row labels for Model column A.
 */
function getModelRowLabels() {
  const labels = {};
  labels[MODEL_ROWS.TICKER]        = 'Ticker';
  labels[MODEL_ROWS.START_DATE]    = 'Model Start Date';
  labels[MODEL_ROWS.INTERVAL]      = 'Interval';
  labels[MODEL_ROWS.DATA_LENGTH]   = 'Data Length';
  labels[MODEL_ROWS.WEEKLY_OFFSET] = 'If Weekly Offset';
  labels[MODEL_ROWS.SLOPE]         = 'Slope';
  labels[MODEL_ROWS.INTERCEPT]     = 'Intercept';
  labels[MODEL_ROWS.STD]           = 'STD';
  labels[MODEL_ROWS.EMA_CENTER]    = 'EMA Center';
  labels[MODEL_ROWS.L2L]           = 'L2L';
  labels[MODEL_ROWS.STD_LEVEL]     = 'STD Level';
  labels[MODEL_ROWS.WK52_LOW]      = '52 Week Low';
  labels[MODEL_ROWS.WK52_HIGH]     = '52 Week High';
  labels[MODEL_ROWS.PCT_FROM_LOW]  = 'Percent from Low';
  labels[MODEL_ROWS.PCT_FROM_HIGH] = 'Percent from High';
  labels[MODEL_ROWS.CLOSE]         = 'Close';
  labels[MODEL_ROWS.AS_OF_DATE]    = 'As Of';
  for (let i = 0; i < STD_LEVELS.length; i++) {
    const row = MODEL_ROWS.STD_GRID_TOP + i;
    const k = STD_LEVELS[STD_LEVELS.length - 1 - i];
    labels[row] = k.toFixed(2);
  }
  labels[MODEL_ROWS.MODEL_HIGH]   = 'Model High';
  labels[MODEL_ROWS.MODEL_LOW]    = 'Model Low';
  labels[MODEL_ROWS.BUY_SIGNAL]   = 'Buy Signal';
  labels[MODEL_ROWS.SELL_SIGNAL]  = 'Sell Signal';
  labels[MODEL_ROWS.COMPRESSION]  = 'Compression (BBW)';
  labels[MODEL_ROWS.DATA_LABEL]   = 'DATA';
  return labels;
}
