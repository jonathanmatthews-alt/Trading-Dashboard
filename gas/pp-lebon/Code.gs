/**
 * PP-Lebon — extension/compression dashboard.
 * Entry point: menu wiring.
 */

const SHEETS = {
  SUMMARY: 'Summary',
  MODEL: 'Model',
  SETTINGS: 'Settings',
};

const STD_LEVELS = [-2, -1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.5, 2];

// Row layout on Model. Pine Script port only — no linear regression.
const MODEL_ROWS = {
  TICKER: 1,
  START_DATE: 2,
  INTERVAL: 3,
  DATA_LENGTH: 4,
  STD: 6,            // STDEV of (close - EMA) over STD_Lookback bars
  EMA_CENTER: 7,     // last value of EMA(close, MA_Period)
  STD_CENTER: 8,     // last value of SMA(deviation, MA_Period) — Pine "_stdCenter"
  STD_LEVEL: 9,      // passthrough of Settings!STD_Level
  WK52_LOW: 10,
  WK52_HIGH: 11,
  PCT_FROM_LOW: 12,
  PCT_FROM_HIGH: 13,
  CLOSE: 15,         // current close
  AS_OF_DATE: 16,
  STD_GRID_TOP: 18,  // +2 STD row
  STD_GRID_BOTTOM: 30, // -2 STD row (13 levels)
  MODEL_HIGH: 32,
  MODEL_LOW: 33,
  BUY_SIGNAL: 34,
  SELL_SIGNAL: 35,
  COMPRESSION: 36,
  DATA_LABEL: 38,
  DATA_START: 39,
};

const DATA_MAX_ROWS = 2000;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PP-Lebon')
    .addItem('Setup Workbook', 'setupWorkbook')
    .addItem('Reset Workbook (wipe tabs)', 'resetWorkbook')
    .addSeparator()
    .addItem('Add Ticker…', 'promptAddTicker')
    .addItem('Rebuild Ticker (refresh formulas)…', 'promptRebuildTicker')
    .addItem('Remove Ticker…', 'promptRemoveTicker')
    .addSeparator()
    .addItem('Refresh', 'forceRefresh')
    .addToUi();
}

function promptAddTicker() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Add Ticker', 'Enter symbol (e.g. SPY, MSFT, LYC):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const symbol = (resp.getResponseText() || '').trim().toUpperCase();
  if (!symbol) return;
  addTicker(symbol);
}

function promptRebuildTicker() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Rebuild Ticker', 'Symbol to rebuild (re-applies formulas in place):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const symbol = (resp.getResponseText() || '').trim().toUpperCase();
  if (!symbol) return;
  rebuildTicker(symbol);
}

function promptRemoveTicker() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Remove Ticker', 'Symbol to remove:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const symbol = (resp.getResponseText() || '').trim().toUpperCase();
  if (!symbol) return;
  removeTicker(symbol);
}

function forceRefresh() {
  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast('Recalc triggered. GOOGLEFINANCE may take up to 20 min.', 'PP-Lebon', 5);
}

/**
 * Wipe Summary/Model/Settings (and their named ranges) so Setup Workbook can
 * build a clean structure. Use this after the schema changes.
 */
function resetWorkbook() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('Reset Workbook',
    'This will delete the Summary, Model, and Settings tabs and clear named ranges. Continue?',
    ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;

  const ss = SpreadsheetApp.getActive();
  // Remove named ranges we own.
  const owned = ['MA_Period','STD_Lookback','STD_Level','BB_Length','BB_Mult','BB_Std','BB_Lookback'];
  ss.getNamedRanges().forEach(nr => {
    if (owned.indexOf(nr.getName()) !== -1) nr.remove();
  });
  // Delete our sheets (we need at least one sheet to remain in the workbook).
  const names = [SHEETS.SUMMARY, SHEETS.MODEL, SHEETS.SETTINGS];
  const placeholder = ss.insertSheet('_tmp_reset');
  names.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) ss.deleteSheet(sh);
  });
  // Now rebuild.
  setupWorkbook();
  const tmp = ss.getSheetByName('_tmp_reset');
  if (tmp) ss.deleteSheet(tmp);
}
