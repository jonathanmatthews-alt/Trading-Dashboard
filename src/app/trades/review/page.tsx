import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  listTradeRows,
  metricsForRow,
  loadFeeMap,
  listSetups,
  listMistakes,
  listTendencies,
} from "@/lib/queries";
import { ReviewQueue } from "@/components/review-queue";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; i?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.mode === "list" ? "list" : "wizard";

  const [allRows, setups, mistakes, tendencies, feeMap] = await Promise.all([
    listTradeRows({ limit: 500 }),
    listSetups(),
    listMistakes(),
    listTendencies(),
    loadFeeMap(),
  ]);

  /* Unenriched only. Newest first — you usually review today's trades. */
  const unenriched = allRows.filter((r) => !r.event.enriched);

  const queueItems = unenriched.map((r) => ({
    row: r,
    metrics: metricsForRow(r, feeMap),
  }));

  if (queueItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="History"
          title="REVIEW QUEUE"
          subtitle="ENRICH UNTAGGED TRADES"
        />
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-display text-xl text-gain mb-2">
              ✓ ALL CLEAR
            </div>
            <p className="text-mono text-sm text-muted-foreground mb-4">
              No unenriched trades. Every trade has a setup tag.
            </p>
            <Link
              href="/trades"
              className="text-display text-[11px] tracking-widest text-neon hover:underline"
            >
              back to trades →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initialIndex = Math.max(
    0,
    Math.min(queueItems.length - 1, Number(sp.i ?? 0) || 0),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="History"
        title="REVIEW QUEUE"
        subtitle={`${queueItems.length} TRADE${queueItems.length === 1 ? "" : "S"} UNENRICHED`}
      />
      <ReviewQueue
        items={queueItems}
        setups={setups}
        mistakes={mistakes}
        tendencies={tendencies}
        mode={mode}
        initialIndex={initialIndex}
      />
    </div>
  );
}
