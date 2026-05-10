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
