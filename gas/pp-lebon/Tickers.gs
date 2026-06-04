/**
 * Ticker management.
 *
 *   addTicker(symbol)    — appends a new column on Model and a new row on Summary,
 *                          populating headers + formulas. Idempotent: re-adding an
 *                          existing symbol is a no-op.
 *   removeTicker(symbol) — clears the Model column for the symbol and removes its
 *                          Summary row. The Model column is left in place (cleared)
 *                          so subsequent column letters in formulas don't shift.
 */

const DEFAULT_START_DATE = new Date(2024, 0, 1); // 01/01/2024
const DEFAULT_INTERVAL = 'DAILY';

function addTicker(symbol) {
  const ss = SpreadsheetApp.getActive();
  const model = ss.getSheetByName(SHEETS.MODEL);
  const summary = ss.getSheetByName(SHEETS.SUMMARY);
  if (!model || !summary) {
    throw new Error('Workbook not initialized. Run Setup Workbook first.');
  }
  symbol = String(symbol).trim().toUpperCase();
  if (!symbol) return;

  const existingCol = findTickerColumn_(model, symbol);
  if (existingCol > 0) {
    SpreadsheetApp.getActive().toast(`${symbol} already exists.`, 'PP-Lebon', 4);
    return;
  }

  // Pick the next available Model column: first column from B onward whose ticker cell is blank.
  const lastCol = Math.max(2, model.getLastColumn());
  let col = 2;
  for (col = 2; col <= lastCol + 1; col++) {
    if (model.getRange(MODEL_ROWS.TICKER, col).getValue() === '') break;
  }
  const colLetter = columnToLetter_(col);

  // Inputs
  model.getRange(MODEL_ROWS.TICKER, col).setValue(symbol);
  model.getRange(MODEL_ROWS.START_DATE, col).setValue(DEFAULT_START_DATE).setNumberFormat('dd/mm/yyyy');
  model.getRange(MODEL_ROWS.INTERVAL, col).setValue(DEFAULT_INTERVAL);

  // Formulas
  const formulas = buildModelColumnFormulas(colLetter);
  Object.keys(formulas).forEach((rowStr) => {
    const row = Number(rowStr);
    model.getRange(row, col).setFormula('=' + formulas[row]);
  });

  // Formatting on key cells
  model.getRange(MODEL_ROWS.CLOSE, col).setNumberFormat('0.00').setFontWeight('bold');
  model.getRange(MODEL_ROWS.AS_OF_DATE, col).setNumberFormat('dd/mm/yyyy');
  model.getRange(MODEL_ROWS.STD_GRID_TOP, col, STD_LEVELS.length, 1).setNumberFormat('0.00');
  model.getRange(MODEL_ROWS.PCT_FROM_LOW, col, 2, 1).setNumberFormat('0.00%');

  // Summary row
  const summaryRow = findSummaryRow_(summary, symbol);
  const row = summaryRow > 0 ? summaryRow : Math.max(2, summary.getLastRow() + 1);
  summary.getRange(row, 1).setValue(symbol);
  const sFormulas = buildSummaryRowFormulas(row, symbol, colLetter);
  Object.keys(sFormulas).forEach((colA1) => {
    const c = colA1.charCodeAt(0) - 64; // A->1
    summary.getRange(row, c).setFormula('=' + sFormulas[colA1]);
  });

  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast(`Added ${symbol}.`, 'PP-Lebon', 4);
}

/**
 * Re-apply formulas to an existing ticker without re-entering it.
 * Useful after pulling schema changes — preserves the user's Start Date and Interval.
 */
function rebuildTicker(symbol) {
  const ss = SpreadsheetApp.getActive();
  const model = ss.getSheetByName(SHEETS.MODEL);
  const summary = ss.getSheetByName(SHEETS.SUMMARY);
  symbol = String(symbol).trim().toUpperCase();

  const col = findTickerColumn_(model, symbol);
  if (col < 0) {
    SpreadsheetApp.getActive().toast(`${symbol} not found. Use Add Ticker instead.`, 'PP-Lebon', 5);
    return;
  }
  const colLetter = columnToLetter_(col);

  // Clear computed cells but preserve user inputs (ticker, start date, interval).
  const preserveRows = [MODEL_ROWS.TICKER, MODEL_ROWS.START_DATE, MODEL_ROWS.INTERVAL];
  for (let r = 1; r <= MODEL_ROWS.DATA_START; r++) {
    if (preserveRows.indexOf(r) !== -1) continue;
    model.getRange(r, col).clearContent();
  }

  const formulas = buildModelColumnFormulas(colLetter);
  Object.keys(formulas).forEach((rowStr) => {
    const row = Number(rowStr);
    model.getRange(row, col).setFormula('=' + formulas[row]);
  });
  model.getRange(MODEL_ROWS.CLOSE, col).setNumberFormat('0.00').setFontWeight('bold');
  model.getRange(MODEL_ROWS.STD_GRID_TOP, col, STD_LEVELS.length, 1).setNumberFormat('0.00');
  model.getRange(MODEL_ROWS.PCT_FROM_LOW, col, 2, 1).setNumberFormat('0.00%');

  const sRow = findSummaryRow_(summary, symbol);
  if (sRow > 0) {
    const sFormulas = buildSummaryRowFormulas(sRow, symbol, colLetter);
    Object.keys(sFormulas).forEach((colA1) => {
      const c = colA1.charCodeAt(0) - 64;
      summary.getRange(sRow, c).setFormula('=' + sFormulas[colA1]);
    });
  }
  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast(`Rebuilt ${symbol}.`, 'PP-Lebon', 4);
}

function removeTicker(symbol) {
  const ss = SpreadsheetApp.getActive();
  const model = ss.getSheetByName(SHEETS.MODEL);
  const summary = ss.getSheetByName(SHEETS.SUMMARY);
  symbol = String(symbol).trim().toUpperCase();

  const col = findTickerColumn_(model, symbol);
  if (col > 0) {
    // Clear all cell content in that column (keep column itself to preserve formula refs).
    model.getRange(1, col, model.getMaxRows(), 1).clear({contentsOnly: true});
  }

  const row = findSummaryRow_(summary, symbol);
  if (row > 0) summary.deleteRow(row);

  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast(`Removed ${symbol}.`, 'PP-Lebon', 4);
}

function findTickerColumn_(model, symbol) {
  const lastCol = model.getLastColumn();
  if (lastCol < 2) return -1;
  const tickers = model.getRange(MODEL_ROWS.TICKER, 2, 1, lastCol - 1).getValues()[0];
  for (let i = 0; i < tickers.length; i++) {
    if (String(tickers[i]).toUpperCase() === symbol) return i + 2;
  }
  return -1;
}

function findSummaryRow_(summary, symbol) {
  const lastRow = summary.getLastRow();
  if (lastRow < 2) return -1;
  const symbols = summary.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < symbols.length; i++) {
    if (String(symbols[i][0]).toUpperCase() === symbol) return i + 2;
  }
  return -1;
}
