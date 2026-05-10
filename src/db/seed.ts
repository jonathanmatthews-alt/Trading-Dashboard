import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "node:path";

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");
const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

/* ───────── Instruments (CME/CBOT futures) ───────── */
const INSTRUMENTS: (typeof schema.instruments.$inferInsert)[] = [
  { symbol: "ES",  name: "E-mini S&P 500",     category: "Equity Index", tickSize: 0.25, pointValue: 50,  ticksPerPoint: 4 },
  { symbol: "MES", name: "Micro E-mini S&P",   category: "Equity Index", tickSize: 0.25, pointValue: 5,   ticksPerPoint: 4 },
  { symbol: "NQ",  name: "E-mini Nasdaq-100",  category: "Equity Index", tickSize: 0.25, pointValue: 20,  ticksPerPoint: 4 },
  { symbol: "MNQ", name: "Micro E-mini Nasdaq",category: "Equity Index", tickSize: 0.25, pointValue: 2,   ticksPerPoint: 4 },
  { symbol: "RTY", name: "E-mini Russell 2000",category: "Equity Index", tickSize: 0.10, pointValue: 50,  ticksPerPoint: 10 },
  { symbol: "M2K", name: "Micro Russell 2000", category: "Equity Index", tickSize: 0.10, pointValue: 5,   ticksPerPoint: 10 },
  { symbol: "YM",  name: "E-mini Dow",         category: "Equity Index", tickSize: 1,    pointValue: 5,   ticksPerPoint: 1 },
  { symbol: "MYM", name: "Micro E-mini Dow",   category: "Equity Index", tickSize: 1,    pointValue: 0.5, ticksPerPoint: 1 },
  { symbol: "CL",  name: "Crude Oil",          category: "Energy",       tickSize: 0.01, pointValue: 1000,ticksPerPoint: 100 },
  { symbol: "MCL", name: "Micro Crude Oil",    category: "Energy",       tickSize: 0.01, pointValue: 100, ticksPerPoint: 100 },
  { symbol: "GC",  name: "Gold",               category: "Metals",       tickSize: 0.10, pointValue: 100, ticksPerPoint: 10 },
  { symbol: "MGC", name: "Micro Gold",         category: "Metals",       tickSize: 0.10, pointValue: 10,  ticksPerPoint: 10 },
  { symbol: "SI",  name: "Silver",             category: "Metals",       tickSize: 0.005,pointValue: 5000,ticksPerPoint: 200 },
  { symbol: "ZB",  name: "30Y Treasury Bond",  category: "Rates",        tickSize: 0.03125, pointValue: 1000, ticksPerPoint: 32 },
  { symbol: "ZN",  name: "10Y Treasury Note",  category: "Rates",        tickSize: 0.015625, pointValue: 1000, ticksPerPoint: 64 },
  { symbol: "6E",  name: "Euro FX",            category: "FX",           tickSize: 0.00005, pointValue: 125000, ticksPerPoint: 20000 },
  { symbol: "6B",  name: "British Pound",      category: "FX",           tickSize: 0.0001,  pointValue: 62500,  ticksPerPoint: 10000 },
];

/* ───────── Setups (~10 common futures setups) ───────── */
const SETUPS: (typeof schema.setups.$inferInsert)[] = [
  { name: "Breakout Trend",  category: "Trend",      tier: "A", oneLiner: "Continuation through a meaningful level after consolidation." },
  { name: "Failed Test",     category: "Reversal",   tier: "A", oneLiner: "Stop-run beyond a level then sharp rejection back through it." },
  { name: "Opening Drive",   category: "Trend",      tier: "B", oneLiner: "Strong unidirectional move from the cash open." },
  { name: "Fade VWAP",       category: "Mean Rev",   tier: "B", oneLiner: "Counter-trend entry at VWAP after extended move." },
  { name: "IB Break",        category: "Trend",      tier: "A", oneLiner: "Break and acceptance outside the Initial Balance." },
  { name: "OR Break",        category: "Trend",      tier: "B", oneLiner: "Break and acceptance outside the opening range." },
  { name: "Bracket Fade",    category: "Mean Rev",   tier: "C", oneLiner: "Fade the edge of a clearly defined intraday range." },
  { name: "Reclaim",         category: "Reversal",   tier: "B", oneLiner: "Price reclaims a key level after losing it; ride the reclaim." },
  { name: "Liquidity Sweep", category: "Reversal",   tier: "A", oneLiner: "Sweep of obvious liquidity then return back through origin." },
  { name: "News Reaction",   category: "Event",      tier: "C", oneLiner: "Initial reaction to a scheduled news release; play the second move." },
];

/* ───────── Mistakes (~12) ───────── */
const MISTAKES: (typeof schema.mistakes.$inferInsert)[] = [
  { name: "Moved stop",          oneLiner: "Adjusted stop wider after entry to avoid being stopped." },
  { name: "Oversized",           oneLiner: "Position size larger than the playbook allowed for this setup." },
  { name: "Chased",              oneLiner: "Entered late, well past the planned entry zone." },
  { name: "Traded news",         oneLiner: "Took a trade through a high-impact news event." },
  { name: "Broke rules",         oneLiner: "Took a trade outside firm rules or session limits." },
  { name: "Did not honor plan",  oneLiner: "Skipped or modified the prepared plan for this trade." },
  { name: "Revenge trade",       oneLiner: "Re-entered immediately after a loss, no fresh setup." },
  { name: "Cut winner early",    oneLiner: "Exited well before target without trigger." },
  { name: "Held loser late",     oneLiner: "Did not take the planned stop." },
  { name: "Overtraded",          oneLiner: "More trades than the daily plan allowed." },
  { name: "Wrong instrument",    oneLiner: "Took a setup on an instrument it doesn't apply to." },
  { name: "Missed entry",        oneLiner: "Recognized the setup but did not pull the trigger." },
];

/* ───────── Tendencies (~8 self-tagged biases) ───────── */
const TENDENCIES: (typeof schema.tendencies.$inferInsert)[] = [
  { name: "Revenge after 2 losses",   oneLiner: "Trade size or frequency rises after consecutive losses." },
  { name: "Size up when green",       oneLiner: "Increase contracts after a strong winner; usually gives back." },
  { name: "Anchor to entry",          oneLiner: "Refuse to honor stop because of entry price emotional anchor." },
  { name: "FOMO chasing",             oneLiner: "Chase moves I missed, entering late." },
  { name: "Boredom trades",           oneLiner: "Take low-quality setups in slow periods to feel busy." },
  { name: "Hesitate at A+",           oneLiner: "Freeze on the best setups, take the B-grade ones." },
  { name: "Fade strong trends",       oneLiner: "Try to call tops/bottoms in clear trending markets." },
  { name: "Quit on green",            oneLiner: "Stop trading after a single winner regardless of plan." },
];

/* ───────── Biases (~10 cognitive biases) ───────── */
const BIASES: (typeof schema.biases.$inferInsert)[] = [
  { name: "Loss aversion",       definition: "Losses hurt ~2x as much as equivalent gains feel good." },
  { name: "Confirmation bias",   definition: "Seeking evidence that supports an existing position." },
  { name: "Anchoring",           definition: "Fixating on a reference price (entry, prior high) regardless of new info." },
  { name: "Recency bias",        definition: "Overweighting the most recent outcomes vs the long-run base rate." },
  { name: "Sunk cost fallacy",   definition: "Refusing to exit because of effort or money already committed." },
  { name: "Overconfidence",      definition: "Underestimating how much you don't know after a winning streak." },
  { name: "Hot-hand fallacy",    definition: "Believing winners predict more winners (or losers predict losers)." },
  { name: "Disposition effect",  definition: "Cutting winners too early and holding losers too long." },
  { name: "Outcome bias",        definition: "Judging a decision by its result rather than its process." },
  { name: "Narrative fallacy",   definition: "Building a story that 'explains' random outcomes." },
];

/* ───────── Firms (5 prop firms) ───────── */
const FIRMS = [
  { name: "Apex Trader Funding", website: "https://apextraderfunding.com" },
  { name: "Tradeify",            website: "https://tradeify.co" },
  { name: "Lucid Trading",       website: "https://lucidtrading.com" },
  { name: "Take Profit Trader",  website: "https://takeprofittrader.com" },
  { name: "Raen",                website: null },
];

/* ───────── Sample programs (one per firm to start) ───────── */
const PROGRAMS = (firmIdByName: Map<string, number>) => [
  { firmId: firmIdByName.get("Apex Trader Funding")!, name: "Apex 100K Eval",       startingBalance: 100_000 },
  { firmId: firmIdByName.get("Tradeify")!,            name: "Advanced 50K",          startingBalance: 50_000 },
  { firmId: firmIdByName.get("Lucid Trading")!,       name: "Lucid 50K",             startingBalance: 50_000 },
  { firmId: firmIdByName.get("Take Profit Trader")!,  name: "TPT 50K",               startingBalance: 50_000 },
  { firmId: firmIdByName.get("Raen")!,                name: "Raen 50K",              startingBalance: 50_000 },
];

/* ───────── Sample rule templates ───────── */
const RULE_TEMPLATES = (programIdByName: Map<string, number>): (typeof schema.ruleTemplates.$inferInsert)[] => [
  /* Apex 100K Eval — trailing-then-locks DD */
  {
    programId: programIdByName.get("Apex 100K Eval")!,
    stageType: "eval",
    stageDisplayLabel: "Evaluation",
    profitTarget: 3_000,
    drawdownType: "trailing_eod",
    drawdownAmount: 3_000,
    drawdownLockAt: 103_100,
    dailyLossLimit: null,
    minTradingDays: 7,
    consistencyPct: 0.30,
    maxContracts: 10,
    notes: "Trailing EOD DD up to +$3,100, then locks at $103,100. 30% consistency rule.",
  },
  /* Tradeify Advanced 50K Eval */
  {
    programId: programIdByName.get("Advanced 50K")!,
    stageType: "eval",
    stageDisplayLabel: "Eval",
    profitTarget: 3_000,
    drawdownType: "trailing_eod",
    drawdownAmount: 2_000,
    dailyLossLimit: 1_250,
    minTradingDays: 5,
    consistencyPct: 0.40,
    maxContracts: 6,
    notes: "EOD trailing DD $2k. Daily loss $1,250. 40% consistency.",
  },
  /* Lucid 50K (instant-funded style) */
  {
    programId: programIdByName.get("Lucid 50K")!,
    stageType: "live_funded",
    stageDisplayLabel: "Live",
    profitTarget: null,
    drawdownType: "trailing_eod",
    drawdownAmount: 2_000,
    dailyLossLimit: 1_000,
    consistencyPct: 0.50,
    maxContracts: 5,
    payoutCadenceDays: 7,
    payoutMinimum: 200,
    firstPayoutEligibilityDays: 5,
    firstPayoutMinProfit: 750,
    payoutSplitPct: 0.90,
    notes: "Instant funded. EOD trailing DD $2k. 50% consistency. Payouts every 7 days, min $200.",
  },
  /* TPT 50K Eval */
  {
    programId: programIdByName.get("TPT 50K")!,
    stageType: "eval",
    stageDisplayLabel: "Eval",
    profitTarget: 3_000,
    drawdownType: "trailing_eod",
    drawdownAmount: 2_000,
    dailyLossLimit: null,
    minTradingDays: 7,
    consistencyPct: 0.50,
    maxContracts: 5,
    notes: "EOD trailing DD $2k. Min 7 days. 50% consistency.",
  },
  /* Raen 50K */
  {
    programId: programIdByName.get("Raen 50K")!,
    stageType: "eval",
    stageDisplayLabel: "Eval",
    profitTarget: 3_000,
    drawdownType: "trailing_eod",
    drawdownAmount: 2_000,
    minTradingDays: 5,
    consistencyPct: 0.40,
    maxContracts: 5,
    notes: "Treated as a prop firm (per user). Adjust rules to match firm spec.",
  },
];

/* ───────── Goals (sample process rules) ───────── */
const GOALS: (typeof schema.goals.$inferInsert)[] = [
  { rule: "No trades after 11:30 ET", type: "mechanical", mechanicalDef: JSON.stringify({ kind: "no_trade_after", time: "11:30" }) },
  { rule: "Max 3 trades per session", type: "mechanical", mechanicalDef: JSON.stringify({ kind: "max_trades_per_day", n: 3 }) },
  { rule: "Always honor my stop",     type: "mechanical", mechanicalDef: JSON.stringify({ kind: "no_mistake_tag", mistake: "Moved stop" }) },
  { rule: "No revenge trades",        type: "mechanical", mechanicalDef: JSON.stringify({ kind: "no_mistake_tag", mistake: "Revenge trade" }) },
  { rule: "Reviewed prior session before market open", type: "reflective", mechanicalDef: null },
];

/* ───────── To-Do recurring checklist ───────── */
const TODOS: (typeof schema.todoItems.$inferInsert)[] = [
  { title: "Review yesterday's trades",      kind: "recurring" },
  { title: "Mark daily levels",              kind: "recurring" },
  { title: "Check news / events",            kind: "recurring" },
  { title: "Pre-market gameplan written",    kind: "recurring" },
  { title: "End-of-day journal entry",       kind: "recurring" },
  { title: "Build out Setups Library entries (long term)", kind: "backlog" },
];

async function seed() {
  console.log("Seeding…");

  await db.insert(schema.instruments).values(INSTRUMENTS).onConflictDoNothing();
  console.log(`  · ${INSTRUMENTS.length} instruments`);

  await db.insert(schema.setups).values(SETUPS).onConflictDoNothing();
  console.log(`  · ${SETUPS.length} setups`);

  await db.insert(schema.mistakes).values(MISTAKES).onConflictDoNothing();
  console.log(`  · ${MISTAKES.length} mistakes`);

  await db.insert(schema.tendencies).values(TENDENCIES).onConflictDoNothing();
  console.log(`  · ${TENDENCIES.length} tendencies`);

  await db.insert(schema.biases).values(BIASES).onConflictDoNothing();
  console.log(`  · ${BIASES.length} biases`);

  for (const f of FIRMS) {
    await db.insert(schema.firms).values(f).onConflictDoNothing();
  }
  const allFirms = await db.select().from(schema.firms);
  const firmIdByName = new Map(allFirms.map((f) => [f.name, f.id] as const));
  console.log(`  · ${allFirms.length} firms`);

  for (const p of PROGRAMS(firmIdByName)) {
    await db.insert(schema.programs).values(p).onConflictDoNothing();
  }
  const allPrograms = await db.select().from(schema.programs);
  const programIdByName = new Map(allPrograms.map((p) => [p.name, p.id] as const));
  console.log(`  · ${allPrograms.length} programs`);

  for (const t of RULE_TEMPLATES(programIdByName)) {
    await db.insert(schema.ruleTemplates).values(t);
  }
  console.log(`  · ${RULE_TEMPLATES(programIdByName).length} rule templates`);

  await db.insert(schema.goals).values(GOALS);
  console.log(`  · ${GOALS.length} goals`);

  await db.insert(schema.todoItems).values(TODOS);
  console.log(`  · ${TODOS.length} todo items`);

  /* Sample accounts to demonstrate the Risk dashboard. Skip if any account exists. */
  const existing = await db.select().from(schema.accounts).limit(1);
  if (existing.length === 0) {
    const apexEval = await db
      .select()
      .from(schema.ruleTemplates)
      .where((/* drizzle-style filter */ () => undefined as any))
      .all();
    const ruleTpls = await db.select().from(schema.ruleTemplates);
    const tplByProgram = new Map(ruleTpls.map((t) => [t.programId, t.id] as const));

    /* PA accounts */
    await db.insert(schema.accounts).values([
      { nickname: "PA · Tradovate Futures", accountType: "pa", startingBalance: 25_000, state: "active" },
      { nickname: "PA · IBKR Taxable",      accountType: "pa", startingBalance: 50_000, state: "active" },
    ]);

    /* Prop accounts (3 Apex 100K Evals + 2 Tradeify + 1 Lucid + 1 TPT + 1 Raen) */
    const apexProg = allPrograms.find((p) => p.name === "Apex 100K Eval")!;
    const tradeifyProg = allPrograms.find((p) => p.name === "Advanced 50K")!;
    const lucidProg = allPrograms.find((p) => p.name === "Lucid 50K")!;
    const tptProg = allPrograms.find((p) => p.name === "TPT 50K")!;
    const raenProg = allPrograms.find((p) => p.name === "Raen 50K")!;

    const propRows: (typeof schema.accounts.$inferInsert)[] = [];
    for (let i = 1; i <= 3; i++) {
      propRows.push({
        nickname: `Apex 100K Eval #${i}`,
        accountType: "prop",
        firmId: firmIdByName.get("Apex Trader Funding"),
        programId: apexProg.id,
        currentStage: "eval",
        ruleTemplateId: tplByProgram.get(apexProg.id),
        startingBalance: 100_000,
        state: "active",
      });
    }
    for (let i = 1; i <= 2; i++) {
      propRows.push({
        nickname: `Tradeify Advanced 50K #${i}`,
        accountType: "prop",
        firmId: firmIdByName.get("Tradeify"),
        programId: tradeifyProg.id,
        currentStage: "eval",
        ruleTemplateId: tplByProgram.get(tradeifyProg.id),
        startingBalance: 50_000,
        state: "active",
      });
    }
    propRows.push({
      nickname: "Lucid 50K Live #1",
      accountType: "prop",
      firmId: firmIdByName.get("Lucid Trading"),
      programId: lucidProg.id,
      currentStage: "live_funded",
      ruleTemplateId: tplByProgram.get(lucidProg.id),
      startingBalance: 50_000,
      state: "active",
    });
    propRows.push({
      nickname: "TPT 50K Eval #1",
      accountType: "prop",
      firmId: firmIdByName.get("Take Profit Trader"),
      programId: tptProg.id,
      currentStage: "eval",
      ruleTemplateId: tplByProgram.get(tptProg.id),
      startingBalance: 50_000,
      state: "active",
    });
    propRows.push({
      nickname: "Raen 50K Eval #1",
      accountType: "prop",
      firmId: firmIdByName.get("Raen"),
      programId: raenProg.id,
      currentStage: "eval",
      ruleTemplateId: tplByProgram.get(raenProg.id),
      startingBalance: 50_000,
      state: "active",
    });

    await db.insert(schema.accounts).values(propRows);
    console.log(`  · ${propRows.length + 2} accounts (PA + Prop)`);
  }

  console.log("✓ seed complete");
  sqlite.close();
}

seed().catch((e) => {
  console.error(e);
  sqlite.close();
  process.exit(1);
});
