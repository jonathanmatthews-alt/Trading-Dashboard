import "server-only";
import { db, schema } from "@/db/client";
import type { Account, FeeSchedule } from "@/db/schema";

/**
 * In-memory representation of all fee schedules, indexed for fast lookup.
 *
 * Lookup precedence (most specific first):
 *   1. firmId + instrument + account.currentStage
 *   2. firmId + instrument + null stageType
 *   3. zero
 *
 * PA accounts (no firmId) always resolve to zero — broker commissions for
 * personal accounts are out of scope for v1.
 */
export class FeeMap {
  private byKey = new Map<string, number>();

  constructor(rows: FeeSchedule[]) {
    for (const row of rows) {
      const k = `${row.firmId}:${row.instrument}:${row.stageType ?? ""}`;
      this.byKey.set(k, row.feePerRtPerContract);
    }
  }

  /**
   * Returns the per-contract round-trip fee for one execution.
   */
  forExecution(account: Account, instrumentSymbol: string): number {
    if (account.firmId == null) return 0;
    if (account.currentStage) {
      const specific = this.byKey.get(
        `${account.firmId}:${instrumentSymbol}:${account.currentStage}`,
      );
      if (specific != null) return specific;
    }
    const fallback = this.byKey.get(
      `${account.firmId}:${instrumentSymbol}:`,
    );
    return fallback ?? 0;
  }
}

export async function loadFeeMap(): Promise<FeeMap> {
  const rows = await db.select().from(schema.feeSchedules);
  return new FeeMap(rows);
}
