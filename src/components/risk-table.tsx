"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { AccountState } from "@/lib/rule-engine";
import type { Firm, Program } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type Row = {
  state: AccountState;
  firmName: string;
  programName: string;
};

type Props = {
  states: AccountState[];
  firms: Firm[];
  programs: Program[];
};

const ALL_EXTRA_COLUMNS = [
  { id: "stage", label: "Stage" },
  { id: "dd", label: "DD" },
  { id: "days", label: "Days" },
  { id: "consistency", label: "Consistency" },
] as const;
type ExtraColId = (typeof ALL_EXTRA_COLUMNS)[number]["id"];

export function RiskTable({ states, firms, programs }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "danger", desc: false },
  ]);
  const [extraCols, setExtraCols] = useState<Set<ExtraColId>>(new Set(["stage"]));

  const firmById = useMemo(
    () => new Map(firms.map((f) => [f.id, f] as const)),
    [firms],
  );
  const programById = useMemo(
    () => new Map(programs.map((p) => [p.id, p] as const)),
    [programs],
  );

  const rows: Row[] = useMemo(
    () =>
      states.map((s) => ({
        state: s,
        firmName:
          s.account.accountType === "pa"
            ? "Personal Accounts"
            : firmById.get(s.account.firmId ?? -1)?.name ?? "(unknown)",
        programName: programById.get(s.account.programId ?? -1)?.name ?? "—",
      })),
    [states, firmById, programById],
  );

  /* Sort: by danger ascending — smallest distanceToBust first */
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      /* Group by firm name then sort by danger */
      if (a.firmName !== b.firmName) return a.firmName.localeCompare(b.firmName);
      const aDist =
        a.state.distanceToBust == null ? Infinity : a.state.distanceToBust;
      const bDist =
        b.state.distanceToBust == null ? Infinity : b.state.distanceToBust;
      return aDist - bDist;
    });
  }, [rows]);

  /* Group rows by firm */
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of sortedRows) {
      const list = map.get(r.firmName) ?? [];
      list.push(r);
      map.set(r.firmName, list);
    }
    return Array.from(map.entries());
  }, [sortedRows]);

  function toggle(c: ExtraColId) {
    const next = new Set(extraCols);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setExtraCols(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-display text-[10px] tracking-widest text-muted-foreground mr-2">
          extra columns:
        </span>
        {ALL_EXTRA_COLUMNS.map((c) => (
          <Button
            key={c.id}
            type="button"
            variant={extraCols.has(c.id) ? "neon" : "outline"}
            size="sm"
            onClick={() => toggle(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-display border-b border-border bg-secondary/20 text-[10px] tracking-[0.2em] text-muted-foreground">
              <th className="text-left px-3 py-2 font-normal">account</th>
              <th className="text-right px-3 py-2 font-normal">balance</th>
              <th className="text-right px-3 py-2 font-normal">pnl today</th>
              <th className="text-left px-3 py-2 font-normal">target / bust</th>
              <th className="text-right px-3 py-2 font-normal">payout</th>
              {extraCols.has("stage") && (
                <th className="text-left px-3 py-2 font-normal">stage</th>
              )}
              {extraCols.has("dd") && (
                <th className="text-right px-3 py-2 font-normal">dd</th>
              )}
              {extraCols.has("days") && (
                <th className="text-right px-3 py-2 font-normal">days</th>
              )}
              {extraCols.has("consistency") && (
                <th className="text-right px-3 py-2 font-normal">consistency</th>
              )}
              <th className="text-left px-3 py-2 font-normal">alerts</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([firmName, firmRows]) => (
              <FirmGroup
                key={firmName}
                firmName={firmName}
                rows={firmRows}
                extraCols={extraCols}
              />
            ))}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                  No active accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FirmGroup({
  firmName,
  rows,
  extraCols,
}: {
  firmName: string;
  rows: Row[];
  extraCols: Set<ExtraColId>;
}) {
  return (
    <>
      <tr className="bg-secondary/40">
        <td
          colSpan={10}
          className="text-display px-3 py-1.5 text-[10px] tracking-[0.3em] text-orange-neon"
        >
          {firmName} · {rows.length} {rows.length === 1 ? "account" : "accounts"}
        </td>
      </tr>
      {rows.map(({ state, programName }) => (
        <RiskRow
          key={state.account.id}
          state={state}
          programName={programName}
          extraCols={extraCols}
        />
      ))}
    </>
  );
}

function RiskRow({
  state,
  programName,
  extraCols,
}: {
  state: AccountState;
  programName: string;
  extraCols: Set<ExtraColId>;
}) {
  const danger = state.alerts.some((a) => a.severity === "danger");
  const warn = state.alerts.some((a) => a.severity === "warn");

  const targetProgress =
    state.targetLevel != null
      ? Math.max(
          0,
          Math.min(
            1,
            state.realizedPnl /
              (state.targetLevel - state.startingBalance || 1),
          ),
        )
      : 0;
  const bustProgress =
    state.bustLevel != null
      ? Math.max(
          0,
          Math.min(
            1,
            (state.currentBalance - state.bustLevel) /
              (state.startingBalance - state.bustLevel || 1),
          ),
        )
      : 1;

  return (
    <tr
      className={cn(
        "border-t border-border/40 hover:bg-secondary/20",
        danger && "bg-loss/5 ring-1 ring-loss/40 ring-inset",
        warn && !danger && "bg-warn/5",
      )}
    >
      <td className="px-3 py-2">
        <div className="text-mono font-medium text-foreground">
          {state.account.nickname}
        </div>
        <div className="text-mono text-[11px] text-muted-foreground">
          {programName}
        </div>
      </td>
      <td className="px-3 py-2 text-right text-mono">
        {formatCurrency(state.currentBalance)}
      </td>
      <td
        className={cn(
          "px-3 py-2 text-right text-mono",
          state.pnlToday > 0 && "text-gain",
          state.pnlToday < 0 && "text-loss",
        )}
      >
        {state.pnlToday !== 0 ? formatCurrency(state.pnlToday, { sign: true }) : "—"}
      </td>
      <td className="px-3 py-2">
        <div className="space-y-1">
          {state.targetLevel != null && (
            <Bar label={`target ${formatCurrency(state.distanceToTarget ?? 0)}`} pct={targetProgress} tone="cyan" />
          )}
          {state.bustLevel != null && (
            <Bar label={`bust ${formatCurrency(state.distanceToBust ?? 0)}`} pct={bustProgress} tone="orange" />
          )}
          {state.bustLevel == null && state.targetLevel == null && (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right text-mono text-muted-foreground">
        {state.rule?.payoutCadenceDays
          ? `${state.rule.payoutCadenceDays}d cycle`
          : "—"}
      </td>
      {extraCols.has("stage") && (
        <td className="px-3 py-2">
          {state.account.currentStage ? (
            <Badge variant="orange">
              {state.rule?.stageDisplayLabel ?? state.account.currentStage}
            </Badge>
          ) : (
            <Badge variant="muted">PA</Badge>
          )}
        </td>
      )}
      {extraCols.has("dd") && (
        <td className="px-3 py-2 text-right text-mono text-[11px] text-muted-foreground">
          {state.rule?.drawdownType
            ? `${state.rule.drawdownType.replace("_", " ")} · ${formatCurrency(state.rule.drawdownAmount ?? 0)}`
            : "—"}
        </td>
      )}
      {extraCols.has("days") && (
        <td className="px-3 py-2 text-right text-mono text-[11px]">
          {state.daysTraded}
          {state.rule?.minTradingDays != null
            ? ` / ${state.rule.minTradingDays}`
            : ""}
        </td>
      )}
      {extraCols.has("consistency") && (
        <td className="px-3 py-2 text-right text-mono text-[11px]">
          {state.bestDayConsistencyPct != null
            ? formatPercent(state.bestDayConsistencyPct)
            : "—"}
          {state.rule?.consistencyPct != null
            ? ` (${formatPercent(state.rule.consistencyPct)} max)`
            : ""}
        </td>
      )}
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {state.alerts.length === 0 && (
            <span className="text-[11px] text-muted-foreground/70">—</span>
          )}
          {state.alerts.map((a, i) => (
            <Badge key={i} variant={a.severity === "danger" ? "loss" : "warn"}>
              {a.message}
            </Badge>
          ))}
        </div>
      </td>
    </tr>
  );
}

function Bar({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "cyan" | "orange";
}) {
  return (
    <div>
      <div className="text-display text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 h-1 w-32 overflow-hidden rounded-sm bg-secondary/40">
        <div
          className={cn(
            "h-full",
            tone === "cyan" && "bg-cyan-neon/70",
            tone === "orange" && "bg-orange-neon/70",
          )}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}
