"use server";

import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { evaluateGoalsForDate } from "@/lib/goal-evaluator";

const FastLogSchema = z.object({
  instrument: z.string().min(1),
  direction: z.enum(["long", "short"]),
  entryTime: z.string().min(1),
  exitTime: z.string().min(1),
  entryAvg: z.coerce.number(),
  exitAvg: z.coerce.number(),
  maePoints: z.coerce.number().min(0),
  mfePoints: z.coerce.number().min(0),
  initialStopPoints: z.coerce.number().min(0.0001),
  fanout: z
    .array(
      z.object({
        accountId: z.coerce.number().int().positive(),
        contracts: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});

export async function logFastTrade(input: unknown) {
  const data = FastLogSchema.parse(input);

  const [event] = await db
    .insert(schema.tradeEvents)
    .values({
      instrument: data.instrument,
      direction: data.direction,
      entryTime: data.entryTime,
      exitTime: data.exitTime,
      entryAvg: data.entryAvg,
      exitAvg: data.exitAvg,
      maePoints: data.maePoints,
      mfePoints: data.mfePoints,
      initialStopPoints: data.initialStopPoints,
    })
    .returning();

  await db.insert(schema.tradeExecutions).values(
    data.fanout.map((f) => ({
      tradeEventId: event.id,
      accountId: f.accountId,
      contracts: f.contracts,
    })),
  );

  await evaluateGoalsForDate(data.entryTime.slice(0, 10));

  revalidatePath("/trades");
  revalidatePath("/risk");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/performance");
  revalidatePath("/goals");
  return { id: event.id };
}

const EnrichSchema = z.object({
  tradeEventId: z.coerce.number().int().positive(),
  setupId: z.coerce.number().int().positive().nullable().optional(),
  mistakeIds: z.array(z.coerce.number().int().positive()).default([]),
  tendencyIds: z.array(z.coerce.number().int().positive()).default([]),
  note: z.string().optional(),
  markEnriched: z.boolean().default(true),
});

export async function enrichTrade(input: unknown) {
  const data = EnrichSchema.parse(input);

  await db
    .update(schema.tradeEvents)
    .set({
      setupId: data.setupId ?? null,
      note: data.note ?? null,
      enriched: data.markEnriched,
    })
    .where(eq(schema.tradeEvents.id, data.tradeEventId));

  /* Replace mistake / tendency tags */
  await db
    .delete(schema.tradeEventMistakes)
    .where(eq(schema.tradeEventMistakes.tradeEventId, data.tradeEventId));
  if (data.mistakeIds.length > 0) {
    await db.insert(schema.tradeEventMistakes).values(
      data.mistakeIds.map((mistakeId) => ({
        tradeEventId: data.tradeEventId,
        mistakeId,
      })),
    );
  }
  await db
    .delete(schema.tradeEventTendencies)
    .where(eq(schema.tradeEventTendencies.tradeEventId, data.tradeEventId));
  if (data.tendencyIds.length > 0) {
    await db.insert(schema.tradeEventTendencies).values(
      data.tendencyIds.map((tendencyId) => ({
        tradeEventId: data.tradeEventId,
        tendencyId,
      })),
    );
  }

  /* Mistake/tendency tag changes affect mechanical goal evaluation. */
  const [event] = await db
    .select({ entryTime: schema.tradeEvents.entryTime })
    .from(schema.tradeEvents)
    .where(eq(schema.tradeEvents.id, data.tradeEventId))
    .limit(1);
  if (event) {
    await evaluateGoalsForDate(event.entryTime.slice(0, 10));
  }

  revalidatePath("/trades");
  revalidatePath("/journal");
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTrade(tradeEventId: number) {
  /* Capture the date before deletion so we can re-evaluate after. */
  const [event] = await db
    .select({ entryTime: schema.tradeEvents.entryTime })
    .from(schema.tradeEvents)
    .where(eq(schema.tradeEvents.id, tradeEventId))
    .limit(1);
  await db.delete(schema.tradeEvents).where(eq(schema.tradeEvents.id, tradeEventId));
  if (event) {
    await evaluateGoalsForDate(event.entryTime.slice(0, 10));
  }
  revalidatePath("/trades");
  revalidatePath("/risk");
  revalidatePath("/");
  revalidatePath("/goals");
  return { ok: true };
}
