import "server-only";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

export type SetupStats = {
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  pnlDollars: number;
  expectancyR: number;
  avgWinR: number;
  avgLossR: number;
  maeR: { bucket: string; count: number }[];
  mfeR: { bucket: string; count: number }[];
  monthlyPnl: { month: string; pnl: number }[];
  equity: { date: string; cum: number }[];
  recent: {
    eventId: number;
    instrument: string;
    direction: "long" | "short";
    entryTime: string;
    pnlDollars: number;
    pnlR: number;
  }[];
};

const EMPTY: SetupStats = {
  trades: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  winRate: 0,
  pnlDollars: 0,
  expectancyR: 0,
  avgWinR: 0,
  avgLossR: 0,
  maeR: [],
  mfeR: [],
  monthlyPnl: [],
  equity: [],
  recent: [],
};

function bucketRDist(values: number[]): { bucket: string; count: number }[] {
  const edges = [-3, -2, -1, 0, 1, 2, 3];
  const counts = new Array(edges.length + 1).fill(0);
  for (const r of values) {
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
    ...edges.slice(0, -1).map((e, i) => `${e}…${edges[i + 1]}R`),
    `≥${edges[edges.length - 1]}R`,
  ];
  return labels.map((label, i) => ({ bucket: label, count: counts[i] }));
}

export async function getSetupStats(setupId: number): Promise<SetupStats> {
  const events = await db
    .select()
    .from(schema.tradeEvents)
    .where(eq(schema.tradeEvents.setupId, setupId));
  if (events.length === 0) return EMPTY;

  const eventIds = events.map((e) => e.id);
  const executions = await db.select().from(schema.tradeExecutions);
  const instruments = await db.select().from(schema.instruments);
  const instMap = new Map(instruments.map((i) => [i.symbol, i] as const));
  const execsByEvent = new Map<number, typeof executions>();
  for (const ex of executions) {
    if (!eventIds.includes(ex.tradeEventId)) continue;
    const list = execsByEvent.get(ex.tradeEventId) ?? [];
    list.push(ex);
    execsByEvent.set(ex.tradeEventId, list);
  }

  let pnlTotal = 0;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  const maeRs: number[] = [];
  const mfeRs: number[] = [];
  const winRs: number[] = [];
  const lossRs: number[] = [];
  const allRs: number[] = [];
  const eventPnl = new Map<number, { pnl: number; r: number }>();

  for (const ev of events) {
    const inst = instMap.get(ev.instrument);
    if (!inst) continue;
    const pointDelta =
      ev.direction === "long" ? ev.exitAvg - ev.entryAvg : ev.entryAvg - ev.exitAvg;
    let pnl = 0;
    for (const ex of execsByEvent.get(ev.id) ?? []) {
      pnl +=
        ex.overridePnlDollars != null
          ? ex.overridePnlDollars
          : pointDelta * inst.pointValue * ex.contracts;
    }
    pnlTotal += pnl;
    const r = ev.initialStopPoints > 0 ? pointDelta / ev.initialStopPoints : 0;
    eventPnl.set(ev.id, { pnl, r });
    allRs.push(r);
    if (ev.initialStopPoints > 0) {
      maeRs.push(-ev.maePoints / ev.initialStopPoints);
      mfeRs.push(ev.mfePoints / ev.initialStopPoints);
    }
    if (pnl > 0) {
      wins++;
      winRs.push(r);
    } else if (pnl < 0) {
      losses++;
      lossRs.push(r);
    } else {
      breakevens++;
    }
  }

  const tradesCounted = wins + losses + breakevens;
  const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;
  const expectancyR =
    allRs.length > 0 ? allRs.reduce((a, b) => a + b, 0) / allRs.length : 0;
  const avgWinR =
    winRs.length > 0 ? winRs.reduce((a, b) => a + b, 0) / winRs.length : 0;
  const avgLossR =
    lossRs.length > 0 ? lossRs.reduce((a, b) => a + b, 0) / lossRs.length : 0;

  /* Monthly PnL */
  const monthMap = new Map<string, number>();
  for (const ev of events) {
    const month = ev.exitTime.slice(0, 7); // YYYY-MM
    const p = eventPnl.get(ev.id)?.pnl ?? 0;
    monthMap.set(month, (monthMap.get(month) ?? 0) + p);
  }
  const monthlyPnl = Array.from(monthMap.entries())
    .map(([month, pnl]) => ({ month, pnl }))
    .sort((a, b) => a.month.localeCompare(b.month));

  /* Per-setup equity curve, day-by-day on exit date */
  const dayMap = new Map<string, number>();
  for (const ev of events) {
    const d = ev.exitTime.slice(0, 10);
    const p = eventPnl.get(ev.id)?.pnl ?? 0;
    dayMap.set(d, (dayMap.get(d) ?? 0) + p);
  }
  const sortedDates = Array.from(dayMap.keys()).sort();
  let cum = 0;
  const equity = sortedDates.map((date) => {
    cum += dayMap.get(date) ?? 0;
    return { date, cum };
  });

  /* Recent linked trades (latest 20 by entryTime) */
  const recent = [...events]
    .sort((a, b) => b.entryTime.localeCompare(a.entryTime))
    .slice(0, 20)
    .map((ev) => {
      const p = eventPnl.get(ev.id) ?? { pnl: 0, r: 0 };
      return {
        eventId: ev.id,
        instrument: ev.instrument,
        direction: ev.direction as "long" | "short",
        entryTime: ev.entryTime,
        pnlDollars: p.pnl,
        pnlR: p.r,
      };
    });

  return {
    trades: tradesCounted,
    wins,
    losses,
    breakevens,
    winRate,
    pnlDollars: pnlTotal,
    expectancyR,
    avgWinR,
    avgLossR,
    maeR: bucketRDist(maeRs),
    mfeR: bucketRDist(mfeRs),
    monthlyPnl,
    equity,
    recent,
  };
}
