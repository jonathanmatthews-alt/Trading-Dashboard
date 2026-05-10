import "server-only";
import { db, schema } from "@/db/client";
import {
  format,
  parseISO,
  subDays,
  startOfYear,
  startOfDay,
} from "date-fns";

export type EquityPoint = {
  date: string;
  paCum: number;
  propCum: number;
  totalCum: number;
  drawdown: number;
};

export type EdgeBucket = {
  label: string;
  trades: number;
  pnl: number;
  winRate: number;
};

export type Distribution = {
  bucket: string; // e.g. "[-2R, -1R)"
  count: number;
};

export type PerformanceData = {
  equity: EquityPoint[];
  bySetup: EdgeBucket[];
  byInstrument: EdgeBucket[];
  byDayOfWeek: EdgeBucket[];
  byHourOfDay: EdgeBucket[];
  byMistake: EdgeBucket[];
  byTendency: EdgeBucket[];
  maeR: Distribution[];
  mfeR: Distribution[];
  pnlDD: Distribution[];
};

export function rangeFromPreset(
  preset: string,
): { from: string; to: string } {
  const today = startOfDay(new Date());
  const to = format(today, "yyyy-MM-dd");
  let from: Date;
  switch (preset) {
    case "7d":
      from = subDays(today, 7);
      break;
    case "30d":
      from = subDays(today, 30);
      break;
    case "90d":
      from = subDays(today, 90);
      break;
    case "ytd":
      from = startOfYear(today);
      break;
    case "1y":
      from = subDays(today, 365);
      break;
    case "all":
    default:
      from = new Date(2000, 0, 1);
      break;
  }
  return { from: format(from, "yyyy-MM-dd"), to };
}

export async function getPerformance(preset: string): Promise<PerformanceData> {
  const { from, to } = rangeFromPreset(preset);

  const events = await db.select().from(schema.tradeEvents);
  const inRange = events.filter((e) => {
    const d = e.exitTime.slice(0, 10);
    return d >= from && d <= to;
  });
  const eventIds = new Set(inRange.map((e) => e.id));

  const executions = (await db.select().from(schema.tradeExecutions)).filter(
    (x) => eventIds.has(x.tradeEventId),
  );
  const accounts = await db.select().from(schema.accounts);
  const acctMap = new Map(accounts.map((a) => [a.id, a] as const));
  const instruments = await db.select().from(schema.instruments);
  const instMap = new Map(instruments.map((i) => [i.symbol, i] as const));

  const setups = await db.select().from(schema.setups);
  const setupMap = new Map(setups.map((s) => [s.id, s] as const));

  const tem = await db.select().from(schema.tradeEventMistakes);
  const mistakes = await db.select().from(schema.mistakes);
  const mistakeMap = new Map(mistakes.map((m) => [m.id, m] as const));

  const tet = await db.select().from(schema.tradeEventTendencies);
  const tendencies = await db.select().from(schema.tendencies);
  const tendencyMap = new Map(tendencies.map((t) => [t.id, t] as const));

  /* Compute per-event PnL first */
  const eventPnl = new Map<number, { pnl: number; pa: number; prop: number }>();
  for (const ev of inRange) {
    const inst = instMap.get(ev.instrument);
    if (!inst) continue;
    const pointDelta =
      ev.direction === "long" ? ev.exitAvg - ev.entryAvg : ev.entryAvg - ev.exitAvg;
    let pa = 0;
    let prop = 0;
    for (const ex of executions.filter((x) => x.tradeEventId === ev.id)) {
      const pnl =
        ex.overridePnlDollars != null
          ? ex.overridePnlDollars
          : pointDelta * inst.pointValue * ex.contracts;
      const acct = acctMap.get(ex.accountId);
      if (!acct) continue;
      if (acct.accountType === "pa") pa += pnl;
      else prop += pnl;
    }
    eventPnl.set(ev.id, { pnl: pa + prop, pa, prop });
  }

  /* Equity curve, day-by-day */
  const byDate = new Map<string, { pa: number; prop: number }>();
  for (const ev of inRange) {
    const date = ev.exitTime.slice(0, 10);
    const entry = byDate.get(date) ?? { pa: 0, prop: 0 };
    const p = eventPnl.get(ev.id);
    if (p) {
      entry.pa += p.pa;
      entry.prop += p.prop;
    }
    byDate.set(date, entry);
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  let paCum = 0;
  let propCum = 0;
  let peak = 0;
  const equity: EquityPoint[] = sortedDates.map((d) => {
    const e = byDate.get(d)!;
    paCum += e.pa;
    propCum += e.prop;
    const totalCum = paCum + propCum;
    if (totalCum > peak) peak = totalCum;
    return { date: d, paCum, propCum, totalCum, drawdown: totalCum - peak };
  });

  /* Edge attribution helpers */
  function bucketize<K>(
    keyFn: (ev: typeof inRange[number]) => K | null,
    labelFn: (k: K) => string,
  ): EdgeBucket[] {
    const buckets = new Map<string, { pnl: number; trades: number; wins: number }>();
    for (const ev of inRange) {
      const key = keyFn(ev);
      if (key == null) continue;
      const label = labelFn(key);
      const cur = buckets.get(label) ?? { pnl: 0, trades: 0, wins: 0 };
      const p = eventPnl.get(ev.id);
      if (p) {
        cur.pnl += p.pnl;
        cur.trades += 1;
        if (p.pnl > 0) cur.wins += 1;
      }
      buckets.set(label, cur);
    }
    return Array.from(buckets.entries())
      .map(([label, v]) => ({
        label,
        trades: v.trades,
        pnl: v.pnl,
        winRate: v.trades > 0 ? v.wins / v.trades : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const bySetup = bucketize(
    (ev) => ev.setupId,
    (id) => setupMap.get(id as number)?.name ?? "—",
  );
  const byInstrument = bucketize(
    (ev) => ev.instrument,
    (s) => s as string,
  );
  const byDayOfWeek = bucketize(
    (ev) => parseISO(ev.entryTime).getDay(),
    (d) => dow[d as number],
  );
  const byHourOfDay = bucketize(
    (ev) => parseISO(ev.entryTime).getHours(),
    (h) => `${String(h).padStart(2, "0")}:00`,
  );

  /* Mistakes / tendencies are many-to-many — aggregate per tag */
  const byMistake = (() => {
    const buckets = new Map<string, { pnl: number; trades: number; wins: number }>();
    for (const link of tem) {
      if (!eventIds.has(link.tradeEventId)) continue;
      const m = mistakeMap.get(link.mistakeId);
      if (!m) continue;
      const cur = buckets.get(m.name) ?? { pnl: 0, trades: 0, wins: 0 };
      const p = eventPnl.get(link.tradeEventId);
      if (p) {
        cur.pnl += p.pnl;
        cur.trades += 1;
        if (p.pnl > 0) cur.wins += 1;
      }
      buckets.set(m.name, cur);
    }
    return Array.from(buckets.entries())
      .map(([label, v]) => ({
        label,
        trades: v.trades,
        pnl: v.pnl,
        winRate: v.trades > 0 ? v.wins / v.trades : 0,
      }))
      .sort((a, b) => a.pnl - b.pnl);
  })();

  const byTendency = (() => {
    const buckets = new Map<string, { pnl: number; trades: number; wins: number }>();
    for (const link of tet) {
      if (!eventIds.has(link.tradeEventId)) continue;
      const t = tendencyMap.get(link.tendencyId);
      if (!t) continue;
      const cur = buckets.get(t.name) ?? { pnl: 0, trades: 0, wins: 0 };
      const p = eventPnl.get(link.tradeEventId);
      if (p) {
        cur.pnl += p.pnl;
        cur.trades += 1;
        if (p.pnl > 0) cur.wins += 1;
      }
      buckets.set(t.name, cur);
    }
    return Array.from(buckets.entries())
      .map(([label, v]) => ({
        label,
        trades: v.trades,
        pnl: v.pnl,
        winRate: v.trades > 0 ? v.wins / v.trades : 0,
      }))
      .sort((a, b) => a.pnl - b.pnl);
  })();

  /* Distribution histograms (R-multiples) */
  function bucketRDist(getR: (ev: typeof inRange[number]) => number): Distribution[] {
    const edges = [-3, -2, -1, 0, 1, 2, 3];
    const counts = new Array(edges.length + 1).fill(0);
    for (const ev of inRange) {
      const r = getR(ev);
      let placed = false;
      for (let i = 0; i < edges.length; i++) {
        if (r < edges[i]) {
          counts[i] += 1;
          placed = true;
          break;
        }
      }
      if (!placed) counts[edges.length] += 1;
    }
    const labels = [
      `<${edges[0]}R`,
      ...edges.slice(0, -1).map((e, i) => `${e}R…${edges[i + 1]}R`),
      `≥${edges[edges.length - 1]}R`,
    ];
    return labels.map((label, i) => ({ bucket: label, count: counts[i] }));
  }

  const maeR = bucketRDist((ev) =>
    ev.initialStopPoints > 0 ? -ev.maePoints / ev.initialStopPoints : 0,
  );
  const mfeR = bucketRDist((ev) =>
    ev.initialStopPoints > 0 ? ev.mfePoints / ev.initialStopPoints : 0,
  );
  const pnlDD = (() => {
    const edges = [-1, -0.5, 0, 0.25, 0.5, 0.75, 1];
    const counts = new Array(edges.length + 1).fill(0);
    for (const ev of inRange) {
      const p = eventPnl.get(ev.id);
      if (!p) continue;
      const inst = instMap.get(ev.instrument);
      if (!inst) continue;
      const mfeDollars = ev.mfePoints * inst.pointValue;
      const ratio = mfeDollars > 0 ? p.pnl / mfeDollars : 0;
      let placed = false;
      for (let i = 0; i < edges.length; i++) {
        if (ratio < edges[i]) {
          counts[i] += 1;
          placed = true;
          break;
        }
      }
      if (!placed) counts[edges.length] += 1;
    }
    const labels = [
      `<${edges[0]}`,
      ...edges.slice(0, -1).map((e, i) => `${e}…${edges[i + 1]}`),
      `≥${edges[edges.length - 1]}`,
    ];
    return labels.map((label, i) => ({ bucket: label, count: counts[i] }));
  })();

  return {
    equity,
    bySetup,
    byInstrument,
    byDayOfWeek,
    byHourOfDay,
    byMistake,
    byTendency,
    maeR,
    mfeR,
    pnlDD,
  };
}
