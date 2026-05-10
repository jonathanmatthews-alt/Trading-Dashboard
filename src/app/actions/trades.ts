"use server";

import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

  revalidatePath("/trades");
  revalidatePath("/risk");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/performance");
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

  revalidatePath("/trades");
  revalidatePath("/journal");
  return { ok: true };
}

export async function deleteTrade(tradeEventId: number) {
  await db.delete(schema.tradeEvents).where(eq(schema.tradeEvents.id, tradeEventId));
  revalidatePath("/trades");
  revalidatePath("/risk");
  revalidatePath("/");
  return { ok: true };
}
