"use client";

import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatPercent, formatR } from "@/lib/utils";
import type { SetupStats } from "@/lib/setup-stats";

const NEON_CYAN = "hsl(187 96% 53%)";
const GAIN = "hsl(142 76% 56%)";
const LOSS = "hsl(0 84% 60%)";

export function SetupStatsPanel({ stats }: { stats: SetupStats }) {
  if (stats.trades === 0) {
    return (
      <div className="rounded-sm border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
        No trades tagged with this setup yet. Stats and the linked-trades list
        will populate as you tag trades.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Numeric summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Trades" value={String(stats.trades)} />
        <Stat
          label="Win rate"
          value={formatPercent(stats.winRate)}
          tone={stats.winRate >= 0.5 ? "gain" : "loss"}
        />
        <Stat
          label="Expectancy"
          value={formatR(stats.expectancyR)}
          tone={stats.expectancyR > 0 ? "gain" : "loss"}
        />
        <Stat
          label="Total PnL"
          value={formatCurrency(stats.pnlDollars, { sign: true })}
          tone={stats.pnlDollars > 0 ? "gain" : "loss"}
        />
        <Stat
          label="W / L / BE"
          value={`${stats.wins} / ${stats.losses} / ${stats.breakevens}`}
        />
        <Stat label="Avg win" value={formatR(stats.avgWinR)} tone="gain" />
        <Stat label="Avg loss" value={formatR(stats.avgLossR)} tone="loss" />
        <Stat
          label="Payoff ratio"
          value={
            stats.avgLossR < 0
              ? (stats.avgWinR / Math.abs(stats.avgLossR)).toFixed(2)
              : "—"
          }
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Equity curve">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.equity} margin={{ left: 0, right: 0, top: 4 }}>
              <defs>
                <linearGradient id="setupEq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NEON_CYAN} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={NEON_CYAN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(222 32% 18%)" />
              <XAxis dataKey="date" stroke="hsl(215 20% 65%)" fontSize={10} />
              <YAxis stroke="hsl(215 20% 65%)" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 6%)",
                  border: "1px solid hsl(222 32% 18%)",
                }}
              />
              <Area
                type="monotone"
                dataKey="cum"
                stroke={NEON_CYAN}
                strokeWidth={2}
                fill="url(#setupEq)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly PnL">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.monthlyPnl}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(222 32% 18%)" />
              <XAxis dataKey="month" stroke="hsl(215 20% 65%)" fontSize={10} />
              <YAxis stroke="hsl(215 20% 65%)" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 6%)",
                  border: "1px solid hsl(222 32% 18%)",
                }}
              />
              <Bar dataKey="pnl">
                {stats.monthlyPnl.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? GAIN : LOSS} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="MAE distribution (R)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.maeR}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(222 32% 18%)" />
              <XAxis dataKey="bucket" stroke="hsl(215 20% 65%)" fontSize={10} />
              <YAxis stroke="hsl(215 20% 65%)" fontSize={10} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 6%)",
                  border: "1px solid hsl(222 32% 18%)",
                }}
              />
              <Bar dataKey="count" fill={LOSS} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="MFE distribution (R)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.mfeR}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(222 32% 18%)" />
              <XAxis dataKey="bucket" stroke="hsl(215 20% 65%)" fontSize={10} />
              <YAxis stroke="hsl(215 20% 65%)" fontSize={10} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 6%)",
                  border: "1px solid hsl(222 32% 18%)",
                }}
              />
              <Bar dataKey="count" fill={GAIN} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Linked recent trades */}
      <div>
        <h4 className="text-display border-b border-border/40 pb-1 mb-3 text-[10px] tracking-[0.3em] text-muted-foreground">
          Linked trades · last {stats.recent.length}
        </h4>
        <ul className="divide-y divide-border/40 rounded-sm border border-border/60 bg-background/20">
          {stats.recent.map((t) => (
            <li
              key={t.eventId}
              className="grid grid-cols-[100px_60px_60px_1fr_70px] items-center gap-3 px-3 py-1.5"
            >
              <span className="text-mono text-xs text-muted-foreground">
                {format(parseISO(t.entryTime), "MMM d HH:mm")}
              </span>
              <span className="text-mono text-xs font-medium">
                {t.instrument}
              </span>
              <Badge variant={t.direction === "long" ? "win" : "loss"}>
                {t.direction}
              </Badge>
              <span className="text-mono text-xs text-right">
                <span
                  className={cn(
                    t.pnlDollars > 0 && "text-gain",
                    t.pnlDollars < 0 && "text-loss",
                  )}
                >
                  {formatCurrency(t.pnlDollars, { sign: true })}
                </span>
              </span>
              <span
                className={cn(
                  "text-mono text-xs text-right",
                  t.pnlR > 0 && "text-gain",
                  t.pnlR < 0 && "text-loss",
                )}
              >
                {formatR(t.pnlR)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/30 p-3">
      <div className="text-display mb-2 text-[10px] tracking-widest text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/30 px-3 py-2">
      <div className="text-display text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-mono text-base font-medium",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </div>
    </div>
  );
}
