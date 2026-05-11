import type {
  Account,
  RuleTemplate,
  TradeEvent,
  TradeExecution,
  Instrument,
} from "@/db/schema";
import type { FeeMap } from "@/lib/fees";

export type AccountState = {
  account: Account;
  rule: RuleTemplate | null;
  /* Equity */
  startingBalance: number;
  realizedPnl: number;
  currentBalance: number;
  highWaterMark: number;
  /* Drawdown */
  bustLevel: number | null;
  distanceToBust: number | null;
  /* Profit target */
  targetLevel: number | null;
  distanceToTarget: number | null;
  /* Process */
  daysTraded: number;
  daysToMin: number | null;
  bestDayPnl: number;
  bestDayConsistencyPct: number | null;
  /* Status */
  passes: boolean;
  busted: boolean;
  alerts: Alert[];
  /* Time */
  pnlToday: number;
};

export type Alert = {
  severity: "warn" | "danger";
  message: string;
};

type ExecutionWithEvent = {
  execution: TradeExecution & { account: Account };
  event: TradeEvent;
  instrument: Instrument;
};

/**
 * Compute account state from closed trades only, using NET PnL (gross − fees)
 * because prop firms charge those fees against your account balance and DD.
 */
export function computeAccountState(
  account: Account,
  rule: RuleTemplate | null,
  executions: ExecutionWithEvent[],
  todayIso: string,
  feeMap: FeeMap,
): AccountState {
  const startingBalance = account.startingBalance;

  /* Group by date and compute EOD balance progression on NET. */
  const byDate = new Map<string, number>();
  for (const e of executions) {
    const dateKey = e.event.exitTime.slice(0, 10);
    const pointDelta =
      e.event.direction === "long"
        ? e.event.exitAvg - e.event.entryAvg
        : e.event.entryAvg - e.event.exitAvg;
    const gross =
      e.execution.overridePnlDollars != null
        ? e.execution.overridePnlDollars
        : pointDelta * e.instrument.pointValue * e.execution.contracts;
    const fee =
      feeMap.forExecution(e.execution.account, e.event.instrument) *
      e.execution.contracts;
    const net = gross - fee;
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + net);
  }
  const dates = Array.from(byDate.keys()).sort();

  let running = startingBalance;
  let highWater = startingBalance;
  let bestDayPnl = 0;
  for (const d of dates) {
    const dayPnl = byDate.get(d) ?? 0;
    running += dayPnl;
    if (running > highWater) highWater = running;
    if (dayPnl > bestDayPnl) bestDayPnl = dayPnl;
  }
  const realizedPnl = running - startingBalance;
  const currentBalance = running;
  const pnlToday = byDate.get(todayIso) ?? 0;

  /* Drawdown / bust level */
  let bustLevel: number | null = null;
  if (rule?.drawdownAmount != null && rule.drawdownType) {
    if (rule.drawdownType === "static") {
      bustLevel = startingBalance - rule.drawdownAmount;
    } else {
      const trailing = highWater - rule.drawdownAmount;
      bustLevel =
        rule.drawdownLockAt != null
          ? Math.min(trailing, rule.drawdownLockAt) === rule.drawdownLockAt &&
            highWater >= rule.drawdownLockAt
            ? rule.drawdownLockAt
            : trailing
          : trailing;
    }
  }
  const distanceToBust = bustLevel != null ? currentBalance - bustLevel : null;

  const targetLevel =
    rule?.profitTarget != null ? startingBalance + rule.profitTarget : null;
  const distanceToTarget =
    targetLevel != null ? targetLevel - currentBalance : null;

  const daysTraded = dates.length;
  const daysToMin =
    rule?.minTradingDays != null
      ? Math.max(0, rule.minTradingDays - daysTraded)
      : null;

  const bestDayConsistencyPct =
    realizedPnl > 0 ? bestDayPnl / realizedPnl : null;

  const busted = bustLevel != null && currentBalance <= bustLevel;
  const passesTarget =
    rule?.profitTarget == null || realizedPnl >= rule.profitTarget;
  const passesDays =
    rule?.minTradingDays == null || daysTraded >= rule.minTradingDays;
  const passesConsistency =
    rule?.consistencyPct == null ||
    bestDayConsistencyPct == null ||
    bestDayConsistencyPct <= rule.consistencyPct;
  const passes = !busted && passesTarget && passesDays && passesConsistency;

  const alerts: Alert[] = [];
  if (busted) alerts.push({ severity: "danger", message: "BUSTED" });
  if (distanceToBust != null && !busted) {
    if (distanceToBust < 250)
      alerts.push({
        severity: "danger",
        message: `Within $${distanceToBust.toFixed(0)} of trailing bust`,
      });
    else if (distanceToBust < 500)
      alerts.push({
        severity: "warn",
        message: `Within $${distanceToBust.toFixed(0)} of bust`,
      });
  }
  if (
    rule?.dailyLossLimit != null &&
    pnlToday < 0 &&
    Math.abs(pnlToday) > rule.dailyLossLimit * 0.7
  ) {
    alerts.push({
      severity: pnlToday < -rule.dailyLossLimit ? "danger" : "warn",
      message: `Daily loss approaching limit ($${rule.dailyLossLimit})`,
    });
  }
  if (
    rule?.consistencyPct != null &&
    bestDayConsistencyPct != null &&
    bestDayConsistencyPct > rule.consistencyPct
  ) {
    alerts.push({
      severity: "warn",
      message: `Consistency ${(bestDayConsistencyPct * 100).toFixed(0)}% > limit ${(rule.consistencyPct * 100).toFixed(0)}%`,
    });
  }

  return {
    account,
    rule,
    startingBalance,
    realizedPnl,
    currentBalance,
    highWaterMark: highWater,
    bustLevel,
    distanceToBust,
    targetLevel,
    distanceToTarget,
    daysTraded,
    daysToMin,
    bestDayPnl,
    bestDayConsistencyPct,
    passes,
    busted,
    alerts,
    pnlToday,
  };
}
