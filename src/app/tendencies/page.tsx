import { PageHeader } from "@/components/page-header";
import { TwoPane } from "@/components/two-pane";
import { listTendencies } from "@/lib/queries";
import {
  TendenciesAddButton,
  TendencyEditButton,
} from "@/components/tendency-controls";

export const dynamic = "force-dynamic";

export default async function TendenciesPage() {
  const tendencies = await listTendencies();
  const items = tendencies.map((t) => ({
    id: t.id,
    name: t.name,
    detail: (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-display text-2xl text-orange-neon">{t.name}</h2>
          <span className="ml-auto" />
          <TendencyEditButton tendency={t} />
        </div>
        <Field label="Description" value={t.oneLiner} />
        <Field label="Triggers" value={t.triggers} />
        <Field label="Counter-strategy" value={t.counterStrategy} />
        <div className="text-sm text-muted-foreground">
          Stats populate as you tag trades with this tendency.
        </div>
      </div>
    ),
  }));
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Reference"
        title="TENDENCIES"
        subtitle="SELF-TAGGED BEHAVIOURAL BIASES"
        right={<TendenciesAddButton />}
      />
      <TwoPane items={items} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-display text-[10px] tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground/90 whitespace-pre-line">
        {value ?? "—"}
      </div>
    </div>
  );
}
