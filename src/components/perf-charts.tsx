"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint, EdgeBucket, Distribution } from "@/lib/performance";

const NEON_CYAN = "hsl(187 96% 53%)";
const NEON_ORANGE = "hsl(22 96% 56%)";
const GAIN = "hsl(142 76% 56%)";
const LOSS = "hsl(0 84% 60%)";

export function EquityChart({ data }: { data: EquityPoint[] }) {
  if (data.length === 0)
    return <Empty>No trades in selected range.</Empty>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gPa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEON_CYAN} stopOpacity={0.4} />
            <stop offset="100%" stopColor={NEON_CYAN} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gProp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEON_ORANGE} stopOpacity={0.4} />
            <stop offset="100%" stopColor={NEON_ORANGE} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gDd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LOSS} stopOpacity={0} />
            <stop offset="100%" stopColor={LOSS} stopOpacity={0.4} />
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
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="propCum"
          name="Prop"
          stroke={NEON_ORANGE}
          fill="url(#gProp)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="paCum"
          name="PA"
          stroke={NEON_CYAN}
          fill="url(#gPa)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          name="Drawdown"
          stroke={LOSS}
          fill="url(#gDd)"
          strokeWidth={1}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EdgeBars({
  data,
  invertColors,
}: {
  data: EdgeBucket[];
  invertColors?: boolean;
}) {
  if (data.length === 0) return <Empty>No data.</Empty>;
  const top = data.slice(0, 12);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, top.length * 28)}>
      <BarChart data={top} layout="vertical" margin={{ left: 0, right: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(222 32% 18%)" />
        <XAxis type="number" stroke="hsl(215 20% 65%)" fontSize={10} />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          stroke="hsl(215 20% 65%)"
          fontSize={10}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(222 47% 6%)",
            border: "1px solid hsl(222 32% 18%)",
          }}
          formatter={(v: number, name) =>
            name === "pnl"
              ? [`$${v.toFixed(0)}`, "PnL"]
              : [v, name]
          }
        />
        <Bar dataKey="pnl">
          {top.map((d, i) => (
            <Cell
              key={i}
              fill={
                (invertColors ? d.pnl > 0 : d.pnl < 0) ? LOSS : GAIN
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HistogramChart({ data }: { data: Distribution[] }) {
  if (data.every((d) => d.count === 0))
    return <Empty>No data in range.</Empty>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(222 32% 18%)" />
        <XAxis dataKey="bucket" stroke="hsl(215 20% 65%)" fontSize={10} />
        <YAxis stroke="hsl(215 20% 65%)" fontSize={10} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(222 47% 6%)",
            border: "1px solid hsl(222 32% 18%)",
          }}
        />
        <Bar dataKey="count" fill={NEON_CYAN} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
