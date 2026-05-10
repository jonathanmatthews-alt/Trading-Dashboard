import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const goals = await db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.archived, false));

  /* Compliance % over last 30 entries per goal */
  const allChecks = await db.select().from(schema.goalDailyChecks);
  const byGoal = new Map<number, { passed: number; total: number }>();
  for (const c of allChecks) {
    const cur = byGoal.get(c.goalId) ?? { passed: 0, total: 0 };
    cur.total += 1;
    if (c.passed) cur.passed += 1;
    byGoal.set(c.goalId, cur);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Reference"
        title="GOALS"
        subtitle="PROCESS RULES · DAILY COMPLIANCE %"
      />
      <Card>
        <CardHeader>
          <CardTitle>Process goals</CardTitle>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No goals yet. (Goal-creation UI coming in v1.5.)
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {goals.map((g) => {
                const stats = byGoal.get(g.id);
                const compliance =
                  stats && stats.total > 0 ? stats.passed / stats.total : null;
                return (
                  <li key={g.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={g.type === "mechanical" ? "neon" : "muted"}>
                        {g.type}
                      </Badge>
                      <span className="text-sm text-foreground">{g.rule}</span>
                    </div>
                    <span className="text-mono text-sm text-muted-foreground">
                      {compliance != null
                        ? `${(compliance * 100).toFixed(0)}% (${stats!.passed}/${stats!.total})`
                        : "no data"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
