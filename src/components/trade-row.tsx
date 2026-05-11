"use client";

import { format, parseISO } from "date-fns";
import { useState } from "react";
import type { TradeRow } from "@/lib/queries";
import type { TradeMetrics } from "@/lib/trade-math";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import { TradeDrawer } from "./trade-drawer";
import type { Setup, Mistake, Tendency } from "@/db/schema";

type Props = {
  row: TradeRow;
  metrics: TradeMetrics;
  setups: Setup[];
  mistakes: Mistake[];
  tendencies: Tendency[];
};

export function TradeRowItem({ row, metrics, setups, mistakes, tendencies }: Props) {
  const [open, setOpen] = useState(false);
  const { event } = row;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "grid w-full grid-cols-[100px_70px_70px_90px_90px_70px_90px_70px_70px_70px_1fr_70px] items-center gap-3 border-b border-border/40 px-4 py-2 text-left text-sm hover:bg-secondary/30",
          metrics.outcome === "win" && "hover:bg-gain/5",
          metrics.outcome === "loss" && "hover:bg-loss/5",
        )}
      >
        <span className="text-mono text-muted-foreground">
          {format(parseISO(event.entryTime), "MMM d HH:mm")}
        </span>
        <span className="text-mono font-medium text-foreground">
          {event.instrument}
        </span>
        <Badge variant={event.direction === "long" ? "win" : "loss"}>
          {event.direction}
        </Badge>
        <span className="text-mono text-muted-foreground">
          {event.entryAvg.toFixed(2)}
        </span>
        <span className="text-mono text-muted-foreground">
          {event.exitAvg.toFixed(2)}
        </span>
        <span className="text-mono text-muted-foreground">
          {metrics.totalContracts}c · {metrics.accountCount}a
        </span>
        <span
          className={cn(
            "text-mono font-medium",
            metrics.netPnlDollars > 0 && "text-gain",
            metrics.netPnlDollars < 0 && "text-loss",
          )}
          title={
            metrics.feesDollars > 0
              ? `gross ${formatCurrency(metrics.pnlDollars, { sign: true })} · fees -${formatCurrency(metrics.feesDollars)}`
              : undefined
          }
        >
          {formatCurrency(metrics.netPnlDollars, { sign: true })}
        </span>
        <span
          className={cn(
            "text-mono",
            metrics.netPnlR > 0 && "text-gain",
            metrics.netPnlR < 0 && "text-loss",
          )}
        >
          {formatR(metrics.netPnlR)}
        </span>
        <span className="text-mono text-muted-foreground">
          -{event.maePoints.toFixed(2)}
        </span>
        <span className="text-mono text-muted-foreground">
          +{event.mfePoints.toFixed(2)}
        </span>
        <div className="flex items-center gap-1.5 truncate">
          {row.setup ? (
            <Badge variant="neon">{row.setup.name}</Badge>
          ) : (
            <span className="text-display text-[10px] tracking-wider text-warn">
              ◌ unenriched
            </span>
          )}
          {row.mistakes.length > 0 && (
            <span className="text-mono text-[11px] text-loss">
              {row.mistakes.length} ✕
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-mono text-right",
            metrics.pnlDD > 0 && "text-gain",
            metrics.pnlDD < 0 && "text-loss",
          )}
        >
          {(metrics.pnlDD * 100).toFixed(0)}%
        </span>
      </button>

      <TradeDrawer
        open={open}
        onOpenChange={setOpen}
        row={row}
        metrics={metrics}
        setups={setups}
        mistakes={mistakes}
        tendencies={tendencies}
      />
    </>
  );
}

export function TradeListHeader() {
  return (
    <div className="text-display grid grid-cols-[100px_70px_70px_90px_90px_70px_90px_70px_70px_70px_1fr_70px] items-center gap-3 border-b border-border bg-secondary/20 px-4 py-2 text-[10px] tracking-[0.2em] text-muted-foreground">
      <span>date · time</span>
      <span>sym</span>
      <span>side</span>
      <span>entry</span>
      <span>exit</span>
      <span>size</span>
      <span>$ pnl</span>
      <span>R</span>
      <span>mae</span>
      <span>mfe</span>
      <span>setup · tags</span>
      <span className="text-right">pnldd</span>
    </div>
  );
}
