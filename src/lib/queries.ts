import "server-only";
import { db } from "@/db/client";
import { schema } from "@/db/client";
import { desc, eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import { computeTradeMetrics } from "./trade-math";
import { computeAccountState, type AccountState } from "./rule-engine";
import { loadFeeMap, FeeMap } from "./fees";
import type {
  TradeEvent,
  TradeExecution,
  Instrument,
  Account,
  RuleTemplate,
  Setup,
  Mistake,
  Tendency,
} from "@/db/schema";

export { loadFeeMap, FeeMap };

/* ─── Reference catalogues ─── */
export async function listSetups(): Promise<Setup[]> {
  return db.select().from(schema.setups).where(eq(schema.setups.archived, false));
}

export async function listMistakes(): Promise<Mistake[]> {
  return db
    .select()
    .from(schema.mistakes)
    .where(eq(schema.mistakes.archived, false));
}

export async function listTendencies(): Promise<Tendency[]> {
  return db
    .select()
    .from(schema.tendencies)
    .where(eq(schema.tendencies.archived, false));
}

export async function listBiases() {
  return db.select().from(schema.biases);
}

export async function listInstruments(): Promise<Instrument[]> {
  return db.select().from(schema.instruments);
}

/* ─── Accounts ─── */
export async function listActiveAccounts(): Promise<Account[]> {
  return db.select().from(schema.accounts).where(eq(schema.accounts.state, "active"));
}

export async function listAccountsWithMeta() {
  return db
    .select({
      account: schema.accounts,
      firm: schema.firms,
      program: schema.programs,
      rule: schema.ruleTemplates,
    })
    .from(schema.accounts)
    .leftJoin(schema.firms, eq(schema.accounts.firmId, schema.firms.id))
    .leftJoin(schema.programs, eq(schema.accounts.programId, schema.programs.id))
    .leftJoin(
      schema.ruleTemplates,
      eq(schema.accounts.ruleTemplateId, schema.ruleTemplates.id),
    );
}

export async function listFirms() {
  return db.select().from(schema.firms).orderBy(schema.firms.name);
}

export async function listPrograms() {
  return db.select().from(schema.programs);
}

/* ─── Trades ─── */
export type TradeRow = {
  event: TradeEvent;
  executions: (TradeExecution & { account: Account })[];
  instrument: Instrument;
  setup: Setup | null;
  mistakes: Mistake[];
  tendencies: Tendency[];
};

export async function listTradeRows(opts?: {
  limit?: number;
  fromDate?: string;
  toDate?: string;
  accountIds?: number[];
}): Promise<TradeRow[]> {
  const where = [];
  if (opts?.fromDate) where.push(gte(schema.tradeEvents.entryTime, opts.fromDate));
  if (opts?.toDate) where.push(lte(schema.tradeEvents.entryTime, opts.toDate));

  let query = db
    .select()
    .from(schema.tradeEvents)
    .orderBy(desc(schema.tradeEvents.entryTime))
    .$dynamic();
  if (where.length > 0) query = query.where(and(...where));
  if (opts?.limit != null) query = query.limit(opts.limit);
  const events = await query;
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const allExecutions = await db
    .select({ ex: schema.tradeExecutions, account: schema.accounts })
    .from(schema.tradeExecutions)
    .leftJoin(
      schema.accounts,
      eq(schema.tradeExecutions.accountId, schema.accounts.id),
    )
    .where(inArray(schema.tradeExecutions.tradeEventId, eventIds));

  const allInstruments = await db.select().from(schema.instruments);
  const instrumentBySym = new Map(allInstruments.map((i) => [i.symbol, i] as const));

  const setups = await db.select().from(schema.setups);
  const setupById = new Map(setups.map((s) => [s.id, s] as const));

  const allMistakes = await db
    .select({ tem: schema.tradeEventMistakes, m: schema.mistakes })
    .from(schema.tradeEventMistakes)
    .leftJoin(
      schema.mistakes,
      eq(schema.tradeEventMistakes.mistakeId, schema.mistakes.id),
    )
    .where(inArray(schema.tradeEventMistakes.tradeEventId, eventIds));

  const allTendencies = await db
    .select({ tet: schema.tradeEventTendencies, t: schema.tendencies })
    .from(schema.tradeEventTendencies)
    .leftJoin(
      schema.tendencies,
      eq(schema.tradeEventTendencies.tendencyId, schema.tendencies.id),
    )
    .where(inArray(schema.tradeEventTendencies.tradeEventId, eventIds));

  const rows: TradeRow[] = events.map((event) => {
    const executions = allExecutions
      .filter((row) => row.ex.tradeEventId === event.id)
      .filter((row): row is { ex: TradeExecution; account: Account } => row.account != null)
      .map((row) => ({ ...row.ex, account: row.account }));
    const filteredExecutions =
      opts?.accountIds && opts.accountIds.length > 0
        ? executions.filter((e) => opts.accountIds!.includes(e.accountId))
        : executions;
    const instrument = instrumentBySym.get(event.instrument);
    if (!instrument) throw new Error(`unknown instrument ${event.instrument}`);
    const setup = event.setupId != null ? setupById.get(event.setupId) ?? null : null;
    const mistakes = allMistakes
      .filter((row) => row.tem.tradeEventId === event.id && row.m)
      .map((row) => row.m as Mistake);
    const tendencies = allTendencies
      .filter((row) => row.tet.tradeEventId === event.id && row.t)
      .map((row) => row.t as Tendency);
    return {
      event,
      executions: filteredExecutions,
      instrument,
      setup,
      mistakes,
      tendencies,
    };
  });

  return rows.filter((r) => r.executions.length > 0);
}

export function metricsForRow(row: TradeRow, feeMap: FeeMap) {
  return computeTradeMetrics(row.event, row.executions, row.instrument, feeMap);
}

export async function listAllTransitions() {
  const rows = await db.select().from(schema.accountTransitions);
  return rows.sort((a, b) => b.id - a.id);
}

/* ─── Account state for Risk dashboard ─── */
export async function listAccountStates(todayIso: string): Promise<AccountState[]> {
  const accountsMeta = await listAccountsWithMeta();
  const feeMap = await loadFeeMap();
  const acctById = new Map(accountsMeta.map((m) => [m.account.id, m.account] as const));
  const allExecRows = await db
    .select({ ex: schema.tradeExecutions, ev: schema.tradeEvents })
    .from(schema.tradeExecutions)
    .leftJoin(
      schema.tradeEvents,
      eq(schema.tradeExecutions.tradeEventId, schema.tradeEvents.id),
    );

  const allInstruments = await db.select().from(schema.instruments);
  const instrumentBySym = new Map(allInstruments.map((i) => [i.symbol, i] as const));

  return accountsMeta
    .filter((a) => a.account.state === "active")
    .map(({ account, rule }) => {
      const executions = allExecRows
        .filter((r) => r.ex.accountId === account.id && r.ev != null)
        .map((r) => {
          const acct = acctById.get(r.ex.accountId)!;
          return {
            execution: { ...r.ex, account: acct },
            event: r.ev as TradeEvent,
            instrument: instrumentBySym.get((r.ev as TradeEvent).instrument)!,
          };
        });
      return computeAccountState(account, rule, executions, todayIso, feeMap);
    });
}

/* ─── Aggregates for Today / Performance — uses NET PnL ─── */
export async function getTodayPnl(todayIso: string) {
  const accountsMeta = await listAccountsWithMeta();
  const feeMap = await loadFeeMap();
  const allExecRows = await db
    .select({ ex: schema.tradeExecutions, ev: schema.tradeEvents })
    .from(schema.tradeExecutions)
    .leftJoin(
      schema.tradeEvents,
      eq(schema.tradeExecutions.tradeEventId, schema.tradeEvents.id),
    );
  const allInstruments = await db.select().from(schema.instruments);
  const instrumentBySym = new Map(allInstruments.map((i) => [i.symbol, i] as const));

  let paPnl = 0;
  let propPnl = 0;
  let paFees = 0;
  let propFees = 0;
  const acctById = new Map(accountsMeta.map((a) => [a.account.id, a.account] as const));
  let trades = new Set<number>();

  for (const row of allExecRows) {
    if (!row.ev) continue;
    const dateKey = row.ev.exitTime.slice(0, 10);
    if (dateKey !== todayIso) continue;
    const account = acctById.get(row.ex.accountId);
    if (!account) continue;
    const instrument = instrumentBySym.get(row.ev.instrument);
    if (!instrument) continue;
    const pointDelta =
      row.ev.direction === "long"
        ? row.ev.exitAvg - row.ev.entryAvg
        : row.ev.entryAvg - row.ev.exitAvg;
    const gross =
      row.ex.overridePnlDollars != null
        ? row.ex.overridePnlDollars
        : pointDelta * instrument.pointValue * row.ex.contracts;
    const fee = feeMap.forExecution(account, row.ev.instrument) * row.ex.contracts;
    const net = gross - fee;
    if (account.accountType === "pa") {
      paPnl += net;
      paFees += fee;
    } else {
      propPnl += net;
      propFees += fee;
    }
    trades.add(row.ev.id);
  }

  /* Per-event win/loss/R using NET PnL aggregated across the event's executions. */
  const allEventsToday = await db
    .select()
    .from(schema.tradeEvents)
    .where(sql`substr(${schema.tradeEvents.exitTime}, 1, 10) = ${todayIso}`);
  const eventIdsToday = allEventsToday.map((e) => e.id);
  const execsByEvent = new Map<number, typeof allExecRows>();
  for (const r of allExecRows) {
    if (!r.ev || !eventIdsToday.includes(r.ev.id)) continue;
    const list = execsByEvent.get(r.ev.id) ?? [];
    list.push(r);
    execsByEvent.set(r.ev.id, list);
  }
  let wins = 0;
  let losses = 0;
  let rsum = 0;
  let rcount = 0;
  for (const ev of allEventsToday) {
    const instrument = instrumentBySym.get(ev.instrument);
    if (!instrument) continue;
    const pointDelta =
      ev.direction === "long" ? ev.exitAvg - ev.entryAvg : ev.entryAvg - ev.exitAvg;
    let net = 0;
    let contracts = 0;
    for (const r of execsByEvent.get(ev.id) ?? []) {
      const acct = acctById.get(r.ex.accountId);
      if (!acct) continue;
      const gross =
        r.ex.overridePnlDollars != null
          ? r.ex.overridePnlDollars
          : pointDelta * instrument.pointValue * r.ex.contracts;
      const fee = feeMap.forExecution(acct, ev.instrument) * r.ex.contracts;
      net += gross - fee;
      contracts += r.ex.contracts;
    }
    if (net > 0) wins++;
    else if (net < 0) losses++;
    /* Net R per contract: net / (riskPerContract * contracts) */
    const riskPerContract = ev.initialStopPoints * instrument.pointValue;
    if (riskPerContract > 0 && contracts > 0) {
      rsum += net / (riskPerContract * contracts);
      rcount++;
    }
  }

  return {
    paPnl,
    propPnl,
    paFees,
    propFees,
    totalPnl: paPnl + propPnl,
    totalFees: paFees + propFees,
    tradeCount: allEventsToday.length,
    winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
    avgR: rcount > 0 ? rsum / rcount : 0,
  };
}
