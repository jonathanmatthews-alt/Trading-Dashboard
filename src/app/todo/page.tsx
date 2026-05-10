import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/db/client";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const items = await db.select().from(schema.todoItems);
  const recurring = items.filter((i) => i.kind === "recurring");
  const backlog = items.filter((i) => i.kind === "backlog" && !i.done);

  const todayChecks = await db
    .select()
    .from(schema.todoChecks)
    .where(eq(schema.todoChecks.date, today));
  const checkedToday = new Set(todayChecks.map((c) => c.todoItemId));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow="Reference" title="TO-DO" subtitle="DAILY · BACKLOG" />

      <Card>
        <CardHeader>
          <CardTitle>Today · daily checklist</CardTitle>
        </CardHeader>
        <CardContent>
          {recurring.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No recurring items.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {recurring.map((it) => {
                const done = checkedToday.has(it.id);
                return (
                  <li key={it.id} className="flex items-center gap-3 py-2">
                    <span
                      className={
                        "inline-block h-3 w-3 rounded-sm border " +
                        (done
                          ? "border-gain bg-gain/40"
                          : "border-muted-foreground/40")
                      }
                    />
                    <span
                      className={
                        "text-sm " + (done ? "line-through text-muted-foreground" : "")
                      }
                    >
                      {it.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backlog</CardTitle>
        </CardHeader>
        <CardContent>
          {backlog.length === 0 ? (
            <div className="text-sm text-muted-foreground">No backlog items.</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {backlog.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2">
                  <Badge variant="muted">backlog</Badge>
                  <span className="text-sm">{it.title}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
