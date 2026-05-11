"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import { enrichTrade, deleteTrade } from "@/app/actions/trades";
import type { Setup, Mistake, Tendency } from "@/db/schema";
import type { TradeRow } from "@/lib/queries";
import type { TradeMetrics } from "@/lib/trade-math";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: TradeRow;
  metrics: TradeMetrics;
  setups: Setup[];
  mistakes: Mistake[];
  tendencies: Tendency[];
};

export function TradeDrawer({
  open,
  onOpenChange,
  row,
  metrics,
  setups,
  mistakes,
  tendencies,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setupId, setSetupId] = useState<number | null>(row.setup?.id ?? null);
  const [mistakeIds, setMistakeIds] = useState<number[]>(row.mistakes.map((m) => m.id));
  const [tendencyIds, setTendencyIds] = useState<number[]>(
    row.tendencies.map((t) => t.id),
  );
  const [note, setNote] = useState(row.event.note ?? "");

  function toggle(arr: number[], id: number, set: (v: number[]) => void) {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  function save() {
    start(async () => {
      await enrichTrade({
        tradeEventId: row.event.id,
        setupId,
        mistakeIds,
        tendencyIds,
        note,
      });
      router.refresh();
      onOpenChange(false);
    });
  }

  function remove() {
    if (!confirm("Delete this trade?")) return;
    start(async () => {
      await deleteTrade(row.event.id);
      router.refresh();
      onOpenChange(false);
    });
  }

  const setupCategories = Array.from(new Set(setups.map((s) => s.category)));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle asChild>
            <div className="flex items-baseline gap-3">
              <span className="text-display text-2xl text-orange-neon">
                {row.event.instrument}
              </span>
              <Badge variant={row.event.direction === "long" ? "win" : "loss"}>
                {row.event.direction}
              </Badge>
              <span
                className={cn(
                  "text-display text-2xl font-bold",
                  metrics.netPnlDollars > 0 && "text-gain",
                  metrics.netPnlDollars < 0 && "text-loss",
                )}
              >
                {formatCurrency(metrics.netPnlDollars, { sign: true })}
              </span>
              <span
                className={cn(
                  "text-mono text-sm",
                  metrics.netPnlR > 0 && "text-gain",
                  metrics.netPnlR < 0 && "text-loss",
                )}
              >
                {formatR(metrics.netPnlR)}
              </span>
              {metrics.feesDollars > 0 && (
                <span className="text-mono text-xs text-muted-foreground">
                  gross {formatCurrency(metrics.pnlDollars, { sign: true })} −
                  fees {formatCurrency(metrics.feesDollars)}
                </span>
              )}
            </div>
          </DrawerTitle>
          <div className="text-mono text-xs text-muted-foreground">
            {format(parseISO(row.event.entryTime), "EEE MMM d yyyy · HH:mm")} →{" "}
            {format(parseISO(row.event.exitTime), "HH:mm")}
          </div>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Entry" value={row.event.entryAvg.toFixed(2)} />
            <Stat label="Exit" value={row.event.exitAvg.toFixed(2)} />
            <Stat label="Stop (pts)" value={row.event.initialStopPoints.toFixed(2)} />
            <Stat
              label="MAE"
              value={`-${row.event.maePoints.toFixed(2)} pts`}
              valueClass="text-loss"
            />
            <Stat
              label="MFE"
              value={`+${row.event.mfePoints.toFixed(2)} pts`}
              valueClass="text-gain"
            />
            <Stat
              label="PnL DD"
              value={`${(metrics.pnlDD * 100).toFixed(0)}%`}
              valueClass={metrics.pnlDD > 0 ? "text-gain" : "text-loss"}
            />
          </div>

          {/* Per-account fan-out */}
          <Section title="Per-account executions">
            <table className="w-full text-mono text-xs">
              <thead>
                <tr className="text-display text-[10px] text-muted-foreground tracking-widest">
                  <th className="text-left py-1">account</th>
                  <th className="text-right py-1">contracts</th>
                  <th className="text-right py-1">gross</th>
                  <th className="text-right py-1">fees</th>
                  <th className="text-right py-1">net</th>
                </tr>
              </thead>
              <tbody>
                {row.executions.map((ex) => {
                  const breakdown = metrics.byExecution[ex.id] ?? {
                    gross: 0,
                    fee: 0,
                    net: 0,
                  };
                  return (
                    <tr key={ex.id} className="border-t border-border/40">
                      <td className="py-1.5">{ex.account.nickname}</td>
                      <td className="py-1.5 text-right">{ex.contracts}</td>
                      <td
                        className={cn(
                          "py-1.5 text-right",
                          breakdown.gross > 0 && "text-gain",
                          breakdown.gross < 0 && "text-loss",
                        )}
                      >
                        {formatCurrency(breakdown.gross, { sign: true })}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">
                        {breakdown.fee > 0
                          ? `-${formatCurrency(breakdown.fee)}`
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right font-medium",
                          breakdown.net > 0 && "text-gain",
                          breakdown.net < 0 && "text-loss",
                        )}
                      >
                        {formatCurrency(breakdown.net, { sign: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* Setup picker */}
          <Section title="Setup">
            <div className="space-y-2">
              {setupCategories.map((cat) => (
                <div key={cat}>
                  <div className="text-display text-[10px] text-muted-foreground/60 mb-1 tracking-widest">
                    {cat}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {setups
                      .filter((s) => s.category === cat)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSetupId(setupId === s.id ? null : s.id)}
                          className={cn(
                            "rounded-sm border px-2 py-0.5 text-xs transition-colors",
                            setupId === s.id
                              ? "border-cyan-neon/60 bg-cyan-neon/15 text-neon"
                              : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40",
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Mistakes">
            <TagPicker
              all={mistakes}
              selected={mistakeIds}
              toggle={(id) => toggle(mistakeIds, id, setMistakeIds)}
              tone="loss"
            />
          </Section>

          <Section title="Tendencies">
            <TagPicker
              all={tendencies}
              selected={tendencyIds}
              toggle={(id) => toggle(tendencyIds, id, setTendencyIds)}
              tone="warn"
            />
          </Section>

          <Section title="Notes / Journal">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              placeholder="What did you see? What did you do? What would you do differently?"
              className="w-full rounded-sm border border-input bg-background/50 p-2 text-sm text-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-neon"
            />
          </Section>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
              Delete
            </Button>
            <Button onClick={save} disabled={pending} variant="neon">
              {pending ? "Saving…" : "Save & Mark Enriched"}
            </Button>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/40 px-3 py-2">
      <div className="text-display text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-mono text-base font-medium", valueClass)}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function TagPicker<T extends { id: number; name: string }>({
  all,
  selected,
  toggle,
  tone,
}: {
  all: T[];
  selected: number[];
  toggle: (id: number) => void;
  tone: "loss" | "warn";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((m) => (
        <button
          key={m.id}
          onClick={() => toggle(m.id)}
          className={cn(
            "rounded-sm border px-2 py-0.5 text-xs transition-colors",
            selected.includes(m.id)
              ? tone === "loss"
                ? "border-loss/60 bg-loss/15 text-loss"
                : "border-warn/60 bg-warn/15 text-warn"
              : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40",
          )}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}
