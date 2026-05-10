"use server";

import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ───────── Setups ───────── */
const SetupSchema = z.object({
  id: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  tier: z.string().max(8).nullable().optional(),
  oneLiner: z.string().max(500).nullable().optional(),
  criteria: z.string().nullable().optional(),
  antiCriteria: z.string().nullable().optional(),
  indicators: z.string().nullable().optional(),
  gotchas: z.string().nullable().optional(),
  planEntry: z.string().nullable().optional(),
  planStop: z.string().nullable().optional(),
  planTarget: z.string().nullable().optional(),
  planSizing: z.string().nullable().optional(),
  planContexts: z.string().nullable().optional(),
});

export async function upsertSetup(input: unknown) {
  const data = SetupSchema.parse(input);
  const { id, ...values } = data;
  const cleaned = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? null : v]),
  ) as typeof values;
  if (id) {
    await db.update(schema.setups).set(cleaned).where(eq(schema.setups.id, id));
  } else {
    await db.insert(schema.setups).values(cleaned as any);
  }
  revalidatePath("/setups");
  revalidatePath("/trades");
  return { ok: true };
}

export async function deleteSetup(id: number) {
  await db.update(schema.setups).set({ archived: true }).where(eq(schema.setups.id, id));
  revalidatePath("/setups");
  revalidatePath("/trades");
  return { ok: true };
}

/* ───────── Mistakes ───────── */
const MistakeSchema = z.object({
  id: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().min(1).max(120),
  oneLiner: z.string().max(500).nullable().optional(),
  triggers: z.string().nullable().optional(),
  prevention: z.string().nullable().optional(),
});

export async function upsertMistake(input: unknown) {
  const data = MistakeSchema.parse(input);
  const { id, ...values } = data;
  const cleaned = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? null : v]),
  ) as typeof values;
  if (id) {
    await db.update(schema.mistakes).set(cleaned).where(eq(schema.mistakes.id, id));
  } else {
    await db.insert(schema.mistakes).values(cleaned as any);
  }
  revalidatePath("/mistakes");
  revalidatePath("/trades");
  return { ok: true };
}

export async function deleteMistake(id: number) {
  await db.update(schema.mistakes).set({ archived: true }).where(eq(schema.mistakes.id, id));
  revalidatePath("/mistakes");
  revalidatePath("/trades");
  return { ok: true };
}

/* ───────── Tendencies ───────── */
const TendencySchema = z.object({
  id: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().min(1).max(120),
  oneLiner: z.string().max(500).nullable().optional(),
  triggers: z.string().nullable().optional(),
  counterStrategy: z.string().nullable().optional(),
});

export async function upsertTendency(input: unknown) {
  const data = TendencySchema.parse(input);
  const { id, ...values } = data;
  const cleaned = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? null : v]),
  ) as typeof values;
  if (id) {
    await db.update(schema.tendencies).set(cleaned).where(eq(schema.tendencies.id, id));
  } else {
    await db.insert(schema.tendencies).values(cleaned as any);
  }
  revalidatePath("/tendencies");
  revalidatePath("/trades");
  return { ok: true };
}

export async function deleteTendency(id: number) {
  await db
    .update(schema.tendencies)
    .set({ archived: true })
    .where(eq(schema.tendencies.id, id));
  revalidatePath("/tendencies");
  revalidatePath("/trades");
  return { ok: true };
}

/* ───────── Goals ───────── */
const GoalSchema = z.object({
  id: z.coerce.number().int().positive().nullable().optional(),
  rule: z.string().min(1).max(300),
  type: z.enum(["mechanical", "reflective"]),
  mechanicalDef: z.string().nullable().optional(),
});

export async function upsertGoal(input: unknown) {
  const data = GoalSchema.parse(input);
  const { id, ...values } = data;
  const cleaned = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? null : v]),
  ) as typeof values;
  if (id) {
    await db.update(schema.goals).set(cleaned).where(eq(schema.goals.id, id));
  } else {
    await db.insert(schema.goals).values(cleaned as any);
  }
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteGoal(id: number) {
  await db.update(schema.goals).set({ archived: true }).where(eq(schema.goals.id, id));
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}
