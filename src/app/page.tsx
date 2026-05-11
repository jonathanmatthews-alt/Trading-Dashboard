import { format } from "date-fns";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getTodayPnl,
  listAccountStates,
  listTradeRows,
  metricsForRow,
  loadFeeMap,
} from "@/lib/queries";
import { db, schema } from "@/db/client";
import { cn, formatCurrency, formatPercent, formatR } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { ComplianceList } from "@/components/compliance-list";
import { evaluateGoalsForDate } from "@/lib/goal-evaluator";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export default async function TodayPage() {
  const today = todayIso();
  const [pnl, accountStates, recentRows, feeMap] = await Promise.all([
    getTodayPnl(today),
    listAccountStates(today),
    listTradeRows({ fromDate: `${today}T00:00`, limit: 50 }),
    loadFeeMap(),
  ]);

  const dailyLog = await db
    .select()
    .from(schema.dailyLogs)
    .where(eq(schema.dailyLogs.date, today))
    .limit(1);
  const log = dailyLog[0] ?? null;

  /* Evaluate mechanical goals on-render so the page is always fresh, even
     if the user navigated here without logging a trade. Cheap: it runs a few
     SELECTs and DELETE+INSERTs proportional to the goal count. */
  await evaluateGoalsForDate(today);

  const goals = await db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.archived, false));
  const checks = await db
    .select()
    .from(schema.goalDailyChecks)
    .where(eq(schema.goalDailyChecks.date, today));
  const checkByGoal = new Map(checks.map((c) => [c.goalId, c] as const));
  const passedToday = goals.filter((g) => checkByGoal.get(g.id)?.passed).length;
  const totalGoals = goals.length;

  const mostAtRisk = accountStates
    .filter((s) => s.distanceToBust != null && s.account.accountType === "prop")
    .sort((a, b) => (a.distanceToBust ?? Infinity) - (b.distanceToBust ?? Infinity))[0];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Daily"
        title="TODAY"
        subtitle={format(new Date(), "EEE · MMM d yyyy").toUpperCase()}
      />

      {/* Pre-market section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pre-market gameplan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-1">
                rituals
              </div>
              <ul className="space-y-1 text-mono text-sm text-muted-foreground">
                <li>· Reviewed yesterday's trades</li>
                <li>· Marked daily levels</li>
                <li>· Checked news / events</li>
                <li>· Wrote pre-market gameplan</li>
              </ul>
            </div>
            <div>
              <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-1">
                key levels
              </div>
              <div className="text-mono text-sm text-muted-foreground/80">
                Add daily levels per instrument here. (Editable surface coming
                in v1.5.)
              </div>
            </div>
            <div>
              <div className="text-display text-[10px] tracking-widest text-muted-foreground mb-1">
                position-size calc
              </div>
              <div className="text-mono text-sm text-muted-foreground/80">
                Account size ÷ stop distance × tick value → contracts. (UI
                coming in v1.5.)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero row */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Hero
          label="Net PnL Today"
          big={formatCurrency(pnl.totalPnl, { sign: true })}
          bigClass={cn(
            pnl.totalPnl > 0 && "text-gain",
            pnl.totalPnl < 0 && "text-loss",
          )}
          sub={
            <span className="text-mono text-xs text-muted-foreground">
              PA {formatCurrency(pnl.paPnl, { sign: true })} · Prop{" "}
              {formatCurrency(pnl.propPnl, { sign: true })}
              {pnl.totalFees > 0 && (
                <>
                  {" · "}
                  <span className="text-loss/70">
                    fees -{formatCurrency(pnl.totalFees)}
                  </span>
                </>
              )}
            </span>
          }
        />
        <Hero
          label="Trades · WR · avgR"
          big={`${pnl.tradeCount}`}
          bigClass="text-foreground"
          sub={
            <span className="text-mono text-xs text-muted-foreground">
              WR {formatPercent(pnl.winRate)} · {formatR(pnl.avgR)}
            </span>
          }
        />
        <Hero
          label="Most-at-risk Account"
          big={
            mostAtRisk
              ? formatCurrency(mostAtRisk.distanceToBust ?? 0)
              : "—"
          }
          bigClass={cn(
            mostAtRisk && (mostAtRisk.distanceToBust ?? 0) < 500 && "text-loss",
            mostAtRisk && (mostAtRisk.distanceToBust ?? 0) >= 500 && "text-warn",
          )}
          sub={
            <span className="text-mono text-xs text-muted-foreground truncate block">
              {mostAtRisk
                ? `${mostAtRisk.account.nickname} · to bust`
                : "no prop accounts at risk"}
            </span>
          }
        />
        <Hero
          label="Process Compliance"
          big={`${passedToday}/${totalGoals}`}
          bigClass={cn(
            totalGoals > 0 && passedToday === totalGoals && "text-gain",
            totalGoals > 0 && passedToday < totalGoals && "text-warn",
          )}
          sub={
            <span className="text-mono text-xs text-muted-foreground">
              goals followed today
            </span>
          }
        />
      </div>

      {/* 1-line takeaway */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1-line takeaway</CardTitle>
        </CardHeader>
        <CardContent>
          {log?.body ? (
            <p className="text-mono text-sm text-foreground/90">
              {log.body.split("\n")[0] || "—"}
            </p>
          ) : (
            <Link href="/daily-log" className="text-mono text-sm text-muted-foreground hover:text-neon">
              Write today's takeaway →
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Today's trades */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today's trades</CardTitle>
          <Link
            href="/trades"
            className="text-display text-[10px] text-muted-foreground hover:text-neon"
          >
            see all →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No trades logged today yet.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {recentRows.map((r) => {
                const m = metricsForRow(r, feeMap);
                return (
                  <li key={r.event.id} className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-mono text-sm font-medium">
                        {r.event.instrument}
                      </span>
                      <Badge variant={r.event.direction === "long" ? "win" : "loss"}>
                        {r.event.direction}
                      </Badge>
                      {r.setup ? (
                        <Badge variant="neon">{r.setup.name}</Badge>
                      ) : (
                        <span className="text-display text-[10px] text-warn tracking-wider">
                          ◌ unenriched
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-mono text-sm font-medium",
                        m.netPnlDollars > 0 && "text-gain",
                        m.netPnlDollars < 0 && "text-loss",
                      )}
                    >
                      {formatCurrency(m.netPnlDollars, { sign: true })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Process compliance · Goals</CardTitle>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No goals set yet.{" "}
              <Link href="/goals" className="text-neon hover:underline">
                Add goals →
              </Link>
            </div>
          ) : (
            <ComplianceList
              date={today}
              goals={goals.map((g) => ({
                id: g.id,
                rule: g.rule,
                type: g.type as "mechanical" | "reflective",
              }))}
              checks={
                new Map(
                  checks.map(
                    (c) =>
                      [
                        c.goalId,
                        {
                          goalId: c.goalId,
                          passed: c.passed,
                          autoChecked: c.autoChecked,
                        },
                      ] as const,
                  ),
                )
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Hero({
  label,
  big,
  bigClass,
  sub,
}: {
  label: string;
  big: string;
  bigClass?: string;
  sub: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-display text-3xl font-bold leading-none", bigClass)}>
          {big}
        </div>
        <div className="mt-2">{sub}</div>
      </CardContent>
    </Card>
  );
}
