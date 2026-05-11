import { PageHeader } from "@/components/page-header";
import { FeesTable } from "@/components/fees-table";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { listFirms, listInstruments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FeesPage() {
  const [firms, instruments, fees, paAccounts] = await Promise.all([
    listFirms(),
    listInstruments(),
    db.select().from(schema.feeSchedules),
    db.select().from(schema.accounts).where(eq(schema.accounts.accountType, "pa")),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Account"
        title="FEES"
        subtitle="ROUND-TRIP COST PER CONTRACT"
      />
      <p className="mb-6 max-w-3xl text-mono text-xs text-muted-foreground/80">
        Net PnL across the dashboard = gross − these fees. Prop firms use the
        firm-wide schedule (every Apex account uses the Apex fee). PA accounts
        each have their own schedule because brokers differ per account.
      </p>
      <FeesTable
        firms={firms}
        paAccounts={paAccounts}
        instruments={instruments}
        fees={fees}
      />
    </div>
  );
}
