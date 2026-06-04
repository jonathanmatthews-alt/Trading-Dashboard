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

const MODEL_ROWS = {
  TICKER: 1,
  START_DATE: 2,
  INTERVAL: 3,
  DATA_LENGTH: 4,
  WEEKLY_OFFSET: 5,
  SLOPE: 6,
  INTERCEPT: 7,
  STD: 8,
  EMA_CENTER: 9,
  L2L: 10,
  STD_LEVEL: 11,
  WK52_LOW: 12,
  WK52_HIGH: 13,
  PCT_FROM_LOW: 14,
  PCT_FROM_HIGH: 15,
  CLOSE: 17,
  AS_OF_DATE: 18,
  // STD price grid: 19..31 maps to STD_LEVELS reversed (+2 at row 19, -2 at row 31)
  STD_GRID_TOP: 19,
  STD_GRID_BOTTOM: 31,
  MODEL_HIGH: 33,
  MODEL_LOW: 34,
  BUY_SIGNAL: 35,
  SELL_SIGNAL: 36,
  COMPRESSION: 37,
  DATA_LABEL: 39,
  DATA_START: 40,
};

const DATA_MAX_ROWS = 2000; // historical close rows reserved per ticker column

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PP-Lebon')
    .addItem('Setup Workbook', 'setupWorkbook')
    .addSeparator()
    .addItem('Add Ticker…', 'promptAddTicker')
    .addItem('Remove Ticker…', 'promptRemoveTicker')
    .addSeparator()
    .addItem('Refresh', 'forceRefresh')
    .addToUi();
}

function promptAddTicker() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Add Ticker', 'Enter symbol (e.g. LYC, MSFT, .INX):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const symbol = (resp.getResponseText() || '').trim().toUpperCase();
  if (!symbol) return;
  addTicker(symbol);
}

function promptRemoveTicker() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Remove Ticker', 'Enter symbol to remove:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const symbol = (resp.getResponseText() || '').trim().toUpperCase();
  if (!symbol) return;
  removeTicker(symbol);
}

function forceRefresh() {
  const ss = SpreadsheetApp.getActive();
  SpreadsheetApp.flush();
  ss.toast('Recalc triggered. GOOGLEFINANCE may take up to 20 min to refresh prices.', 'PP-Lebon', 5);
}
