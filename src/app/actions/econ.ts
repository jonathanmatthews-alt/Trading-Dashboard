"use server";

import { db, schema } from "@/db/client";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

const AddSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().optional(),
  title: z.string().min(1),
  impact: z.enum(["high", "medium", "low"]),
});

export async function addNewsEvent(input: unknown) {
  const data = AddSchema.parse(input);
  await db.insert(schema.newsEvents).values({
    date: data.date,
    time: data.time ?? null,
    title: data.title,
    impact: data.impact,
    source: "manual",
  });
  revalidatePath("/econ");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteNewsEvent(id: number) {
  await db.delete(schema.newsEvents).where(eq(schema.newsEvents.id, id));
  revalidatePath("/econ");
  revalidatePath("/calendar");
  return { ok: true };
}
