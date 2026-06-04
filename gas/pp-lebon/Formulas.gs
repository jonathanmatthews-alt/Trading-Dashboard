/**
 * Formula builders for the Model and Summary tabs.
 *
 * Pine Script port (PP-Lebon, using close as source — no linear regression):
 *   ema       = EMA(close, MA_Period)              alpha = 2/(MA_Period+1)
 *   deviation = close - ema
 *   stdCenter = SMA(deviation, MA_Period)          (Pine "_stdCenter")
 *   std       = STDEV(deviation_last_N)            N = STD_Lookback
 *   buy[t]    = deviation[t-1] <= stdCenter - STD_Level * std
 *   sell[t]   = deviation[t-1] >= stdCenter + STD_Level * std
 *
 * Bands shown on Summary, expressed as price levels:
 *   band(k) = EMA_now + stdCenter + k * std        for k in STD_LEVELS
 *
 * BBW compression (Yellow):
 *   bbw   = 2 * BB_Mult * STDEV(close, BB_Length) / SMA(close, BB_Length) * 100
 *   yellow= bbw_now < SMA(bbw, BB_Lookback) - BB_Std * STDEV(bbw, BB_Lookback)
 *
 * Score on Summary:
 *   score = (price - (EMA_now + stdCenter)) / std
 */

function _closeRange(colA1) {
  return `${colA1}${MODEL_ROWS.DATA_START}:${colA1}`;
}

/**
 * Shared LET prelude: closes, EMA series, deviation series, lookback slice.
 * Caller appends a final expression.
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

function buildModelColumnFormulas(colA1) {
  const C = colA1;
  const range = _closeRange(C);
  const closesOnly = `FILTER(${range}, ISNUMBER(${range}))`;

  const f = {};

  f[MODEL_ROWS.DATA_LENGTH] = `IFERROR(ROWS(${closesOnly}), 0)`;

  f[MODEL_ROWS.STD]         = `LET(${_letCore(C)}, STDEV(lookbackDev))`;
  f[MODEL_ROWS.EMA_CENTER]  = `LET(${_letCore(C)}, INDEX(emaSeries, n))`;
  // STD center = average of the last MA_Period deviation values (Pine SMA).
  f[MODEL_ROWS.STD_CENTER]  = `LET(${_letCore(C)}, AVERAGE(INDEX(devSeries, SEQUENCE(MIN(MA_Period, n), 1, MAX(1, n - MA_Period + 1)))))`;
  f[MODEL_ROWS.STD_LEVEL]   = `STD_Level`;

  const last252 = `INDEX(${closesOnly}, SEQUENCE(MIN(252, ROWS(${closesOnly})), 1, MAX(1, ROWS(${closesOnly})-252+1)))`;
  f[MODEL_ROWS.WK52_LOW]      = `MIN(${last252})`;
  f[MODEL_ROWS.WK52_HIGH]     = `MAX(${last252})`;
  f[MODEL_ROWS.PCT_FROM_LOW]  = `IFERROR((${C}${MODEL_ROWS.CLOSE} / ${C}${MODEL_ROWS.WK52_LOW}) - 1,)`;
  f[MODEL_ROWS.PCT_FROM_HIGH] = `IFERROR((${C}${MODEL_ROWS.CLOSE} / ${C}${MODEL_ROWS.WK52_HIGH}) - 1,)`;

  f[MODEL_ROWS.CLOSE]      = `IFERROR(LOOKUP(2, 1/(ISNUMBER(${range})), ${range}),)`;
  f[MODEL_ROWS.AS_OF_DATE] = `TODAY()`;

  // STD-level price grid: row STD_GRID_TOP = +2, descending to STD_GRID_BOTTOM = -2.
  for (let i = 0; i < STD_LEVELS.length; i++) {
    const row = MODEL_ROWS.STD_GRID_TOP + i;
    const k = STD_LEVELS[STD_LEVELS.length - 1 - i];
    f[row] = `${C}${MODEL_ROWS.EMA_CENTER} + ${C}${MODEL_ROWS.STD_CENTER} + (${k}) * ${C}${MODEL_ROWS.STD}`;
  }

  f[MODEL_ROWS.MODEL_HIGH] = `MAX(${closesOnly})`;
  f[MODEL_ROWS.MODEL_LOW]  = `MIN(${closesOnly})`;

  f[MODEL_ROWS.BUY_SIGNAL]  = `LET(${_letCore(C)}, INDEX(devSeries, n-1) <= ${C}${MODEL_ROWS.STD_CENTER} - STD_Level * ${C}${MODEL_ROWS.STD})`;
  f[MODEL_ROWS.SELL_SIGNAL] = `LET(${_letCore(C)}, INDEX(devSeries, n-1) >= ${C}${MODEL_ROWS.STD_CENTER} + STD_Level * ${C}${MODEL_ROWS.STD})`;

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
  f[MODEL_ROWS.COMPRESSION] = `LET(s, ${bbwSeries}, INDEX(s, ROWS(s)) < AVERAGE(s) - BB_Std * STDEV(s))`;

  // Historical close: GOOGLEFINANCE spill. NOT wrapped in IFERROR — we want
  // any error (bad ticker, bad date) to surface, not silently blank the column.
  f[MODEL_ROWS.DATA_START] = `INDEX(GOOGLEFINANCE(${C}${MODEL_ROWS.TICKER}, "close", ${C}${MODEL_ROWS.START_DATE}, TODAY(), LOWER(${C}${MODEL_ROWS.INTERVAL})), , 2)`;

  return f;
}

function buildSummaryRowFormulas(rowIdx, symbol, modelColA1) {
  const f = {};
  const M = modelColA1;

  // Score: signed STDs from (EMA + STD_Center).
  f['B'] = `IFERROR((D${rowIdx} - Model!${M}${MODEL_ROWS.EMA_CENTER} - Model!${M}${MODEL_ROWS.STD_CENTER}) / Model!${M}${MODEL_ROWS.STD},)`;

  f['C'] = `Model!${M}${MODEL_ROWS.CLOSE}`;
  f['D'] = `IFERROR(GOOGLEFINANCE(A${rowIdx}, "price"), Model!${M}${MODEL_ROWS.CLOSE})`;

  // STD-level columns E..Q map STD_LEVELS[-2..+2] to Model rows STD_GRID_BOTTOM..STD_GRID_TOP.
  const cols = ['E','F','G','H','I','J','K','L','M','N','O','P','Q'];
  for (let i = 0; i < STD_LEVELS.length; i++) {
    const modelRow = MODEL_ROWS.STD_GRID_BOTTOM - i;
    f[cols[i]] = `Model!${M}${modelRow}`;
  }

  return f;
}

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

function getModelRowLabels() {
  const labels = {};
  labels[MODEL_ROWS.TICKER]        = 'Ticker';
  labels[MODEL_ROWS.START_DATE]    = 'Model Start Date';
  labels[MODEL_ROWS.INTERVAL]      = 'Interval';
  labels[MODEL_ROWS.DATA_LENGTH]   = 'Data Length';
  labels[MODEL_ROWS.STD]           = 'STD';
  labels[MODEL_ROWS.EMA_CENTER]    = 'EMA Center';
  labels[MODEL_ROWS.STD_CENTER]    = 'STD Center';
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
