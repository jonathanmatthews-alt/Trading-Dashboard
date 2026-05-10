import "server-only";
import { db, schema } from "@/db/client";
import {
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
} from "date-fns";

export type DayAggregate = {
  date: string; // yyyy-MM-dd
  pnl: number;
  trades: number;
  /* Sparkline points: [pnl_after_each_trade] in chronological order. */
  sparkline: number[];
};

export async function getMonthAggregates(year: number, month0: number) {
  const monthStart = startOfMonth(new Date(year, month0, 1));
  const monthEnd = endOfMonth(monthStart);
  const fromIso = format(monthStart, "yyyy-MM-dd");
  const toIso = format(monthEnd, "yyyy-MM-dd");

  /* Pull all events that exit within this month, plus their executions and instruments. */
  const events = await db.select().from(schema.tradeEvents);
  const inMonth = events.filter((e) => {
    const d = e.exitTime.slice(0, 10);
    return d >= fromIso && d <= toIso;
  });

  const executions = await db.select().from(schema.tradeExecutions);
  const instruments = await db.select().from(schema.instruments);
  const instMap = new Map(instruments.map((i) => [i.symbol, i] as const));
  const execsByEvent = new Map<number, (typeof schema.tradeExecutions.$inferSelect)[]>();
  for (const ex of executions) {
    const list = execsByEvent.get(ex.tradeEventId) ?? [];
    list.push(ex);
    execsByEvent.set(ex.tradeEventId, list);
  }

  const aggByDate = new Map<string, DayAggregate>();
  for (const day of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
    const key = format(day, "yyyy-MM-dd");
    aggByDate.set(key, { date: key, pnl: 0, trades: 0, sparkline: [] });
  }

  /* Iterate events in chronological exit order so sparkline is meaningful. */
  const sortedEvents = [...inMonth].sort((a, b) =>
    a.exitTime.localeCompare(b.exitTime),
  );
  for (const ev of sortedEvents) {
    const date = ev.exitTime.slice(0, 10);
    const agg = aggByDate.get(date);
    if (!agg) continue;
    const inst = instMap.get(ev.instrument);
    if (!inst) continue;
    const pointDelta =
      ev.direction === "long" ? ev.exitAvg - ev.entryAvg : ev.entryAvg - ev.exitAvg;
    const execs = execsByEvent.get(ev.id) ?? [];
    let evtPnl = 0;
    for (const ex of execs) {
      evtPnl +=
        ex.overridePnlDollars != null
          ? ex.overridePnlDollars
          : pointDelta * inst.pointValue * ex.contracts;
    }
    agg.pnl += evtPnl;
    agg.trades += 1;
    const last = agg.sparkline[agg.sparkline.length - 1] ?? 0;
    agg.sparkline.push(last + evtPnl);
  }

  return Array.from(aggByDate.values());
}

export type DayDetail = {
  date: string;
  paPnl: number;
  propPnl: number;
  trades: {
    eventId: number;
    instrument: string;
    direction: "long" | "short";
    entryTime: string;
    exitTime: string;
    pnlDollars: number;
  }[];
  byAccount: { accountId: number; nickname: string; pnl: number; trades: number }[];
};

export async function getDayDetail(dateIso: string): Promise<DayDetail> {
  const events = (await db.select().from(schema.tradeEvents)).filter(
    (e) => e.exitTime.slice(0, 10) === dateIso,
  );
  const eventIds = events.map((e) => e.id);
  if (eventIds.length === 0) {
    return { date: dateIso, paPnl: 0, propPnl: 0, trades: [], byAccount: [] };
  }
  const executions = await db.select().from(schema.tradeExecutions);
  const instruments = await db.select().from(schema.instruments);
  const accounts = await db.select().from(schema.accounts);
  const instMap = new Map(instruments.map((i) => [i.symbol, i] as const));
  const acctMap = new Map(accounts.map((a) => [a.id, a] as const));

  let paPnl = 0;
  let propPnl = 0;
  const trades: DayDetail["trades"] = [];
  const byAccountMap = new Map<number, { pnl: number; trades: number }>();

  for (const ev of events) {
    const inst = instMap.get(ev.instrument);
    if (!inst) continue;
    const pointDelta =
      ev.direction === "long" ? ev.exitAvg - ev.entryAvg : ev.entryAvg - ev.exitAvg;
    let evtPnl = 0;
    for (const ex of executions.filter((x) => x.tradeEventId === ev.id)) {
      const pnl =
        ex.overridePnlDollars != null
          ? ex.overridePnlDollars
          : pointDelta * inst.pointValue * ex.contracts;
      evtPnl += pnl;
      const acct = acctMap.get(ex.accountId);
      if (!acct) continue;
      if (acct.accountType === "pa") paPnl += pnl;
      else propPnl += pnl;
      const cur = byAccountMap.get(acct.id) ?? { pnl: 0, trades: 0 };
      cur.pnl += pnl;
      cur.trades += 1;
      byAccountMap.set(acct.id, cur);
    }
    trades.push({
      eventId: ev.id,
      instrument: ev.instrument,
      direction: ev.direction as "long" | "short",
      entryTime: ev.entryTime,
      exitTime: ev.exitTime,
      pnlDollars: evtPnl,
    });
  }

  const byAccount = Array.from(byAccountMap.entries()).map(([id, v]) => ({
    accountId: id,
    nickname: acctMap.get(id)?.nickname ?? `#${id}`,
    pnl: v.pnl,
    trades: v.trades,
  }));

  return { date: dateIso, paPnl, propPnl, trades, byAccount };
}
