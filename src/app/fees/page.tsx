import { PageHeader } from "@/components/page-header";
import { FeesTable } from "@/components/fees-table";
import { db, schema } from "@/db/client";
import { listFirms, listInstruments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FeesPage() {
  const [firms, instruments, fees] = await Promise.all([
    listFirms(),
    listInstruments(),
    db.select().from(schema.feeSchedules),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Account"
        title="FEES"
        subtitle="ROUND-TRIP COST PER CONTRACT · PER FIRM × INSTRUMENT"
      />
      <p className="mb-6 max-w-3xl text-mono text-xs text-muted-foreground/80">
        Net PnL across the dashboard is computed as gross minus these fees.
        Stage-specific overrides take precedence over firm defaults — useful
        for tiers like Apex's PA-Edge that get a cheaper rate.
      </p>
      <FeesTable firms={firms} instruments={instruments} fees={fees} />
    </div>
  );
}
