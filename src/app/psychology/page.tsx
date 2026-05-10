import { PageHeader } from "@/components/page-header";
import { TwoPane } from "@/components/two-pane";
import { listBiases } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PsychologyPage() {
  const biases = await listBiases();
  const items = biases.map((b) => ({
    id: b.id,
    name: b.name,
    detail: (
      <div className="space-y-6">
        <h2 className="text-display text-2xl text-orange-neon">{b.name}</h2>
        <Field label="Definition" value={b.definition} />
        <Field label="Examples" value={b.examples} />
        <Field label="Recognition cues" value={b.recognitionCues} />
        <Field label="Countermeasure" value={b.countermeasure} />
      </div>
    ),
  }));
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Reference"
        title="PSYCHOLOGY"
        subtitle="COGNITIVE BIAS LIBRARY"
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
