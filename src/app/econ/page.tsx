import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/db/client";
import { desc } from "drizzle-orm";
import { NewsEntryForm } from "@/components/news-entry-form";

export const dynamic = "force-dynamic";

export default async function EconPage() {
  const events = await db
    .select()
    .from(schema.newsEvents)
    .orderBy(desc(schema.newsEvents.date), desc(schema.newsEvents.time));

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Macro"
        title="ECONOMIC CALENDAR"
        subtitle="NEWS / EVENT LOG · MANUAL + AUTO"
      />
      <Card>
        <CardHeader>
          <CardTitle>Add event</CardTitle>
        </CardHeader>
        <CardContent>
          <NewsEntryForm defaultDate={today} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No events yet. Auto-feed integration TBD; in the meantime add the
              big ones (CPI, FOMC, NFP, ECB) manually.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {events.map((e) => (
                <li key={e.id} className="grid grid-cols-[80px_60px_1fr_80px_80px] items-center gap-3 px-4 py-2.5">
                  <span className="text-mono text-xs text-muted-foreground">
                    {e.date}
                  </span>
                  <span className="text-mono text-xs text-muted-foreground">
                    {e.time ?? ""}
                  </span>
                  <span className="text-sm text-foreground">{e.title}</span>
                  <Badge
                    variant={
                      e.impact === "high"
                        ? "loss"
                        : e.impact === "medium"
                          ? "warn"
                          : "muted"
                    }
                  >
                    {e.impact}
                  </Badge>
                  <span className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    {e.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
