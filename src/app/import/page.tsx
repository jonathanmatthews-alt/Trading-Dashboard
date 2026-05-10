import { PageHeader } from "@/components/page-header";
import { CsvImporter } from "@/components/csv-importer";
import { listActiveAccounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const accounts = await listActiveAccounts();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Tools"
        title="CSV IMPORT"
        subtitle="GENERIC COLUMN-MAPPER · ANY BROKER"
      />
      <CsvImporter accounts={accounts} />
    </div>
  );
}
