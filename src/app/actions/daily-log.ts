"use server";

import { db, schema } from "@/db/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().optional(),
  mood: z.coerce.number().int().min(1).max(10).nullable().optional(),
  sleepHours: z.coerce.number().min(0).max(24).nullable().optional(),
  tilted: z.coerce.boolean().optional(),
});

export async function saveDailyLog(input: unknown) {
  const data = SaveSchema.parse(input);
  await db
    .insert(schema.dailyLogs)
    .values({
      date: data.date,
      body: data.body ?? null,
      mood: data.mood ?? null,
      sleepHours: data.sleepHours ?? null,
      tilted: data.tilted ?? null,
    })
    .onConflictDoUpdate({
      target: schema.dailyLogs.date,
      set: {
        body: data.body ?? null,
        mood: data.mood ?? null,
        sleepHours: data.sleepHours ?? null,
        tilted: data.tilted ?? null,
      },
    });
  revalidatePath("/daily-log");
  revalidatePath("/");
  return { ok: true };
}
