import type {
  Account,
  Instrument,
  TradeEvent,
  TradeExecution,
} from "@/db/schema";
import type { FeeMap } from "@/lib/fees";

/**
 * Computed metrics for a single TradeEvent. All trades collapse to one
 * round-trip per the data model.
 *
 * Gross = (exit-entry) × pointValue × contracts, summed across executions.
 * Fees  = firm fee × contracts, summed across executions (PA = 0).
 * Net   = Gross − Fees.
 */
export type TradeMetrics = {
  /* In points */
  pnlPoints: number;
  /* Gross PnL in $ aggregated across executions */
  pnlDollars: number;
  /* Total fees in $ across all executions */
  feesDollars: number;
  /* Net PnL = pnlDollars - feesDollars */
  netPnlDollars: number;
  /* In $: MAE/MFE × point value × total contracts */
  maeDollars: number;
  mfeDollars: number;
  /* R-multiples on gross */
  pnlR: number;
  /* R-multiples on net (after fees) */
  netPnlR: number;
  maeR: number;
  mfeR: number;
  /* Signed PnL ÷ MFE in $. NaN-safe: 0 when MFE = 0. */
  pnlDD: number;
  totalContracts: number;
  accountCount: number;
  /* Outcome is based on NET PnL — a winner that fees eat is a loss. */
  outcome: "win" | "loss" | "be";
  /* Per-execution breakdown, keyed by execution id, for the drawer detail. */
  byExecution: Record<number, { gross: number; fee: number; net: number }>;
};

export type ExecutionWithAccount = TradeExecution & { account: Account };

export function computeTradeMetrics(
  event: TradeEvent,
  executions: ExecutionWithAccount[],
  instrument: Instrument,
  feeMap: FeeMap,
): TradeMetrics {
  const pointDelta =
    event.direction === "long"
      ? event.exitAvg - event.entryAvg
      : event.entryAvg - event.exitAvg;

  let totalContracts = 0;
  let pnlDollars = 0;
  let feesDollars = 0;
  let maeDollars = 0;
  let mfeDollars = 0;
  const byExecution: Record<number, { gross: number; fee: number; net: number }> = {};
  for (const ex of executions) {
    totalContracts += ex.contracts;
    const exContribution =
      ex.overridePnlDollars != null
        ? ex.overridePnlDollars
        : pointDelta * instrument.pointValue * ex.contracts;
    pnlDollars += exContribution;

    const fee = feeMap.forExecution(ex.account, event.instrument) * ex.contracts;
    feesDollars += fee;
    byExecution[ex.id] = {
      gross: exContribution,
      fee,
      net: exContribution - fee,
    };

    const exMaePts =
      ex.overrideMaePoints != null ? ex.overrideMaePoints : event.maePoints;
    const exMfePts =
      ex.overrideMfePoints != null ? ex.overrideMfePoints : event.mfePoints;
    maeDollars += exMaePts * instrument.pointValue * ex.contracts;
    mfeDollars += exMfePts * instrument.pointValue * ex.contracts;
  }

  const netPnlDollars = pnlDollars - feesDollars;
  const stopPts = event.initialStopPoints || 0;
  const pnlR = stopPts > 0 ? pointDelta / stopPts : 0;
  /* Net R: scale net $ back to R using the per-contract risk amount. */
  const riskPerContract = stopPts * instrument.pointValue;
  const netPnlR =
    totalContracts > 0 && riskPerContract > 0
      ? netPnlDollars / (riskPerContract * totalContracts)
      : 0;
  const maeR = stopPts > 0 ? -event.maePoints / stopPts : 0;
  const mfeR = stopPts > 0 ? event.mfePoints / stopPts : 0;

  const pnlDD = mfeDollars !== 0 ? netPnlDollars / mfeDollars : 0;

  const outcome: "win" | "loss" | "be" =
    netPnlDollars > 0 ? "win" : netPnlDollars < 0 ? "loss" : "be";

  return {
    pnlPoints: pointDelta,
    pnlDollars,
    feesDollars,
    netPnlDollars,
    maeDollars,
    mfeDollars,
    pnlR,
    netPnlR,
    maeR,
    mfeR,
    pnlDD,
    totalContracts,
    accountCount: executions.length,
    outcome,
    byExecution,
  };
}

/** Per-account net PnL contribution from a single TradeEvent. */
export function computeExecutionNetPnl(
  event: TradeEvent,
  execution: ExecutionWithAccount,
  instrument: Instrument,
  feeMap: FeeMap,
): { gross: number; fee: number; net: number } {
  const gross =
    execution.overridePnlDollars != null
      ? execution.overridePnlDollars
      : (event.direction === "long"
          ? event.exitAvg - event.entryAvg
          : event.entryAvg - event.exitAvg) *
        instrument.pointValue *
        execution.contracts;
  const fee =
    feeMap.forExecution(execution.account, event.instrument) *
    execution.contracts;
  return { gross, fee, net: gross - fee };
}
