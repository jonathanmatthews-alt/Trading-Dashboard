"use client";

import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from "date-fns";
import type { DayAggregate } from "@/lib/aggregates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import Link from "next/link";

type Props = {
  initialMonth: string; // yyyy-MM
};

/* Client component navigates by query string. */
export function CalendarNav({ month }: { month: Date }) {
  const prev = format(subMonths(month, 1), "yyyy-MM");
  const next = format(addMonths(month, 1), "yyyy-MM");
  const cur = format(month, "MMMM yyyy");
  return (
    <div className="mb-4 flex items-center gap-3">
      <Button asChild variant="outline" size="sm">
        <Link href={`/calendar?m=${prev}`}>← Prev</Link>
      </Button>
      <div className="text-display flex-1 text-center text-sm tracking-[0.3em] text-orange-neon">
        {cur.toUpperCase()}
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={`/calendar?m=${next}`}>Next →</Link>
      </Button>
    </div>
  );
}

export function CalendarGrid({
  month,
  aggregates,
  onSelect,
}: {
  month: Date;
  aggregates: DayAggregate[];
  onSelect: (date: string) => void;
}) {
  const aggByDate = new Map(aggregates.map((a) => [a.date, a] as const));
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="text-display border-r border-border/40 px-2 py-1.5 text-[10px] tracking-widest text-muted-foreground last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const agg = aggByDate.get(key);
            const inMonth = isSameMonth(day, month);
            const today = isToday(day);
            const hasTrades = agg && agg.trades > 0;
            const positive = agg && agg.pnl > 0;
            const negative = agg && agg.pnl < 0;
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                className={cn(
                  "h-24 border-b border-r border-border/40 px-2 py-1.5 text-left transition-colors hover:bg-secondary/30",
                  !inMonth && "opacity-30",
                  today && "ring-1 ring-cyan-neon/40 ring-inset",
                  hasTrades && positive && "bg-gain/5",
                  hasTrades && negative && "bg-loss/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "text-display text-[10px] tracking-widest",
                      today ? "text-neon" : "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  {agg && agg.news.length > 0 && (
                    <NewsDot impact={highestImpact(agg.news)} count={agg.news.length} />
                  )}
                </div>
                {hasTrades && agg && (
                  <>
                    <div
                      className={cn(
                        "text-mono text-sm font-medium leading-tight",
                        positive && "text-gain",
                        negative && "text-loss",
                      )}
                    >
                      {formatCurrency(agg.pnl, { sign: true })}
                    </div>
                    <div className="text-mono text-[10px] text-muted-foreground">
                      {agg.trades} trade{agg.trades === 1 ? "" : "s"}
                    </div>
                    <Sparkline points={agg.sparkline} positive={positive ?? false} />
                  </>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function highestImpact(
  news: { impact: "high" | "medium" | "low" }[],
): "high" | "medium" | "low" {
  if (news.some((n) => n.impact === "high")) return "high";
  if (news.some((n) => n.impact === "medium")) return "medium";
  return "low";
}

function NewsDot({
  impact,
  count,
}: {
  impact: "high" | "medium" | "low";
  count: number;
}) {
  return (
    <span
      title={`${count} news event${count === 1 ? "" : "s"} (max ${impact} impact)`}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-[8px] font-bold",
        impact === "high" && "h-3.5 w-3.5 bg-loss/80 text-background",
        impact === "medium" && "h-3.5 w-3.5 bg-warn/80 text-background",
        impact === "low" && "h-3.5 w-3.5 bg-muted-foreground/40 text-background",
      )}
    >
      {count}
    </span>
  );
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) return null;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const w = 70;
  const h = 14;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="mt-0.5">
      <path
        d={path}
        fill="none"
        stroke={positive ? "hsl(var(--gain))" : "hsl(var(--loss))"}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />
    </svg>
  );
}

export function CalendarView({
  initialMonth,
  aggregates,
}: {
  initialMonth: string;
  aggregates: DayAggregate[];
}) {
  const [year, mo] = initialMonth.split("-").map(Number);
  const month = new Date(year, mo - 1, 1);
  const [selected, setSelected] = useState<string | null>(null);

  const detail = aggregates.find((a) => a.date === selected) ?? null;

  return (
    <>
      <CalendarNav month={month} />
      <CalendarGrid month={month} aggregates={aggregates} onSelect={setSelected} />
      {selected && detail && (
        <DaySideDrawer
          dateIso={selected}
          aggregate={detail}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from "@/components/ui/drawer";

function DaySideDrawer({
  dateIso,
  aggregate,
  onClose,
}: {
  dateIso: string;
  aggregate: DayAggregate;
  onClose: () => void;
}) {
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle asChild>
            <div className="flex items-baseline gap-3">
              <span className="text-display text-2xl text-orange-neon">
                {format(new Date(dateIso), "EEE MMM d yyyy")}
              </span>
              <span
                className={cn(
                  "text-display text-2xl font-bold",
                  aggregate.pnl > 0 && "text-gain",
                  aggregate.pnl < 0 && "text-loss",
                )}
              >
                {formatCurrency(aggregate.pnl, { sign: true })}
              </span>
            </div>
          </DrawerTitle>
          <div className="text-mono text-xs text-muted-foreground">
            {aggregate.trades} trade{aggregate.trades === 1 ? "" : "s"}
          </div>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          {/* Intraday equity */}
          <div>
            <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-2">
              intraday equity
            </div>
            <BigSparkline points={aggregate.sparkline} positive={aggregate.pnl >= 0} />
          </div>

          {/* Per-account breakdown */}
          {aggregate.byAccount.length > 0 && (
            <div>
              <div className="text-display mb-2 text-[10px] tracking-widest text-muted-foreground">
                per account · net
              </div>
              <table className="w-full text-mono text-xs">
                <thead>
                  <tr className="text-display border-b border-border/40 text-[10px] tracking-widest text-muted-foreground">
                    <th className="py-1 text-left">account</th>
                    <th className="py-1 text-right">trades</th>
                    <th className="py-1 text-right">net pnl</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregate.byAccount.map((a) => (
                    <tr key={a.accountId} className="border-b border-border/20">
                      <td className="py-1.5 text-foreground">{a.nickname}</td>
                      <td className="py-1.5 text-right text-muted-foreground">
                        {a.trades}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right tabular-nums",
                          a.pnl > 0 && "text-gain",
                          a.pnl < 0 && "text-loss",
                        )}
                      >
                        {formatCurrency(a.pnl, { sign: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* News events */}
          {aggregate.news.length > 0 && (
            <div>
              <div className="text-display mb-2 text-[10px] tracking-widest text-muted-foreground">
                news · {aggregate.news.length} event
                {aggregate.news.length === 1 ? "" : "s"}
              </div>
              <ul className="space-y-1">
                {aggregate.news.map((n, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[60px_60px_1fr] items-center gap-3 border-b border-border/20 py-1"
                  >
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 text-center text-[10px] uppercase tracking-wider",
                        n.impact === "high" &&
                          "border-loss/50 bg-loss/10 text-loss",
                        n.impact === "medium" &&
                          "border-warn/50 bg-warn/10 text-warn",
                        n.impact === "low" &&
                          "border-border bg-secondary/30 text-muted-foreground",
                      )}
                    >
                      {n.impact}
                    </span>
                    <span className="text-mono text-xs text-muted-foreground">
                      {n.time ?? ""}
                    </span>
                    <span className="text-sm text-foreground">{n.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links */}
          <div className="space-y-1 border-t border-border/40 pt-3">
            <Link
              href={`/trades?date=${dateIso}`}
              className="text-display block text-[11px] tracking-widest text-neon hover:underline"
            >
              see all {aggregate.trades} trades →
            </Link>
            <Link
              href={`/daily-log?date=${dateIso}`}
              className="text-display block text-[11px] tracking-widest text-neon hover:underline"
            >
              open daily log entry →
            </Link>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function BigSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) {
    return <div className="text-sm text-muted-foreground">no trades</div>;
  }
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const w = 480;
  const h = 100;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const zeroY = h - ((0 - min) / range) * h;
  return (
    <svg width={w} height={h} className="rounded-sm border border-border bg-background/30">
      <line
        x1={0}
        x2={w}
        y1={zeroY}
        y2={zeroY}
        stroke="hsl(var(--border))"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <path
        d={path}
        fill="none"
        stroke={positive ? "hsl(var(--gain))" : "hsl(var(--loss))"}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
