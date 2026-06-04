/**
 * setupWorkbook(): one-shot initializer.
 * Idempotent — safe to re-run; will not clobber tickers already added.
 */
function setupWorkbook() {
  const ss = SpreadsheetApp.getActive();
  createSettingsSheet_(ss);
  createModelSheet_(ss);
  createSummarySheet_(ss);

  // Seed with MSFT — a known-good GOOGLEFINANCE symbol so the user sees data
  // immediately. Replace via Remove Ticker → Add Ticker if desired.
  const model = ss.getSheetByName(SHEETS.MODEL);
  if (model.getRange(MODEL_ROWS.TICKER, 2).getValue() === '') {
    addTicker('MSFT');
  }

  SpreadsheetApp.getActive().toast('Workbook ready.', 'PP-Lebon', 5);
}

function createSettingsSheet_(ss) {
  let sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) sheet = ss.insertSheet(SHEETS.SETTINGS);
  if (sheet.getLastRow() > 0) return; // preserve any tweaks

  const rows = getSettingsRows();
  sheet.getRange(1, 1, 1, 2).setValues([['Setting', 'Value']]).setFontWeight('bold');
  rows.forEach((row, i) => {
    const r = i + 2;
    sheet.getRange(r, 1, 1, 2).setValues([[row[0], row[1]]]);
    // Create named range for the value cell.
    const valueRange = sheet.getRange(r, 2);
    ss.setNamedRange(row[2], valueRange);
  });
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 100);
}

function createModelSheet_(ss) {
  let sheet = ss.getSheetByName(SHEETS.MODEL);
  if (!sheet) sheet = ss.insertSheet(SHEETS.MODEL);

  // Write column-A labels if missing.
  const labels = getModelRowLabels();
  Object.keys(labels).forEach((rowStr) => {
    const row = Number(rowStr);
    const cell = sheet.getRange(row, 1);
    if (cell.getValue() === '') cell.setValue(labels[row]);
  });
  sheet.getRange('A:A').setFontWeight('bold');
  sheet.setColumnWidth(1, 180);
  sheet.setFrozenColumns(1);
  sheet.setFrozenRows(1);
}

function createSummarySheet_(ss) {
  let sheet = ss.getSheetByName(SHEETS.SUMMARY);
  if (!sheet) sheet = ss.insertSheet(SHEETS.SUMMARY, 0); // first tab
  if (sheet.getLastRow() > 0) return;

  // Header row 1: labels. Row 2: STD level numeric markers for the band columns.
  const stdHeaders = STD_LEVELS.map(v => v);
  const headers1 = ['Symbol', 'Score', 'Current Close', 'Current Price'].concat(stdHeaders);
  sheet.getRange(1, 1, 1, headers1.length).setValues([headers1]).setFontWeight('bold');

  // Number formats
  sheet.getRange('B:B').setNumberFormat('0.00');
  sheet.getRange('C:D').setNumberFormat('0.00');
  // Band columns
  sheet.getRange(1, 5, sheet.getMaxRows(), STD_LEVELS.length).setNumberFormat('0.00');

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 70);
  sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 110);
  for (let i = 0; i < STD_LEVELS.length; i++) {
    sheet.setColumnWidth(5 + i, 75);
  }
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);

  applySummaryConditionalFormatting_(sheet);
}

/**
 * Conditional formatting for Summary:
 *   - Score column: red bold at |score|>=1.5, red bg at |score|>=2
 *   - Each band column E..Q: light shading scaled by signed STD level (-2..+2)
 *     using gradients so the row reads like the screenshot.
 *   - Compression flag (from Model) → yellow bg on Score column
 */
function applySummaryConditionalFormatting_(sheet) {
  const lastRow = Math.max(sheet.getMaxRows(), 100);
  const rules = [];

  // Score column B: extension thresholds.
  const scoreRange = sheet.getRange(2, 2, lastRow - 1, 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=ABS($B2)>=2')
    .setBackground('#f4cccc').setBold(true).setFontColor('#990000')
    .setRanges([scoreRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=ABS($B2)>=1.5')
    .setBold(true).setFontColor('#990000')
    .setRanges([scoreRange]).build());

  // Compression overlay (yellow) when Model compression is TRUE for the row's ticker.
  // Look up the ticker column on Model row 1, then index into the compression row.
  const compressFormula = `=IFERROR(INDEX(Model!$${MODEL_ROWS.COMPRESSION}:$${MODEL_ROWS.COMPRESSION}, MATCH($A2, Model!$1:$1, 0)) = TRUE, FALSE)`;
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(compressFormula)
    .setBackground('#fff2cc')
    .setRanges([scoreRange]).build());

  // Band columns E..Q: color each cell by how close its STD level is to the
  // current score on that row. Cells "containing" the live price get green
  // shading; deep extremes blue/red. Simple approach: compare cell's STD
  // header to row's score.
  // Cell formula reference: cell column header is at row 1 (the STD numeric).
  for (let i = 0; i < STD_LEVELS.length; i++) {
    const col = 5 + i; // E=5
    const colLetter = columnToLetter_(col);
    const range = sheet.getRange(2, col, lastRow - 1, 1);
    // Cell shading by the STD level value itself.
    const k = STD_LEVELS[i];
    let bg = null;
    if (k <= -1.5) bg = '#9fc5e8';        // blue (deep oversold)
    else if (k <= -1) bg = '#00ff00';     // bright green
    else if (k < 0) bg = '#b6d7a8';       // light green
    else if (k === 0) bg = '#cccccc';     // gray
    else if (k < 1) bg = '#f4cccc';       // light red
    else if (k <= 1.5) bg = '#ea9999';    // red
    else bg = '#9fc5e8';                  // blue (deep overbought)
    range.setBackground(bg);

    // Highlight the cell containing the live price (cell value closest to D).
    const highlight = `=AND($D2<>"", ABS($D2 - ${colLetter}2) = MIN(ARRAYFORMULA(ABS($D2 - $E2:$Q2))))`;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(highlight)
      .setBackground('#ff0000').setFontColor('#ffffff').setBold(true)
      .setRanges([range]).build());
  }

  sheet.setConditionalFormatRules(rules);
}

function columnToLetter_(col) {
  let s = '', n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
