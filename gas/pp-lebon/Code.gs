/**
 * PP-Lebon — extension / compression dashboard.
 * Single-file Apps Script port of the PP-Lebon TradingView Pine Script.
 *
 * Only the two signals from the script are surfaced:
 *   - Extension: deviation from EMA crosses ±STD_Level × STDEV(deviation)
 *       above → "Extension Above" (sell-side, red)
 *       below → "Extension Below" (buy-side, blue)
 *   - Compression: BBW < SMA(BBW) − BB_Std × STDEV(BBW)   → yellow
 *
 * Architecture:
 *   - GOOGLEFINANCE spills historical closes into a Model column.
 *   - JavaScript reads those closes and computes EMA / STD / signals.
 *     No fragile sheet array formulas.
 *   - Summary row per ticker; whole row colour-codes the live status.
 *   - Type a symbol into Summary column A and onEdit registers it on Model.
 *     Click PP-Lebon → Refresh All to recompute as data refreshes.
 */

const SHEETS = {
  SUMMARY: 'Summary',
  MODEL:   'Model',
  SETTINGS:'Settings',
};

const ROW = {
  TICKER: 1,
  START_DATE: 2,
  INTERVAL: 3,
  DATA_LENGTH: 4,
  CLOSE: 5,
  AS_OF: 6,
  EMA: 7,
  STD_CENTER: 8,
  STD: 9,
  SCORE: 10,
  WK52_LOW: 11,
  WK52_HIGH: 12,
  PCT_FROM_LOW: 13,
  PCT_FROM_HIGH: 14,
  EXT_ABOVE: 15,
  EXT_BELOW: 16,
  COMPRESSION: 17,
  STATUS: 18,
  DATA_LABEL: 20,
  DATA_START: 21,
};

const MODEL_LABELS = {
  1:  'Ticker',
  2:  'Model Start Date',
  3:  'Interval',
  4:  'Data Length',
  5:  'Close',
  6:  'As Of',
  7:  'EMA Center',
  8:  'STD Center',
  9:  'STD',
  10: 'Score',
  11: '52 Week Low',
  12: '52 Week High',
  13: 'Percent from Low',
  14: 'Percent from High',
  15: 'Extension Above',
  16: 'Extension Below',
  17: 'Compression',
  18: 'Status',
  20: 'DATA',
};

const SETTINGS_ROWS = [
  ['MA Period',    20,   'MA_Period'],
  ['STD Lookback', 1000, 'STD_Lookback'],
  ['STD Level',    1.5,  'STD_Level'],
  ['BB Length',    20,   'BB_Length'],
  ['BB Mult',      2.0,  'BB_Mult'],
  ['BB Std',       2.0,  'BB_Std'],
  ['BB Lookback',  20,   'BB_Lookback'],
];

const DEFAULT_START_DATE = new Date(2022, 0, 1);
const DEFAULT_INTERVAL = 'DAILY';

// ─── Menu & triggers ────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PP-Lebon')
    .addItem('Setup Workbook', 'setupWorkbook')
    .addItem('Reset Workbook (wipe & rebuild)', 'resetWorkbook')
    .addSeparator()
    .addItem('Refresh All', 'refreshAll')
    .addSeparator()
    .addItem('Remove Ticker…', 'promptRemoveTicker')
    .addToUi();
}

/**
 * Simple onEdit: typing a symbol into Summary column A registers it on Model
 * (writes the GOOGLEFINANCE formula + creates a Summary row of lookups).
 * The user clicks Refresh All when GOOGLEFINANCE has loaded.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEETS.SUMMARY) return;
  if (e.range.getColumn() !== 1 || e.range.getRow() < 2) return;

  const raw = String(e.value || '').trim();
  if (!raw) return;
  const symbol = raw.toUpperCase();
  if (raw !== symbol) e.range.setValue(symbol);

  const ss = SpreadsheetApp.getActive();
  const model = ss.getSheetByName(SHEETS.MODEL);
  if (!model) return;
  if (findTickerColumn_(model, symbol) < 0) {
    registerTicker_(symbol);
  }
}

function promptRemoveTicker() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Remove Ticker', 'Symbol to remove:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const symbol = (resp.getResponseText() || '').trim().toUpperCase();
  if (symbol) removeTicker(symbol);
}

// ─── Setup ──────────────────────────────────────────────────────────────────

function setupWorkbook() {
  const ss = SpreadsheetApp.getActive();
  createSettings_(ss);
  createModel_(ss);
  createSummary_(ss);

  const model = ss.getSheetByName(SHEETS.MODEL);
  if (model.getRange(ROW.TICKER, 2).getValue() === '') {
    const summary = ss.getSheetByName(SHEETS.SUMMARY);
    summary.getRange(2, 1).setValue('MSFT');
    registerTicker_('MSFT');
  }
  ss.toast('Setup complete. Give GOOGLEFINANCE ~30s then PP-Lebon → Refresh All.', 'PP-Lebon', 8);
}

function resetWorkbook() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('Reset Workbook',
    'Delete Summary, Model, Settings tabs and rebuild?',
    ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;
  const ss = SpreadsheetApp.getActive();
  const owned = SETTINGS_ROWS.map(r => r[2]);
  ss.getNamedRanges().forEach(nr => {
    if (owned.indexOf(nr.getName()) !== -1) nr.remove();
  });
  const placeholder = ss.insertSheet('_tmp_reset');
  [SHEETS.SUMMARY, SHEETS.MODEL, SHEETS.SETTINGS].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) ss.deleteSheet(sh);
  });
  setupWorkbook();
  const tmp = ss.getSheetByName('_tmp_reset');
  if (tmp) ss.deleteSheet(tmp);
}

function createSettings_(ss) {
  let sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) sheet = ss.insertSheet(SHEETS.SETTINGS);
  if (sheet.getLastRow() > 0) return;
  sheet.getRange(1, 1, 1, 2).setValues([['Setting', 'Value']]).setFontWeight('bold');
  SETTINGS_ROWS.forEach((r, i) => {
    sheet.getRange(i + 2, 1, 1, 2).setValues([[r[0], r[1]]]);
    ss.setNamedRange(r[2], sheet.getRange(i + 2, 2));
  });
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 100);
}

function createModel_(ss) {
  let sheet = ss.getSheetByName(SHEETS.MODEL);
  if (!sheet) sheet = ss.insertSheet(SHEETS.MODEL);
  Object.keys(MODEL_LABELS).forEach(r => {
    const row = Number(r);
    const cell = sheet.getRange(row, 1);
    if (cell.getValue() === '') cell.setValue(MODEL_LABELS[row]);
  });
  sheet.getRange('A:A').setFontWeight('bold');
  sheet.setColumnWidth(1, 180);
  sheet.setFrozenColumns(1);
  sheet.setFrozenRows(1);
}

function createSummary_(ss) {
  let sheet = ss.getSheetByName(SHEETS.SUMMARY);
  if (!sheet) sheet = ss.insertSheet(SHEETS.SUMMARY, 0);
  if (sheet.getLastRow() > 0) return;
  sheet.getRange(1, 1, 1, 6).setValues([['Symbol', 'Price', 'Close', 'Score', 'Status', 'As Of']])
    .setFontWeight('bold');
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 90);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 220);
  sheet.setColumnWidth(6, 130);
  sheet.getRange('B:D').setNumberFormat('0.00');
  sheet.getRange('F:F').setNumberFormat('dd/mm/yyyy hh:mm');
  sheet.setFrozenRows(1);
  applyConditionalFormatting_(sheet);
}

function applyConditionalFormatting_(sheet) {
  const lastRow = Math.max(sheet.getMaxRows(), 100);
  const fullRow = sheet.getRange(2, 1, lastRow - 1, 6);
  const scoreCell = sheet.getRange(2, 4, lastRow - 1, 1);
  const rules = [];

  // Whole row → yellow when Compression in status.
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=ISNUMBER(SEARCH("compression", LOWER($E2)))')
    .setBackground('#fff2cc')
    .setRanges([fullRow]).build());

  // Whole row → blue when Extension Below.
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=ISNUMBER(SEARCH("below", LOWER($E2)))')
    .setBackground('#c9daf8')
    .setRanges([fullRow]).build());

  // Whole row → red when Extension Above.
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=ISNUMBER(SEARCH("above", LOWER($E2)))')
    .setBackground('#f4cccc')
    .setRanges([fullRow]).build());

  // Score column emphasis.
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($D2), $D2>=1.5)')
    .setFontColor('#990000').setBold(true)
    .setRanges([scoreCell]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($D2), $D2<=-1.5)')
    .setFontColor('#003399').setBold(true)
    .setRanges([scoreCell]).build());

  sheet.setConditionalFormatRules(rules);
}

// ─── Ticker management ──────────────────────────────────────────────────────

function registerTicker_(symbol) {
  const ss = SpreadsheetApp.getActive();
  const model = ss.getSheetByName(SHEETS.MODEL);
  const summary = ss.getSheetByName(SHEETS.SUMMARY);
  if (!model || !summary) throw new Error('Run Setup Workbook first.');

  symbol = symbol.toUpperCase();
  if (findTickerColumn_(model, symbol) > 0) return;

  const lastCol = Math.max(2, model.getLastColumn());
  let col = 2;
  for (col = 2; col <= lastCol + 1; col++) {
    if (model.getRange(ROW.TICKER, col).getValue() === '') break;
  }
  const colLetter = colToLetter_(col);

  model.getRange(ROW.TICKER, col).setValue(symbol);
  model.getRange(ROW.START_DATE, col).setValue(DEFAULT_START_DATE).setNumberFormat('dd/mm/yyyy');
  model.getRange(ROW.INTERVAL, col).setValue(DEFAULT_INTERVAL);

  const dataFormula = `=INDEX(GOOGLEFINANCE(${colLetter}${ROW.TICKER}, "close", ${colLetter}${ROW.START_DATE}, TODAY(), LOWER(${colLetter}${ROW.INTERVAL})), , 2)`;
  model.getRange(ROW.DATA_START, col).setFormula(dataFormula);

  ensureSummaryRow_(summary, symbol, colLetter);

  // Try an immediate compute; if data hasn't loaded the status will say so.
  Utilities.sleep(1500);
  SpreadsheetApp.flush();
  refreshTickerColumn_(model, col);
}

function ensureSummaryRow_(summary, symbol, modelColLetter) {
  let row = findSummaryRow_(summary, symbol);
  if (row < 0) {
    row = Math.max(2, summary.getLastRow() + 1);
    summary.getRange(row, 1).setValue(symbol);
  }
  const M = modelColLetter;
  summary.getRange(row, 2).setFormula(`=IFERROR(GOOGLEFINANCE(A${row},"price"), Model!${M}${ROW.CLOSE})`);
  summary.getRange(row, 3).setFormula(`=Model!${M}${ROW.CLOSE}`);
  summary.getRange(row, 4).setFormula(`=Model!${M}${ROW.SCORE}`);
  summary.getRange(row, 5).setFormula(`=Model!${M}${ROW.STATUS}`);
  summary.getRange(row, 6).setFormula(`=Model!${M}${ROW.AS_OF}`);
}

function removeTicker(symbol) {
  const ss = SpreadsheetApp.getActive();
  const model = ss.getSheetByName(SHEETS.MODEL);
  const summary = ss.getSheetByName(SHEETS.SUMMARY);
  symbol = String(symbol).toUpperCase();

  const col = findTickerColumn_(model, symbol);
  if (col > 0) model.getRange(1, col, model.getMaxRows(), 1).clear({contentsOnly: true});
  const row = findSummaryRow_(summary, symbol);
  if (row > 0) summary.deleteRow(row);

  ss.toast(`Removed ${symbol}.`, 'PP-Lebon', 4);
}

// ─── Refresh / signal computation ──────────────────────────────────────────

function refreshAll() {
  const ss = SpreadsheetApp.getActive();
  const model = ss.getSheetByName(SHEETS.MODEL);
  if (!model) throw new Error('Run Setup Workbook first.');
  SpreadsheetApp.flush();
  const lastCol = model.getLastColumn();
  let count = 0;
  for (let col = 2; col <= lastCol; col++) {
    const ticker = model.getRange(ROW.TICKER, col).getValue();
    if (!ticker) continue;
    refreshTickerColumn_(model, col);
    count++;
  }
  ss.toast(`Refreshed ${count} ticker(s).`, 'PP-Lebon', 4);
}

function refreshTickerColumn_(model, col) {
  const settings = readSettings_();
  const lastRow = model.getMaxRows();
  // Skip the header row that GOOGLEFINANCE spills (the "Close" label).
  const vals = model.getRange(ROW.DATA_START + 1, col, lastRow - ROW.DATA_START, 1).getValues();
  const closes = vals.map(v => v[0]).filter(v => typeof v === 'number' && isFinite(v));

  if (closes.length < settings.MA_Period + 5) {
    model.getRange(ROW.STATUS, col).setValue('Loading…');
    model.getRange(ROW.AS_OF, col).setValue(new Date());
    return;
  }

  const s = computeSignals_(closes, settings);

  model.getRange(ROW.DATA_LENGTH, col).setValue(closes.length);
  model.getRange(ROW.CLOSE, col).setValue(s.currentClose);
  model.getRange(ROW.AS_OF, col).setValue(new Date());
  model.getRange(ROW.EMA, col).setValue(s.ema);
  model.getRange(ROW.STD_CENTER, col).setValue(s.stdCenter);
  model.getRange(ROW.STD, col).setValue(s.std);
  model.getRange(ROW.SCORE, col).setValue(s.score);
  model.getRange(ROW.WK52_LOW, col).setValue(s.wk52Low);
  model.getRange(ROW.WK52_HIGH, col).setValue(s.wk52High);
  model.getRange(ROW.PCT_FROM_LOW, col).setValue(s.pctFromLow);
  model.getRange(ROW.PCT_FROM_HIGH, col).setValue(s.pctFromHigh);
  model.getRange(ROW.EXT_ABOVE, col).setValue(s.extAbove);
  model.getRange(ROW.EXT_BELOW, col).setValue(s.extBelow);
  model.getRange(ROW.COMPRESSION, col).setValue(s.compression);
  model.getRange(ROW.STATUS, col).setValue(s.status);

  model.getRange(ROW.CLOSE, col).setNumberFormat('0.00');
  model.getRange(ROW.SCORE, col).setNumberFormat('0.00');
  model.getRange(ROW.AS_OF, col).setNumberFormat('dd/mm/yyyy hh:mm');
  model.getRange(ROW.PCT_FROM_LOW, col, 2, 1).setNumberFormat('0.00%');
}

function readSettings_() {
  const ss = SpreadsheetApp.getActive();
  const result = {};
  SETTINGS_ROWS.forEach(r => {
    const nr = ss.getRangeByName(r[2]);
    result[r[2]] = nr ? Number(nr.getValue()) : r[1];
  });
  return result;
}

/**
 * Pure JS port of the PP-Lebon Pine Script.
 *   ema       = EMA(close, MA_Period)
 *   dev       = close - ema
 *   stdCenter = mean(last MA_Period of dev)              // Pine "_stdCenter"
 *   std       = stdev(last STD_Lookback of dev)
 *   extAbove  = dev_now >= stdCenter + STD_Level * std
 *   extBelow  = dev_now <= stdCenter - STD_Level * std
 *
 *   bbw       = 2 * BB_Mult * stdev(close, BB_Length) / mean(close, BB_Length) * 100
 *   compress  = bbw_now < mean(bbw, BB_Lookback) - BB_Std * stdev(bbw, BB_Lookback)
 *
 *   score     = (current_close - ema_now - stdCenter) / std
 */
function computeSignals_(closes, settings) {
  const n = closes.length;
  const alpha = 2 / (settings.MA_Period + 1);

  const ema = new Array(n);
  ema[0] = closes[0];
  for (let i = 1; i < n; i++) ema[i] = ema[i-1] * (1 - alpha) + closes[i] * alpha;

  const dev = new Array(n);
  for (let i = 0; i < n; i++) dev[i] = closes[i] - ema[i];

  const lookback = Math.min(settings.STD_Lookback, n);
  const std = stdev_(dev.slice(n - lookback));

  const centerLen = Math.min(settings.MA_Period, n);
  const stdCenter = mean_(dev.slice(n - centerLen));

  const currentClose = closes[n-1];
  const currentEma = ema[n-1];
  const currentDev = dev[n-1];

  const extAbove = currentDev >= stdCenter + std * settings.STD_Level;
  const extBelow = currentDev <= stdCenter - std * settings.STD_Level;

  // BBW
  const bbw = [];
  for (let i = settings.BB_Length - 1; i < n; i++) {
    const win = closes.slice(i - settings.BB_Length + 1, i + 1);
    bbw.push((2 * settings.BB_Mult * stdev_(win) / mean_(win)) * 100);
  }
  const bbLook = Math.min(settings.BB_Lookback, bbw.length);
  const lastBbw = bbw.slice(bbw.length - bbLook);
  const compression = bbw[bbw.length-1] < (mean_(lastBbw) - settings.BB_Std * stdev_(lastBbw));

  const wkWin = closes.slice(Math.max(0, n - 252));
  const wk52Low = Math.min.apply(null, wkWin);
  const wk52High = Math.max.apply(null, wkWin);

  const score = (currentClose - currentEma - stdCenter) / std;

  const parts = [];
  if (extAbove) parts.push('Extension Above');
  if (extBelow) parts.push('Extension Below');
  if (compression) parts.push('Compression');
  const status = parts.length ? parts.join(' + ') : 'Neutral';

  return {
    ema: currentEma, stdCenter, std, score,
    currentClose, extAbove, extBelow, compression, status,
    wk52Low, wk52High,
    pctFromLow:  currentClose / wk52Low  - 1,
    pctFromHigh: currentClose / wk52High - 1,
  };
}

function mean_(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function stdev_(arr) {
  if (arr.length < 2) return 0;
  const m = mean_(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
  return Math.sqrt(s / (arr.length - 1));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findTickerColumn_(model, symbol) {
  if (!model) return -1;
  const lastCol = model.getLastColumn();
  if (lastCol < 2) return -1;
  const vals = model.getRange(ROW.TICKER, 2, 1, lastCol - 1).getValues()[0];
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i]).toUpperCase() === symbol) return i + 2;
  }
  return -1;
}

function findSummaryRow_(summary, symbol) {
  if (!summary) return -1;
  const lastRow = summary.getLastRow();
  if (lastRow < 2) return -1;
  const vals = summary.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).toUpperCase() === symbol) return i + 2;
  }
  return -1;
}

function colToLetter_(col) {
  let s = '', n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
