import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EquityChart, EdgeBars, HistogramChart } from "@/components/perf-charts";
import { getPerformance } from "@/lib/performance";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PRESETS = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
];

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const sp = await searchParams;
  const preset = sp.r ?? "30d";
  const data = await getPerformance(preset);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="History"
        title="PERFORMANCE"
        subtitle="EQUITY · ATTRIBUTION · DISTRIBUTIONS"
        right={
          <div className="flex items-center gap-1">
            {PRESETS.map((p) => (
              <Link
                key={p.id}
                href={`/performance?r=${p.id}`}
                className={cn(
                  "text-display rounded border px-2.5 py-1 text-[11px]",
                  preset === p.id
                    ? "border-cyan-neon/60 bg-cyan-neon/15 text-neon"
                    : "border-border bg-background/30 text-muted-foreground hover:bg-secondary/40",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Equity curve · PA vs Prop · drawdown</CardTitle>
        </CardHeader>
        <CardContent>
          <EquityChart data={data.equity} />
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>$ PnL by Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <EdgeBars data={data.bySetup} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>$ PnL by Instrument</CardTitle>
          </CardHeader>
          <CardContent>
            <EdgeBars data={data.byInstrument} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>$ PnL by Day-of-Week</CardTitle>
          </CardHeader>
          <CardContent>
            <EdgeBars data={data.byDayOfWeek} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>$ PnL by Hour-of-Day</CardTitle>
          </CardHeader>
          <CardContent>
            <EdgeBars data={data.byHourOfDay} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>$ Cost by Mistake (negative is bad)</CardTitle>
          </CardHeader>
          <CardContent>
            <EdgeBars data={data.byMistake} invertColors />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>$ Cost by Tendency</CardTitle>
          </CardHeader>
          <CardContent>
            <EdgeBars data={data.byTendency} invertColors />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>MAE distribution (R)</CardTitle>
          </CardHeader>
          <CardContent>
            <HistogramChart data={data.maeR} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MFE distribution (R)</CardTitle>
          </CardHeader>
          <CardContent>
            <HistogramChart data={data.mfeR} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>PnLDD distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <HistogramChart data={data.pnlDD} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
