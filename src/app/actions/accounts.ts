"use server";

import { db, schema } from "@/db/client";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { STAGE_TYPES } from "@/lib/stages";

const TransitionSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  toStage: z.enum(STAGE_TYPES),
  reason: z.string().max(500).optional(),
});

/**
 * Move an account to a new stage. Manual confirm only — caller picks the
 * target stage. Inserts a transition history row and (when possible) swaps
 * the account's ruleTemplateId to the matching template for the new stage on
 * the same program. Updates account.state for terminal stages.
 */
export async function transitionAccount(input: unknown) {
  const data = TransitionSchema.parse(input);

  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, data.accountId))
    .limit(1);
  if (!account) throw new Error("account not found");

  if (account.currentStage === data.toStage) {
    throw new Error(`already in stage '${data.toStage}'`);
  }

  /* Pick a rule template for the new stage (latest version on this program). */
  let newRuleTemplateId: number | null = account.ruleTemplateId ?? null;
  if (
    account.programId != null &&
    data.toStage !== "blown" &&
    data.toStage !== "archived"
  ) {
    const tpl = await db
      .select()
      .from(schema.ruleTemplates)
      .where(
        and(
          eq(schema.ruleTemplates.programId, account.programId),
          eq(schema.ruleTemplates.stageType, data.toStage),
        ),
      )
      .orderBy(schema.ruleTemplates.version)
      .limit(1);
    if (tpl[0]) newRuleTemplateId = tpl[0].id;
  }

  const newState =
    data.toStage === "blown"
      ? "blown"
      : data.toStage === "archived"
        ? "archived"
        : "active";

  const now = new Date().toISOString();

  await db
    .update(schema.accounts)
    .set({
      currentStage: data.toStage,
      state: newState,
      ruleTemplateId: newRuleTemplateId,
      closedAt:
        data.toStage === "blown" || data.toStage === "archived"
          ? now
          : null,
    })
    .where(eq(schema.accounts.id, data.accountId));

  await db.insert(schema.accountTransitions).values({
    accountId: data.accountId,
    fromStage: account.currentStage ?? null,
    toStage: data.toStage,
    reason: data.reason ?? null,
  });

  revalidatePath("/risk");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Convenience: revert the most recent transition (useful when you click the
 * wrong button). Restores currentStage and removes the row.
 */
export async function undoLastTransition(accountId: number) {
  const [last] = await db
    .select()
    .from(schema.accountTransitions)
    .where(eq(schema.accountTransitions.accountId, accountId))
    .orderBy(schema.accountTransitions.id)
    .limit(1);
  /* Drizzle SQLite default order is ascending; we want the latest. */
  const all = await db
    .select()
    .from(schema.accountTransitions)
    .where(eq(schema.accountTransitions.accountId, accountId));
  const newest = all.sort((a, b) => b.id - a.id)[0];
  if (!newest) throw new Error("no transitions to undo");

  const restoreStage = newest.fromStage as
    | (typeof STAGE_TYPES)[number]
    | null;
  const restoreState =
    restoreStage === "blown"
      ? "blown"
      : restoreStage === "archived"
        ? "archived"
        : "active";

  await db
    .update(schema.accounts)
    .set({
      currentStage: restoreStage as any,
      state: restoreState,
      closedAt: null,
    })
    .where(eq(schema.accounts.id, accountId));

  await db
    .delete(schema.accountTransitions)
    .where(eq(schema.accountTransitions.id, newest.id));

  revalidatePath("/risk");
  revalidatePath("/");
  return { ok: true };
}

export async function listTransitions(accountId: number) {
  const rows = await db
    .select()
    .from(schema.accountTransitions)
    .where(eq(schema.accountTransitions.accountId, accountId));
  return rows.sort((a, b) => b.id - a.id);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Account CRUD                                                          */
/* ────────────────────────────────────────────────────────────────────── */

const AccountSchema = z.object({
  id: z.coerce.number().int().positive().nullable().optional(),
  nickname: z.string().min(1).max(120),
  accountType: z.enum(["pa", "prop"]),
  firmId: z.coerce.number().int().positive().nullable().optional(),
  programId: z.coerce.number().int().positive().nullable().optional(),
  currentStage: z.enum(STAGE_TYPES).nullable().optional(),
  startingBalance: z.coerce.number(),
  notes: z.string().nullable().optional(),
});

export async function upsertAccount(input: unknown) {
  const data = AccountSchema.parse(input);

  /* Pick rule template for the chosen stage on this program (if any). */
  let ruleTemplateId: number | null = null;
  if (data.programId && data.currentStage) {
    const tpl = await db
      .select()
      .from(schema.ruleTemplates)
      .where(
        and(
          eq(schema.ruleTemplates.programId, data.programId),
          eq(schema.ruleTemplates.stageType, data.currentStage),
        ),
      )
      .orderBy(schema.ruleTemplates.version)
      .limit(1);
    if (tpl[0]) ruleTemplateId = tpl[0].id;
  }

  const values = {
    nickname: data.nickname,
    accountType: data.accountType,
    firmId: data.accountType === "pa" ? null : (data.firmId ?? null),
    programId: data.accountType === "pa" ? null : (data.programId ?? null),
    currentStage: data.accountType === "pa" ? null : (data.currentStage ?? null),
    ruleTemplateId,
    startingBalance: data.startingBalance,
    notes: data.notes ?? null,
  };

  if (data.id) {
    await db
      .update(schema.accounts)
      .set(values)
      .where(eq(schema.accounts.id, data.id));
  } else {
    const [created] = await db
      .insert(schema.accounts)
      .values({ ...values, state: "active" })
      .returning();
    /* Initial stage entry as a transition (so history starts). */
    if (data.currentStage) {
      await db.insert(schema.accountTransitions).values({
        accountId: created.id,
        fromStage: null,
        toStage: data.currentStage,
        reason: "Account created",
      });
    }
  }
  revalidatePath("/risk");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAccount(id: number) {
  /* Soft-delete via archived state. Preserves stats history. */
  const now = new Date().toISOString();
  await db
    .update(schema.accounts)
    .set({ state: "archived", currentStage: "archived", closedAt: now })
    .where(eq(schema.accounts.id, id));
  await db.insert(schema.accountTransitions).values({
    accountId: id,
    fromStage: null,
    toStage: "archived",
    reason: "Archived from UI",
  });
  revalidatePath("/risk");
  revalidatePath("/");
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Firms / Programs / Rule templates                                     */
/* ────────────────────────────────────────────────────────────────────── */

const FirmSchema = z.object({
  name: z.string().min(1).max(120),
  website: z.string().url().nullable().optional().or(z.literal("")),
});

export async function createFirm(input: unknown) {
  const data = FirmSchema.parse(input);
  const [created] = await db
    .insert(schema.firms)
    .values({ name: data.name, website: data.website || null })
    .returning();
  revalidatePath("/risk");
  return { id: created.id };
}

const ProgramSchema = z.object({
  firmId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(120),
  startingBalance: z.coerce.number().positive(),
});

export async function createProgram(input: unknown) {
  const data = ProgramSchema.parse(input);
  const [created] = await db
    .insert(schema.programs)
    .values(data)
    .returning();
  revalidatePath("/risk");
  return { id: created.id };
}

const RuleTemplateSchema = z.object({
  programId: z.coerce.number().int().positive(),
  stageType: z.enum(STAGE_TYPES),
  stageDisplayLabel: z.string().min(1).max(60),
  profitTarget: z.coerce.number().nullable().optional(),
  drawdownType: z
    .enum(["static", "trailing_intraday", "trailing_eod"])
    .nullable()
    .optional(),
  drawdownAmount: z.coerce.number().nullable().optional(),
  drawdownLockAt: z.coerce.number().nullable().optional(),
  dailyLossLimit: z.coerce.number().nullable().optional(),
  minTradingDays: z.coerce.number().int().nullable().optional(),
  consistencyPct: z.coerce.number().min(0).max(1).nullable().optional(),
  maxContracts: z.coerce.number().int().nullable().optional(),
  payoutCadenceDays: z.coerce.number().int().nullable().optional(),
  payoutMinimum: z.coerce.number().nullable().optional(),
  firstPayoutEligibilityDays: z.coerce.number().int().nullable().optional(),
  firstPayoutMinProfit: z.coerce.number().nullable().optional(),
  payoutSplitPct: z.coerce.number().min(0).max(1).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createRuleTemplate(input: unknown) {
  const data = RuleTemplateSchema.parse(input);
  /* Increment version automatically per (program, stage) */
  const existing = await db
    .select()
    .from(schema.ruleTemplates)
    .where(
      and(
        eq(schema.ruleTemplates.programId, data.programId),
        eq(schema.ruleTemplates.stageType, data.stageType),
      ),
    );
  const nextVersion =
    existing.reduce((max, r) => Math.max(max, r.version), 0) + 1;
  const [created] = await db
    .insert(schema.ruleTemplates)
    .values({ ...data, version: nextVersion })
    .returning();
  revalidatePath("/risk");
  return { id: created.id };
}
