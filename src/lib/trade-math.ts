import type {
  Instrument,
  TradeEvent,
  TradeExecution,
} from "@/db/schema";

/**
 * Computed metrics for a single TradeEvent. All trades collapse to one
 * round-trip per the data model.
 */
export type TradeMetrics = {
  /* In points */
  pnlPoints: number;
  /* In $ aggregated across all executions */
  pnlDollars: number;
  /* In $: MAE/MFE × point value × total contracts */
  maeDollars: number;
  mfeDollars: number;
  /* R-multiples: (movement in points) ÷ initial_stop in points */
  pnlR: number;
  maeR: number;
  mfeR: number;
  /* Signed PnL ÷ MFE in $. NaN-safe: 0 when MFE = 0. */
  pnlDD: number;
  /* Total contracts across all executions for this event. */
  totalContracts: number;
  /* Account count fanned across. */
  accountCount: number;
  /* Outcome */
  outcome: "win" | "loss" | "be";
};

export function computeTradeMetrics(
  event: TradeEvent,
  executions: TradeExecution[],
  instrument: Instrument,
): TradeMetrics {
  const pointDelta =
    event.direction === "long"
      ? event.exitAvg - event.entryAvg
      : event.entryAvg - event.exitAvg;

  let totalContracts = 0;
  let pnlDollars = 0;
  let maeDollars = 0;
  let mfeDollars = 0;
  for (const ex of executions) {
    totalContracts += ex.contracts;
    const exContribution =
      ex.overridePnlDollars != null
        ? ex.overridePnlDollars
        : pointDelta * instrument.pointValue * ex.contracts;
    pnlDollars += exContribution;

    const exMaePts =
      ex.overrideMaePoints != null ? ex.overrideMaePoints : event.maePoints;
    const exMfePts =
      ex.overrideMfePoints != null ? ex.overrideMfePoints : event.mfePoints;
    maeDollars += exMaePts * instrument.pointValue * ex.contracts;
    mfeDollars += exMfePts * instrument.pointValue * ex.contracts;
  }

  const stopPts = event.initialStopPoints || 0;
  const pnlR = stopPts > 0 ? pointDelta / stopPts : 0;
  const maeR = stopPts > 0 ? -event.maePoints / stopPts : 0;
  const mfeR = stopPts > 0 ? event.mfePoints / stopPts : 0;

  const pnlDD = mfeDollars !== 0 ? pnlDollars / mfeDollars : 0;

  const outcome: "win" | "loss" | "be" =
    pnlDollars > 0 ? "win" : pnlDollars < 0 ? "loss" : "be";

  return {
    pnlPoints: pointDelta,
    pnlDollars,
    maeDollars,
    mfeDollars,
    pnlR,
    maeR,
    mfeR,
    pnlDD,
    totalContracts,
    accountCount: executions.length,
    outcome,
  };
}

/** Per-account contribution from a single TradeEvent. */
export function computeExecutionPnl(
  event: TradeEvent,
  execution: TradeExecution,
  instrument: Instrument,
): number {
  if (execution.overridePnlDollars != null) return execution.overridePnlDollars;
  const pointDelta =
    event.direction === "long"
      ? event.exitAvg - event.entryAvg
      : event.entryAvg - event.exitAvg;
  return pointDelta * instrument.pointValue * execution.contracts;
}
