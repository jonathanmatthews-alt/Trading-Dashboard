import "server-only";
import { db, schema } from "@/db/client";
import type { Account, FeeSchedule } from "@/db/schema";

/**
 * In-memory fee schedule index.
 *
 * Lookup precedence per execution:
 *   1. Account-specific row     (PA: keyed by accountId × instrument)
 *   2. Firm + stage override    (prop: firmId × instrument × currentStage)
 *   3. Firm default             (prop: firmId × instrument × null stage)
 *   4. Zero
 *
 * PA accounts only check (1) and stop. Prop accounts check (2) → (3).
 * This means a PA account always uses its own broker schedule; an Apex
 * prop account always uses Apex fees (even if the user creates a stage
 * override, only same-stage accounts hit it).
 */
export class FeeMap {
  private byFirm = new Map<string, number>();
  private byAccount = new Map<string, number>();

  constructor(rows: FeeSchedule[]) {
    for (const row of rows) {
      if (row.accountId != null) {
        this.byAccount.set(`${row.accountId}:${row.instrument}`, row.feePerRtPerContract);
      } else if (row.firmId != null) {
        this.byFirm.set(
          `${row.firmId}:${row.instrument}:${row.stageType ?? ""}`,
          row.feePerRtPerContract,
        );
      }
    }
  }

  forExecution(account: Account, instrumentSymbol: string): number {
    /* PA: account-specific only. */
    if (account.firmId == null) {
      const pa = this.byAccount.get(`${account.id}:${instrumentSymbol}`);
      return pa ?? 0;
    }
    /* Prop: stage override > firm default > 0. */
    if (account.currentStage) {
      const specific = this.byFirm.get(
        `${account.firmId}:${instrumentSymbol}:${account.currentStage}`,
      );
      if (specific != null) return specific;
    }
    const firmDefault = this.byFirm.get(`${account.firmId}:${instrumentSymbol}:`);
    return firmDefault ?? 0;
  }
}

export async function loadFeeMap(): Promise<FeeMap> {
  const rows = await db.select().from(schema.feeSchedules);
  return new FeeMap(rows);
}
