/**
 * Minimal CSV parser. Quoted strings supported. Commas-in-quotes safe.
 * Returns { headers, rows } where rows are arrays in column order.
 */
export type ParsedCsv = { headers: string[]; rows: string[][] };

export function parseCsv(text: string): ParsedCsv {
  const cells: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        cells.push(row);
        row = [];
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    cells.push(row);
  }
  const cleaned = cells.filter((r) => r.some((c) => c.trim().length > 0));
  if (cleaned.length === 0) return { headers: [], rows: [] };
  const [headers, ...rest] = cleaned;
  return { headers: headers.map((h) => h.trim()), rows: rest };
}

export const REQUIRED_FIELDS = [
  { id: "instrument", label: "Instrument", required: true },
  { id: "direction", label: "Direction (long/short)", required: true },
  { id: "entryTime", label: "Entry time", required: true },
  { id: "exitTime", label: "Exit time", required: true },
  { id: "entryAvg", label: "Entry price", required: true },
  { id: "exitAvg", label: "Exit price", required: true },
  { id: "contracts", label: "Contracts", required: true },
  { id: "maePoints", label: "MAE (points)", required: false },
  { id: "mfePoints", label: "MFE (points)", required: false },
  { id: "initialStopPoints", label: "Initial stop (points)", required: false },
] as const;

export type FieldId = (typeof REQUIRED_FIELDS)[number]["id"];
