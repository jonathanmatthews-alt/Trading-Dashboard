"use server";

import { db, schema } from "@/db/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RowSchema = z.object({
  instrument: z.string().min(1),
  direction: z.enum(["long", "short"]),
  entryTime: z.string().min(1),
  exitTime: z.string().min(1),
  entryAvg: z.coerce.number(),
  exitAvg: z.coerce.number(),
  contracts: z.coerce.number().int().positive(),
  maePoints: z.coerce.number().min(0).optional().default(0),
  mfePoints: z.coerce.number().min(0).optional().default(0),
  initialStopPoints: z.coerce.number().positive().optional().default(1),
  accountId: z.coerce.number().int().positive(),
});

const ImportSchema = z.object({
  rows: z.array(RowSchema).min(1),
});

export async function importTradesCsv(input: unknown) {
  const data = ImportSchema.parse(input);

  let inserted = 0;
  for (const row of data.rows) {
    const [event] = await db
      .insert(schema.tradeEvents)
      .values({
        instrument: row.instrument,
        direction: row.direction,
        entryTime: row.entryTime,
        exitTime: row.exitTime,
        entryAvg: row.entryAvg,
        exitAvg: row.exitAvg,
        maePoints: row.maePoints,
        mfePoints: row.mfePoints,
        initialStopPoints: row.initialStopPoints,
      })
      .returning();
    await db.insert(schema.tradeExecutions).values({
      tradeEventId: event.id,
      accountId: row.accountId,
      contracts: row.contracts,
    });
    inserted++;
  }

  revalidatePath("/trades");
  revalidatePath("/risk");
  revalidatePath("/");
  return { inserted };
}
