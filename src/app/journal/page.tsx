import { format, parseISO } from "date-fns";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listTradeRows, metricsForRow } from "@/lib/queries";
import { cn, formatCurrency, formatR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const rows = await listTradeRows({ limit: 200 });
  const withNotes = rows.filter((r) => (r.event.note ?? "").trim().length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Daily"
        title="JOURNAL"
        subtitle="CHRONOLOGICAL READER · PER-TRADE NOTES"
      />
      {withNotes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No journal entries yet. Click any trade in{" "}
            <Link href="/trades" className="text-neon hover:underline">
              Trades
            </Link>{" "}
            to write one.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {withNotes.map((r) => {
            const m = metricsForRow(r);
            return (
              <li key={r.event.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-display text-xl text-orange-neon">
                        {r.event.instrument}
                      </span>
                      <Badge variant={r.event.direction === "long" ? "win" : "loss"}>
                        {r.event.direction}
                      </Badge>
                      {r.setup && <Badge variant="neon">{r.setup.name}</Badge>}
                      <span
                        className={cn(
                          "text-mono text-sm font-medium ml-auto",
                          m.pnlDollars > 0 && "text-gain",
                          m.pnlDollars < 0 && "text-loss",
                        )}
                      >
                        {formatCurrency(m.pnlDollars, { sign: true })} ·{" "}
                        {formatR(m.pnlR)}
                      </span>
                    </div>
                    <div className="text-mono text-xs text-muted-foreground">
                      {format(parseISO(r.event.entryTime), "EEE MMM d yyyy · HH:mm")}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/90 whitespace-pre-line">
                      {r.event.note}
                    </p>
                    <Link
                      href="/trades"
                      className="text-display mt-3 inline-block text-[10px] tracking-widest text-muted-foreground hover:text-neon"
                    >
                      open trade →
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
