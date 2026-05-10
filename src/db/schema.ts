import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

/* ─── Instruments (CME/CBOT futures specs) ─── */
export const instruments = sqliteTable("instruments", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  tickSize: real("tick_size").notNull(),
  pointValue: real("point_value").notNull(),
  ticksPerPoint: real("ticks_per_point").notNull(),
  sessionStart: text("session_start"),
  sessionEnd: text("session_end"),
});

/* ─── Setups · Mistakes · Tendencies · Biases (catalogues) ─── */
export const setups = sqliteTable("setups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  tier: text("tier"),
  oneLiner: text("one_liner"),
  criteria: text("criteria"),
  antiCriteria: text("anti_criteria"),
  indicators: text("indicators"),
  gotchas: text("gotchas"),
  planEntry: text("plan_entry"),
  planStop: text("plan_stop"),
  planTarget: text("plan_target"),
  planSizing: text("plan_sizing"),
  planContexts: text("plan_contexts"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const mistakes = sqliteTable("mistakes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  oneLiner: text("one_liner"),
  triggers: text("triggers"),
  prevention: text("prevention"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const tendencies = sqliteTable("tendencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  oneLiner: text("one_liner"),
  triggers: text("triggers"),
  counterStrategy: text("counter_strategy"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const biases = sqliteTable("biases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  definition: text("definition"),
  examples: text("examples"),
  recognitionCues: text("recognition_cues"),
  countermeasure: text("countermeasure"),
});

/* ─── Firms · Programs · Rule templates · Accounts ─── */
export const firms = sqliteTable("firms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  website: text("website"),
});

export const programs = sqliteTable("programs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firmId: integer("firm_id")
    .notNull()
    .references(() => firms.id),
  name: text("name").notNull(),
  startingBalance: real("starting_balance").notNull(),
});

/**
 * RuleTemplate is versioned (snapshot of rules at point in time).
 * Each Account.ruleTemplateId points at a specific version.
 * Stage display labels are stored here too (per firm convention).
 */
export const ruleTemplates = sqliteTable(
  "rule_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    stageType: text("stage_type", {
      enum: [
        "eval",
        "sim_funded",
        "live_funded",
        "payout_active",
        "blown",
        "archived",
      ],
    }).notNull(),
    stageDisplayLabel: text("stage_display_label").notNull(),
    version: integer("version").notNull().default(1),
    /* Core */
    profitTarget: real("profit_target"),
    drawdownType: text("drawdown_type", {
      enum: ["static", "trailing_intraday", "trailing_eod"],
    }),
    drawdownAmount: real("drawdown_amount"),
    drawdownLockAt: real("drawdown_lock_at"),
    dailyLossLimit: real("daily_loss_limit"),
    /* Compliance */
    minTradingDays: integer("min_trading_days"),
    consistencyPct: real("consistency_pct"),
    maxContracts: integer("max_contracts"),
    allowedInstrumentsCsv: text("allowed_instruments_csv"),
    newsRestrictions: text("news_restrictions"),
    /* Payout */
    payoutCadenceDays: integer("payout_cadence_days"),
    payoutMinimum: real("payout_minimum"),
    firstPayoutEligibilityDays: integer("first_payout_eligibility_days"),
    firstPayoutMinProfit: real("first_payout_min_profit"),
    /* Costs */
    activationFee: real("activation_fee"),
    monthlyFee: real("monthly_fee"),
    payoutSplitPct: real("payout_split_pct"),
    payoutBufferRetained: real("payout_buffer_retained"),
    notes: text("notes"),
  },
  (t) => ({
    progStageIdx: index("rule_templates_program_stage_idx").on(
      t.programId,
      t.stageType,
      t.version,
    ),
  }),
);

/**
 * accountType = "pa" or "prop". PA accounts have no firm/program/rules.
 */
export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nickname: text("nickname").notNull(),
    accountType: text("account_type", { enum: ["pa", "prop"] }).notNull(),
    firmId: integer("firm_id").references(() => firms.id),
    programId: integer("program_id").references(() => programs.id),
    currentStage: text("current_stage", {
      enum: [
        "eval",
        "sim_funded",
        "live_funded",
        "payout_active",
        "blown",
        "archived",
      ],
    }),
    state: text("state", {
      enum: ["active", "suspended", "blown", "passed", "archived"],
    })
      .notNull()
      .default("active"),
    ruleTemplateId: integer("rule_template_id").references(
      () => ruleTemplates.id,
    ),
    startingBalance: real("starting_balance").notNull(),
    purchasedAt: text("purchased_at"),
    activatedAt: text("activated_at"),
    closedAt: text("closed_at"),
    /* Per-account rule overrides (JSON blob keyed by template field name) */
    ruleOverrides: text("rule_overrides"),
    notes: text("notes"),
  },
  (t) => ({
    typeStateIdx: index("accounts_type_state_idx").on(t.accountType, t.state),
  }),
);

export const accountTransitions = sqliteTable("account_transitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  occurredAt: text("occurred_at").notNull().default(sql`(current_timestamp)`),
  reason: text("reason"),
});

/* ─── Trades (TradeEvent fans out to TradeExecutions) ─── */
export const tradeEvents = sqliteTable(
  "trade_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instrument: text("instrument")
      .notNull()
      .references(() => instruments.symbol),
    direction: text("direction", { enum: ["long", "short"] }).notNull(),
    entryTime: text("entry_time").notNull(),
    exitTime: text("exit_time").notNull(),
    entryAvg: real("entry_avg").notNull(),
    exitAvg: real("exit_avg").notNull(),
    /* MAE/MFE in points (positive numbers; MAE is adverse, MFE is favorable). */
    maePoints: real("mae_points").notNull(),
    mfePoints: real("mfe_points").notNull(),
    initialStopPoints: real("initial_stop_points").notNull(),
    setupId: integer("setup_id").references(() => setups.id),
    note: text("note"),
    enriched: integer("enriched", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (t) => ({
    entryTimeIdx: index("trade_events_entry_time_idx").on(t.entryTime),
    enrichedIdx: index("trade_events_enriched_idx").on(t.enriched),
  }),
);

export const tradeExecutions = sqliteTable(
  "trade_executions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tradeEventId: integer("trade_event_id")
      .notNull()
      .references(() => tradeEvents.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    contracts: integer("contracts").notNull(),
    /* Optional per-execution overrides — null means "derive from trade event" */
    overrideEntry: real("override_entry"),
    overrideExit: real("override_exit"),
    overrideMaePoints: real("override_mae_points"),
    overrideMfePoints: real("override_mfe_points"),
    overridePnlDollars: real("override_pnl_dollars"),
  },
  (t) => ({
    tradeIdx: index("trade_executions_trade_idx").on(t.tradeEventId),
    accountIdx: index("trade_executions_account_idx").on(t.accountId),
  }),
);

/* Many-to-many: trade event ↔ mistakes / tendencies */
export const tradeEventMistakes = sqliteTable(
  "trade_event_mistakes",
  {
    tradeEventId: integer("trade_event_id")
      .notNull()
      .references(() => tradeEvents.id, { onDelete: "cascade" }),
    mistakeId: integer("mistake_id")
      .notNull()
      .references(() => mistakes.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tradeEventId, t.mistakeId] }) }),
);

export const tradeEventTendencies = sqliteTable(
  "trade_event_tendencies",
  {
    tradeEventId: integer("trade_event_id")
      .notNull()
      .references(() => tradeEvents.id, { onDelete: "cascade" }),
    tendencyId: integer("tendency_id")
      .notNull()
      .references(() => tendencies.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tradeEventId, t.tendencyId] }) }),
);

/* ─── Goals · Daily logs · News events · Importer profiles ─── */
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rule: text("rule").notNull(),
  type: text("type", { enum: ["mechanical", "reflective"] }).notNull(),
  /* For mechanical: a JSON-encoded rule definition (e.g. { "kind": "no_trade_after", "time": "11:30" }) */
  mechanicalDef: text("mechanical_def"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const goalDailyChecks = sqliteTable(
  "goal_daily_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    goalId: integer("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    autoChecked: integer("auto_checked", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({ goalDateIdx: index("goal_daily_checks_idx").on(t.goalId, t.date) }),
);

export const dailyLogs = sqliteTable("daily_logs", {
  date: text("date").primaryKey(),
  body: text("body"),
  mood: integer("mood"),
  sleepHours: real("sleep_hours"),
  tilted: integer("tilted", { mode: "boolean" }),
});

export const newsEvents = sqliteTable("news_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  time: text("time"),
  title: text("title").notNull(),
  impact: text("impact", { enum: ["high", "medium", "low"] }).notNull(),
  source: text("source", { enum: ["manual", "auto"] }).notNull().default("manual"),
});

export const todoItems = sqliteTable("todo_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["recurring", "backlog"] }).notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  doneAt: text("done_at"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const todoChecks = sqliteTable(
  "todo_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    todoItemId: integer("todo_item_id")
      .notNull()
      .references(() => todoItems.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
  },
  (t) => ({ todoDateIdx: index("todo_checks_idx").on(t.todoItemId, t.date) }),
);

/* ─── Relations ─── */
export const tradeEventsRelations = relations(tradeEvents, ({ one, many }) => ({
  setup: one(setups, {
    fields: [tradeEvents.setupId],
    references: [setups.id],
  }),
  instrument: one(instruments, {
    fields: [tradeEvents.instrument],
    references: [instruments.symbol],
  }),
  executions: many(tradeExecutions),
  mistakes: many(tradeEventMistakes),
  tendencies: many(tradeEventTendencies),
}));

export const tradeExecutionsRelations = relations(tradeExecutions, ({ one }) => ({
  tradeEvent: one(tradeEvents, {
    fields: [tradeExecutions.tradeEventId],
    references: [tradeEvents.id],
  }),
  account: one(accounts, {
    fields: [tradeExecutions.accountId],
    references: [accounts.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  firm: one(firms, { fields: [accounts.firmId], references: [firms.id] }),
  program: one(programs, {
    fields: [accounts.programId],
    references: [programs.id],
  }),
  ruleTemplate: one(ruleTemplates, {
    fields: [accounts.ruleTemplateId],
    references: [ruleTemplates.id],
  }),
  transitions: many(accountTransitions),
  executions: many(tradeExecutions),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  firm: one(firms, { fields: [programs.firmId], references: [firms.id] }),
  ruleTemplates: many(ruleTemplates),
}));

export const ruleTemplatesRelations = relations(ruleTemplates, ({ one }) => ({
  program: one(programs, {
    fields: [ruleTemplates.programId],
    references: [programs.id],
  }),
}));

export const tradeEventMistakesRelations = relations(
  tradeEventMistakes,
  ({ one }) => ({
    tradeEvent: one(tradeEvents, {
      fields: [tradeEventMistakes.tradeEventId],
      references: [tradeEvents.id],
    }),
    mistake: one(mistakes, {
      fields: [tradeEventMistakes.mistakeId],
      references: [mistakes.id],
    }),
  }),
);

export const tradeEventTendenciesRelations = relations(
  tradeEventTendencies,
  ({ one }) => ({
    tradeEvent: one(tradeEvents, {
      fields: [tradeEventTendencies.tradeEventId],
      references: [tradeEvents.id],
    }),
    tendency: one(tendencies, {
      fields: [tradeEventTendencies.tendencyId],
      references: [tendencies.id],
    }),
  }),
);

export type Instrument = typeof instruments.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type TradeEvent = typeof tradeEvents.$inferSelect;
export type TradeExecution = typeof tradeExecutions.$inferSelect;
export type Setup = typeof setups.$inferSelect;
export type Mistake = typeof mistakes.$inferSelect;
export type Tendency = typeof tendencies.$inferSelect;
export type RuleTemplate = typeof ruleTemplates.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Firm = typeof firms.$inferSelect;
