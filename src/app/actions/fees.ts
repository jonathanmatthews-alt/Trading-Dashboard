"use server";

import { db, schema } from "@/db/client";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { STAGE_TYPES } from "@/lib/stages";

const FeeSchema = z
  .object({
    id: z.coerce.number().int().positive().nullable().optional(),
    firmId: z.coerce.number().int().positive().nullable().optional(),
    accountId: z.coerce.number().int().positive().nullable().optional(),
    instrument: z.string().min(1),
    stageType: z.enum(STAGE_TYPES).nullable().optional(),
    feePerRtPerContract: z.coerce.number().min(0),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (v) => (v.firmId == null) !== (v.accountId == null),
    "Exactly one of firmId or accountId must be set",
  );

export async function upsertFee(input: unknown) {
  const data = FeeSchema.parse(input);
  const values = {
    firmId: data.firmId ?? null,
    accountId: data.accountId ?? null,
    instrument: data.instrument,
    /* stageType is meaningless for account rows; force null. */
    stageType: data.accountId != null ? null : (data.stageType ?? null),
    feePerRtPerContract: data.feePerRtPerContract,
    notes: data.notes ?? null,
  };
  if (data.id) {
    await db
      .update(schema.feeSchedules)
      .set(values)
      .where(eq(schema.feeSchedules.id, data.id));
  } else {
    /* Upsert by natural key. */
    let existing;
    if (data.accountId != null) {
      existing = await db
        .select()
        .from(schema.feeSchedules)
        .where(
          and(
            eq(schema.feeSchedules.accountId, data.accountId),
            eq(schema.feeSchedules.instrument, data.instrument),
          ),
        )
        .limit(1);
    } else {
      existing = await db
        .select()
        .from(schema.feeSchedules)
        .where(
          and(
            eq(schema.feeSchedules.firmId, data.firmId!),
            eq(schema.feeSchedules.instrument, data.instrument),
            data.stageType == null
              ? sql`${schema.feeSchedules.stageType} is null`
              : eq(schema.feeSchedules.stageType, data.stageType),
          ),
        )
        .limit(1);
    }
    if (existing[0]) {
      await db
        .update(schema.feeSchedules)
        .set(values)
        .where(eq(schema.feeSchedules.id, existing[0].id));
    } else {
      await db.insert(schema.feeSchedules).values(values);
    }
  }
  revalidatePathsForFees();
  return { ok: true };
}

export async function deleteFee(id: number) {
  await db.delete(schema.feeSchedules).where(eq(schema.feeSchedules.id, id));
  revalidatePathsForFees();
  return { ok: true };
}

function revalidatePathsForFees() {
  revalidatePath("/fees");
  revalidatePath("/risk");
  revalidatePath("/trades");
  revalidatePath("/calendar");
  revalidatePath("/performance");
  revalidatePath("/setups");
  revalidatePath("/");
  revalidatePath("/journal");
}
