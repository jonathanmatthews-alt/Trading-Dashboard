"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  evaluateGoalsForDate,
  setReflectiveCheck,
} from "@/lib/goal-evaluator";

const RecheckSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function recheckGoalsForDate(input: unknown) {
  const data = RecheckSchema.parse(input);
  const result = await evaluateGoalsForDate(data.date);
  revalidatePath("/");
  revalidatePath("/goals");
  return result;
}

const ReflectiveSchema = z.object({
  goalId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passed: z.coerce.boolean(),
});

export async function toggleReflectiveGoal(input: unknown) {
  const data = ReflectiveSchema.parse(input);
  await setReflectiveCheck(data.goalId, data.date, data.passed);
  revalidatePath("/");
  revalidatePath("/goals");
  return { ok: true };
}
