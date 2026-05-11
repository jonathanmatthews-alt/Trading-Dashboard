/**
 * Minimal CSV parser. Quoted strings supported. Commas-in-quotes safe.
 * Returns { headers, rows } where rows are arrays in column order.
 * Tab delimiter is also accepted (Sierra Chart exports as TSV by default).
 */
export type ParsedCsv = { headers: string[]; rows: string[][] };

export function parseCsv(text: string): ParsedCsv {
  /* Detect delimiter: tab wins if first line has more tabs than commas. */
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim =
    (firstLine.match(/\t/g)?.length ?? 0) >
    (firstLine.match(/,/g)?.length ?? 0)
      ? "\t"
      : ",";

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
      else if (c === delim) {
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
  /* Optional broker-derived $ values (used when the broker reports them
     directly; converted to points server-side using instrument pointValue). */
  { id: "maeDollars", label: "MAE ($, broker-reported)", required: false },
  { id: "mfeDollars", label: "MFE ($, broker-reported)", required: false },
  { id: "overridePnlDollars", label: "PnL $ (override, e.g. with commission)", required: false },
] as const;

export type FieldId = (typeof REQUIRED_FIELDS)[number]["id"];

/* ───────── Broker presets ───────── */

export type BrokerPreset = {
  id: string;
  label: string;
  /** Map our FieldId → exact column header in the broker's CSV. */
  mapping: Partial<Record<FieldId, string>>;
  /** Transforms applied to row values before sending to the server. */
  transforms?: {
    symbolRoot?: boolean;
    sierraDatetime?: boolean;
    directionLower?: boolean;
    /** Sierra reports MAE as a negative number; we want positive points. */
    maeAbs?: boolean;
    /** Use Max Open Quantity (peak) as contract count. */
    contractsFromMaxOpen?: boolean;
  };
};

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    id: "generic",
    label: "Generic CSV",
    mapping: {},
  },
  {
    id: "sierra",
    label: "Sierra Chart",
    mapping: {
      instrument: "Symbol",
      direction: "Trade Type",
      entryTime: "Entry DateTime",
      exitTime: "Exit DateTime",
      entryAvg: "Entry Price",
      exitAvg: "Exit Price",
      contracts: "Max Open Quantity",
      maeDollars: "Max Open Loss (C)",
      mfeDollars: "Max Open Profit (C)",
      /* Sierra "Profit/Loss (C)" is gross; equal to our derived value,
         so we don't override and just let trade-math derive it. Means a
         future fees pipeline can layer on cleanly. */
    },
    transforms: {
      symbolRoot: true,
      sierraDatetime: true,
      directionLower: true,
      maeAbs: true,
      contractsFromMaxOpen: true,
    },
  },
];

/* ───────── Row-level transforms ───────── */

/**
 * "MNQM26_FUT_CME (E6151)" → "MNQ"
 * Splits on first underscore, then strips trailing futures month code
 * (single letter F/G/H/J/K/M/N/Q/U/V/X/Z) + 2-digit year.
 */
export function parseSymbolRoot(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const beforeUnderscore = trimmed.split("_")[0];
  /* Strip trailing month code + 2-digit year, e.g. "MNQM26" → "MNQ". */
  return beforeUnderscore.replace(/[FGHJKMNQUVXZ]\d{2}$/i, "");
}

/**
 * "2026-05-11  08:14:08.574 BP" → "2026-05-11T08:14:08.574"
 * Strips the broker suffix (BP/EP/etc.), collapses whitespace, and inserts T.
 */
export function parseSierraDatetime(raw: string): string {
  const cleaned = raw.replace(/\s+[A-Z]{1,3}\s*$/, "").trim();
  /* Collapse internal whitespace to single space, then split date and time. */
  const compact = cleaned.replace(/\s+/g, " ");
  const [date, time] = compact.split(" ");
  if (!date || !time) return raw; // best effort
  /* Drop fractional seconds (HTML datetime-local won't take them anyway). */
  const timeNoFrac = time.split(".")[0];
  return `${date}T${timeNoFrac}`;
}

