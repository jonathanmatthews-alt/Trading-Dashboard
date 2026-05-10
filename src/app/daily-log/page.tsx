import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { DailyLogEditor } from "@/components/daily-log-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DailyLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date ?? format(new Date(), "yyyy-MM-dd");

  const [current] = await db
    .select()
    .from(schema.dailyLogs)
    .where(eq(schema.dailyLogs.date, date))
    .limit(1);

  const recent = await db
    .select()
    .from(schema.dailyLogs)
    .orderBy(desc(schema.dailyLogs.date))
    .limit(20);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="History"
        title="DAILY LOG"
        subtitle={`ENTRY · ${date}`}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
        <Card>
          <CardHeader>
            <CardTitle>{date}</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyLogEditor date={date} initial={current ?? null} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent entries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/40">
              {recent.map((r) => (
                <li key={r.date}>
                  <a
                    href={`/daily-log?date=${r.date}`}
                    className="block px-3 py-2 text-mono text-xs text-muted-foreground hover:text-neon hover:bg-secondary/30"
                  >
                    {r.date}
                  </a>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="px-3 py-3 text-mono text-xs text-muted-foreground/60">
                  No entries yet.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
