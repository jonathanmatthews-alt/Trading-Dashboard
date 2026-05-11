"use server";

import { db, schema } from "@/db/client";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { evaluateGoalsForDate } from "@/lib/goal-evaluator";

const RowSchema = z.object({
  instrument: z.string().min(1),
  direction: z.enum(["long", "short"]),
  entryTime: z.string().min(1),
  exitTime: z.string().min(1),
  entryAvg: z.coerce.number(),
  exitAvg: z.coerce.number(),
  contracts: z.coerce.number().int().positive(),
  /* Either points OR dollars may be supplied for MAE/MFE. Server prefers
     points when present; otherwise derives from $ using instrument pointValue. */
  maePoints: z.coerce.number().min(0).optional(),
  mfePoints: z.coerce.number().min(0).optional(),
  maeDollars: z.coerce.number().optional(), // may be negative; we abs() it
  mfeDollars: z.coerce.number().optional(),
  initialStopPoints: z.coerce.number().positive().optional().default(1),
  /* When the broker reports authoritative PnL (incl. commissions), it
     becomes an override on the execution so we don't re-derive. */
  overridePnlDollars: z.coerce.number().optional(),
  accountId: z.coerce.number().int().positive(),
});

const ImportSchema = z.object({
  rows: z.array(RowSchema).min(1),
});

export async function importTradesCsv(input: unknown) {
  const data = ImportSchema.parse(input);

  /* Preload instruments for $ → points conversion. */
  const instruments = await db.select().from(schema.instruments);
  const instMap = new Map(instruments.map((i) => [i.symbol, i] as const));

  const datesAffected = new Set<string>();
  let inserted = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const inst = instMap.get(row.instrument);
    if (!inst) {
      errors.push({
        row: i,
        reason: `unknown instrument "${row.instrument}"`,
      });
      continue;
    }

    /* Resolve MAE/MFE in points. Prefer explicit points; otherwise derive
       from $: points = |$| / (pointValue × contracts). */
    const maePoints =
      row.maePoints != null
        ? row.maePoints
        : row.maeDollars != null
          ? Math.abs(row.maeDollars) / (inst.pointValue * row.contracts)
          : 0;
    const mfePoints =
      row.mfePoints != null
        ? row.mfePoints
        : row.mfeDollars != null
          ? Math.abs(row.mfeDollars) / (inst.pointValue * row.contracts)
          : 0;

    const [event] = await db
      .insert(schema.tradeEvents)
      .values({
        instrument: row.instrument,
        direction: row.direction,
        entryTime: row.entryTime,
        exitTime: row.exitTime,
        entryAvg: row.entryAvg,
        exitAvg: row.exitAvg,
        maePoints,
        mfePoints,
        initialStopPoints: row.initialStopPoints,
      })
      .returning();

    await db.insert(schema.tradeExecutions).values({
      tradeEventId: event.id,
      accountId: row.accountId,
      contracts: row.contracts,
      overridePnlDollars: row.overridePnlDollars ?? null,
    });

    datesAffected.add(row.entryTime.slice(0, 10));
    inserted++;
  }

  /* Re-evaluate mechanical goals for every date touched by the import. */
  for (const d of datesAffected) {
    await evaluateGoalsForDate(d);
  }

  revalidatePath("/trades");
  revalidatePath("/risk");
  revalidatePath("/");
  revalidatePath("/goals");
  revalidatePath("/calendar");
  revalidatePath("/performance");
  return { inserted, errors };
}
