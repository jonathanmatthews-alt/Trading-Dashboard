import { PageHeader } from "@/components/page-header";
import { FastLogForm } from "@/components/fast-log-form";
import { TradeRowItem, TradeListHeader } from "@/components/trade-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listTradeRows,
  metricsForRow,
  listInstruments,
  listActiveAccounts,
  listSetups,
  listMistakes,
  listTendencies,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  const showLog = sp.new === "1";

  const [rows, instruments, accounts, setups, mistakes, tendencies] = await Promise.all([
    listTradeRows({ limit: 200 }),
    listInstruments(),
    listActiveAccounts(),
    listSetups(),
    listMistakes(),
    listTendencies(),
  ]);

  const unenrichedCount = rows.filter((r) => !r.event.enriched).length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="History"
        title="TRADES"
        subtitle="ALL ACCOUNTS · LATEST 200"
        right={
          unenrichedCount > 0 ? (
            <a
              href="/trades/review"
              className="text-display rounded border border-orange-neon/50 bg-orange-neon/10 px-3 py-1.5 text-[11px] text-orange-neon hover:bg-orange-neon/20"
            >
              ◌ Review {unenrichedCount} unenriched
            </a>
          ) : null
        }
      />

      <div className="mb-6">
        <FastLogForm instruments={instruments} accounts={accounts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TradeListHeader />
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No trades yet — log your first one above.
            </div>
          ) : (
            rows.map((r) => (
              <TradeRowItem
                key={r.event.id}
                row={r}
                metrics={metricsForRow(r)}
                setups={setups}
                mistakes={mistakes}
                tendencies={tendencies}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
